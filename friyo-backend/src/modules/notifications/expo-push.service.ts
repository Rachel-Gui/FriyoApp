import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDeviceToken } from '../../database/entities/user-device-token.entity';

@Injectable()
@Processor('notifications.push')
export class ExpoPushService {
  constructor(private readonly config: ConfigService,
    @InjectQueue('notifications.push') private readonly queue: Queue,
    @InjectRepository(UserDeviceToken) private readonly tokens: Repository<UserDeviceToken>) {}

  private async request(path: string, body: unknown) {
    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Expo push service returned ${response.status}`);
    const result = await response.json() as any;
    if (result.errors?.length || !result.data) throw new Error('Expo push service rejected the request');
    return result.data;
  }

  async send(token: string, title: string, body: string, data?: Record<string, string>) {
    const ticket = await this.request('send', { to: token, title, body, data, sound: 'default', channelId: 'default' });
    if (ticket.status === 'error') {
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await this.tokens.update({ token }, { isActive: false });
        return;
      }
      throw new Error(`Expo push failed: ${ticket.details?.error || 'unknown'}`);
    }
    if (!ticket.id) throw new Error('Expo push ticket is missing');
    await this.queue.add('expo-receipt', { id: ticket.id, token }, {
      delay: 15 * 60 * 1000, attempts: 4, backoff: { type: 'fixed', delay: 5 * 60 * 1000 }, removeOnComplete: true, removeOnFail: 100,
    });
  }

  @Process('expo-receipt')
  async receipt(job: Job<{ id: string; token: string }>) {
    const receipts = await this.request('getReceipts', { ids: [job.data.id] });
    const receipt = receipts[job.data.id];
    if (!receipt) throw new Error('Push receipt is not available yet');
    if (receipt.status === 'error') {
      if (receipt.details?.error === 'DeviceNotRegistered') {
        await this.tokens.update({ token: job.data.token }, { isActive: false });
        return;
      }
      throw new Error(`Push delivery failed: ${receipt.details?.error || 'unknown'}`);
    }
  }
}
