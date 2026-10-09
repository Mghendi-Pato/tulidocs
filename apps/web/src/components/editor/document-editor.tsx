'use client';

import { Eye, Maximize2, PencilLine } from 'lucide-react';
import Link from 'next/link';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { CURRENCIES, TYPE_LABEL } from '@/lib/constants';
import { countryInfo } from '@/lib/countries';
import { CountryLabel, CurrencyLabel } from '@/components/ui/flag';
import { useCountryOptions } from '@/lib/queries';
import { cn } from '@/lib/cn';
import { addDays } from '@/lib/format';
import type { Client, DocInput, DocType } from '@/lib/types';
import { DateInput } from '../ui/date-input';
import { Field, Input, Select, Textarea } from '../ui/field';
import { Card, Segmented } from '../ui/misc';
import { ClientPicker } from './client-picker';
import { emptyItem, ItemsEditor } from './items-editor';
import { LogoPicker } from './logo-picker';
import { PreviewPane, previewPayload } from './preview-pane';
import { TemplatePicker } from './template-picker';

export type EditorErrors = Partial<Record<'fromName' | 'clientName' | 'items' | 'issueDate' | 'number', string>>;

/** Checks what the server would reject, so the user sees it next to the field. */
export function validateDoc(v: DocInput, opts: { guest: boolean }): EditorErrors {
  const e: EditorErrors = {};
  if (opts.guest && !v.fromName?.trim()) e.fromName = 'Enter your business name or your name';
  if (!v.clientName.trim()) e.clientName = 'Enter who this is for';
  if (!v.issueDate) e.issueDate = 'Pick a date';
  if (opts.guest && !v.number?.trim()) e.number = 'Enter a number';
  const filled = v.items.filter((i) => i.description.trim());
  if (!filled.length) e.items = 'Add at least one item with a description';
  else if (v.items.some((i) => i.description.trim() && !/^\d+(\.\d+)?$/.test((i.unitPrice || '0').replace(/[,\s]/g, '')))) e.items = 'Check the prices — numbers only';
  return e;
}

/** Drops empty item rows, cleans numbers and removes editor-only fields before saving */
export function cleanDoc(v: DocInput): DocInput {
  const n = (s: string, d = '0') => (s ?? '').replace(/[,\s]/g, '') || d;
  const { country: _c, ...rest } = v;
  return {
    ...rest,
    items: v.items.filter((i) => i.description.trim()).map((i) => ({ description: i.description.trim(), quantity: n(i.quantity, '1'), unitPrice: n(i.unitPrice), taxRate: n(i.taxRate) })),
    discount: n(v.discount),
  };
}

interface Props {
  value: DocInput;
  onChange: (v: DocInput) => void;
  mode: 'guest' | 'business';
  /** API path for the live preview */
  previewPath: string;
  /** extra fields for the preview call (documentId) */
  previewExtra?: Record<string, unknown>;
  /** Changes when the watermark state changes (paid), to refresh the preview */
  previewVersion?: string;
  errors?: EditorErrors;
  defaultTaxRate?: string;
  /** Business mode: the sender card (from Settings) */
  sender?: ReactNode;
  /** Type can't change once a document exists */
  lockType?: boolean;
  banner?: ReactNode;
  actions: ReactNode;
}

/**
 * The invoice/quote/receipt editor: form on the left, live server-rendered preview on the right.
 * On phones the two are tabs ("Edit" / "Preview").
 */
export function DocumentEditor({ value: v, onChange, mode, previewPath, previewExtra, previewVersion, errors = {}, defaultTaxRate = '0', sender, lockType, banner, actions }: Props) {
  const countryList = useCountryOptions();
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [full, setFull] = useState(false);
  const closeFull = useCallback(() => setFull(false), []);
  const set = (patch: Partial<DocInput>) => onChange({ ...v, ...patch });
  const payload = useMemo(() => previewPayload(v, previewExtra), [v, previewExtra]);
  const label = TYPE_LABEL[v.type];

  const setType = (type: DocType) => {
    const due = type === 'RECEIPT' ? null : v.dueDate || addDays(v.issueDate, type === 'QUOTE' ? 30 : 14);
    set({ type, dueDate: due, number: mode === 'guest' ? `${type === 'QUOTE' ? 'QUO' : type === 'RECEIPT' ? 'RCT' : 'INV'}-${(v.number ?? '').split('-').pop() || '001'}` : v.number });
  };

  const taxIdLabel = v.taxIdLabel || 'Tax ID';
  const taxName = v.taxName || 'Tax';

  /** Guests: a new country suggests its currency, tax wording and rate (rows still on the old default rate move to the new one) */
  const changeCountry = (code: string) => {
    const prev = countryInfo(v.country);
    const c = countryInfo(code);
    set({
      country: code,
      currency: c.currency,
      taxName: c.taxName,
      taxIdLabel: c.taxIdLabel,
      items: v.items.map((i) => (Number(i.taxRate || 0) === prev.taxRate ? { ...i, taxRate: String(c.taxRate) } : i)),
    });
  };

  const pickClient = (c: Client) =>
    set({ clientId: c.id, clientName: c.name, clientEmail: c.email, clientPhone: c.phone, clientAddress: c.address, clientTaxId: c.taxId });

  return (
    <div>
      {banner}
      {/* Phone: switch between the form and the preview */}
      <div className="mb-4 lg:hidden">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className={cn("min-w-0 space-y-5", tab === "preview" && "max-lg:hidden")}>
          <Card title="Template">
            <TemplatePicker template={v.template} accent={v.accent} onTemplate={(template) => set({ template })} onAccent={(accent) => set({ accent })} />
          </Card>

          <Card title={`${label} details`}>
            <div className="space-y-4">
              {!lockType && (
                <Segmented<DocType>
                  value={v.type}
                  onChange={setType}
                  options={[
                    { value: 'INVOICE', label: 'Invoice' },
                    { value: 'QUOTE', label: 'Quote' },
                    { value: 'RECEIPT', label: 'Receipt' },
                  ]}
                />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`${label} number`} required={mode === 'guest'} error={errors.number} hint={mode === 'business' && !v.number ? 'Assigned automatically' : undefined}>
                  {(id) => <Input id={id} value={v.number ?? ''} onChange={(e) => set({ number: e.target.value })} placeholder={mode === 'business' ? 'Auto' : 'INV-001'} aria-invalid={!!errors.number} />}
                </Field>
                <Field label="Currency">
                  {(id) => (
                    <Select id={id} value={v.currency} onChange={(e) => set({ currency: e.target.value })}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          <CurrencyLabel code={c} />
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label={v.type === 'RECEIPT' ? 'Date paid' : 'Date'} required error={errors.issueDate}>
                  {(id) => <DateInput id={id} value={v.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />}
                </Field>
                {v.type !== 'RECEIPT' && (
                  <Field label={v.type === 'QUOTE' ? 'Valid until' : 'Due date'} optional>
                    {(id) => <DateInput id={id} value={v.dueDate ?? ''} min={v.issueDate} onChange={(e) => set({ dueDate: e.target.value || null })} />}
                  </Field>
                )}
              </div>
            </div>
          </Card>

          {mode === 'guest' ? (
            <Card title="Your business">
              <div className="space-y-4">
                <LogoPicker value={v.fromLogo} onChange={(fromLogo) => set({ fromLogo })} />
                <Field label="Country" hint="Sets your currency and tax wording — you can still change them">
                  {(id) => (
                    <Select id={id} value={v.country ?? 'XX'} onChange={(e) => changeCountry(e.target.value)}>
                      {countryList.map((c) => (
                        <option key={c.code} value={c.code}>
                          <CountryLabel code={c.code} name={c.name} />
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Business name / Name" required error={errors.fromName}>
                  {(id) => <Input id={id} value={v.fromName ?? ''} onChange={(e) => set({ fromName: e.target.value })} placeholder="e.g. Northwind Studio" aria-invalid={!!errors.fromName} />}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email" optional>
                    {(id) => <Input id={id} type="email" value={v.fromEmail ?? ''} onChange={(e) => set({ fromEmail: e.target.value })} placeholder="you@business.com" />}
                  </Field>
                  <Field label="Phone" optional>
                    {(id) => <Input id={id} inputMode="tel" value={v.fromPhone ?? ''} onChange={(e) => set({ fromPhone: e.target.value })} placeholder="Phone number" />}
                  </Field>
                  <Field label="Address" optional>
                    {(id) => <Textarea id={id} rows={2} value={v.fromAddress ?? ''} onChange={(e) => set({ fromAddress: e.target.value })} placeholder="Street, town" />}
                  </Field>
                  <Field label={taxIdLabel} optional>
                    {(id) => <Input id={id} value={v.fromTaxId ?? ''} onChange={(e) => set({ fromTaxId: e.target.value.toUpperCase() })} />}
                  </Field>
                </div>
              </div>
            </Card>
          ) : (
            sender
          )}

          <Card title={v.type === 'RECEIPT' ? 'Received from' : 'Bill to'}>
            <div className="space-y-4">
              <Field label="Name" required error={errors.clientName}>
                {(id) =>
                  mode === 'business' ? (
                    <ClientPicker id={id} value={v.clientName} onText={(clientName) => set({ clientName, clientId: null })} onPick={pickClient} invalid={!!errors.clientName} />
                  ) : (
                    <Input id={id} value={v.clientName} onChange={(e) => set({ clientName: e.target.value })} placeholder="Client or company name" aria-invalid={!!errors.clientName} />
                  )
                }
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" optional>
                  {(id) => <Input id={id} type="email" value={v.clientEmail ?? ''} onChange={(e) => set({ clientEmail: e.target.value })} />}
                </Field>
                <Field label="Phone" optional>
                  {(id) => <Input id={id} inputMode="tel" value={v.clientPhone ?? ''} onChange={(e) => set({ clientPhone: e.target.value })} />}
                </Field>
                <Field label="Address" optional>
                  {(id) => <Textarea id={id} rows={2} value={v.clientAddress ?? ''} onChange={(e) => set({ clientAddress: e.target.value })} />}
                </Field>
                <Field label={`Client ${taxIdLabel}`} optional hint="Often needed for your client to claim the expense">
                  {(id) => <Input id={id} value={v.clientTaxId ?? ''} onChange={(e) => set({ clientTaxId: e.target.value.toUpperCase() })} />}
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Items">
            {errors.items && (
              <p role="alert" className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">
                {errors.items}
              </p>
            )}
            <ItemsEditor
              items={v.items.length ? v.items : [emptyItem(mode === 'guest' ? String(countryInfo(v.country).taxRate) : defaultTaxRate)]}
              discount={v.discount}
              currency={v.currency}
              defaultTaxRate={mode === 'guest' ? String(countryInfo(v.country).taxRate) : defaultTaxRate}
              taxName={taxName}
              onItems={(items) => set({ items })}
              onDiscount={(discount) => set({ discount })}
            />
          </Card>

          <Card title="Payment & notes">
            <div className="space-y-4">
              {v.type !== 'RECEIPT' && (
                <Field
                  label="How to pay"
                  optional
                  hint={mode === 'business' ? <>Filled from your payment details in <Link href="/settings/" className="link">Settings</Link></> : 'Bank transfer, PayPal, mobile money — whatever your clients use'}
                >
                  {(id) => <Textarea id={id} rows={2} value={v.paymentInfo ?? ''} onChange={(e) => set({ paymentInfo: e.target.value })} placeholder="Bank · Account name · Account number" />}
                </Field>
              )}
              <Field label="Notes" optional>
                {(id) => <Textarea id={id} rows={2} value={v.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Thank you for your business!" />}
              </Field>
              <Field label="Terms" optional>
                {(id) => <Textarea id={id} rows={2} value={v.terms ?? ''} onChange={(e) => set({ terms: e.target.value })} placeholder="Payment due within 14 days" />}
              </Field>
            </div>
          </Card>
        </div>

        <div className={cn(tab === 'edit' && 'max-lg:hidden')}>
          <div className="lg:sticky lg:top-24">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-muted">
                <Eye className="size-4" /> Preview
              </span>
              <button
                type="button"
                onClick={() => setFull(true)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm font-bold text-ink-soft transition-colors hover:border-line-strong hover:bg-sidebar hover:text-ink focus-visible:ring-4 focus-visible:ring-primary/15"
              >
                <Maximize2 className="size-4" /> Full screen
              </button>
            </div>
            <PreviewPane path={previewPath} payload={payload} version={previewVersion} fullscreen={full} onExitFullscreen={closeFull} />
            <button type="button" onClick={() => setTab('edit')} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary lg:hidden">
              <PencilLine className="size-4" /> Back to editing
            </button>
          </div>
        </div>
      </div>

      {/* Actions stay in reach while scrolling */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}
