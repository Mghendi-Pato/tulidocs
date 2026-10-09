'use client';

import MenuItem from '@mui/material/MenuItem';
import MuiSelectBase from '@mui/material/Select';
import { Children, forwardRef, isValidElement, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { BridgeChange, useFormBridge } from './form-bridge';

export type MuiSelectProps = {
  id?: string;
  name?: string;
  value?: string | number | readonly string[];
  onChange?: BridgeChange;
  onBlur?: BridgeChange;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};

/** Reads the <option> children a native <select> would get, so call sites stay the same. */
function optionsOf(children: ReactNode) {
  return Children.toArray(children)
    .filter(isValidElement)
    .filter((c) => c.type === 'option')
    .map((c) => {
      const p = c.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
      // like a native <option>, the text is the value when no value is given
      const v = p.value ?? (typeof p.children === 'string' || typeof p.children === 'number' ? p.children : '');
      return { value: String(v), label: p.children, disabled: p.disabled };
    });
}

/**
 * Material UI dropdown with a native-select API: pass <option> children, and use either
 * react-hook-form's register() or value/onChange.
 */
export const MuiSelect = forwardRef<HTMLInputElement, MuiSelectProps>(function MuiSelect(
  { id, name, value, onChange, onBlur, disabled, className, children, 'aria-invalid': invalid, 'aria-label': ariaLabel, 'aria-describedby': describedBy },
  ref,
) {
  const { hidden, current, emit } = useFormBridge({ ref, name, value: value === undefined ? undefined : String(value), onChange });
  const options = optionsOf(children);
  const height = className?.match(/\bh-(\d+)\b/)?.[1];
  const selected = options.find((o) => o.value === current);

  return (
    <div className={cn('w-full', className?.replace(/\bh-\d+\b/g, '').replace(/\brounded-\S+/g, ''))}>
      <input ref={hidden} type="hidden" name={name} />
      <MuiSelectBase
        id={id}
        // named by the Field's <label> (a native label can't point at MUI's non-input combobox)
        labelId={id && !ariaLabel ? `${id}-label` : undefined}
        value={selected ? current : ''}
        onChange={(e) => emit(String(e.target.value))}
        onClose={() => onBlur?.({ target: hidden.current, type: 'blur' })}
        disabled={disabled}
        displayEmpty
        fullWidth
        error={invalid === true || invalid === 'true'}
        renderValue={() => (selected ? selected.label : '')}
        inputProps={{ 'aria-label': ariaLabel, 'aria-describedby': describedBy }}
        MenuProps={{ disableScrollLock: true, slotProps: { paper: { sx: { maxHeight: 320 } } } }}
        sx={{ height: height ? Number(height) * 4 : 48, fontSize: 15 }}
      >
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value} disabled={o.disabled} sx={{ fontSize: 15, minHeight: 40 }}>
            {o.label}
          </MenuItem>
        ))}
      </MuiSelectBase>
    </div>
  );
});
