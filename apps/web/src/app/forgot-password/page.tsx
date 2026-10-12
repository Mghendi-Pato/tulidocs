'use client';

import { ArrowLeft, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { api, errorMessage } from '@/lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valid = EMAIL_RE.test(email.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return setError('Enter a valid email address');
    setError(null);
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSentTo(email.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <MailCheck className="size-8" />
        </span>
        <h3 className="mt-5 text-lg font-extrabold">Check your email</h3>
        <p className="mt-2 text-[15px] text-muted">
          If an account exists for <span className="font-semibold text-ink">{sentTo}</span>, we’ve sent a link to reset your password. It expires in 60 minutes.
        </p>
        <p className="mt-4 text-[13.5px] text-muted">Not there after a few minutes? Check your spam folder, or try again.</p>
        <div className="mt-7 flex flex-col gap-3">
          <Button variant="secondary" className="w-full rounded-lg" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
          <Link href="/login/" className="text-[15px] font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div role="alert" className="mb-6 rounded-lg bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Email address">
          {(id) => <Input id={id} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />}
        </Field>
        <Button type="submit" size="lg" className="w-full rounded-lg" loading={busy} disabled={!valid}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center">
        <Link href="/login/" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-primary hover:underline">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </p>
    </>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter the email you use for tuli and we’ll send you a link to choose a new one.">
      <Suspense>
        <ForgotForm />
      </Suspense>
    </AuthLayout>
  );
}
