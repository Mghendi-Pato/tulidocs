'use client';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid, parseISO } from 'date-fns';
import { forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { BridgeChange, useFormBridge } from './form-bridge';

type Props = {
  id?: string;
  name?: string;
  /** Controlled value, yyyy-MM-dd ('' = empty). Leave out when using react-hook-form's register(). */
  value?: string;
  onChange?: BridgeChange;
  onBlur?: BridgeChange;
  min?: string | number;
  max?: string | number;
  disabled?: boolean;
  className?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};

const toDate = (v?: string | number) => {
  if (!v) return null;
  const d = parseISO(String(v));
  return isValid(d) ? d : null;
};

/**
 * Material UI date picker that behaves like <input type="date">: the value is a yyyy-MM-dd string.
 * Works with react-hook-form's register() (a hidden input carries the value) or as a controlled input.
 */
export const DateInput = forwardRef<HTMLInputElement, Props>(function DateInput(
  { id, name, value, onChange, onBlur, min, max, disabled, className, 'aria-invalid': invalid },
  ref,
) {
  const { hidden, current, emit } = useFormBridge({ ref, name, value, onChange });
  const controlled = value !== undefined;

  const compact = !!className?.includes('h-10');
  return (
    <div className={cn('w-full', className?.replace(/\bh-\d+\b/g, '').replace(/\bbg-\S+/g, ''))}>
      <input ref={hidden} type="hidden" name={name} defaultValue={controlled ? value : undefined} />
      <DatePicker
        value={toDate(current)}
        onChange={(d) => emit(d && isValid(d) ? format(d, 'yyyy-MM-dd') : '')}
        onClose={() => onBlur?.({ target: hidden.current, type: 'blur' })}
        minDate={toDate(min) ?? undefined}
        maxDate={toDate(max) ?? undefined}
        disabled={disabled}
        format="dd MMM yyyy"
        slotProps={{
          textField: {
            id,
            fullWidth: true,
            error: invalid === true || invalid === 'true',
            onBlur: () => onBlur?.({ target: hidden.current, type: 'blur' }),
            sx: { '& .MuiPickersInputBase-root': { height: compact ? 40 : 48 } },
          },
          field: { clearable: true },
        }}
      />
    </div>
  );
});
