import { IsString, IsOptional, MaxLength, IsIn, IsArray, ArrayMaxSize, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShoppingContextItemDto {
  @IsString() @MaxLength(120) name: string;
  @IsNumber() @Min(0) quantity: number;
  @IsString() @MaxLength(30) unit: string;
}

export class ChatDto {
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true })
  @Type(() => ShoppingContextItemDto)
  shoppingList?: ShoppingContextItemDto[];
  @IsOptional() @IsIn(['en', 'zh']) language?: 'en' | 'zh';

  @ApiProperty({ example: 'What can I cook with eggs and spinach?' })
  @IsString() @MaxLength(1000)
  message: string;

  @ApiPropertyOptional({ description: 'Continue an existing conversation' })
  @IsOptional() @IsString()
  conversationId?: string;
}

export class QuickSuggestDto {
  @IsOptional() @IsIn(['en', 'zh']) language?: 'en' | 'zh';

  @ApiPropertyOptional({ example: 'something light and quick' })
  @IsOptional() @IsString() @MaxLength(500)
  context?: string;
}

export class AnalyzeNutritionDto {
  @ApiProperty({ example: '2 fried eggs with whole-wheat toast and avocado' })
  @IsString() @MaxLength(1000)
  description: string;

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  ingredients?: Array<{ name: string; quantity: number; unit: string }>;
}
