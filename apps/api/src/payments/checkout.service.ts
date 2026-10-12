import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingCycle, Checkout, CheckoutProvider, Plan, Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { changeKind, hasPaidPlan, minCharge, roundCharge, subscriptionPeriod, unusedCredit, planInfo, priceOf, Region, regionFor } from '../billing/plans';
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

  /**
   * What a plan purchase costs right now. Upgrades (monthly → yearly, or a higher plan) credit the unused part
   * of what's already been paid, so the business only tops up the difference; the new period starts today.
   */
  async quoteSubscription(organizationId: string, plan: Plan, cycle: BillingCycle, now = new Date()) {
    const info = planInfo(plan);
    if (plan === 'FREE' || !info.available) throw new BusinessRuleException(`${info.name} isn’t available to buy yet`);
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { country: true, plan: true, planExpiresAt: true, billingCycle: true },
    });
    const region = regionFor(org.country);
    const price = priceOf(region, plan, cycle);
    const kind = changeKind(org, plan, cycle, now);
    if (kind === 'blocked') {
      throw new BusinessRuleException(`You’re on ${planInfo(org.plan).name} until ${org.planExpiresAt!.toISOString().slice(0, 10)} — you can switch to ${info.name} after that.`);
    }

    let credit = 0;
    let creditUntil: Date | null = null;
    if (kind === 'upgrade') {
      const paid = await this.prisma.checkout.findMany({
        where: { organizationId, purpose: 'SUBSCRIPTION', status: 'PAID', periodEnd: { gt: now } },
        select: { amount: true, currency: true, periodStart: true, periodEnd: true },
      });
      const u = unusedCredit(paid.map((p) => ({ ...p, amount: Number(p.amount) })), region.currency, now);
      credit = u.credit;
      creditUntil = u.until;
    }
    const amount = roundCharge(Math.max(0, price - credit), region.currency);
    if (kind === 'upgrade' && amount < minCharge(region.currency)) {
      throw new BusinessRuleException('Your paid time is already worth more than this plan — no top-up needed. You can upgrade once it runs lower.');
    }
    const period =
      kind === 'upgrade' ? subscriptionPeriod(null, false, cycle, now) : subscriptionPeriod(org.planExpiresAt, kind === 'extend', cycle, now);
    return {
      kind,
      plan,
      cycle,
      currency: region.currency,
      price,
      credit,
      /** paid time the credit covers (ends when the current plan would have ended) */
      creditDays: creditUntil ? Math.ceil((creditUntil.getTime() - now.getTime()) / 86_400_000) : 0,
      amount,
      periodStart: period.start,
      periodEnd: period.end,
    };
  }

  async startSubscription(input: { organizationId: string; plan: Plan; cycle: BillingCycle; pay: PayWith }) {
    const info = planInfo(input.plan);
    const q = await this.quoteSubscription(input.organizationId, input.plan, input.cycle);
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: input.organizationId }, select: { country: true } });
    const region = regionFor(org.country);
    return this.start({
      purpose: 'SUBSCRIPTION',
      region,
      country: org.country,
      amount: q.amount,
      organizationId: input.organizationId,
      plan: input.plan,
      billingCycle: input.cycle,
      upgrade: q.kind === 'upgrade' ? { credit: q.credit } : undefined,
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
    /** set when this purchase upgrades an active plan (unused time credited) */
    upgrade?: { credit: number };
    accountRef: string;
    description: string;
    pay: PayWith;
  }) {
    const { pay, region } = input;
    if (!region.providers.includes(pay.provider)) {
      throw new BadRequestException({ code: 'PROVIDER_UNAVAILABLE', message: pay.provider === 'MPESA' ? 'M-Pesa is only available in Kenya. Pay by card instead.' : 'This payment method isn’t available here' });
    }
    // M-Pesa through Paystack: the customer enters their number in Paystack's window, so no phone needed here
    const viaPaystack = pay.provider === 'CARD' || this.mpesa.gateway === 'paystack';
    let phone: string | null = null;
    if (pay.provider === 'MPESA') {
      phone = normalizeKenyanPhone(pay.phone ?? '');
      if (!phone && !viaPaystack) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Enter a valid Safaricom number, e.g. 0712 345 678' });
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
        isUpgrade: !!input.upgrade,
        credit: input.upgrade ? input.upgrade.credit.toString() : null,
        phone,
        email: pay.email ?? null,
      },
    });

    try {
      if (pay.provider === 'MPESA' && !viaPaystack) {
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
      const { authorizationUrl, accessCode } = await this.paystack.initialize({
        // Paystack needs an email; M-Pesa guests don't give one, so use a per-checkout placeholder
        email: pay.email || `mpesa-${checkout.id.slice(0, 8)}@customers.tulidocs.com`,
        channels: pay.provider === 'MPESA' ? ['mobile_money'] : ['card'],
        amount: input.amount,
        currency: region.currency,
        reference,
        callbackUrl: `${this.appUrl()}/payment/return/?checkout=${checkout.id}`,
        metadata: { product: 'tuli', checkoutId: checkout.id, purpose: input.purpose, method: pay.provider },
      });
      await this.prisma.checkout.update({ where: { id: checkout.id }, data: { providerRef: reference } });
      // accessCode → in-page popup; authorizationUrl → redirect fallback (and mock mode)
      return { checkoutId: checkout.id, provider: pay.provider, status: 'PENDING' as const, authorizationUrl, accessCode };
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
      const paystackRef = PaystackService.isPaystackRef(c.providerRef);
      if (c.provider === 'MPESA' && !paystackRef && this.mpesa.mode !== 'mock' && age > 20_000) {
        const r = await this.mpesa.stkQuery(c.providerRef);
        if (!r.pending) {
          if (r.success) return this.complete(c.id, { receipt: c.receipt ?? undefined, raw: r });
          return this.fail(c.id, r.resultDesc || 'Payment was not completed');
        }
      }
      if (paystackRef && this.paystack.mode === 'live') {
        const v = await this.paystack.verify(c.providerRef);
        if (v.status === 'success') {
          if (!this.paidEnough(c, v)) return this.fail(c.id, 'Amount paid does not match');
          return this.complete(c.id, { receipt: c.providerRef, raw: v.raw });
        }
        if (v.status === 'failed' || v.status === 'reversed') return this.fail(c.id, c.provider === 'MPESA' ? 'The M-Pesa payment failed' : 'The card payment failed');
      }
    } catch (e) {
      this.logger.warn(`Reconcile ${c.id} failed: ${e instanceof Error ? e.message : e}`);
    }
    if (age > PENDING_TIMEOUT_MS && c.provider === 'MPESA' && !PaystackService.isPaystackRef(c.providerRef)) return this.fail(c.id, 'No response from M-Pesa. If money left your account, contact support with your M-Pesa message.');
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
        const now = new Date();
        // upgrade: the credited time is replaced by the new period, which starts now
        const period = c.isUpgrade ? subscriptionPeriod(null, false, c.billingCycle, now) : subscriptionPeriod(org.planExpiresAt, same, c.billingCycle, now);
        if (c.isUpgrade) {
          const earlier = await tx.checkout.findMany({
            where: { organizationId: org.id, purpose: 'SUBSCRIPTION', status: 'PAID', id: { not: c.id }, periodEnd: { gt: now } },
            select: { id: true, periodStart: true },
          });
          for (const e of earlier) {
            // running period ends today; ones that hadn't started become zero-length ("credited")
            const end = e.periodStart && e.periodStart > now ? e.periodStart : now;
            await tx.checkout.update({ where: { id: e.id }, data: { periodEnd: end } });
          }
        }
        await tx.organization.update({
          where: { id: org.id },
          data: { plan: c.plan, billingCycle: c.billingCycle, planExpiresAt: period.end },
        });
        await tx.checkout.update({ where: { id: c.id }, data: { periodStart: period.start, periodEnd: period.end } });
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
