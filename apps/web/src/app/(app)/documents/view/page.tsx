'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Ban, Check, CheckCircle2, Copy, Download, FileCheck2, MoreHorizontal, Pencil, Receipt, Send, Sparkles, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TemplatePicker } from '@/components/editor/template-picker';
import { PayDialog } from '@/components/pay/pay-dialog';
import { Button, ButtonLink, IconButton } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { DateInput } from '@/components/ui/date-input';
import { Drawer } from '@/components/ui/drawer';
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { Menu } from '@/components/ui/menu';
import { Card, ErrorState, KeyValue, StatusPill } from '@/components/ui/misc';
import { PageLoader, Spinner } from '@/components/ui/spinner';
import { api, errorMessage, saveBlob } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { METHOD_LABEL, TYPE_LABEL } from '@/lib/constants';
import { formatDate, formatMoney, priceLabel, today } from '@/lib/format';
import { keys, useBilling, useDoc } from '@/lib/queries';
import type { Doc, PaymentMethod } from '@/lib/types';

function StoredPreview({ doc }: { doc: Doc }) {
  // cache the image itself (not a blob: URL — those die when revoked, which broke the preview
  // after paying / coming back to the page); each mount makes and frees its own URL
  const { data: blob, isLoading } = useQuery({
    queryKey: ['doc-preview', doc.id, doc.updatedAt, doc.template, doc.accent, doc.watermark, doc.status],
    queryFn: () => api.blob(`/documents/${doc.id}/preview`),
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel">
      {url && !isLoading ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`${doc.number} preview`} draggable={false} onContextMenu={(e) => e.preventDefault()} className="block w-full bg-white select-none" />
      ) : (
        <div className="flex aspect-[794/1123] items-center justify-center text-subtle">
          <Spinner className="size-7" />
        </div>
      )}
    </div>
  );
}

/**
 * mode "pay": mark the invoice paid (full balance by default, less for a part-payment),
 * optionally issuing a receipt. mode "receipt": generate a receipt for payments already recorded.
 */
function PaymentDialog({ doc, mode, open, onClose }: { doc: Doc; mode: 'pay' | 'receipt'; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const kenyan = useAuth().organization.country === 'KE';
  const owed = mode === 'pay' ? doc.balance : (doc.unreceipted ?? '0');
  const [f, setF] = useState({ amount: owed, date: today(), method: (kenyan ? 'MPESA' : 'BANK') as PaymentMethod, reference: '', notes: '' });
  const [withReceipt, setWithReceipt] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF((x) => ({ ...x, amount: owed }));
  }, [open, owed]);

  const full = Number(f.amount.replace(/[,\s]/g, '') || 0) >= Number(doc.balance);

  const submit = async () => {
    setBusy(true);
    try {
      const { amount, ...rest } = f;
      const res =
        mode === 'pay'
          ? await api.post<Doc>(`/documents/${doc.id}/payments`, { ...f, amount: amount.replace(/[,\s]/g, ''), issueReceipt: withReceipt })
          : await api.post<Doc>(`/documents/${doc.id}/receipt`, rest);
      await qc.invalidateQueries({ queryKey: keys.doc(doc.id) });
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: keys.summary });
      if (res.type === 'RECEIPT') {
        toast.success(mode === 'pay' ? `${full ? 'Marked as paid' : 'Payment recorded'} · receipt ${res.number}` : `Receipt ${res.number} created`, {
          action: { label: 'View receipt', onClick: () => router.push(`/documents/view/?id=${res.id}`) },
        });
      } else toast.success(full ? 'Marked as paid' : 'Part-payment recorded');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const money = (v: string) => formatMoney(v, doc.currency, { decimals: true });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={mode === 'pay' ? 'Mark as paid' : 'Generate a receipt'}
      description={
        mode === 'pay'
          ? `${doc.number} · balance ${money(doc.balance)}. Enter less for a part-payment.`
          : `${doc.number} · ${money(owed)} paid without a receipt yet.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={busy} icon={mode === 'pay' ? <Check className="size-4" /> : <Receipt className="size-4" />}>
            {mode === 'receipt' ? 'Create receipt' : full ? 'Mark as paid' : 'Record part-payment'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {mode === 'pay' ? (
          <Field label="Amount" required>
            {(id) => <MoneyInput id={id} prefix={doc.currency} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />}
          </Field>
        ) : (
          <Field label="Amount">{(id) => <MoneyInput id={id} prefix={doc.currency} value={owed} disabled onChange={() => undefined} />}</Field>
        )}
        <Field label="Date paid" required>
          {(id) => <DateInput id={id} value={f.date} max={today()} onChange={(e) => setF({ ...f, date: e.target.value })} />}
        </Field>
        <Field label="Paid by" required>
          {(id) => (
            <Select id={id} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PaymentMethod })}>
              {Object.entries(METHOD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Reference" optional hint={f.method === 'MPESA' ? 'M-Pesa code, e.g. SGH12ABC34' : undefined}>
          {(id) => <Input id={id} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value.toUpperCase() })} />}
        </Field>
        {mode === 'pay' && (
          <Checkbox className="sm:col-span-2" checked={withReceipt} onChange={(e) => setWithReceipt(e.target.checked)} label="Create a receipt for this payment" />
        )}
        {(mode === 'receipt' || withReceipt) && (
          <Field label="Note on the receipt" optional className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />}
          </Field>
        )}
      </div>
    </Drawer>
  );
}

function View() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const user = useAuth();
  const { data: pricing } = useBilling();
  const unlockLabel = pricing ? priceLabel(pricing.unlockPrice, pricing.currency) : '';
  const starter = pricing?.plans.find((p) => p.id === 'STARTER')?.prices;
  const { data: doc, isLoading, error } = useDoc(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState<'pay' | 'receipt' | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);

  if (isLoading) return <PageLoader />;
  if (error || !doc) return <ErrorState message={errorMessage(error ?? new Error('Document not found'))} />;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.doc(doc.id) });
    void qc.invalidateQueries({ queryKey: ['documents'] });
    void qc.invalidateQueries({ queryKey: keys.summary });
  };

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast.success(ok);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const download = () =>
    run('pdf', async () => {
      const blob = await api.blob(`/documents/${doc.id}/pdf`);
      saveBlob(blob, `${doc.number}.pdf`);
      if (doc.watermark) toast('Downloaded with a watermark', { description: 'Remove it for this document, or upgrade to Starter.' });
    });

  const setStatus = (status: string, ok: string) => run(status, () => api.post(`/documents/${doc.id}/status`, { status }), ok);

  const convert = () =>
    run('convert', async () => {
      const inv = await api.post<Doc>(`/documents/${doc.id}/convert`);
      toast.success(`Invoice ${inv.number} created`);
      router.push(`/documents/view/?id=${inv.id}`);
    });

  const duplicate = () =>
    run('dup', async () => {
      const d = await api.post<Doc>(`/documents/${doc.id}/duplicate`);
      toast.success(`Copied to ${d.number}`);
      router.push(`/documents/edit/?id=${d.id}`);
    });

  const remove = () =>
    confirm({
      title: `Delete ${doc.number}?`,
      body: doc.type === 'RECEIPT' ? 'The payment will be taken off its invoice.' : 'This can’t be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
      action: async () => {
        try {
          await api.delete(`/documents/${doc.id}`);
          toast.success(`${doc.number} deleted`);
          refresh();
          router.replace(`/documents/?type=${doc.type}`);
        } catch (e) {
          toast.error(errorMessage(e));
          throw e;
        }
      },
    });

  const voidDoc = () =>
    confirm({
      title: `Void ${doc.number}?`,
      body: doc.type === 'RECEIPT' ? 'The payment will be taken off its invoice. The receipt stays on record, marked void.' : 'It stays on record, marked void, and can’t be edited.',
      confirmLabel: 'Void',
      tone: 'danger',
      action: () => setStatus('VOID', `${doc.number} voided`),
    });

  const isInvoice = doc.type === 'INVOICE';
  const isQuote = doc.type === 'QUOTE';
  const overdue = isInvoice && ['SENT', 'PARTIALLY_PAID'].includes(doc.status) && !!doc.dueDate && doc.dueDate < today();
  const canPay = isInvoice && doc.status !== 'VOID' && Number(doc.balance) > 0;
  const deletable = doc.type === 'RECEIPT' || doc.status === 'DRAFT' || (isQuote && doc.status !== 'ACCEPTED');
  const invoiceOf = doc.related?.find((r) => r.type === 'INVOICE' && r.status !== 'VOID');
  const hasInvoice = !!invoiceOf && isQuote;
  const canReceipt = isInvoice && doc.status !== 'VOID' && Number(doc.unreceipted ?? 0) > 0;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href={`/documents/?type=${doc.type}`} className="text-sm font-semibold text-muted hover:text-ink">
            ← {TYPE_LABEL[doc.type]}s
          </Link>
          <h1 className="page-title mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {doc.number}
            <StatusPill status={doc.status} overdue={overdue} className="text-[15px]" />
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {doc.clientName} · {formatMoney(doc.total, doc.currency, { decimals: true })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canPay && (
            <Button icon={<CheckCircle2 className="size-4" />} onClick={() => setPayOpen('pay')}>
              Mark as paid
            </Button>
          )}
          {canReceipt && (
            <Button variant={canPay ? 'secondary' : 'primary'} icon={<Receipt className="size-4" />} onClick={() => setPayOpen('receipt')}>
              Generate receipt
            </Button>
          )}
          {isQuote && !hasInvoice && doc.status !== 'VOID' && doc.status !== 'DECLINED' && (
            <Button icon={<ArrowRightLeft className="size-4" />} onClick={() => void convert()} loading={busy === 'convert'}>
              Create invoice
            </Button>
          )}
          {hasInvoice && (
            <ButtonLink href={`/documents/view/?id=${invoiceOf!.id}`} variant="secondary" icon={<FileCheck2 className="size-4" />}>
              View invoice {invoiceOf!.number}
            </ButtonLink>
          )}
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={() => void download()} loading={busy === 'pdf'}>
            PDF
          </Button>
          {doc.status !== 'VOID' && (
            <ButtonLink href={`/documents/edit/?id=${doc.id}`} variant="secondary" icon={<Pencil className="size-4" />}>
              Edit
            </ButtonLink>
          )}
          <Menu
            trigger={(p) => (
              <IconButton {...p} label="More actions" variant="outline">
                <MoreHorizontal className="size-5" />
              </IconButton>
            )}
            items={[
              { label: 'Mark as sent', icon: <Send />, onSelect: () => void setStatus('SENT', 'Marked as sent'), hidden: doc.status !== 'DRAFT' || doc.type === 'RECEIPT' },
              { label: 'Mark as accepted', icon: <CheckCircle2 />, onSelect: () => void setStatus('ACCEPTED', 'Quote accepted'), hidden: !isQuote || ['ACCEPTED', 'VOID'].includes(doc.status) },
              { label: 'Mark as declined', icon: <X />, onSelect: () => void setStatus('DECLINED', 'Quote declined'), hidden: !isQuote || ['DECLINED', 'VOID', 'ACCEPTED'].includes(doc.status) },
              { label: 'Duplicate', icon: <Copy />, onSelect: () => void duplicate(), hidden: doc.type === 'RECEIPT' },
              { label: 'Void', icon: <Ban />, onSelect: () => void voidDoc(), danger: true, hidden: doc.status === 'VOID' || deletable },
              { label: 'Delete', icon: <Trash2 />, onSelect: () => void remove(), danger: true, hidden: !deletable },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <StoredPreview doc={doc} />

        <div className="space-y-5">
          {doc.watermark && doc.status !== 'VOID' && (
            <Card>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <h2 className="section-title">This PDF has a watermark</h2>
                  <p className="mt-1 text-sm text-muted">Remove it for this document only, or upgrade to Starter for no watermarks at all.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setUnlockOpen(true)}>
                      Remove for {unlockLabel}
                    </Button>
                    <ButtonLink href="/billing/" size="sm" variant="secondary">
                      Upgrade{starter && pricing ? ` — ${priceLabel(starter.MONTHLY, pricing.currency)}/month` : ''}
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card title="Summary">
            <KeyValue
              items={[
                { label: 'Total', value: formatMoney(doc.total, doc.currency, { decimals: true }) },
                { label: 'Paid', value: formatMoney(doc.amountPaid, doc.currency, { decimals: true }), hidden: !isInvoice },
                { label: 'Balance', value: <span className={Number(doc.balance) > 0 ? 'text-ink' : 'text-positive'}>{formatMoney(doc.balance, doc.currency, { decimals: true })}</span>, hidden: !isInvoice },
                { label: doc.type === 'RECEIPT' ? 'Date paid' : 'Date', value: formatDate(doc.issueDate) },
                { label: isQuote ? 'Valid until' : 'Due', value: formatDate(doc.dueDate), hidden: doc.type === 'RECEIPT' },
                { label: 'Paid by', value: doc.paymentMethod ? METHOD_LABEL[doc.paymentMethod] : null, hidden: doc.type !== 'RECEIPT' },
                { label: 'Reference', value: doc.paymentRef, hidden: doc.type !== 'RECEIPT' || !doc.paymentRef },
                { label: 'Client', value: doc.clientName },
              ]}
            />
          </Card>

          {!!doc.related?.length && (
            <Card title="Linked documents" padded={false}>
              <ul className="divide-y divide-line">
                {doc.related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/documents/view/?id=${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-sidebar sm:px-6">
                      <span className="flex items-center gap-3">
                        {r.type === 'RECEIPT' ? <Receipt className="size-4 text-muted" /> : <FileCheck2 className="size-4 text-muted" />}
                        <span>
                          <span className="block text-sm font-bold">
                            {TYPE_LABEL[r.type]} {r.number}
                          </span>
                          <span className="block text-[12.5px] text-muted">{formatDate(r.issueDate)}</span>
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-bold tabular">{formatMoney(r.total, doc.currency)}</span>
                        <StatusPill status={r.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Template">
            <TemplatePicker
              template={doc.template}
              accent={doc.accent}
              onTemplate={(template) => void run('tpl', () => api.patch(`/documents/${doc.id}/template`, { template }))}
              onAccent={(accent) => void run('tpl', () => api.patch(`/documents/${doc.id}/template`, { template: doc.template, accent }))}
            />
          </Card>
        </div>
      </div>

      {(canPay || canReceipt) && <PaymentDialog key={payOpen ?? 'closed'} doc={doc} mode={payOpen ?? 'pay'} open={!!payOpen} onClose={() => setPayOpen(null)} />}
      <PayDialog
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        title="Remove the watermark"
        amountLabel={unlockLabel}
        providers={pricing?.providers}
        summary={`${doc.number} · ${doc.clientName}`}
        defaultEmail={user.email}
        start={(pay) => api.post(`/billing/unlock/${doc.id}`, pay)}
        onPaid={() => {
          refresh();
          toast.success('Watermark removed');
        }}
      />
    </>
  );
}

export default function ViewDocumentPage() {
  return (
    <Suspense>
      <View />
    </Suspense>
  );
}
