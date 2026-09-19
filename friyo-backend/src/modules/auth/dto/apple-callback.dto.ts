import { IsString, IsOptional } from 'class-validator';

export class AppleCallbackDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  id_token?: string;

  @IsOptional()
  @IsString()
  state?: string;

  // Apple sends user JSON as a string only on the first auth
  @IsOptional()
  @IsString()
  user?: string;
}
