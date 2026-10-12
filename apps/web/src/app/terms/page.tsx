import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY, LegalPage, List, Mail, Phone, Section } from '@/components/legal/legal';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that apply when you use tuli to create invoices, quotes and receipts.',
};

const SECTIONS = [
  { id: 'agreement', title: 'Agreement' },
  { id: 'service', title: 'The service' },
  { id: 'accounts', title: 'Your account' },
  { id: 'guests', title: 'Using tuli without an account' },
  { id: 'plans', title: 'Plans and payments' },
  { id: 'refunds', title: 'Refunds' },
  { id: 'responsibility', title: 'Your documents, your responsibility' },
  { id: 'acceptable', title: 'Acceptable use' },
  { id: 'content', title: 'Your content' },
  { id: 'ours', title: 'Our property' },
  { id: 'availability', title: 'Availability and changes' },
  { id: 'ending', title: 'Ending your use' },
  { id: 'liability', title: 'Disclaimers and liability' },
  { id: 'law', title: 'Governing law and disputes' },
  { id: 'changes', title: 'Changes to these terms' },
  { id: 'contact', title: 'Contact us' },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="12 October 2026"
      sections={SECTIONS}
      intro={
        <p>
          These terms explain the rules for using tuli at tulidocs.com. We have kept them as short and plain as we can. Please read them together with our{' '}
          <Link href="/privacy/" className="link">
            Privacy Policy
          </Link>
          , which explains how we handle your data.
        </p>
      }
    >
      <Section id="agreement" title="Agreement">
        <p>
          tuli is provided by <strong>{COMPANY.name}</strong>, a company registered in Kenya (“we”, “us”). By creating an account or using tuli — including
          creating a document without an account — you agree to these terms. If you use tuli for a business, you confirm you are allowed to accept these terms on
          its behalf, and “you” includes that business.
        </p>
        <p>You must be at least 18 years old to use tuli.</p>
      </Section>

      <Section id="service" title="The service">
        <p>
          tuli lets you create, store and download invoices, quotes and receipts, keep a list of your clients and track what has been paid. Some features are free;
          others need a paid plan or a one-off payment, as shown on our pricing and billing pages. Features marked “coming soon” are not yet part of the service.
        </p>
      </Section>

      <Section id="accounts" title="Your account">
        <List
          items={[
            'Give accurate details and keep them up to date.',
            'Keep your password safe and do not share your account. You are responsible for what happens under your account.',
            'Tell us straight away if you think someone has accessed your account without permission.',
            'Only the business administrator can change the plan or make payments for the business.',
          ]}
        />
      </Section>

      <Section id="guests" title="Using tuli without an account">
        <p>
          You can create documents without an account. They are saved only for the device and browser you used, and unpaid drafts are deleted automatically after
          30 days (or one year if you paid to remove the watermark). If you clear your browser data or switch devices, you may lose access to them. Create a free
          account to keep your documents safely.
        </p>
      </Section>

      <Section id="plans" title="Plans and payments">
        <List
          items={[
            <>
              <strong>Prices.</strong> Prices are shown before you pay, in your local currency where available (for example KES in Kenya, US dollars elsewhere),
              and include any fees we charge. Your bank or mobile money provider may charge its own fees.
            </>,
            <>
              <strong>No automatic renewals.</strong> Plans are paid in advance for a month or a year and do not renew by themselves. Nothing is charged unless
              you choose to pay.
            </>,
            <>
              <strong>Extending.</strong> If you pay again while your plan is active, the new time is added after your current end date — you never lose paid
              time.
            </>,
            <>
              <strong>Upgrading.</strong> When you move to a longer billing period or a higher plan, the unused value of the time you have already paid for is
              credited against the new price, and the new period starts on the day you upgrade. The amount due is shown before you pay.
            </>,
            <>
              <strong>When a plan ends.</strong> After a short grace period of 3 days your account returns to the Free plan. Your documents and clients stay
              safe; new PDFs carry a watermark again until you renew.
            </>,
            <>
              <strong>Removing a watermark.</strong> A one-off payment removes the watermark from one document. If you change that document’s content afterwards,
              the watermark may return and a new payment may be needed.
            </>,
            <>
              <strong>Payment processing.</strong> Payments are processed by our payment provider (Paystack) by card or M-Pesa. A payment counts once the provider
              confirms it to us.
            </>,
            <>
              <strong>Price changes.</strong> We may change prices for future purchases. Changes never affect time you have already paid for.
            </>,
          ]}
        />
      </Section>

      <Section id="refunds" title="Refunds">
        <p>Because plans don’t renew automatically and you can see the price before paying, payments are generally not refundable. We will refund or fix it if:</p>
        <List
          items={[
            'you were charged twice for the same thing,',
            'you paid but did not receive what you paid for and we cannot fix it, or',
            'the law requires a refund.',
          ]}
        />
        <p>
          Contact us within 14 days of the payment at <Mail /> or <Phone /> with your payment reference (for example your M-Pesa message). Refunds go back to the
          original payment method.
        </p>
      </Section>

      <Section id="responsibility" title="Your documents, your responsibility">
        <p>
          tuli is a tool for preparing documents. <strong>You are responsible for what your documents say</strong> — including prices, tax rates and tax
          wording, tax numbers, client details and numbering — and for meeting the tax and record-keeping rules that apply to your business, such as KRA
          requirements in Kenya. tuli does not give tax, legal or accounting advice. Please check your documents before you send them.
        </p>
        <p>
          Until KRA eTIMS integration is available in tuli, documents created in tuli are not eTIMS-validated invoices. If your business must issue eTIMS invoices,
          you remain responsible for doing so.
        </p>
      </Section>

      <Section id="acceptable" title="Acceptable use">
        <p>Do not use tuli to:</p>
        <List
          items={[
            'create false, fraudulent or misleading documents, or impersonate another business or person;',
            'break any law, including tax, consumer protection and data protection laws;',
            'upload content you do not have the right to use, such as another company’s logo;',
            'attack, overload, scrape or try to break into tuli or other users’ accounts, or get around limits, watermarks or payments;',
            'send spam or harmful content through tuli or its feedback board.',
          ]}
        />
        <p>We may remove content or suspend accounts that break these rules.</p>
      </Section>

      <Section id="content" title="Your content">
        <p>
          You own the content you put into tuli — your business details, logo, clients and documents. You give us permission to store, process and display it only
          as needed to run tuli for you. You confirm you have the right to use that content, including your clients’ details.
        </p>
        <p>
          Ideas and feedback you share on the feedback board help us improve tuli. You let us use them freely, without any obligation to you; public posts can be
          seen by other visitors.
        </p>
      </Section>

      <Section id="ours" title="Our property">
        <p>
          tuli — including its software, templates, designs, name and logo — belongs to {COMPANY.name}. You may use the templates to create documents for your
          business, but you may not copy, resell or redistribute tuli or its templates, or build a competing product from them.
        </p>
      </Section>

      <Section id="availability" title="Availability and changes">
        <p>
          We work to keep tuli available and your data safe, but we cannot promise the service will always be uninterrupted or error-free. We may change, add or
          remove features. If we make a change that takes away something you have paid for, we will give you reasonable notice and a fair refund for the unused
          time.
        </p>
        <p>We recommend keeping your own copies of important documents by downloading their PDFs.</p>
      </Section>

      <Section id="ending" title="Ending your use">
        <p>
          You can stop using tuli at any time and ask us to close your account. We may suspend or close an account that breaks these terms or that we must close
          by law; where we can, we will tell you why first and give you a chance to download your documents. Sections that by their nature should continue (such
          as ownership, liability and governing law) survive after your use ends.
        </p>
      </Section>

      <Section id="liability" title="Disclaimers and liability">
        <p>
          tuli is provided “as is” and “as available”. To the extent the law allows, we are not liable for indirect or consequential losses — such as lost profit,
          lost business or lost data — or for losses caused by mistakes in documents you create. Our total liability to you for any claim is limited to the
          amount you paid us in the 12 months before the claim.
        </p>
        <p>Nothing in these terms limits liability that cannot be limited by law, or your rights as a consumer under Kenyan law.</p>
      </Section>

      <Section id="law" title="Governing law and disputes">
        <p>
          These terms are governed by the laws of Kenya. If you have a problem, please contact us first — most issues can be solved quickly. If we cannot resolve
          it together, disputes will be handled by the courts of Kenya.
        </p>
      </Section>

      <Section id="changes" title="Changes to these terms">
        <p>
          We may update these terms as tuli changes. We will change the date at the top, and for significant changes we will tell you by email or in the app
          before they take effect. If you keep using tuli after a change takes effect, the new terms apply.
        </p>
      </Section>

      <Section id="contact" title="Contact us">
        <p>
          Email: <Mail />
          <br />
          Phone / WhatsApp: <Phone />
          <br />
          {COMPANY.name}, {COMPANY.place}.
        </p>
      </Section>
    </LegalPage>
  );
}
