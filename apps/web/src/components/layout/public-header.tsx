'use client';

import { House } from 'lucide-react';
import Link from 'next/link';
import { useMe } from '@/lib/queries';
import { FeedbackTab } from '../feedback/feedback-tab';
import { ButtonLink } from '../ui/button';
import { Logo } from './logo';

/** Top bar for public pages (landing, builder, sign-in) */
export function PublicHeader({ minimal }: { minimal?: boolean }) {
  const { data: me } = useMe();
  const home = me ? (me.organization ? '/dashboard/' : '/platform/') : null;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="tuli home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {minimal && (
              <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-bold text-ink-soft hover:bg-hover sm:px-4">
                <House className="size-4" />
                Home
              </Link>
            )}
            {!minimal && (
              <>
                <Link href="/#templates" className="hidden h-10 items-center rounded-full px-4 text-sm font-bold text-ink-soft hover:bg-hover md:inline-flex">
                  Templates
                </Link>
                <Link href="/#pricing" className="hidden h-10 items-center rounded-full px-4 text-sm font-bold text-ink-soft hover:bg-hover md:inline-flex">
                  Pricing
                </Link>
              </>
            )}
            {home ? (
              <ButtonLink href={home} size="sm">
                Dashboard
              </ButtonLink>
            ) : (
              <>
                <Link href="/login/" className="inline-flex h-10 items-center rounded-full px-4 text-sm font-bold text-ink hover:bg-hover">
                  Sign in
                </Link>
                {!minimal && (
                  <ButtonLink href="/create/" size="sm" className="hidden sm:inline-flex">
                    Create invoice
                  </ButtonLink>
                )}
              </>
            )}
          </nav>
        </div>
      </header>
      {/* outside the header: its backdrop-blur would pin a fixed child to the header */}
      <FeedbackTab />
    </>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo className="text-[16px]" />
        <div className="flex items-center gap-5">
          <Link href="/feedback/" className="font-semibold hover:text-ink">
            Feedback &amp; ideas
          </Link>
          <span>© {new Date().getFullYear()} Nubian Networks Limited</span>
        </div>
      </div>
    </footer>
  );
}
