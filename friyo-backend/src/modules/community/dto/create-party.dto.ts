import { IsString, IsOptional, IsDateString, MinLength, MaxLength } from 'class-validator';

export class CreatePartyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsDateString()
  event_date?: string;
}
