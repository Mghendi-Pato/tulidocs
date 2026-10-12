import { Transform } from 'class-transformer';
import { BillingCycle, CheckoutProvider, Plan } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

const blank = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

export class PayDto {
  @IsEnum(CheckoutProvider)
  provider: CheckoutProvider;

  /** Safaricom number for the M-Pesa prompt */
  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  /** Receipt email for card payments */
  @IsOptional()
  @Transform(blank)
  @ValidateIf((_, v) => v !== null)
  @IsEmail({}, { message: 'Enter a valid email address' })
  email?: string | null;

  /** Guests: the country the browser detected (for regional pricing) */
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  country?: string;
}

export class SubscribeDto extends PayDto {
  @IsEnum(Plan)
  plan: Plan;

  @IsEnum(BillingCycle)
  cycle: BillingCycle;
}

export class QuoteDto {
  @IsEnum(Plan)
  plan: Plan;

  @IsEnum(BillingCycle)
  cycle: BillingCycle;
}
