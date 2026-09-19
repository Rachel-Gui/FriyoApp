import {
  Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminJwtGuard, AdminRolesGuard } from './guards/admin-jwt.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAuthResponse } from './interfaces/auth-response.interface';
import { AdminUser } from '../../database/entities/admin-user.entity';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Admin login — returns an admin-scoped JWT' })
  async adminLogin(@Body() dto: AdminLoginDto): Promise<AdminAuthResponse> {
    return this.authService.adminLogin(dto);
  }

  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Return the authenticated admin profile' })
  me(@CurrentUser() admin: AdminUser): Partial<AdminUser> {
    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      lastLoginAt: admin.lastLoginAt,
    };
  }

  // Example of a super_admin-only endpoint
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @Roles(Role.SuperAdmin)
  @Get('ping')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Ping — super_admin only' })
  ping(): { ok: boolean } {
    return { ok: true };
  }
}
