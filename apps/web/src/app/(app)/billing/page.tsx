'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PayDialog } from '@/components/pay/pay-dialog';
import { Button } from '@/components/ui/button';
import { Card, ErrorState, PageHeader, Segmented } from '@/components/ui/misc';
import { PageLoader } from '@/components/ui/spinner';
import { api, errorMessage } from '@/lib/api';
import { isAdmin, useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatMoney, priceLabel } from '@/lib/format';
import { keys, useBilling } from '@/lib/queries';
import type { Cycle, PlanInfo } from '@/lib/types';

export default function BillingPage() {
  const user = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useBilling();
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  // ?cycle=YEARLY carries the choice made on the pricing page
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('cycle') === 'YEARLY') setCycle('YEARLY');
  }, []);
  const [buying, setBuying] = useState<PlanInfo | null>(null);

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  const cur = data.current;
  const admin = isAdmin(user);

  return (
    <>
      <PageHeader title="Plan & billing" description={`Prices in ${data.currency}. Plans don’t renew automatically — you top up when you’re ready.`} />

      <Card className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[13px] font-semibold text-muted">Current plan</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight">{data.plans.find((p) => p.id === cur.plan)?.name ?? cur.plan}</div>
            <div className="mt-1 text-sm text-muted">
              {cur.plan === 'FREE'
                ? cur.expiredPlan
                  ? `Your ${cur.expiredPlan.toLowerCase()} plan ended on ${formatDate(cur.renewDate)}.`
                  : `${data.freeMonthlyDocs} documents a month, with a watermark.`
                : `Paid ${cur.billingCycle === 'YEARLY' ? 'yearly' : 'monthly'} · active until ${formatDate(cur.expiresAt)}`}
            </div>
          </div>
          <Segmented<Cycle>
            value={cycle}
            onChange={setCycle}
            options={[
              { value: 'MONTHLY', label: 'Monthly' },
              { value: 'YEARLY', label: 'Yearly · 2 months free' },
            ]}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {data.plans.map((p) => {
          const isCurrent = p.id === cur.plan;
          const price = p.prices?.[cycle];
          return (
            <div key={p.id} className={cn('card flex flex-col p-6', isCurrent && 'border-2 border-primary')}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold">{p.name}</h2>
                {isCurrent && <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white">Current</span>}
                {!p.available && <span className="rounded-full bg-panel px-2.5 py-1 text-[11px] font-bold text-muted">Coming soon</span>}
              </div>
              <p className="text-sm text-muted">{p.tagline}</p>
              <div className="mt-4">
                {price ? (
                  <>
                    <span className="text-[30px] font-extrabold tracking-tight tabular">{priceLabel(price, data.currency)}</span>
                    <span className="text-sm text-muted"> / {cycle === 'YEARLY' ? 'year' : 'month'}</span>
                  </>
                ) : (
                  <span className="text-[30px] font-extrabold tracking-tight">Free</span>
                )}
              </div>
              <ul className="mt-5 flex-1 space-y-2.5 text-[14.5px]">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.6} />
                    {f}
                  </li>
                ))}
              </ul>
              {p.prices && (
                <Button className="mt-6 w-full" variant={isCurrent ? 'secondary' : 'primary'} disabled={!p.available || !admin} onClick={() => setBuying(p)}>
                  {!p.available ? 'Coming soon' : isCurrent ? `Extend ${cycle === 'YEARLY' ? 'a year' : 'a month'}` : `Get ${p.name}`}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {!admin && <p className="mt-4 text-sm text-muted">Only the business administrator can change the plan.</p>}

      <Card className="mt-6" title="Payment history" padded={false}>
        {data.history.length ? (
          <ul className="divide-y divide-line">
            {data.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-panel text-ink-soft">
                    {h.provider === 'MPESA' ? <Smartphone className="size-4" /> : <CreditCard className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {h.purpose === 'SUBSCRIPTION' ? `${h.plan === 'PRO' ? 'Pro' : 'Starter'} · ${h.billingCycle === 'YEARLY' ? '1 year' : '1 month'}` : `Watermark removed · ${h.document?.number ?? 'document'}`}
                    </span>
                    <span className="block text-[12.5px] text-muted">
                      {formatDateTime(h.createdAt)}
                      {h.receipt ? ` · ${h.receipt}` : ''}
                    </span>
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold whitespace-nowrap tabular">{formatMoney(h.amount, h.currency, { decimals: !Number.isInteger(Number(h.amount)) })}</span>
                  <span className={cn('text-[12.5px] font-semibold', h.status === 'PAID' ? 'text-positive' : 'text-danger')}>{h.status === 'PAID' ? 'Paid' : 'Failed'}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 pb-6 text-sm text-muted">No payments yet.</p>
        )}
      </Card>

      {buying?.prices && (
        <PayDialog
          open={!!buying}
          onClose={() => setBuying(null)}
          title={`${buying.name} · ${cycle === 'YEARLY' ? '1 year' : '1 month'}`}
          amountLabel={priceLabel(buying.prices[cycle], data.currency)}
          providers={data.providers}
          summary={cur.plan === buying.id && cur.expiresAt ? `Adds ${cycle === 'YEARLY' ? 'a year' : 'a month'} after ${formatDate(cur.expiresAt)}.` : 'Starts today. No automatic renewals.'}
          defaultEmail={user.email}
          start={(pay) => api.post('/billing/subscribe', { ...pay, plan: buying.id, cycle })}
          onPaid={() => {
            void qc.invalidateQueries({ queryKey: keys.billing });
            void qc.invalidateQueries({ queryKey: keys.me });
            void qc.invalidateQueries({ queryKey: keys.summary });
            toast.success(`${buying.name} is active — no more watermarks`);
          }}
        />
      )}
    </>
  );
}
