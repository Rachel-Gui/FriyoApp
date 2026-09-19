import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchRecipesDto {
  @IsString()
  @MinLength(1)
  q: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  use_preferences?: boolean = false;
}
