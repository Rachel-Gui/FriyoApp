import {
  IsUUID, IsEnum, IsNumber, IsDateString, IsOptional,
  IsBoolean, IsString, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MealType } from '../../../database/entities/meal-log.entity';

export class LogMealDto {
  @IsUUID('4')
  recipe_id: string;

  @IsOptional()
  @IsUUID('4')
  adaptation_id?: string;

  @IsEnum(MealType)
  meal_type: MealType;

  @IsNumber()
  @Min(0.5)
  @Max(20)
  @Type(() => Number)
  servings_eaten: number;

  @IsDateString()
  logged_at: string;

  @IsOptional()
  @IsBoolean()
  use_original_photo?: boolean = false;

  @IsOptional()
  @IsString()
  notes?: string;
}
