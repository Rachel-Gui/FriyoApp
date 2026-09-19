import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
export class ForgotPasswordDto {
  @IsEmail() @MaxLength(254)
  email: string;
}
export class ResetPasswordDto extends ForgotPasswordDto {
  @Matches(/^[a-f0-9]{32}$/)
  code: string;
  @IsString() @MinLength(8) @MaxLength(72)
  password: string;
}
