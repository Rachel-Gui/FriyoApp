import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { CommunityPost }  from '../../database/entities/community-post.entity';
import { PostComment }    from '../../database/entities/post-comment.entity';
import { PostLike }       from '../../database/entities/post-like.entity';
import { UserFriend }     from '../../database/entities/user-friend.entity';
import { Party }          from '../../database/entities/party.entity';
import { PartyMember }    from '../../database/entities/party-member.entity';
import { PartyPost }      from '../../database/entities/party-post.entity';
import { ContentReport }  from '../../database/entities/content-report.entity';

import { AuthModule }                    from '../auth/auth.module';
import { CommunityController }           from './community.controller';
import { CommunityService }              from './community.service';
import { ContentModerationService }      from './content-moderation.service';
import { CommunityModerationProcessor } from './community-moderation.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunityPost,
      PostComment,
      PostLike,
      UserFriend,
      Party,
      PartyMember,
      PartyPost,
      ContentReport,
    ]),
    BullModule.registerQueue({ name: 'community-moderation' }),
    AuthModule,
  ],
  controllers: [CommunityController],
  providers: [
    CommunityService,
    ContentModerationService,
    CommunityModerationProcessor,
  ],
})
export class CommunityModule {}
