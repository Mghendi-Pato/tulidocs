'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, MousePointer2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TEMPLATES } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { ButtonLink } from '../ui/button';
import { SCENES } from './scenes';

/** Background scene changes on its own every 30 seconds */
const SCENE_MS = 30_000;
/** Minimum time between two wheel-driven flips */
const WHEEL_COOLDOWN_MS = 650;
/** Wheel delta needed to flip (trackpads send many small deltas) */
const WHEEL_THRESHOLD = 40;

/**
 * Template gallery: a full-width desk scene with one sheet of paper on it.
 * Flip with the arrow buttons, the dots, the keyboard (← →), a swipe, or the mouse wheel
 * while the pointer is over the desk. The page scrolls normally everywhere else, and also
 * once the wheel reaches the first / last template.
 */
export function TemplateShowcase() {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [scene, setScene] = useState(0);
  const count = TEMPLATES.length;

  const indexRef = useRef(0);
  indexRef.current = index;

  const goTo = useCallback(
    (i: number) => {
      const next = Math.min(count - 1, Math.max(0, i));
      if (next === indexRef.current) return;
      setDir(next > indexRef.current ? 1 : -1);
      setIndex(next);
    },
    [count],
  );
  const prev = () => goTo(index - 1);
  const next = () => goTo(index + 1);

  // Desk scene rotation (?scene=2 opens on a given desk)
  useEffect(() => {
    const q = Number(new URLSearchParams(window.location.search).get('scene'));
    if (q >= 0 && q < SCENES.length) setScene(q);
    const t = setInterval(() => setScene((s) => (s + 1) % SCENES.length), SCENE_MS);
    return () => clearInterval(t);
  }, []);

  // Mouse wheel flips templates only while the pointer is over the stage
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let acc = 0;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; // horizontal gestures untouched
      const down = e.deltaY > 0;
      const atEdge = down ? indexRef.current >= count - 1 : indexRef.current <= 0;
      if (atEdge) return; // let the page scroll past the gallery
      e.preventDefault();
      const now = Date.now();
      if (now - last < WHEEL_COOLDOWN_MS) return;
      acc += e.deltaY;
      if (Math.abs(acc) < WHEEL_THRESHOLD) return;
      acc = 0;
      last = now;
      goTo(indexRef.current + (down ? 1 : -1));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [count, goTo]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      prev();
    }
  };

  const t = TEMPLATES[index];
  const s = SCENES[scene];
  const light = s.tone === 'light';
  const tilt = index % 2 ? 1.6 : -1.6;

  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: d > 0 ? '70%' : '-70%', rotate: d > 0 ? 8 : -8, scale: 0.94 }),
    center: { opacity: 1, y: '0%', rotate: reduce ? 0 : tilt, scale: 1 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: d > 0 ? '-70%' : '70%', rotate: d > 0 ? -8 : 8, scale: 0.94 }),
  };

  const arrowBtn = cn(
    'grid size-11 shrink-0 place-items-center rounded-full border backdrop-blur-md transition disabled:cursor-not-allowed disabled:opacity-35',
    light ? 'border-white/30 bg-black/25 text-white hover:bg-black/40' : 'border-ink/10 bg-white/75 text-ink hover:bg-white',
  );

  return (
    <section id="templates" className="relative scroll-mt-16 overflow-hidden">
      {/* Desk scene — full width (cross-fades every 30 s) */}
      <AnimatePresence initial={false}>
        <motion.div key={s.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.4 }}>
          {s.bg}
        </motion.div>
      </AnimatePresence>

      <div className="relative mx-auto grid w-full max-w-[1200px] gap-6 px-4 py-10 sm:px-6 lg:h-[min(88dvh,820px)] lg:w-[70%] lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-center lg:gap-10 lg:px-0 lg:py-8">
        {/* Copy */}
        <div className={cn('rounded-2xl p-4 lg:p-6', light ? 'bg-black/25 text-white backdrop-blur-sm' : 'bg-white/70 text-ink backdrop-blur-md')}>
          <div className={cn('text-[13px] font-bold tracking-wide tabular', light ? 'text-white/75' : 'text-muted')}>
            Templates · {String(index + 1).padStart(2, '0')} / {count}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <h2 className="font-display mt-1 text-[30px] leading-tight font-bold tracking-[-0.02em] lg:text-[40px]">{t.name}</h2>
              <p className={cn('mt-1 text-[15px] lg:text-[16px]', light ? 'text-white/85' : 'text-ink-soft')}>
                {t.description} <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[12px] font-bold', light ? 'bg-white/20' : 'bg-ink/8 text-ink-soft')}>{t.style}</span>
              </p>
            </motion.div>
          </AnimatePresence>
          <p className={cn('mt-4 hidden text-[15px] lg:block', light ? 'text-white/80' : 'text-muted')}>
            {count} designs, any colour, your logo. Switch any time — even after you’ve paid.
          </p>
          <div className="mt-4 lg:mt-6">
            <ButtonLink href={`/create/?template=${t.id}`} icon={<ArrowRight className="size-4" />} className="flex-row-reverse">
              Use {t.name}
            </ButtonLink>
          </div>
          {/* Progress — click to jump */}
          <div className="mt-5 hidden flex-wrap gap-1.5 lg:flex" role="tablist" aria-label="Templates">
            {TEMPLATES.map((x, i) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={x.name}
                title={x.name}
                onClick={() => goTo(i)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === index ? 'w-6' : 'w-2',
                  light ? (i === index ? 'bg-white' : 'bg-white/40 hover:bg-white/70') : i === index ? 'bg-ink' : 'bg-ink/25 hover:bg-ink/50',
                )}
              />
            ))}
          </div>
        </div>

        {/* Stage — wheel / keys / swipe flip templates here only */}
        <div
          ref={stageRef}
          tabIndex={0}
          onKeyDown={onKey}
          aria-roledescription="carousel"
          aria-label="Invoice templates"
          className="relative flex min-h-0 flex-col items-center justify-center gap-4 outline-none lg:h-full"
        >
          <div className="flex w-full items-center justify-center gap-3 sm:gap-6">
            <button type="button" onClick={prev} disabled={index === 0} aria-label="Previous template" className={arrowBtn}>
              <ChevronLeft className="size-5" />
            </button>

            <div className="relative aspect-[794/1123] w-[min(64vw,340px)] lg:h-[min(70dvh,680px)] lg:w-auto">
              <AnimatePresence initial={false}>
                <motion.div key={`behind-${s.id}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.4 }}>
                  {s.behind}
                </motion.div>
              </AnimatePresence>
              <AnimatePresence initial={false} custom={dir}>
                <motion.div
                  key={t.id}
                  custom={dir}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 110, damping: 20, mass: 0.9 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.35}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -60) next();
                    else if (info.offset.x > 60) prev();
                  }}
                  className="absolute inset-0 touch-pan-y"
                >
                  <Link href={`/create/?template=${t.id}`} aria-label={`Use the ${t.name} template`} draggable={false} className="block h-full w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/templates/${t.id}.webp`}
                      alt={`${t.name} invoice template`}
                      draggable={false}
                      className="h-full w-full rounded-[3px] bg-white object-cover shadow-[0_40px_70px_-25px_rgb(0_0_0/.55),0_8px_18px_-8px_rgb(0_0_0/.25)]"
                    />
                  </Link>
                </motion.div>
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {s.front && (
                  <motion.div key={`front-${s.id}`} className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.4 }}>
                    {s.front}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button type="button" onClick={next} disabled={index === count - 1} aria-label="Next template" className={arrowBtn}>
              <ChevronRight className="size-5" />
            </button>
          </div>

          <div className={cn('flex items-center gap-1.5 text-[12px] font-bold', light ? 'text-white/80' : 'text-ink-soft')}>
            <MousePointer2 className="size-3.5" />
            <span className="hidden lg:inline">Scroll over the invoice or use the arrows</span>
            <span className="lg:hidden">Swipe or tap the arrows</span>
          </div>
        </div>
      </div>
    </section>
  );
}
