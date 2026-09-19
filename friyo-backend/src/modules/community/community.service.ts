import { normalizeImage } from '../../common/image-upload';
import {
  Injectable, NotFoundException, ForbiddenException,
  ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import { CommunityPost, ModerationStatus } from '../../database/entities/community-post.entity';
import { PostComment } from '../../database/entities/post-comment.entity';
import { PostLike } from '../../database/entities/post-like.entity';
import { UserFriend, FriendStatus } from '../../database/entities/user-friend.entity';
import { Party } from '../../database/entities/party.entity';
import { PartyMember } from '../../database/entities/party-member.entity';
import { PartyPost } from '../../database/entities/party-post.entity';
import { ContentReport } from '../../database/entities/content-report.entity';

import { ContentModerationService } from './content-moderation.service';
import { FeedQueryDto, FeedSort } from './dto/feed-query.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { ReportContentDto } from './dto/report-content.dto';
import { CreatePartyDto } from './dto/create-party.dto';
import { JoinPartyDto } from './dto/join-party.dto';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);
  private readonly s3: S3Client;
  private readonly s3Bucket: string;
  private readonly s3Region: string;

  constructor(
    @InjectRepository(CommunityPost)
    private readonly postRepo: Repository<CommunityPost>,

    @InjectRepository(PostComment)
    private readonly commentRepo: Repository<PostComment>,

    @InjectRepository(PostLike)
    private readonly likeRepo: Repository<PostLike>,

    @InjectRepository(UserFriend)
    private readonly friendRepo: Repository<UserFriend>,

    @InjectRepository(Party)
    private readonly partyRepo: Repository<Party>,

    @InjectRepository(PartyMember)
    private readonly partyMemberRepo: Repository<PartyMember>,

    @InjectRepository(PartyPost)
    private readonly partyPostRepo: Repository<PartyPost>,

    @InjectRepository(ContentReport)
    private readonly reportRepo: Repository<ContentReport>,

    @InjectQueue('community-moderation')
    private readonly moderationQueue: Queue,

    private readonly moderationService: ContentModerationService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.s3Bucket = this.configService.get<string>('aws.s3Bucket') ?? 'friyo-uploads';
    this.s3Region = this.configService.get<string>('aws.region') ?? 'us-east-1';
    this.s3 = new S3Client({
      region: this.s3Region,
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId') ?? '',
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey') ?? '',
      },
    });
  }

  // ── 1. GET /community/feed ─────────────────────────────────────────────────

  async getFeed(userId: string, query: FeedQueryDto) {
    const { page = 1, limit = 20, sort = FeedSort.RECENT } = query;
    const skip = (page - 1) * limit;

    const qb = this.postRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u')
      .leftJoinAndSelect('p.recipe', 'r')
      .where("p.moderationStatus = 'approved'")
      .andWhere('p.isHidden = false');

    if (sort === FeedSort.FOLLOWING) {
      const friendIds = await this.getFriendIds(userId);
      if (!friendIds.length) {
        // No friends → fall back to recent
        qb.orderBy('p.createdAt', 'DESC');
      } else {
        qb.andWhere('p.userId IN (:...friendIds)', { friendIds })
          .orderBy('p.createdAt', 'DESC');
      }
    } else if (sort === FeedSort.TRENDING) {
      qb.orderBy('(p.likesCount + p.commentsCount)', 'DESC')
        .addOrderBy('p.createdAt', 'DESC');
    } else {
      qb.orderBy('p.createdAt', 'DESC');
    }

    const [posts, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const enriched = await this.enrichWithHasLiked(posts, userId);

    return {
      items: enriched,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // ── 2. GET /community/posts/:id ────────────────────────────────────────────

  async getPost(postId: string, userId: string) {
    const post = await this.postRepo.findOne({
      where: { id: postId, moderationStatus: ModerationStatus.APPROVED },
      relations: ['user', 'recipe'],
    });
    if (!post) throw new NotFoundException('Post not found');

    const comments = await this.commentRepo.find({
      where: { postId, isHidden: false },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      take: 10,
    });

    const [liked] = await this.enrichWithHasLiked([post], userId);
    return { ...liked, comments };
  }

  // ── 3. POST /community/posts ───────────────────────────────────────────────

  async createPost(
    userId: string,
    dto: CreatePostDto,
    files: Express.Multer.File[],
  ) {
    if (!files?.length && !dto.caption) {
      throw new BadRequestException('Post must have at least a photo or a caption');
    }

    // Upload photos to S3 and run Rekognition on each
    const photoUrls: string[] = [];
    for (let i = 0; i < (files ?? []).length; i++) {
      const file = await normalizeImage(files[i]);
      const ext = file.originalname.split('.').pop() ?? 'jpg';
      const key = `community/${userId}/${Date.now()}_${i}.${ext}`;

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      const imgResult = await this.moderationService.checkImage(key);
      if (!imgResult.safe) {
        // Don't create the post — photo failed moderation
        throw new BadRequestException(
          `Photo ${i + 1} was rejected: ${imgResult.reason}`,
        );
      }

      photoUrls.push(
        `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${key}`,
      );
    }

    const post = this.postRepo.create({
      userId,
      recipeId: dto.recipe_id ?? null,
      caption: dto.caption ?? null,
      photoUrls,
      moderationStatus: ModerationStatus.PENDING,
    });
    const saved = await this.postRepo.save(post);

    // Queue text moderation (non-blocking — post is visible to user immediately)
    await this.moderationQueue.add(
      'text-moderate-post',
      { postId: saved.id, caption: dto.caption ?? '' },
      { attempts: 2, backoff: { type: 'fixed', delay: 3000 } },
    );

    return saved;
  }

  // ── 4. DELETE /community/posts/:id ────────────────────────────────────────

  async deletePost(userId: string, postId: string): Promise<void> {
    const post = await this.postRepo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.userId !== userId) throw new ForbiddenException('Cannot delete another user\'s post');
    await this.postRepo.remove(post);
  }

  // ── 5 & 6. Like / Unlike ──────────────────────────────────────────────────

  async likePost(userId: string, postId: string) {
    const post = await this.findApprovedPost(postId);

    const existing = await this.likeRepo.findOne({ where: { postId, userId } });
    if (existing) {
      return { liked: true, likes_count: post.likesCount };
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(PostLike, manager.create(PostLike, { postId, userId }));
      await manager.increment(CommunityPost, { id: postId }, 'likesCount', 1);
    });

    return { liked: true, likes_count: post.likesCount + 1 };
  }

  async unlikePost(userId: string, postId: string) {
    const post = await this.findApprovedPost(postId);
    const like = await this.likeRepo.findOne({ where: { postId, userId } });
    if (!like) throw new NotFoundException('Like not found');

    await this.dataSource.transaction(async (manager) => {
      await manager.remove(PostLike, like);
      await manager.decrement(CommunityPost, { id: postId }, 'likesCount', 1);
    });

    return { liked: false, likes_count: Math.max(0, post.likesCount - 1) };
  }

  // ── 7. GET /community/posts/:id/comments ─────────────────────────────────

  async getComments(postId: string, page = 1, limit = 20) {
    await this.findApprovedPost(postId);

    const [comments, total] = await this.commentRepo.findAndCount({
      where: { postId, isHidden: false },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items: comments, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ── 8. POST /community/posts/:id/comments ────────────────────────────────

  async addComment(userId: string, postId: string, dto: AddCommentDto) {
    await this.findApprovedPost(postId);

    const modResult = this.moderationService.checkText(dto.content);
    const isHidden = !modResult.safe;

    const comment = this.commentRepo.create({
      userId,
      postId,
      content: dto.content,
      parentCommentId: dto.parent_comment_id ?? null,
      isHidden,
    });
    const saved = await this.commentRepo.save(comment);

    if (!isHidden) {
      await this.postRepo.increment({ id: postId }, 'commentsCount', 1);
    } else {
      this.logger.warn(`Comment ${saved.id} hidden: ${modResult.reason}`);
    }

    return { ...saved, hidden_reason: isHidden ? modResult.reason : null };
  }

  // ── 9. DELETE /community/comments/:id ────────────────────────────────────

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.commentRepo.findOne({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('Cannot delete another user\'s comment');

    await this.commentRepo.remove(comment);
    if (!comment.isHidden) {
      await this.postRepo.decrement({ id: comment.postId }, 'commentsCount', 1);
    }
  }

  // ── 10. POST /community/report ────────────────────────────────────────────

  async reportContent(reporterId: string, dto: ReportContentDto) {
    const report = this.reportRepo.create({
      reporterId,
      contentType: dto.content_type,
      contentId: dto.content_id,
      reason: dto.reason,
    });
    return this.reportRepo.save(report);
  }

  // ── 11. POST /community/parties ───────────────────────────────────────────

  async createParty(userId: string, dto: CreatePartyDto) {
    return this.dataSource.transaction(async (manager) => {
      const party = manager.create(Party, {
        hostId: userId,
        name: dto.name,
        description: dto.description ?? null,
        eventDate: dto.event_date ? new Date(dto.event_date) : null,
      });
      const saved = await manager.save(Party, party);

      // Host automatically becomes a member
      const member = manager.create(PartyMember, {
        partyId: saved.id,
        userId,
      });
      await manager.save(PartyMember, member);

      return saved;
    });
  }

  // ── 12. GET /community/parties ────────────────────────────────────────────

  async listUserParties(userId: string) {
    const memberships = await this.partyMemberRepo.find({
      where: { userId },
      relations: ['party', 'party.host'],
      order: { joinedAt: 'DESC' },
    });
    return memberships.map((m) => m.party);
  }

  // ── 13. GET /community/parties/:id ───────────────────────────────────────

  async getPartyDetail(userId: string, partyId: string) {
    const party = await this.partyRepo.findOne({
      where: { id: partyId },
      relations: ['host', 'members', 'members.user'],
    });
    if (!party) throw new NotFoundException('Party not found');

    // Verify caller is a member
    const isMember = party.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('You are not a member of this party');

    const sharedPosts = await this.getPartyPosts(userId, partyId);

    return { ...party, shared_posts: sharedPosts.items };
  }

  // ── 14. POST /community/parties/join ─────────────────────────────────────

  async joinParty(userId: string, dto: JoinPartyDto) {
    const party = await this.partyRepo.findOne({
      where: { inviteCode: dto.invite_code.toUpperCase(), isActive: true },
    });
    if (!party) throw new NotFoundException('Invalid or expired invite code');

    const existing = await this.partyMemberRepo.findOne({
      where: { partyId: party.id, userId },
    });
    if (existing) throw new ConflictException('Already a member of this party');

    const member = this.partyMemberRepo.create({ partyId: party.id, userId });
    await this.partyMemberRepo.save(member);

    return party;
  }

  // ── 15. POST /community/parties/:id/posts/:postId ────────────────────────

  async addPostToParty(userId: string, partyId: string, postId: string) {
    // Verify membership
    await this.requirePartyMember(userId, partyId);

    const post = await this.postRepo.findOne({
      where: { id: postId, moderationStatus: ModerationStatus.APPROVED },
    });
    if (!post) throw new NotFoundException('Post not found or not yet approved');

    const existing = await this.partyPostRepo.findOne({ where: { partyId, postId } });
    if (existing) throw new ConflictException('Post already shared in this party');

    const partyPost = this.partyPostRepo.create({ partyId, postId });
    return this.partyPostRepo.save(partyPost);
  }

  // ── 16. GET /community/parties/:id/posts ─────────────────────────────────

  async getPartyPosts(userId: string, partyId: string, page = 1, limit = 20) {
    await this.requirePartyMember(userId, partyId);

    const [partyPosts, total] = await this.partyPostRepo.findAndCount({
      where: { partyId },
      relations: ['post', 'post.user', 'post.recipe'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const posts = partyPosts.map((pp) => pp.post).filter(Boolean);
    const enriched = await this.enrichWithHasLiked(posts, userId);

    return { items: enriched, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ── 17. DELETE /community/parties/:id/members/:userId ────────────────────

  async removePartyMember(
    hostId: string,
    partyId: string,
    targetUserId: string,
  ): Promise<void> {
    const party = await this.partyRepo.findOne({ where: { id: partyId } });
    if (!party) throw new NotFoundException('Party not found');
    if (party.hostId !== hostId) throw new ForbiddenException('Only the host can remove members');
    if (targetUserId === hostId) throw new BadRequestException('Host cannot remove themselves');

    const member = await this.partyMemberRepo.findOne({
      where: { partyId, userId: targetUserId },
    });
    if (!member) throw new NotFoundException('Member not found');

    await this.partyMemberRepo.remove(member);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getFriendIds(userId: string): Promise<string[]> {
    const friendships = await this.friendRepo.find({
      where: [
        { requesterId: userId, status: FriendStatus.ACCEPTED },
        { receiverId: userId, status: FriendStatus.ACCEPTED },
      ],
    });
    return friendships.map((f) =>
      f.requesterId === userId ? f.receiverId : f.requesterId,
    );
  }

  private async findApprovedPost(postId: string): Promise<CommunityPost> {
    const post = await this.postRepo.findOne({
      where: { id: postId, moderationStatus: ModerationStatus.APPROVED },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  private async enrichWithHasLiked(
    posts: CommunityPost[],
    userId: string,
  ): Promise<Array<CommunityPost & { has_liked: boolean }>> {
    if (!posts.length) return [];

    const postIds = posts.map((p) => p.id);
    const likes = await this.likeRepo.find({
      where: { userId, postId: In(postIds) },
      select: ['postId'],
    });
    const likedSet = new Set(likes.map((l) => l.postId));

    return posts.map((p) => Object.assign(p, { has_liked: likedSet.has(p.id) }));
  }

  private async requirePartyMember(userId: string, partyId: string): Promise<void> {
    const member = await this.partyMemberRepo.findOne({ where: { partyId, userId } });
    if (!member) throw new ForbiddenException('You are not a member of this party');
  }
}
