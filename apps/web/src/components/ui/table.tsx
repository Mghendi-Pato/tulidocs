'use client';

import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from './spinner';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  /** hide below this breakpoint in table mode */
  hideBelow?: 'lg' | 'xl' | '2xl';
}

interface DataTableProps<T> {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  href?: (row: T) => string;
  /** Card layout for phones */
  mobile: (row: T) => ReactNode;
  loading?: boolean;
  empty?: ReactNode;
  className?: string;
}

/**
 * Airy table on desktop, stacked cards on phones.
 * Whole rows are clickable when `href` is given (and keyboard-activatable).
 */
export function DataTable<T>({ rows, columns, rowKey, href, mobile, loading, empty, className }: DataTableProps<T>) {
  const router = useRouter();

  if (loading && !rows) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }
  if (!rows?.length) return <>{empty}</>;

  const hide = (c: Column<T>) =>
    c.hideBelow === 'lg' ? 'hidden lg:table-cell' : c.hideBelow === 'xl' ? 'hidden xl:table-cell' : c.hideBelow === '2xl' ? 'hidden 2xl:table-cell' : '';

  return (
    <div className={cn(loading && 'opacity-60 transition-opacity', className)}>
      {/* Phone: cards */}
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            {href ? (
              <a
                href={href(row)}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(href(row));
                }}
                className="block px-4 py-4 active:bg-hover"
              >
                {mobile(row)}
              </a>
            ) : (
              <div className="px-4 py-4">{mobile(row)}</div>
            )}
          </li>
        ))}
      </ul>

      {/* Tablet/desktop: table */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-line bg-canvas md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-panel">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn('h-12 px-5 text-[13px] font-bold whitespace-nowrap text-ink first:pl-6 last:pr-6', c.align === 'right' && 'text-right', hide(c))}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={href ? () => router.push(href(row)) : undefined}
                onKeyDown={href ? (e) => e.key === 'Enter' && router.push(href(row)) : undefined}
                tabIndex={href ? 0 : undefined}
                className={cn(href && 'cursor-pointer transition-colors hover:bg-sidebar focus-visible:bg-sidebar')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('h-[68px] px-5 text-sm first:pl-6 last:pr-6', c.align === 'right' && 'text-right', hide(c), c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
