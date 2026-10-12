'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOut, PartyPopper, ShieldCheck, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { ReactNode, Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LogoPicker } from '@/components/editor/logo-picker';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Field, Input, PasswordInput, Select, Textarea } from '@/components/ui/field';
import { Card, ErrorState, PageHeader } from '@/components/ui/misc';
import { PageLoader } from '@/components/ui/spinner';
import { api, errorMessage } from '@/lib/api';
import { isAdmin, useAuth } from '@/lib/auth';
import { CURRENCIES, TEMPLATES } from '@/lib/constants';
import { countryInfo } from '@/lib/countries';
import { CountryLabel, CurrencyLabel } from '@/components/ui/flag';
import { keys, useCountryOptions, useOrganization } from '@/lib/queries';
import type { Organization } from '@/lib/types';

type Form = Record<string, string>;

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const BIZ_FIELDS = ['name', 'email', 'phone', 'address', 'taxId', 'website', 'country', 'currency', 'taxName', 'taxIdLabel', 'defaultTaxRate'];
const DOC_FIELDS = ['defaultTemplate', 'defaultTaxRate', 'paymentTermDays', 'invoicePrefix', 'quotePrefix', 'receiptPrefix', 'defaultNotes', 'defaultTerms'];
const ETIMS_FIELDS = ['etimsBranchId', 'etimsDeviceSerial'];

function Section({ title, description, children, onSave, busy, disabled }: { title: string; description?: string; children: ReactNode; onSave?: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <Card>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div>
          <h2 className="section-title">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        <div>
          {children}
          {onSave && (
            <div className="mt-5 flex justify-end">
              <Button onClick={onSave} loading={busy} disabled={disabled}>
                Save
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Settings() {
  const countryList = useCountryOptions();
  const params = useSearchParams();
  const user = useAuth();
  const qc = useQueryClient();
  const { data: org, isLoading, error, refetch } = useOrganization();
  const [f, setF] = useState<Form>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const admin = isAdmin(user);

  useEffect(() => {
    if (org) setF(Object.fromEntries(Object.entries(org).map(([k, v]) => [k, str(v)])));
  }, [org]);

  if (isLoading) return <PageLoader />;
  if (error || !org) return <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />;

  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  // M-Pesa and KRA eTIMS only make sense for Kenyan businesses (or ones that already set them up)
  const kenyan = f.country === 'KE' || !!org.mpesaPaybill || !!org.mpesaTill;
  // eTIMS is a KRA (Kenya) system — only shown while the business country is Kenya
  const showEtims = f.country === 'KE';
  const payFields = kenyan ? ['mpesaPaybill', 'mpesaAccount', 'mpesaTill', 'bankDetails'] : ['bankDetails'];
  /** true when any of these fields differs from what's saved — Save buttons stay off until then */
  const norm = (k: string, v: string) => (k === 'country' && v === 'XX' ? '' : v.trim());
  const changed = (fields: string[]) => fields.some((k) => norm(k, f[k] ?? '') !== norm(k, str(org[k as keyof Organization])));
  const ci = countryInfo(f.country);
  const countryHint = ci.code !== 'XX' && ci.taxRate ? `Standard ${ci.taxName} in ${ci.name}: ${ci.taxRate}%` : undefined;
  const input = (k: keyof Organization, label: string, props: Record<string, unknown> = {}, hint?: string) => (
    <Field label={label} error={errors[k]} hint={hint} optional={!['name'].includes(k)}>
      {(id) => <Input id={id} value={f[k] ?? ''} onChange={set(k)} disabled={!admin} aria-invalid={!!errors[k]} {...props} />}
    </Field>
  );

  const save = async (key: string, fields: string[], transform: (body: Record<string, unknown>) => Record<string, unknown> = (b) => b) => {
    setBusy(key);
    setErrors({});
    try {
      const body = transform(Object.fromEntries(fields.map((k) => [k, f[k] ?? ''])));
      await api.patch('/organization', body);
      void qc.invalidateQueries({ queryKey: keys.org });
      void qc.invalidateQueries({ queryKey: keys.me });
      toast.success('Saved');
    } catch (e) {
      const msg = errorMessage(e);
      const field = fields.find((k) => msg.toLowerCase().includes(k.toLowerCase().replace(/([A-Z])/g, ' $1').trim().split(' ')[0]));
      if (field) setErrors({ [field]: msg });
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  const saveLogo = async (logo: string | null) => {
    setBusy('logo');
    try {
      await api.put('/organization/logo', { logo });
      void qc.invalidateQueries({ queryKey: keys.org });
      void qc.invalidateQueries({ queryKey: keys.me });
      toast.success(logo ? 'Logo updated' : 'Logo removed');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description={admin ? 'These details appear on every new document.' : 'Only the business administrator can change these.'} />

      {params.get('welcome') && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-positive-soft px-5 py-4 text-[14.5px]">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-positive" />
          <span>
            <span className="font-bold">Welcome to tuli!</span> Add your business details and logo once — they’ll appear on every invoice, quote and receipt.
          </span>
        </div>
      )}

      <div className="space-y-5">
        <Section
          title="Business"
          description="Your name, contacts and tax details as printed on documents."
          onSave={admin ? () => void save('biz', BIZ_FIELDS, (b) => ({ ...b, defaultTaxRate: String(b.defaultTaxRate || '0'), country: b.country === 'XX' || !b.country ? undefined : b.country })) : undefined}
          busy={busy === 'biz'}
          disabled={!changed(BIZ_FIELDS)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{input('name', 'Business name')}</div>
            {input('email', 'Email', { type: 'email' })}
            {input('phone', 'Phone', { inputMode: 'tel' })}
            <Field label="Address" optional className="sm:col-span-2">
              {(id) => <Textarea id={id} rows={2} value={f.address ?? ''} onChange={set('address')} disabled={!admin} />}
            </Field>
            {input('website', 'Website')}
            <Field label="Country" hint="Changing it suggests the currency and tax wording below">
              {(id) => (
                <Select
                  id={id}
                  value={f.country || 'XX'}
                  disabled={!admin}
                  onChange={(e) => {
                    const c = countryInfo(e.target.value);
                    setF({ ...f, country: e.target.value, currency: c.currency, taxName: c.taxName, taxIdLabel: c.taxIdLabel, defaultTaxRate: String(c.taxRate) });
                  }}
                >
                  {countryList.map((c) => (
                    <option key={c.code} value={c.code}>
                      <CountryLabel code={c.code} name={c.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Currency">
              {(id) => (
                <Select id={id} value={f.currency ?? 'USD'} onChange={set('currency')} disabled={!admin}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      <CurrencyLabel code={c} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {input('taxName', 'Tax name', { placeholder: 'VAT, GST, Sales tax' }, 'Shown on documents, e.g. “VAT 16%”')}
            {input('taxIdLabel', 'Tax ID label', { placeholder: 'VAT No., GSTIN, EIN' })}
            <div className="sm:col-span-2">{input('taxId', f.taxIdLabel || 'Tax ID', {}, 'Your tax or business registration number')}</div>
          </div>
        </Section>

        <Section title="Logo" description="Shown at the top of your documents.">
          <LogoPicker value={org.logo} onChange={(v) => admin && void saveLogo(v)} busy={busy === 'logo'} />
        </Section>

        <Section
          title="Getting paid"
          description="Printed in the “How to pay” box on new invoices."
          onSave={admin ? () => void save('pay', payFields) : undefined}
          busy={busy === 'pay'}
          disabled={!changed(payFields)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment details" optional className="sm:col-span-2" hint="Bank account, IBAN/SWIFT, PayPal, Wise, mobile money…">
              {(id) => <Textarea id={id} rows={3} value={f.bankDetails ?? ''} onChange={set('bankDetails')} disabled={!admin} placeholder={'Bank · Account name · Account number\nPayPal: you@business.com'} />}
            </Field>
            {kenyan && (
              <>
                {input('mpesaPaybill', 'M-Pesa Paybill', { inputMode: 'numeric' })}
                {input('mpesaAccount', 'Paybill account', {}, 'Leave empty to use the invoice number')}
                {input('mpesaTill', 'M-Pesa Till (Buy Goods)', { inputMode: 'numeric' })}
              </>
            )}
          </div>
        </Section>

        <Section
          title="Documents"
          description="Defaults for new invoices, quotes and receipts."
          onSave={
            admin
              ? () =>
                  void save('docs', DOC_FIELDS, (b) => ({
                    ...b,
                    paymentTermDays: Number(b.paymentTermDays) || 0,
                    defaultTaxRate: String(b.defaultTaxRate || '0'),
                  }))
              : undefined
          }
          busy={busy === 'docs'}
          disabled={!changed(DOC_FIELDS)}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Template">
              {(id) => (
                <Select id={id} value={f.defaultTemplate ?? 'classic'} onChange={set('defaultTemplate')} disabled={!admin}>
                  {TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {input('defaultTaxRate', `${f.taxName || 'Tax'} rate %`, { inputMode: 'decimal' }, countryHint)}
            {input('paymentTermDays', 'Payment terms (days)', { inputMode: 'numeric' })}
            {input('invoicePrefix', 'Invoice prefix')}
            {input('quotePrefix', 'Quote prefix')}
            {input('receiptPrefix', 'Receipt prefix')}
            <Field label="Default notes" optional className="sm:col-span-3">
              {(id) => <Textarea id={id} rows={2} value={f.defaultNotes ?? ''} onChange={set('defaultNotes')} disabled={!admin} />}
            </Field>
            <Field label="Default terms" optional className="sm:col-span-3">
              {(id) => <Textarea id={id} rows={2} value={f.defaultTerms ?? ''} onChange={set('defaultTerms')} disabled={!admin} />}
            </Field>
          </div>
        </Section>

        {showEtims && (
        <Section title="KRA eTIMS" description="Have KRA sign your invoices automatically (OSCU).">
          <div className="flex items-start gap-3 rounded-xl bg-panel px-4 py-3.5 text-sm">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <span className="font-bold">Coming soon.</span> We’re completing KRA certification. You can save your details now: register on{' '}
              <a href="https://etims.kra.go.ke" target="_blank" rel="noreferrer" className="link">
                etims.kra.go.ke
              </a>
              , choose OSCU, and note your branch ID and device serial number.
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {input('etimsBranchId', 'Branch ID', { placeholder: '00' })}
            {input('etimsDeviceSerial', 'Device serial number')}
          </div>
          {admin && (
            <div className="mt-5 flex justify-end">
              <Button
                variant="secondary"
                loading={busy === 'etims'}
                disabled={!changed(ETIMS_FIELDS)}
                onClick={async () => {
                  setBusy('etims');
                  try {
                    await api.patch('/organization/etims', { etimsBranchId: f.etimsBranchId, etimsDeviceSerial: f.etimsDeviceSerial });
                    void qc.invalidateQueries({ queryKey: keys.org });
                    toast.success('eTIMS details saved');
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Save details
              </Button>
            </div>
          )}
        </Section>
        )}

        <Section title="Your account" description={`${user.email}${user.google ? ' · signs in with Google' : ''}`}>
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Your name" className="flex-1">
                {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
              </Field>
              <Button
                variant="secondary"
                loading={busy === 'name'}
                disabled={name.trim().length < 2 || name.trim() === user.name}
                onClick={async () => {
                  setBusy('name');
                  try {
                    await api.patch('/auth/profile', { name });
                    void qc.invalidateQueries({ queryKey: keys.me });
                    toast.success('Name updated');
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Update
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {user.hasPassword && (
                <Field label="Current password">{(id) => <PasswordInput id={id} autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />}</Field>
              )}
              <Field label={user.hasPassword ? 'New password' : 'Set a password'} hint={user.hasPassword ? undefined : 'Lets you sign in without Google too'}>
                {(id) => <PasswordInput id={id} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />}
              </Field>
            </div>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                loading={busy === 'pw'}
                disabled={pw.newPassword.length < 8}
                onClick={async () => {
                  setBusy('pw');
                  try {
                    await api.post('/auth/password', pw);
                    setPw({ currentPassword: '', newPassword: '' });
                    void qc.invalidateQueries({ queryKey: keys.me });
                    toast.success('Password saved');
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {user.hasPassword ? 'Change password' : 'Set password'}
              </Button>
            </div>
            {user.role !== 'SYSTEM_ADMIN' && <DeleteAccount email={user.email} />}
          </div>
        </Section>

        <SessionsSection />
      </div>
    </>
  );
}

/** Delete account: asks for a confirmation by email — nothing happens until the emailed link is used. */
function DeleteAccount({ email }: { email: string }) {
  const confirm = useConfirm();
  const ask = () =>
    confirm({
      title: 'Delete your account?',
      body: (
        <>
          We’ll email a confirmation link to <strong className="text-ink">{email}</strong>. Your account is only deleted once you open it. After that you won’t be able to sign
          in or get back your documents and clients.
        </>
      ),
      confirmLabel: 'Email me the link',
      cancelLabel: 'Go back',
      tone: 'danger',
      action: async () => {
        try {
          await api.post('/auth/delete-account/request');
          toast.success('Check your email', { description: `Open the link we sent to ${email} within 60 minutes to delete your account.` });
        } catch (e) {
          toast.error(errorMessage(e));
          throw e;
        }
      },
    });

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm font-bold text-danger">Delete account</h3>
        <p className="mt-0.5 text-sm text-muted">Close your account and business for good. We’ll ask you to confirm by email.</p>
      </div>
      <Button variant="danger" onClick={ask} className="shrink-0">
        <Trash2 className="size-4" /> Delete account
      </Button>
    </div>
  );
}

/** "Log out everywhere": signs out every other phone, tablet and browser; this device stays signed in. */
function SessionsSection() {
  const confirm = useConfirm();
  const signOutOthers = () =>
    confirm({
      title: 'Sign out of all other devices?',
      body: 'Every other phone, tablet and browser signed in to your account will be signed out straight away. You’ll stay signed in here.',
      confirmLabel: 'Sign out others',
      cancelLabel: 'Go back',
      tone: 'logout',
      action: async () => {
        try {
          await api.post('/auth/logout-all');
          toast.success('Signed out of all other devices');
        } catch (e) {
          toast.error(errorMessage(e));
          throw e;
        }
      },
    });

  return (
    <Section title="Signed-in devices" description="Lost a phone, or signed in on a shared computer? End those sessions here.">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Signs you out of tuli everywhere except this device. If you think someone else knows your password, change it too — that also signs out other devices.
        </p>
        <Button variant="secondary" onClick={signOutOthers} className="shrink-0">
          <LogOut className="size-4" /> Sign out other devices
        </Button>
      </div>
    </Section>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
