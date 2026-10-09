import { Transform } from 'class-transformer';
import { FeedbackCategory, FeedbackStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PageQueryDto } from '../common/dto/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class FeedbackListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['top', 'new'])
  sort?: 'top' | 'new';

  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @IsOptional()
  @IsEnum(FeedbackCategory)
  category?: FeedbackCategory;
}

export class CreateFeedbackDto {
  @Transform(trim)
  @IsString()
  @MinLength(6, { message: 'Give your idea a short title (at least 6 characters)' })
  @MaxLength(120)
  title: string;

  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'Tell us a little more (at least 10 characters)' })
  @MaxLength(4000)
  body: string;

  @IsOptional()
  @IsEnum(FeedbackCategory)
  category?: FeedbackCategory;

  /** Visitors without an account: the name shown with the idea (optional) */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  name?: string;

  /** Spam trap — a hidden field people never fill in */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class FeedbackCommentDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Write something first' })
  @MaxLength(2000)
  body: string;

  /** Visitors without an account: the name shown with the comment (optional) */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  name?: string;

  /** Spam trap */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class FeedbackReactDto {
  /** 1 = like, -1 = dislike (switches an existing vote; the same value again changes nothing) */
  @IsIn([1, -1])
  value: 1 | -1;
}

export class FeedbackStatusDto {
  @IsEnum(FeedbackStatus)
  status: FeedbackStatus;
}
