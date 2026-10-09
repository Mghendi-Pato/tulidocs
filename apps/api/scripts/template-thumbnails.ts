/**
 * Regenerates the template thumbnails used on the landing page and in the template picker:
 *   npx ts-node --transpile-only scripts/template-thumbnails.ts
 * Writes apps/web/public/templates/<id>.webp (sample data, no watermark).
 */
import 'dotenv/config';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { renderHtml, RenderDoc, TEMPLATE_IDS } from '../src/render/templates';

const ACCENTS: Record<string, string> = {
  classic: '#2451d6', modern: '#0d9488', minimal: '#c8102e', elegant: '#7c3aed', bold: '#d97706',
  wave: '#3f4652', corners: '#2c7a8c', gratitude: '#a87b4f', vivid: '#3b2fd1', ribbon: '#1f4fa3', stripes: '#2fb380',
  statement: '#e2533b', monogram: '#b8a58f', ledger: '#0b1529', headline: '#c8102e', frame: '#f4c430', noir: '#ef6c2f',
  corporate: '#b8203b', executive: '#e08a2e', capsule: '#3fa34d', summit: '#d81b60',
};

const sample = (template: string): RenderDoc => ({
  type: 'INVOICE',
  number: 'INV-0042',
  issueDate: '2026-10-07',
  dueDate: '2026-10-21',
  currency: 'USD',
  template,
  accent: ACCENTS[template] ?? '#2451d6',
  taxName: 'VAT',
  taxIdLabel: 'VAT No.',
  from: { name: 'Northwind Studio', email: 'hello@northwind.studio', phone: '+44 20 7946 0958', address: '14 Market Street\nLondon EC2A 4NE', taxId: 'GB 123 4567 89' },
  to: { name: 'Acacia Hotels Ltd', email: 'accounts@acaciahotels.com', address: '22 Harbour Road\nCape Town', taxId: '4120 1234 56' },
  items: [
    { description: 'Brand identity design', quantity: '1', unitPrice: '2400', taxRate: '20', amount: '2400' },
    { description: 'Social media templates', quantity: '10', unitPrice: '45', taxRate: '20', amount: '450' },
    { description: 'Photography (half day)', quantity: '1', unitPrice: '650', taxRate: '20', amount: '650' },
  ],
  subtotal: '3500',
  discount: '0',
  taxTotal: '700',
  total: '4200',
  amountPaid: '0',
  notes: 'Thank you for your business.',
  terms: 'Payment due within 14 days.',
  paymentInfo: 'Bank: Barclays · Sort code 20-00-00 · Acc 12345678\nPayPal: billing@northwind.studio',
});

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1.5 });
  const out = path.resolve(__dirname, '../../web/public/templates');
  for (const id of TEMPLATE_IDS) {
    await page.setContent(renderHtml(sample(id), { watermark: false, footer: 'Made with tuli · tulidocs.com' }), { waitUntil: 'load' });
    await page.screenshot({ path: `${out}/${id}.webp` as `${string}.webp`, type: 'webp', quality: 86 });
    console.log(`✓ ${id}`);
  }
  await browser.close();
})();
