import { AiUsageService } from './ai-usage.service';
import { Throttle } from '@nestjs/throttler';
import {
  Controller, Post, Get, Body, Query,
  UseGuards, ParseIntPipe, DefaultValuePipe, ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { AccessTokenGuard }  from '../auth/guards/access-token.guard';
import { CurrentUser }       from '../../common/decorators/current-user.decorator';
import { User }              from '../../database/entities/user.entity';
import { AiService }         from './ai.service';
import { ChatDto, QuickSuggestDto, AnalyzeNutritionDto } from './dto/chat.dto';

@ApiTags('ai')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService, private readonly usage: AiUsageService) {}

  // ── POST /ai/chat ──────────────────────────────────────────────────────────

  @Get('status')
  status() { return this.aiService.getStatus(); }

  @Get('usage')
  usageStatus(@CurrentUser() user: User) { return this.usage.status(user.id); }

  @Post('chat')
  @ApiOperation({ summary: 'Send a message to the Friyo AI chef assistant' })
  async chat(@CurrentUser() user: User, @Body() dto: ChatDto) {
    await this.usage.consume(user.id);
    return this.aiService.chat(user.id, dto.message, dto.conversationId, dto.language, dto.shoppingList);
  }

  // ── POST /ai/suggest ───────────────────────────────────────────────────────

  @Post('suggest')
  @ApiOperation({ summary: 'Get a quick one-shot recipe suggestion based on fridge + time' })
  async suggest(@CurrentUser() user: User, @Body() dto: QuickSuggestDto) {
    await this.usage.consume(user.id);
    return this.aiService.quickSuggest(user.id, dto.context, dto.language);
  }

  // ── GET /ai/insights ───────────────────────────────────────────────────────

  @Get('insights')
  @ApiOperation({ summary: 'Get personalised AI insights (expiry alerts, streak, tips)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  insights(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
    @Query('language', new DefaultValuePipe('en'), new ParseEnumPipe({ en: 'en', zh: 'zh' })) language: 'en' | 'zh',
  ) {
    return this.aiService.getInsights(user.id, limit, language);
  }

  // ── POST /ai/analyze-nutrition ─────────────────────────────────────────────

  @Post('analyze-nutrition')
  @ApiOperation({ summary: 'Estimate the nutritional content of a described meal' })
  async analyzeNutrition(@CurrentUser() user: User, @Body() dto: AnalyzeNutritionDto) {
    await this.usage.consume(user.id);
    return this.aiService.analyzeNutrition(dto.description, dto.ingredients);
  }
}
