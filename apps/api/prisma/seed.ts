/**
 * Demo data for local development:
 *   - platform admin   admin@nubiannetworks.com / Admin@2026
 *   - demo business    demo@tulidocs.com  / Demo@2026  (Starter plan, a few documents)
 *   - sample ideas on the public feedback board (only when the board is empty)
 * Safe to run more than once.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@nubiannetworks.com' },
    update: {},
    create: { email: 'admin@nubiannetworks.com', name: 'Platform Admin', role: 'SYSTEM_ADMIN', passwordHash: await bcrypt.hash('Admin@2026', 11), emailVerifiedAt: new Date() },
  });

  await seedFeedback();

  // Renamed from Nubian Invoices: move the old demo login over instead of creating a second demo business
  await prisma.user.updateMany({ where: { email: 'demo@nubianinvoices.com' }, data: { email: 'demo@tulidocs.com' } });
  // Team replies seeded under the old name
  await prisma.feedbackComment.updateMany({ where: { authorName: 'Nubian Invoices team' }, data: { authorName: 'tuli team' } });
  await prisma.feedbackPost.updateMany({ where: { authorName: 'Nubian Invoices team' }, data: { authorName: 'tuli team' } });

  const existing = await prisma.user.findUnique({ where: { email: 'demo@tulidocs.com' } });
  if (existing) {
    console.log('Seed already applied.');
    return;
  }
  const year = new Date();
  year.setFullYear(year.getFullYear() + 1);
  const org = await prisma.organization.create({
    data: {
      name: 'Savanna Creative Studio',
      email: 'hello@savannacreative.co.ke',
      phone: '+254 712 345 678',
      address: 'Ngong Road, Kilimani\nNairobi, Kenya',
      taxId: 'P051234567X',
      country: 'KE',
      currency: 'KES',
      taxName: 'VAT',
      taxIdLabel: 'KRA PIN',
      defaultTaxRate: '16',
      mpesaPaybill: '247247',
      mpesaAccount: '0712345678',
      bankDetails: 'Equity Bank · A/C 0123456789012 · Upper Hill branch',
      defaultTerms: 'Payment due within 14 days. Thank you for your business.',
      plan: 'STARTER',
      billingCycle: 'YEARLY',
      planExpiresAt: year,
    },
  });
  await prisma.user.create({
    data: { organizationId: org.id, email: 'demo@tulidocs.com', name: 'Wanjiru Kamau', role: 'ADMIN', passwordHash: await bcrypt.hash('Demo@2026', 11), emailVerifiedAt: new Date() },
  });
  const client = await prisma.client.create({
    data: { organizationId: org.id, name: 'Acacia Lodge Ltd', email: 'accounts@acacialodge.co.ke', phone: '0722 000 111', address: 'Naivasha', taxId: 'P052345678Y' },
  });
  const today = new Date();
  const iso = (d: Date) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  await prisma.document.create({
    data: {
      organizationId: org.id,
      type: 'INVOICE',
      status: 'SENT',
      number: 'INV-0001',
      template: 'modern',
      currency: 'KES',
      taxName: 'VAT',
      taxIdLabel: 'KRA PIN',
      issueDate: iso(today),
      dueDate: iso(due),
      fromName: org.name,
      fromEmail: org.email,
      fromPhone: org.phone,
      fromAddress: org.address,
      fromTaxId: org.taxId,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      clientAddress: client.address,
      clientTaxId: client.taxId,
      subtotal: '85000',
      taxTotal: '13600',
      total: '98600',
      terms: org.defaultTerms,
      paymentInfo: `M-Pesa Paybill: 247247  ·  Account: 0712345678\n${org.bankDetails}`,
      items: {
        create: [
          { position: 0, description: 'Brand identity design (logo, colours, type)', quantity: '1', unitPrice: '60000', taxRate: '16', amount: '60000' },
          { position: 1, description: 'Social media templates', quantity: '10', unitPrice: '2500', taxRate: '16', amount: '25000' },
        ],
      },
    },
  });
  await prisma.sequence.create({ data: { organizationId: org.id, type: 'INVOICE', next: 2 } });
  console.log('Seeded demo business and platform admin.');
}

/** Sample ideas for the public feedback board — added once, while the board is empty */
async function seedFeedback() {
  if (await prisma.feedbackPost.count()) return;
  const day = 86_400_000;
  const ago = (d: number) => new Date(Date.now() - d * day);
  const ideas: {
    title: string; body: string; category: 'FEATURE' | 'IMPROVEMENT' | 'BUG' | 'PRIVATE'; status: 'OPEN' | 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'DECLINED';
    by: string; votes: number; down?: number; days: number; comments?: { by: string; body: string; team?: boolean; days: number }[];
  }[] = [
    {
      title: 'Send invoices straight to WhatsApp',
      body: 'Most of my clients pay faster when I send the invoice on WhatsApp. A “Share to WhatsApp” button with the PDF and a payment link would save me downloading and attaching it every time.',
      category: 'FEATURE', status: 'PLANNED', by: 'Wanjiru · Savanna Creative Studio', votes: 48, days: 21,
      comments: [
        { by: 'Brian · Kilele Motors', body: 'Yes please — and the same for receipts once a client pays.', days: 19 },
        { by: 'tuli team', body: 'Thanks everyone! This is planned — we’re starting with WhatsApp sharing for invoices and receipts, then email.', team: true, days: 15 },
      ],
    },
    {
      title: 'Recurring invoices for monthly retainers',
      body: 'I bill the same clients the same amount every month. Let me set an invoice to repeat (monthly / quarterly) and create the next one automatically as a draft.',
      category: 'FEATURE', status: 'IN_PROGRESS', by: 'Daniel · Mara Digital', votes: 36, days: 30,
      comments: [{ by: 'tuli team', body: 'We’re building this now — drafts first, with automatic sending to follow.', team: true, days: 6 }],
    },
    {
      title: 'Payment reminders before and after the due date',
      body: 'An automatic polite reminder 3 days before the due date and again when an invoice is overdue would help a lot with late payers.',
      category: 'FEATURE', status: 'PLANNED', by: 'Amina · Coastline Events', votes: 31, days: 18,
    },
    {
      title: 'Accept M-Pesa payments directly on the invoice',
      body: 'A “Pay with M-Pesa” button on the invoice that sends an STK push to the client, and marks the invoice paid when it goes through.',
      category: 'FEATURE', status: 'OPEN', by: 'Kevin · Rift Valley Supplies', votes: 27, days: 12,
      comments: [{ by: 'Grace · Nyota Salon', body: 'This would be a game changer for my small business.', days: 10 }],
    },
    {
      title: 'Export invoices and receipts to Excel / CSV',
      body: 'My accountant asks for a list of everything I invoiced and received each month. An export with dates, clients, totals and VAT would make month-end much easier.',
      category: 'IMPROVEMENT', status: 'DONE', by: 'Peter · Highland Builders', votes: 22, days: 45,
      comments: [{ by: 'tuli team', body: 'Done — you can now filter by date range on Quotes, Invoices and Receipts. CSV export is next.', team: true, days: 3 }],
    },
    {
      title: 'Add more than one tax rate on a document',
      body: 'Some of my items are VAT-exempt and some are 16%. Being able to show both clearly on the same invoice would help.',
      category: 'IMPROVEMENT', status: 'OPEN', by: 'Lucy · Green Leaf Organics', votes: 14, down: 2, days: 9,
    },
    {
      title: 'Logo looks a bit soft on the Minimal template',
      body: 'My PNG logo looks slightly blurry on the Minimal template PDF compared to Classic. It’s a 512px PNG.',
      category: 'BUG', status: 'IN_PROGRESS', by: 'Samuel · Studio Kaya', votes: 6, days: 4,
      comments: [{ by: 'tuli team', body: 'Thanks for reporting — we can reproduce it and a fix is on the way.', team: true, days: 2 }],
    },
    {
      title: 'Dark mode',
      body: 'I do my invoicing late at night — a dark theme would be easier on the eyes.',
      category: 'IMPROVEMENT', status: 'OPEN', by: 'Joy', votes: 9, down: 4, days: 2,
    },
    {
      title: 'Question about my yearly plan',
      body: 'I paid for Starter yearly last week but my receipt shows the monthly amount. Could you check? (Private — only for the team.)',
      category: 'PRIVATE', status: 'OPEN', by: 'Anonymous', votes: 0, days: 1,
    },
  ];
  for (const i of ideas) {
    await prisma.feedbackPost.create({
      data: {
        title: i.title,
        body: i.body,
        category: i.category,
        status: i.status,
        authorName: i.by,
        voteCount: i.votes,
        downCount: i.down ?? 0,
        commentCount: i.comments?.length ?? 0,
        createdAt: ago(i.days),
        comments: { create: (i.comments ?? []).map((c) => ({ authorName: c.by, body: c.body, isTeam: !!c.team, createdAt: ago(c.days) })) },
      },
    });
  }
  console.log(`Seeded ${ideas.length} feedback ideas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
