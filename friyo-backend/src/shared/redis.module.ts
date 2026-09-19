import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

function createRedisClient(config: ConfigService): Redis {
  // Railway (and most cloud platforms) inject a full REDIS_URL
  const url = process.env.REDIS_URL;
  if (url) return new Redis(url, { lazyConnect: false });

  return new Redis({
    host:        config.get<string>('redis.host')     ?? 'localhost',
    port:        config.get<number>('redis.port')     ?? 6379,
    password:    config.get<string>('redis.password') || undefined,
    lazyConnect: false,
  });
}

@Global()
@Module({
  providers: [
    {
      provide:    'REDIS_CLIENT',
      useFactory: createRedisClient,
      inject:     [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
