import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { ANY_ACCOUNT_KEY, IS_PUBLIC_KEY, PLATFORM_KEY, ROLES_KEY } from '../decorators';
import { AuthUser } from '../types';

/**
 * Keeps the two worlds apart:
 *  - business routes (default) need a user that belongs to a business
 *  - @PlatformOnly routes need a SYSTEM_ADMIN
 *  - @Roles('ADMIN') narrows business routes further
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = <T>(key: string) => this.reflector.getAllAndOverride<T>(key, [context.getHandler(), context.getClass()]);
    if (meta<boolean>(IS_PUBLIC_KEY)) return true;
    const user = context.switchToHttp().getRequest<{ user: AuthUser }>().user;

    if (meta<boolean>(PLATFORM_KEY)) {
      if (user.role !== 'SYSTEM_ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Platform administrators only' });
      return true;
    }
    if (meta<boolean>(ANY_ACCOUNT_KEY)) return true;

    if (!user.organizationId) {
      throw new ForbiddenException({ code: 'NO_BUSINESS', message: 'This page is for business accounts' });
    }
    const roles = meta<Role[]>(ROLES_KEY);
    if (roles?.length && !roles.includes(user.role)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the business administrator can do this' });
    }
    return true;
  }
}
