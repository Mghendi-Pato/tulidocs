'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { toast } from 'sonner';
import { AppleButton, AuthLayout, GoogleButton, OrDivider } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/field';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuthConfig, useGuestDocs, useLocalCountry } from '@/lib/queries';

function SignupForm() {
  // not asked for — the visitor's country just sets sensible currency / tax defaults (changeable in Settings)
  const country = useLocalCountry();
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { data: config } = useAuthConfig();
  const guestDocs = useGuestDocs();
  const [f, setF] = useState({ email: '', password: '' });
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const pending = guestDocs.data?.length ?? 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errs.email = 'Enter a valid email address';
    if (f.password.length < 8) errs.password = 'Use at least 8 characters';
    if (!confirm) errs.confirm = 'Confirm your password';
    else if (confirm !== f.password) errs.confirm = 'Passwords don’t match';
    setErrors(errs);
    setError(null);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await api.post<{ claimed: number }>('/auth/signup', { ...f, country: country === 'XX' ? undefined : country });
      qc.clear();
      toast.success('Your account is ready', r.claimed ? { description: `${r.claimed} document(s) from this device were added.` } : undefined);
      const cycle = params.get('cycle');
      router.replace(cycle === 'MONTHLY' || cycle === 'YEARLY' ? `/billing/?cycle=${cycle}` : '/settings/?welcome=1');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') setErrors({ email: err.message });
      else setError(errorMessage(err));
      setBusy(false);
    }
  };

  if (config && !config.signupEnabled) {
    return <p className="rounded-lg bg-panel px-4 py-3 text-sm">New sign-ups are closed right now.</p>;
  }

  return (
    <>
      {pending > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-primary-soft px-4 py-3 text-sm text-ink">
          <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            The{' '}
            <Link href={`/create/?id=${guestDocs.data![0].id}`} className="font-bold text-primary underline-offset-2 hover:underline">
              {pending} document{pending > 1 ? 's' : ''}
            </Link>{' '}
            you made on this device will be added to your new account.
          </span>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-6 rounded-lg bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <GoogleButton next={params.get('cycle') ? `/billing/?cycle=${params.get('cycle')}` : params.get('next')} country={country} label="Sign up with Google" />
        {/* Apple sign-in: shown once APPLE_* is set in the API .env */}
        {config?.appleEnabled && <AppleButton next={params.get('cycle') ? `/billing/?cycle=${params.get('cycle')}` : params.get('next')} country={country} label="Sign up with Apple" />}
      </div>
      <OrDivider />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email address" required error={errors.email}>
          {(id) => <Input id={id} type="email" autoComplete="email" value={f.email} onChange={set('email')} placeholder="you@business.com" aria-invalid={!!errors.email} />}
        </Field>
        <Field label="Password" required error={errors.password} hint="At least 8 characters">
          {(id) => <PasswordInput id={id} autoComplete="new-password" value={f.password} onChange={set('password')} aria-invalid={!!errors.password} />}
        </Field>
        <Field label="Confirm password" required error={errors.confirm}>
          {(id) => <PasswordInput id={id} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!errors.confirm} />}
        </Field>
        <Button type="submit" size="lg" className="w-full rounded-lg" loading={busy}>
          Create free account {!busy && <ArrowRight className="size-[18px]" />}
        </Button>
        <p className="text-center text-[13px] text-muted">Free plan: {`10 documents a month`}. Upgrade any time.</p>
      </form>
      <p className="mt-6 text-center text-[15px] text-ink-soft">
        Already have an account?{' '}
        <Link href="/login/" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

export default function SignupPage() {
  return (
    <AuthLayout title="Create your account" subtitle="Free to start. Your invoices, saved and organised.">
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthLayout>
  );
}
