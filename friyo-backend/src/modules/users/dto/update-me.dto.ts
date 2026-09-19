import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  avatar_url?: string;
}
