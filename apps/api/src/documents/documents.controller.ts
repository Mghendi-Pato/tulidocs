import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DocumentType } from '@prisma/client';
import { IsIn, IsOptional, Matches } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types';
import { TEMPLATE_IDS } from '../render/templates';
import { DocumentsService } from './documents.service';
import { DocumentInputDto, DocumentListQueryDto, PreviewDto, RecordPaymentDto,
  IssueReceiptDto, StatusDto } from './dto/document.dto';

class TemplateDto {
  @IsIn(TEMPLATE_IDS)
  template: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accent?: string;
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: DocumentListQueryDto) {
    return this.docs.list(user, q);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.docs.summary(user);
  }

  @Get('defaults')
  defaults(@CurrentUser() user: AuthUser, @Query('type', new ParseEnumPipe(DocumentType)) type: DocumentType) {
    return this.docs.defaults(user, type);
  }

  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  @Post('preview')
  @HttpCode(200)
  async preview(@CurrentUser() user: AuthUser, @Body() dto: PreviewDto, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(await this.docs.previewDraft(user, dto), { type: 'image/jpeg' });
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.detail(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: DocumentInputDto) {
    return this.docs.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DocumentInputDto) {
    return this.docs.update(user, id, dto);
  }

  @Patch(':id/template')
  template(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TemplateDto) {
    return this.docs.setTemplate(user, id, dto.template, dto.accent);
  }

  @Post(':id/status')
  @HttpCode(200)
  status(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto) {
    return this.docs.setStatus(user, id, dto.status as 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'VOID');
  }

  @Post(':id/convert')
  convert(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.convertToInvoice(user, id);
  }

  @Post(':id/payments')
  pay(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordPaymentDto) {
    return this.docs.recordPayment(user, id, dto);
  }

  @Post(':id/receipt')
  receipt(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: IssueReceiptDto) {
    return this.docs.issueReceipt(user, id, dto);
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.duplicate(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.remove(user, id);
  }

  @Get(':id/pdf')
  @Header('Cache-Control', 'no-store')
  async pdf(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const { buf, filename, watermark } = await this.docs.pdf(user, id);
    res.setHeader('X-Watermark', watermark ? '1' : '0');
    return new StreamableFile(buf, { type: 'application/pdf', disposition: `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"` });
  }

  @Get(':id/preview')
  @Header('Cache-Control', 'no-store')
  async previewStored(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return new StreamableFile(await this.docs.previewStored(user, id), { type: 'image/jpeg' });
  }
}
