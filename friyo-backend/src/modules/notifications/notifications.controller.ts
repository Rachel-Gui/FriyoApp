import {
  Controller, Post, Delete, Body, Param,
  UseGuards, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { AccessTokenGuard }   from '../auth/guards/access-token.guard';
import { CurrentUser }        from '../../common/decorators/current-user.decorator';
import { User }               from '../../database/entities/user.entity';
import { UserDeviceToken }    from '../../database/entities/user-device-token.entity';
import { RegisterTokenDto }   from './dto/register-token.dto';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@UseGuards(AccessTokenGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    @InjectRepository(UserDeviceToken)
    private readonly tokenRepo: Repository<UserDeviceToken>,
  ) {}

  // ── POST /notifications/device-token ──────────────────────────────────────

  @Post('device-token')
  @ApiOperation({ summary: 'Register a device token for push notifications' })
  async registerToken(
    @CurrentUser() user: User,
    @Body() dto: RegisterTokenDto,
  ) {
    const isExpo = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(dto.token);
    if ((dto.platform === 'expo') !== isExpo) throw new BadRequestException('Invalid push token platform');
    await this.tokenRepo.upsert({ userId: user.id, token: dto.token, platform: dto.platform as any,
      isActive: true }, ['token']);

    return { registered: true };
  }

  // ── DELETE /notifications/device-token/:token ──────────────────────────────

  @Delete('device-token/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a device token (on logout)' })
  async deregisterToken(
    @CurrentUser() user: User,
    @Param('token') token: string,
  ) {
    await this.tokenRepo.update(
      { userId: user.id, token },
      { isActive: false },
    );
  }
}
