import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatDto {
  @ApiProperty({ example: 'What can I cook with eggs and spinach?' })
  @IsString() @MaxLength(1000)
  message: string;

  @ApiPropertyOptional({ description: 'Continue an existing conversation' })
  @IsOptional() @IsString()
  conversationId?: string;
}

export class QuickSuggestDto {
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
