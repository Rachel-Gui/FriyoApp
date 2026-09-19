import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum FeedSort {
  RECENT    = 'recent',
  TRENDING  = 'trending',
  FOLLOWING = 'following',
}

export class FeedQueryDto {
  @IsOptional()
  @IsEnum(FeedSort)
  sort?: FeedSort = FeedSort.RECENT;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 20;
}
