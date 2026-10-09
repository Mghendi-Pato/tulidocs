import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, Res, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, Matches } from 'class-validator';
import type { Request, Response } from 'express';
import { requestCountry } from '../common/request-country';
import { CurrentUser, GUEST_COOKIE, GuestToken, Public } from '../common/decorators';
import { AuthUser } from '../common/types';
import { DocumentInputDto, PreviewDto } from '../documents/dto/document.dto';
import { CheckoutService } from '../payments/checkout.service';
import { PayDto } from '../payments/payments.dto';
import { TEMPLATE_IDS } from '../render/templates';
import { GuestService, newGuestToken } from './guest.service';

class TemplateDto {
  @IsIn(TEMPLATE_IDS)
  template: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accent?: string;
}

/** The no-sign-up builder. Everything here is public and keyed to the guest cookie. */
@Controller('guest')
export class GuestController {
  constructor(
    private readonly guest: GuestService,
    private readonly checkout: CheckoutService,
    private readonly config: ConfigService,
  ) {}

  private ensureToken(token: string | null, res: Response) {
    if (token) return token;
    const t = newGuestToken();
    res.cookie(GUEST_COOKIE, t, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('COOKIE_SECURE') === 'true',
      path: '/',
      maxAge: 400 * 86_400_000,
    });
    return t;
  }

  @Public()
  @Get('documents')
  list(@GuestToken() token: string | null) {
    return this.guest.list(token);
  }

  @Public()
  @Get('documents/:id')
  async get(@GuestToken() token: string | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.guest.serialize(await this.guest.get(token, id));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('documents')
  create(@GuestToken() token: string | null, @Body() dto: DocumentInputDto, @Res({ passthrough: true }) res: Response) {
    return this.guest.create(this.ensureToken(token, res), dto);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Patch('documents/:id')
  update(@GuestToken() token: string | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DocumentInputDto) {
    return this.guest.update(token, id, dto);
  }

  @Public()
  @Patch('documents/:id/template')
  template(@GuestToken() token: string | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TemplateDto) {
    return this.guest.setTemplate(token, id, dto.template, dto.accent);
  }

  @Public()
  @Delete('documents/:id')
  remove(@GuestToken() token: string | null, @Param('id', ParseUUIDPipe) id: string) {
    return this.guest.remove(token, id);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('preview')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async preview(@GuestToken() token: string | null, @Body() dto: PreviewDto) {
    return new StreamableFile(await this.guest.preview(token, dto), { type: 'image/jpeg' });
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('documents/:id/pdf')
  @Header('Cache-Control', 'no-store')
  async pdf(@GuestToken() token: string | null, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const { buf, filename, watermark } = await this.guest.pdf(token, id);
    res.setHeader('X-Watermark', watermark ? '1' : '0');
    return new StreamableFile(buf, { type: 'application/pdf', disposition: `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"` });
  }

  /** Pay to remove the watermark from this document */
  @Public()
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('documents/:id/unlock')
  unlock(@GuestToken() token: string | null, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayDto, @Req() req: Request) {
    return this.checkout.startUnlock({
      documentId: id,
      guestToken: token,
      country: requestCountry(req, dto.country),
      pay: { provider: dto.provider, phone: dto.phone, email: dto.email },
    });
  }

  /** Move this browser's guest documents into the signed-in business (also done automatically at sign-in) */
  @Post('claim')
  @HttpCode(200)
  async claim(@GuestToken() token: string | null, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const moved = await this.guest.claim(token, user.organizationId);
    if (token) res.clearCookie(GUEST_COOKIE, { path: '/' });
    return { moved };
  }
}
