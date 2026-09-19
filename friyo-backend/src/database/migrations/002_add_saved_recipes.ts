import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavedRecipes1700000002000 implements MigrationInterface {
  name = 'AddSavedRecipes1700000002000';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS user_saved_recipes (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipe_id   UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, recipe_id)
      );
    `);

    await qr.query(`CREATE INDEX IF NOT EXISTS idx_usr_userId   ON user_saved_recipes(user_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_usr_recipeId ON user_saved_recipes(recipe_id);`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS user_saved_recipes;`);
  }
}
