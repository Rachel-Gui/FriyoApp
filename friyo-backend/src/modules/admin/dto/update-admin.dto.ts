import { IsString, IsEmail, IsOptional, IsEnum, IsBoolean, IsObject, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '../../../database/entities/admin-user.entity';

export class UpdateAdminDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ minLength: 8 }) @IsOptional() @IsString() @MinLength(8) password?: string;
  @ApiPropertyOptional({ enum: AdminRole }) @IsOptional() @IsEnum(AdminRole) role?: AdminRole;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ type: Object }) @IsOptional() @IsObject() permissions?: Record<string, boolean>;
}
