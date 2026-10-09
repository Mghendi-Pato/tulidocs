'use client';

import { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Logo } from '@/components/layout/logo';
import { Spinner } from '@/components/ui/spinner';
import { AuthProvider } from '@/lib/auth';

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6">
      <Logo />
      <Spinner className="text-subtle" />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider fallback={<Splash />}>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
