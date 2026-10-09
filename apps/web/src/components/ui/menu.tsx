'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/** Lightweight dropdown menu with keyboard + outside-click handling. */
export function Menu({ trigger, items, align = 'right', header }: { trigger: (props: { onClick: () => void; 'aria-expanded': boolean }) => ReactNode; items: MenuItem[]; align?: 'left' | 'right'; header?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  // Keep the menu on screen: nudge it sideways if it would spill past either edge (e.g. on phones).
  // Re-checked on resize — mobile browsers resize when the address bar hides while scrolling.
  useLayoutEffect(() => {
    if (!open) return setShift(0);
    const fit = () => {
      const el = menuRef.current;
      if (!el) return;
      // Measure where the menu sits without the current nudge, then nudge from there
      const prev = Number(el.dataset.shift || 0);
      const r = el.getBoundingClientRect();
      const left = r.left - prev;
      const right = r.right - prev;
      const gap = 8;
      const vw = document.documentElement.clientWidth;
      const dx = left < gap ? gap - left : right > vw - gap ? vw - gap - right : 0;
      el.dataset.shift = String(dx);
      setShift(dx);
    };
    fit();
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus());
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = items.filter((i) => !i.hidden);

  return (
    <div className="relative" ref={ref}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open })}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
          className={cn('absolute z-40 mt-2 max-w-[calc(100vw-16px)] min-w-56 overflow-hidden rounded-2xl border border-line bg-canvas p-1.5 shadow-[var(--shadow-pop)]', align === 'right' ? 'right-0' : 'left-0')}
          onKeyDown={(e) => {
            const els = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
            const i = els.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              els[(i + 1) % els.length]?.focus();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              els[(i - 1 + els.length) % els.length]?.focus();
            }
          }}
        >
          {header}
          {visible.map((item) => (
            <button
              type="button"
              key={item.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold outline-none hover:bg-hover focus:bg-hover',
                item.danger ? 'text-danger' : 'text-ink',
              )}
            >
              {item.icon && <span className="text-muted [&>svg]:size-[18px]">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
