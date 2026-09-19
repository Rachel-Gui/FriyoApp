import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';

import { Recipe }            from '../../database/entities/recipe.entity';
import { RecipeIngredient }  from '../../database/entities/recipe-ingredient.entity';
import { RecipeStep }        from '../../database/entities/recipe-step.entity';
import { RecipeAdaptation }  from '../../database/entities/recipe-adaptation.entity';
import { UserProfile }       from '../../database/entities/user-profile.entity';
import { FridgeItem }        from '../../database/entities/fridge-item.entity';
import { Ingredient }        from '../../database/entities/ingredient.entity';
import { AdminUser }         from '../../database/entities/admin-user.entity';

import { AuthModule }                    from '../auth/auth.module';
import { RecipesController }             from './recipes.controller';
import { RecipesService }                from './recipes.service';
import { RecipeRecommendationService }   from './recipe-recommendation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Recipe,
      RecipeIngredient,
      RecipeStep,
      RecipeAdaptation,
      UserProfile,
      FridgeItem,
      Ingredient,
      AdminUser,
    ]),
    AuthModule,
  ],
  controllers: [RecipesController],
  providers: [
    RecipesService,
    RecipeRecommendationService,
    {
      provide: 'ELASTICSEARCH_CLIENT',
      useFactory: (config: ConfigService) => {
        const node     = process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200';
        const username = process.env.ELASTICSEARCH_USERNAME ?? '';
        const password = process.env.ELASTICSEARCH_PASSWORD ?? '';
        return new ElasticsearchClient({
          node,
          auth: username ? { username, password } : undefined,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [RecipesService, RecipeRecommendationService],
})
export class RecipesModule {}
