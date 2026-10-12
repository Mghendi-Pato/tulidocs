import { Injectable } from '@nestjs/common';
import { isoOf } from '../common/dates';
import { AuthUser } from '../common/types';
import { MpesaService } from '../payments/mpesa.service';
import { PaystackService } from '../payments/paystack.service';
import { PrismaService } from '../prisma/prisma.service';
import { FREE_MONTHLY_DOCS, GRACE_DAYS, hasPaidPlan, PLANS, regionFor } from './plans';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mpesa: MpesaService,
    private readonly paystack: PaystackService,
  ) {}

  /** Price list for a country (regional pricing; USD everywhere else) */
  pricing(country?: string | null) {
    const region = regionFor(country);
    return {
      region: region.id,
      country: country ?? null,
      currency: region.currency,
      unlockPrice: region.unlock,
      freeMonthlyDocs: FREE_MONTHLY_DOCS,
      plans: PLANS.map((p) => ({ ...p, prices: p.id === 'FREE' ? null : region.prices[p.id] })),
      providers: region.providers,
      modes: { mpesa: this.mpesa.gateway === 'paystack' ? this.paystack.mode : this.mpesa.mode, card: this.paystack.mode },
      /** 'paystack' → M-Pesa opens in the Paystack window (no phone field on our side) */
      mpesaVia: this.mpesa.gateway,
    };
  }

  async overview(user: AuthUser) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
    const history = await this.prisma.checkout.findMany({
      where: { organizationId: org.id, status: { in: ['PAID', 'FAILED'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, purpose: true, provider: true, status: true, amount: true, currency: true, plan: true, billingCycle: true, receipt: true, createdAt: true, paidAt: true, document: { select: { number: true } } },
    });
    const active = hasPaidPlan(org);
    return {
      ...this.pricing(org.country),
      current: {
        plan: active ? org.plan : 'FREE',
        billingCycle: active ? org.billingCycle : null,
        expiresAt: active ? org.planExpiresAt : null,
        expiredPlan: !active && org.plan !== 'FREE' ? org.plan : null,
        graceDays: GRACE_DAYS,
        renewDate: org.planExpiresAt ? isoOf(org.planExpiresAt) : null,
      },
      history,
    };
  }
}
