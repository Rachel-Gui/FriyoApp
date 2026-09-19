import { imageUploadLimits } from '../../common/image-upload';
import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, ParseUUIDPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';

import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

import { MealPlansService } from './meal-plans.service';
import { LogMealDto } from './dto/log-meal.dto';
import { SaveWeeklyPlanDto } from './dto/save-weekly-plan.dto';

@ApiTags('meal-plans')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  // ── Static routes first ────────────────────────────────────────────────────

  @Get('today')
  @ApiOperation({ summary: "Get today's meals grouped by meal type" })
  getToday(@CurrentUser() user: User) {
    return this.mealPlansService.getToday(user.id);
  }

  @Get('week')
  @ApiOperation({ summary: '7-day plan view with actual logs and saved plan' })
  getWeek(
    @CurrentUser() user: User,
    @Query('start_date') startDate?: string,
  ) {
    return this.mealPlansService.getWeek(user.id, startDate);
  }

  @Post('week')
  @ApiOperation({ summary: 'Save (upsert) a weekly meal plan' })
  saveWeeklyPlan(
    @CurrentUser() user: User,
    @Body() dto: SaveWeeklyPlanDto,
  ) {
    return this.mealPlansService.saveWeeklyPlan(user.id, dto);
  }

  @Get('month')
  @ApiOperation({ summary: 'Monthly meal history with aggregated stats' })
  getMonth(
    @CurrentUser() user: User,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const now = new Date();
    return this.mealPlansService.getMonth(
      user.id,
      year ? Number(year) : now.getFullYear(),
      month ? Number(month) : now.getMonth() + 1,
    );
  }

  @Get('analysis')
  @ApiOperation({ summary: 'AI-powered 30-day cooking analysis (cached 24h)' })
  getAnalysis(@CurrentUser() user: User) {
    return this.mealPlansService.getAnalysis(user.id);
  }

  @Get('saved-recipes')
  @ApiOperation({ summary: 'Get user bookmarked recipes' })
  getSavedRecipes(@CurrentUser() user: User) {
    return this.mealPlansService.getSavedRecipes(user.id);
  }

  // ── Log endpoints ──────────────────────────────────────────────────────────

  @Post('log')
  @ApiOperation({ summary: 'Log a cooked meal and deduct fridge ingredients' })
  logMeal(
    @CurrentUser() user: User,
    @Body() dto: LogMealDto,
  ) {
    return this.mealPlansService.logMeal(user.id, dto);
  }

  @Post('log/:id/photo')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage(), limits: imageUploadLimits }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { photo: { type: 'string', format: 'binary' } },
      required: ['photo'],
    },
  })
  @ApiOperation({ summary: 'Upload a custom photo for an existing meal log' })
  uploadMealPhoto(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.mealPlansService.uploadMealPhoto(user.id, id, file);
  }

  // ── Bookmark routes ────────────────────────────────────────────────────────

  @Post('save/:recipeId')
  @ApiOperation({ summary: 'Bookmark a recipe for weekly planning' })
  saveRecipe(
    @CurrentUser() user: User,
    @Param('recipeId', ParseUUIDPipe) recipeId: string,
  ) {
    return this.mealPlansService.saveRecipe(user.id, recipeId);
  }

  @Delete('save/:recipeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a recipe bookmark' })
  unsaveRecipe(
    @CurrentUser() user: User,
    @Param('recipeId', ParseUUIDPipe) recipeId: string,
  ) {
    return this.mealPlansService.unsaveRecipe(user.id, recipeId);
  }
}
