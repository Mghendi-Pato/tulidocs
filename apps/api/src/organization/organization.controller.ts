import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { EtimsService } from '../etims/etims.service';
import { PrismaService } from '../prisma/prisma.service';
import { TEMPLATES } from '../render/templates';
import { EtimsSettingsDto, LogoDto, UpdateOrganizationDto } from './organization.dto';

const PUBLIC_FIELDS = {
  id: true, name: true, email: true, phone: true, address: true, taxId: true, website: true, logo: true, currency: true,
  country: true, taxName: true, taxIdLabel: true,
  mpesaPaybill: true, mpesaAccount: true, mpesaTill: true, bankDetails: true,
  defaultTemplate: true, defaultTaxRate: true, defaultTerms: true, defaultNotes: true, paymentTermDays: true,
  invoicePrefix: true, quotePrefix: true, receiptPrefix: true,
  plan: true, billingCycle: true, planExpiresAt: true,
  etimsEnabled: true, etimsBranchId: true, etimsDeviceSerial: true, createdAt: true,
} as const;

/** The signed-in business: profile, logo, payment details, numbering, defaults */
@Controller('organization')
export class OrganizationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly etims: EtimsService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: PUBLIC_FIELDS });
  }

  @Get('templates')
  templates() {
    return TEMPLATES;
  }

  @Roles('ADMIN')
  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({ where: { id: user.organizationId }, data: dto, select: PUBLIC_FIELDS });
  }

  @Roles('ADMIN')
  @Put('logo')
  logo(@CurrentUser() user: AuthUser, @Body() dto: LogoDto) {
    return this.prisma.organization.update({ where: { id: user.organizationId }, data: { logo: dto.logo }, select: PUBLIC_FIELDS });
  }

  /** eTIMS details are saved now; turning it on waits for KRA certification */
  @Roles('ADMIN')
  @Patch('etims')
  etimsSettings(@CurrentUser() user: AuthUser, @Body() dto: EtimsSettingsDto) {
    const enable = dto.etimsEnabled && this.etims.enabled;
    return this.prisma.organization.update({
      where: { id: user.organizationId },
      data: { etimsBranchId: dto.etimsBranchId, etimsDeviceSerial: dto.etimsDeviceSerial, ...(dto.etimsEnabled !== undefined ? { etimsEnabled: !!enable } : {}) },
      select: PUBLIC_FIELDS,
    });
  }
}
