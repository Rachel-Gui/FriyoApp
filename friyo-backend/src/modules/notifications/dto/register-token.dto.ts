import { IsString, IsEnum, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TokenPlatform {
  EXPO = 'expo',
  FCM  = 'fcm',
  APNS = 'apns',
}

export class RegisterTokenDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(512)
  token: string;

  @ApiProperty({ enum: TokenPlatform, default: TokenPlatform.FCM })
  @IsEnum(TokenPlatform)
  platform: TokenPlatform;
}
