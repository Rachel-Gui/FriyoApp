import { imageUploadLimits } from '../../common/image-upload';
import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFiles, ParseUUIDPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';

import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

import { CommunityService } from './community.service';
import { FeedQueryDto } from './dto/feed-query.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { ReportContentDto } from './dto/report-content.dto';
import { CreatePartyDto } from './dto/create-party.dto';
import { JoinPartyDto } from './dto/join-party.dto';

@ApiTags('community')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // ── Feed ────────────────────────────────────────────────────────────────────

  @Get('feed')
  @ApiOperation({ summary: 'Paginated community feed (recent | trending | following)' })
  getFeed(@CurrentUser() user: User, @Query() query: FeedQueryDto) {
    return this.communityService.getFeed(user.id, query);
  }

  // ── Posts — static routes before :id ──────────────────────────────────────

  @Post('posts')
  @UseInterceptors(FilesInterceptor('photos', 3, { storage: memoryStorage(), limits: imageUploadLimits }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        recipe_id: { type: 'string', format: 'uuid' },
        caption:   { type: 'string', maxLength: 2000 },
        photos:    { type: 'array', items: { type: 'string', format: 'binary' }, maxItems: 3 },
      },
    },
  })
  @ApiOperation({ summary: 'Create a community post (photos go through Rekognition)' })
  createPost(
    @CurrentUser() user: User,
    @Body() dto: CreatePostDto,
    @UploadedFiles() photos: Express.Multer.File[],
  ) {
    return this.communityService.createPost(user.id, dto, photos);
  }

  @Post('report')
  @ApiOperation({ summary: 'Report a post, comment, or user' })
  reportContent(@CurrentUser() user: User, @Body() dto: ReportContentDto) {
    return this.communityService.reportContent(user.id, dto);
  }

  // ── Post detail — parameterized ───────────────────────────────────────────

  @Get('posts/:id')
  @ApiOperation({ summary: 'Single post with first 10 comments' })
  getPost(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communityService.getPost(id, user.id);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own post' })
  deletePost(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communityService.deletePost(user.id, id);
  }

  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Like a post (idempotent)' })
  likePost(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communityService.likePost(user.id, id);
  }

  @Delete('posts/:id/like')
  @ApiOperation({ summary: 'Remove like from a post' })
  unlikePost(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communityService.unlikePost(user.id, id);
  }

  @Get('posts/:id/comments')
  @ApiOperation({ summary: 'Paginated comments for a post' })
  getComments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communityService.getComments(id, Number(page) || 1, Number(limit) || 20);
  }

  @Post('posts/:id/comments')
  @ApiOperation({ summary: 'Add a comment (text moderation applied on save)' })
  addComment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.communityService.addComment(user.id, id, dto);
  }

  // ── Comments ───────────────────────────────────────────────────────────────

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete own comment' })
  deleteComment(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communityService.deleteComment(user.id, id);
  }

  // ── Parties — static routes before :id ────────────────────────────────────

  @Post('parties')
  @ApiOperation({ summary: 'Create a party (host auto-joins)' })
  createParty(@CurrentUser() user: User, @Body() dto: CreatePartyDto) {
    return this.communityService.createParty(user.id, dto);
  }

  @Get('parties')
  @ApiOperation({ summary: "List parties user belongs to (host or member)" })
  listParties(@CurrentUser() user: User) {
    return this.communityService.listUserParties(user.id);
  }

  // IMPORTANT: /parties/join must come before /parties/:id to avoid route conflict
  @Post('parties/join')
  @ApiOperation({ summary: 'Join a party via 8-char invite code' })
  joinParty(@CurrentUser() user: User, @Body() dto: JoinPartyDto) {
    return this.communityService.joinParty(user.id, dto);
  }

  // ── Party detail — parameterized ──────────────────────────────────────────

  @Get('parties/:id')
  @ApiOperation({ summary: 'Party detail with member list and shared posts' })
  getPartyDetail(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communityService.getPartyDetail(user.id, id);
  }

  @Post('parties/:id/posts/:postId')
  @ApiOperation({ summary: 'Share an approved post into a party' })
  addPostToParty(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.communityService.addPostToParty(user.id, id, postId);
  }

  @Get('parties/:id/posts')
  @ApiOperation({ summary: 'All posts shared in this party' })
  getPartyPosts(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communityService.getPartyPosts(
      user.id, id,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Delete('parties/:id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from party (host only)' })
  removePartyMember(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.communityService.removePartyMember(user.id, id, memberId);
  }
}
