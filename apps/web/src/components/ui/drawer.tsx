'use client';

import { X } from 'lucide-react';
import { createContext, ReactNode, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { IconButton } from './button';
import { InModalContext } from './modal-context';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

/**
 * When a form that normally opens in its own modal is rendered inside another modal
 * (e.g. one step of the order's multi-step flow), it renders inline instead.
 */
const EmbeddedContext = createContext(false);
export function EmbeddedDrawers({ children }: { children: ReactNode }) {
  return <EmbeddedContext.Provider value>{children}</EmbeddedContext.Provider>;
}

/**
 * Centered modal for quick create/edit without leaving the page.
 * Full-screen sheet on phones, centered dialog on larger screens.
 * Escape closes; focus moves into the dialog and body scroll is locked.
 * (Named Drawer for historical reasons — every form uses it.)
 */
export function Drawer(props: DrawerProps) {
  const embedded = useContext(EmbeddedContext);
  return embedded ? <InlinePanel {...props} /> : <ModalPanel {...props} />;
}

/** One step's content inside a host modal: heading, scrollable body, footer. */
function InlinePanel({ title, description, children, footer }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea')?.focus());
  }, []);
  return (
    <div ref={ref} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
        <div className="mt-5">{children}</div>
      </div>
      {footer && <footer className="flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-7">{footer}</footer>}
    </div>
  );
}

function ModalPanel({ open, onClose, title, description, children, footer, width = 'md' }: DrawerProps) {
  return (
    <ModalFrame open={open} onClose={onClose} label={title} width={width}>
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-7 sm:py-5">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
          {description && <div className="mt-1 text-sm text-muted">{description}</div>}
        </div>
        <IconButton label="Close" onClick={onClose} className="-mr-2">
          <X className="size-5" />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">{children}</div>
      {footer && <footer className="flex flex-col-reverse gap-3 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-7">{footer}</footer>}
    </ModalFrame>
  );
}

/** Backdrop + centered dialog shell (shared by forms and multi-step flows). */
export function ModalFrame({
  open,
  onClose,
  label,
  width = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  width?: 'md' | 'lg' | 'xl';
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      // Only the top-most dialog reacts (a confirm on top of a form, say)
      if (e.key !== 'Escape') return;
      // An open dropdown or date picker handles Escape itself (closes just the menu)
      if (document.querySelector('.MuiPopover-root, .MuiPopper-root, .MuiPickersPopper-root')) return;
      const dialogs = document.querySelectorAll('[role="dialog"],[role="alertdialog"]');
      if (dialogs[dialogs.length - 1]?.contains(panelRef.current)) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea,button[data-autofocus]');
      (first ?? panelRef.current)?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-full flex-col bg-canvas shadow-[var(--shadow-pop)] outline-none sm:h-auto sm:max-h-[min(88dvh,900px)] sm:rounded-[20px]',
          width === 'xl' ? 'sm:max-w-[880px]' : width === 'lg' ? 'sm:max-w-[680px]' : 'sm:max-w-[560px]',
        )}
      >
        <InModalContext.Provider value>{children}</InModalContext.Provider>
      </div>
    </div>,
    document.body,
  );
}
