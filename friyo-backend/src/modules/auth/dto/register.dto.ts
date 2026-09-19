import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, IsEmail, MaxLength as PasswordMaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(254)
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @MinLength(8)
  @PasswordMaxLength(72)
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'Chelsea Lin' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '+16505551234', required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}
