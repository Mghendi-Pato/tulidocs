'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export type TocSection = { id: string; title: string };

/** Height of the sticky site header + breathing room: a section becomes "current" once its heading passes this line */
const OFFSET = 120;

/** Which section the reader is in: the last heading that has scrolled above the offset line */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) return setActive(ids[ids.length - 1]);
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - OFFSET <= 0) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

function go(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', `#${id}`);
}

/** Desktop: sticky contents list beside the text, current section highlighted */
export function TocSidebar({ sections }: { sections: TocSection[] }) {
  const active = useActiveSection(sections.map((s) => s.id));
  return (
    <nav aria-label="On this page" className="sticky top-24">
      <div className="text-[12px] font-bold tracking-wide text-muted uppercase">On this page</div>
      <ul className="mt-3 border-l border-line">
        {sections.map((s) => {
          const on = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(s.id);
                }}
                aria-current={on ? 'location' : undefined}
                className={cn(
                  '-ml-px block border-l-2 py-1.5 pl-3.5 text-[14px] transition-colors',
                  on ? 'border-primary font-semibold text-primary' : 'border-transparent text-ink-soft hover:border-line-strong hover:text-ink',
                )}
              >
                {s.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone / tablet: slim sticky bar under the header showing where you are; tap to jump elsewhere */
export function TocBar({ sections }: { sections: TocSection[] }) {
  const active = useActiveSection(sections.map((s) => s.id));
  const index = sections.findIndex((s) => s.id === active);
  return (
    <div className="sticky top-16 z-20 -mx-4 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
      <label className="relative flex items-center gap-2 text-[13.5px]">
        <span className="shrink-0 font-semibold text-muted">
          {index + 1}/{sections.length}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{sections[index]?.title}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" />
        {/* native picker: easy to use with a thumb, accessible by default */}
        <select aria-label="Jump to section" value={active} onChange={(e) => go(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
          {sections.map((s, n) => (
            <option key={s.id} value={s.id}>
              {n + 1}. {s.title}
            </option>
          ))}
        </select>
      </label>
      {/* reading progress through the sections */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${((index + 1) / sections.length) * 100}%` }} />
      </div>
    </div>
  );
}
