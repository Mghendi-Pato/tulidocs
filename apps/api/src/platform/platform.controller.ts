import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { BillingCycle, Plan, Prisma, TenantStatus } from '@prisma/client';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { hasPaidPlan } from '../billing/plans';
import { PlatformOnly } from '../common/decorators';
import { startOfMonth, toDateOnly } from '../common/dates';
import { PageQueryDto, Paginated } from '../common/dto/pagination.dto';
import { D } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';

class TenantUpdateDto {
  @IsOptional() @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional() @IsEnum(Plan)
  plan?: Plan;

  @IsOptional() @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  /** yyyy-mm-dd — give a business free time, or end a plan */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  planExpiresAt?: string;
}

/** Platform console (SYSTEM_ADMIN): every business, plans and platform revenue */
@PlatformOnly()
@Controller('platform')
export class PlatformController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async overview() {
    const month = startOfMonth();
    const [businesses, paidOrgs, revenue, revenueAll, docsMonth, guestDocs, unlocks] = await Promise.all([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.organization.findMany({ where: { plan: { not: 'FREE' }, deletedAt: null }, select: { plan: true, planExpiresAt: true } }),
      this.prisma.checkout.groupBy({ by: ['currency'], where: { status: 'PAID', paidAt: { gte: month } }, _sum: { amount: true } }),
      this.prisma.checkout.groupBy({ by: ['currency'], where: { status: 'PAID' }, _sum: { amount: true } }),
      this.prisma.document.count({ where: { createdAt: { gte: month } } }),
      this.prisma.document.count({ where: { organizationId: null } }),
      this.prisma.checkout.count({ where: { status: 'PAID', purpose: 'DOCUMENT_UNLOCK', paidAt: { gte: month } } }),
    ]);
    return {
      businesses,
      payingBusinesses: paidOrgs.filter((o) => hasPaidPlan(o)).length,
      // money comes in several currencies (regional pricing) — never add them together
      revenueThisMonth: revenue.map((r) => ({ currency: r.currency, amount: D(r._sum.amount).toFixed(2) })),
      revenueAllTime: revenueAll.map((r) => ({ currency: r.currency, amount: D(r._sum.amount).toFixed(2) })),
      documentsThisMonth: docsMonth,
      guestDocuments: guestDocs,
      unlocksThisMonth: unlocks,
    };
  }

  @Get('businesses')
  async businesses(@Query() q: PageQueryDto) {
    // businesses closed by their owner (account deleted) are kept for records but not listed
    const where: Prisma.OrganizationWhereInput = q.search
      ? { deletedAt: null, OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }] }
      : { deletedAt: null };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, name: true, email: true, phone: true, status: true, plan: true, billingCycle: true, planExpiresAt: true, createdAt: true,
          _count: { select: { documents: true, users: true } },
          users: { where: { role: 'ADMIN' }, take: 1, orderBy: { createdAt: 'asc' }, select: { name: true, email: true, lastLoginAt: true } },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return Paginated.of(
      rows.map(({ users, _count, ...r }) => ({ ...r, active: hasPaidPlan(r), owner: users[0] ?? null, documents: _count.documents, users: _count.users })),
      total,
      q.page,
      q.pageSize,
    );
  }

  @Patch('businesses/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TenantUpdateDto) {
    return this.prisma.organization.update({
      where: { id },
      data: {
        status: dto.status,
        plan: dto.plan,
        billingCycle: dto.billingCycle,
        planExpiresAt: dto.planExpiresAt ? toDateOnly(dto.planExpiresAt) : undefined,
      },
      select: { id: true, name: true, status: true, plan: true, billingCycle: true, planExpiresAt: true },
    });
  }

  @Get('payments')
  async payments(@Query() q: PageQueryDto) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.checkout.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, purpose: true, provider: true, status: true, amount: true, currency: true, plan: true, billingCycle: true,
          phone: true, email: true, receipt: true, country: true, failureReason: true, createdAt: true, paidAt: true,
          organization: { select: { name: true } },
          document: { select: { number: true } },
        },
      }),
      this.prisma.checkout.count(),
    ]);
    return Paginated.of(rows, total, q.page, q.pageSize);
  }
}
