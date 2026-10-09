import { createHash } from 'node:crypto';
import type { Document, DocumentItem, DocumentType, Organization, Prisma } from '@prisma/client';
import { hasPaidPlan, UNLOCK_EDIT_WINDOW_HOURS } from '../billing/plans';
import { isoOf, toDateOnly } from '../common/dates';
import { computeTotals } from '../common/money';
import type { RenderDoc } from '../render/templates';
import type { DocumentInputDto } from './dto/document.dto';

export type DocWithItems = Document & { items: DocumentItem[]; source?: { number: string } | null };

/** Sender details a business always uses (from Settings); the tax number can be left off per document */
export function fromOrg(org: Organization, includeTaxId = true) {
  return {
    fromName: org.name,
    fromEmail: org.email,
    fromPhone: org.phone,
    fromAddress: org.address,
    fromTaxId: includeTaxId ? org.taxId : null,
    fromLogo: org.logo,
    taxName: org.taxName,
    taxIdLabel: org.taxIdLabel,
  };
}

/** "How to pay" text from the business's M-Pesa and bank details */
export function paymentInfoOf(org: Organization, number?: string): string | null {
  const lines: string[] = [];
  if (org.mpesaPaybill) lines.push(`M-Pesa Paybill: ${org.mpesaPaybill}  ·  Account: ${org.mpesaAccount || number || 'Invoice number'}`);
  if (org.mpesaTill) lines.push(`M-Pesa Till (Buy Goods): ${org.mpesaTill}`);
  if (org.bankDetails) lines.push(org.bankDetails);
  return lines.length ? lines.join('\n') : null;
}

/** Turns validated input into the columns + item rows to store. */
export function buildContent(input: DocumentInputDto) {
  const t = computeTotals(input.items, input.discount ?? '0');
  const items = input.items.map((it, i) => ({
    position: i,
    description: it.description,
    quantity: t.lines[i].quantity.toString(),
    unitPrice: t.lines[i].unitPrice.toString(),
    taxRate: t.lines[i].taxRate.toString(),
    amount: t.lines[i].amount.toString(),
  }));
  const data = {
    issueDate: toDateOnly(input.issueDate),
    dueDate: input.dueDate ? toDateOnly(input.dueDate) : null,
    clientName: input.clientName,
    clientEmail: input.clientEmail ?? null,
    clientPhone: input.clientPhone ?? null,
    clientAddress: input.clientAddress ?? null,
    clientTaxId: input.clientTaxId ?? null,
    subtotal: t.subtotal.toString(),
    discount: t.discount.toString(),
    taxTotal: t.taxTotal.toString(),
    total: t.total.toString(),
    notes: input.notes ?? null,
    terms: input.terms ?? null,
    paymentInfo: input.paymentInfo ?? null,
  } satisfies Partial<Prisma.DocumentUncheckedCreateInput>;
  return { data, items, totals: t };
}

/**
 * Fingerprint of what was paid for. Template and accent colour are NOT included —
 * switching templates after paying is free. Everything a customer would reuse (amounts,
 * parties, number, dates, logo) is included.
 */
export function contentHash(d: Pick<
  Document,
  'type' | 'number' | 'issueDate' | 'dueDate' | 'currency' | 'fromName' | 'fromEmail' | 'fromPhone' | 'fromAddress' | 'fromTaxId' | 'fromLogo' |
  'clientName' | 'clientEmail' | 'clientPhone' | 'clientAddress' | 'clientTaxId' | 'discount' | 'total' | 'notes' | 'terms' | 'paymentInfo'
> & { items: Pick<DocumentItem, 'description' | 'quantity' | 'unitPrice' | 'taxRate'>[] }): string {
  const s = (v: unknown) => (v == null ? '' : String(v));
  const payload = [
    d.type, d.number, isoOf(d.issueDate), isoOf(d.dueDate), d.currency,
    d.fromName, d.fromEmail, d.fromPhone, d.fromAddress, d.fromTaxId,
    d.fromLogo ? createHash('sha1').update(d.fromLogo).digest('hex') : '',
    d.clientName, d.clientEmail, d.clientPhone, d.clientAddress, d.clientTaxId,
    Number(s(d.discount)).toFixed(2), Number(s(d.total)).toFixed(2), d.notes, d.terms, d.paymentInfo,
    ...d.items.flatMap((i) => [i.description, Number(s(i.quantity)).toString(), Number(s(i.unitPrice)).toFixed(2), Number(s(i.taxRate)).toString()]),
  ].map(s);
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** True when this document's paid unlock still matches its content */
export function isUnlocked(doc: DocWithItems): boolean {
  return !!doc.unlockedAt && !!doc.unlockedHash && doc.unlockedHash === contentHash(doc);
}

/** Within the free-edit window after an unlock? (edits re-sign the unlock instead of losing it) */
export function inEditWindow(doc: Pick<Document, 'unlockedAt'>, now = new Date()) {
  return !!doc.unlockedAt && now.getTime() - doc.unlockedAt.getTime() < UNLOCK_EDIT_WINDOW_HOURS * 3_600_000;
}

/** Does this document print with the watermark? */
export function needsWatermark(doc: DocWithItems, org?: Pick<Organization, 'plan' | 'planExpiresAt'> | null): boolean {
  if (org && hasPaidPlan(org)) return false;
  return !isUnlocked(doc);
}

const str = (v: unknown) => (v == null ? '' : String(v));

export function toRenderDoc(doc: DocWithItems, extra: { etimsQr?: string | null } = {}): RenderDoc {
  return {
    type: doc.type,
    number: doc.number,
    status: doc.status,
    issueDate: isoOf(doc.issueDate)!,
    dueDate: isoOf(doc.dueDate),
    currency: doc.currency,
    template: doc.template,
    accent: doc.accent,
    taxName: doc.taxName,
    taxIdLabel: doc.taxIdLabel,
    from: { name: doc.fromName, email: doc.fromEmail, phone: doc.fromPhone, address: doc.fromAddress, taxId: doc.fromTaxId, logo: doc.fromLogo },
    to: { name: doc.clientName, email: doc.clientEmail, phone: doc.clientPhone, address: doc.clientAddress, taxId: doc.clientTaxId },
    items: [...doc.items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ description: i.description, quantity: str(i.quantity), unitPrice: str(i.unitPrice), taxRate: str(i.taxRate), amount: str(i.amount) })),
    subtotal: str(doc.subtotal),
    discount: str(doc.discount),
    taxTotal: str(doc.taxTotal),
    total: str(doc.total),
    amountPaid: str(doc.amountPaid),
    notes: doc.notes,
    terms: doc.terms,
    paymentInfo: doc.paymentInfo,
    paymentMethod: doc.paymentMethod,
    paymentRef: doc.paymentRef,
    sourceNumber: doc.source?.number ?? null,
    etims: doc.etimsInvoiceNo || doc.etimsSignature ? { invoiceNo: doc.etimsInvoiceNo, receiptNo: doc.etimsReceiptNo, signature: doc.etimsSignature, qr: extra.etimsQr ?? null } : null,
  };
}

/** An unsaved document (live preview) shaped like a stored one */
export function draftFromInput(input: DocumentInputDto, base: { type: DocumentType; number: string; currency: string; template: string; accent: string; from: ReturnType<typeof fromOrg> }): DocWithItems {
  const { data, items } = buildContent(input);
  const now = new Date();
  return {
    id: 'preview',
    organizationId: null,
    guestToken: null,
    type: base.type,
    status: 'DRAFT',
    number: base.number,
    template: base.template,
    accent: base.accent,
    currency: base.currency,
    ...base.from,
    clientId: null,
    ...data,
    amountPaid: '0',
    paymentMethod: null,
    paymentRef: null,
    sourceId: null,
    unlockedAt: null,
    unlockedHash: null,
    etimsInvoiceNo: null,
    etimsReceiptNo: null,
    etimsSignature: null,
    etimsQrUrl: null,
    etimsSignedAt: null,
    createdAt: now,
    updatedAt: now,
    items: items.map((i) => ({ ...i, id: `p${i.position}`, documentId: 'preview' })),
  } as unknown as DocWithItems;
}

/** Public shape of a document for the API (no guest token, no unlock hash) */
export function serializeDoc(doc: DocWithItems, opts: { watermark: boolean; editWindowOpen?: boolean }) {
  const { guestToken: _g, unlockedHash: _h, ...rest } = doc;
  return {
    ...rest,
    issueDate: isoOf(doc.issueDate),
    dueDate: isoOf(doc.dueDate),
    items: [...doc.items].sort((a, b) => a.position - b.position),
    balance: (Number(doc.total) - Number(doc.amountPaid)).toFixed(2),
    watermark: opts.watermark,
    unlocked: isUnlocked(doc),
    editWindowOpen: !!opts.editWindowOpen,
  };
}
