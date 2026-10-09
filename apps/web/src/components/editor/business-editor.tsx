'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Save, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { TYPE_LABEL } from '@/lib/constants';
import { keys, useOrganization } from '@/lib/queries';
import type { Doc, DocInput, DocType } from '@/lib/types';
import { Button, ButtonLink } from '../ui/button';
import { Checkbox } from '../ui/field';
import { Card } from '../ui/misc';
import { PageLoader } from '../ui/spinner';
import { cleanDoc, DocumentEditor, EditorErrors, validateDoc } from './document-editor';
import { emptyItem } from './items-editor';

interface Defaults {
  type: DocType;
  number: string;
  template: string;
  currency: string;
  issueDate: string;
  dueDate: string | null;
  taxRate: string;
  notes: string | null;
  terms: string | null;
  paymentInfo: string | null;
}

export function docToInput(d: Doc): DocInput {
  return {
    type: d.type,
    number: d.number,
    template: d.template,
    accent: d.accent,
    currency: d.currency,
    issueDate: d.issueDate,
    dueDate: d.dueDate,
    showFromTaxId: !!d.fromTaxId,
    clientId: d.clientId,
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

/** Sender block for businesses — the details from Settings; the tax number is optional per document */
function SenderCard({ showTaxId, onShowTaxId }: { showTaxId: boolean; onShowTaxId: (v: boolean) => void }) {
  const { data: org } = useOrganization();
  return (
    <Card title="From" action={<Link href="/settings/" className="link inline-flex items-center gap-1.5 text-sm"><Settings className="size-4" /> Edit</Link>}>
      <div className="flex items-center gap-4">
        {org?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logo} alt="" className="size-14 rounded-xl border border-line object-contain p-1" />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-xl bg-panel text-xl font-extrabold text-muted">{org?.name.charAt(0)}</span>
        )}
        <div className="min-w-0 text-sm">
          <div className="truncate text-[15px] font-bold">{org?.name}</div>
          <div className="truncate text-muted">{[org?.email, org?.phone].filter(Boolean).join(' · ') || 'Add your contact details in Settings'}</div>
          {org?.taxId && <div className={cn('text-muted', !showTaxId && 'line-through opacity-60')}>{org.taxIdLabel} {org.taxId}</div>}
        </div>
      </div>
      {org?.taxId && (
        <Checkbox
          className="mt-4 border-t border-line pt-4"
          checked={showTaxId}
          onChange={(e) => onShowTaxId(e.target.checked)}
          label={<span>Show {org.taxIdLabel} on this document</span>}
        />
      )}
    </Card>
  );
}

function Editor({ initial, docId, doc, defaultTaxRate }: { initial: DocInput; docId?: string; doc?: Doc; defaultTaxRate: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuth();
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<EditorErrors>({});
  const [busy, setBusy] = useState(false);
  const label = TYPE_LABEL[value.type];

  const save = async () => {
    const errs = validateDoc(value, { guest: false });
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('A few details are missing', { description: Object.values(errs)[0] });
    setBusy(true);
    try {
      const body = cleanDoc(value);
      const d = docId ? await api.patch<Doc>(`/documents/${docId}`, body) : await api.post<Doc>('/documents', body);
      qc.setQueryData(keys.doc(d.id), d);
      void qc.invalidateQueries({ queryKey: ['documents'] });
      void qc.invalidateQueries({ queryKey: keys.summary });
      void qc.invalidateQueries({ queryKey: keys.me });
      toast.success(docId ? `${label} saved` : `${label} ${d.number} created`);
      router.push(`/documents/view/?id=${d.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PLAN_LIMIT') {
        toast.error(e.message, { action: { label: 'Upgrade', onClick: () => router.push('/billing/') } });
      } else toast.error(errorMessage(e));
      setBusy(false);
    }
  };

  // Save stays off until every required (★) field is filled in
  const valid = Object.keys(validateDoc(value, { guest: false })).length === 0;

  const willLoseUnlock = !!doc && user.organization.plan === 'FREE' && doc.unlocked && !doc.editWindowOpen;

  return (
    <DocumentEditor
      mode="business"
      value={value}
      onChange={setValue}
      errors={errors}
      lockType={!!docId}
      defaultTaxRate={defaultTaxRate}
      previewPath="/documents/preview"
      previewExtra={docId ? { documentId: docId } : undefined}
      previewVersion={`${doc?.unlockedAt ?? ''}${user.organization.plan}`}
      sender={<SenderCard showTaxId={value.showFromTaxId !== false} onShowTaxId={(showFromTaxId) => setValue({ ...value, showFromTaxId })} />}
      banner={
        willLoseUnlock ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl bg-warning-soft px-5 py-4 text-[14.5px]">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
            <span>
              <span className="font-bold">This document was paid for.</span> Switching templates is free, but changing its details will bring the watermark back.
            </span>
          </div>
        ) : null
      }
      actions={
        <>
          {!valid && <span className="mr-auto hidden text-[13px] text-muted sm:block">Fill in the required fields (★) to save</span>}
          <ButtonLink href={docId ? `/documents/view/?id=${docId}` : `/documents/?type=${value.type}`} variant="ghost">
            Cancel
          </ButtonLink>
          <Button icon={<Save className="size-4" />} onClick={() => void save()} loading={busy} disabled={!valid}>
            {docId ? 'Save changes' : `Save ${label.toLowerCase()}`}
          </Button>
        </>
      }
    />
  );
}

export function NewDocument({ type }: { type: DocType }) {
  const { organization: org } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['defaults', type], queryFn: () => api.get<Defaults>('/documents/defaults', { type }), staleTime: 0 });
  if (isLoading || !data) return <PageLoader />;
  const initial: DocInput = {
    type,
    number: '',
    template: data.template,
    accent: '#2451d6',
    currency: data.currency,
    taxName: org.taxName,
    taxIdLabel: org.taxIdLabel,
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    clientName: '',
    items: [emptyItem(data.taxRate.replace(/\.00$/, ''))],
    discount: '',
    notes: data.notes ?? '',
    terms: data.terms ?? '',
    paymentInfo: data.paymentInfo ?? '',
  };
  return (
    <>
      <h1 className="page-title mb-6">New {TYPE_LABEL[type].toLowerCase()}</h1>
      <Editor key={type} initial={initial} defaultTaxRate={data.taxRate.replace(/\.00$/, '')} />
    </>
  );
}

export function EditDocument({ doc }: { doc: Doc }) {
  const { organization: org } = useAuth();
  return (
    <>
      <h1 className="page-title mb-6">Edit {doc.number}</h1>
      <Editor initial={{ ...docToInput(doc), taxName: org.taxName, taxIdLabel: org.taxIdLabel }} docId={doc.id} doc={doc} defaultTaxRate="0" />
    </>
  );
}
