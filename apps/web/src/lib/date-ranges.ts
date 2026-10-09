import { endOfMonth, endOfWeek, endOfYear, format, startOfMonth, startOfWeek, startOfYear, subDays, subMonths, subWeeks } from 'date-fns';

export type RangeKey = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
];

const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const WEEK = { weekStartsOn: 1 as const }; // weeks run Monday → Sunday

/** Inclusive yyyy-mm-dd bounds for a preset (empty for "custom" — its own dates, or everything when left blank) */
export function rangeDates(key: RangeKey, now = new Date()): { from?: string; to?: string } {
  switch (key) {
    case 'today':
      return { from: iso(now), to: iso(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: iso(y), to: iso(y) };
    }
    case 'this_week':
      return { from: iso(startOfWeek(now, WEEK)), to: iso(endOfWeek(now, WEEK)) };
    case 'last_week': {
      const w = subWeeks(now, 1);
      return { from: iso(startOfWeek(w, WEEK)), to: iso(endOfWeek(w, WEEK)) };
    }
    case 'this_month':
      return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) };
    case 'last_month': {
      const m = subMonths(now, 1);
      return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)) };
    }
    case 'this_year':
      return { from: iso(startOfYear(now)), to: iso(endOfYear(now)) };
    default:
      return {};
  }
}
