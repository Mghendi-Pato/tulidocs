'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppleButton, AuthLayout, GOOGLE_ERRORS, GoogleButton, OrDivider } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, PasswordInput } from '@/components/ui/field';
import { api, errorMessage } from '@/lib/api';
import { detectCountry } from '@/lib/countries';
import { useAuthConfig } from '@/lib/queries';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { data: config } = useAuthConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(() => GOOGLE_ERRORS[params.get('error') ?? ''] ?? (params.get('error') ? GOOGLE_ERRORS.google : null));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const next = safeNext(params.get('next'));
  const [country, setCountry] = useState<string | null>(null);
  useEffect(() => setCountry(detectCountry()), []);

  useEffect(() => {
    if (params.get('signedOut')) toast.success('You’ve been logged out');
    if (params.get('expired')) setError('Your session has ended. Please sign in again.');
    if (params.get('signedOut') || params.get('error') || params.get('expired')) {
      window.history.replaceState(null, '', next ? `/login/?next=${encodeURIComponent(next)}` : '/login/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return setError('Enter your email and password');
    setBusy(true);
    try {
      const r = await api.post<{ user: { name: string }; claimed: number }>('/auth/login', { email, password, remember });
      qc.clear();
      setDone(true);
      toast.success(`Welcome back, ${r.user.name.split(' ')[0]}`, r.claimed ? { description: `${r.claimed} document(s) from this device were added to your account.` } : undefined);
      const me = await api.get<{ organization: unknown }>('/auth/me');
      router.replace(next ?? (me.organization ? '/dashboard/' : '/platform/'));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <>
      {error && (
        <div role="alert" className="mb-6 rounded-lg bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <GoogleButton next={next} country={country} />
        {/* Apple sign-in: shown once APPLE_* is set in the API .env */}
        {config?.appleEnabled && <AppleButton next={next} country={country} />}
      </div>
      <OrDivider />
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Email address">{(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />}</Field>
        <Field label="Password">
          {(id) => <PasswordInput id={id} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />}
        </Field>
        <Checkbox label="Keep me signed in" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <Button type="submit" size="lg" className="w-full rounded-lg" loading={busy && !done} disabled={done} icon={done ? <CheckCircle2 className="size-5" /> : undefined}>
          {done ? 'Signed in' : 'Sign in'}
          {!busy && !done && <ArrowRight className="size-[18px]" />}
        </Button>
      </form>
      {config?.signupEnabled !== false && (
        <p className="mt-6 text-center text-[15px] text-ink-soft">
          New here?{' '}
          <Link href={next ? `/signup/?next=${encodeURIComponent(next)}` : '/signup/'} className="font-semibold text-primary hover:underline">
            Create a free account
          </Link>
        </p>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your invoices"
      footer={
        <>
          Just need one invoice?{' '}
          <Link href="/create/" className="font-semibold text-primary hover:underline">
            Create one without an account
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
