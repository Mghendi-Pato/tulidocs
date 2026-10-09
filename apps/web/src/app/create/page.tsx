'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, FileText, Lock, Save, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cleanDoc, DocumentEditor, EditorErrors, validateDoc } from '@/components/editor/document-editor';
import { emptyItem } from '@/components/editor/items-editor';
import { PublicHeader } from '@/components/layout/public-header';
import { PayDialog } from '@/components/pay/pay-dialog';
import { Button, ButtonLink } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { api, errorMessage, saveBlob } from '@/lib/api';
import { TEMPLATES } from '@/lib/constants';
import { countryInfo, defaultCurrency, detectCountry } from '@/lib/countries';
import { addDays, formatDate, formatMoney, priceLabel, today } from '@/lib/format';
import { keys, useGuestDocs, useMe, usePricing } from '@/lib/queries';
import type { Doc, DocInput } from '@/lib/types';
import { cn } from '@/lib/cn';


function blank(template?: string | null, country = 'XX'): DocInput {
  const t = today();
  const c = countryInfo(country);
  return {
    type: 'INVOICE',
    number: 'INV-001',
    template: TEMPLATES.some((x) => x.id === template) ? template! : 'classic',
    accent: '#2451d6',
    country: c.code,
    currency: defaultCurrency(c.code),
    taxName: c.taxName,
    taxIdLabel: c.taxIdLabel,
    issueDate: t,
    dueDate: addDays(t, 14),
    fromName: '',
    clientName: '',
    items: [emptyItem(String(c.taxRate))],
    discount: '',
    paymentInfo: '',
    notes: '',
    terms: '',
  };
}

function fromDoc(d: Doc, country: string): DocInput {
  return {
    country,
    taxName: d.taxName,
    taxIdLabel: d.taxIdLabel,
    type: d.type,
    number: d.number,
    template: d.template,
    accent: d.accent,
    currency: d.currency,
    issueDate: d.issueDate,
    dueDate: d.dueDate,
    fromName: d.fromName ?? '',
    fromEmail: d.fromEmail,
    fromPhone: d.fromPhone,
    fromAddress: d.fromAddress,
    fromTaxId: d.fromTaxId,
    fromLogo: d.fromLogo,
    clientName: d.clientName,
    clientEmail: d.clientEmail,
    clientPhone: d.clientPhone,
    clientAddress: d.clientAddress,
    clientTaxId: d.clientTaxId,
    items: d.items.map((i) => ({ description: i.description, quantity: String(Number(i.quantity)), unitPrice: String(i.unitPrice), taxRate: String(Number(i.taxRate)) })),
    discount: Number(d.discount) ? String(d.discount) : '',
    notes: d.notes,
    terms: d.terms,
    paymentInfo: d.paymentInfo,
  };
}

function Builder() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: pricing } = usePricing();
  const [id, setId] = useState<string | null>(params.get('id'));
  const [value, setValue] = useState<DocInput>(() => blank(params.get('template')));
  // Defaults follow the visitor's country (browser guess) — they can pick another
  const [country] = useState(() => (typeof window === 'undefined' ? 'XX' : detectCountry()));
  useEffect(() => {
    if (!params.get('id')) setValue((v) => (v.country === 'XX' && country !== 'XX' ? blank(v.template, country) : v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);
  const [saved, setSaved] = useState<string>('');
  const [errors, setErrors] = useState<EditorErrors>({});
  const [busy, setBusy] = useState<'save' | 'pdf' | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const unlockLabel = pricing ? priceLabel(pricing.unlockPrice, pricing.currency) : '…';
  const starter = pricing?.plans.find((p) => p.id === 'STARTER')?.prices;
  const starterLabel = starter && pricing ? `${priceLabel(starter.MONTHLY, pricing.currency)}/month` : '';

  // Signed-in businesses get the full editor
  useEffect(() => {
    if (me?.organization) router.replace('/documents/new/?type=INVOICE');
  }, [me, router]);

  const docQuery = useQuery({
    queryKey: keys.guestDoc(id ?? ''),
    queryFn: () => api.get<Doc>(`/guest/documents/${id}`),
    enabled: !!id,
    retry: false,
  });
  const doc = docQuery.data;
  const mine = useGuestDocs();

  // Load a saved guest document into the form once
  useEffect(() => {
    if (doc && !saved) {
      const v = fromDoc(doc, value.country ?? country);
      setValue(v);
      setSaved(JSON.stringify(cleanDoc(v)));
    }
  }, [doc, saved]);

  useEffect(() => {
    if (docQuery.isError) {
      toast.error('That document isn’t available on this device');
      setId(null);
      window.history.replaceState(null, '', '/create/');
    }
  }, [docQuery.isError]);

  const dirty = JSON.stringify(cleanDoc(value)) !== saved;

  const save = async (quiet = false): Promise<Doc | null> => {
    const errs = validateDoc(value, { guest: true });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('A few details are missing', { description: Object.values(errs)[0] });
      return null;
    }
    const body = cleanDoc(value);
    setBusy((b) => b ?? 'save');
    try {
      const d = id ? await api.patch<Doc>(`/guest/documents/${id}`, body) : await api.post<Doc>('/guest/documents', body);
      if (!id) {
        setId(d.id);
        window.history.replaceState(null, '', `/create/?id=${d.id}`);
      }
      setSaved(JSON.stringify(body));
      qc.setQueryData(keys.guestDoc(d.id), d);
      void qc.invalidateQueries({ queryKey: keys.guestDocs });
      if (!quiet) toast.success('Saved on this device');
      return d;
    } catch (e) {
      toast.error(errorMessage(e));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy('pdf');
    try {
      const d = dirty || !id ? await save(true) : doc;
      if (!d) return;
      const blob = await api.blob(`/guest/documents/${d.id}/pdf`);
      saveBlob(blob, `${d.number}.pdf`);
      if (d.watermark) toast('Downloaded with a watermark', { description: `Remove it for ${unlockLabel}.` });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const openPay = async () => {
    const d = dirty || !id ? await save(true) : doc;
    if (d) setPayOpen(true);
  };

  const unlocked = !!doc?.unlocked && !dirty;
  // Save / Download / Remove watermark stay off until the required (★) fields are filled in
  const valid = Object.keys(validateDoc(value, { guest: true })).length === 0;
  const lostUnlock = !!doc?.unlockedAt && !doc.unlocked;

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-6 pb-0 sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">{id ? doc?.number ?? 'Your document' : value.type === 'QUOTE' ? 'Create a quote' : value.type === 'RECEIPT' ? 'Create a receipt' : 'Create an invoice'}</h1>
          <p className="mt-2 text-[15px] text-muted">No account needed. Your work is kept on this device.</p>
        </div>
        {!!mine.data?.length && (
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {mine.data.slice(0, 6).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSaved('');
                  setId(r.id);
                  window.history.replaceState(null, '', `/create/?id=${r.id}`);
                }}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-bold transition-colors',
                  r.id === id ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong hover:border-primary',
                )}
              >
                <FileText className="size-4" />
                {r.number}
                {r.unlocked && <CheckCircle2 className="size-3.5 text-positive" />}
              </button>
            ))}
            {id && (
              <button
                type="button"
                onClick={() => {
                  setId(null);
                  setSaved('');
                  setValue({ ...blank(value.template, value.country), fromName: value.fromName, fromEmail: value.fromEmail, fromPhone: value.fromPhone, fromAddress: value.fromAddress, fromTaxId: value.fromTaxId, fromLogo: value.fromLogo });
                  window.history.replaceState(null, '', '/create/');
                }}
                className="shrink-0 rounded-full border border-dashed border-line-strong px-3.5 py-2 text-[13px] font-bold text-muted hover:border-primary hover:text-primary"
              >
                + New
              </button>
            )}
          </div>
        )}
      </div>

      <DocumentEditor
        mode="guest"
        value={value}
        onChange={setValue}
        errors={errors}
        previewPath="/guest/preview"
        previewExtra={id ? { documentId: id } : undefined}
        previewVersion={doc?.unlockedAt ?? ''}
        banner={
          unlocked ? (
            <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-positive-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 text-[14.5px] text-ink">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive" />
                <span>
                  <span className="font-bold">Paid — no watermark.</span> Switch templates freely.
                  {doc?.editWindowOpen ? ' Small corrections in the next 24 hours stay free.' : ' Changing the details now will bring the watermark back.'}
                </span>
              </div>
              <ButtonLink href="/signup/" size="sm" variant="secondary">
                Save to a free account
              </ButtonLink>
            </div>
          ) : (
            <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-panel px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 text-[14.5px] text-ink">
                <Lock className="mt-0.5 size-5 shrink-0 text-muted" />
                <span>
                  {lostUnlock ? (
                    <>
                      <span className="font-bold">You changed a paid document</span>, so the watermark is back. Undo your changes, or pay again for the new version.
                    </>
                  ) : (
                    <>
                      The preview has a watermark. <span className="font-bold">Remove it for {unlockLabel}</span>, or{' '}
                      <Link href="/signup/" className="link">
                        go unlimited{starterLabel ? ` from ${starterLabel}` : ''}
                      </Link>
                      .
                    </>
                  )}
                </span>
              </div>
            </div>
          )
        }
        actions={
          <>
            <span className="mr-auto hidden text-[13px] text-muted sm:block">{!valid ? 'Fill in the required fields (★) to continue' : dirty ? 'Unsaved changes' : id ? 'Saved on this device' : ''}</span>
            <Button variant="secondary" icon={<Save className="size-4" />} onClick={() => void save()} loading={busy === 'save'} disabled={!valid || (!dirty && !!id)}>
              Save
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => void download()} loading={busy === 'pdf'} disabled={!valid}>
              Download PDF
            </Button>
            {!unlocked && (
              <Button icon={<Sparkles className="size-4" />} onClick={() => void openPay()} disabled={!!busy || !valid}>
                Remove watermark · {unlockLabel}
              </Button>
            )}
          </>
        }
      />

      {doc && (
        <PayDialog
          open={payOpen}
          onClose={() => setPayOpen(false)}
          title="Remove the watermark"
          amountLabel={unlockLabel}
          providers={pricing?.providers}
          summary={
            <>
              {doc.number} · {doc.clientName} · {formatMoney(doc.total, doc.currency, { decimals: true })} · {formatDate(doc.issueDate)}
            </>
          }
          defaultPhone={value.fromPhone}
          defaultEmail={value.fromEmail}
          start={(pay) => api.post(`/guest/documents/${doc.id}/unlock`, { ...pay, country: pricing?.country ?? (country === 'XX' ? undefined : country) })}
          onPaid={async () => {
            await qc.invalidateQueries({ queryKey: keys.guestDoc(doc.id) });
            void qc.invalidateQueries({ queryKey: keys.guestDocs });
            toast.success('Watermark removed', { description: 'Download your clean PDF now.' });
          }}
        />
      )}
    </div>
  );
}

export default function CreatePage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <PublicHeader minimal />
      <Suspense fallback={<div className="mx-auto max-w-[1280px] px-4 py-8"><PageLoader /></div>}>
        <Builder />
      </Suspense>
    </div>
  );
}
