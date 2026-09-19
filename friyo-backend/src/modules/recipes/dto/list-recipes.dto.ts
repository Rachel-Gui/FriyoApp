import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RecipeDifficulty, RecipeMealType } from '../../../database/entities/recipe.entity';

export class ListRecipesDto {
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

  @IsOptional()
  @IsString()
  cuisine?: string;

  @IsOptional()
  @IsEnum(RecipeMealType)
  meal_type?: RecipeMealType;

  @IsOptional()
  @IsEnum(RecipeDifficulty)
  difficulty?: RecipeDifficulty;

  @IsOptional()
  @IsString()
  diet_type?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  max_time?: number;
}
