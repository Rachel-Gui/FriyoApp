import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BannerStatus } from '../../../database/entities/banner.entity';

export class CreateBannerDto {
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @IsUrl() imageUrl: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() linkUrl?: string;
  @ApiPropertyOptional({ enum: BannerStatus }) @IsOptional() @IsEnum(BannerStatus) status?: BannerStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() startAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endAt?: string;
}
