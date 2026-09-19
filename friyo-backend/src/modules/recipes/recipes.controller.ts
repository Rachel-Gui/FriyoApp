import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { AdminUser } from '../../database/entities/admin-user.entity';

import { RecipesService } from './recipes.service';
import { RecipeRecommendationService } from './recipe-recommendation.service';
import { ListRecipesDto } from './dto/list-recipes.dto';
import { SearchRecipesDto } from './dto/search-recipes.dto';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

@ApiTags('recipes')
@ApiBearerAuth()
@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly recommendationService: RecipeRecommendationService,
  ) {}

  // ── Static routes first (must come before /:id) ────────────────────────────

  @Get()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'List recipes with filters' })
  listRecipes(@Query() query: ListRecipesDto) {
    return this.recipesService.listRecipes(query);
  }

  @Get('search')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Full-text search recipes via Elasticsearch' })
  searchRecipes(
    @Query() query: SearchRecipesDto,
    @CurrentUser() user: User,
  ) {
    return this.recipesService.searchRecipes(query, user?.id);
  }

  // ── Recommendation routes (before /:id) ────────────────────────────────────

  @Get('recommendations/fridge')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Match recipes to what is in the fridge' })
  matchToFridge(@CurrentUser() user: User) {
    return this.recommendationService.matchRecipesToFridge(user.id);
  }

  @Get('recommendations/time')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Time-appropriate recipe recommendations' })
  timeBasedRecommendations(@CurrentUser() user: User) {
    const hour = new Date().getHours();
    return this.recommendationService.getTimeBasedRecommendations(user.id, hour);
  }

  @Get('recommendations/health')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Health-goal-aligned recipe recommendations' })
  healthRecommendations(@CurrentUser() user: User) {
    return this.recommendationService.getHealthRecommendations(user.id);
  }

  @Get('recommendations/trending')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Trending recipes (cached 1h)' })
  trendingRecipes() {
    return this.recommendationService.getTrendingRecipes();
  }

  // ── CRUD routes ────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Create a recipe (goes to review unless admin)' })
  createRecipe(
    @CurrentUser() user: User,
    @Body() dto: CreateRecipeDto,
  ) {
    return this.recipesService.createRecipe(user.id, dto);
  }

  @Get(':id')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Get full recipe detail with ingredients and steps' })
  getRecipe(@Param('id', ParseUUIDPipe) id: string) {
    return this.recipesService.getRecipe(id);
  }

  @Get(':id/for-cooking')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Get recipe with fridge status + cooking timeline' })
  getRecipeForCooking(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('adaptation_id') adaptationId?: string,
  ) {
    return this.recipesService.getRecipeForCooking(id, user.id, adaptationId);
  }

  @Post(':id/adapt')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Generate a fridge-adapted version of a recipe' })
  adaptRecipe(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recommendationService.generateAdaptedRecipe(id, user.id);
  }

  @Patch(':id')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Update a recipe (owner or admin)' })
  updateRecipe(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecipeDto,
  ) {
    return this.recipesService.updateRecipe(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminJwtGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a recipe (admin only)' })
  deleteRecipe(
    @CurrentUser() _admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recipesService.deleteRecipe(id);
  }
}
