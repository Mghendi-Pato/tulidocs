import type { DocStatus, DocType, PaymentMethod } from './types';

/** Keep in sync with apps/api/src/render/templates/index.ts */
export const TEMPLATES = [
  { id: 'classic', name: 'Classic', description: 'Clean, with an accent bar', style: 'Simple' },
  { id: 'modern', name: 'Modern', description: 'Bold colour header', style: 'Bold' },
  { id: 'minimal', name: 'Minimal', description: 'Black and white, airy', style: 'Simple' },
  { id: 'elegant', name: 'Elegant', description: 'Serif headings', style: 'Elegant' },
  { id: 'bold', name: 'Bold', description: 'Dark sidebar', style: 'Bold' },
  { id: 'wave', name: 'Wave', description: 'Big title, sweeping shapes', style: 'Creative' },
  { id: 'corners', name: 'Corners', description: 'Geometric corners, boxed table', style: 'Creative' },
  { id: 'gratitude', name: 'Gratitude', description: 'Warm paper, script heading', style: 'Elegant' },
  { id: 'vivid', name: 'Vivid', description: 'Tinted page, colour grid', style: 'Bold' },
  { id: 'ribbon', name: 'Ribbon', description: 'Curved colour header', style: 'Creative' },
  { id: 'stripes', name: 'Stripes', description: 'Diagonal geometric bands', style: 'Creative' },
  { id: 'statement', name: 'Statement', description: 'Summary panel at the foot', style: 'Simple' },
  { id: 'monogram', name: 'Monogram', description: 'Centred initial, soft bars', style: 'Elegant' },
  { id: 'ledger', name: 'Ledger', description: 'Typewriter type, ruled grid', style: 'Simple' },
  { id: 'headline', name: 'Headline', description: 'Oversized title', style: 'Simple' },
  { id: 'frame', name: 'Frame', description: 'Colour spine and top bar', style: 'Bold' },
  { id: 'noir', name: 'Noir', description: 'Black header and footer', style: 'Bold' },
  { id: 'corporate', name: 'Corporate', description: 'Contact row, highlighted totals', style: 'Business' },
  { id: 'executive', name: 'Executive', description: 'Dark band, shaded columns', style: 'Business' },
  { id: 'capsule', name: 'Capsule', description: 'Rounded pill headers', style: 'Business' },
  { id: 'summit', name: 'Summit', description: 'Colour table, split total', style: 'Business' },
] as const;

export const TEMPLATE_STYLES = ['All', 'Simple', 'Business', 'Bold', 'Creative', 'Elegant'] as const;

export const ACCENTS = ['#2451d6', '#0f1b33', '#c8102e', '#b8203b', '#17754a', '#3fa34d', '#0d9488', '#1f4fa3', '#7c3aed', '#d97706', '#e08a2e', '#db2777', '#a87b4f', '#f4c430'];

export const TYPE_LABEL: Record<DocType, string> = { QUOTE: 'Quote', INVOICE: 'Invoice', RECEIPT: 'Receipt' };
export const TYPE_PLURAL: Record<DocType, string> = { QUOTE: 'Quotes', INVOICE: 'Invoices', RECEIPT: 'Receipts' };

export const STATUS_LABEL: Record<DocStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  PARTIALLY_PAID: 'Part paid',
  PAID: 'Paid',
  VOID: 'Void',
};

export const STATUS_DOT: Record<DocStatus, string> = {
  DRAFT: 'bg-line-strong',
  SENT: 'bg-primary',
  ACCEPTED: 'bg-positive',
  DECLINED: 'bg-danger',
  PARTIALLY_PAID: 'bg-[#d97706]',
  PAID: 'bg-positive',
  VOID: 'bg-line-strong',
};

export const METHOD_LABEL: Record<PaymentMethod, string> = { MPESA: 'M-Pesa', BANK: 'Bank transfer', CASH: 'Cash', CARD: 'Card', CHEQUE: 'Cheque', OTHER: 'Other' };

import { COUNTRIES } from './countries';

/** Every currency we have a country for, USD/EUR/GBP first */
export const CURRENCIES = Array.from(new Set(['USD', 'EUR', 'GBP', ...COUNTRIES.map((c) => c.currency).sort()]));
