'use client';

import { ImagePlus, X } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { fileToLogo } from '@/lib/image';
import { Button } from '../ui/button';

export function LogoPicker({ value, onChange, busy }: { value: string | null | undefined; onChange: (v: string | null) => void; busy?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    try {
      onChange(await fileToLogo(file));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line-strong bg-panel text-muted transition-colors hover:border-primary hover:text-primary"
        aria-label={value ? 'Change logo' : 'Upload logo'}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="Logo" className="max-h-full max-w-full object-contain p-1.5" /> : <ImagePlus className="size-6" />}
      </button>
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => input.current?.click()} loading={busy}>
            {value ? 'Change logo' : 'Upload logo'}
          </Button>
          {value && (
            <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted">PNG, JPG or SVG. Square or wide logos work best.</p>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
