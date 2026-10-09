import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

export interface StkResult {
  checkoutRequestId: string;
  merchantRequestId?: string;
  customerMessage: string;
}

export interface StkOutcome {
  checkoutRequestId: string;
  success: boolean;
  /** still waiting for the customer (STK query only) */
  pending?: boolean;
  resultDesc: string;
  receipt?: string;
  amount?: number;
  phone?: string;
}

/**
 * M-Pesa Daraja — Lipa na M-Pesa Online (STK Push). PLACEHOLDER-READY:
 *  - MPESA_MODE=mock     → no network; payments complete by themselves after a few seconds (dev only)
 *  - MPESA_MODE=sandbox  → https://sandbox.safaricom.co.ke (test credentials from developer.safaricom.co.ke)
 *  - MPESA_MODE=live     → https://api.safaricom.co.ke (Go-Live approved app)
 *
 * Paybill: MPESA_TRANSACTION_TYPE=CustomerPayBillOnline, PartyB = shortcode.
 * Till (Buy Goods): MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline, MPESA_SHORTCODE = store number, MPESA_PARTY_B = till number.
 */
@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  get mode(): 'mock' | 'sandbox' | 'live' {
    const m = this.config.get<string>('MPESA_MODE', 'mock');
    return m === 'live' || m === 'sandbox' ? m : 'mock';
  }

  private get baseUrl() {
    return this.mode === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  }

  private get shortcode() {
    return this.config.get<string>('MPESA_SHORTCODE', '174379');
  }

  private async token(): Promise<string> {
    const cached = await this.redis.getJson<string>('mpesa:token').catch(() => null);
    if (cached) return cached;
    const key = this.config.get<string>('MPESA_CONSUMER_KEY');
    const secret = this.config.get<string>('MPESA_CONSUMER_SECRET');
    if (!key || !secret) throw this.unavailable('M-Pesa is not configured (MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET)');
    const res = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: string };
    if (!res.ok || !body.access_token) throw this.unavailable(`M-Pesa auth failed (${res.status})`);
    await this.redis.setJson('mpesa:token', body.access_token, Math.max(60, Number(body.expires_in ?? 3599) - 120)).catch(() => undefined);
    return body.access_token;
  }

  private password(timestamp: string) {
    const passkey = this.config.get<string>('MPESA_PASSKEY', '');
    return Buffer.from(`${this.shortcode}${passkey}${timestamp}`).toString('base64');
  }

  private timestamp() {
    // yyyyMMddHHmmss in Nairobi time
    const d = new Date(Date.now() + 3 * 3_600_000);
    return d.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  }

  /** Sends the "Enter M-Pesa PIN" prompt to the customer's phone */
  async stkPush(input: { phone: string; amount: number; accountRef: string; description: string; callbackUrl: string }): Promise<StkResult> {
    if (this.mode === 'mock') {
      return { checkoutRequestId: `ws_CO_MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, customerMessage: 'Mock M-Pesa prompt sent' };
    }
    const timestamp = this.timestamp();
    const res = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: this.shortcode,
        Password: this.password(timestamp),
        Timestamp: timestamp,
        TransactionType: this.config.get<string>('MPESA_TRANSACTION_TYPE', 'CustomerPayBillOnline'),
        Amount: Math.ceil(input.amount),
        PartyA: input.phone,
        PartyB: this.config.get<string>('MPESA_PARTY_B') || this.shortcode,
        PhoneNumber: input.phone,
        CallBackURL: input.callbackUrl,
        AccountReference: input.accountRef.slice(0, 12),
        TransactionDesc: input.description.slice(0, 13),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, string>;
    if (!res.ok || body.ResponseCode !== '0') {
      this.logger.warn(`STK push failed: ${res.status} ${JSON.stringify(body)}`);
      throw this.unavailable(body.errorMessage || body.ResponseDescription || 'Could not send the M-Pesa prompt. Check the number and try again.');
    }
    return { checkoutRequestId: body.CheckoutRequestID, merchantRequestId: body.MerchantRequestID, customerMessage: body.CustomerMessage };
  }

  /** Asks Daraja for the result when the callback hasn't arrived */
  async stkQuery(checkoutRequestId: string): Promise<StkOutcome> {
    const timestamp = this.timestamp();
    const res = await fetch(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ BusinessShortCode: this.shortcode, Password: this.password(timestamp), Timestamp: timestamp, CheckoutRequestID: checkoutRequestId }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, string>;
    // "The transaction is being processed" comes back as an error code while the customer is still on the PIN screen
    if (!res.ok || body.ResultCode === undefined) return { checkoutRequestId, success: false, pending: true, resultDesc: body.errorMessage ?? 'Processing' };
    return { checkoutRequestId, success: String(body.ResultCode) === '0', resultDesc: body.ResultDesc ?? '' };
  }

  /** Reads Daraja's STK callback body */
  parseCallback(body: unknown): StkOutcome | null {
    const cb = (body as { Body?: { stkCallback?: Record<string, unknown> } })?.Body?.stkCallback;
    if (!cb || typeof cb.CheckoutRequestID !== 'string') return null;
    const items = ((cb.CallbackMetadata as { Item?: { Name: string; Value?: unknown }[] } | undefined)?.Item ?? []).reduce<Record<string, unknown>>(
      (acc, i) => ({ ...acc, [i.Name]: i.Value }),
      {},
    );
    return {
      checkoutRequestId: cb.CheckoutRequestID,
      success: Number(cb.ResultCode) === 0,
      resultDesc: String(cb.ResultDesc ?? ''),
      receipt: items.MpesaReceiptNumber ? String(items.MpesaReceiptNumber) : undefined,
      amount: items.Amount !== undefined ? Number(items.Amount) : undefined,
      phone: items.PhoneNumber !== undefined ? String(items.PhoneNumber) : undefined,
    };
  }

  private unavailable(message: string) {
    return new ServiceUnavailableException({ code: 'MPESA_UNAVAILABLE', message });
  }
}
