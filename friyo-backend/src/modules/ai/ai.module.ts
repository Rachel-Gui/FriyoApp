import { AiUsageService } from './ai-usage.service';
import { User } from '../../database/entities/user.entity';
import { RecipesModule } from '../recipes/recipes.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FridgeItem }  from '../../database/entities/fridge-item.entity';
import { UserProfile } from '../../database/entities/user-profile.entity';
import { MealLog }     from '../../database/entities/meal-log.entity';

import { AuthModule }   from '../auth/auth.module';
import { AiController } from './ai.controller';
import { AiService }    from './ai.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, FridgeItem, UserProfile, MealLog]),
    AuthModule,
    RecipesModule,
  ],
  controllers: [AiController],
  providers:   [AiService, AiUsageService],
  exports:     [AiService],
})
export class AiModule {}
