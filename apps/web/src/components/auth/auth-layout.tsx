'use client';

import { ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';
import { HeroStack } from '../landing/hero-stack';
import { Logo } from '../layout/logo';

const POINTS = ['Invoices, quotes and receipts', 'Any currency, your tax wording', 'Clients and numbering saved for you', 'Paid / unpaid tracking'];

/** Two-panel sign-in / sign-up layout (showcase on desktop, form on the right). */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="relative hidden w-[52%] overflow-hidden bg-[radial-gradient(120%_90%_at_70%_70%,#fbd86a_0%,#f6c445_55%,#efb431_100%)] lg:block">
        <div className="relative flex h-full flex-col px-[8%] py-10">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <div className="mt-[7vh] max-w-[520px]">
            <h1 className="font-display text-[44px] leading-[1.08] font-bold tracking-[-0.02em] xl:text-[52px]">
              Get paid faster.
              <br />
              Look the part.
            </h1>
            <ul className="mt-7 space-y-3">
              {POINTS.map((p) => (
                <li key={p} className="flex items-center gap-3 text-[16px] font-medium text-ink/80">
                  <span className="flex size-6 items-center justify-center rounded-full bg-white/80 text-ink shadow-sm">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto flex justify-center pt-6">
            <div className="w-[min(100%,460px,56dvh)] 2xl:w-[min(520px,56dvh)]">
              <HeroStack />
            </div>
          </div>
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col">
        {/* Back to home */}
        <div className="flex justify-end px-6 pt-6 sm:px-10">
          <Link
            href="/"
            className="group inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white pr-4 pl-3 text-[14px] font-semibold text-ink-soft transition-colors hover:border-line-strong hover:bg-sidebar hover:text-ink focus-visible:ring-4 focus-visible:ring-primary/15"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            Back to home
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[420px]">
            <Link href="/" className="mb-10 inline-block lg:hidden" aria-label="Home">
              <Logo />
            </Link>
            <h2 className="text-[32px] leading-tight font-bold tracking-[-0.02em]">{title}</h2>
            <p className="mt-2 mb-8 text-[16px] text-muted">{subtitle}</p>
            {children}
          </div>
        </div>
        {footer && <div className="px-6 pb-8 text-center text-[14px] text-muted">{footer}</div>}
      </main>
    </div>
  );
}

/** "Continue with Google" — the API runs the OAuth redirect, so this is a plain link. */
export function GoogleButton({ next, country, label = 'Continue with Google' }: { next?: string | null; country?: string | null; label?: string }) {
  const q = new URLSearchParams();
  if (next) q.set('next', next);
  if (country && country !== 'XX') q.set('country', country);
  const href = `/api/auth/google${q.toString() ? `?${q}` : ''}`;
  return (
    <a
      href={href}
      className="flex h-[52px] w-full items-center justify-center gap-3 rounded-lg border border-[#d7dce5] bg-white text-[15px] font-semibold text-ink transition-colors hover:border-line-strong hover:bg-sidebar focus-visible:ring-4 focus-visible:ring-primary/15"
    >
      <svg className="size-5" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {label}
    </a>
  );
}

/** "Continue with Apple" — Apple's black button style; the API runs the redirect */
export function AppleButton({ next, country, label = 'Continue with Apple' }: { next?: string | null; country?: string | null; label?: string }) {
  const q = new URLSearchParams();
  if (next) q.set('next', next);
  if (country && country !== 'XX') q.set('country', country);
  const href = `/api/auth/apple${q.toString() ? `?${q}` : ''}`;
  return (
    <a
      href={href}
      className="flex h-[52px] w-full items-center justify-center gap-3 rounded-lg bg-black text-[15px] font-semibold text-white transition-colors hover:bg-[#222] focus-visible:ring-4 focus-visible:ring-primary/15"
    >
      <svg className="size-[18px]" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
      </svg>
      {label}
    </a>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-4 text-[13px] font-semibold text-subtle">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export const GOOGLE_ERRORS: Record<string, string> = {
  google: 'Google sign-in didn’t work. Please try again.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_disabled: 'Google sign-in isn’t set up yet. Use your email and password.',
  apple: 'Apple sign-in didn’t work. Please try again.',
  apple_cancelled: 'Apple sign-in was cancelled.',
  apple_disabled: 'Apple sign-in isn’t set up yet. Use Google or your email and password.',
  oauth_state: 'That sign-in link expired. Please try again.',
  oauth_failed: 'We couldn’t verify your Google account.',
  tenant_suspended: 'This business account is suspended. Please contact tuli support.',
  inactive: 'This account is deactivated.',
  signup_closed: 'New sign-ups are closed right now.',
};
