import { IsString, IsNotEmpty, MaxLength, IsOptional, Matches } from 'class-validator';
export class GoogleLoginDto {
  @IsString() @IsNotEmpty() @MaxLength(16000)
  identityToken: string;
}
export class AppleLoginDto extends GoogleLoginDto {
  @IsString() @IsNotEmpty() @MaxLength(4096)
  authorizationCode: string;
  @Matches(/^[a-f0-9]{64}$/)
  nonce: string;
  @IsOptional() @IsString() @MaxLength(100)
  name?: string;
}
