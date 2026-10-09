import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AUTH_COOKIE } from './jwt.strategy';

export function parseDurationMs(value: string): number {
  const m = /^(\d+)([smhd])$/.exec(value.trim());
  if (!m) return 30 * 24 * 3600 * 1000;
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return Number(m[1]) * unit;
}

/** httpOnly session cookie. `remember: false` → browser-session cookie (the JWT still expires per JWT_EXPIRES_IN). */
export function setAuthCookie(res: Response, config: ConfigService, token: string, remember = true) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.get('COOKIE_SECURE') === 'true',
    path: '/',
    ...(remember ? { maxAge: parseDurationMs(config.get('JWT_EXPIRES_IN', '30d')) } : {}),
  });
}
