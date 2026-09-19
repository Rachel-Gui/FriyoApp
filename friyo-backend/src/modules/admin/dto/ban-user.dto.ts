import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BanUserDto {
  @ApiProperty({ description: 'Reason for ban' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  /** Duration in days; omit or 0 for permanent */
  @ApiPropertyOptional({ description: 'Ban duration in days (0 = permanent)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationDays?: number;
}
