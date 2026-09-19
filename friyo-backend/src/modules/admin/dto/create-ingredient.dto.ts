import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, Min, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NutrientUnit {
  G   = 'g',
  MG  = 'mg',
  MCG = 'mcg',
  IU  = 'IU',
  KCAL = 'kcal',
}

export class CreateIngredientDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() defaultUnit?: string;

  @ApiPropertyOptional({ description: 'Per-100g nutrition data', type: Object })
  @IsOptional()
  nutritionPer100g?: Record<string, number>;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) aliases?: string[];

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) calories?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) protein?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) carbs?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) fat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) fiber?: number;
}
