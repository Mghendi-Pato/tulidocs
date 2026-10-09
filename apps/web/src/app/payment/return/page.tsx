'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PublicHeader } from '@/components/layout/public-header';
import { ButtonLink } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import type { CheckoutStatus } from '@/lib/types';

/** Card payments come back here from Paystack. We confirm the payment, then send the customer on. */
function Result() {
  const id = useSearchParams().get('checkout');
  const { data, isError } = useQuery({
    queryKey: ['checkout', id],
    queryFn: () => api.get<CheckoutStatus>(`/checkouts/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 2500 : false),
  });

  const target = !data
    ? '/'
    : data.purpose === 'SUBSCRIPTION'
      ? '/billing/'
      : data.guest
        ? `/create/?id=${data.documentId}`
        : `/documents/view/?id=${data.documentId}`;

  if (!id || isError) {
    return <Box icon={<XCircle className="size-8" />} tone="bad" title="Payment not found" body="If money left your account, contact support with your receipt." href="/" cta="Go home" />;
  }
  if (!data || data.status === 'PENDING') {
    return <Box icon={<Spinner className="size-7" />} tone="wait" title="Confirming your payment…" body="This takes a few seconds." />;
  }
  if (data.status === 'PAID') {
    return (
      <Box
        icon={<CheckCircle2 className="size-8" />}
        tone="good"
        title="Payment received"
        body={data.purpose === 'SUBSCRIPTION' ? 'Your plan is active. Thank you!' : 'Your watermark is gone — download your clean PDF.'}
        href={target}
        cta={data.purpose === 'SUBSCRIPTION' ? 'Back to billing' : 'Back to my document'}
      />
    );
  }
  return <Box icon={<XCircle className="size-8" />} tone="bad" title="Payment didn’t go through" body={data.failureReason ?? 'No money was taken. You can try again.'} href={target} cta="Go back" />;
}

function Box({ icon, tone, title, body, href, cta }: { icon: React.ReactNode; tone: 'good' | 'bad' | 'wait'; title: string; body: string; href?: string; cta?: string }) {
  const cls = tone === 'good' ? 'bg-positive-soft text-positive' : tone === 'bad' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary';
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <span className={`flex size-16 items-center justify-center rounded-full ${cls}`}>{icon}</span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-[15px] text-muted">{body}</p>
      {href && (
        <ButtonLink href={href} className="mt-7">
          {cta}
        </ButtonLink>
      )}
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <div className="min-h-dvh">
      <PublicHeader minimal />
      <Suspense>
        <Result />
      </Suspense>
    </div>
  );
}
