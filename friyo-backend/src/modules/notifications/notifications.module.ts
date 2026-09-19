import { AccountCleanupProcessor } from './account-cleanup.processor';
import { ExpoPushService } from './expo-push.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';

import { UserDeviceToken }  from '../../database/entities/user-device-token.entity';
import { FridgeItem }       from '../../database/entities/fridge-item.entity';
import { Ingredient }       from '../../database/entities/ingredient.entity';
import { Recipe }           from '../../database/entities/recipe.entity';
import { RecipeIngredient } from '../../database/entities/recipe-ingredient.entity';
import { RecipeStep }       from '../../database/entities/recipe-step.entity';
import { RecipeAdaptation } from '../../database/entities/recipe-adaptation.entity';
import { User }             from '../../database/entities/user.entity';
import { MealLog }          from '../../database/entities/meal-log.entity';
import { ScanSession }      from '../../database/entities/scan-session.entity';
import { CommunityPost }    from '../../database/entities/community-post.entity';
import { AnalyticsSnapshot } from '../../database/entities/analytics-snapshot.entity';

import { NotificationsController }          from './notifications.controller';
import { NotificationsService }             from './notifications.service';
import { FcmService }                       from './fcm.service';
import { NotificationsScheduler }           from './notifications.scheduler';
import { PushNotificationProcessor }        from './processors/push-notification.processor';
import { FridgeExpiryProcessor }            from './processors/fridge-expiry.processor';
import { AnalyticsAggregateProcessor }      from './processors/analytics-aggregate.processor';
import { RecipeAdaptProcessor }             from './processors/recipe-adapt.processor';
import { AuthModule }                       from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserDeviceToken, FridgeItem, Ingredient, Recipe, RecipeIngredient,
      RecipeStep, RecipeAdaptation, User, MealLog, ScanSession,
      CommunityPost, AnalyticsSnapshot,
    ]),
    BullModule.registerQueue(
      { name: 'notifications.push' },
      { name: 'recipe.adapt' },
      { name: 'analytics.aggregate' },
      { name: 'fridge.expiry.reminder' },
    ),
    ScheduleModule.forRoot(),
    AuthModule,
  ],
  controllers: [NotificationsController],
  providers: [
    AccountCleanupProcessor, ExpoPushService, NotificationsService, FcmService, NotificationsScheduler,
    PushNotificationProcessor, FridgeExpiryProcessor,
    AnalyticsAggregateProcessor, RecipeAdaptProcessor,
  ],
  exports: [NotificationsService, FcmService],
})
export class NotificationsModule {}
