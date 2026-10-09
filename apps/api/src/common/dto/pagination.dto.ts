import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PageQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class Paginated<T> {
  constructor(
    public readonly items: T[],
    public readonly meta: { total: number; page: number; pageSize: number; pageCount: number },
  ) {}

  static of<T>(items: T[], total: number, page: number, pageSize: number) {
    return new Paginated(items, { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
  }
}
