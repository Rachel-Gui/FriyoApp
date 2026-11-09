import { MigrationInterface, QueryRunner } from 'typeorm';
export class RecipeParallelSteps1791800000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE recipe_steps ADD COLUMN parallel_with_step_number integer NULL');
    // Curated seed: making cream sauce while chicken rests; toasting garlic while pasta boils.
    await q.query(`UPDATE recipe_steps s SET parallel_with_step_number = CASE WHEN s.step_number = 4 THEN 3 ELSE 1 END
      FROM recipes r WHERE s.recipe_id = r.id AND ((r.title = 'Creamy Tuscan Garlic Chicken' AND s.step_number = 4) OR (r.title = 'Quick Garlic Pasta' AND s.step_number = 2))`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('ALTER TABLE recipe_steps DROP COLUMN parallel_with_step_number'); }
}
