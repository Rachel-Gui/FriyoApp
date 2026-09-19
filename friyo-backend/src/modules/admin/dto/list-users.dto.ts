import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum UserSortField {
  CREATED_AT  = 'created_at',
  LAST_ACTIVE = 'last_active',
  MEALS_COUNT = 'meals_count',
}

export class ListUsersDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: 'active' | 'banned';
  @ApiPropertyOptional({ enum: UserSortField }) @IsOptional() @IsEnum(UserSortField) sort?: UserSortField;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
