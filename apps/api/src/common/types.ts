import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  /** organizationId the token was issued for (null for platform admins) */
  org: string | null;
  /** issued-at (seconds), added by jsonwebtoken */
  iat?: number;
  /** expiry (seconds), added by jsonwebtoken */
  exp?: number;
  /** issued-at in milliseconds — precise enough that "sign out everywhere" can't miss a session started the same second */
  t?: number;
  /** unique session id — lets one session be revoked on its own (logout) */
  jti?: string;
}

export interface AuthUser {
  id: string;
  /** '' for platform admins */
  organizationId: string;
  email: string;
  name: string;
  role: Role;
}

export type RequestWithUser = { user?: AuthUser | null; cookies?: Record<string, string> };
