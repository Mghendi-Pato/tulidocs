'use client';

import { useQuery } from '@tanstack/react-query';
import { FileCheck2, FileText, Plus, Receipt, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Suspense } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader, Stat, StatusPill } from '@/components/ui/misc';
import { PageLoader } from '@/components/ui/spinner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TYPE_LABEL } from '@/lib/constants';
import { formatDate, formatMoney, today } from '@/lib/format';
import { keys } from '@/lib/queries';
import type { DocStatus, DocType } from '@/lib/types';

interface Summary {
  currency: string;
  outstanding: { amount: string; count: number };
  overdue: { amount: string; count: number };
  paidThisMonth: string;
  openQuotes: number;
  usage: { used: number; limit: number | null };
  recent: { id: string; type: DocType; status: DocStatus; number: string; clientName: string; total: string; currency: string; issueDate: string; dueDate: string | null }[];
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Dashboard() {
  const user = useAuth();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: keys.summary, queryFn: () => api.get<Summary>('/documents/summary') });
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  const c = data.currency;
  const t = today();

  return (
    <>
      <PageHeader
        eyebrow={user.organization.name}
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        actions={
          <>
            <ButtonLink href="/documents/new/?type=QUOTE" variant="secondary" icon={<FileCheck2 className="size-4" />}>
              New quote
            </ButtonLink>
            <ButtonLink href="/documents/new/?type=INVOICE" icon={<Plus className="size-4" strokeWidth={2.5} />}>
              New invoice
            </ButtonLink>
          </>
        }
      />

      {user.organization.plan === 'FREE' && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-primary-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 text-[14.5px]">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <span className="font-bold">You’re on the Free plan</span> — documents carry a watermark and you can make {data.usage.limit} a month ({data.usage.used} used). Starter removes both limits.
            </span>
          </div>
          <ButtonLink href="/billing/" size="sm">
            Upgrade
          </ButtonLink>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Owed to you" value={formatMoney(data.outstanding.amount, c)} hint={`${data.outstanding.count} open invoice${data.outstanding.count === 1 ? '' : 's'}`} href="/documents/?type=INVOICE&status=UNPAID&range=custom" />
        <Stat label="Overdue" value={formatMoney(data.overdue.amount, c)} hint={`${data.overdue.count} invoice${data.overdue.count === 1 ? '' : 's'}`} href="/documents/?type=INVOICE&status=OVERDUE&range=custom" />
        <Stat label="Paid this month" value={formatMoney(data.paidThisMonth, c)} hint="From receipts" href="/documents/?type=RECEIPT" />
        <Stat label="Open quotes" value={data.openQuotes} hint="Draft or sent" href="/documents/?type=QUOTE&range=custom" />
      </div>

      <Card className="mt-6" title="Recent activity" padded={false} action={<Link href="/documents/?type=INVOICE" className="link text-sm">See all</Link>}>
        {data.recent.length ? (
          <ul className="divide-y divide-line">
            {data.recent.map((d) => {
              const overdue = d.type === 'INVOICE' && ['SENT', 'PARTIALLY_PAID'].includes(d.status) && !!d.dueDate && d.dueDate < t;
              const Icon = d.type === 'QUOTE' ? FileCheck2 : d.type === 'RECEIPT' ? Receipt : FileText;
              return (
                <li key={d.id}>
                  <Link href={`/documents/view/?id=${d.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-sidebar sm:px-6">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-panel text-ink-soft">
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{d.clientName}</span>
                      <span className="block text-[13px] text-muted">
                        {TYPE_LABEL[d.type]} {d.number} · {formatDate(d.issueDate)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[15px] font-bold tabular">{formatMoney(d.total, d.currency)}</span>
                      <StatusPill status={d.status} overdue={overdue} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<FileText className="size-6" />}
            title="No documents yet"
            body="Create your first invoice — it takes about two minutes."
            action={<ButtonLink href="/documents/new/?type=INVOICE">Create invoice</ButtonLink>}
          />
        )}
      </Card>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
