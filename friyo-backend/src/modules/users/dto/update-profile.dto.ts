import { IsOptional, IsString, IsArray, IsInt, IsEnum, Min, Max, IsBoolean, MaxLength, ArrayMaxSize } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DietType, CookingSkill } from '../../../database/entities/user-profile.entity';

export class UpdateProfileDto {
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(100, { each: true })
  meal_formats?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(100, { each: true })
  flavor_preferences?: string[];

  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(100, { each: true })
  dietary_restrictions?: string[];

  @IsOptional() @IsString() @MaxLength(100)
  time_preference?: string;

  @IsOptional() @IsString() @MaxLength(100)
  grocery_frequency?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  initial_craving?: string;


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

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  onboarding_completed?: boolean;
}
