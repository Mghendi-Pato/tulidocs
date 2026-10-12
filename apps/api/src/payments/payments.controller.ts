import { Body, Controller, Get, Headers, HttpCode, Logger, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators';
import { CheckoutService } from './checkout.service';
import { MpesaService } from './mpesa.service';
import { PaystackService } from './paystack.service';

@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly checkout: CheckoutService,
    private readonly mpesa: MpesaService,
    private readonly paystack: PaystackService,
    private readonly config: ConfigService,
  ) {}

  /** Polled by the browser while the customer pays */
  @Public()
  @Get('checkouts/:id')
  status(@Param('id', ParseUUIDPipe) id: string) {
    return this.checkout.status(id);
  }

  /** Daraja STK callback. The secret path segment keeps strangers from posting fake results. */
  @Public()
  @SkipThrottle()
  @Post('payments/mpesa/callback/:secret')
  @HttpCode(200)
  async mpesaCallback(@Param('secret') secret: string, @Body() body: unknown) {
    if (secret !== this.config.get<string>('MPESA_CALLBACK_SECRET', 'dev')) throw new NotFoundException();
    const r = this.mpesa.parseCallback(body);
    if (r) {
      if (r.success)
        await this.checkout.completeByRef(r.checkoutRequestId, {
          receipt: r.receipt,
          raw: body,
          paid: r.amount !== undefined ? { amount: r.amount, currency: 'KES' } : undefined,
        });
      else await this.checkout.failByRef(r.checkoutRequestId, r.resultDesc || 'Payment was not completed');
    }
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  /** Paystack webhook (charge.success). Signed with HMAC-SHA512 of the raw body. */
  @Public()
  @SkipThrottle()
  @Post('payments/paystack/webhook')
  @HttpCode(200)
  async paystackWebhook(@Req() req: RawBodyRequest<Request>, @Headers('x-paystack-signature') signature?: string) {
    if (!this.paystack.validSignature(req.rawBody, signature)) {
      this.logger.warn('Rejected Paystack webhook with a bad signature');
      return { ok: false };
    }
    const event = req.body as { event?: string; data?: { reference?: string; amount?: number } };
    if (event.event === 'charge.success' && event.data?.reference) {
      // verify with the API rather than trusting the payload's amount
      const v = await this.paystack.verify(event.data.reference);
      if (v.status === 'success') await this.checkout.completeByRef(event.data.reference, { receipt: event.data.reference, raw: v.raw, paid: { amount: v.amount, currency: v.currency } });
    }
    return { ok: true };
  }

  /** CARD_MODE=mock only: stands in for Paystack's card page */
  @Public()
  @Get('payments/card/mock')
  async mockCard(@Query('reference') reference: string, @Res() res: Response) {
    if (this.paystack.mode !== 'mock') throw new NotFoundException();
    const c = await this.checkout.completeByRef(reference, { receipt: `MOCKCARD-${reference.slice(-6).toUpperCase()}`, raw: { mock: true } });
    const app = this.config.get<string>('APP_URL', 'http://localhost:3000').replace(/\/$/, '');
    res.redirect(`${app}/payment/return/?checkout=${c?.id ?? ''}`);
  }
}
