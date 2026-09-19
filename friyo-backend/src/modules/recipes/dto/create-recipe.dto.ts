import {
  IsString, IsOptional, IsEnum, IsInt, IsNumber, IsArray,
  IsBoolean, IsUrl, ValidateNested, Min, Max, ArrayMinSize, IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  RecipeDifficulty, RecipeMealType,
} from '../../../database/entities/recipe.entity';
import { StepType } from '../../../database/entities/recipe-step.entity';

export class CreateRecipeIngredientDto {
  @IsOptional()
  @IsUUID('4')
  ingredient_id?: string;

  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsBoolean()
  is_optional?: boolean = false;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  substitutes?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sort_order?: number = 0;
}

export class CreateRecipeStepDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  step_number: number;

  @IsString()
  description: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  duration_min?: number;

  @IsOptional()
  @IsEnum(StepType)
  step_type?: StepType = StepType.HANDS_ON;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  tips?: string;
}

export class CreateRecipeDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  title_zh?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  cuisine_type?: string;

  @IsOptional()
  @IsEnum(RecipeMealType)
  meal_type?: RecipeMealType;

  @IsOptional()
  @IsEnum(RecipeDifficulty)
  difficulty?: RecipeDifficulty;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  prep_time_min?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  cook_time_min?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  servings?: number = 2;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  calories_per_serving?: number;

  @IsOptional()
  @IsString()
  cover_image_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] = [];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diet_types?: string[] = [];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  required_tools?: string[] = [];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisines?: string[] = [];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeIngredientDto)
  ingredients: CreateRecipeIngredientDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeStepDto)
  steps: CreateRecipeStepDto[];
}
