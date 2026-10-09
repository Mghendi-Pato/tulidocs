import { createPrivateKey, createPublicKey, sign, verify, type JsonWebKey } from 'node:crypto';

/**
 * Sign in with Apple helpers — no extra libraries:
 *  - the client secret is a short-lived ES256 JWT signed with your Apple key (.p8)
 *  - Apple's id_token (RS256) is checked against Apple's published keys
 */
export interface AppleConfig {
  servicesId: string; // e.g. com.tulidocs.web (the "Services ID", used as client_id)
  teamId: string;
  keyId: string;
  privateKey: string; // contents of AuthKey_XXXX.p8
  redirectUri: string;
}

const b64url = (v: Buffer | string) => Buffer.from(v).toString('base64url');

export function appleClientSecret(c: AppleConfig) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: c.keyId }));
  const payload = b64url(JSON.stringify({ iss: c.teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: c.servicesId }));
  const key = createPrivateKey(c.privateKey.replace(/\\n/g, '\n'));
  const sig = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64url(sig)}`;
}

export function appleAuthorizeUrl(c: AppleConfig, state: string) {
  const q = new URLSearchParams({
    client_id: c.servicesId,
    redirect_uri: c.redirectUri,
    response_type: 'code',
    response_mode: 'form_post', // required when asking for name / email
    scope: 'name email',
    state,
  });
  return `https://appleid.apple.com/auth/authorize?${q}`;
}

export interface AppleIdentity {
  sub: string;
  email?: string;
  emailVerified: boolean;
}

let keysCache: { at: number; keys: (JsonWebKey & { kid: string })[] } | null = null;

async function appleKeys() {
  if (keysCache && Date.now() - keysCache.at < 60 * 60_000) return keysCache.keys;
  const res = await fetch('https://appleid.apple.com/auth/keys');
  if (!res.ok) throw new Error(`Apple keys: HTTP ${res.status}`);
  const body = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
  keysCache = { at: Date.now(), keys: body.keys };
  return body.keys;
}

/** Swaps the authorization code for Apple's id_token and verifies it */
export async function appleExchange(c: AppleConfig, code: string): Promise<AppleIdentity> {
  const res = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.servicesId, client_secret: appleClientSecret(c), code, grant_type: 'authorization_code', redirect_uri: c.redirectUri }),
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !body.id_token) throw new Error(`Apple token: ${body.error ?? res.status}`);
  return verifyAppleIdToken(body.id_token, c.servicesId);
}

export async function verifyAppleIdToken(idToken: string, audience: string): Promise<AppleIdentity> {
  const [h, p, s] = idToken.split('.');
  if (!h || !p || !s) throw new Error('Malformed id_token');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString()) as { kid: string; alg: string };
  if (header.alg !== 'RS256') throw new Error('Unexpected id_token algorithm');
  const jwk = (await appleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown Apple signing key');
  const ok = verify('sha256', Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  if (!ok) throw new Error('Bad id_token signature');
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString()) as { iss: string; aud: string; exp: number; sub: string; email?: string; email_verified?: boolean | string };
  if (claims.iss !== 'https://appleid.apple.com' || claims.aud !== audience || claims.exp * 1000 < Date.now()) throw new Error('Invalid id_token claims');
  return { sub: claims.sub, email: claims.email?.toLowerCase(), emailVerified: claims.email_verified === true || claims.email_verified === 'true' };
}
