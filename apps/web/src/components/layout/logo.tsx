import { cn } from '@/lib/cn';

/** tuli wordmark: dark "t" mark with the red dot, lowercase "tuli" in the display face. */
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-[21px] text-ink', className)}>
      <span className="font-display relative inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-ink pb-0.5 text-[18px] font-bold text-white">
        t
        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-canvas bg-brand" />
      </span>
      {!compact && <span className="font-display leading-none font-bold tracking-[-0.03em] whitespace-nowrap">tuli</span>}
    </span>
  );
}
