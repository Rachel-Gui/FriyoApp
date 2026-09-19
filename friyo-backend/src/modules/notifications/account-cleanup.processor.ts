import { Inject } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import Redis from 'ioredis';
import { Job } from 'bull';
import { User } from '../../database/entities/user.entity';

@Processor('notifications.push')
export class AccountCleanupProcessor {
  private readonly s3: S3Client;
  constructor(private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis) {
    this.s3 = new S3Client({ region: config.get<string>('AWS_REGION') || 'us-east-1' });
  }
  @Process('account-cleanup')
  async cleanup(job: Job<{ userId: string }>) {
    const { userId } = job.data;
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid cleanup user ID');
    // Never remove uploads for an account whose database deletion did not succeed.
    if (await this.users.findOne({ where: { id: userId } })) throw new Error('Account deletion has not completed');
    const Bucket = this.config.get<string>('aws.s3Bucket');
    for (const prefix of ['fridge-scans', 'meal-photos', 'community']) {
      let ContinuationToken: string | undefined;
      do {
        const result = await this.s3.send(new ListObjectsV2Command({ Bucket, Prefix: `${prefix}/${userId}/`, ContinuationToken }));
        const Objects = (result.Contents || []).filter(o => o.Key).map(o => ({ Key: o.Key! }));
        if (Objects.length) {
          const deleted = await this.s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects } }));
          if (deleted.Errors?.length) throw new Error('Some account uploads could not be deleted');
        }
        ContinuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
      } while (ContinuationToken);
    }
    await this.redis.del(`ai:insights:${userId}`, `analysis:${userId}`);
  }
}
