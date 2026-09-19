import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import Redis from 'ioredis';

import type { PushNotificationPayload } from './processors/push-notification.processor';
import type { ExpiryReminderJobData }   from './processors/fridge-expiry.processor';
import type { AggregateJobData }        from './processors/analytics-aggregate.processor';
import type { RecipeAdaptJobData }      from './processors/recipe-adapt.processor';

// ── Job option defaults ──────────────────────────────────────────────────────

const PUSH_JOB_OPTS = {
  attempts:         3,
  backoff:          { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: true,
};

const ADAPT_JOB_OPTS = {
  attempts:         2,
  backoff:          { type: 'exponential' as const, delay: 10_000 },
  removeOnComplete: true,
  timeout:          60_000,   // OpenAI calls can be slow
};

const ANALYTICS_JOB_OPTS = {
  attempts:         3,
  backoff:          { type: 'fixed' as const, delay: 30_000 },
  removeOnComplete: true,
};

const EXPIRY_JOB_OPTS = {
  attempts:         3,
  backoff:          { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: true,
};

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);

  /** Separate Redis subscriber connection (ioredis requires a dedicated client for subscribe). */
  private subscriber: Redis | null = null;

  constructor(
    @InjectQueue('notifications.push')
    private readonly pushQueue: Queue,

    @InjectQueue('recipe.adapt')
    private readonly recipeAdaptQueue: Queue,

    @InjectQueue('analytics.aggregate')
    private readonly analyticsQueue: Queue,

    @InjectQueue('fridge.expiry.reminder')
    private readonly expiryQueue: Queue,

    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    await this.subscribeToAdminPushChannel();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.unsubscribe('admin:push_notification');
      this.subscriber.disconnect();
      this.subscriber = null;
    }
  }

  // ── Redis pub/sub — admin broadcast ──────────────────────────────────────

  /**
   * The AdminService publishes push payloads to `admin:push_notification`.
   * Here we consume them and enqueue the actual push job.
   */
  private async subscribeToAdminPushChannel(): Promise<void> {
    try {
      // Duplicate the shared client so we can put it in subscribe mode
      this.subscriber = this.redis.duplicate();

      await this.subscriber.subscribe('admin:push_notification');

      this.subscriber.on('message', (_channel: string, message: string) => {
        try {
          const payload = JSON.parse(message) as PushNotificationPayload;
          this.pushQueue
            .add('push', payload, PUSH_JOB_OPTS)
            .catch((err: Error) =>
              this.logger.error(`Failed to enqueue admin push: ${err.message}`),
            );
          this.logger.debug(`Admin push enqueued from Redis channel (type=${payload.type})`);
        } catch (err) {
          this.logger.error(`Malformed admin:push_notification message: ${(err as Error).message}`);
        }
      });

      this.logger.log('Subscribed to Redis channel admin:push_notification');
    } catch (err) {
      this.logger.error(`Failed to subscribe to Redis channel: ${(err as Error).message}`);
    }
  }

  // ── Push ──────────────────────────────────────────────────────────────────

  /** Directly enqueue a push notification job (used internally / from other modules). */
  async queuePush(payload: PushNotificationPayload): Promise<void> {
    await this.pushQueue.add('push', payload, PUSH_JOB_OPTS);
    this.logger.debug(`Queued push job (type=${payload.type})`);
  }

  // ── Fridge expiry ─────────────────────────────────────────────────────────

  /** Enqueue a fridge expiry check (typically triggered by cron or backfill). */
  async queueExpiryCheck(data: ExpiryReminderJobData = {}): Promise<void> {
    await this.expiryQueue.add('check-expiry', data, EXPIRY_JOB_OPTS);
    this.logger.debug('Queued fridge expiry check job');
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  /** Enqueue an analytics aggregation job. */
  async queueAnalyticsAggregate(data: AggregateJobData = {}): Promise<void> {
    await this.analyticsQueue.add('aggregate', data, ANALYTICS_JOB_OPTS);
    this.logger.debug(`Queued analytics aggregate job (date=${data.date ?? 'yesterday'})`);
  }

  /** Enqueue an analytics cache-clear job. */
  async queueClearAnalyticsCache(): Promise<void> {
    await this.analyticsQueue.add('clear-cache', {}, ANALYTICS_JOB_OPTS);
    this.logger.debug('Queued analytics clear-cache job');
  }

  // ── Recipe adaptation ─────────────────────────────────────────────────────

  /** Enqueue an AI recipe adaptation job. */
  async queueRecipeAdapt(data: RecipeAdaptJobData): Promise<void> {
    await this.recipeAdaptQueue.add('adapt', data, ADAPT_JOB_OPTS);
    this.logger.debug(
      `Queued recipe adapt job (recipe=${data.recipeId}, adaptation=${data.adaptationId})`,
    );
  }
}
