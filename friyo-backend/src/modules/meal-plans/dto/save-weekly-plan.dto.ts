import { IsDateString, IsObject, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DayPlanDto {
  @IsOptional()
  @IsUUID('4')
  breakfast?: string;

  @IsOptional()
  @IsUUID('4')
  lunch?: string;

  @IsOptional()
  @IsUUID('4')
  dinner?: string;
}

export class SaveWeeklyPlanDto {
  @IsDateString()
  week_start_date: string;

  @IsObject()
  plan_data: Record<string, DayPlanDto>;
}
