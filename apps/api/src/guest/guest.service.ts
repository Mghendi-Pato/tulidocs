import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { isoOf } from '../common/dates';
import { BusinessRuleException, NotFound } from '../common/errors';
import { buildContent, contentHash, DocWithItems, draftFromInput, inEditWindow, isUnlocked, needsWatermark, serializeDoc, toRenderDoc } from '../documents/document-content';
import { DocumentInputDto, PreviewDto } from '../documents/dto/document.dto';
import { PrismaService } from '../prisma/prisma.service';
import { RenderService } from '../render/render.service';
import { SequencesService } from '../sequences/sequences.service';

const MAX_GUEST_DOCS = 30;
const withItems = { items: { orderBy: { position: 'asc' } }, source: { select: { number: true } } } satisfies Prisma.DocumentInclude;

export const newGuestToken = () => randomBytes(32).toString('base64url');

/**
 * The no-sign-up invoice builder. Guest documents belong to a random token kept in an
 * httpOnly cookie on that browser. They print with a watermark until unlocked (paid),
 * and move into the business when the guest creates an account.
 */
@Injectable()
export class GuestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GuestService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly render: RenderService,
    private readonly sequences: SequencesService,
  ) {}

  private requireSender(input: DocumentInputDto) {
    if (!input.fromName?.trim()) throw new BusinessRuleException('Enter your business name', 'VALIDATION_ERROR');
  }

  async get(token: string | null, id: string): Promise<DocWithItems> {
    if (!token) throw new NotFound('Document');
    const doc = await this.prisma.document.findFirst({ where: { id, guestToken: token, organizationId: null }, include: withItems });
    if (!doc) throw new NotFound('Document');
    return doc;
  }

  serialize(doc: DocWithItems) {
    return serializeDoc(doc, { watermark: needsWatermark(doc), editWindowOpen: inEditWindow(doc) });
  }

  async list(token: string | null) {
    if (!token) return [];
    const rows = await this.prisma.document.findMany({
      where: { guestToken: token, organizationId: null },
      orderBy: { updatedAt: 'desc' },
      take: MAX_GUEST_DOCS,
      include: withItems,
    });
    return rows.map((d) => ({
      id: d.id,
      type: d.type,
      number: d.number,
      clientName: d.clientName,
      total: d.total,
      currency: d.currency,
      issueDate: isoOf(d.issueDate),
      template: d.template,
      unlocked: isUnlocked(d),
      updatedAt: d.updatedAt,
    }));
  }

  private data(input: DocumentInputDto) {
    const { data, items } = buildContent(input);
    return {
      data: {
        ...data,
        type: input.type ?? 'INVOICE',
        number: input.number || 'INV-001',
        template: input.template ?? 'classic',
        accent: input.accent ?? '#2451d6',
        currency: input.currency ?? 'USD',
        fromName: input.fromName!.trim(),
        fromEmail: input.fromEmail ?? null,
        fromPhone: input.fromPhone ?? null,
        fromAddress: input.fromAddress ?? null,
        fromTaxId: input.showFromTaxId === false ? null : (input.fromTaxId ?? null),
        fromLogo: input.fromLogo ?? null,
        taxName: input.taxName || 'Tax',
        taxIdLabel: input.taxIdLabel || 'Tax ID',
      },
      items,
    };
  }

  async create(token: string, input: DocumentInputDto) {
    this.requireSender(input);
    const count = await this.prisma.document.count({ where: { guestToken: token, organizationId: null } });
    if (count >= MAX_GUEST_DOCS) {
      throw new BusinessRuleException('You’ve reached the limit for documents without an account. Create a free account to keep going.', 'GUEST_LIMIT');
    }
    const { data, items } = this.data(input);
    const doc = await this.prisma.document.create({
      data: { ...data, status: data.type === 'RECEIPT' ? 'PAID' : 'DRAFT', guestToken: token, items: { create: items } },
      include: withItems,
    });
    return this.serialize(doc);
  }

  async update(token: string | null, id: string, input: DocumentInputDto) {
    this.requireSender(input);
    const existing = await this.get(token, id);
    const wasUnlocked = isUnlocked(existing);
    const { data, items } = this.data(input);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.documentItem.deleteMany({ where: { documentId: id } });
      const doc = await tx.document.update({ where: { id }, data: { ...data, items: { create: items } }, include: withItems });
      if (wasUnlocked && inEditWindow(existing)) {
        return tx.document.update({ where: { id }, data: { unlockedHash: contentHash(doc) }, include: withItems });
      }
      return doc;
    });
    return this.serialize(updated);
  }

  async setTemplate(token: string | null, id: string, template: string, accent?: string) {
    await this.get(token, id);
    const doc = await this.prisma.document.update({ where: { id }, data: { template, ...(accent ? { accent } : {}) }, include: withItems });
    return this.serialize(doc);
  }

  async remove(token: string | null, id: string) {
    const doc = await this.get(token, id);
    if (doc.unlockedAt) throw new BusinessRuleException('This document was paid for, so it’s kept. Create an account to manage it.');
    await this.prisma.document.delete({ where: { id } });
    return { ok: true };
  }

  async preview(token: string | null, input: PreviewDto) {
    const stored = input.documentId && token ? await this.get(token, input.documentId).catch(() => null) : null;
    const draft = draftFromInput(input, {
      type: input.type ?? 'INVOICE',
      number: input.number || 'INV-001',
      currency: input.currency ?? 'USD',
      template: input.template ?? 'classic',
      accent: input.accent ?? '#2451d6',
      from: {
        fromName: input.fromName?.trim() || 'Your Business',
        fromEmail: input.fromEmail ?? null,
        fromPhone: input.fromPhone ?? null,
        fromAddress: input.fromAddress ?? null,
        fromTaxId: input.showFromTaxId === false ? null : (input.fromTaxId ?? null),
        fromLogo: input.fromLogo ?? null,
        taxName: input.taxName || 'Tax',
        taxIdLabel: input.taxIdLabel || 'Tax ID',
      },
    });
    let watermark = true;
    if (stored?.unlockedHash && (stored.unlockedHash === contentHash(draft) || (isUnlocked(stored) && inEditWindow(stored)))) watermark = false;
    return this.render.preview(toRenderDoc(draft), { watermark });
  }

  async pdf(token: string | null, id: string) {
    const doc = await this.get(token, id);
    const watermark = needsWatermark(doc);
    const buf = await this.render.pdf(toRenderDoc(doc), { watermark });
    return { buf, filename: `${doc.number}.pdf`, watermark };
  }

  /**
   * Moves this browser's guest documents into a business (after sign-up / sign-in).
   * Numbers that clash with the business's own get the next free number.
   * Empty business details are filled from the guest's latest document.
   */
  async claim(token: string | null, organizationId: string): Promise<number> {
    if (!token) return 0;
    const docs = await this.prisma.document.findMany({ where: { guestToken: token, organizationId: null }, orderBy: { createdAt: 'asc' }, include: withItems });
    if (!docs.length) return 0;
    await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
      const latest = docs[docs.length - 1];
      await tx.organization.update({
        where: { id: org.id },
        data: {
          email: org.email ?? latest.fromEmail,
          phone: org.phone ?? latest.fromPhone,
          address: org.address ?? latest.fromAddress,
          taxId: org.taxId ?? latest.fromTaxId,
          logo: org.logo ?? latest.fromLogo,
        },
      });
      for (const doc of docs) {
        const clash = await tx.document.findFirst({ where: { organizationId: org.id, type: doc.type, number: doc.number }, select: { id: true } });
        const number = clash ? await this.sequences.next(tx, org, doc.type) : doc.number;
        let client = await tx.client.findFirst({ where: { organizationId: org.id, name: { equals: doc.clientName, mode: 'insensitive' } }, select: { id: true } });
        client ??= await tx.client.create({
          data: { organizationId: org.id, name: doc.clientName, email: doc.clientEmail, phone: doc.clientPhone, address: doc.clientAddress, taxId: doc.clientTaxId },
          select: { id: true },
        });
        const moved = await tx.document.update({
          where: { id: doc.id },
          data: { organizationId: org.id, guestToken: null, number, clientId: client.id },
          include: withItems,
        });
        // a renumbered paid document keeps its unlock
        if (doc.unlockedHash && doc.unlockedHash === contentHash(doc) && number !== doc.number) {
          await tx.document.update({ where: { id: doc.id }, data: { unlockedHash: contentHash(moved) } });
        }
      }
      await tx.checkout.updateMany({ where: { guestToken: token, organizationId: null }, data: { organizationId: org.id } });
    });
    this.logger.log(`Claimed ${docs.length} guest document(s) into ${organizationId}`);
    return docs.length;
  }

  // ── Housekeeping: unpaid guest drafts expire after 30 days, paid ones after a year ──
  onModuleInit() {
    const run = () =>
      this.cleanup().catch((e: Error) => this.logger.warn(`Guest cleanup failed: ${e.message}`));
    this.timer = setInterval(run, 6 * 3_600_000);
    this.timer.unref();
    setTimeout(run, 60_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async cleanup() {
    const day = 86_400_000;
    const { count } = await this.prisma.document.deleteMany({
      where: {
        organizationId: null,
        OR: [
          { unlockedAt: null, updatedAt: { lt: new Date(Date.now() - 30 * day) } },
          { unlockedAt: { lt: new Date(Date.now() - 365 * day) } },
        ],
      },
    });
    if (count) this.logger.log(`Removed ${count} expired guest document(s)`);
  }
}
