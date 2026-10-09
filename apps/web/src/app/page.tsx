'use client';

import { ArrowRight, Check, CreditCard, FileText, Globe2, Percent, Receipt, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PublicFooter, PublicHeader } from '@/components/layout/public-header';
import { ButtonLink } from '@/components/ui/button';
import { Segmented } from '@/components/ui/misc';
import { FeedbackSection } from '@/components/feedback/landing-section';
import { HeroStack } from '@/components/landing/hero-stack';
import { TemplateShowcase } from '@/components/landing/template-showcase';
import { cn } from '@/lib/cn';
import { priceLabel } from '@/lib/format';
import { useMe, usePricing } from '@/lib/queries';
import type { Cycle } from '@/lib/types';

const STEPS = [
  { icon: Sparkles, title: 'Pick a template', body: 'Over twenty designs. Add your logo and brand colour.' },
  { icon: FileText, title: 'Fill in the details', body: 'Your client, items and prices — totals and tax are worked out for you.' },
  { icon: CreditCard, title: 'Download a clean PDF', body: 'Pay once to remove the watermark, or go unlimited with a plan.' },
];

const FEATURES = [
  { icon: Globe2, title: 'Any currency, any country', body: 'Bill in dollars, euros, shillings, rupees or any of 30+ currencies. Your country sets sensible defaults.' },
  { icon: Percent, title: 'Your tax, your wording', body: 'VAT, GST or sales tax per line, with your tax number — VAT No., GSTIN, ABN, EIN, KRA PIN — on every document.' },
  { icon: FileText, title: 'Quotes → invoices → receipts', body: 'Turn an accepted quote into an invoice in one click, then issue receipts as payments come in.' },
  { icon: Users, title: 'Clients and numbering', body: 'Clients are saved as you go. Invoice numbers count up on their own.' },
  { icon: Receipt, title: 'Paid / unpaid at a glance', body: 'See what you’re owed, what’s overdue and what came in this month.' },
  { icon: CreditCard, title: 'Pay the way you like', body: 'Card payments worldwide, plus local options like M-Pesa in Kenya.' },
];

export default function LandingPage() {
  const { data: pricing } = usePricing();
  const { data: me } = useMe();
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const cur = pricing?.currency ?? 'USD';
  const unlock = pricing ? priceLabel(pricing.unlockPrice, cur) : '';
  const starter = pricing?.plans.find((p) => p.id === 'STARTER')?.prices;

  return (
    <div className="min-h-dvh bg-canvas">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[radial-gradient(120%_90%_at_75%_40%,#fbd86a_0%,#f6c445_55%,#efb431_100%)]">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:py-20">
          <div>
            <h1 className="font-display text-[40px] leading-[1.1] font-bold tracking-[-0.02em] sm:text-[54px]">
              Professional invoices
              <br />
              in two minutes.
            </h1>
            <p className="mt-5 max-w-[520px] text-[18px] leading-relaxed text-ink/80">
              Create invoices, quotes and receipts that look the part — in any currency. Start without an account{unlock ? `, pay ${unlock} when you need a clean PDF` : ''}
              {starter ? `, or go unlimited from ${priceLabel(starter.MONTHLY, cur)} a month.` : '.'}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/create/" size="lg" icon={<ArrowRight className="size-[18px]" />} className="flex-row-reverse">
                Create an invoice — free
              </ButtonLink>
              <ButtonLink href="/signup/" size="lg" variant="secondary">
                Create an account
              </ButtonLink>
            </div>
          </div>
          <HeroStack />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
        <h2 className="text-[28px] font-extrabold tracking-[-0.02em]">How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <s.icon className="size-5" />
                </span>
                <span className="text-sm font-bold text-subtle">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 text-[17px] font-bold">{s.title}</h3>
              <p className="mt-1 text-[15px] text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Templates — scroll-driven showcase */}
      <TemplateShowcase />

      {/* Features */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
        <h2 className="text-[28px] font-extrabold tracking-[-0.02em]">More than a template</h2>
        <p className="mt-1 text-[15px] text-muted">Built for small businesses everywhere. With a free account, everything is saved and organised.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card flex gap-4 p-6">
              <f.icon className="size-6 shrink-0 text-primary" strokeWidth={1.8} />
              <div>
                <h3 className="text-[16px] font-bold">{f.title}</h3>
                <p className="mt-1 text-[15px] text-muted">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 border-t border-line bg-sidebar">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
          <h2 className="text-[28px] font-extrabold tracking-[-0.02em]">Simple pricing</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <p className="mt-1 text-[15px] text-muted">
              Just need one invoice? Pay <span className="font-bold text-ink">{unlock}</span> to remove the watermark — no account needed. Prices in {cur}.
            </p>
            <Segmented<Cycle>
              value={cycle}
              onChange={setCycle}
              options={[
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'YEARLY', label: 'Yearly · 2 months free' },
              ]}
              className="shrink-0 self-start sm:self-auto"
            />
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {(pricing?.plans ?? []).map((p) => {
              const featured = p.id === 'STARTER';
              return (
                <div key={p.id} className={cn('card flex flex-col p-6', featured && 'border-2 border-primary')}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold">{p.name}</h3>
                    {featured && <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white">Popular</span>}
                    {!p.available && <span className="rounded-full bg-panel px-2.5 py-1 text-[11px] font-bold text-muted">Coming soon</span>}
                  </div>
                  <p className="text-sm text-muted">{p.tagline}</p>
                  <div className="mt-5">
                    {p.prices ? (
                      <>
                        <span className="text-[34px] font-extrabold tracking-tight tabular">{priceLabel(p.prices[cycle], cur)}</span>
                        <span className="text-sm text-muted"> / {cycle === 'YEARLY' ? 'year' : 'month'}</span>
                        <div className="text-[13px] text-muted">
                          {cycle === 'YEARLY'
                            ? `${priceLabel(Math.round(p.prices.YEARLY / 12), cur)} a month · save ${priceLabel(p.prices.MONTHLY * 12 - p.prices.YEARLY, cur)}`
                            : `or ${priceLabel(p.prices.YEARLY, cur)} a year (2 months free)`}
                        </div>
                      </>
                    ) : (
                      <span className="text-[34px] font-extrabold tracking-tight">Free</span>
                    )}
                  </div>
                  <ul className="mt-5 flex-1 space-y-2.5 text-[14.5px]">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5">
                        <Check className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.6} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <ButtonLink href={p.id === 'FREE' ? '/create/' : me?.organization ? `/billing/?cycle=${cycle}` : `/signup/?cycle=${cycle}`} variant={featured ? 'primary' : 'secondary'} className="mt-6 w-full">
                    {p.id === 'FREE' ? 'Start free' : p.available ? `Get ${p.name}` : 'Create an account'}
                  </ButtonLink>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feedback board — top ideas */}
      <FeedbackSection />

      <PublicFooter />
    </div>
  );
}
