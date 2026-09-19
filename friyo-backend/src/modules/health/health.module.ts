import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: 'HEALTH_REDIS',
      useFactory: (config: ConfigService) => {
        const url = process.env.REDIS_URL;
        if (url) return new Redis(url, { lazyConnect: false });
        return new Redis({
          host:        config.get<string>('redis.host')     ?? 'localhost',
          port:        config.get<number>('redis.port')     ?? 6379,
          password:    config.get<string>('redis.password') || undefined,
          lazyConnect: false,
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class HealthModule {}
