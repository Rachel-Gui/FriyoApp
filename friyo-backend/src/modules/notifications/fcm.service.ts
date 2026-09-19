import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, getApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { App } from 'firebase-admin/app';
import type { Message, MulticastMessage, BatchResponse } from 'firebase-admin/messaging';

export interface FcmSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Thin wrapper around Firebase Admin SDK messaging.
 * Handles single device, multicast (up to 500 tokens), and topic sends.
 *
 * Initialisation is lazy — the Firebase app is created on first use
 * so tests without FCM config don't throw on startup.
 */
@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private firebaseApp: App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.initFirebase();
  }

  // ── Initialisation ─────────────────────────────────────────────────────────

  private initFirebase(): void {
    const projectId   = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey  = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Firebase credentials not configured — FCM sends will be no-ops. ' +
        'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.',
      );
      return;
    }

    // Avoid double-init if app is already registered
    if (getApps().length > 0) {
      this.firebaseApp = getApp();
      return;
    }

    this.firebaseApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log(`Firebase Admin initialised for project "${projectId}"`);
  }

  // ── Single device ──────────────────────────────────────────────────────────

  async sendToToken(
    token: string,
    title: string,
    body:  string,
    data?: Record<string, string>,
    imageUrl?: string,
  ): Promise<FcmSendResult> {
    if (!this.firebaseApp) return { success: false, error: 'FCM not configured' };

    const message: Message = {
      token,
      notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
      data:         data ?? {},
      android:      { priority: 'high' },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };

    try {
      const messageId = await getMessaging(this.firebaseApp).send(message);
      return { success: true, messageId };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`FCM send failed (token …${token.slice(-8)}): ${msg}`);
      return { success: false, error: (err as { code?: string }).code || msg };
    }
  }

  // ── Multicast (up to 500 tokens per call) ─────────────────────────────────

  async sendToTokens(
    tokens: string[],
    title: string,
    body:  string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number; failedTokens: string[] }> {
    if (!this.firebaseApp || tokens.length === 0) {
      return { successCount: 0, failureCount: tokens.length, failedTokens: tokens };
    }

    const CHUNK = 500;
    let successCount = 0;
    let failureCount = 0;
    const failedTokens: string[] = [];

    for (let i = 0; i < tokens.length; i += CHUNK) {
      const chunk = tokens.slice(i, i + CHUNK);
      const message: MulticastMessage = {
        tokens: chunk,
        notification: { title, body },
        data:   data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      };

      const result: BatchResponse = await getMessaging(this.firebaseApp)
        .sendEachForMulticast(message);

      successCount += result.successCount;
      failureCount += result.failureCount;

      result.responses.forEach((r, idx) => {
        if (!r.success) failedTokens.push(chunk[idx]);
      });
    }

    if (failureCount > 0) {
      this.logger.warn(`FCM multicast: ${failureCount} failures out of ${tokens.length}`);
    }

    return { successCount, failureCount, failedTokens };
  }

  // ── Topic broadcast ────────────────────────────────────────────────────────

  async sendToTopic(
    topic: string,
    title: string,
    body:  string,
    data?: Record<string, string>,
  ): Promise<FcmSendResult> {
    if (!this.firebaseApp) return { success: false, error: 'FCM not configured' };

    const message: Message = {
      topic,
      notification: { title, body },
      data:   data ?? {},
      android: { priority: 'high' },
    };

    try {
      const messageId = await getMessaging(this.firebaseApp).send(message);
      this.logger.log(`FCM topic "${topic}" sent → ${messageId}`);
      return { success: true, messageId };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`FCM topic send failed (topic=${topic}): ${msg}`);
      return { success: false, error: (err as { code?: string }).code || msg };
    }
  }

  /** Returns true if Firebase was successfully configured */
  get isConfigured(): boolean {
    return this.firebaseApp !== null;
  }
}
