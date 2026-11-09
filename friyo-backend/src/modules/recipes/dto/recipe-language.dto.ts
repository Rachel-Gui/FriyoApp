import { IsIn, IsOptional } from 'class-validator';
export class RecipeLanguageQueryDto {
  @IsOptional() @IsIn(['en', 'zh']) language?: 'en' | 'zh';
}
export class TranslateRecipeDto {
  @IsIn(['en', 'zh']) language: 'en' | 'zh';
}
