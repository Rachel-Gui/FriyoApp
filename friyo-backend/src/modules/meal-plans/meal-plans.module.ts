import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MealLog }          from '../../database/entities/meal-log.entity';
import { MealPlan }         from '../../database/entities/meal-plan.entity';
import { Recipe }           from '../../database/entities/recipe.entity';
import { FridgeItem }       from '../../database/entities/fridge-item.entity';
import { UserSavedRecipe }  from '../../database/entities/user-saved-recipe.entity';

import { AuthModule }           from '../auth/auth.module';
import { FridgeModule }         from '../fridge/fridge.module';
import { MealPlansController }  from './meal-plans.controller';
import { MealPlansService }     from './meal-plans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MealLog,
      MealPlan,
      Recipe,
      FridgeItem,
      UserSavedRecipe,
    ]),
    AuthModule,
    FridgeModule,
  ],
  controllers: [MealPlansController],
  providers: [MealPlansService],
})
export class MealPlansModule {}
