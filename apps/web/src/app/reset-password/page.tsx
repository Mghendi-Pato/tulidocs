'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Link2Off } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, PasswordInput } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { api, errorMessage } from '@/lib/api';

function ResetForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  // read the token once, then drop it from the address bar (keeps it out of history and screenshots)
  const [token] = useState(() => params.get('token') ?? '');
  useEffect(() => {
    if (params.get('token')) window.history.replaceState(null, '', '/reset-password/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const check = useQuery({
    queryKey: ['reset-token', token],
    queryFn: () => api.get<{ valid: boolean; email?: string }>('/auth/reset-password', { token }),
    enabled: token.length >= 20,
    retry: false,
    staleTime: Infinity,
  });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = password.length >= 8 && confirm === password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      qc.clear();
      toast.success('Password updated — you’re signed in');
      const me = await api.get<{ organization: unknown }>('/auth/me');
      router.replace(me.organization ? '/dashboard/' : '/platform/');
    } catch (err) {
      const msg = errorMessage(err);
      if (/expired|already used/i.test(msg)) setExpired(true);
      else setError(msg);
      setBusy(false);
    }
  };

  if (token.length < 20 || expired || check.data?.valid === false || check.isError) {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-danger-soft text-danger">
          <Link2Off className="size-8" />
        </span>
        <h3 className="mt-5 text-lg font-extrabold">This link has expired</h3>
        <p className="mt-2 text-[15px] text-muted">Reset links work once and last 60 minutes. Request a new one and use the latest email.</p>
        <ButtonLink href="/forgot-password/" className="mt-7 w-full rounded-lg">
          Send a new link
        </ButtonLink>
      </div>
    );
  }
  if (check.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="size-7" />
      </div>
    );
  }

  return (
    <>
      {check.data?.email && (
        <p className="-mt-4 mb-6 text-[15px] text-muted">
          For <span className="font-semibold text-ink">{check.data.email}</span>
        </p>
      )}
      {error && (
        <div role="alert" className="mb-6 rounded-lg bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="New password" required hint={tooShort ? undefined : 'At least 8 characters'} error={tooShort ? 'Use at least 8 characters' : undefined}>
          {(id) => <PasswordInput id={id} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />}
        </Field>
        <Field label="Confirm new password" required error={mismatch ? 'Passwords don’t match' : undefined}>
          {(id) => <PasswordInput id={id} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" />}
        </Field>
        <Button type="submit" size="lg" className="w-full rounded-lg" loading={busy} disabled={!valid}>
          Save new password {!busy && <ArrowRight className="size-[18px]" />}
        </Button>
        <p className="text-center text-[13px] text-muted">You’ll be signed in here, and signed out on any other devices.</p>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" subtitle="Pick something you don’t use on other sites." footer={<Link href="/login/" className="font-semibold text-primary hover:underline">Back to sign in</Link>}>
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
