import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';

import { FridgeItem }       from '../../database/entities/fridge-item.entity';
import { ScanSession }      from '../../database/entities/scan-session.entity';
import { Ingredient }       from '../../database/entities/ingredient.entity';
import { Recipe }           from '../../database/entities/recipe.entity';
import { RecipeIngredient } from '../../database/entities/recipe-ingredient.entity';

import { AuthModule }           from '../auth/auth.module';
import { FridgeController }     from './fridge.controller';
import { FridgeService }        from './fridge.service';
import { FridgeScanProcessor }  from './fridge-scan.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FridgeItem,
      ScanSession,
      Ingredient,
      Recipe,
      RecipeIngredient,
    ]),
    BullModule.registerQueue({ name: 'fridge-scan' }),
    AuthModule,
  ],
  controllers: [FridgeController],
  providers: [FridgeService, FridgeScanProcessor],
  exports: [FridgeService],
})
export class FridgeModule {}
