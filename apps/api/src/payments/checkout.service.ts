import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingCycle, Checkout, CheckoutProvider, Plan, Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { extendExpiry, hasPaidPlan, planInfo, priceOf, Region, regionFor } from '../billing/plans';
import { BusinessRuleException, NotFound } from '../common/errors';
import { normalizeKenyanPhone } from '../common/phone';
import { contentHash, isUnlocked } from '../documents/document-content';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MpesaService } from './mpesa.service';
import { PaystackService } from './paystack.service';

/** How long an unanswered M-Pesa prompt stays "pending" before we call it failed */
const PENDING_TIMEOUT_MS = 3 * 60_000;

export interface PayWith {
  provider: CheckoutProvider;
  phone?: string | null;
  email?: string | null;
}

/**
 * Money paid to the platform (us): unlocking one document, or a subscription.
 * Providers report back by callback/webhook; `complete()` is idempotent so a callback,
 * a status poll and a webhook can all arrive without double-applying anything.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly mpesa: MpesaService,
    private readonly paystack: PaystackService,
  ) {}

  // ───────────────────────── Start ─────────────────────────

  async startUnlock(input: { documentId: string; organizationId?: string | null; guestToken?: string | null; country?: string | null; pay: PayWith }) {
    const doc = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        ...(input.organizationId ? { organizationId: input.organizationId } : { organizationId: null, guestToken: input.guestToken ?? '__none__' }),
      },
      include: { items: true, organization: { select: { plan: true, planExpiresAt: true, country: true } } },
    });
    if (!doc) throw new NotFound('Document');
    if (doc.organization && hasPaidPlan(doc.organization)) throw new BusinessRuleException('Your plan already includes watermark-free documents');
    if (isUnlocked(doc)) throw new BusinessRuleException('This document is already unlocked', 'ALREADY_UNLOCKED');

    const country = doc.organization?.country ?? input.country ?? null;
    const region = regionFor(country);
    return this.start({
      purpose: 'DOCUMENT_UNLOCK',
      region,
      country,
      amount: region.unlock,
      organizationId: doc.organizationId,
      documentId: doc.id,
      guestToken: input.guestToken ?? null,
      accountRef: doc.number,
      description: 'Invoice unlock',
      pay: { ...input.pay, email: input.pay.email ?? doc.fromEmail },
    });
  }

  async startSubscription(input: { organizationId: string; plan: Plan; cycle: BillingCycle; pay: PayWith }) {
    const info = planInfo(input.plan);
    if (input.plan === 'FREE' || !info.available) throw new BusinessRuleException(`${info.name} isn’t available to buy yet`);
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: input.organizationId }, select: { country: true } });
    const region = regionFor(org.country);
    return this.start({
      purpose: 'SUBSCRIPTION',
      region,
      country: org.country,
      amount: priceOf(region, input.plan, input.cycle),
      organizationId: input.organizationId,
      plan: input.plan,
      billingCycle: input.cycle,
      accountRef: `${info.name}${input.cycle === 'YEARLY' ? 'Year' : 'Month'}`,
      description: `${info.name} plan`,
      pay: input.pay,
    });
  }

  private async start(input: {
    purpose: 'DOCUMENT_UNLOCK' | 'SUBSCRIPTION';
    region: Region;
    country?: string | null;
    amount: number;
    organizationId?: string | null;
    documentId?: string;
    guestToken?: string | null;
    plan?: Plan;
    billingCycle?: BillingCycle;
    accountRef: string;
    description: string;
    pay: PayWith;
  }) {
    const { pay, region } = input;
    if (!region.providers.includes(pay.provider)) {
      throw new BadRequestException({ code: 'PROVIDER_UNAVAILABLE', message: pay.provider === 'MPESA' ? 'M-Pesa is only available in Kenya. Pay by card instead.' : 'This payment method isn’t available here' });
    }
    let phone: string | null = null;
    if (pay.provider === 'MPESA') {
      phone = normalizeKenyanPhone(pay.phone ?? '');
      if (!phone) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Enter a valid Safaricom number, e.g. 0712 345 678' });
    }
    if (pay.provider === 'CARD' && !pay.email) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Enter an email address for the card receipt' });
    }

    const checkout = await this.prisma.checkout.create({
      data: {
        purpose: input.purpose,
        provider: pay.provider,
        amount: input.amount.toString(),
        currency: region.currency,
        country: input.country ?? null,
        organizationId: input.organizationId ?? null,
        documentId: input.documentId ?? null,
        guestToken: input.guestToken ?? null,
        plan: input.plan ?? null,
        billingCycle: input.billingCycle ?? null,
        phone,
        email: pay.email ?? null,
      },
    });

    try {
      if (pay.provider === 'MPESA') {
        const stk = await this.mpesa.stkPush({
          phone: phone!,
          amount: input.amount,
          accountRef: input.accountRef,
          description: input.description,
          callbackUrl: this.mpesaCallbackUrl(),
        });
        await this.prisma.checkout.update({ where: { id: checkout.id }, data: { providerRef: stk.checkoutRequestId } });
        if (this.mpesa.mode === 'mock') this.simulateMpesa(stk.checkoutRequestId, phone!);
        return { checkoutId: checkout.id, provider: pay.provider, status: 'PENDING' as const, message: 'Check your phone and enter your M-Pesa PIN to pay.' };
      }

      // prefix + metadata.product identify tuli payments in a Paystack account shared with other products
      const reference = `tuli_${checkout.id.replace(/-/g, '').slice(0, 16)}_${randomBytes(3).toString('hex')}`;
      const { authorizationUrl } = await this.paystack.initialize({
        email: pay.email!,
        amount: input.amount,
        currency: region.currency,
        reference,
        callbackUrl: `${this.appUrl()}/payment/return/?checkout=${checkout.id}`,
        metadata: { product: 'tuli', checkoutId: checkout.id, purpose: input.purpose },
      });
      await this.prisma.checkout.update({ where: { id: checkout.id }, data: { providerRef: reference } });
      return { checkoutId: checkout.id, provider: pay.provider, status: 'PENDING' as const, authorizationUrl };
    } catch (e) {
      await this.prisma.checkout.update({ where: { id: checkout.id }, data: { status: 'FAILED', failureReason: e instanceof Error ? e.message : 'Could not start payment' } });
      throw e;
    }
  }

  // ───────────────────────── Status ─────────────────────────

  async status(id: string) {
    let c = await this.prisma.checkout.findUnique({ where: { id } });
    if (!c) throw new NotFound('Payment');
    if (c.status === 'PENDING') c = await this.reconcile(c);
    return {
      id: c.id,
      status: c.status,
      purpose: c.purpose,
      provider: c.provider,
      amount: c.amount,
      currency: c.currency,
      documentId: c.documentId,
      plan: c.plan,
      billingCycle: c.billingCycle,
      receipt: c.receipt,
      failureReason: c.failureReason,
      guest: !c.organizationId,
    };
  }

  /** Resolves a pending checkout when the callback/webhook hasn't arrived (lost callbacks happen). */
  private async reconcile(c: Checkout): Promise<Checkout> {
    const age = Date.now() - c.createdAt.getTime();
    if (!c.providerRef) return c;
    // at most one provider lookup every 8 seconds per checkout
    const lock = await this.redis.client.set(this.redis.key(`reconcile:${c.id}`), '1', 'EX', 8, 'NX').catch(() => 'OK');
    if (lock !== 'OK') return c;

    try {
      if (c.provider === 'MPESA' && this.mpesa.mode !== 'mock' && age > 20_000) {
        const r = await this.mpesa.stkQuery(c.providerRef);
        if (!r.pending) {
          if (r.success) return this.complete(c.id, { receipt: c.receipt ?? undefined, raw: r });
          return this.fail(c.id, r.resultDesc || 'Payment was not completed');
        }
      }
      if (c.provider === 'CARD' && this.paystack.mode === 'live') {
        const v = await this.paystack.verify(c.providerRef);
        if (v.status === 'success') {
          if (!this.paidEnough(c, v)) return this.fail(c.id, 'Amount paid does not match');
          return this.complete(c.id, { receipt: c.providerRef, raw: v.raw });
        }
        if (v.status === 'failed' || v.status === 'reversed') return this.fail(c.id, 'The card payment failed');
      }
    } catch (e) {
      this.logger.warn(`Reconcile ${c.id} failed: ${e instanceof Error ? e.message : e}`);
    }
    if (age > PENDING_TIMEOUT_MS && c.provider === 'MPESA') return this.fail(c.id, 'No response from M-Pesa. If money left your account, contact support with your M-Pesa message.');
    return c;
  }

  // ───────────────────────── Finish ─────────────────────────

  /** `paid` (from the provider's own verify API) must cover the checkout's amount, in the same currency. */
  async completeByRef(providerRef: string, data: { receipt?: string; raw?: unknown; paid?: { amount: number; currency: string } }) {
    const c = await this.prisma.checkout.findUnique({ where: { providerRef } });
    if (!c) {
      this.logger.warn(`Payment callback for unknown reference ${providerRef}`);
      return null;
    }
    if (data.paid && !this.paidEnough(c, data.paid)) {
      this.logger.warn(`Checkout ${c.id}: paid ${data.paid.currency} ${data.paid.amount}, expected ${c.currency} ${c.amount}`);
      return this.fail(c.id, 'Amount paid does not match');
    }
    return this.complete(c.id, { receipt: data.receipt, raw: data.raw });
  }

  private paidEnough(c: { amount: unknown; currency: string }, paid: { amount: number; currency: string }) {
    return paid.currency.toUpperCase() === c.currency.toUpperCase() && paid.amount + 0.001 >= Number(c.amount);
  }

  async failByRef(providerRef: string, reason: string) {
    const c = await this.prisma.checkout.findUnique({ where: { providerRef } });
    return c ? this.fail(c.id, reason) : null;
  }

  /** Marks paid and applies what was bought. Safe to call more than once. */
  async complete(id: string, data: { receipt?: string; raw?: unknown }): Promise<Checkout> {
    return this.prisma.$transaction(async (tx) => {
      // claim the row: only one caller moves it from PENDING (or a late success after a timeout) to PAID
      const claimed = await tx.checkout.updateMany({
        where: { id, status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'PAID', paidAt: new Date(), receipt: data.receipt ?? undefined, failureReason: null, raw: (data.raw ?? undefined) as Prisma.InputJsonValue | undefined },
      });
      const c = await tx.checkout.findUniqueOrThrow({ where: { id } });
      if (!claimed.count) return c;

      if (c.purpose === 'DOCUMENT_UNLOCK' && c.documentId) {
        const doc = await tx.document.findUnique({ where: { id: c.documentId }, include: { items: true } });
        if (doc) await tx.document.update({ where: { id: doc.id }, data: { unlockedAt: new Date(), unlockedHash: contentHash(doc) } });
      }
      if (c.purpose === 'SUBSCRIPTION' && c.organizationId && c.plan && c.billingCycle) {
        const org = await tx.organization.findUniqueOrThrow({ where: { id: c.organizationId } });
        const same = org.plan === c.plan && hasPaidPlan(org);
        await tx.organization.update({
          where: { id: org.id },
          data: { plan: c.plan, billingCycle: c.billingCycle, planExpiresAt: extendExpiry(org.planExpiresAt, same, c.billingCycle) },
        });
      }
      this.logger.log(`Checkout ${id} paid (${c.purpose}, ${c.currency} ${c.amount})`);
      return c;
    });
  }

  async fail(id: string, reason: string): Promise<Checkout> {
    await this.prisma.checkout.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'FAILED', failureReason: reason.slice(0, 300) } });
    return this.prisma.checkout.findUniqueOrThrow({ where: { id } });
  }

  // ───────────────────────── Helpers ─────────────────────────

  private appUrl() {
    return this.config.get<string>('APP_URL', 'http://localhost:3000').replace(/\/$/, '');
  }

  mpesaCallbackUrl() {
    const base = this.config.get<string>('API_PUBLIC_URL', 'http://localhost:3000/api').replace(/\/$/, '');
    return `${base}/payments/mpesa/callback/${this.config.get<string>('MPESA_CALLBACK_SECRET', 'dev')}`;
  }

  /** Dev only: pretend the customer typed their PIN. Numbers ending in 000 simulate a cancelled prompt. */
  private simulateMpesa(ref: string, phone: string) {
    setTimeout(() => {
      const fail = phone.endsWith('000');
      const job = fail
        ? this.failByRef(ref, 'Request cancelled by user')
        : this.completeByRef(ref, { receipt: `MOCK${randomBytes(4).toString('hex').toUpperCase()}`, raw: { mock: true } });
      job.catch((e: Error) => this.logger.warn(`Mock M-Pesa failed: ${e.message}`));
    }, 5000).unref();
  }
}
