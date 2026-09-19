import { IsOptional, IsEnum, IsString } from 'class-validator';
import { StorageType } from '../../../database/entities/fridge-item.entity';

export enum FridgeStorageFilter {
  FRIDGE  = StorageType.FRIDGE,
  FREEZER = StorageType.FREEZER,
  PANTRY  = StorageType.PANTRY,
  ALL     = 'all',
}

export enum FridgeSortOrder {
  EXPIRY_ASC = 'expiry_asc',
  NAME       = 'name',
  ADDED_DATE = 'added_date',
}

export class GetFridgeItemsDto {
  @IsOptional()
  @IsEnum(FridgeStorageFilter)
  storage_type?: FridgeStorageFilter;

  @IsOptional()
  @IsEnum(FridgeSortOrder)
  sort?: FridgeSortOrder;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
