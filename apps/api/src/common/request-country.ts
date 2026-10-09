import type { Request } from 'express';
import { isCountryCode } from './countries';

/**
 * Visitor's country for pricing: Cloudflare's CF-IPCountry header (the site is behind Cloudflare)
 * wins over what the browser claims, so regional prices can't be picked freely.
 */
export function requestCountry(req: Request, claimed?: string | null): string | null {
  const cf = String(req.headers['cf-ipcountry'] ?? '').toUpperCase();
  if (isCountryCode(cf) && cf !== 'XX' && cf !== 'T1') return cf;
  const c = (claimed ?? '').toUpperCase();
  return isCountryCode(c) ? c : null;
}
