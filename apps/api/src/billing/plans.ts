import type { BillingCycle, CheckoutProvider, Organization, Plan } from '@prisma/client';

/** FREE accounts can create this many documents per calendar month. */
export const FREE_MONTHLY_DOCS = 10;

/** After a paid unlock, edits within this window keep the document unlocked (typo fixes). */
export const UNLOCK_EDIT_WINDOW_HOURS = 24;

/** Days of grace after a subscription ends before the watermark comes back. */
export const GRACE_DAYS = 3;

/**
 * Regional pricing. Everyone outside a listed region pays the GLOBAL (USD) prices by card.
 * Add a region here to localise prices and payment methods for another market.
 */
export interface Region {
  id: string;
  currency: string;
  /** one-off price to remove the watermark from one document */
  unlock: number;
  prices: Record<'STARTER' | 'PRO', Record<BillingCycle, number>>;
  providers: CheckoutProvider[];
}

export const REGIONS: Record<string, Region> = {
  GLOBAL: { id: 'GLOBAL', currency: 'USD', unlock: 2, prices: { STARTER: { MONTHLY: 5, YEARLY: 50 }, PRO: { MONTHLY: 12, YEARLY: 120 } }, providers: ['CARD'] },
  KE: { id: 'KE', currency: 'KES', unlock: 100, prices: { STARTER: { MONTHLY: 300, YEARLY: 3000 }, PRO: { MONTHLY: 800, YEARLY: 8000 } }, providers: ['MPESA', 'CARD'] },
};

export function regionFor(country?: string | null): Region {
  return REGIONS[(country ?? '').toUpperCase()] ?? REGIONS.GLOBAL;
}

export interface PlanInfo {
  id: Plan;
  name: string;
  tagline: string;
  features: string[];
  /** false = shown but can't be bought yet */
  available: boolean;
}

export const PLANS: PlanInfo[] = [
  {
    id: 'FREE',
    name: 'Free',
    tagline: 'Try it out',
    features: [`${FREE_MONTHLY_DOCS} documents a month`, 'All templates, any currency', 'Watermarked PDFs', 'Remove a watermark per document'],
    available: true,
  },
  {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'For freelancers and small businesses',
    features: ['Unlimited invoices, quotes and receipts', 'No watermark', 'All templates, your logo', 'Client list and auto-numbering', 'Paid / unpaid tracking'],
    available: true,
  },
  {
    id: 'PRO',
    name: 'Pro',
    tagline: 'For growing teams',
    features: ['Everything in Starter', 'AI chat editing — change your document in real time just by asking (coming soon)', 'Send by email and WhatsApp (coming soon)', 'Payment reminders (coming soon)', 'Tax e-invoicing, e.g. KRA eTIMS (coming soon)'],
    available: false,
  },
];

export const planInfo = (id: Plan) => PLANS.find((p) => p.id === id)!;

export function priceOf(region: Region, plan: Plan, cycle: BillingCycle): number {
  if (plan === 'FREE') throw new Error('The Free plan is not for sale');
  return region.prices[plan][cycle];
}

/** A paid plan that hasn't ended (with a short grace period). */
export function hasPaidPlan(org: Pick<Organization, 'plan' | 'planExpiresAt'>, now = new Date()): boolean {
  if (org.plan === 'FREE' || !org.planExpiresAt) return false;
  return org.planExpiresAt.getTime() + GRACE_DAYS * 86_400_000 > now.getTime();
}

/** New expiry when paying for `cycle`: extends an active plan, otherwise starts now. */
/** The period a subscription payment buys: starts when the current plan ends (same plan, still active) or now. */
export function subscriptionPeriod(current: Date | null, samePlan: boolean, cycle: BillingCycle, now = new Date()): { start: Date; end: Date } {
  const start = samePlan && current && current > now ? new Date(current) : new Date(now);
  const end = new Date(start);
  if (cycle === 'YEARLY') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return { start, end };
}

export function extendExpiry(current: Date | null, samePlan: boolean, cycle: BillingCycle, now = new Date()): Date {
  return subscriptionPeriod(current, samePlan, cycle, now).end;
}

const TIER: Record<Plan, number> = { FREE: 0, STARTER: 1, PRO: 2 };

/**
 * What buying `plan`/`cycle` means for a business today:
 *  - new:     no active paid plan → a fresh period from now
 *  - extend:  same plan and cycle (or a shorter cycle) → stacks after the current end date
 *  - upgrade: higher plan, or monthly → yearly → unused paid time is credited and the new period starts now
 *  - blocked: a lower plan while a higher one is active
 */
export function changeKind(
  org: Pick<Organization, 'plan' | 'planExpiresAt' | 'billingCycle'>,
  plan: Plan,
  cycle: BillingCycle,
  now = new Date(),
): 'new' | 'extend' | 'upgrade' | 'blocked' {
  const active = org.plan !== 'FREE' && !!org.planExpiresAt && org.planExpiresAt > now;
  if (!active) return 'new';
  if (TIER[plan] < TIER[org.plan]) return 'blocked';
  if (TIER[plan] > TIER[org.plan]) return 'upgrade';
  if (org.billingCycle === 'MONTHLY' && cycle === 'YEARLY') return 'upgrade';
  return 'extend';
}

/** Value of paid time not yet used: each paid period's price × the share of it still ahead of `now`. */
export function unusedCredit(
  periods: { amount: number; currency: string; periodStart: Date | null; periodEnd: Date | null }[],
  currency: string,
  now = new Date(),
): { credit: number; until: Date | null } {
  let credit = 0;
  let until: Date | null = null;
  for (const p of periods) {
    if (!p.periodStart || !p.periodEnd || p.currency !== currency || p.periodEnd <= now) continue;
    const total = p.periodEnd.getTime() - p.periodStart.getTime();
    if (total <= 0) continue;
    const left = p.periodEnd.getTime() - Math.max(now.getTime(), p.periodStart.getTime());
    credit += p.amount * (left / total);
    if (!until || p.periodEnd > until) until = p.periodEnd;
  }
  return { credit: Math.floor(credit * 100) / 100, until };
}

/** Smallest charge we ask for (card / M-Pesa minimums, and not worth a payment below this) */
export function minCharge(currency: string) {
  return currency === 'KES' ? 10 : 1;
}

/** KES is charged in whole shillings (M-Pesa); other currencies to the cent */
export function roundCharge(amount: number, currency: string) {
  return currency === 'KES' ? Math.ceil(amount) : Math.ceil(amount * 100) / 100;
}
