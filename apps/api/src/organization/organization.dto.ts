import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsNumberString, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { LOGO_RE, MAX_LOGO_CHARS } from '../documents/dto/document.dto';
import { TEMPLATE_IDS } from '../render/templates';

const blank = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() || null : value);

export class UpdateOrganizationDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(160)
  name?: string;

  @IsOptional() @Transform(blank) @ValidateIf((_, v) => v !== null) @IsEmail({}, { message: 'Enter a valid email address' })
  email?: string | null;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(40)
  phone?: string | null;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(400)
  address?: string | null;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(40)
  taxId?: string | null;

  @IsOptional() @Matches(/^[A-Z]{2}$/, { message: 'Choose a country' })
  country?: string;

  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(24)
  taxName?: string;

  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(24)
  taxIdLabel?: string;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(120)
  website?: string | null;

  @IsOptional() @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional() @Transform(blank) @ValidateIf((_, v) => v !== null) @Matches(/^\d{5,7}$/, { message: 'Paybill is 5–7 digits' })
  mpesaPaybill?: string | null;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(40)
  mpesaAccount?: string | null;

  @IsOptional() @Transform(blank) @ValidateIf((_, v) => v !== null) @Matches(/^\d{5,8}$/, { message: 'Till number is 5–8 digits' })
  mpesaTill?: string | null;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(500)
  bankDetails?: string | null;

  @IsOptional() @IsIn(TEMPLATE_IDS)
  defaultTemplate?: string;

  @IsOptional() @IsNumberString()
  defaultTaxRate?: string;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(2000)
  defaultTerms?: string | null;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(2000)
  defaultNotes?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(365)
  paymentTermDays?: number;

  @IsOptional() @Transform(upper) @Matches(/^[A-Z0-9]{1,8}$/, { message: 'Prefix: up to 8 letters/numbers' })
  invoicePrefix?: string;

  @IsOptional() @Transform(upper) @Matches(/^[A-Z0-9]{1,8}$/, { message: 'Prefix: up to 8 letters/numbers' })
  quotePrefix?: string;

  @IsOptional() @Transform(upper) @Matches(/^[A-Z0-9]{1,8}$/, { message: 'Prefix: up to 8 letters/numbers' })
  receiptPrefix?: string;
}

export class LogoDto {
  @Transform(blank)
  @ValidateIf((_, v) => v !== null)
  @Matches(LOGO_RE, { message: 'Logo must be a PNG, JPEG or WebP image' })
  @MaxLength(MAX_LOGO_CHARS, { message: 'Logo is too large (max 400 KB)' })
  logo: string | null;
}

export class EtimsSettingsDto {
  @IsOptional() @IsBoolean()
  etimsEnabled?: boolean;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(4)
  etimsBranchId?: string | null;

  @IsOptional() @Transform(blank) @IsString() @MaxLength(60)
  etimsDeviceSerial?: string | null;
}
