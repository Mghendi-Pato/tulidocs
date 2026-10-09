'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { ACCENTS, TEMPLATE_STYLES, TEMPLATES } from '@/lib/constants';
import { cn } from '@/lib/cn';

type Style = (typeof TEMPLATE_STYLES)[number];

/** Style filter chips — shared by the picker and the landing page gallery */
export function StyleChips({ value, onChange, className }: { value: Style; onChange: (s: Style) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="tablist" aria-label="Template style">
      {TEMPLATE_STYLES.map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={value === s}
          onClick={() => onChange(s)}
          className={cn(
            'h-8 rounded-full px-3.5 text-[13px] font-bold transition-colors',
            value === s ? 'bg-ink text-white' : 'border border-line-strong text-ink-soft hover:border-ink-soft',
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function TemplatePicker({ template, accent, onTemplate, onAccent }: { template: string; accent: string; onTemplate: (t: string) => void; onAccent: (a: string) => void }) {
  const [style, setStyle] = useState<Style>('All');
  const list = TEMPLATES.filter((t) => style === 'All' || t.style === style);

  return (
    <div className="space-y-5">
      <StyleChips value={style} onChange={setStyle} />
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
        {list.map((t) => {
          const active = t.id === template;
          return (
            <button key={t.id} type="button" onClick={() => onTemplate(t.id)} aria-pressed={active} className="group w-[128px] shrink-0 snap-start text-left">
              <span
                className={cn(
                  'relative block aspect-[3/4] overflow-hidden rounded-xl border-2 bg-white transition-colors',
                  active ? 'border-primary' : 'border-line-strong group-hover:border-ink-soft',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/templates/${t.id}.webp`} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                {active && (
                  <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className={cn('mt-1.5 block text-[13px] font-bold', active ? 'text-primary' : 'text-ink')}>{t.name}</span>
            </button>
          );
        })}
      </div>
      <div>
        <div className="mb-2 text-[13px] font-bold">Colour</div>
        <div className="flex flex-wrap items-center gap-2.5">
          {ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={c === accent}
              onClick={() => onAccent(c)}
              className={cn('size-8 rounded-full ring-offset-2 transition-shadow', c === accent ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-line-strong')}
              style={{ background: c }}
            />
          ))}
          <label className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-line-strong text-[11px] font-bold text-muted" title="Custom colour">
            +
            <input type="color" value={accent} onChange={(e) => onAccent(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>
      </div>
    </div>
  );
}
