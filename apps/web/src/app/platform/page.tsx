'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input, Select } from '@/components/ui/field';
import { Card, PageHeader, Pagination, Stat } from '@/components/ui/misc';
import { DataTable } from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import type { Paged, Plan } from '@/lib/types';

interface Overview {
  businesses: number;
  payingBusinesses: number;
  revenueThisMonth: { currency: string; amount: string }[];
  revenueAllTime: { currency: string; amount: string }[];
  documentsThisMonth: number;
  guestDocuments: number;
  unlocksThisMonth: number;
}

interface Business {
  id: string;
  name: string;
  email: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  plan: Plan;
  planExpiresAt: string | null;
  active: boolean;
  createdAt: string;
  documents: number;
  users: number;
  owner: { name: string; email: string; lastLoginAt: string | null } | null;
}

interface Payment {
  id: string;
  purpose: string;
  provider: string;
  status: string;
  amount: string;
  currency: string;
  country: string | null;
  phone: string | null;
  receipt: string | null;
  createdAt: string;
  organization: { name: string } | null;
  document: { number: string } | null;
}

/** "$120 · KES 3,400" — totals stay in their own currencies */
const money = (rows: { currency: string; amount: string }[]) => (rows.length ? rows.map((r) => formatMoney(r.amount, r.currency)).join(' · ') : formatMoney('0', 'USD'));

export default function PlatformPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const overview = useQuery({ queryKey: ['platform-overview'], queryFn: () => api.get<Overview>('/platform/overview') });
  const list = useQuery({
    queryKey: ['platform-businesses', search, page],
    queryFn: () => api.page<Paged<Business>>('/platform/businesses', { search, page }),
    placeholderData: keepPreviousData,
  });
  const payments = useQuery({ queryKey: ['platform-payments'], queryFn: () => api.page<Paged<Payment>>('/platform/payments', { pageSize: 15 }) });
  const o = overview.data;

  const update = async (id: string, body: Record<string, unknown>) => {
    try {
      await api.patch(`/platform/businesses/${id}`, body);
      void qc.invalidateQueries({ queryKey: ['platform-businesses'] });
      void qc.invalidateQueries({ queryKey: ['platform-overview'] });
      toast.success('Updated');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader title="Platform" description="Every business on tuli." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Businesses" value={o?.businesses ?? '—'} hint={`${o?.payingBusinesses ?? 0} paying`} />
        <Stat label="Revenue this month" value={o ? money(o.revenueThisMonth) : '—'} hint={o ? `${money(o.revenueAllTime)} all time` : undefined} />
        <Stat label="Documents this month" value={o?.documentsThisMonth ?? '—'} hint={`${o?.guestDocuments ?? 0} guest drafts`} />
        <Stat label="Unlocks this month" value={o?.unlocksThisMonth ?? '—'} hint="Pay-per-document" />
      </div>

      <div className="mt-8 mb-4 flex items-center justify-between gap-3">
        <h2 className="section-title text-lg">Businesses</h2>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search" className="h-10 pl-11" aria-label="Search businesses" />
        </div>
      </div>
      <DataTable<Business>
        rows={list.data?.data}
        loading={list.isLoading}
        rowKey={(b) => b.id}
        columns={[
          { key: 'name', header: 'Business', cell: (b) => <span><span className="block font-bold">{b.name}</span><span className="block text-[12.5px] text-muted">{b.owner?.email ?? b.email}</span></span> },
          { key: 'docs', header: 'Documents', align: 'right', cell: (b) => <span className="tabular">{b.documents}</span>, hideBelow: 'lg' },
          { key: 'joined', header: 'Joined', cell: (b) => formatDate(b.createdAt.slice(0, 10)), hideBelow: 'xl' },
          {
            key: 'plan',
            header: 'Plan',
            cell: (b) => (
              <div className="w-36">
                <Select value={b.plan} onChange={(e) => void update(b.id, { plan: e.target.value })} className="h-10" aria-label="Plan">
                  <option value="FREE">Free</option>
                  <option value="STARTER">Starter</option>
                  <option value="PRO">Pro</option>
                </Select>
                <span className="mt-1 block text-[12px] text-muted">{b.plan !== 'FREE' ? (b.active ? `until ${formatDate(b.planExpiresAt?.slice(0, 10))}` : 'expired') : ''}</span>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            cell: (b) => (
              <div className="w-36">
                <Select value={b.status} onChange={(e) => void update(b.id, { status: e.target.value })} className="h-10" aria-label="Status">
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </Select>
              </div>
            ),
          },
        ]}
        mobile={(b) => (
          <div className="flex justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate font-bold">{b.name}</span>
              <span className="block text-[12.5px] text-muted">{b.plan} · {b.documents} docs</span>
            </span>
            <span className="text-[12.5px] font-semibold">{b.status === 'ACTIVE' ? 'Active' : 'Suspended'}</span>
          </div>
        )}
        empty={<Card><p className="text-sm text-muted">No businesses found.</p></Card>}
      />
      {list.data?.meta && <Pagination page={list.data.meta.page} pageCount={list.data.meta.pageCount} onPage={setPage} />}

      <Card className="mt-8" title="Recent payments" padded={false}>
        <ul className="divide-y divide-line">
          {(payments.data?.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm sm:px-6">
              <span className="min-w-0">
                <span className="block truncate font-bold">{p.organization?.name ?? 'Guest'} · {p.purpose === 'SUBSCRIPTION' ? 'Subscription' : `Unlock ${p.document?.number ?? ''}`}</span>
                <span className="block text-[12.5px] text-muted">{formatDateTime(p.createdAt)} · {p.provider}{p.country ? ` · ${p.country}` : ''}{p.receipt ? ` · ${p.receipt}` : ''}</span>
              </span>
              <span className="text-right">
                <span className="block font-bold whitespace-nowrap tabular">{formatMoney(p.amount, p.currency)}</span>
                <span className="text-[12.5px] text-muted">{p.status}</span>
              </span>
            </li>
          ))}
          {!payments.data?.data.length && <li className="px-6 py-5 text-sm text-muted">No payments yet.</li>}
        </ul>
      </Card>
    </>
  );
}
