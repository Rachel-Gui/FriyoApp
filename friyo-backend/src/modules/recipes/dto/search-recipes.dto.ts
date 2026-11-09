import { IsString, IsOptional, IsBoolean, MinLength, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SearchRecipesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MinLength(0)
  @MaxLength(120)
  q: string = '';

  @IsOptional() @IsString() @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  use_preferences?: boolean = false;
}
