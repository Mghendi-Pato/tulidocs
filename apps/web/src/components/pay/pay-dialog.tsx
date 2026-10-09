'use client';

import { CheckCircle2, CreditCard, Smartphone, XCircle } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { CheckoutStart, CheckoutStatus, Provider } from '@/lib/types';
import { Button } from '../ui/button';
import { Drawer } from '../ui/drawer';
import { Field, Input } from '../ui/field';
import { Spinner } from '../ui/spinner';

type Stage = 'form' | 'waiting' | 'paid' | 'failed';

/**
 * Pay the platform: card everywhere (redirect to the card page, which returns to /payment/return),
 * plus M-Pesa where the region offers it (STK prompt on the phone; we poll until it's confirmed).
 */
export function PayDialog({
  open,
  onClose,
  title,
  amountLabel,
  summary,
  start,
  onPaid,
  defaultEmail,
  defaultPhone,
  providers = ['CARD'],
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  amountLabel: string;
  summary?: ReactNode;
  start: (pay: { provider: Provider; phone?: string; email?: string }) => Promise<CheckoutStart>;
  onPaid: (s: CheckoutStatus) => void;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
  /** payment methods offered in the buyer's region, preferred first */
  providers?: Provider[];
}) {
  const [provider, setProvider] = useState<Provider>(providers[0] ?? 'CARD');
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [stage, setStage] = useState<Stage>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    if (open) {
      setProvider(providers[0] ?? 'CARD');
      setStage('form');
      setError(null);
      setCheckoutId(null);
    }
  }, [open]);

  // Poll the payment while the customer confirms on their phone
  useEffect(() => {
    if (stage !== 'waiting' || !checkoutId) return;
    let stop = false;
    const tick = async () => {
      try {
        const s = await api.get<CheckoutStatus>(`/checkouts/${checkoutId}`);
        if (stop) return;
        if (s.status === 'PAID') {
          setStage('paid');
          onPaidRef.current(s);
          return;
        }
        if (s.status === 'FAILED' || s.status === 'CANCELLED') {
          setError(s.failureReason ?? 'The payment was not completed');
          setStage('failed');
          return;
        }
      } catch {
        /* keep polling through blips */
      }
      if (!stop) timer = setTimeout(tick, 2500);
    };
    let timer = setTimeout(tick, 2500);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [stage, checkoutId]);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await start({ provider, phone: provider === 'MPESA' ? phone : undefined, email: provider === 'CARD' ? email : undefined });
      if (r.authorizationUrl) {
        window.location.href = r.authorizationUrl;
        return;
      }
      setCheckoutId(r.checkoutId);
      setStage('waiting');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      description={summary}
      footer={
        stage === 'form' || stage === 'failed' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={busy} icon={provider === 'MPESA' ? <Smartphone className="size-4" /> : <CreditCard className="size-4" />}>
              {stage === 'failed' ? 'Try again' : provider === 'MPESA' ? `Pay ${amountLabel} with M-Pesa` : `Pay ${amountLabel} by card`}
            </Button>
          </>
        ) : stage === 'paid' ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close — I’ll check later
          </Button>
        )
      }
    >
      {stage === 'waiting' ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Spinner className="size-7" />
          </span>
          <h3 className="mt-5 text-lg font-extrabold">Check your phone</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">
            We sent an M-Pesa prompt to <span className="font-semibold text-ink">{phone}</span>. Enter your M-Pesa PIN to pay {amountLabel}. This page updates by itself.
          </p>
        </div>
      ) : stage === 'paid' ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-positive-soft text-positive">
            <CheckCircle2 className="size-8" />
          </span>
          <h3 className="mt-5 text-lg font-extrabold">Payment received</h3>
          <p className="mt-1 text-sm text-muted">Thank you! You’re all set.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}
          {providers.length > 1 && (
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
            {(
              [
                { id: 'MPESA', label: 'M-Pesa', body: 'Prompt on your phone', icon: Smartphone },
                { id: 'CARD', label: 'Card', body: 'Visa or Mastercard', icon: CreditCard },
              ] as const
            ).filter((m) => providers.includes(m.id)).map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={provider === m.id}
                onClick={() => setProvider(m.id)}
                className={cn(
                  'rounded-2xl border-2 p-4 text-left transition-colors',
                  provider === m.id ? 'border-primary bg-primary-soft/50' : 'border-line hover:border-line-strong',
                )}
              >
                <m.icon className={cn('size-5', provider === m.id ? 'text-primary' : 'text-muted')} />
                <div className="mt-2 text-[15px] font-bold">{m.label}</div>
                <div className="text-[12.5px] text-muted">{m.body}</div>
              </button>
            ))}
          </div>
          )}
          {provider === 'MPESA' ? (
            <Field label="M-Pesa phone number" hint="You’ll get a prompt to enter your M-Pesa PIN">
              {(id) => <Input id={id} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />}
            </Field>
          ) : (
            <Field label="Email for the receipt" hint="You’ll be taken to a secure card page (Visa, Mastercard and more)">
              {(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />}
            </Field>
          )}
        </div>
      )}
    </Drawer>
  );
}
