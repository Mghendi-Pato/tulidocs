'use client';

import { motion, useReducedMotion } from 'framer-motion';

/** Back → front. left/top are % of the stage; the sheets fan open on load and float gently. */
const SHEETS = [
  { src: '/hero/sky.webp', left: '8%', top: '16%', rotate: -16, delay: 0 },
  { src: '/hero/rose.webp', left: '22%', top: '6%', rotate: -8, delay: 0.08 },
  { src: '/hero/navy.webp', left: '38%', top: '4%', rotate: 9, delay: 0.16 },
];

/** Fan of three floating invoices with a soft shadow on the "floor" (landing hero). */
export function HeroStack() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto aspect-[1/0.95] w-full max-w-[560px]" aria-hidden="true">
      {/* Floor shadow */}
      <motion.div
        className="absolute bottom-[3%] left-[18%] h-[8%] w-[70%] rounded-[50%] bg-[#7a4a00]/45 blur-2xl"
        animate={reduce ? undefined : { scaleX: [1, 0.92, 1], opacity: [0.9, 0.7, 0.9] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Sheets float together */}
      <motion.div
        className="absolute inset-0"
        animate={reduce ? undefined : { y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        {SHEETS.map((s) => (
          <motion.div
            key={s.src}
            className="absolute w-[56%]"
            style={{ left: s.left, top: s.top }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: 0, x: '30%', y: 40 }}
            animate={{ opacity: 1, rotate: s.rotate, x: 0, y: 0 }}
            transition={reduce ? { duration: 0.3 } : { type: 'spring', stiffness: 70, damping: 16, delay: 0.2 + s.delay }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.src}
              alt=""
              draggable={false}
              className="aspect-[794/1123] w-full rounded-[2px] bg-white object-cover shadow-[0_30px_50px_-20px_rgb(90_55_0/.45),0_6px_14px_-6px_rgb(0_0_0/.2)]"
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
