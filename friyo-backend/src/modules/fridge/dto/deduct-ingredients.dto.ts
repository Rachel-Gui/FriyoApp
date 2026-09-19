import { IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DeductIngredientsDto {
  @IsUUID('4')
  recipe_id: string;

  @IsNumber()
  @Min(0.5)
  @Type(() => Number)
  servings_used: number;
}
