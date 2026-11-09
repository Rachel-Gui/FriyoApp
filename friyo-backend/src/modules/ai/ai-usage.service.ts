import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class AiUsageService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis, private readonly config: ConfigService) {}
  private key(id: string) { return `ai:usage:${id}:${new Date().toISOString().slice(0, 10)}`; }
  async status(id: string) {
    const user = await this.users.findOneByOrFail({ id });
    const isVip = !!user.vipExpiresAt && new Date(user.vipExpiresAt).getTime() > Date.now();
    // Keep existing free usage unchanged until the release owner configures a quota.
    const configured = Number(this.config.get('AI_FREE_DAILY_LIMIT') ?? 0);
    const dailyLimit = !isVip && Number.isInteger(configured) && configured > 0 ? configured : null;
    const used = dailyLimit === null ? 0 : Number(await this.redis.get(this.key(id)) ?? 0);
    return { plan: isVip ? 'vip' : 'free', unlimited: dailyLimit === null, dailyLimit,
      remaining: dailyLimit === null ? null : Math.max(0, dailyLimit - used), expiresAt: isVip ? user.vipExpiresAt : null };
  }
  async consume(id: string) {
    const status = await this.status(id);
    if (status.unlimited) return;
    const accepted = await this.redis.eval(`local n = tonumber(redis.call('GET', KEYS[1]) or '0')
      if n >= tonumber(ARGV[1]) then return 0 end
      redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], 172800); return 1`, 1, this.key(id), status.dailyLimit!);
    if (Number(accepted) !== 1) throw new HttpException('Daily AI allowance reached. Try again tomorrow (UTC).', HttpStatus.TOO_MANY_REQUESTS);
  }
}
