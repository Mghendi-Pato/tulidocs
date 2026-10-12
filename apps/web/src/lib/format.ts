import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from 'date-fns';
import type { Money } from './types';

const SYMBOL: Record<string, string> = { KES: 'KSh' };

let baseCurrency = 'USD';
export function setBaseCurrency(c: string | null | undefined) {
  if (c) baseCurrency = c;
}
export const getBaseCurrency = () => baseCurrency;
export const currencySymbol = (c: string = baseCurrency) => SYMBOL[c] ?? c;

/** Formats a decimal string without converting to a float (no rounding surprises). */
export function formatMoney(value: Money | null | undefined, currency: string = baseCurrency, opts: { decimals?: boolean } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const str = String(value).trim();
  const negative = str.startsWith('-');
  const [intRaw, decRaw = ''] = str.replace('-', '').split('.');
  const int = intRaw.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const dec = (decRaw + '00').slice(0, 2);
  const showDecimals = opts.decimals ?? dec !== '00';
  return `${negative ? '−' : ''}${currencySymbol(currency)} ${int}${showDecimals ? `.${dec}` : ''}`;
}

export function formatDate(value: string | null | undefined, pattern = 'd MMM yyyy') {
  if (!value) return '—';
  return format(parseISO(value), pattern);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const d = parseISO(value);
  if (isToday(d)) return `Today, ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM yyyy, HH:mm');
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return '—';
  return `${formatDistanceToNowStrict(parseISO(value))} ago`;
}

export const today = () => format(new Date(), 'yyyy-MM-dd');

export function addDays(iso: string, days: number) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return format(d, 'yyyy-MM-dd');
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/** Number typed in a form → clean decimal string ("1,200" → "1200") */
export const cleanNumber = (v: string) => v.replace(/[,\s]/g, '');

/** Live line maths for the editor (the server recomputes on save) */
export function lineTotals(items: { quantity: string; unitPrice: string; taxRate: string }[], discount: string) {
  const n = (v: string) => {
    const x = Number(cleanNumber(v || '0'));
    return Number.isFinite(x) ? x : 0;
  };
  const amounts = items.map((i) => Math.round(n(i.quantity) * n(i.unitPrice) * 100) / 100);
  const subtotal = amounts.reduce((a, b) => a + b, 0);
  const disc = Math.min(Math.max(n(discount), 0), subtotal);
  const factor = subtotal > 0 ? 1 - disc / subtotal : 1;
  const tax = Math.round(items.reduce((s, it, i) => s + amounts[i] * factor * (n(it.taxRate) / 100), 0) * 100) / 100;
  return { amounts, subtotal, discount: disc, tax, total: Math.round((subtotal - disc + tax) * 100) / 100 };
}

export const money2 = (n: number) => n.toFixed(2);

/** Prices on plans and buttons: "$5", "KES 300", "€12" */
export function priceLabel(amount: number, currency: string) {
  try {
    const s = new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
    // "KSh 300" reads oddly next to M-Pesa prompts; Kenyans expect "KES 300"
    return currency === 'KES' ? `KES ${amount.toLocaleString('en')}` : s;
  } catch {
    return `${currency} ${amount.toLocaleString('en')}`;
  }
}

/** Whole days from now until `value` (0 if past) */
export function daysUntil(value: string | null | undefined) {
  if (!value) return 0;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

/** "92 days left" / "1 day left" / "ends today" */
export function daysLeftLabel(value: string | null | undefined) {
  const d = daysUntil(value);
  return d === 0 ? 'ends today' : d === 1 ? '1 day left' : `${d} days left`;
}
