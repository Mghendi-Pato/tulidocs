'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { NewIdeaDrawer } from './new-idea';

/**
 * "Feedback" tab stuck to the middle of the right edge.
 * Opens the "Share an idea" form for everyone (visitors post under a name of their choice).
 * The text is rotated 180°, so rounded-r shows as the rounded LEFT corners (flat side on the screen edge).
 */
export function FeedbackTab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname.startsWith('/feedback')) return null; // the boards have their own "Share an idea"

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Feedback and ideas"
        className="no-print fixed top-1/2 right-0 z-30 flex -translate-y-1/2 rotate-180 items-center rounded-r-md bg-ink/90 px-1 py-2.5 text-[10.5px] font-bold sm:rounded-r-lg sm:bg-ink sm:px-1.5 sm:py-3.5 sm:text-xs tracking-wide text-white shadow-lg transition-[padding] [writing-mode:vertical-rl] hover:pr-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary print:hidden"
      >
        Feedback
      </button>
      {open && <NewIdeaDrawer open={open} onClose={() => setOpen(false)} boardLink />}
    </>
  );
}
