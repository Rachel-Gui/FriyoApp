import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'chelsea' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'abc' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
