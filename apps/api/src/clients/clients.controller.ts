import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { CurrentUser } from '../common/decorators';
import { PageQueryDto, Paginated } from '../common/dto/pagination.dto';
import { NotFound } from '../common/errors';
import { D } from '../common/money';
import { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';

const blank = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ClientDto {
  @Transform(trim) @IsString() @MinLength(1, { message: 'Enter the client’s name' }) @MaxLength(160)
  name: string;

  @IsOptional() @Transform(blank) @ValidateIf((_, v) => v !== null) @IsEmail({}, { message: 'Enter a valid email address' })
  email?: string | null;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(40)
  phone?: string | null;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(400)
  address?: string | null;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(20)
  taxId?: string | null;
}

@Controller('clients')
export class ClientsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: PageQueryDto) {
    const where: Prisma.ClientWhereInput = { organizationId: user.organizationId };
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({ where, orderBy: { name: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.client.count({ where }),
    ]);
    // what each client owes on open invoices
    const owed = rows.length
      ? await this.prisma.document.groupBy({
          by: ['clientId'],
          where: { organizationId: user.organizationId, type: 'INVOICE', status: { in: ['SENT', 'PARTIALLY_PAID'] }, clientId: { in: rows.map((r) => r.id) } },
          _sum: { total: true, amountPaid: true },
          _count: true,
        })
      : [];
    const byId = new Map(owed.map((o) => [o.clientId, o]));
    return Paginated.of(
      rows.map((r) => {
        const o = byId.get(r.id);
        return { ...r, outstanding: o ? D(o._sum.total).sub(D(o._sum.amountPaid)).toFixed(2) : '0.00', openInvoices: o?._count ?? 0 };
      }),
      total,
      q.page,
      q.pageSize,
    );
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const c = await this.prisma.client.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!c) throw new NotFound('Client');
    return c;
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: ClientDto) {
    return this.prisma.client.create({ data: { ...dto, organizationId: user.organizationId } });
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ClientDto) {
    await this.get(user, id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  /** Documents keep their own copy of the client's details, so deleting a client never changes them */
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.get(user, id);
    await this.prisma.client.delete({ where: { id } });
    return { ok: true };
  }
}
