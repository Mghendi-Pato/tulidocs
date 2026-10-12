import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomBytes } from 'node:crypto';
import { FREE_MONTHLY_DOCS, hasPaidPlan } from '../billing/plans';
import { BRAND } from '../common/brand';
import { countryInfo, defaultCurrency } from '../common/countries';
import { isoOf, startOfMonth } from '../common/dates';
import { AuthUser, JwtPayload } from '../common/types';
import { GuestService } from '../guest/guest.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AppleConfig, appleAuthorizeUrl, appleExchange } from './apple';
import { ChangePasswordDto, SignupDto } from './dto/auth.dto';
import { emailLayout, escapeHtml, MailService } from '../mail/mail.service';

const GOOGLE_STATE_TTL = 10 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly guest: GuestService,
    private readonly mail: MailService,
  ) {}

  private sign(user: Pick<User, 'id' | 'organizationId'>) {
    const payload: JwtPayload = { sub: user.id, org: user.organizationId ?? null };
    return this.jwt.sign(payload);
  }

  /** Public config for the login page */
  config_() {
    return {
      platformName: BRAND.name,
      googleEnabled: !!(this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET')),
      appleEnabled: !!this.appleConfig(),
      signupEnabled: this.config.get('SIGNUP_ENABLED', 'true') !== 'false',
    };
  }

  // ───────────────────────── Email + password ─────────────────────────

  async login(email: string, password: string, guestToken: string | null) {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { organization: { select: { status: true } } } });
    // same message whether the email or the password is wrong
    const bad = () => new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' });
    if (!user || !user.isActive) throw bad();
    if (!user.passwordHash) {
      if (user.appleId && !user.googleId) throw new UnauthorizedException({ code: 'USE_APPLE', message: 'This account signs in with Apple. Use “Continue with Apple”.' });
      throw new UnauthorizedException({ code: 'USE_GOOGLE', message: 'This account signs in with Google. Use “Continue with Google”.' });
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) throw bad();
    // right password, but the address was never confirmed → no session until they click the emailed link
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'Please confirm your email first — open the link we emailed you to activate your account.' });
    }
    if (user.organization?.status === 'SUSPENDED') {
      throw new UnauthorizedException({ code: 'TENANT_SUSPENDED', message: 'This business account is suspended. Please contact tuli support.' });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const claimed = user.organizationId ? await this.guest.claim(guestToken, user.organizationId) : 0;
    return { token: this.sign(user), user: { id: user.id, name: user.name, email: user.email }, claimed };
  }

  /**
   * Creates the account but does NOT sign in: the user must confirm their email first (the link signs them in).
   * Signing up again with an address that was never confirmed just updates the password and re-sends the link.
   */
  async signup(dto: SignupDto, guestToken: string | null, next?: string | null) {
    if (!this.config_().signupEnabled) throw new BadRequestException({ code: 'SIGNUP_CLOSED', message: 'Sign-up is closed' });
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists?.emailVerifiedAt || (exists && !exists.passwordHash)) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'An account with this email already exists. Sign in instead.' });
    }
    let user = exists;
    if (user) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(dto.password, 11) } });
    } else {
      const name = dto.name || nameFromEmail(dto.email);
      user = await this.createBusiness({ name, email: dto.email, businessName: dto.businessName || `${name.split(/\s+/)[0]}'s Business`, country: dto.country, passwordHash: await bcrypt.hash(dto.password, 11) });
    }
    const claimed = user.organizationId ? await this.guest.claim(guestToken, user.organizationId) : 0;
    await this.sendVerification(user, next);
    return { verificationRequired: true as const, email: user.email, claimed };
  }

  /** New business with country defaults (currency, tax wording and rate) — all editable in Settings */
  private createBusiness(input: { name: string; email: string; businessName: string; country?: string | null; passwordHash?: string; googleId?: string; appleId?: string; avatarUrl?: string | null }) {
    const c = countryInfo(input.country);
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.businessName,
          email: input.email,
          country: c.code === 'XX' ? null : c.code,
          currency: defaultCurrency(c.code),
          taxName: c.taxName,
          taxIdLabel: c.taxIdLabel,
          defaultTaxRate: String(c.taxRate),
        },
      });
      return tx.user.create({
        data: {
          organizationId: org.id,
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash ?? null,
          googleId: input.googleId ?? null,
          appleId: input.appleId ?? null,
          avatarUrl: input.avatarUrl ?? null,
          role: 'ADMIN',
          lastLoginAt: new Date(),
          // Google / Apple have already confirmed the address
          emailVerifiedAt: input.googleId || input.appleId ? new Date() : null,
        },
      });
    });
  }

  /** Changes the password and signs out every other device; returns a fresh session for this one. */
  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (u.passwordHash && !(dto.currentPassword && (await bcrypt.compare(dto.currentPassword, u.passwordHash)))) {
      throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Your current password is incorrect' });
    }
    const updated = await this.setPassword(u.id, dto.newPassword);
    void this.sendPasswordChanged(updated.email, updated.name);
    return { token: this.sign(updated) };
  }

  // ───────────────────────── Password reset ─────────────────────────

  private resetKey = (hash: string) => `pwreset:${hash}`;
  private resetUserKey = (userId: string) => `pwreset:user:${userId}`;
  private static RESET_TTL = 60 * 60; // 1 hour

  /**
   * Emails a one-time reset link. Always answers the same way, so it can't be used to find out who has an account.
   * At most 3 emails per address per hour.
   */
  async forgotPassword(email: string) {
    const ok = { ok: true as const };
    const addr = email.trim().toLowerCase();
    const sent = await this.redis.client.incr(this.redis.key(`pwreset:count:${addr}`));
    if (sent === 1) await this.redis.client.expire(this.redis.key(`pwreset:count:${addr}`), 3600);
    if (sent > 3) return ok;

    const user = await this.prisma.user.findUnique({ where: { email: addr } });
    if (!user || !user.isActive) return ok;

    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(token).digest('hex');
    // one live link per user: a new request cancels the previous link
    const previous = await this.redis.getJson<string>(this.resetUserKey(user.id));
    if (previous) await this.redis.del(this.resetKey(previous));
    await this.redis.setJson(this.resetKey(hash), user.id, AuthService.RESET_TTL);
    await this.redis.setJson(this.resetUserKey(user.id), hash, AuthService.RESET_TTL);

    const url = `${this.appUrl()}/reset-password/?token=${token}`;
    const first = (user.name || '').split(/\s+/)[0] || 'there';
    await this.mail.send({
      to: user.email,
      subject: 'Reset your tuli password',
      text: `Hi ${first},\n\nUse this link to choose a new password for tuli. It works once and expires in 60 minutes:\n${url}\n\nIf you didn't ask for this, ignore this email — your password stays the same.`,
      html: emailLayout({
        heading: 'Reset your password',
        paragraphs: [
          `Hi ${escapeHtml(first)},`,
          'We received a request to reset the password for your tuli account. Click the button to choose a new one. The link works once and expires in 60 minutes.',
        ],
        button: { label: 'Choose a new password', url },
        footnote: 'Didn’t ask for this? You can ignore this email — your password stays the same.',
      }),
    });
    return ok;
  }

  /** Is a reset link still usable? (lets the page say "expired" before the user types a new password) */
  async checkResetToken(token: string) {
    const userId = await this.redis.getJson<string>(this.resetKey(createHash('sha256').update(token).digest('hex')));
    if (!userId) return { valid: false as const };
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, isActive: true } });
    if (!user?.isActive) return { valid: false as const };
    const [name, domain] = user.email.split('@');
    return { valid: true as const, email: `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}` };
  }

  /** Sets the new password, burns the link, signs out other devices and signs this one in. */
  async resetPassword(token: string, password: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const userId = await this.redis.take<string>(this.resetKey(hash));
    if (!userId) throw new BadRequestException({ code: 'RESET_EXPIRED', message: 'This reset link has expired or was already used. Request a new one.' });
    await this.redis.del(this.resetUserKey(userId));
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing?.isActive) throw new BadRequestException({ code: 'RESET_EXPIRED', message: 'This reset link has expired or was already used. Request a new one.' });
    const user = await this.setPassword(userId, password);
    // following the emailed link proves the address
    if (!user.emailVerifiedAt) await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    void this.sendPasswordChanged(user.email, user.name);
    return { token: this.sign(user), user: { id: user.id, name: user.name, email: user.email } };
  }

  private async setPassword(userId: string, password: string) {
    // stamped one second back so the session issued right after (same second) stays valid
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, 11), passwordChangedAt: new Date(Date.now() - 1000) },
    });
  }

  private async sendPasswordChanged(email: string, name: string | null) {
    const first = (name || '').split(/\s+/)[0] || 'there';
    await this.mail.send({
      to: email,
      subject: 'Your tuli password was changed',
      text: `Hi ${first},\n\nThe password for your tuli account was just changed, and other devices were signed out.\n\nIf this wasn't you, reset your password now at ${this.appUrl()}/forgot-password/ and contact us at info@nubiannetworks.com.`,
      html: emailLayout({
        heading: 'Your password was changed',
        paragraphs: [
          `Hi ${escapeHtml(first)},`,
          'The password for your tuli account was just changed. For your security, any other devices signed in to your account have been signed out.',
          `<strong>Wasn’t you?</strong> Reset your password straight away and let us know at <a href="mailto:info@nubiannetworks.com" style="color:#2451d6">info@nubiannetworks.com</a>.`,
        ],
        button: { label: 'Reset my password', url: `${this.appUrl()}/forgot-password/` },
      }),
    });
  }

  // ───────────────────────── Email verification ─────────────────────────

  private verifyKey = (hash: string) => `verify:${hash}`;
  private verifyUserKey = (userId: string) => `verify:user:${userId}`;
  private static VERIFY_TTL = 3 * 24 * 60 * 60; // 3 days

  /**
   * Google/Apple just proved this address. If the account was an unconfirmed password sign-up, that password may
   * belong to someone else who registered the address first — remove it and sign those sessions out.
   */
  private provenByProvider(user: { emailVerifiedAt: Date | null; passwordHash: string | null }) {
    if (user.emailVerifiedAt) return {};
    return user.passwordHash
      ? { emailVerifiedAt: new Date(), passwordHash: null, passwordChangedAt: new Date(Date.now() - 1000) }
      : { emailVerifiedAt: new Date() };
  }

  /** Emails a "confirm your address" link (one live link per user; a new one replaces the old) */
  async sendVerification(user: { id: string; email: string; name: string | null; emailVerifiedAt?: Date | null }, next?: string | null) {
    if (user.emailVerifiedAt) return;
    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(token).digest('hex');
    const previous = await this.redis.getJson<string>(this.verifyUserKey(user.id));
    if (previous) await this.redis.del(this.verifyKey(previous));
    await this.redis.setJson(this.verifyKey(hash), { userId: user.id, next: safeNext(next ?? undefined) }, AuthService.VERIFY_TTL);
    await this.redis.setJson(this.verifyUserKey(user.id), hash, AuthService.VERIFY_TTL);

    const url = `${this.appUrl()}/verify-email/?token=${token}`;
    const first = (user.name || '').split(/\s+/)[0] || 'there';
    await this.mail.send({
      to: user.email,
      subject: 'Confirm your email for tuli',
      text: `Hi ${first},\n\nWelcome to tuli! Confirm your email to activate your account:\n${url}\n\nThe link expires in 3 days. If you didn't create a tuli account, you can ignore this email.`,
      html: emailLayout({
        heading: 'Confirm your email',
        paragraphs: [
          `Hi ${escapeHtml(first)},`,
          'Welcome to tuli! Confirm your email address to activate your account — the button signs you straight in.',
        ],
        button: { label: 'Confirm & sign in', url },
        footnote: 'The link expires in 3 days. Didn’t create a tuli account? You can ignore this email.',
      }),
    });
  }

  /** Re-sends the confirmation link. Same answer whatever the address, so it can't reveal who has an account. */
  async resendVerification(email: string) {
    const ok = { ok: true as const };
    const addr = email.trim().toLowerCase();
    const key = this.redis.key(`verify:count:${addr}`);
    const n = await this.redis.client.incr(key);
    if (n === 1) await this.redis.client.expire(key, 15 * 60);
    if (n > 3) return ok;
    const user = await this.prisma.user.findUnique({ where: { email: addr } });
    if (user && !user.emailVerifiedAt && user.isActive) await this.sendVerification(user);
    return ok;
  }

  /** Confirms the address from the emailed link and signs the user in */
  async verifyEmail(token: string) {
    const hash = createHash('sha256').update(token).digest('hex');
    const data = await this.redis.take<{ userId: string; next: string | null }>(this.verifyKey(hash));
    if (!data) throw new BadRequestException({ code: 'VERIFY_EXPIRED', message: 'This confirmation link has expired or was already used.' });
    await this.redis.del(this.verifyUserKey(data.userId));
    const user = await this.prisma.user.update({ where: { id: data.userId }, data: { emailVerifiedAt: new Date(), lastLoginAt: new Date() } });
    if (!user.isActive) throw new BadRequestException({ code: 'VERIFY_EXPIRED', message: 'This account is deactivated.' });
    return { token: this.sign(user), user: { id: user.id, name: user.name, email: user.email }, next: data.next };
  }

  private appUrl() {
    return this.config.get<string>('APP_URL', 'http://localhost:3000').replace(/\/$/, '');
  }

  async updateProfile(user: AuthUser, name: string) {
    await this.prisma.user.update({ where: { id: user.id }, data: { name } });
    return this.me(user);
  }

  // ───────────────────────── Google ─────────────────────────

  private google() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const secret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId || !secret) throw new ServiceUnavailableException({ code: 'GOOGLE_DISABLED', message: 'Google sign-in is not set up' });
    const redirectUri = this.config.get<string>('GOOGLE_REDIRECT_URI') ?? `${this.config.get('API_PUBLIC_URL', 'http://localhost:3000/api')}/auth/google/callback`;
    return { client: new OAuth2Client(clientId, secret, redirectUri), clientId };
  }

  /** Where to send the browser to start Google sign-in */
  async googleStart(next?: string, country?: string | null) {
    const { client } = this.google();
    const state = randomBytes(24).toString('base64url');
    await this.redis.setJson(`oauth:${state}`, { next: safeNext(next), country: country ?? null }, GOOGLE_STATE_TTL);
    return client.generateAuthUrl({ scope: ['openid', 'email', 'profile'], state, prompt: 'select_account', access_type: 'online' });
  }

  /** Finishes Google sign-in: links to an existing account by email, or creates a new business. */
  async googleCallback(code: string, state: string, guestToken: string | null) {
    const saved = await this.redis.take<{ next: string; country?: string | null }>(`oauth:${state}`);
    if (!saved) throw new UnauthorizedException({ code: 'OAUTH_STATE', message: 'Sign-in expired. Please try again.' });
    const { client, clientId } = this.google();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) throw new UnauthorizedException({ code: 'OAUTH_FAILED', message: 'Google did not return an identity' });
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email || !p.email_verified) throw new UnauthorizedException({ code: 'OAUTH_FAILED', message: 'Your Google email is not verified' });
    const email = p.email.toLowerCase();

    let isNew = false;
    let user = await this.prisma.user.findFirst({ where: { OR: [{ googleId: p.sub }, { email }] }, include: { organization: { select: { status: true } } } });
    if (user) {
      if (!user.isActive) throw new UnauthorizedException({ code: 'INACTIVE', message: 'This account is deactivated' });
      if (user.organization?.status === 'SUSPENDED') throw new UnauthorizedException({ code: 'TENANT_SUSPENDED', message: 'This business account is suspended' });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: p.sub, avatarUrl: p.picture ?? user.avatarUrl, lastLoginAt: new Date(), ...this.provenByProvider(user) },
      });
    } else {
      if (!this.config_().signupEnabled) throw new UnauthorizedException({ code: 'SIGNUP_CLOSED', message: 'Sign-up is closed' });
      const name = p.name || email.split('@')[0];
      const created = await this.createBusiness({ name, email, businessName: `${p.given_name || name}'s Business`, country: saved.country, googleId: p.sub, avatarUrl: p.picture ?? null });
      user = { ...created, organization: { status: 'ACTIVE' } };
      isNew = true;
    }
    const claimed = user.organizationId ? await this.guest.claim(guestToken, user.organizationId) : 0;
    this.logger.log(`Google sign-in ${email}${isNew ? ' (new business)' : ''}`);
    const next = isNew ? '/settings/?welcome=1' : user.role === 'SYSTEM_ADMIN' ? '/platform/' : saved.next;
    return { token: this.sign(user), next, claimed };
  }

  // ───────────────────────── Apple ─────────────────────────

  private appleConfig(): AppleConfig | null {
    const servicesId = this.config.get<string>('APPLE_SERVICES_ID');
    const teamId = this.config.get<string>('APPLE_TEAM_ID');
    const keyId = this.config.get<string>('APPLE_KEY_ID');
    const privateKey = this.config.get<string>('APPLE_PRIVATE_KEY');
    if (!servicesId || !teamId || !keyId || !privateKey) return null;
    const redirectUri = this.config.get<string>('APPLE_REDIRECT_URI') ?? `${this.config.get('API_PUBLIC_URL', 'http://localhost:3000/api')}/auth/apple/callback`;
    return { servicesId, teamId, keyId, privateKey, redirectUri };
  }

  /** Where to send the browser to start Sign in with Apple */
  async appleStart(next?: string, country?: string | null) {
    const c = this.appleConfig();
    if (!c) throw new ServiceUnavailableException({ code: 'APPLE_DISABLED', message: 'Apple sign-in is not set up' });
    const state = randomBytes(24).toString('base64url');
    await this.redis.setJson(`oauth:${state}`, { next: safeNext(next), country: country ?? null }, GOOGLE_STATE_TTL);
    return appleAuthorizeUrl(c, state);
  }

  /**
   * Finishes Sign in with Apple. Apple only sends the person's name the very first time,
   * in the `user` form field. Links to an existing account by Apple ID or email, or creates a business.
   */
  async appleCallback(code: string, state: string, userJson: string | undefined, guestToken: string | null) {
    const saved = await this.redis.take<{ next: string; country?: string | null }>(`oauth:${state}`);
    if (!saved) throw new UnauthorizedException({ code: 'OAUTH_STATE', message: 'Sign-in expired. Please try again.' });
    const c = this.appleConfig();
    if (!c) throw new ServiceUnavailableException({ code: 'APPLE_DISABLED', message: 'Apple sign-in is not set up' });
    const id = await appleExchange(c, code).catch((e: Error) => {
      this.logger.warn(`Apple sign-in failed: ${e.message}`);
      throw new UnauthorizedException({ code: 'OAUTH_FAILED', message: 'We couldn’t verify your Apple ID' });
    });
    let given: { name?: { firstName?: string; lastName?: string } } = {};
    try {
      given = userJson ? JSON.parse(userJson) : {};
    } catch {
      /* ignore */
    }
    const fullName = [given.name?.firstName, given.name?.lastName].filter(Boolean).join(' ').trim();

    let isNew = false;
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ appleId: id.sub }, ...(id.email && id.emailVerified ? [{ email: id.email }] : [])] },
      include: { organization: { select: { status: true } } },
    });
    if (user) {
      if (!user.isActive) throw new UnauthorizedException({ code: 'INACTIVE', message: 'This account is deactivated' });
      if (user.organization?.status === 'SUSPENDED') throw new UnauthorizedException({ code: 'TENANT_SUSPENDED', message: 'This business account is suspended' });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { appleId: id.sub, lastLoginAt: new Date(), ...(id.email && id.emailVerified ? this.provenByProvider(user) : {}) },
      });
    } else {
      if (!id.email) throw new UnauthorizedException({ code: 'OAUTH_FAILED', message: 'Apple didn’t share an email address' });
      if (!this.config_().signupEnabled) throw new UnauthorizedException({ code: 'SIGNUP_CLOSED', message: 'Sign-up is closed' });
      const name = fullName || id.email.split('@')[0];
      const created = await this.createBusiness({ name, email: id.email, businessName: `${given.name?.firstName || name.split(/\s+/)[0]}'s Business`, country: saved.country, appleId: id.sub });
      user = { ...created, organization: { status: 'ACTIVE' } };
      isNew = true;
    }
    const claimed = user.organizationId ? await this.guest.claim(guestToken, user.organizationId) : 0;
    this.logger.log(`Apple sign-in ${user.email}${isNew ? ' (new business)' : ''}`);
    const next = isNew ? '/settings/?welcome=1' : user.role === 'SYSTEM_ADMIN' ? '/platform/' : saved.next;
    return { token: this.sign(user), next, claimed };
  }

  // ───────────────────────── Me ─────────────────────────

  async me(auth: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.id },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, passwordHash: true, googleId: true, organizationId: true, emailVerifiedAt: true },
    });
    const base = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      hasPassword: !!user.passwordHash,
      google: !!user.googleId,
      emailVerified: !!user.emailVerifiedAt,
    };
    if (!user.organizationId) return { ...base, organization: null };
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
    const paid = hasPaidPlan(org);
    const used = await this.prisma.document.count({ where: { organizationId: org.id, type: { in: ['QUOTE', 'INVOICE'] }, createdAt: { gte: startOfMonth() } } });
    return {
      ...base,
      organization: {
        id: org.id,
        name: org.name,
        currency: org.currency,
        country: org.country,
        taxName: org.taxName,
        taxIdLabel: org.taxIdLabel,
        hasLogo: !!org.logo,
        defaultTemplate: org.defaultTemplate,
        plan: paid ? org.plan : 'FREE',
        planExpiresAt: paid ? isoOf(org.planExpiresAt) : null,
        watermark: !paid,
        usage: { used, limit: paid ? null : FREE_MONTHLY_DOCS },
        etimsEnabled: org.etimsEnabled,
      },
    };
  }
}

/** Only same-site paths after sign-in (no open redirects) */
export function safeNext(next?: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/dashboard/';
}

/** "jane.wanjiru+work@x.com" → "Jane Wanjiru" — a placeholder until the user sets their name. */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0].split('+')[0];
  const words = local.split(/[._\-\d]+/).filter(Boolean);
  const name = words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return name.length >= 2 ? name.slice(0, 120) : 'My';
}
