'use client';

import { useRouter } from 'next/navigation';
import { createContext, ReactNode, useContext, useEffect } from 'react';
import { setBaseCurrency } from './format';
import { useMe } from './queries';
import type { Me } from './types';

type BusinessMe = Me & { organization: NonNullable<Me['organization']> };

const AuthContext = createContext<Me | null>(null);

/**
 * Gate for signed-in areas. scope 'business' needs a business account (platform admins go to /platform),
 * 'platform' needs a platform admin. Signed-out visitors go to the login page.
 */
export function AuthProvider({ children, fallback, scope = 'business' }: { children: ReactNode; fallback: ReactNode; scope?: 'business' | 'platform' }) {
  const { data: user, isLoading } = useMe();
  const router = useRouter();
  const misplaced = !!user && (scope === 'business' ? !user.organization : user.role !== 'SYSTEM_ADMIN');

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login/?next=${next}`);
    } else if (misplaced) {
      router.replace(scope === 'business' ? '/platform/' : '/dashboard/');
    }
  }, [isLoading, user, misplaced, router, scope]);

  if (isLoading || !user || misplaced) return <>{fallback}</>;
  if (user.organization) setBaseCurrency(user.organization.currency);
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth(): BusinessMe {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx as BusinessMe;
}

export function usePlatformUser(): Me {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('usePlatformUser must be used inside AuthProvider');
  return ctx;
}

export const isAdmin = (u: Me) => u.role === 'ADMIN';
