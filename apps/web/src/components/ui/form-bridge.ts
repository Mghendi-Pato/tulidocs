'use client';

import { ForwardedRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any -- matches react-hook-form's ChangeHandler */
export type BridgeChange = (e: { target: any; type?: any }) => unknown;
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Lets a Material UI control stand in for a native input:
 *  - with react-hook-form's register(), a hidden <input> receives the ref and the default value,
 *    and RHF writes to it on reset/setValue (we mirror those writes into React state);
 *  - or it can be used as a controlled input via `value` + `onChange`.
 */
export function useFormBridge({
  ref,
  name,
  value,
  onChange,
}: {
  ref: ForwardedRef<HTMLInputElement>;
  name?: string;
  value?: string;
  onChange?: BridgeChange;
}) {
  const hidden = useRef<HTMLInputElement>(null);
  const controlled = value !== undefined;
  const [inner, setInner] = useState('');

  // register() writes the default value straight onto the hidden input — pick it up after mount
  useLayoutEffect(() => {
    if (!controlled && hidden.current) setInner(hidden.current.value);
  }, [controlled]);

  useImperativeHandle(ref, () => {
    const el = hidden.current!;
    return new Proxy(el, {
      set(target, prop, v) {
        if (prop === 'value') {
          target.value = v ?? '';
          setInner(target.value);
          return true;
        }
        return Reflect.set(target, prop, v);
      },
      get(target, prop) {
        const out = Reflect.get(target, prop);
        return typeof out === 'function' ? out.bind(target) : out;
      },
    });
  }, []);

  const emit = useCallback(
    (v: string) => {
      if (hidden.current) hidden.current.value = v;
      if (!controlled) setInner(v);
      onChange?.({ target: { name, value: v }, type: 'change' });
    },
    [controlled, name, onChange],
  );

  return { hidden, current: controlled ? (value ?? '') : inner, emit };
}
