import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User }             from '../../database/entities/user.entity';
import { Ingredient }       from '../../database/entities/ingredient.entity';
import { FridgeItem }       from '../../database/entities/fridge-item.entity';
import { RecipeIngredient } from '../../database/entities/recipe-ingredient.entity';
import { Recipe }           from '../../database/entities/recipe.entity';
import { MealLog }          from '../../database/entities/meal-log.entity';
import { ScanSession }      from '../../database/entities/scan-session.entity';
import { CommunityPost }    from '../../database/entities/community-post.entity';
import { ContentReport }    from '../../database/entities/content-report.entity';
import { AdminUser }        from '../../database/entities/admin-user.entity';
import { AdminLog }         from '../../database/entities/admin-log.entity';
import { Banner }           from '../../database/entities/banner.entity';
import { Agreement }        from '../../database/entities/agreement.entity';

import { AuthModule }       from '../auth/auth.module';
import { AdminController }  from './admin.controller';
import { AdminService }     from './admin.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notifications.push' }),
    TypeOrmModule.forFeature([
      User,
      Ingredient,
      FridgeItem,
      RecipeIngredient,
      Recipe,
      MealLog,
      ScanSession,
      CommunityPost,
      ContentReport,
      AdminUser,
      AdminLog,
      Banner,
      Agreement,
    ]),
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
