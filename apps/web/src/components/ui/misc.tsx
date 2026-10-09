import Link from 'next/link';
import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import type { Currency, Money as MoneyValue } from '@/lib/types';
import { STATUS_DOT, STATUS_LABEL } from '@/lib/constants';
import type { DocStatus } from '@/lib/types';

export function Money({ value, currency, className, decimals }: { value: MoneyValue | null | undefined; currency?: Currency | string; className?: string; decimals?: boolean }) {
  return <span className={cn('tabular whitespace-nowrap', className)}>{formatMoney(value, currency, { decimals })}</span>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-sm font-semibold text-muted">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, action, padded = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; padded?: boolean }) {
  return (
    <section className={cn('card', className)}>
      {(title || action) && (
        <div className={cn('flex items-center justify-between gap-3', padded ? 'px-5 pt-5 sm:px-6' : 'px-5 pt-5 pb-3 sm:px-6')}>
          {title && <h2 className="section-title">{title}</h2>}
          {action}
        </div>
      )}
      <div className={cn(padded && 'p-5 sm:p-6', padded && (title || action) && 'pt-4 sm:pt-4')}>{children}</div>
    </section>
  );
}

/** Label → value rows, like a settings list. */
export function KeyValue({ items, className }: { items: { label: string; value: ReactNode; hidden?: boolean }[]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-line', className)}>
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <div key={i.label} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="shrink-0 text-sm text-muted">{i.label}</dt>
            <dd className="min-w-0 text-right text-sm font-semibold break-words text-ink">{i.value ?? '—'}</dd>
          </div>
        ))}
    </dl>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-panel text-ink">{icon}</div>}
      <h3 className="text-base font-bold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <h3 className="text-base font-bold">We couldn’t load this</h3>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="link mt-4 text-sm">
          Try again
        </button>
      )}
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <>
      <div className="text-[13px] font-semibold text-muted">{label}</div>
      <div className="mt-2 text-[16px] leading-tight font-extrabold tracking-tight break-words tabular min-[400px]:text-[18px] sm:truncate sm:text-[26px] sm:leading-none max-sm:[&_span]:whitespace-normal">{value}</div>
      {hint && <div className="mt-2 text-[13px] text-muted">{hint}</div>}
    </>
  );
  const cls = 'card block min-w-0 p-4 transition-colors sm:p-5';
  return href ? (
    <Link href={href} className={cn(cls, 'hover:border-line-strong hover:bg-sidebar')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Pill-style segmented control (e.g. Active / Completed / All). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  compact,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  /** tighter padding for long option lists */
  compact?: boolean;
}) {
  return (
    // never shows a scrollbar (it looked untidy); long lists use `compact` or a dropdown on small screens
    <div
      role="tablist"
      className={cn('inline-flex max-w-full overflow-x-auto rounded-full border border-line-strong bg-canvas p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 shrink-0 rounded-full text-[13px] font-bold whitespace-nowrap transition-colors',
            compact ? 'px-3' : 'px-4',
            value === o.value ? 'bg-primary text-white' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (p: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-5 text-sm">
      <span className="text-muted">
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        <button className="h-9 rounded-full border border-line-strong px-4 font-bold disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button className="h-9 rounded-full border border-line-strong px-4 font-bold disabled:opacity-40" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

/** Calm status label: plain text with a small coloured dot */
export function StatusPill({ status, overdue, className }: { status: DocStatus; overdue?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[13px] font-semibold whitespace-nowrap', status === 'VOID' ? 'text-subtle line-through' : 'text-ink-soft', className)}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', overdue ? 'bg-danger' : STATUS_DOT[status])} />
      {overdue ? 'Overdue' : STATUS_LABEL[status]}
    </span>
  );
}
