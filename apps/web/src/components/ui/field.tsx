import { forwardRef, InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { MuiSelect, MuiSelectProps } from './mui-select';

const control =
  'w-full rounded-xl border border-line-strong bg-canvas px-4 text-[15px] text-ink placeholder:text-subtle transition-colors focus:border-primary focus:outline-none focus:ring-0 disabled:bg-panel disabled:text-muted aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, 'h-12', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'py-3 leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  // Dropdowns are Material UI everywhere (same props as a native select: <option> children + value/onChange)
  return (
    <MuiSelect ref={ref as unknown as Ref<HTMLInputElement>} className={className} {...(rest as MuiSelectProps)}>
      {children}
    </MuiSelect>
  );
});

/** Password input with a show/hide eye toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function PasswordInput(
  { className, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} className={cn(control, 'h-12 pr-12', className)} {...rest} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
      >
        {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
});

/** Numeric money input: text + decimal keypad (never type=number, which mangles decimals). */
export const MoneyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { prefix?: string }>(function MoneyInput(
  { prefix, className, ...rest },
  ref,
) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm font-semibold text-muted">{prefix}</span>}
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        className={cn(control, 'tabular h-12', prefix && 'pl-14', className)}
        {...rest}
      />
    </div>
  );
});

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  /** Shows a red star after the label */
  required?: boolean;
  className?: string;
  children: (id: string, describedBy?: string) => ReactNode;
}

/** Label + control + hint/error, wired for accessibility. */
export function Field({ label, error, hint, optional, required, className, children }: FieldProps) {
  const id = useId();
  const descId = error || hint ? `${id}-desc` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label id={`${id}-label`} htmlFor={id} className="flex items-baseline justify-between text-[13px] font-bold text-ink">
        <span>
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </span>
        {optional && <span className="text-xs font-medium text-subtle">Optional</span>}
      </label>
      {children(id, descId)}
      {error ? (
        <p id={descId} className="text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-3 text-sm font-medium', className)}>
      <input type="checkbox" className="size-5 rounded-md border-line-strong accent-primary" {...rest} />
      {label}
    </label>
  );
}
