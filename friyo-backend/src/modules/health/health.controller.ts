import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { Public } from '../../common/decorators/public.decorator';

export interface HealthCheckResult {
  status:    'ok' | 'degraded' | 'error';
  db:        'connected' | 'disconnected';
  redis:     'connected' | 'disconnected';
  timestamp: string;
  uptime:    number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,

    @Inject('HEALTH_REDIS')
    private readonly redis: Redis,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Application health check' })
  async check(): Promise<HealthCheckResult> {
    const [dbOk, redisOk] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const status =
      dbOk && redisOk ? 'ok' :
      dbOk || redisOk ? 'degraded' :
      'error';

    if (!dbOk || !redisOk) throw new ServiceUnavailableException('Required services unavailable');

    return {
      status,
      db:        dbOk    ? 'connected' : 'disconnected',
      redis:     redisOk ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      uptime:    Math.floor(process.uptime()),
    };
  }

  // ── Checks ───────────────────────────────────────────────────────────────────

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
