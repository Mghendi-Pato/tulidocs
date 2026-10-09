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
export function extendExpiry(current: Date | null, samePlan: boolean, cycle: BillingCycle, now = new Date()): Date {
  const start = samePlan && current && current > now ? new Date(current) : new Date(now);
  if (cycle === 'YEARLY') start.setFullYear(start.getFullYear() + 1);
  else start.setMonth(start.getMonth() + 1);
  return start;
}
