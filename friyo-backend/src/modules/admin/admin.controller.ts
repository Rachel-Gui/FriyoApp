import {
  Controller, Get, Post, Patch, Delete, Put,
  Body, Param, Query, ParseUUIDPipe,
  UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { AdminJwtGuard, AdminRolesGuard } from '../auth/guards/admin-jwt.guard';
import { Roles, Role }                    from '../../common/decorators/roles.decorator';
import { CurrentUser }                    from '../../common/decorators/current-user.decorator';
import { AdminUser }                      from '../../database/entities/admin-user.entity';

import { AdminService }           from './admin.service';
import { ListUsersDto }           from './dto/list-users.dto';
import { BanUserDto }             from './dto/ban-user.dto';
import { CreateIngredientDto }    from './dto/create-ingredient.dto';
import { UpdateIngredientDto }    from './dto/update-ingredient.dto';
import { MergeIngredientsDto }    from './dto/merge-ingredients.dto';
import { RejectRecipeDto }        from './dto/reject-recipe.dto';
import { ResolveReportDto }       from './dto/resolve-report.dto';
import { CreateBannerDto }        from './dto/create-banner.dto';
import { SendPushDto }            from './dto/send-push.dto';
import { CreateAgreementDto }     from './dto/create-agreement.dto';
import { CreateAdminDto }         from './dto/create-admin.dto';
import { UpdateAdminDto }         from './dto/update-admin.dto';
import { ListRecipesDto }         from './dto/list-recipes.dto';
import { ListReportsDto }         from './dto/list-reports.dto';
import { AnalyticsQueryDto }      from './dto/analytics-query.dto';

/** Extracts client IP from request (handles reverse-proxy X-Forwarded-For) */
function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress ?? 'unknown';
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Dashboard (all authenticated admins) ─────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard summary' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  // ── Users (super_admin | ops) ─────────────────────────────────────────────────

  @Get('users')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'Paginated user list with search & filters' })
  listUsers(@Query() dto: ListUsersDto) {
    return this.adminService.listUsers(dto);
  }

  @Get('users/:id')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'User detail + activity stats' })
  getUserDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Post('users/:id/ban')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'Ban a user' })
  banUser(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BanUserDto,
    @Req() req: Request,
  ) {
    return this.adminService.banUser(admin.id, id, dto, getIp(req));
  }

  @Post('users/:id/unban')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'Unban a user' })
  unbanUser(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.unbanUser(admin.id, id, getIp(req));
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Permanently delete a user (super_admin only)' })
  deleteUser(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.deleteUser(admin.id, id, getIp(req));
  }

  // ── Ingredients (super_admin only) ────────────────────────────────────────────

  @Get('ingredients')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Paginated ingredient list' })
  listIngredients(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listIngredients(
      Number(page) || 1,
      Number(limit) || 30,
      search,
    );
  }

  @Post('ingredients')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Create a new ingredient' })
  createIngredient(
    @CurrentUser() admin: AdminUser,
    @Body() dto: CreateIngredientDto,
    @Req() req: Request,
  ) {
    return this.adminService.createIngredient(admin.id, dto, getIp(req));
  }

  @Patch('ingredients/:id')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Update an ingredient' })
  updateIngredient(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIngredientDto,
    @Req() req: Request,
  ) {
    return this.adminService.updateIngredient(admin.id, id, dto, getIp(req));
  }

  @Delete('ingredients/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Delete an ingredient (only if unreferenced)' })
  deleteIngredient(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.deleteIngredient(admin.id, id, getIp(req));
  }

  @Post('ingredients/merge')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Merge duplicate ingredients into one canonical record' })
  mergeIngredients(
    @CurrentUser() admin: AdminUser,
    @Body() dto: MergeIngredientsDto,
    @Req() req: Request,
  ) {
    return this.adminService.mergeIngredients(admin.id, dto, getIp(req));
  }

  // ── Recipes (super_admin | content_reviewer) ──────────────────────────────────

  @Get('recipes')
  @Roles(Role.SuperAdmin, Role.ContentReviewer)
  @ApiOperation({ summary: 'Recipe list (defaults to pending review)' })
  listRecipes(@Query() dto: ListRecipesDto) {
    return this.adminService.listRecipes(dto);
  }

  @Post('recipes/:id/approve')
  @Roles(Role.SuperAdmin, Role.ContentReviewer)
  @ApiOperation({ summary: 'Approve a recipe for publication' })
  approveRecipe(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.approveRecipe(admin.id, id, getIp(req));
  }

  @Post('recipes/:id/reject')
  @Roles(Role.SuperAdmin, Role.ContentReviewer)
  @ApiOperation({ summary: 'Reject a recipe with a reason' })
  rejectRecipe(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRecipeDto,
    @Req() req: Request,
  ) {
    return this.adminService.rejectRecipe(admin.id, id, dto, getIp(req));
  }

  @Delete('recipes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Delete a recipe (super_admin only)' })
  deleteRecipe(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.deleteRecipe(admin.id, id, getIp(req));
  }

  // ── Community moderation (super_admin | content_reviewer) ─────────────────────

  @Get('community/flagged')
  @Roles(Role.SuperAdmin, Role.ContentReviewer)
  @ApiOperation({ summary: 'List all flagged community posts' })
  listFlaggedPosts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listFlaggedPosts(Number(page) || 1, Number(limit) || 20);
  }

  @Post('community/posts/:id/approve')
  @Roles(Role.SuperAdmin, Role.ContentReviewer)
  @ApiOperation({ summary: 'Approve a flagged post' })
  approvePost(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.approvePost(admin.id, id, getIp(req));
  }

  @Delete('community/posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SuperAdmin, Role.ContentReviewer)
  @ApiOperation({ summary: 'Remove a post (sets REMOVED + hidden)' })
  removePost(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.removePost(admin.id, id, getIp(req));
  }

  @Get('community/reports')
  @Roles(Role.SuperAdmin, Role.ContentReviewer)
  @ApiOperation({ summary: 'List content reports' })
  listReports(@Query() dto: ListReportsDto) {
    return this.adminService.listReports(dto);
  }

  @Post('community/reports/:id/resolve')
  @Roles(Role.SuperAdmin, Role.ContentReviewer)
  @ApiOperation({ summary: 'Resolve or dismiss a content report' })
  resolveReport(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
    @Req() req: Request,
  ) {
    return this.adminService.resolveReport(admin.id, id, dto, getIp(req));
  }

  // ── Banners (super_admin | ops) ───────────────────────────────────────────────

  @Get('banners')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'List all banners' })
  listBanners() {
    return this.adminService.listBanners();
  }

  @Post('banners')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'Create a banner' })
  createBanner(
    @CurrentUser() admin: AdminUser,
    @Body() dto: CreateBannerDto,
    @Req() req: Request,
  ) {
    return this.adminService.createBanner(admin.id, dto, getIp(req));
  }

  @Patch('banners/:id')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'Update a banner' })
  updateBanner(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateBannerDto>,
    @Req() req: Request,
  ) {
    return this.adminService.updateBanner(admin.id, id, dto, getIp(req));
  }

  @Delete('banners/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'Delete a banner' })
  deleteBanner(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.deleteBanner(admin.id, id, getIp(req));
  }

  // ── Push Notifications (super_admin | ops) ────────────────────────────────────

  @Post('notifications/push')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'Send push notification (broadcast or targeted)' })
  sendPush(
    @CurrentUser() admin: AdminUser,
    @Body() dto: SendPushDto,
    @Req() req: Request,
  ) {
    return this.adminService.sendPushNotification(admin.id, dto, getIp(req));
  }

  // ── Agreements (super_admin | ops) ───────────────────────────────────────────

  @Get('agreements')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'List all agreement versions' })
  listAgreements() {
    return this.adminService.listAgreements();
  }

  @Post('agreements')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'Create a new agreement version' })
  createAgreement(
    @CurrentUser() admin: AdminUser,
    @Body() dto: CreateAgreementDto,
    @Req() req: Request,
  ) {
    return this.adminService.createAgreement(admin.id, dto, getIp(req));
  }

  @Post('agreements/:id/publish')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'Publish an agreement (marks it as current for its type)' })
  publishAgreement(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.publishAgreement(admin.id, id, getIp(req));
  }

  // ── Analytics (super_admin | ops) ─────────────────────────────────────────────

  @Get('analytics')
  @Roles(Role.SuperAdmin, Role.Ops)
  @ApiOperation({ summary: 'Platform analytics: user growth, meal logs, top recipes, scans' })
  getAnalytics(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getAnalytics(dto);
  }

  // ── Admin account management (super_admin only) ───────────────────────────────

  @Get('admins')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'List all admin accounts' })
  listAdmins() {
    return this.adminService.listAdmins();
  }

  @Post('admins')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Create a new admin account' })
  createAdmin(
    @CurrentUser() admin: AdminUser,
    @Body() dto: CreateAdminDto,
    @Req() req: Request,
  ) {
    return this.adminService.createAdmin(admin.id, dto, getIp(req));
  }

  @Patch('admins/:id')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: "Update an admin's role, status, or permissions" })
  updateAdmin(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminDto,
    @Req() req: Request,
  ) {
    return this.adminService.updateAdmin(admin.id, id, dto, getIp(req));
  }

  @Post('admins/:id/deactivate')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: 'Deactivate an admin account' })
  deactivateAdmin(
    @CurrentUser() admin: AdminUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.adminService.deactivateAdmin(admin.id, id, getIp(req));
  }

  @Get('admins/:id/logs')
  @Roles(Role.SuperAdmin)
  @ApiOperation({ summary: "Paginated audit log for a specific admin" })
  getAdminLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAdminLogs(id, Number(page) || 1, Number(limit) || 50);
  }
}
