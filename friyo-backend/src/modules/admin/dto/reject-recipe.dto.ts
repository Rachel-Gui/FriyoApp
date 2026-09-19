import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectRecipeDto {
  @ApiProperty({ description: 'Reason shown to the recipe author' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
