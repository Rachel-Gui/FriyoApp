import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateRecipeDto } from './create-recipe.dto';

export class UpdateRecipeDto extends PartialType(
  OmitType(CreateRecipeDto, ['ingredients', 'steps'] as const),
) {}
