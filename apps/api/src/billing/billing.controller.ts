import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { requestCountry } from '../common/request-country';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { CheckoutService } from '../payments/checkout.service';
import { PayDto, QuoteDto, SubscribeDto } from '../payments/payments.dto';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly checkout: CheckoutService,
  ) {}

  /** ?country=KE from the browser; Cloudflare's country header wins when present */
  @Public()
  @Get('pricing')
  pricing(@Req() req: Request, @Query('country') country?: string) {
    return this.billing.pricing(requestCountry(req, country));
  }

  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.billing.overview(user);
  }

  /** What a plan purchase costs today (upgrades credit unused paid time) */
  @Get('quote')
  quote(@CurrentUser() user: AuthUser, @Query() q: QuoteDto) {
    return this.checkout.quoteSubscription(user.organizationId, q.plan, q.cycle);
  }

  @Roles('ADMIN')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('subscribe')
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto) {
    return this.checkout.startSubscription({
      organizationId: user.organizationId,
      plan: dto.plan,
      cycle: dto.cycle,
      pay: { provider: dto.provider, phone: dto.phone, email: dto.email ?? user.email },
    });
  }

  /** Pay once to remove the watermark from one document (Free plan) */
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('unlock/:documentId')
  unlock(@CurrentUser() user: AuthUser, @Param('documentId', ParseUUIDPipe) documentId: string, @Body() dto: PayDto) {
    return this.checkout.startUnlock({
      documentId,
      organizationId: user.organizationId,
      pay: { provider: dto.provider, phone: dto.phone, email: dto.email ?? user.email },
    });
  }
}
