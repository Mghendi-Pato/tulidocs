import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { AuthUser } from '../types';

export const IS_PUBLIC_KEY = 'isPublic';
/** No sign-in needed. If a valid session is present, req.user is still filled in (else null). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restrict a business route to these roles (e.g. ADMIN for billing and settings). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const PLATFORM_KEY = 'platformOnly';
/** Platform super users only (SYSTEM_ADMIN). */
export const PlatformOnly = () => SetMetadata(PLATFORM_KEY, true);

export const ANY_ACCOUNT_KEY = 'anyAccount';
/** Any signed-in account, with or without a business (me, profile, password). */
export const AnyAccount = () => SetMetadata(ANY_ACCOUNT_KEY, true);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return request.user;
});

/** The signed-in user on a @Public() route, or null. */
export const OptionalUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | null => {
  const request = ctx.switchToHttp().getRequest<{ user?: AuthUser | null }>();
  return request.user ?? null;
});

/** The guest token cookie (anonymous invoice builder). */
export const GUEST_COOKIE = 'nv_guest';
export const GuestToken = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | null => {
  const request = ctx.switchToHttp().getRequest<{ cookies?: Record<string, string> }>();
  const t = request.cookies?.[GUEST_COOKIE];
  return t && /^[A-Za-z0-9_-]{32,64}$/.test(t) ? t : null;
});
