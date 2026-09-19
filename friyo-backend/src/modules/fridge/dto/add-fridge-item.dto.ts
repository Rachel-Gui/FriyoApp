import {
  IsOptional, IsString, IsNumber, IsEnum, IsDateString,
  IsUUID, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StorageType } from '../../../database/entities/fridge-item.entity';

export class AddFridgeItemDto {
  @IsOptional()
  @IsUUID('4')
  ingredient_id?: string;

  @IsString()
  custom_name: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsEnum(StorageType)
  storage_type: StorageType;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  calories_override?: number;
}
