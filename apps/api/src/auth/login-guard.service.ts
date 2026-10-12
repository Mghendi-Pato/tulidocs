import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { emailLayout, escapeHtml, MailService } from '../mail/mail.service';
import { RedisService } from '../redis/redis.service';

/** Failed password attempts allowed (per account) before sign-in is paused */
export const MAX_FAILED_LOGINS = 5;
/** Failures older than this are forgotten */
const FAIL_WINDOW = 15 * 60;
/** Pause length grows if the account keeps getting locked within a day: 15 min → 1 h → 4 h */
const LOCK_STEPS = [15 * 60, 60 * 60, 4 * 60 * 60];
const LOCK_HISTORY = 24 * 60 * 60;
/** Browsers we've seen this user sign in from (an id in a long-lived cookie) */
const DEVICE_TTL = 400 * 24 * 60 * 60;
export const DEVICE_COOKIE = 'nv_dev';

export interface LoginContext {
  ip?: string | null;
  userAgent?: string | null;
  /** the nv_dev cookie, if this browser has one */
  deviceId?: string | null;
}

/**
 * Brute-force protection and sign-in alerts.
 * - Too many wrong passwords for one email → sign-in for that email is paused (even with the right password) and the owner is emailed.
 *   Counted per email whether or not the account exists, so the response never reveals which emails are registered.
 * - Signing in from a browser we haven't seen for this user → "New sign-in" email.
 */
@Injectable()
export class LoginGuardService {
  private readonly logger = new Logger(LoginGuardService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private failKey = (email: string) => `login:fail:${email}`;
  private lockKey = (email: string) => `login:lock:${email}`;
  private locksKey = (email: string) => `login:locks:${email}`;
  private devicesKey = (userId: string) => `login:devices:${userId}`;

  private appUrl() {
    return this.config.get<string>('APP_URL', 'http://localhost:3000').replace(/\/$/, '');
  }

  /** Throws 423 ACCOUNT_LOCKED while sign-in for this email is paused. Checked before the password, so a correct guess doesn't help. */
  async assertNotLocked(email: string) {
    const ttl = await this.redis.client.ttl(this.redis.key(this.lockKey(email))).catch(() => -2);
    if (ttl > 0) throw this.locked(ttl);
  }

  /** Records a wrong password. Returns the error to throw (with attempts left, or the lock). */
  async recordFailure(email: string, account: { email: string; name: string | null } | null, ctx: LoginContext): Promise<HttpException> {
    const k = this.redis.key(this.failKey(email));
    const fails = await this.redis.client.incr(k).catch(() => 0);
    if (fails === 1) await this.redis.client.expire(k, FAIL_WINDOW).catch(() => undefined);

    if (fails >= MAX_FAILED_LOGINS) {
      const lk = this.redis.key(this.locksKey(email));
      const locks = await this.redis.client.incr(lk).catch(() => 1);
      if (locks === 1) await this.redis.client.expire(lk, LOCK_HISTORY).catch(() => undefined);
      const seconds = LOCK_STEPS[Math.min(locks, LOCK_STEPS.length) - 1];
      await this.redis.client.set(this.redis.key(this.lockKey(email)), '1', 'EX', seconds).catch(() => undefined);
      await this.redis.del(this.failKey(email)).catch(() => undefined);
      this.logger.warn(`Sign-in paused for ${email} (${seconds / 60} min) after ${MAX_FAILED_LOGINS} failed attempts from ${ctx.ip ?? 'unknown IP'}`);
      if (account) void this.sendLockedAlert(account, seconds, ctx).catch((e: Error) => this.logger.warn(`Lock alert failed: ${e.message}`));
      return this.locked(seconds);
    }

    const left = MAX_FAILED_LOGINS - fails;
    return new HttpException(
      {
        code: 'INVALID_CREDENTIALS',
        message: left <= 2 ? `Email or password is incorrect. ${left} attempt${left === 1 ? '' : 's'} left before sign-in is paused.` : 'Email or password is incorrect',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }

  /** Successful sign-in (or password reset): forget the failures and lift any pause. */
  async clear(email: string) {
    await Promise.all([this.redis.del(this.failKey(email)), this.redis.del(this.lockKey(email))]).catch(() => undefined);
  }

  /**
   * Remembers this browser for the user and emails them if it's one we haven't seen before.
   * The very first browser we record for a user is silent (sign-up, or first sign-in after this feature went live).
   * `alert: false` just records the browser (sign-ins from an emailed link — the person already proved they own the inbox).
   * Returns the device id to keep in the nv_dev cookie.
   */
  async noteSignIn(user: { id: string; email: string; name: string | null }, ctx: LoginContext, method: 'password' | 'Google' | 'Apple', alert = true): Promise<string> {
    const deviceId = ctx.deviceId && /^[A-Za-z0-9_-]{16,64}$/.test(ctx.deviceId) ? ctx.deviceId : randomBytes(18).toString('base64url');
    try {
      const k = this.redis.key(this.devicesKey(user.id));
      const [known, count] = await Promise.all([this.redis.client.sismember(k, deviceId), this.redis.client.scard(k)]);
      await this.redis.client.sadd(k, deviceId);
      await this.redis.client.expire(k, DEVICE_TTL);
      if (alert && !known && count > 0) void this.sendNewSignInAlert(user, ctx, method).catch((e: Error) => this.logger.warn(`Sign-in alert failed: ${e.message}`));
    } catch (e) {
      this.logger.warn(`Could not record sign-in device: ${(e as Error).message}`);
    }
    return deviceId;
  }

  // ───────────────────────── Emails ─────────────────────────

  private locked(seconds: number) {
    const mins = Math.ceil(seconds / 60);
    const wait = mins >= 60 ? `${Math.ceil(mins / 60)} hour${mins > 60 ? 's' : ''}` : `${mins} minute${mins === 1 ? '' : 's'}`;
    return new HttpException(
      { code: 'ACCOUNT_LOCKED', message: `Too many failed attempts. For your security, sign-in is paused for ${wait}. You can reset your password to get back in now.` },
      HttpStatus.LOCKED,
    );
  }

  private details(ctx: LoginContext) {
    const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
    return [
      ['When', when],
      ['Device', describeDevice(ctx.userAgent)],
      ['IP address', ctx.ip || 'Unknown'],
    ] as const;
  }

  private detailsHtml(ctx: LoginContext) {
    const rows = this.details(ctx)
      .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#64748b;white-space:nowrap">${k}</td><td style="padding:4px 0;color:#0f172a;font-weight:600">${escapeHtml(v)}</td></tr>`)
      .join('');
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;background:#f8fafc;border-radius:10px;padding:12px 16px;width:100%">${rows}</table>`;
  }

  private detailsText(ctx: LoginContext) {
    return this.details(ctx)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  }

  private async sendLockedAlert(account: { email: string; name: string | null }, seconds: number, ctx: LoginContext) {
    const first = (account.name || '').split(/\s+/)[0] || 'there';
    const mins = Math.round(seconds / 60);
    const pause = mins >= 60 ? `${mins / 60} hour${mins > 60 ? 's' : ''}` : `${mins} minutes`;
    await this.mail.send({
      to: account.email,
      subject: 'Sign-in to your tuli account was paused',
      text: `Hi ${first},\n\nSomeone entered the wrong password for your tuli account ${MAX_FAILED_LOGINS} times, so we've paused sign-in for ${pause}.\n\n${this.detailsText(ctx)}\n\nIf this was you, you can wait, or reset your password to get back in now: ${this.appUrl()}/forgot-password/?email=${encodeURIComponent(account.email)}\n\nIf it wasn't you, your password is still safe — but resetting it to something new is a good idea. Questions? info@nubiannetworks.com`,
      html: emailLayout({
        heading: 'Sign-in was paused',
        paragraphs: [
          `Hi ${escapeHtml(first)},`,
          `Someone entered the wrong password for your tuli account ${MAX_FAILED_LOGINS} times, so we’ve paused sign-in for <strong>${pause}</strong> to keep it safe.`,
          this.detailsHtml(ctx),
          'If this was you, you can wait, or reset your password to get back in straight away.',
          `<strong>Wasn’t you?</strong> Nobody got in, and your password is still safe — but choosing a new one is a good idea. Questions? <a href="mailto:info@nubiannetworks.com" style="color:#2451d6">info@nubiannetworks.com</a>`,
        ],
        button: { label: 'Reset my password', url: `${this.appUrl()}/forgot-password/?email=${encodeURIComponent(account.email)}` },
      }),
    });
  }

  private async sendNewSignInAlert(user: { email: string; name: string | null }, ctx: LoginContext, method: string) {
    const first = (user.name || '').split(/\s+/)[0] || 'there';
    const via = method === 'password' ? 'with your password' : `with ${method}`;
    await this.mail.send({
      to: user.email,
      subject: 'New sign-in to your tuli account',
      text: `Hi ${first},\n\nYour tuli account was just signed in to ${via} from a new device.\n\n${this.detailsText(ctx)}\n\nIf this was you, there's nothing to do.\n\nIf it wasn't you, reset your password now (${this.appUrl()}/forgot-password/) and then use "Sign out other devices" in Settings (${this.appUrl()}/settings/).`,
      html: emailLayout({
        heading: 'New sign-in to your account',
        paragraphs: [
          `Hi ${escapeHtml(first)},`,
          `Your tuli account was just signed in to ${via} from a device we haven’t seen before.`,
          this.detailsHtml(ctx),
          'If this was you, there’s nothing to do.',
          `<strong>Wasn’t you?</strong> Reset your password now, then open <a href="${this.appUrl()}/settings/" style="color:#2451d6">Settings</a> and choose “Sign out other devices”.`,
        ],
        button: { label: 'Reset my password', url: `${this.appUrl()}/forgot-password/?email=${encodeURIComponent(user.email)}` },
      }),
    });
  }
}

/** "Chrome on Windows" from a user-agent string (good enough for an alert email). */
export function describeDevice(ua?: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'A browser';
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'Mac'
            : /CrOS/.test(ua)
              ? 'ChromeOS'
              : /Linux/.test(ua)
                ? 'Linux'
                : 'an unknown system';
  return `${browser} on ${os}`;
}
