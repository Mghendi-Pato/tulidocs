/**
 * Renders the three fanned sheets on the landing hero:
 *   npx ts-node --transpile-only scripts/hero-images.ts
 * Writes apps/web/public/hero/<name>.webp — same template in three accent colours.
 */
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import puppeteer from 'puppeteer';
import { renderHtml, RenderDoc } from '../src/render/templates';

const SHEETS = [
  { name: 'sky', template: 'modern', accent: '#3b9ad9' },
  { name: 'rose', template: 'modern', accent: '#d9708f' },
  { name: 'navy', template: 'modern', accent: '#1d2b53' },
];

const doc = (template: string, accent: string): RenderDoc => ({
  type: 'INVOICE',
  number: 'INV-0042',
  issueDate: '2026-10-07',
  dueDate: '2026-10-21',
  currency: 'USD',
  template,
  accent,
  taxName: 'VAT',
  taxIdLabel: 'VAT No.',
  from: { name: 'Northwind Studio', email: 'hello@northwind.studio', phone: '+44 20 7946 0958', address: '14 Market Street\nLondon EC2A 4NE', taxId: 'GB 123 4567 89' },
  to: { name: 'Acacia Hotels Ltd', email: 'accounts@acaciahotels.com', address: '22 Harbour Road\nCape Town', taxId: '4120 1234 56' },
  items: [
    { description: 'Brand identity design', quantity: '1', unitPrice: '2400', taxRate: '20', amount: '2400' },
    { description: 'Social media templates', quantity: '10', unitPrice: '45', taxRate: '20', amount: '450' },
    { description: 'Photography (half day)', quantity: '1', unitPrice: '650', taxRate: '20', amount: '650' },
    { description: 'Website copywriting', quantity: '4', unitPrice: '120', taxRate: '20', amount: '480' },
    { description: 'Print-ready brochure', quantity: '1', unitPrice: '520', taxRate: '20', amount: '520' },
  ],
  subtotal: '4500',
  discount: '0',
  taxTotal: '900',
  total: '5400',
  amountPaid: '0',
  notes: 'Thank you for your business.',
  terms: 'Payment due within 14 days.',
  paymentInfo: 'Bank: Barclays · Sort code 20-00-00 · Acc 12345678\nPayPal: billing@northwind.studio',
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.25 });
  const out = path.resolve(__dirname, '../../web/public/hero');
  fs.mkdirSync(out, { recursive: true });
  for (const s of SHEETS) {
    await page.setContent(renderHtml(doc(s.template, s.accent), { watermark: false, footer: 'Made with tuli · tulidocs.com' }), { waitUntil: 'load' });
    await page.screenshot({ path: `${out}/${s.name}.webp` as `${string}.webp`, type: 'webp', quality: 84 });
    console.log(`✓ ${s.name}`);
  }
  await browser.close();
})();
