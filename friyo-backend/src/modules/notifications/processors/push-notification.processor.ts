import { ExpoPushService } from '../expo-push.service';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan } from 'typeorm';
import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Job } from 'bull';

import { UserDeviceToken } from '../../../database/entities/user-device-token.entity';
import { FcmService } from '../fcm.service';

// ── Job payload shapes ─────────────────────────────────────────────────────

/** Send to one or more specific users (fan-out via their FCM tokens). */
export interface PushToUsersPayload {
  type:    'users';
  userIds?: string[];
  title:   string;
  body:    string;
  data?:   Record<string, string>;
  imageUrl?: string;
}

/** Broadcast to a Firebase topic (e.g. "all_users", "premium"). */
export interface PushToTopicPayload {
  type:  'topic';
  topic: string;
  title: string;
  body:  string;
  data?: Record<string, string>;
}

/** Single-token direct send (internal — used by expiry reminder etc.). */
export interface PushToTokenPayload {
  type:    'token';
  token:   string;
  userId?: string;
  title:   string;
  body:    string;
  data?:   Record<string, string>;
}

export type PushNotificationPayload =
  | PushToUsersPayload
  | PushToTopicPayload
  | PushToTokenPayload;

// ── Processor ─────────────────────────────────────────────────────────────

@Processor('notifications.push')
export class PushNotificationProcessor {
  private readonly logger = new Logger(PushNotificationProcessor.name);

  constructor(
    @InjectRepository(UserDeviceToken)
    private readonly tokenRepo: Repository<UserDeviceToken>,
    private readonly fcmService: FcmService,
    private readonly expo: ExpoPushService,
  ) {}

  // ── Main handler ─────────────────────────────────────────────────────────

  @Process('push')
  async handlePush(job: Job<PushNotificationPayload>): Promise<void> {
    const payload = job.data;

    switch (payload.type) {
      case 'users':
        await this.sendToUsers(payload);
        break;
      case 'topic':
        await this.sendToTopic(payload);
        break;
      case 'token':
        await this.sendToToken(payload);
        break;
      default:
        this.logger.warn(`Unknown push type: ${(payload as { type: string }).type}`);
    }
  }

  // ── Fan-out to user device tokens ─────────────────────────────────────────

  private async sendToUsers(payload: PushToUsersPayload): Promise<void> {
    const { userIds, title, body, data, imageUrl } = payload;

    let lastId: string | undefined;
    while (true) {
      const devices = await this.tokenRepo.find({
        where: { ...(userIds ? { userId: In(userIds) } : {}), ...(lastId ? { id: MoreThan(lastId) } : {}), isActive: true },
        order: { id: 'ASC' }, take: 100,
      });
      if (!devices.length) break;
      for (const device of devices) {
        await this.sendToToken({ type: 'token', token: device.token, userId: device.userId, title, body, data });
      }
      lastId = devices[devices.length - 1].id;
    }
  }

  // ── Topic broadcast ──────────────────────────────────────────────────────

  private async sendToTopic(payload: PushToTopicPayload): Promise<void> {
    const { topic, title, body, data } = payload;
    const result = await this.fcmService.sendToTopic(topic, title, body, data);

    if (!result.success) {
      throw new Error(`FCM topic send failed: ${result.error}`);
    }

    this.logger.log(`Push to topic "${topic}" delivered (messageId=${result.messageId})`);
  }

  // ── Direct token send ────────────────────────────────────────────────────

  private async sendToToken(payload: PushToTokenPayload): Promise<void> {
    const { token, title, body, data } = payload;
    // Skip queued messages after logout or account deletion.
    if (!(await this.tokenRepo.findOne({ where: { token, isActive: true, ...(payload.userId ? { userId: payload.userId } : {}) } }))) return;
    if (/^(ExponentPushToken|ExpoPushToken)\[/.test(token)) {
      await this.expo.send(token, title, body, data);
      return;
    }
    const result = await this.fcmService.sendToToken(token, title, body, data);

    if (!result.success) {
      // Deactivate if FCM says the token is stale
      if (result.error?.includes('InvalidRegistration') || result.error?.includes('NotRegistered') || result.error === 'messaging/registration-token-not-registered' || result.error === 'messaging/invalid-registration-token') {
        await this.deactivateTokens([token]);
        return;
      }
      throw new Error(`Push send failed: ${result.error}`);
    }
  }

  // ── Token maintenance ────────────────────────────────────────────────────

  private async deactivateTokens(badTokens: string[]): Promise<void> {
    await this.tokenRepo
      .createQueryBuilder()
      .update(UserDeviceToken)
      .set({ isActive: false })
      .where('token IN (:...tokens)', { tokens: badTokens })
      .execute();

    this.logger.warn(`Deactivated ${badTokens.length} invalid FCM token(s)`);
  }

  // ── Queue lifecycle hooks ─────────────────────────────────────────────────

  @OnQueueFailed()
  onFailed(job: Job<PushNotificationPayload>, err: Error): void {
    this.logger.error(
      `Push job ${job.id} (type=${job.data.type}) failed after all retries: ${err.message}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<PushNotificationPayload>): void {
    this.logger.debug(`Push job ${job.id} completed (type=${job.data.type})`);
  }
}
