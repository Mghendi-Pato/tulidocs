/** 'yyyy-MM-dd' → Date at UTC midnight (Prisma @db.Date) */
export function toDateOnly(v: string): Date {
  return new Date(`${v.slice(0, 10)}T00:00:00.000Z`);
}

/** Today's date in the server's business time zone (TZ env), as yyyy-MM-dd */
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = toDateOnly(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isoOf(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Start of the current calendar month (server time zone) */
export function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
