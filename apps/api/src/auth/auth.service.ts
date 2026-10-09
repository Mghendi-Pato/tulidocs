import { BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';
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
    if (user.organization?.status === 'SUSPENDED') {
      throw new UnauthorizedException({ code: 'TENANT_SUSPENDED', message: 'This business account is suspended. Please contact tuli support.' });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const claimed = user.organizationId ? await this.guest.claim(guestToken, user.organizationId) : 0;
    return { token: this.sign(user), user: { id: user.id, name: user.name, email: user.email }, claimed };
  }

  async signup(dto: SignupDto, guestToken: string | null) {
    if (!this.config_().signupEnabled) throw new BadRequestException({ code: 'SIGNUP_CLOSED', message: 'Sign-up is closed' });
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (exists) throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'An account with this email already exists. Sign in instead.' });
    const name = dto.name || nameFromEmail(dto.email);
    const user = await this.createBusiness({ name, email: dto.email, businessName: dto.businessName || `${name.split(/\s+/)[0]}'s Business`, country: dto.country, passwordHash: await bcrypt.hash(dto.password, 11) });
    const claimed = await this.guest.claim(guestToken, user.organizationId!);
    return { token: this.sign(user), user: { id: user.id, name: user.name, email: user.email }, claimed };
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
        },
      });
    });
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (u.passwordHash && !(dto.currentPassword && (await bcrypt.compare(dto.currentPassword, u.passwordHash)))) {
      throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Your current password is incorrect' });
    }
    await this.prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 11) } });
    return { ok: true };
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
      await this.prisma.user.update({ where: { id: user.id }, data: { googleId: p.sub, avatarUrl: p.picture ?? user.avatarUrl, lastLoginAt: new Date() } });
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
      await this.prisma.user.update({ where: { id: user.id }, data: { appleId: id.sub, lastLoginAt: new Date() } });
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
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, passwordHash: true, googleId: true, organizationId: true },
    });
    const base = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      hasPassword: !!user.passwordHash,
      google: !!user.googleId,
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
