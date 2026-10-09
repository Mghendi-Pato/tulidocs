import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DocumentStatus, DocumentType, PaymentMethod } from '@prisma/client';
import { PageQueryDto } from '../../common/dto/pagination.dto';
import { TEMPLATE_IDS } from '../../render/templates';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** '' → undefined so optional fields can be cleared from a form */
const blank = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
const num = ({ value }: { value: unknown }) => (typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : value);

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const MAX_LOGO_CHARS = 560_000; // ≈ 400 KB image

export class ItemDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'Every item needs a description' })
  @MaxLength(500)
  description: string;

  @Transform(num)
  @IsNumberString({}, { message: 'Quantity must be a number' })
  quantity: string;

  @Transform(num)
  @IsNumberString({}, { message: 'Price must be a number' })
  unitPrice: string;

  @IsOptional()
  @Transform(num)
  @IsNumberString({}, { message: 'Tax rate must be a number' })
  taxRate?: string;
}

/** Everything that makes up a document's content — shared by the guest builder and business accounts. */
export class DocumentInputDto {
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  /** Guests type their own number; businesses get one automatically when left out */
  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(40)
  number?: string | null;

  @IsOptional()
  @IsIn(TEMPLATE_IDS)
  template?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Accent must be a #rrggbb colour' })
  accent?: string;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'Currency must be a 3-letter code' })
  currency?: string;

  @Matches(DATE_RE, { message: 'Issue date must be yyyy-mm-dd' })
  issueDate: string;

  @IsOptional()
  @Transform(blank)
  @ValidateIf((_, v) => v !== null)
  @Matches(DATE_RE, { message: 'Due date must be yyyy-mm-dd' })
  dueDate?: string | null;

  // ── From ──
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  fromName?: string;

  @IsOptional()
  @Transform(blank)
  @ValidateIf((_, v) => v !== null)
  @IsEmail({}, { message: 'Enter a valid business email' })
  fromEmail?: string | null;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(40)
  fromPhone?: string | null;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(400)
  fromAddress?: string | null;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(40)
  fromTaxId?: string | null;

  /** false = leave the sender's tax number (and its label) off this document */
  @IsOptional()
  @IsBoolean()
  showFromTaxId?: boolean;

  /** Guests only — businesses use their Settings. What tax is called (VAT, GST, Sales tax…) */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(24)
  taxName?: string;

  /** Guests only — label for tax numbers (KRA PIN, VAT No., GSTIN…) */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(24)
  taxIdLabel?: string;

  /** Guests only — businesses use the logo from Settings */
  @IsOptional()
  @Transform(blank)
  @ValidateIf((_, v) => v !== null)
  @Matches(LOGO_RE, { message: 'Logo must be a PNG, JPEG or WebP image' })
  @MaxLength(MAX_LOGO_CHARS, { message: 'Logo is too large (max 400 KB)' })
  fromLogo?: string | null;

  // ── Bill to ──
  @IsOptional()
  @Transform(blank)
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  clientId?: string | null;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: "Enter the client's name" })
  @MaxLength(160)
  clientName: string;

  @IsOptional()
  @Transform(blank)
  @ValidateIf((_, v) => v !== null)
  @IsEmail({}, { message: 'Enter a valid client email' })
  clientEmail?: string | null;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(40)
  clientPhone?: string | null;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(400)
  clientAddress?: string | null;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(40)
  clientTaxId?: string | null;

  // ── Lines & money ──
  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one item' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];

  @IsOptional()
  @Transform(num)
  @IsNumberString({}, { message: 'Discount must be a number' })
  discount?: string;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(2000)
  terms?: string | null;

  /** "How to pay" box (M-Pesa paybill/till, bank) */
  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(1000)
  paymentInfo?: string | null;
}

export class DocumentListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;

  @IsOptional()
  @IsIn(['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'UNPAID', 'OVERDUE'])
  status?: DocumentStatus | 'UNPAID' | 'OVERDUE';

  @IsOptional()
  @IsUUID()
  clientId?: string;

  /** Document date range (yyyy-mm-dd, inclusive) */
  @IsOptional()
  @Matches(DATE_RE, { message: 'from must be yyyy-mm-dd' })
  from?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: 'to must be yyyy-mm-dd' })
  to?: string;
}

export class StatusDto {
  @IsIn(['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'VOID'])
  status: DocumentStatus;
}

export class RecordPaymentDto {
  @Transform(num)
  @IsNumberString({}, { message: 'Amount must be a number' })
  amount: string;

  @Matches(DATE_RE, { message: 'Date must be yyyy-mm-dd' })
  date: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(80)
  reference?: string | null;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  /** false = just mark the invoice paid; a receipt can be generated later */
  @IsOptional()
  @IsBoolean()
  issueReceipt?: boolean;
}

/** Generate a receipt for payments already recorded on an invoice */
export class IssueReceiptDto {
  @Matches(DATE_RE, { message: 'Date must be yyyy-mm-dd' })
  date: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(80)
  reference?: string | null;

  @IsOptional()
  @Transform(blank)
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

/** Live preview: content + optional existing document (to know if it's unlocked) */
export class PreviewDto extends DocumentInputDto {
  @IsOptional()
  @IsUUID()
  documentId?: string;
}
