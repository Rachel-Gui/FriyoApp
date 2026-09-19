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
    TypeOrmModule.forFeature([FridgeItem, UserProfile, MealLog]),
    AuthModule,
  ],
  controllers: [AiController],
  providers:   [AiService],
  exports:     [AiService],
})
export class AiModule {}
