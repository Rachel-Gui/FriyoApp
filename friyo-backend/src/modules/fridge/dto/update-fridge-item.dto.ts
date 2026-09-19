import { IsOptional, IsString, IsNumber, IsEnum, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { StorageType } from '../../../database/entities/fridge-item.entity';

export class UpdateFridgeItemDto {
  @IsOptional()
  @IsString()
  custom_name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsEnum(StorageType)
  storage_type?: StorageType;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;
}
