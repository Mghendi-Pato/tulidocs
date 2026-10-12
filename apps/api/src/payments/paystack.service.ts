import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Card payments via Paystack (Kenya: Visa/Mastercard in KES, settles to a Kenyan bank or M-Pesa).
 * PLACEHOLDER-READY:
 *  - CARD_MODE=mock → no network; the "card page" is a local URL that marks the payment as paid (dev only)
 *  - CARD_MODE=live → PAYSTACK_SECRET_KEY (sk_test_… for test mode, sk_live_… for live)
 *
 * Flow: initialize → the web app opens Paystack's popup with access_code (customer stays on tuli)
 *   — or, if the popup can't load, redirects to authorization_url and Paystack sends them back to our return page —
 * → we verify the reference (and the charge.success webhook confirms it again, idempotently).
 */
@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly base = 'https://api.paystack.co';

  constructor(private readonly config: ConfigService) {}

  /** References we create for Paystack (card and, by default, M-Pesa) */
  static isPaystackRef(ref: string | null | undefined) {
    return !!ref && /^(tuli|nvi)_/.test(ref);
  }

  get mode(): 'mock' | 'live' {
    return this.config.get<string>('CARD_MODE', 'mock') === 'live' ? 'live' : 'mock';
  }

  private get secret() {
    const s = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!s) throw new ServiceUnavailableException({ code: 'CARD_UNAVAILABLE', message: 'Card payments are not configured yet' });
    return s;
  }

  async initialize(input: {
    email: string;
    amount: number;
    currency: string;
    reference: string;
    callbackUrl: string;
    metadata: Record<string, unknown>;
    /** card | mobile_money (M-Pesa in Kenya) */
    channels?: string[];
  }) {
    if (this.mode === 'mock') {
      const api = this.config.get<string>('API_PUBLIC_URL', 'http://localhost:3000/api');
      return { authorizationUrl: `${api}/payments/card/mock?reference=${encodeURIComponent(input.reference)}`, accessCode: undefined as string | undefined };
    }
    const res = await fetch(`${this.base}/transaction/initialize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        amount: Math.round(input.amount * 100), // lowest unit (cents)
        currency: input.currency,
        reference: input.reference,
        callback_url: input.callbackUrl,
        channels: input.channels ?? ['card'],
        metadata: input.metadata,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: { authorization_url: string; access_code: string } };
    if (!res.ok || !body.status || !body.data) {
      this.logger.warn(`Paystack initialize failed: ${res.status} ${body.message}`);
      throw new ServiceUnavailableException({ code: 'CARD_UNAVAILABLE', message: body.message ?? 'Could not start the card payment' });
    }
    return { authorizationUrl: body.data.authorization_url, accessCode: body.data.access_code as string | undefined };
  }

  /** success | failed | abandoned | pending … */
  async verify(reference: string): Promise<{ status: string; amount: number; currency: string; raw: unknown }> {
    const res = await fetch(`${this.base}/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${this.secret}` } });
    const body = (await res.json().catch(() => ({}))) as { data?: { status: string; amount: number; currency: string } };
    if (!res.ok || !body.data) return { status: 'pending', amount: 0, currency: '', raw: body };
    return { status: body.data.status, amount: body.data.amount / 100, currency: body.data.currency, raw: body.data };
  }

  /** x-paystack-signature = HMAC-SHA512(raw body, secret key) */
  validSignature(raw: Buffer | undefined, signature: string | undefined): boolean {
    if (!raw || !signature || this.mode === 'mock') return false;
    const expected = createHmac('sha512', this.secret).update(raw).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
