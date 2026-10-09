'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, ImageOff, Minimize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, errorMessage } from '@/lib/api';
import { TEMPLATES } from '@/lib/constants';
import { cleanNumber } from '@/lib/format';
import type { DocInput } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Spinner } from '../ui/spinner';

/** Makes half-filled forms previewable: placeholders for empty required bits, numbers cleaned. */
export function previewPayload(input: DocInput, extra: Record<string, unknown> = {}) {
  const num = (v: string) => {
    const c = cleanNumber(v || '');
    return /^-?\d+(\.\d+)?$/.test(c) ? c : '0';
  };
  const items = input.items.length ? input.items : [{ description: '', quantity: '1', unitPrice: '0', taxRate: '0' }];
  const { country: _c, ...rest } = input;
  return {
    ...rest,
    ...extra,
    clientName: input.clientName.trim() || 'Client name',
    items: items.map((i) => ({ description: i.description.trim() || 'Item description', quantity: num(i.quantity), unitPrice: num(i.unitPrice), taxRate: num(i.taxRate) })),
    discount: num(input.discount),
    issueDate: input.issueDate || new Date().toISOString().slice(0, 10),
  };
}

const tplIndex = (id?: string) => Math.max(0, TEMPLATES.findIndex((t) => t.id === id));

/**
 * Live preview rendered on the server (JPEG). The watermark is baked into the image,
 * so it can't be removed in the browser. Switching template slides the new sheet in
 * horizontally; ordinary edits just swap the image in place.
 */
export function PreviewPane({
  path,
  payload,
  version = '',
  className,
  fullscreen = false,
  onExitFullscreen,
}: {
  path: string;
  payload: unknown;
  version?: string;
  className?: string;
  /** Show the sheet over the whole screen (same instance, so no re-render of the image) */
  fullscreen?: boolean;
  onExitFullscreen?: () => void;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<{ url: string; tpl: string } | null>(null);
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(payload);
  const tpl = (payload as { template?: string })?.template ?? '';
  const shownTpl = useRef<string | null>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    // a template switch should feel instant; typing waits for a pause
    const delay = shownTpl.current && shownTpl.current !== tpl ? 120 : 650;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const blob = await api.blobPost(path, JSON.parse(key), ctrl.signal);
        const next = URL.createObjectURL(blob);
        urls.current.push(next);
        // keep the outgoing image alive while it animates away, then free older ones
        while (urls.current.length > 3) URL.revokeObjectURL(urls.current.shift()!);
        if (shownTpl.current && shownTpl.current !== tpl) setDir(tplIndex(tpl) >= tplIndex(shownTpl.current) ? 1 : -1);
        shownTpl.current = tpl;
        setShown({ url: next, tpl });
        setError(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError(errorMessage(e));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, delay);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, version]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Full screen: lock page scroll, Esc closes
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onExitFullscreen?.();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen, onExitFullscreen]);

  // simple horizontal slide: next template comes in from the right, previous from the left
  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { x: d > 0 ? '100%' : '-100%' }),
    center: { x: '0%', opacity: 1 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { x: d > 0 ? '-100%' : '100%' }),
  };

  const sheet = (
    <div className={cn('relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-panel', fullscreen ? 'mx-auto w-full max-w-[960px] shadow-2xl' : className)}>
      <div className="relative aspect-[794/1123]">
        {shown ? (
          <AnimatePresence initial={false} custom={dir}>
            <motion.div
              key={shown.tpl}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduce ? { duration: 0.2 } : { duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shown.url}
                alt="Document preview"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className={cn('block h-full w-full bg-white object-cover select-none transition-opacity', loading && 'opacity-70')}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-subtle">{error ? <ImageOff className="size-8" /> : <Spinner className="size-7" />}</div>
        )}
      </div>
      {loading && shown && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-2 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-semibold text-white">
          <Spinner className="size-3.5" /> Updating
        </span>
      )}
      {error && (
        <div role="alert" className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-[13px] font-semibold text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );

  if (!fullscreen) return sheet;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Document preview" className="fixed inset-0 z-[60] flex flex-col bg-ink/90 backdrop-blur-sm">
      <div className="flex h-14 shrink-0 items-center justify-between px-4 text-white sm:px-6">
        <span className="text-sm font-bold text-white/80">Preview</span>
        <button
          type="button"
          onClick={onExitFullscreen}
          autoFocus
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-bold text-white transition-colors hover:bg-white/20 focus-visible:ring-4 focus-visible:ring-white/30"
        >
          <Minimize2 className="size-4" /> Exit full screen
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 sm:px-6" onClick={(e) => e.target === e.currentTarget && onExitFullscreen?.()}>
        {sheet}
      </div>
    </div>,
    document.body,
  );
}
