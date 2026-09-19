import { IsOptional, IsString, IsArray, IsInt, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DietType, CookingSkill } from '../../../database/entities/user-profile.entity';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsEnum(DietType)
  diet_type?: DietType;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true })
  allergies?: string[];

  @ApiPropertyOptional() @IsOptional() @IsEnum(CookingSkill)
  cooking_skill?: CookingSkill;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true })
  cooking_tools?: string[];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(20)
  household_size?: number;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true })
  health_goals?: string[];

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true })
  preferred_cuisines?: string[];

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true })
  disliked_ingredients?: string[];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(7)
  weekly_cooking_days?: number;

  @ApiPropertyOptional() @IsOptional()
  onboarding_completed?: boolean;
}
