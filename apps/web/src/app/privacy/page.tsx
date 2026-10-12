import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY, LegalPage, List, Mail, Phone, Section } from '@/components/legal/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How tuli collects, uses and protects your personal data.',
};

const SECTIONS: { id: string; title: string }[] = [
  { id: 'who', title: 'Who we are' },
  { id: 'collect', title: 'What we collect' },
  { id: 'use', title: 'How we use it' },
  { id: 'clients', title: 'Your clients’ details' },
  { id: 'share', title: 'Who we share it with' },
  { id: 'cookies', title: 'Cookies' },
  { id: 'keep', title: 'How long we keep it' },
  { id: 'security', title: 'How we protect it' },
  { id: 'rights', title: 'Your rights' },
  { id: 'transfers', title: 'Where your data is processed' },
  { id: 'children', title: 'Children' },
  { id: 'changes', title: 'Changes to this policy' },
  { id: 'contact', title: 'Contact us' },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="12 October 2026"
      sections={SECTIONS}
      intro={
        <p>
          tuli helps businesses create invoices, quotes and receipts. This policy explains, in plain language, what personal data we collect when you use
          tulidocs.com, why we need it, who we share it with and the choices you have. We collect only what we need to run the service, and we never sell your
          data. See also our{' '}
          <Link href="/terms/" className="link">
            Terms of Service
          </Link>
          .
        </p>
      }
    >
      <Section id="who" title="Who we are">
        <p>
          tuli is operated by <strong>Nubian Networks Limited</strong>, a company registered in Kenya, Nairobi (“we”, “us”). For the account, billing and
          website data described here we are the <em>data controller</em> under Kenya’s Data Protection Act, 2019.
        </p>
      </Section>

      <Section id="collect" title="What we collect">
        <p>
          <strong>Account details.</strong> Your name, email address and a securely hashed password. If you sign in with Google, we receive your name, email
          address and Google account ID from Google — we never see your Google password.
        </p>
        <p>
          <strong>Business details.</strong> What you add in Settings: business name, logo, address, phone, email, website, country, currency, tax number (for
          example a KRA PIN) and payment details such as an M-Pesa paybill or bank account to print on your documents.
        </p>
        <p>
          <strong>Documents and clients.</strong> The invoices, quotes and receipts you create, including your clients’ names, contact details, tax numbers,
          line items and amounts. See{' '}
          <a href="#clients" className="link">
            Your clients’ details
          </a>
          .
        </p>
        <p>
          <strong>Payments to tuli.</strong> When you pay for a plan or to remove a watermark, we keep the amount, currency, date, payment method, your phone
          number (for M-Pesa) or email (for cards) and the payment reference.{' '}
          <strong>Card numbers are entered directly with our payment provider, Paystack — they never reach our servers.</strong>
        </p>
        <p>
          <strong>Feedback.</strong> Ideas, comments and votes you post on the feedback board, and the name you choose to show. Public posts show only your
          initials; private messages are visible only to our team.
        </p>
        <p>
          <strong>Technical data.</strong> Your IP address and approximate country (used to show prices in your currency and to protect the service against
          abuse), plus standard server logs such as time, page requested and browser type.
        </p>
        <p>We do not use advertising trackers or third-party analytics.</p>
      </Section>

      <Section id="use" title="How we use it">
        <List
          items={[
            'To provide the service: create, store, preview and download your documents, and keep your client list and numbering.',
            'To sign you in and keep your account secure, including rate limits and fraud prevention.',
            'To process payments and keep records we are required to keep for tax and accounting.',
            'To show prices and defaults (currency, tax wording) that fit your country.',
            'To answer your questions and feedback, and to tell you about important changes to the service.',
            'To understand and fix problems, and to improve tuli.',
          ]}
        />
        <p>
          Our legal bases are: performing our contract with you (running your account), our legitimate interests (security, improving the service), legal
          obligations (tax and accounting records) and, where we ask for it, your consent — which you can withdraw at any time.
        </p>
      </Section>

      <Section id="clients" title="Your clients’ details">
        <p>
          When you add a client to an invoice, you decide what goes on it. For that information you are the data controller and we process it on your behalf,
          only to provide the service to you. Please make sure you have a lawful reason to share your clients’ details with us, for example because you are
          invoicing them for work you did.
        </p>
        <p>We do not contact your clients, and we do not use their details for any purpose of our own.</p>
      </Section>

      <Section id="share" title="Who we share it with">
        <p>We share personal data only with service providers that help us run tuli, and only what each needs:</p>
        <List
          items={[
            <>
              <strong>Paystack</strong> — processes card and M-Pesa payments to tuli.
            </>,
            <>
              <strong>Google</strong> — only if you choose “Continue with Google”, to sign you in.
            </>,
            <>
              <strong>Hosting and network providers</strong> (our servers, and Cloudflare for delivering and protecting the website).
            </>,
            <>
              <strong>Email providers</strong>, when we send you account emails such as password resets.
            </>,
          ]}
        />
        <p>
          We may also disclose information when the law requires it, to protect our rights or users’ safety, or as part of a sale or merger of our business (in
          which case this policy continues to apply). <strong>We never sell your personal data.</strong>
        </p>
      </Section>

      <Section id="cookies" title="Cookies">
        <p>We use a small number of cookies that are needed for tuli to work. There are no advertising or tracking cookies.</p>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-sidebar text-[13px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Cookie</th>
                <th className="px-4 py-2.5 font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="px-4 py-2.5 font-mono text-[13px]">nv_token</td>
                <td className="px-4 py-2.5">Keeps you signed in.</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-[13px]">nv_guest</td>
                <td className="px-4 py-2.5">Remembers documents you create without an account on this device.</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-[13px]">nv_fb</td>
                <td className="px-4 py-2.5">Remembers your votes on the feedback board so they can’t be counted twice.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>Our payment provider may set its own cookies inside its secure payment window.</p>
      </Section>

      <Section id="keep" title="How long we keep it">
        <List
          items={[
            'Account, business details, documents and clients: for as long as your account is open. You can delete documents and clients at any time.',
            'Documents created without an account: deleted automatically after 30 days if unpaid, or after one year if you paid to remove the watermark.',
            'Payment records: kept for as long as Kenyan tax and accounting law requires, even after an account is closed.',
            'Server logs: kept for a short period for security and troubleshooting.',
          ]}
        />
        <p>When you close your account we delete or anonymise your data, except records we are legally required to keep.</p>
      </Section>

      <Section id="security" title="How we protect it">
        <p>
          We use encryption in transit (HTTPS), hashed passwords, secure sign-in cookies, access controls so that each business only ever sees its own data,
          rate limits against abuse, and payments handled by a licensed payment provider. No system is perfectly secure; if a breach affecting your data occurs,
          we will notify you and the Office of the Data Protection Commissioner as the law requires.
        </p>
      </Section>

      <Section id="rights" title="Your rights">
        <p>Under Kenya’s Data Protection Act you have the right to:</p>
        <List
          items={[
            'be told how your data is used (this policy);',
            'get a copy of the personal data we hold about you;',
            'have inaccurate data corrected — most of it you can edit yourself in Settings;',
            'have your data deleted, subject to records we must keep by law;',
            'object to or restrict certain uses of your data;',
            'receive your data in a portable format.',
          ]}
        />
        <p>
          To use any of these rights, email <Mail /> from the address on your account. We will reply within 30 days. If you are not satisfied with our answer,
          you can complain to the{' '}
          <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer" className="link">
            Office of the Data Protection Commissioner
          </a>
          .
        </p>
      </Section>

      <Section id="transfers" title="Where your data is processed">
        <p>
          Some of our service providers (for example for payments, sign-in and website delivery) may process data outside Kenya. When that happens we rely on
          providers that give appropriate safeguards for your data, as the Data Protection Act requires.
        </p>
      </Section>

      <Section id="children" title="Children">
        <p>tuli is a tool for businesses and is not meant for children under 18. We do not knowingly collect children’s personal data.</p>
      </Section>

      <Section id="changes" title="Changes to this policy">
        <p>
          We may update this policy as tuli changes. We will change the date at the top, and for significant changes we will let you know by email or in the app
          before they take effect.
        </p>
      </Section>

      <Section id="contact" title="Contact us">
        <p>
          Questions about privacy or your data: <Mail />.
          <br />
          Phone / WhatsApp: <Phone />
          <br />
          {COMPANY.name}, {COMPANY.place}.
        </p>
        <p>
          Ideas or suggestions about tuli are welcome on our{' '}
          <Link href="/feedback/" className="link">
            feedback board
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
