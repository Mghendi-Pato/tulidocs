import type { ReactNode } from 'react';
import { PublicFooter, PublicHeader } from '@/components/layout/public-header';
import { TocBar, TocSidebar, type TocSection } from './toc';

/** Company contact details used on the legal pages */
export const COMPANY = {
  name: 'Nubian Networks Limited',
  place: 'Nairobi, Kenya',
  email: 'info@nubiannetworks.com',
  phone: '+254 792 017 187',
  whatsapp: 'https://wa.me/254792017187',
};

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 lg:scroll-mt-24">
      <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15.5px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-subtle">
      {items.map((i, n) => (
        <li key={n}>{i}</li>
      ))}
    </ul>
  );
}

export const Mail = () => (
  <a href={`mailto:${COMPANY.email}`} className="link">
    {COMPANY.email}
  </a>
);

export const Phone = () => (
  <a href={COMPANY.whatsapp} target="_blank" rel="noopener noreferrer" className="link">
    {COMPANY.phone}
  </a>
);

/** Page shell for Privacy / Terms: title, intro, a contents guide that follows the reader, and the sections */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
  children,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: TocSection[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      <PublicHeader minimal />
      <main className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 lg:py-14">
        <div className="max-w-[720px]">
          <h1 className="font-display text-[34px] leading-tight font-bold tracking-[-0.02em] sm:text-[42px]">{title}</h1>
          <p className="mt-2 text-[14px] text-muted">Last updated {updated}</p>
          <div className="mt-5 text-[16.5px] leading-relaxed text-ink-soft">{intro}</div>
        </div>
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <TocSidebar sections={sections} />
          </aside>
          <div className="min-w-0 max-w-[720px] space-y-10">
            <TocBar sections={sections} />
            {children}
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
