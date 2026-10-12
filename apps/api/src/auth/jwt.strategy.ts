import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, JwtPayload } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export const AUTH_COOKIE = 'nv_token';

/** Redis key for a single session ended by logout. */
export const revokedSessionKey = (jti: string) => `session:revoked:${jti}`;

const ms = (d: Date | null) => d?.getTime() ?? 0;

const fromCookie = (req: Request): string | null => {
  const cookies = req?.cookies as Record<string, string> | undefined;
  return cookies?.[AUTH_COOKIE] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromCookie, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Re-checks the user (and their business) on every request so deactivation and suspension apply immediately. */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const ended = () => new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Your session has ended. Please sign in again.' });
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, organizationId: true, email: true, name: true, role: true, isActive: true, passwordChangedAt: true, sessionsRevokedAt: true, emailVerifiedAt: true, organization: { select: { status: true } } },
    });
    if (!user || !user.isActive || !user.emailVerifiedAt || (user.organizationId ?? null) !== (payload.org ?? null)) throw ended();
    // password changed/reset, or "log out everywhere", after this session was issued → sign this device out
    const cutoff = Math.max(ms(user.passwordChangedAt), ms(user.sessionsRevokedAt));
    const issued = payload.t ?? (payload.iat ?? 0) * 1000; // older tokens only have second-precision iat
    if (cutoff && issued < cutoff) throw ended();
    // this one session was logged out (a copied cookie stops working too). If Redis is briefly down we let it through
    // rather than lock everyone out — "log out everywhere" above is stored in the database and always applies.
    if (payload.jti && (await this.redis.client.exists(this.redis.key(revokedSessionKey(payload.jti))).catch(() => 0))) throw ended();
    if (user.role !== 'SYSTEM_ADMIN' && user.organization?.status === 'SUSPENDED') {
      throw new UnauthorizedException({ code: 'TENANT_SUSPENDED', message: 'This business account is suspended. Please contact tuli support.' });
    }
    return { id: user.id, organizationId: user.organizationId ?? '', email: user.email, name: user.name, role: user.role };
  }
}
