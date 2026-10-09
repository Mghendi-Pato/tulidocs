import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators';

/**
 * Every route needs a session unless marked @Public().
 * On public routes the session is still read when present (so a paying user's preview has no watermark).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  private isPublic(context: ExecutionContext) {
    return !!this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
  }

  async canActivate(context: ExecutionContext) {
    if (this.isPublic(context)) {
      try {
        await super.canActivate(context);
      } catch {
        context.switchToHttp().getRequest<{ user?: unknown }>().user = null;
      }
      return true;
    }
    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<TUser>(err: unknown, user: TUser, _info: unknown, context: ExecutionContext): TUser {
    if (this.isPublic(context)) return (user || null) as TUser;
    // Keep specific reasons (session ended, business suspended) from the JWT strategy
    if (err instanceof UnauthorizedException) throw err;
    if (err || !user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Please sign in to continue' });
    }
    return user;
  }
}
