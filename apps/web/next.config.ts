import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

/**
 * Production: `next build` emits a static site to ./out — Nginx serves it from /var/www
 * and proxies /api/ to the NestJS API (see deploy/nginx/tulidocs.conf).
 * Development: `next dev` proxies /api/* to API_URL so the auth cookie stays first-party.
 */
export default function config(phase: string): NextConfig {
  const base: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    devIndicators: false, // hide the Next.js "N" badge in development
    trailingSlash: true,
    images: { unoptimized: true },
  };

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const API_URL = process.env.API_URL ?? 'http://localhost:4400';
    return {
      ...base,
      async rewrites() {
        return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
      },
    };
  }

  return { ...base, output: 'export' };
}
