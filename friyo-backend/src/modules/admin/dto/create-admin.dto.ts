import { IsString, IsEmail, IsNotEmpty, IsEnum, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '../../../database/entities/admin-user.entity';

export class CreateAdminDto {
  @ApiProperty() @IsString() @IsNotEmpty() username: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) password: string;
  @ApiProperty({ enum: AdminRole }) @IsEnum(AdminRole) role: AdminRole;
  @ApiPropertyOptional({ type: Object }) @IsOptional() permissions?: Record<string, boolean>;
}
