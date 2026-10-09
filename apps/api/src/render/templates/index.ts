import { bold, classic, elegant, minimal, modern } from './core';
import { capsule, corners, corporate, executive, frame, gratitude, headline, ledger, monogram, noir, ribbon, statement, stripes, summit, vivid, wave } from './extra';
import { baseCss, esc, RenderDoc, RenderOptions, titleOf, watermark } from './shared';

export * from './shared';

/**
 * Invoice / quote / receipt templates as HTML + CSS, rendered by headless Chrome
 * into a PDF (download) or a JPEG (live preview). A4 at 96 dpi = 794 × 1123 px.
 * Every template follows the document's accent colour, logo and tax wording.
 */

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

export type TemplateId = (typeof TEMPLATES)[number]['id'];
export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id) as readonly TemplateId[];

type Renderer = (d: RenderDoc, o: RenderOptions) => { css: string; body: string };

const RENDERERS: Record<TemplateId, Renderer> = {
  classic,
  modern,
  minimal,
  elegant,
  bold,
  wave,
  corners,
  gratitude,
  vivid,
  ribbon,
  stripes,
  statement,
  monogram,
  ledger,
  headline,
  frame,
  noir,
  corporate,
  executive,
  capsule,
  summit,
};

export function renderHtml(d: RenderDoc, opts: RenderOptions): string {
  const fn = RENDERERS[(TEMPLATE_IDS as readonly string[]).includes(d.template) ? (d.template as TemplateId) : 'classic'];
  const { css, body } = fn(d, opts);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titleOf(d.type))} ${esc(d.number)}</title>
  <style>${baseCss(d)}${css}</style></head>
  <body><div class="page">${body}</div>${watermark(opts.watermark)}</body></html>`;
}
