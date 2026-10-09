'use client';

import { AlertTriangle, HelpCircle, LogOut } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Button } from './button';

export type ConfirmTone = 'danger' | 'primary' | 'logout';

const ICON: Record<ConfirmTone, ReactNode> = {
  danger: <AlertTriangle className="size-5" />,
  primary: <HelpCircle className="size-5" />,
  logout: <LogOut className="size-5" />,
};

const ICON_BG: Record<ConfirmTone, string> = {
  danger: 'bg-danger-soft text-danger',
  primary: 'bg-primary-soft text-primary',
  logout: 'bg-primary-soft text-primary',
};

/**
 * Confirmation modal: "do it" or "go back".
 * Esc / backdrop / Cancel all go back; focus starts on Cancel so Enter never confirms by accident.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  cancelLabel = 'Go back',
  tone = 'danger',
  loading,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const cancelBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancelRef.current();
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => cancelBtn.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => !loading && onCancel()} aria-hidden="true" />
      <div className="relative w-full max-w-[400px] rounded-[20px] bg-canvas p-6 shadow-[var(--shadow-pop)] sm:p-7">
        <span className={cn('mb-4 flex size-11 items-center justify-center rounded-full', ICON_BG[tone])}>{ICON[tone]}</span>
        <h2 id="confirm-title" className="text-lg font-extrabold tracking-tight">
          {title}
        </h2>
        {body && <div className="mt-2 text-sm leading-relaxed text-muted">{body}</div>}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelBtn} variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Promise-based confirm for one-line use anywhere ─────────────────────────

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Runs while the dialog shows a spinner; the dialog closes when it settles. */
  action?: () => Promise<unknown>;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [loading, setLoading] = useState(false);

  const confirm = useCallback<ConfirmFn>((opts) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })), []);

  const close = (result: boolean) => {
    state?.resolve(result);
    setState(null);
    setLoading(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!state}
        title={state?.title ?? ''}
        body={state?.body}
        confirmLabel={state?.confirmLabel ?? 'Confirm'}
        cancelLabel={state?.cancelLabel ?? 'Go back'}
        tone={state?.tone ?? 'primary'}
        loading={loading}
        onCancel={() => close(false)}
        onConfirm={async () => {
          if (!state?.action) return close(true);
          setLoading(true);
          try {
            await state.action();
            close(true);
          } catch {
            // the action reports its own error (toast); keep the user in control
            setLoading(false);
            close(false);
          }
        }}
      />
    </ConfirmContext.Provider>
  );
}

/** `const confirm = useConfirm(); if (await confirm({ title: 'Log out?' })) …` */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
