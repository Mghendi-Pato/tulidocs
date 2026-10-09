import { Injectable } from '@nestjs/common';
import { DocumentType, Organization, PaymentMethod, Prisma } from '@prisma/client';
import { FREE_MONTHLY_DOCS, hasPaidPlan } from '../billing/plans';
import { addDaysIso, isoOf, startOfMonth, todayIso, toDateOnly } from '../common/dates';
import { Paginated } from '../common/dto/pagination.dto';
import { BusinessRuleException, NotFound, PlanLimitException } from '../common/errors';
import { D, round2 } from '../common/money';
import { AuthUser } from '../common/types';
import { EtimsService } from '../etims/etims.service';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { RenderService } from '../render/render.service';
import { SequencesService } from '../sequences/sequences.service';
import {
  buildContent,
  contentHash,
  DocWithItems,
  draftFromInput,
  fromOrg,
  inEditWindow,
  isUnlocked,
  needsWatermark,
  paymentInfoOf,
  serializeDoc,
  toRenderDoc,
} from './document-content';
import { DocumentInputDto, DocumentListQueryDto, PreviewDto, IssueReceiptDto, RecordPaymentDto } from './dto/document.dto';

const withItems = { items: { orderBy: { position: 'asc' } }, source: { select: { number: true } } } satisfies Prisma.DocumentInclude;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequences: SequencesService,
    private readonly render: RenderService,
    private readonly etims: EtimsService,
  ) {}

  // ───────────────────────── Reads ─────────────────────────

  private org(user: AuthUser) {
    return this.prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  }

  async get(user: AuthUser, id: string): Promise<DocWithItems> {
    const doc = await this.prisma.document.findFirst({ where: { id, organizationId: user.organizationId }, include: withItems });
    if (!doc) throw new NotFound('Document');
    return doc;
  }

  async detail(user: AuthUser, id: string) {
    const [doc, org] = await Promise.all([this.get(user, id), this.org(user)]);
    const related = await this.prisma.document.findMany({
      where: { organizationId: user.organizationId, OR: [{ sourceId: doc.id }, ...(doc.sourceId ? [{ id: doc.sourceId }] : [])] },
      select: { id: true, type: true, number: true, status: true, total: true, issueDate: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...serializeDoc(doc, { watermark: needsWatermark(doc, org), editWindowOpen: inEditWindow(doc) }),
      related: related.map((r) => ({ ...r, issueDate: isoOf(r.issueDate) })),
      // paid but not yet covered by a receipt (invoices only)
      unreceipted: doc.type === 'INVOICE' ? (await this.unreceipted(this.prisma, doc)).toFixed(2) : '0.00',
    };
  }

  async list(user: AuthUser, q: DocumentListQueryDto) {
    const where: Prisma.DocumentWhereInput = { organizationId: user.organizationId };
    if (q.type) where.type = q.type;
    if (q.clientId) where.clientId = q.clientId;
    if (q.status === 'UNPAID') where.status = { in: ['SENT', 'PARTIALLY_PAID', 'DRAFT'] };
    else if (q.status === 'OVERDUE') Object.assign(where, { status: { in: ['SENT', 'PARTIALLY_PAID'] }, dueDate: { lt: toDateOnly(todayIso()) } });
    else if (q.status) where.status = q.status;
    if (q.from || q.to) {
      where.issueDate = { ...(q.from ? { gte: toDateOnly(q.from) } : {}), ...(q.to ? { lte: toDateOnly(q.to) } : {}) };
    }
    if (q.search) {
      where.OR = [
        { number: { contains: q.search, mode: 'insensitive' } },
        { clientName: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, type: true, status: true, number: true, issueDate: true, dueDate: true, clientName: true,
          currency: true, total: true, amountPaid: true, template: true, createdAt: true,
        },
      }),
      this.prisma.document.count({ where }),
    ]);
    return Paginated.of(
      rows.map((r) => ({ ...r, issueDate: isoOf(r.issueDate), dueDate: isoOf(r.dueDate), balance: (Number(r.total) - Number(r.amountPaid)).toFixed(2) })),
      total,
      q.page,
      q.pageSize,
    );
  }

  /** Dashboard numbers */
  async summary(user: AuthUser) {
    const org = await this.org(user);
    const orgId = org.id;
    const today = toDateOnly(todayIso());
    const monthStart = startOfMonth();
    const open: Prisma.DocumentWhereInput = { organizationId: orgId, type: DocumentType.INVOICE, status: { in: ['SENT', 'PARTIALLY_PAID'] } };
    const [outstanding, overdue, paidMonth, quotesOpen, used, recent] = await Promise.all([
      this.prisma.document.aggregate({ where: open, _sum: { total: true, amountPaid: true }, _count: true }),
      this.prisma.document.aggregate({ where: { ...open, dueDate: { lt: today } }, _sum: { total: true, amountPaid: true }, _count: true }),
      this.prisma.document.aggregate({ where: { organizationId: orgId, type: 'RECEIPT', issueDate: { gte: toDateOnly(isoOf(monthStart)!) } }, _sum: { total: true } }),
      this.prisma.document.count({ where: { organizationId: orgId, type: 'QUOTE', status: { in: ['DRAFT', 'SENT'] } } }),
      this.usedThisMonth(this.prisma, orgId),
      this.prisma.document.findMany({
        where: { organizationId: orgId },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: { id: true, type: true, status: true, number: true, clientName: true, total: true, currency: true, issueDate: true, dueDate: true, amountPaid: true },
      }),
    ]);
    const owed = (a: { _sum: { total: Prisma.Decimal | null; amountPaid: Prisma.Decimal | null } }) => D(a._sum.total).sub(D(a._sum.amountPaid)).toFixed(2);
    return {
      currency: org.currency,
      outstanding: { amount: owed(outstanding), count: outstanding._count },
      overdue: { amount: owed(overdue), count: overdue._count },
      paidThisMonth: D(paidMonth._sum.total).toFixed(2),
      openQuotes: quotesOpen,
      usage: { used, limit: hasPaidPlan(org) ? null : FREE_MONTHLY_DOCS },
      recent: recent.map((r) => ({ ...r, issueDate: isoOf(r.issueDate), dueDate: isoOf(r.dueDate) })),
    };
  }

  private usedThisMonth(db: Tx | PrismaService, organizationId: string) {
    return db.document.count({ where: { organizationId, type: { in: ['QUOTE', 'INVOICE'] }, createdAt: { gte: startOfMonth() } } });
  }

  /** Defaults for a new document in the editor */
  async defaults(user: AuthUser, type: DocumentType) {
    const org = await this.org(user);
    const issueDate = todayIso();
    return {
      type,
      number: await this.sequences.peek(this.prisma, org, type),
      template: org.defaultTemplate,
      currency: org.currency,
      issueDate,
      dueDate: type === 'RECEIPT' ? null : addDaysIso(issueDate, type === 'QUOTE' ? 30 : org.paymentTermDays),
      taxRate: org.defaultTaxRate.toString(),
      notes: org.defaultNotes,
      terms: org.defaultTerms,
      paymentInfo: type === 'INVOICE' ? paymentInfoOf(org) : null,
    };
  }

  // ───────────────────────── Writes ─────────────────────────

  private async ensureQuota(tx: Tx, org: Organization, type: DocumentType) {
    if (type === 'RECEIPT' || hasPaidPlan(org)) return;
    const used = await this.usedThisMonth(tx, org.id);
    if (used >= FREE_MONTHLY_DOCS) {
      throw new PlanLimitException(`The Free plan includes ${FREE_MONTHLY_DOCS} documents a month. Upgrade to Starter for unlimited documents.`);
    }
  }

  /** Links to an existing client, or saves the recipient as a new client */
  private async resolveClient(tx: Tx, orgId: string, input: DocumentInputDto): Promise<string | null> {
    if (input.clientId) {
      const c = await tx.client.findFirst({ where: { id: input.clientId, organizationId: orgId }, select: { id: true } });
      if (!c) throw new NotFound('Client');
      return c.id;
    }
    const existing = await tx.client.findFirst({ where: { organizationId: orgId, name: { equals: input.clientName, mode: 'insensitive' } }, select: { id: true } });
    if (existing) return existing.id;
    const created = await tx.client.create({
      data: {
        organizationId: orgId,
        name: input.clientName,
        email: input.clientEmail ?? null,
        phone: input.clientPhone ?? null,
        address: input.clientAddress ?? null,
        taxId: input.clientTaxId ?? null,
      },
    });
    return created.id;
  }

  async create(user: AuthUser, input: DocumentInputDto, extra: { sourceId?: string } = {}) {
    const id = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
      const type = input.type ?? 'INVOICE';
      await this.ensureQuota(tx, org, type);
      const { data, items } = buildContent(input);
      const number = input.number || (await this.sequences.next(tx, org, type));
      const clientId = await this.resolveClient(tx, org.id, input);
      const doc = await tx.document.create({
        data: {
          ...data,
          organizationId: org.id,
          type,
          status: type === 'RECEIPT' ? 'PAID' : 'DRAFT',
          number,
          template: input.template ?? org.defaultTemplate,
          accent: input.accent ?? '#2451d6',
          currency: input.currency ?? org.currency,
          ...fromOrg(org, input.showFromTaxId !== false),
          clientId,
          sourceId: extra.sourceId ?? null,
          amountPaid: type === 'RECEIPT' ? data.total : '0',
          items: { create: items },
        },
      });
      return doc.id;
    });
    return this.detail(user, id);
  }

  async update(user: AuthUser, id: string, input: DocumentInputDto) {
    const existing = await this.get(user, id);
    if (existing.status === 'VOID') throw new BusinessRuleException('A void document can’t be edited');
    const wasUnlocked = isUnlocked(existing);
    await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
      const { data, items, totals } = buildContent(input);
      if (existing.type === 'INVOICE' && totals.total.lt(D(existing.amountPaid))) {
        throw new BusinessRuleException('The total can’t be less than what has already been paid');
      }
      const clientId = await this.resolveClient(tx, org.id, input);
      await tx.documentItem.deleteMany({ where: { documentId: id } });
      const updated = await tx.document.update({
        where: { id },
        data: {
          ...data,
          number: input.number || existing.number,
          template: input.template ?? existing.template,
          accent: input.accent ?? existing.accent,
          currency: input.currency ?? existing.currency,
          // keep the sender in sync with Settings (logo, PIN) while it's still being edited
          ...fromOrg(org, input.showFromTaxId !== false),
          clientId,
          items: { create: items },
        },
        include: withItems,
      });
      // Paid-for documents can be corrected for a short while without losing the unlock
      if (wasUnlocked && inEditWindow(existing)) {
        await tx.document.update({ where: { id }, data: { unlockedHash: contentHash(updated) } });
      }
      if (existing.type === 'INVOICE' && Number(existing.amountPaid) > 0) {
        await tx.document.update({ where: { id }, data: { status: totals.total.lte(D(existing.amountPaid)) ? 'PAID' : 'PARTIALLY_PAID' } });
      }
    });
    return this.detail(user, id);
  }

  /** Switching templates never changes what was paid for */
  async setTemplate(user: AuthUser, id: string, template: string, accent?: string) {
    await this.get(user, id);
    await this.prisma.document.update({ where: { id }, data: { template, ...(accent ? { accent } : {}) } });
    return this.detail(user, id);
  }

  async setStatus(user: AuthUser, id: string, status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'VOID') {
    const doc = await this.get(user, id);
    const allowed: Record<DocumentType, string[]> = {
      QUOTE: ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'VOID'],
      INVOICE: ['DRAFT', 'SENT', 'VOID'],
      RECEIPT: ['VOID'],
    };
    if (!allowed[doc.type].includes(status)) throw new BusinessRuleException(`A ${doc.type.toLowerCase()} can’t be marked ${status.toLowerCase()}`);
    if (doc.type === 'INVOICE' && status !== 'VOID' && Number(doc.amountPaid) > 0) {
      throw new BusinessRuleException('This invoice already has payments');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id }, data: { status } });
      // Voiding a receipt gives the money back to its invoice
      if (doc.type === 'RECEIPT' && status === 'VOID' && doc.status !== 'VOID' && doc.sourceId) await this.reverseReceipt(tx, doc);
    });
    return this.detail(user, id);
  }

  private async reverseReceipt(tx: Tx, receipt: DocWithItems) {
    const inv = await tx.document.findUnique({ where: { id: receipt.sourceId! } });
    if (!inv || inv.type !== 'INVOICE') return;
    const paid = D(inv.amountPaid).sub(D(receipt.total));
    const left = paid.lt(0) ? D(0) : paid;
    await tx.document.update({
      where: { id: inv.id },
      data: { amountPaid: left.toString(), status: left.gte(D(inv.total)) ? 'PAID' : left.gt(0) ? 'PARTIALLY_PAID' : 'SENT' },
    });
  }

  /** Quote → invoice (same content, new invoice number) */
  async convertToInvoice(user: AuthUser, id: string) {
    const quote = await this.get(user, id);
    if (quote.type !== 'QUOTE') throw new BusinessRuleException('Only quotes can be turned into invoices');
    const existing = await this.prisma.document.findFirst({ where: { sourceId: id, type: 'INVOICE', status: { not: 'VOID' } }, select: { id: true } });
    if (existing) throw new BusinessRuleException('This quote already has an invoice', 'ALREADY_CONVERTED', { id: existing.id });
    const defaults = await this.defaults(user, 'INVOICE');
    const invoice = await this.create(
      user,
      {
        ...this.inputOf(quote),
        type: 'INVOICE',
        number: null,
        issueDate: todayIso(),
        dueDate: defaults.dueDate,
        paymentInfo: quote.paymentInfo ?? defaults.paymentInfo,
      },
      { sourceId: quote.id },
    );
    await this.prisma.document.update({ where: { id }, data: { status: 'ACCEPTED' } });
    return invoice;
  }

  /**
   * Records a payment on an invoice (marks it paid / part-paid). A receipt is issued for it
   * unless `issueReceipt` is false — one can be generated later with `issueReceipt()`.
   */
  async recordPayment(user: AuthUser, id: string, dto: RecordPaymentDto) {
    const invoice = await this.get(user, id);
    if (invoice.type !== 'INVOICE') throw new BusinessRuleException('Payments are recorded on invoices');
    if (invoice.status === 'VOID') throw new BusinessRuleException('This invoice is void');
    const amount = round2(D(dto.amount));
    const balance = D(invoice.total).sub(D(invoice.amountPaid));
    if (amount.lte(0)) throw new BusinessRuleException('Enter an amount greater than zero');
    if (amount.gt(balance)) throw new BusinessRuleException(`The balance is ${invoice.currency} ${balance.toFixed(2)} — the payment can’t be more than that`);

    const receiptId = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
      const paid = D(invoice.amountPaid).add(amount);
      await tx.document.update({
        where: { id },
        data: { amountPaid: paid.toString(), status: paid.gte(D(invoice.total)) ? 'PAID' : 'PARTIALLY_PAID' },
      });
      if (dto.issueReceipt === false) return null;
      return this.createReceipt(tx, org, invoice, amount, paid, dto);
    });
    return this.detail(user, receiptId ?? id);
  }

  /** Amount paid on an invoice that no (non-void) receipt covers yet */
  private async unreceipted(db: Tx | PrismaService, invoice: DocWithItems) {
    const agg = await db.document.aggregate({
      where: { sourceId: invoice.id, type: 'RECEIPT', status: { not: 'VOID' } },
      _sum: { total: true },
    });
    return round2(D(invoice.amountPaid).sub(D(agg._sum.total ?? 0)));
  }

  /** Generates a receipt for payments already recorded on an invoice without one */
  async issueReceipt(user: AuthUser, id: string, dto: IssueReceiptDto) {
    const invoice = await this.get(user, id);
    if (invoice.type !== 'INVOICE') throw new BusinessRuleException('Receipts are generated from invoices');
    if (invoice.status === 'VOID') throw new BusinessRuleException('This invoice is void');
    const receiptId = await this.prisma.$transaction(async (tx) => {
      const amount = await this.unreceipted(tx, invoice);
      if (amount.lte(0)) throw new BusinessRuleException('Every payment on this invoice already has a receipt');
      const org = await tx.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
      return this.createReceipt(tx, org, invoice, amount, D(invoice.amountPaid), dto);
    });
    return this.detail(user, receiptId);
  }

  private async createReceipt(
    tx: Tx,
    org: Organization,
    invoice: DocWithItems,
    amount: ReturnType<typeof D>,
    paidAfter: ReturnType<typeof D>,
    dto: { date: string; method: PaymentMethod; reference?: string | null; notes?: string | null },
  ) {
    const receipt = await tx.document.create({
      data: {
        organizationId: org.id,
        type: 'RECEIPT',
        status: 'PAID',
        number: await this.sequences.next(tx, org, 'RECEIPT'),
        template: invoice.template,
        accent: invoice.accent,
        currency: invoice.currency,
        issueDate: toDateOnly(dto.date),
        ...fromOrg(org, !!invoice.fromTaxId),
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        clientPhone: invoice.clientPhone,
        clientAddress: invoice.clientAddress,
        clientTaxId: invoice.clientTaxId,
        subtotal: amount.toString(),
        total: amount.toString(),
        amountPaid: amount.toString(),
        paymentMethod: dto.method,
        paymentRef: dto.reference ?? null,
        notes: dto.notes ?? (paidAfter.gte(D(invoice.total)) ? 'Thank you — this invoice is now fully paid.' : `Balance remaining: ${invoice.currency} ${D(invoice.total).sub(paidAfter).toFixed(2)}`),
        sourceId: invoice.id,
        items: { create: [{ position: 0, description: `Payment for invoice ${invoice.number}`, quantity: '1', unitPrice: amount.toString(), taxRate: '0', amount: amount.toString() }] },
      },
    });
    return receipt.id;
  }

  async duplicate(user: AuthUser, id: string) {
    const doc = await this.get(user, id);
    if (doc.type === 'RECEIPT') throw new BusinessRuleException('Receipts can’t be duplicated');
    const defaults = await this.defaults(user, doc.type);
    return this.create(user, { ...this.inputOf(doc), number: null, issueDate: defaults.issueDate, dueDate: defaults.dueDate });
  }

  async remove(user: AuthUser, id: string) {
    const doc = await this.get(user, id);
    const deletable = doc.type === 'RECEIPT' || doc.status === 'DRAFT' || (doc.type === 'QUOTE' && doc.status !== 'ACCEPTED');
    if (!deletable || (doc.type === 'INVOICE' && Number(doc.amountPaid) > 0)) {
      throw new BusinessRuleException('Only drafts can be deleted — mark this document as void instead');
    }
    const paidFor = await this.prisma.checkout.count({ where: { documentId: id, status: 'PAID' } });
    if (paidFor) throw new BusinessRuleException('This document was paid for — mark it as void instead');
    await this.prisma.$transaction(async (tx) => {
      if (doc.type === 'RECEIPT' && doc.status !== 'VOID' && doc.sourceId) await this.reverseReceipt(tx, doc);
      await tx.document.delete({ where: { id } });
    });
    return { ok: true };
  }

  /** Back from a stored document to editor input */
  inputOf(doc: DocWithItems): DocumentInputDto {
    return {
      type: doc.type,
      // converted / duplicated documents keep the source's choice about showing the tax number
      showFromTaxId: !!doc.fromTaxId,
      number: doc.number,
      template: doc.template,
      accent: doc.accent,
      currency: doc.currency,
      issueDate: isoOf(doc.issueDate)!,
      dueDate: isoOf(doc.dueDate),
      clientId: doc.clientId,
      clientName: doc.clientName,
      clientEmail: doc.clientEmail,
      clientPhone: doc.clientPhone,
      clientAddress: doc.clientAddress,
      clientTaxId: doc.clientTaxId,
      items: doc.items.map((i) => ({ description: i.description, quantity: i.quantity.toString(), unitPrice: i.unitPrice.toString(), taxRate: i.taxRate.toString() })),
      discount: doc.discount.toString(),
      notes: doc.notes,
      terms: doc.terms,
      paymentInfo: doc.paymentInfo,
    };
  }

  // ───────────────────────── Rendering ─────────────────────────

  async pdf(user: AuthUser, id: string) {
    const [doc, org] = await Promise.all([this.get(user, id), this.org(user)]);
    const watermark = needsWatermark(doc, org);
    const buf = await this.render.pdf(toRenderDoc(doc, { etimsQr: await this.etims.qrFor(doc) }), { watermark });
    return { buf, filename: `${doc.number}.pdf`, watermark };
  }

  async previewStored(user: AuthUser, id: string) {
    const [doc, org] = await Promise.all([this.get(user, id), this.org(user)]);
    return this.render.preview(toRenderDoc(doc, { etimsQr: await this.etims.qrFor(doc) }), { watermark: needsWatermark(doc, org) });
  }

  /** Live preview while editing (nothing is saved) */
  async previewDraft(user: AuthUser, input: PreviewDto) {
    const org = await this.org(user);
    const type = input.type ?? 'INVOICE';
    const stored = input.documentId ? await this.get(user, input.documentId) : null;
    const draft = draftFromInput(input, {
      type,
      number: input.number || stored?.number || (await this.sequences.peek(this.prisma, org, type)),
      currency: input.currency ?? org.currency,
      template: input.template ?? org.defaultTemplate,
      accent: input.accent ?? '#2451d6',
      from: fromOrg(org, input.showFromTaxId !== false),
    });
    let watermark = !hasPaidPlan(org);
    if (watermark && stored?.unlockedHash) {
      // a paid-for document stays clean while its content matches what was paid for,
      // or while it's still in the free-correction window (saving re-signs the unlock)
      if (stored.unlockedHash === contentHash(draft) || (isUnlocked(stored) && inEditWindow(stored))) watermark = false;
    }
    return this.render.preview(toRenderDoc(draft), { watermark });
  }
}
