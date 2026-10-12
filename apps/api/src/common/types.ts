import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  /** organizationId the token was issued for (null for platform admins) */
  org: string | null;
  /** issued-at (seconds), added by jsonwebtoken */
  iat?: number;
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
