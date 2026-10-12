import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, JwtPayload } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';

export const AUTH_COOKIE = 'nv_token';

const fromCookie = (req: Request): string | null => {
  const cookies = req?.cookies as Record<string, string> | undefined;
  return cookies?.[AUTH_COOKIE] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
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
      select: { id: true, organizationId: true, email: true, name: true, role: true, isActive: true, passwordChangedAt: true, organization: { select: { status: true } } },
    });
    if (!user || !user.isActive || (user.organizationId ?? null) !== (payload.org ?? null)) throw ended();
    // password reset/changed after this session was issued → sign this device out
    if (user.passwordChangedAt && payload.iat !== undefined && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) throw ended();
    if (user.role !== 'SYSTEM_ADMIN' && user.organization?.status === 'SUSPENDED') {
      throw new UnauthorizedException({ code: 'TENANT_SUSPENDED', message: 'This business account is suspended. Please contact tuli support.' });
    }
    return { id: user.id, organizationId: user.organizationId ?? '', email: user.email, name: user.name, role: user.role };
  }
}
