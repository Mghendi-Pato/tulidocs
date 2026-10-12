'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { daysLeftLabel, formatDate, formatDateTime, formatMoney, priceLabel } from '@/lib/format';
import { keys, useBilling } from '@/lib/queries';
import type { Cycle, PlanInfo, SubscriptionQuote } from '@/lib/types';

export default function BillingPage() {
  const user = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useBilling();
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  // ?cycle=YEARLY carries the choice made on the pricing page
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('cycle') === 'YEARLY') setCycle('YEARLY');
  }, []);
  // otherwise start on the cycle the business already pays (yearly customers see yearly prices)
  const paidCycle = data?.current.plan !== 'FREE' ? data?.current.billingCycle : null;
  useEffect(() => {
    if (paidCycle && !new URLSearchParams(window.location.search).get('cycle')) setCycle(paidCycle);
  }, [paidCycle]);
  const [buying, setBuying] = useState<PlanInfo | null>(null);
  const cur0 = data?.current;
  // monthly → yearly on an active plan is an upgrade: unused paid time is credited, so show the real top-up
  const upgradeCandidate = !!cur0 && cur0.plan !== 'FREE' && cur0.billingCycle === 'MONTHLY' && cycle === 'YEARLY';
  const quote = useQuery({
    queryKey: ['billing-quote', cur0?.plan, cycle, cur0?.expiresAt],
    queryFn: () => api.get<SubscriptionQuote>('/billing/quote', { plan: cur0!.plan, cycle }),
    enabled: upgradeCandidate,
    retry: false,
  });
  // quote for whatever is being bought (drives the pay dialog amount)
  const buyQuote = useQuery({
    queryKey: ['billing-quote', buying?.id, cycle, cur0?.expiresAt],
    queryFn: () => api.get<SubscriptionQuote>('/billing/quote', { plan: buying!.id, cycle }),
    enabled: !!buying,
    retry: false,
  });

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;
  const cur = data.current;
  const admin = isAdmin(user);
  const paid = cur.plan !== 'FREE' && !!cur.expiresAt;
  /** where an extension would take the plan to (top-ups stack after the current end date) */
  const extendTo = (c: Cycle) => {
    const d = new Date(paid && new Date(cur.expiresAt!) > new Date() ? cur.expiresAt! : Date.now());
    if (c === 'YEARLY') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  };
  const now = Date.now();
  /** paid periods that haven't started yet (topped up in advance) */
  const upcoming = data.history.filter(
    (h) => h.status === 'PAID' && h.periodStart && h.periodEnd && new Date(h.periodStart).getTime() > now && new Date(h.periodEnd) > new Date(h.periodStart), // credited (zero-length) periods don't count
  ).length;

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
                : (
                  <>
                    Active until <span className="font-bold text-ink">{formatDate(cur.expiresAt)}</span> · {daysLeftLabel(cur.expiresAt)}
                    {upcoming > 0 && (
                      <span className="block">
                        Includes {upcoming} top-up{upcoming > 1 ? 's' : ''} paid in advance — {upcoming > 1 ? 'they run' : 'it runs'} after your current period.
                      </span>
                    )}
                  </>
                )}
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
              {isCurrent && paid && (
                <div className="mt-4 rounded-xl bg-primary-soft/60 px-3.5 py-2.5 text-[13.5px]">
                  Active until <span className="font-bold">{formatDate(cur.expiresAt)}</span>
                  <span className="whitespace-nowrap text-muted"> · {daysLeftLabel(cur.expiresAt)}</span>
                </div>
              )}
              <ul className="mt-5 flex-1 space-y-2.5 text-[14.5px]">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.6} />
                    {f}
                  </li>
                ))}
              </ul>
              {p.prices && (
                <Button className="mt-6 w-full" variant={isCurrent ? 'secondary' : 'primary'} disabled={!p.available || !admin || (isCurrent && upgradeCandidate && !quote.data)} onClick={() => setBuying(p)}>
                  {!p.available
                    ? 'Coming soon'
                    : isCurrent && upgradeCandidate
                      ? quote.data
                        ? `Upgrade to yearly · ${priceLabel(quote.data.amount, data.currency)}`
                        : 'Upgrade to yearly'
                      : isCurrent
                        ? `Extend ${cycle === 'YEARLY' ? 'a year' : 'a month'}`
                        : `Get ${p.name}`}
                </Button>
              )}
              {p.prices && p.available && isCurrent && paid && upgradeCandidate && (
                <p className="mt-2 text-center text-[12.5px] text-muted">
                  {quote.data ? (
                    <>
                      {priceLabel(quote.data.price, data.currency)} − {priceLabel(quote.data.credit, data.currency)} credit for your unused {quote.data.creditDays} days. Your year runs until {formatDate(quote.data.periodEnd)}.
                    </>
                  ) : quote.error ? (
                    errorMessage(quote.error)
                  ) : (
                    'Working out your credit…'
                  )}
                </p>
              )}
              {p.prices && p.available && isCurrent && paid && !upgradeCandidate && (
                <p className="mt-2 text-center text-[12.5px] text-muted">Adds to your time — runs until {formatDate(extendTo(cycle))}</p>
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
                      {h.purpose === 'SUBSCRIPTION' ? `${h.plan === 'PRO' ? 'Pro' : 'Starter'} · ${h.billingCycle === 'YEARLY' ? '1 year' : '1 month'}${h.isUpgrade ? ' · upgrade' : ''}` : `Watermark removed · ${h.document?.number ?? 'document'}`}
                    </span>
                    {h.status === 'PAID' && h.periodStart && h.periodEnd && (
                      <span className="block text-[12.5px] text-ink-soft">
                        {formatDate(h.periodStart)} – {formatDate(h.periodEnd)}
                        <PeriodTag start={h.periodStart} end={h.periodEnd} />
                      </span>
                    )}
                    {h.isUpgrade && h.credit && Number(h.credit) > 0 && (
                      <span className="block text-[12.5px] text-ink-soft">Credit applied for unused time: {formatMoney(h.credit, h.currency, { decimals: !Number.isInteger(Number(h.credit)) })}</span>
                    )}
                    <span className="block text-[12.5px] text-muted">
                      Paid {formatDateTime(h.createdAt)}
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
          amountLabel={priceLabel(buyQuote.data?.amount ?? buying.prices[cycle], data.currency)}
          providers={data.providers}
          summary={
            buyQuote.data?.kind === 'upgrade' ? (
              <>
                {priceLabel(buyQuote.data.price, data.currency)} − {priceLabel(buyQuote.data.credit, data.currency)} credit for your unused {buyQuote.data.creditDays} days ={' '}
                <span className="font-bold text-ink">{priceLabel(buyQuote.data.amount, data.currency)}</span>. Starts today, runs until {formatDate(buyQuote.data.periodEnd)}.
              </>
            ) : buyQuote.data?.kind === 'extend' ? (
              `Adds ${cycle === 'YEARLY' ? 'a year' : 'a month'} — runs until ${formatDate(buyQuote.data.periodEnd)}.`
            ) : (
              'Starts today. No automatic renewals.'
            )
          }
          defaultEmail={user.email}
          start={(pay) => api.post('/billing/subscribe', { ...pay, plan: buying.id, cycle })}
          onPaid={() => {
            void qc.invalidateQueries({ queryKey: keys.billing });
            void qc.invalidateQueries({ queryKey: keys.me });
            void qc.invalidateQueries({ queryKey: keys.summary });
            void qc.invalidateQueries({ queryKey: ['billing-quote'] });
            toast.success(buyQuote.data?.kind === 'upgrade' ? `Upgraded to yearly — active until ${formatDate(buyQuote.data.periodEnd)}` : `${buying.name} is active — no more watermarks`);
          }}
        />
      )}
    </>
  );
}

/** Where a paid period sits relative to today */
function PeriodTag({ start, end }: { start: string; end: string }) {
  const now = Date.now();
  const [s, e] = [new Date(start).getTime(), new Date(end).getTime()];
  const [label, cls] =
    e <= s ? ['Credited to upgrade', 'bg-panel text-muted'] : now < s ? ['Upcoming', 'bg-primary-soft text-primary'] : now < e ? ['Current', 'bg-positive-soft text-positive'] : ['Used', 'bg-panel text-muted'];
  return <span className={cn('ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold', cls)}>{label}</span>;
}
