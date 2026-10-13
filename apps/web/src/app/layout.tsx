import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

/** Public address of the site — link previews (WhatsApp, Facebook, X, LinkedIn…) need absolute URLs */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tulidocs.com').replace(/\/$/, '');
const TITLE = 'tuli — invoices, quotes and receipts';
const DESCRIPTION = 'Professional invoices, quotes and receipts in minutes — any currency, any country. Beautiful templates, PDF download, M-Pesa and card payments.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'tuli',
  title: { default: TITLE, template: '%s · tuli' },
  description: DESCRIPTION,
  // favicon.ico, icon.svg and apple-icon.png sit in this folder and are picked up automatically
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: 'tuli',
    url: '/',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: 'tuli — invoices, quotes and receipts in minutes' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.jpg'],
  },
  appleWebApp: { title: 'tuli', capable: true, statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
