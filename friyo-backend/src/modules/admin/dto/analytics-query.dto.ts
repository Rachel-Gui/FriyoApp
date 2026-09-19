import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum AnalyticsPeriod {
  DAY   = 'day',
  WEEK  = 'week',
  MONTH = 'month',
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: AnalyticsPeriod, default: AnalyticsPeriod.WEEK })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod = AnalyticsPeriod.WEEK;

  @ApiPropertyOptional({ description: 'ISO date string for range start' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date string for range end' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
