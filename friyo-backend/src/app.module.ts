import { validateEnvironment } from './config/validate-env';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';

import {
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  awsConfig,
} from './config';

import { RedisModule }          from './shared/redis.module';
import { AuthModule }           from './modules/auth/auth.module';
import { UsersModule }          from './modules/users/users.module';
import { FridgeModule }         from './modules/fridge/fridge.module';
import { RecipesModule }        from './modules/recipes/recipes.module';
import { MealPlansModule }      from './modules/meal-plans/meal-plans.module';
import { CommunityModule }      from './modules/community/community.module';
import { AiModule }             from './modules/ai/ai.module';
import { AdminModule }          from './modules/admin/admin.module';
import { NotificationsModule }  from './modules/notifications/notifications.module';
import { HealthModule }         from './modules/health/health.module';

@Module({
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  imports: [
    // ── Config (global) ──────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, awsConfig],
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    // ── Database ─────────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('database.url') || undefined,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false,
        migrationsRun: false,
        logging: config.get<string>('app.nodeEnv') === 'development',
        ssl:
          config.get<string>('app.nodeEnv') === 'production'
            ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
            : false,
      }),
    }),

    // ── Bull Queue (Redis) — supports REDIS_URL (Railway) ─────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        if (process.env.REDIS_URL) {
          return { url: process.env.REDIS_URL };
        }
        return {
          redis: {
            host:     config.get<string>('redis.host') ?? 'localhost',
            port:     config.get<number>('redis.port') ?? 6379,
            password: config.get<string>('redis.password') || undefined,
          },
        };
      },
    }),

    // ── Rate Limiting ─────────────────────────────────────────────────────────
    // Named throttlers allow per-route overrides via @Throttle({ auth: ... })
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (_config: ConfigService) => ({
        throttlers: [
          // General API — 100 req / 60 s per IP
          { name: 'default', ttl: 60_000, limit: 100 },
          // Auth endpoints — 5 req / 60 s per IP (brute-force protection)

          // AI endpoints — 20 req / 60 s per user

        ],
      }),
    }),

    // ── Shared providers (global) ─────────────────────────────────────────────
    RedisModule,

    // ── Feature Modules ───────────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    FridgeModule,
    RecipesModule,
    MealPlansModule,
    CommunityModule,
    AiModule,
    AdminModule,
    NotificationsModule,
    HealthModule,
  ],
})
export class AppModule {}
