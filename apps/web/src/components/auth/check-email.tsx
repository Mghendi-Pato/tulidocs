'use client';

import { MailCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Button } from '../ui/button';

/** "We sent you a link" panel, with a resend button that waits 60 s between sends */
export function CheckEmail({ email, onBack, backLabel = 'Use a different email' }: { email: string; onBack?: () => void; backLabel?: string }) {
  const [wait, setWait] = useState(60);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = async () => {
    setBusy(true);
    setNote(null);
    try {
      await api.post('/auth/resend-verification', { email });
      setNote('Sent again — check your inbox and spam folder.');
      setWait(60);
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
        <MailCheck className="size-8" />
      </span>
      <h3 className="mt-5 text-xl font-extrabold">Check your email</h3>
      <p className="mt-2 text-[15px] text-muted">
        We sent a link to <span className="font-semibold break-all text-ink">{email}</span>. Open it to confirm your email — it signs you straight in.
      </p>
      <p className="mt-3 text-[13.5px] text-muted">The link expires in 3 days. Not there? Check your spam or promotions folder.</p>
      {note && <p className="mt-4 rounded-lg bg-panel px-3 py-2 text-[13.5px] font-semibold text-ink-soft">{note}</p>}
      <div className="mt-7 flex flex-col gap-3">
        <Button variant="secondary" className="w-full rounded-lg" loading={busy} disabled={wait > 0} onClick={() => void resend()}>
          {wait > 0 ? `Resend link in ${wait}s` : 'Resend link'}
        </Button>
        {onBack && (
          <button type="button" onClick={onBack} className="text-[15px] font-semibold text-primary hover:underline">
            {backLabel}
          </button>
        )}
      </div>
    </div>
  );
}
