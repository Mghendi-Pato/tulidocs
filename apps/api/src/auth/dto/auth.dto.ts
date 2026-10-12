import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class LoginDto {
  @Transform(lower)
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Enter your password' })
  @MaxLength(200)
  password: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

export class SignupDto {
  /** Optional — defaults to a name made from the email address (changeable in Settings) */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  /** Optional — defaults to "<first name>'s Business" (changeable in Settings) */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(160)
  businessName?: string;

  @Transform(lower)
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters for your password' })
  @MaxLength(200)
  password: string;

  /** ISO country code — sets currency, tax name and tax-ID label (all changeable later) */
  @IsOptional()
  @Matches(/^[A-Z]{2}$/, { message: 'Choose a country' })
  country?: string;

  /** where to land after confirming the email (e.g. /billing/?cycle=YEARLY); only same-site paths are kept */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  next?: string;
}

export class ChangePasswordDto {
  /** Not needed for Google-only accounts setting a first password */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPassword?: string;

  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters' })
  @MaxLength(200)
  newPassword: string;
}

export class ProfileDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}

export class ForgotPasswordDto {
  @Transform(lower)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(200)
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;

  @IsString()
  @MinLength(8, { message: 'Use at least 8 characters for your password' })
  @MaxLength(200)
  password: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;
}

export class ResendVerificationDto {
  @Transform(lower)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(200)
  email: string;
}
