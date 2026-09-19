import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { NotificationsService } from './notifications.service';

/**
 * Cron-driven scheduler that enqueues recurring notification and analytics jobs.
 *
 * Schedule overview:
 *  - 08:00 UTC daily  → fridge expiry reminders
 *  - 02:00 UTC daily  → analytics snapshot aggregation (previous day)
 *  - Every hour       → analytics Redis cache flush
 */
@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // ── Fridge expiry reminder — 08:00 UTC daily ──────────────────────────────

  @Cron('0 8 * * *', { name: 'fridge-expiry-reminder', timeZone: 'UTC' })
  async runExpiryReminder(): Promise<void> {
    this.logger.log('Cron: enqueuing fridge expiry reminder check');
    try {
      await this.notificationsService.queueExpiryCheck({});
    } catch (err) {
      this.logger.error(`Cron fridge-expiry-reminder failed: ${(err as Error).message}`);
    }
  }

  // ── Analytics aggregation — 02:00 UTC daily ───────────────────────────────

  @Cron('0 2 * * *', { name: 'analytics-aggregate', timeZone: 'UTC' })
  async runAnalyticsAggregate(): Promise<void> {
    this.logger.log('Cron: enqueuing analytics snapshot aggregation');
    try {
      // No date argument → processor defaults to yesterday
      await this.notificationsService.queueAnalyticsAggregate({});
    } catch (err) {
      this.logger.error(`Cron analytics-aggregate failed: ${(err as Error).message}`);
    }
  }

  // ── Analytics cache flush — every hour ───────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR, { name: 'analytics-clear-cache', timeZone: 'UTC' })
  async runAnalyticsClearCache(): Promise<void> {
    this.logger.debug('Cron: enqueuing analytics clear-cache');
    try {
      await this.notificationsService.queueClearAnalyticsCache();
    } catch (err) {
      this.logger.error(`Cron analytics-clear-cache failed: ${(err as Error).message}`);
    }
  }
}
