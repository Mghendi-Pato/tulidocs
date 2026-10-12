'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Link2Off } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { ButtonLink } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/queries';

function Verify() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [token] = useState(() => params.get('token') ?? '');
  const [state, setState] = useState<{ status: 'working' | 'done' | 'failed'; email?: string; message?: string }>({ status: 'working' });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // React strict mode runs effects twice in dev; the link only works once
    ran.current = true;
    if (params.get('token')) window.history.replaceState(null, '', '/verify-email/');
    if (token.length < 20) return setState({ status: 'failed' });
    api
      .post<{ user: { email: string; name: string }; next: string | null }>('/auth/verify-email', { token })
      .then(async (r) => {
        // the link signed them in — carry on into tuli
        qc.clear();
        setState({ status: 'done', email: r.user.email });
        const me = await api.get<{ organization: unknown }>('/auth/me').catch(() => null);
        setTimeout(() => router.replace(r.next ?? (me?.organization ? '/settings/?welcome=1' : '/platform/')), 1200);
      })
      .catch((e) => setState({ status: 'failed', message: errorMessage(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.status === 'working') {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <Spinner className="size-7" />
        <p className="mt-4 text-[15px] text-muted">Confirming your email…</p>
      </div>
    );
  }
  const next = me ? (me.organization ? '/dashboard/' : '/platform/') : '/login/';
  if (state.status === 'done') {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-positive-soft text-positive">
          <CheckCircle2 className="size-8" />
        </span>
        <h3 className="mt-5 text-lg font-extrabold">Email confirmed</h3>
        <p className="mt-2 text-[15px] text-muted">
          <span className="font-semibold text-ink">{state.email}</span> is confirmed. Taking you to tuli…
        </p>
        <div className="mt-6 flex justify-center">
          <Spinner className="size-6" />
        </div>
      </div>
    );
  }
  return (
    <div className="text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-danger-soft text-danger">
        <Link2Off className="size-8" />
      </span>
      <h3 className="mt-5 text-lg font-extrabold">This link has expired</h3>
      <p className="mt-2 text-[15px] text-muted">
        {me ? 'Good news — your email is already confirmed and you’re signed in.' : 'Confirmation links work once and last 3 days. Try signing in — if your email still needs confirming, you can get a new link there.'}
      </p>
      <ButtonLink href={next} className="mt-7 w-full rounded-lg">
        {me ? 'Go to tuli' : 'Sign in'}
      </ButtonLink>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthLayout title="Confirm your email" subtitle="Activating your tuli account.">
      <Suspense>
        <Verify />
      </Suspense>
    </AuthLayout>
  );
}
