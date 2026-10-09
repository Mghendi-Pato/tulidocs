'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FileText, Plus, Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input, Select } from '@/components/ui/field';
import { EmptyState, ErrorState, PageHeader, Pagination, Segmented, StatusPill } from '@/components/ui/misc';
import { DataTable } from '@/components/ui/table';
import { api, errorMessage } from '@/lib/api';
import { TYPE_LABEL, TYPE_PLURAL } from '@/lib/constants';
import { formatDate, formatMoney, today } from '@/lib/format';
import { RANGE_OPTIONS, RangeKey, rangeDates } from '@/lib/date-ranges';
import { keys } from '@/lib/queries';
import type { DocRow, DocType, Paged } from '@/lib/types';

const STATUS_OPTIONS: Record<DocType, { value: string; label: string }[]> = {
  INVOICE: [
    { value: '', label: 'All invoices' },
    { value: 'UNPAID', label: 'Unpaid' },
    { value: 'OVERDUE', label: 'Overdue' },
    { value: 'PARTIALLY_PAID', label: 'Part paid' },
    { value: 'PAID', label: 'Paid' },
    { value: 'DRAFT', label: 'Drafts' },
    { value: 'VOID', label: 'Void' },
  ],
  QUOTE: [
    { value: '', label: 'All quotes' },
    { value: 'DRAFT', label: 'Drafts' },
    { value: 'SENT', label: 'Sent' },
    { value: 'ACCEPTED', label: 'Accepted' },
    { value: 'DECLINED', label: 'Declined' },
  ],
  RECEIPT: [
    { value: '', label: 'All receipts' },
    { value: 'VOID', label: 'Void' },
  ],
};

function List() {
  const router = useRouter();
  const params = useSearchParams();
  const type = (['INVOICE', 'QUOTE', 'RECEIPT'].includes(params.get('type') ?? '') ? params.get('type') : 'INVOICE') as DocType;
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  // defaults to this month; "All time" etc. are kept in the URL
  const range = (RANGE_OPTIONS.some((o) => o.value === params.get('range')) ? params.get('range') : 'this_month') as RangeKey;
  const customFrom = params.get('from') ?? '';
  const customTo = params.get('to') ?? '';
  const dates = range === 'custom' ? { from: customFrom || undefined, to: customTo || undefined } : rangeDates(range);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const go = (patch: Record<string, string | number | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, String(v));
    }
    router.replace(`/documents/?${p.toString()}`);
  };

  const q = { type, status, page, search: debounced, ...dates };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: keys.docs(q),
    queryFn: () => api.page<Paged<DocRow>>('/documents', { ...q, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  const t = today();
  const isOverdue = (r: DocRow) => r.type === 'INVOICE' && ['SENT', 'PARTIALLY_PAID'].includes(r.status) && !!r.dueDate && r.dueDate < t;

  return (
    <>
      <PageHeader
        title={TYPE_PLURAL[type]}
        actions={
          <ButtonLink href={`/documents/new/?type=${type}`} icon={<Plus className="size-4" strokeWidth={2.5} />}>
            New {TYPE_LABEL[type].toLowerCase()}
          </ButtonLink>
        }
      />
      {/* Date range + search / status on one row */}
      <div className="mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        {/* full pill row on wide screens, a dropdown on smaller ones — never a scrollbar */}
        <Segmented<RangeKey>
          value={range}
          onChange={(v) => go({ range: v === 'this_month' ? null : v, from: null, to: null, page: null })}
          options={RANGE_OPTIONS}
          compact
          className="hidden self-start xl:inline-flex 2xl:self-auto"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="sm:w-48 xl:hidden">
            <Select value={range} onChange={(e) => go({ range: e.target.value === 'this_month' ? null : e.target.value, from: null, to: null, page: null })} aria-label="Date range" className="h-11">
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); if (page !== 1) go({ page: null }); }} placeholder="Search number or client" className="h-11 pl-11" aria-label="Search" />
          </div>
          <div className="sm:w-48">
            <Select value={status} onChange={(e) => go({ status: e.target.value, page: null })} aria-label="Status" className="h-11">
              {STATUS_OPTIONS[type].map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>
      {range === 'custom' && (
          <div className="-mt-2 mb-5 flex items-center gap-2">
            <div className="w-52">
              <DateInput value={customFrom} max={customTo || undefined} onChange={(e) => go({ from: e.target.value, page: null })} aria-label="From" />
            </div>
            <span className="text-sm text-muted">to</span>
            <div className="w-52">
              <DateInput value={customTo} min={customFrom || undefined} onChange={(e) => go({ to: e.target.value, page: null })} aria-label="To" />
            </div>
          </div>
        )}

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable<DocRow>
            rows={data?.data}
            loading={isLoading || isFetching}
            rowKey={(r) => r.id}
            href={(r) => `/documents/view/?id=${r.id}`}
            columns={[
              { key: 'number', header: 'Number', cell: (r) => <span className="font-bold">{r.number}</span> },
              { key: 'client', header: type === 'RECEIPT' ? 'Received from' : 'Client', cell: (r) => <span className="font-semibold">{r.clientName}</span> },
              { key: 'date', header: 'Date', cell: (r) => formatDate(r.issueDate), hideBelow: 'lg' },
              ...(type !== 'RECEIPT' ? [{ key: 'due', header: type === 'QUOTE' ? 'Valid until' : 'Due', cell: (r: DocRow) => formatDate(r.dueDate), hideBelow: 'xl' as const }] : []),
              { key: 'status', header: 'Status', cell: (r) => <StatusPill status={r.status} overdue={isOverdue(r)} /> },
              { key: 'total', header: 'Total', align: 'right', cell: (r) => <span className="font-bold tabular">{formatMoney(r.total, r.currency)}</span> },
              ...(type === 'INVOICE'
                ? [{ key: 'balance', header: 'Balance', align: 'right' as const, cell: (r: DocRow) => <span className="tabular text-muted">{Number(r.balance) > 0 && r.status !== 'VOID' ? formatMoney(r.balance, r.currency) : '—'}</span>, hideBelow: 'lg' as const }]
                : []),
            ]}
            mobile={(r) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-bold">{r.clientName}</div>
                  <div className="text-[13px] text-muted">
                    {r.number} · {formatDate(r.issueDate)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-bold tabular">{formatMoney(r.total, r.currency)}</div>
                  <StatusPill status={r.status} overdue={isOverdue(r)} />
                </div>
              </div>
            )}
            empty={
              <div className="card">
                <EmptyState
                  icon={<FileText className="size-6" />}
                  title={debounced || status || dates.from || dates.to ? 'Nothing matches' : `No ${TYPE_PLURAL[type].toLowerCase()} yet`}
                  body={debounced || status || dates.from || dates.to ? 'Try a different search, filter or date range.' : type === 'RECEIPT' ? 'Receipts are created when you record a payment on an invoice — or make one directly.' : undefined}
                  action={!debounced && !status && !dates.from && !dates.to ? <ButtonLink href={`/documents/new/?type=${type}`}>New {TYPE_LABEL[type].toLowerCase()}</ButtonLink> : undefined}
                />
              </div>
            }
          />
          {data?.meta && <Pagination page={data.meta.page} pageCount={data.meta.pageCount} onPage={(p) => go({ page: p })} />}
        </>
      )}
    </>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense>
      <List />
    </Suspense>
  );
}
