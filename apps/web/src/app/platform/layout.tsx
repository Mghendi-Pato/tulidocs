'use client';

import { Lightbulb, LogOut } from 'lucide-react';
import { ReactNode } from 'react';
import { useLogout } from '@/components/layout/app-shell';
import { Logo } from '@/components/layout/logo';
import { Button, ButtonLink } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AuthProvider } from '@/lib/auth';

function Bar() {
  const logout = useLogout();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Logo />
        <div className="flex items-center gap-1">
          <ButtonLink href="/feedback/" variant="ghost" size="sm" icon={<Lightbulb className="size-4" />}>
            <span className="max-sm:sr-only">Feedback board</span>
          </ButtonLink>
          <Button variant="ghost" size="sm" icon={<LogOut className="size-4" />} onClick={() => void logout()}>
            <span className="max-sm:sr-only">Log out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider scope="platform" fallback={<div className="flex min-h-dvh items-center justify-center"><Spinner /></div>}>
      <Bar />
      <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10">{children}</main>
    </AuthProvider>
  );
}
