'use client';

import { ChevronDown, CreditCard, Lightbulb, ScrollText, ShieldCheck, FileCheck2, FileText, Home, LogOut, Menu as MenuIcon, Plus, Receipt, Settings, Sparkles, Users, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ReactNode, Suspense, useEffect, useState } from 'react';
import { api, markLoggingOut } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useDoc } from '@/lib/queries';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { initials } from '@/lib/format';
import { IconButton } from '../ui/button';
import { useConfirm } from '../ui/confirm';
import { Menu } from '../ui/menu';
import { FeedbackTab } from '../feedback/feedback-tab';
import { Logo } from './logo';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  /** documents list filtered by type */
  type?: string;
  admin?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard/', label: 'Home', icon: Home },
  { href: '/documents/?type=QUOTE', label: 'Quotes', icon: FileCheck2, type: 'QUOTE' },
  { href: '/documents/?type=INVOICE', label: 'Invoices', icon: FileText, type: 'INVOICE' },
  { href: '/documents/?type=RECEIPT', label: 'Receipts', icon: Receipt, type: 'RECEIPT' },
  { href: '/clients/', label: 'Clients', icon: Users },
  { href: '/billing/', label: 'Plan & billing', icon: CreditCard },
  { href: '/settings/', label: 'Settings', icon: Settings },
];

function useActive() {
  const pathname = usePathname();
  const params = useSearchParams();
  // viewing / editing a document: highlight its section (type comes from the loaded document)
  const docId = pathname.startsWith('/documents/') && pathname !== '/documents/' ? params.get('id') : null;
  const { data: doc } = useDoc(docId);
  const docType = pathname.startsWith('/documents') ? (doc?.type ?? params.get('type') ?? (pathname === '/documents/' ? 'INVOICE' : null)) : null;
  return (item: NavItem) => {
    const path = item.href.split('?')[0];
    if (item.type) return docType === item.type;
    return pathname === path || (path !== '/dashboard/' && pathname.startsWith(path));
  };
}

function NewButton({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const go = (type: string) => {
    router.push(`/documents/new/?type=${type}`);
    onNavigate?.();
  };
  return (
    <Menu
      align="left"
      trigger={(p) => (
        <button {...p} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary-hover">
          <Plus className="size-[18px]" strokeWidth={2.5} />
          New
          <ChevronDown className="size-4 opacity-70" />
        </button>
      )}
      items={[
        { label: 'Quote', icon: <FileCheck2 />, onSelect: () => go('QUOTE') },
        { label: 'Invoice', icon: <FileText />, onSelect: () => go('INVOICE') },
        { label: 'Receipt', icon: <Receipt />, onSelect: () => go('RECEIPT') },
      ]}
    />
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const isActive = useActive();
  return (
    <nav aria-label="Main" className="space-y-1">
      {NAV.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[15px] font-semibold transition-colors',
              active ? 'bg-selected text-primary' : 'text-ink-soft hover:bg-hover hover:text-ink',
            )}
          >
            <Icon className="size-[20px]" strokeWidth={active ? 2.2 : 1.8} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Plan status at the bottom of the sidebar */
function PlanCard() {
  const { organization: org } = useAuth();
  if (org.plan !== 'FREE') {
    return (
      <Link href="/billing/" className="block rounded-2xl bg-canvas px-4 py-3 text-[13px] hover:bg-hover">
        <span className="font-bold text-ink">{org.plan === 'PRO' ? 'Pro' : 'Starter'} plan</span>
        <span className="block text-muted">{org.planExpiresAt ? `Active until ${formatDate(org.planExpiresAt)}` : 'No watermark · unlimited'}</span>
      </Link>
    );
  }
  const { used, limit } = org.usage;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <Link href="/billing/" className="block rounded-2xl bg-canvas px-4 py-3.5 text-[13px] hover:bg-hover">
      <span className="flex items-center justify-between font-bold text-ink">
        Free plan
        <span className="inline-flex items-center gap-1 text-primary">
          <Sparkles className="size-3.5" /> Upgrade
        </span>
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-line">
        <span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-danger' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </span>
      <span className="mt-1.5 block text-muted">
        {used} of {limit} documents this month
      </span>
    </Link>
  );
}

export async function logout() {
  markLoggingOut();
  await api.post('/auth/logout').catch(() => undefined);
  window.location.href = '/login/?signedOut=1';
}

export function useLogout() {
  const confirm = useConfirm();
  return () => confirm({ title: 'Log out?', body: 'You’ll need to sign in again to continue.', confirmLabel: 'Log out', cancelLabel: 'Go back', tone: 'logout', action: logout });
}

function ProfileMenu() {
  const user = useAuth();
  const router = useRouter();
  const askLogout = useLogout();
  return (
    <Menu
      trigger={(p) => (
        <button {...p} aria-label="Account" className="flex items-center gap-3 rounded-full p-0.5 transition-colors sm:py-1 sm:pr-3 sm:pl-1 sm:hover:bg-hover">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-10 rounded-full object-cover" />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">{initials(user.name)}</span>
          )}
          <span className="hidden max-w-[200px] min-w-0 text-left sm:block">
            <span className="block truncate text-sm font-bold text-ink">{user.name}</span>
            <span className="block truncate text-xs text-muted">{user.organization.name}</span>
          </span>
          <ChevronDown className="hidden size-4 shrink-0 text-muted sm:block" />
        </button>
      )}
      items={[
        { label: 'Settings', icon: <Settings />, onSelect: () => router.push('/settings/') },
        { label: 'Plan & billing', icon: <CreditCard />, onSelect: () => router.push('/billing/') },
        { label: 'Feedback & ideas', icon: <Lightbulb />, onSelect: () => router.push('/#feedback') },
        { label: 'Terms of service', icon: <ScrollText />, onSelect: () => router.push('/terms/') },
        { label: 'Privacy policy', icon: <ShieldCheck />, onSelect: () => router.push('/privacy/') },
        { label: 'Log out', icon: <LogOut />, onSelect: () => void askLogout() },
      ]}
    />
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const askLogout = useLogout();
  return (
    <>
      <div className="mt-8 px-3">
        <NewButton onNavigate={onNavigate} />
      </div>
      <div className="mt-8 flex-1 overflow-y-auto">
        <NavList onNavigate={onNavigate} />
      </div>
      <div className="space-y-3 pt-4">
        <PlanCard />
        <button
          type="button"
          onClick={() => void askLogout()}
          className="flex h-11 w-full items-center gap-3.5 rounded-xl px-3.5 text-[15px] font-semibold text-ink-soft transition-colors hover:bg-hover hover:text-danger"
        >
          <LogOut className="size-[20px]" strokeWidth={1.8} />
          Log out
        </button>
      </div>
    </>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className="min-h-dvh lg:pl-[264px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col bg-sidebar px-4 py-7 lg:flex">
        <Link href="/dashboard/" className="px-3" aria-label="Home">
          <Logo />
        </Link>
        <Sidebar />
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-[320px] flex-col bg-sidebar px-4 py-5">
            <div className="flex items-center justify-between px-3">
              <Logo />
              <IconButton label="Close menu" onClick={() => setNavOpen(false)}>
                <X className="size-5" />
              </IconButton>
            </div>
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-6 lg:h-[72px] lg:border-0 lg:px-10">
        <div className="flex items-center gap-2 lg:hidden">
          <IconButton label="Open menu" onClick={() => setNavOpen(true)}>
            <MenuIcon className="size-5" />
          </IconButton>
          <Logo compact />
        </div>
        <div className="hidden lg:block" />
        <ProfileMenu />
      </header>
      <main className="mx-auto max-w-[1280px] px-4 pt-4 pb-16 sm:px-6 lg:px-10 lg:pt-2">
        {children}
      </main>
      <FeedbackTab />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
