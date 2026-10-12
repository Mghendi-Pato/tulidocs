'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Link2Off, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button, ButtonLink } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { api, errorMessage, markLoggingOut } from '@/lib/api';

type Check = { valid: boolean; email?: string; business?: string | null; documents?: number; paidUntil?: string | null };

function DeleteForm() {
  const qc = useQueryClient();
  const params = useSearchParams();
  // read the token once, then drop it from the address bar (keeps it out of history and screenshots)
  const [token] = useState(() => params.get('token') ?? '');
  useEffect(() => {
    if (params.get('token')) window.history.replaceState(null, '', '/delete-account/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const check = useQuery({
    queryKey: ['delete-token', token],
    queryFn: () => api.get<Check>('/auth/delete-account', { token }),
    enabled: token.length >= 20,
    retry: false,
    staleTime: Infinity,
  });
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);

  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      markLoggingOut(); // background requests failing with 401 now are expected
      await api.post('/auth/delete-account', { token });
      qc.clear();
      setDone(true);
    } catch (err) {
      const msg = errorMessage(err);
      if (/expired|already used/i.test(msg)) setExpired(true);
      else setError(msg);
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <CheckCircle2 className="size-8" />
        </span>
        <h3 className="mt-5 text-lg font-extrabold">Your account has been deleted</h3>
        <p className="mt-2 text-[15px] text-muted">You’ve been signed out everywhere. Thanks for using tuli — you’re welcome back any time.</p>
        <ButtonLink href="/" className="mt-7 w-full rounded-lg">
          Go to the home page
        </ButtonLink>
      </div>
    );
  }

  if (token.length < 20 || expired || check.data?.valid === false || check.isError) {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-danger-soft text-danger">
          <Link2Off className="size-8" />
        </span>
        <h3 className="mt-5 text-lg font-extrabold">This link has expired</h3>
        <p className="mt-2 text-[15px] text-muted">Delete links work once and last 60 minutes. Your account hasn’t been changed. To try again, go to Settings → Your account.</p>
        <ButtonLink href="/settings/" className="mt-7 w-full rounded-lg">
          Open Settings
        </ButtonLink>
      </div>
    );
  }

  if (check.isLoading || !check.data) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-7" />
      </div>
    );
  }

  const d = check.data;
  const paidUntil = d.paidUntil ? new Date(d.paidUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const lose = [
    d.business ? `Your business “${d.business}” and its settings` : 'Your account and settings',
    d.documents ? `${d.documents} document${d.documents === 1 ? '' : 's'} (invoices, quotes and receipts) and your clients` : 'Your documents and clients',
    ...(paidUntil ? [`Your paid plan (valid until ${paidUntil}) — unused time isn’t refunded`] : []),
  ];

  return (
    <>
      <p className="-mt-4 mb-6 text-[15px] text-muted">
        For <span className="font-semibold text-ink">{d.email}</span>
      </p>
      {error && (
        <div role="alert" className="mb-6 rounded-lg bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}
      <div className="rounded-xl border border-danger/30 bg-danger-soft/50 p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold text-danger">
          <AlertTriangle className="size-4 shrink-0" /> This can’t be undone. You’ll lose access to:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          {lose.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-[13.5px] text-muted">
        Download any documents you need first. You can sign up again later with the same email, but it will be a new, empty account.
      </p>
      <div className="mt-5">
        <Checkbox label="I understand — delete my account" checked={sure} onChange={(e) => setSure(e.target.checked)} />
      </div>
      <Button variant="danger" size="lg" className="mt-5 w-full rounded-lg" loading={busy} disabled={!sure} onClick={remove}>
        {!busy && <Trash2 className="size-[18px]" />} Delete my account
      </Button>
      <p className="mt-3 text-center text-[13px] text-muted">
        Changed your mind?{' '}
        <Link href="/dashboard/" className="font-semibold text-primary hover:underline">
          Keep my account
        </Link>
      </p>
    </>
  );
}

export default function DeleteAccountPage() {
  return (
    <AuthLayout title="Delete your account" subtitle="Last step — please read this first.">
      <Suspense>
        <DeleteForm />
      </Suspense>
    </AuthLayout>
  );
}
