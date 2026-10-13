import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

/** "Add to home screen" on phones: name, colours and icons */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'tuli — invoices, quotes and receipts',
    short_name: 'tuli',
    description: 'Professional invoices, quotes and receipts in minutes — any currency, any country.',
    start_url: '/dashboard/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/images/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
