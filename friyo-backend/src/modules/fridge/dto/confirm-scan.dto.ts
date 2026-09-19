import {
  IsArray, IsString, IsNumber, IsEnum, IsOptional,
  IsDateString, ArrayMinSize, ValidateNested, IsUUID, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StorageType } from '../../../database/entities/fridge-item.entity';

export class ConfirmScanItemDto {
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
}

export class ConfirmScanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmScanItemDto)
  items: ConfirmScanItemDto[];
}
