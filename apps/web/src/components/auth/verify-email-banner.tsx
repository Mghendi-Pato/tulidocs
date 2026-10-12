'use client';

import { MailWarning, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/queries';

/** Gentle reminder until the address is confirmed. Dismissable for the current visit only. */
export function VerifyEmailBanner() {
  const { data: me } = useMe();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (!me || me.emailVerified !== false || hidden) return null;

  const resend = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ alreadyVerified: boolean }>('/auth/resend-verification', {});
      if (r.alreadyVerified) window.location.reload();
      else {
        setSent(true);
        toast.success(`Confirmation link sent to ${me.email}`);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl border border-[#f2d58a] bg-[#fff8e6] px-4 py-3 text-[14px] text-[#5c4300] sm:items-center">
      <MailWarning className="mt-0.5 size-5 shrink-0 sm:mt-0" />
      <p className="min-w-0 flex-1">
        <span className="font-bold">Confirm your email.</span> We sent a link to <span className="font-semibold break-all">{me.email}</span>
        {sent ? ' — check your inbox (and spam).' : '.'}{' '}
        <button type="button" onClick={() => void resend()} disabled={busy || sent} className="font-bold underline underline-offset-2 hover:no-underline disabled:no-underline disabled:opacity-60">
          {busy ? 'Sending…' : sent ? 'Sent' : 'Resend link'}
        </button>
      </p>
      <button type="button" aria-label="Hide for now" onClick={() => setHidden(true)} className="-m-1 rounded-full p-1 hover:bg-black/5">
        <X className="size-4" />
      </button>
    </div>
  );
}
