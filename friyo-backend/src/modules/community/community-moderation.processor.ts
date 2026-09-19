import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';

import { CommunityPost, ModerationStatus } from '../../database/entities/community-post.entity';
import { ContentModerationService } from './content-moderation.service';

interface ModerationJobData {
  postId: string;
  caption: string;
}

@Processor('community-moderation')
export class CommunityModerationProcessor {
  private readonly logger = new Logger(CommunityModerationProcessor.name);

  constructor(
    @InjectRepository(CommunityPost)
    private readonly postRepo: Repository<CommunityPost>,

    private readonly moderationService: ContentModerationService,
  ) {}

  @Process('text-moderate-post')
  async handleTextModeration(job: Job<ModerationJobData>): Promise<void> {
    const { postId, caption } = job.data;
    this.logger.log(`Running text moderation for post ${postId}`);

    // Verify post still exists and is still pending (may have been removed)
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post || post.moderationStatus !== ModerationStatus.PENDING) {
      this.logger.debug(`Post ${postId} no longer pending — skipping`);
      return;
    }

    const result = this.moderationService.checkText(caption ?? '');

    if (result.safe) {
      await this.postRepo.update(postId, { moderationStatus: ModerationStatus.APPROVED });
      this.logger.log(`Post ${postId} auto-approved`);
    } else {
      // Keep as FLAGGED for admin review queue
      await this.postRepo.update(postId, { moderationStatus: ModerationStatus.FLAGGED });
      this.logger.warn(`Post ${postId} flagged for admin review: ${result.reason}`);
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<ModerationJobData>, err: Error) {
    this.logger.error(`Moderation job ${job.id} (post ${job.data.postId}) failed: ${err.message}`);
  }
}
