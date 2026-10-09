import { readFileSync } from 'node:fs';
import { DocumentType } from '@prisma/client';
import { BRAND } from '../../common/brand';

/** Shared types, fonts, helpers and building blocks for every invoice template. */

export interface RenderParty {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  logo?: string | null;
}

export interface RenderLine {
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  amount: string;
}

export interface RenderDoc {
  type: DocumentType;
  number: string;
  status?: string;
  issueDate: string;
  dueDate?: string | null;
  currency: string;
  template: string;
  accent: string;
  /** VAT, GST, Sales tax… */
  taxName: string;
  /** KRA PIN, VAT No., GSTIN, EIN… */
  taxIdLabel: string;
  from: RenderParty;
  to: RenderParty;
  items: RenderLine[];
  subtotal: string;
  discount: string;
  taxTotal: string;
  total: string;
  amountPaid?: string;
  notes?: string | null;
  terms?: string | null;
  paymentInfo?: string | null;
  paymentMethod?: string | null;
  paymentRef?: string | null;
  sourceNumber?: string | null;
  etims?: { invoiceNo?: string | null; receiptNo?: string | null; signature?: string | null; qr?: string | null } | null;
}

export interface RenderOptions {
  watermark: boolean;
  /** Footer line, e.g. "Made with tuli · tulidocs.com" */
  footer?: string;
}

// ───────────────────────── Fonts (embedded so every server renders the same) ─────────────────────────

let fontCss: string | null = null;
export function fonts(): string {
  if (fontCss !== null) return fontCss;
  const load = (pkg: string, file: string) => {
    try {
      const p = require.resolve(`${pkg}/files/${file}`);
      return `data:font/woff2;base64,${readFileSync(p).toString('base64')}`;
    } catch {
      return null;
    }
  };
  const face = (family: string, pkg: string, file: string, weight: string) => {
    const src = load(pkg, file);
    return src ? `@font-face{font-family:'${family}';src:url(${src}) format('woff2');font-weight:${weight};font-style:normal}` : '';
  };
  fontCss = [
    face('Manrope', '@fontsource-variable/manrope', 'manrope-latin-wght-normal.woff2', '200 800'),
    face('Instrument Serif', '@fontsource/instrument-serif', 'instrument-serif-latin-400-normal.woff2', '400'),
    face('Script', '@fontsource/great-vibes', 'great-vibes-latin-400-normal.woff2', '400'),
    face('Mono', '@fontsource/jetbrains-mono', 'jetbrains-mono-latin-400-normal.woff2', '400'),
    face('Mono', '@fontsource/jetbrains-mono', 'jetbrains-mono-latin-700-normal.woff2', '700'),
    face('Montserrat', '@fontsource/montserrat', 'montserrat-latin-500-normal.woff2', '500'),
    face('Montserrat', '@fontsource/montserrat', 'montserrat-latin-700-normal.woff2', '700'),
    face('Montserrat', '@fontsource/montserrat', 'montserrat-latin-800-normal.woff2', '800'),
  ]
    .filter(Boolean)
    .join('\n');
  return fontCss;
}

// ───────────────────────── Helpers ─────────────────────────

export const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Escapes and keeps line breaks */
export const multi = (v: unknown) => esc(v).replace(/\n/g, '<br>');

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso?: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

export function fmtMoney(v: string | number, currency?: string) {
  const n = Number(v);
  const s = (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${s}` : s;
}

export const fmtQty = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 3 }) : esc(v);
};

export const fmtRate = (v: string) => {
  const n = Number(v);
  return n ? `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}%` : '—';
};

export function titleOf(type: DocumentType) {
  return type === 'QUOTE' ? 'Quotation' : type === 'RECEIPT' ? 'Receipt' : 'Invoice';
}

/** Readable text colour (white or ink) on top of the accent */
export function onAccent(hex: string) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0f1b33' : '#ffffff';
}

export function tint(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

export const hasTax = (d: RenderDoc) => d.items.some((i) => Number(i.taxRate) > 0);

// ───────────────────────── Shared blocks ─────────────────────────

export function logo(d: RenderDoc, cls = 'logo') {
  if (d.from.logo) return `<img class="${cls}" src="${esc(d.from.logo)}" alt="">`;
  const initial = esc((d.from.name || '?').trim().charAt(0).toUpperCase());
  return `<div class="${cls} logo-fallback">${initial}</div>`;
}

export function partyLines(p: RenderParty, taxIdLabel: string, opts: { name?: boolean } = {}) {
  return [
    opts.name !== false && p.name ? `<div class="p-name">${esc(p.name)}</div>` : '',
    p.address ? `<div>${multi(p.address)}</div>` : '',
    p.phone ? `<div>${esc(p.phone)}</div>` : '',
    p.email ? `<div>${esc(p.email)}</div>` : '',
    p.taxId ? `<div>${esc(taxIdLabel)}: ${esc(p.taxId)}</div>` : '',
  ].join('');
}

export function metaRows(d: RenderDoc) {
  const rows: [string, string][] = [
    [`${titleOf(d.type)} no.`, esc(d.number)],
    [d.type === 'RECEIPT' ? 'Date paid' : 'Date', fmtDate(d.issueDate)],
  ];
  if (d.dueDate && d.type === 'INVOICE') rows.push(['Due date', fmtDate(d.dueDate)]);
  if (d.dueDate && d.type === 'QUOTE') rows.push(['Valid until', fmtDate(d.dueDate)]);
  if (d.sourceNumber) rows.push([d.type === 'RECEIPT' ? 'For invoice' : 'Ref.', esc(d.sourceNumber)]);
  if (d.type === 'RECEIPT' && d.paymentMethod) rows.push(['Paid by', esc(PAY_LABEL[d.paymentMethod] ?? d.paymentMethod)]);
  if (d.type === 'RECEIPT' && d.paymentRef) rows.push(['Reference', esc(d.paymentRef)]);
  return rows;
}

export const PAY_LABEL: Record<string, string> = { MPESA: 'M-Pesa', BANK: 'Bank transfer', CASH: 'Cash', CARD: 'Card', CHEQUE: 'Cheque', OTHER: 'Other' };

export function itemsTable(d: RenderDoc) {
  const tax = hasTax(d);
  const rows = d.items
    .map(
      (it, i) => `<tr>
        <td class="c-no">${i + 1}</td>
        <td class="c-desc">${multi(it.description)}</td>
        <td class="c-num">${fmtQty(it.quantity)}</td>
        <td class="c-num">${fmtMoney(it.unitPrice)}</td>
        ${tax ? `<td class="c-num">${fmtRate(it.taxRate)}</td>` : ''}
        <td class="c-num c-amt">${fmtMoney(it.amount)}</td>
      </tr>`,
    )
    .join('');
  return `<table class="items">
    <thead><tr>
      <th class="c-no">#</th><th class="c-desc">Description</th><th class="c-num">Qty</th><th class="c-num">Price</th>
      ${tax ? `<th class="c-num">${esc(d.taxName.length > 8 ? 'Tax' : d.taxName)}</th>` : ''}<th class="c-num">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function totals(d: RenderDoc) {
  const paid = Number(d.amountPaid ?? 0);
  const balance = Number(d.total) - paid;
  const rows = [
    `<div class="t-row"><span>Subtotal</span><span>${fmtMoney(d.subtotal)}</span></div>`,
    Number(d.discount) > 0 ? `<div class="t-row"><span>Discount</span><span>− ${fmtMoney(d.discount)}</span></div>` : '',
    hasTax(d) || Number(d.taxTotal) > 0 ? `<div class="t-row"><span>${esc(d.taxName)}</span><span>${fmtMoney(d.taxTotal)}</span></div>` : '',
    `<div class="t-row t-total"><span>${d.type === 'RECEIPT' ? 'Amount paid' : 'Total'}</span><span>${fmtMoney(d.total, d.currency)}</span></div>`,
    d.type === 'INVOICE' && paid > 0 ? `<div class="t-row"><span>Paid</span><span>${fmtMoney(paid)}</span></div>` : '',
    d.type === 'INVOICE' && paid > 0 ? `<div class="t-row t-due"><span>Balance due</span><span>${fmtMoney(Math.max(0, balance), d.currency)}</span></div>` : '',
  ];
  return `<div class="totals">${rows.join('')}</div>`;
}

export function extras(d: RenderDoc) {
  const blocks: string[] = [];
  if (d.paymentInfo && d.type !== 'RECEIPT') blocks.push(`<div class="box pay"><div class="label">How to pay</div><div>${multi(d.paymentInfo)}</div></div>`);
  if (d.notes) blocks.push(`<div class="box"><div class="label">Notes</div><div>${multi(d.notes)}</div></div>`);
  if (d.terms) blocks.push(`<div class="box"><div class="label">Terms</div><div>${multi(d.terms)}</div></div>`);
  if (d.etims && (d.etims.invoiceNo || d.etims.signature)) {
    blocks.push(`<div class="box etims">
      ${d.etims.qr ? `<img src="${esc(d.etims.qr)}" alt="">` : ''}
      <div><div class="label">KRA eTIMS</div>
      ${d.etims.invoiceNo ? `<div>CU invoice no.: ${esc(d.etims.invoiceNo)}</div>` : ''}
      ${d.etims.receiptNo ? `<div>Receipt no.: ${esc(d.etims.receiptNo)}</div>` : ''}
      ${d.etims.signature ? `<div class="sig">${esc(d.etims.signature)}</div>` : ''}</div>
    </div>`);
  }
  return blocks.length ? `<div class="extras">${blocks.join('')}</div>` : '';
}

export function stamp(d: RenderDoc) {
  const paid = d.type === 'RECEIPT' || d.status === 'PAID';
  if (d.status === 'VOID') return '<div class="stamp void">Void</div>';
  return paid ? '<div class="stamp">Paid</div>' : '';
}

export function watermark(on: boolean) {
  if (!on) return '';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='240'><text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' transform='rotate(-30 180 120)' font-family='Arial,Helvetica,sans-serif' font-size='26' font-weight='700' fill='rgba(15,27,51,0.13)' letter-spacing='3'>PREVIEW · NOT PAID</text></svg>`;
  return `<div class="wm" style="background-image:url(&quot;data:image/svg+xml;utf8,${encodeURIComponent(svg)}&quot;)"></div>
  <div class="wm-band">PREVIEW — remove this watermark at ${BRAND.domain}</div>`;
}

// ───────────────────────── Base CSS ─────────────────────────

export function baseCss(d: RenderDoc) {
  const a = d.accent;
  return `
  ${fonts()}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 794px; }
  body { font-family: 'Manrope', 'Segoe UI', Arial, sans-serif; color: #0b1529; font-size: 13.5px; line-height: 1.5;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
  .page { position: relative; min-height: 1123px; padding: 56px 56px 72px; }
  .num, .c-num, .totals { font-variant-numeric: tabular-nums; }
  .logo { max-height: 64px; max-width: 200px; object-fit: contain; display: block; }
  .logo-fallback { width: 56px; height: 56px; border-radius: 14px; background: ${a}; color: ${onAccent(a)};
                   display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800; }
  .p-name { font-weight: 800; font-size: 15px; color: #0f1b33; margin-bottom: 2px; }
  .muted { color: #3f4a5e; }
  .label { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #3f4a5e; margin-bottom: 6px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 28px; }
  table.items th { font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; text-align: left; padding: 10px 10px; }
  table.items td { padding: 11px 10px; vertical-align: top; border-bottom: 1px solid #d3dae6; }
  table.items tr { page-break-inside: avoid; }
  .c-no { width: 28px; color: #5f6878; }
  .c-num { text-align: right !important; white-space: nowrap; }
  .c-amt { font-weight: 700; }
  .totals { margin-left: auto; width: 300px; margin-top: 18px; page-break-inside: avoid; }
  .t-row { display: flex; justify-content: space-between; padding: 6px 10px; }
  .t-total { margin-top: 6px; padding: 12px 12px; font-weight: 800; font-size: 16.5px; }
  .t-due { font-weight: 700; }
  .extras { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 36px; page-break-inside: avoid; }
  .box { padding: 14px 16px; border-radius: 10px; background: #eef2f8; font-size: 12.5px; }
  .box.pay { background: ${tint(a, 0.12)}; }
  .box.etims { display: flex; gap: 12px; align-items: center; grid-column: 1 / -1; }
  .box.etims img { width: 84px; height: 84px; }
  .sig { font-family: monospace; font-size: 10px; word-break: break-all; color: #3f4a5e; }
  .stamp { position: absolute; top: 210px; right: 60px; transform: rotate(-12deg); border: 3px solid #17754a; color: #17754a;
           padding: 4px 16px; font-size: 26px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; border-radius: 8px; opacity: .85; }
  .stamp.void { border-color: #b42318; color: #b42318; }
  .foot { position: absolute; left: 56px; right: 56px; bottom: 28px; display: flex; justify-content: space-between;
          font-size: 10.5px; color: #4a5468; }
  .wm { position: fixed; inset: 0; z-index: 50; pointer-events: none; background-repeat: repeat; }
  .wm-band { position: fixed; left: 0; right: 0; bottom: 0; z-index: 51; background: #0f1b33; color: #fff; text-align: center;
             font-size: 11px; font-weight: 700; letter-spacing: .04em; padding: 7px 0; }
  `;
}

export function footer(d: RenderDoc, opts: RenderOptions) {
  return `<div class="foot"><span>${esc(d.from.name)}${d.from.taxId ? ` · ${esc(d.taxIdLabel)} ${esc(d.from.taxId)}` : ''}</span><span>${esc(opts.footer ?? '')}</span></div>`;
}


// ───────────────────────── Extra building blocks (used by the newer templates) ─────────────────────────

/** "phone · email · address" pieces of the sender, skipping empty ones */
export function contactBits(p: RenderParty): { k: string; v: string }[] {
  return [
    p.phone ? { k: 'Phone', v: esc(p.phone) } : null,
    p.email ? { k: 'Email', v: esc(p.email) } : null,
    p.address ? { k: 'Address', v: multi(p.address) } : null,
  ].filter(Boolean) as { k: string; v: string }[];
}

/** Business name written as a signature over a line */
export function signature(d: RenderDoc, label = 'Authorised signature') {
  return `<div class="sign"><div class="sign-name">${esc(d.from.name)}</div><div class="sign-line"></div><div class="sign-label">${esc(label)}</div></div>`;
}

/** Hand-written "Thank you" flourish */
export const thanks = (text = 'Thank you!') => `<div class="thanks">${esc(text)}</div>`;

/** CSS for signature / thanks blocks (append to a template's css) */
export const flourishCss = (color = '#0b1529') => `
  .sign { text-align: center; width: 220px; }
  .sign-name { font-family: 'Script', cursive; font-size: 30px; line-height: 1.1; color: ${color}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sign-line { height: 1px; background: #0b1529; margin: 4px 0 6px; }
  .sign-label { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #3f4a5e; }
  .thanks { font-family: 'Script', cursive; font-size: 46px; line-height: 1; color: ${color}; }
`;

/** Payment / notes / terms as a simple stack (for layouts that don't use the 2-column boxes) */
export function infoStack(d: RenderDoc) {
  const parts: string[] = [];
  if (d.paymentInfo && d.type !== 'RECEIPT') parts.push(`<div class="info"><div class="label">Payment information</div><div>${multi(d.paymentInfo)}</div></div>`);
  if (d.notes) parts.push(`<div class="info"><div class="label">Notes</div><div>${multi(d.notes)}</div></div>`);
  if (d.terms) parts.push(`<div class="info"><div class="label">Terms &amp; conditions</div><div>${multi(d.terms)}</div></div>`);
  return parts.join('');
}

/** Label/value pairs for the document meta (number, dates, refs) */
export const metaPairs = (d: RenderDoc) => metaRows(d).map(([k, v]) => `<div class="mp"><span class="mk">${k}</span><span class="mv">${v}</span></div>`).join('');

/** Amount still owed (for "Total due" callouts) */
export function amountDue(d: RenderDoc) {
  const due = Math.max(0, Number(d.total) - Number(d.amountPaid ?? 0));
  return d.type === 'RECEIPT' ? fmtMoney(d.total, d.currency) : fmtMoney(due, d.currency);
}
