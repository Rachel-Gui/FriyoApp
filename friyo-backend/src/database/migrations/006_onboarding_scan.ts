import { MigrationInterface, QueryRunner } from 'typeorm';
export class OnboardingScan1700000006000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(100)`);
    await qr.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_log_request ON meal_logs(user_id, client_request_id)`);
    for (const column of ['meal_formats', 'flavor_preferences', 'dietary_restrictions']) {
      await qr.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ${column} JSONB NOT NULL DEFAULT '[]'::jsonb`);
    }
    for (const column of ['time_preference', 'grocery_frequency', 'initial_craving']) {
      await qr.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ${column} TEXT NOT NULL DEFAULT ''`);
    }
    await qr.query(`ALTER TABLE scan_sessions ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`);
    await qr.query(`UPDATE scan_sessions s SET confirmed_at = s.updated_at WHERE confirmed_at IS NULL AND EXISTS (SELECT 1 FROM fridge_items f WHERE f.scan_session_id = s.id)`);
  }
  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS idx_meal_log_request`);
    await qr.query(`ALTER TABLE meal_logs DROP COLUMN IF EXISTS client_request_id`);
    await qr.query(`ALTER TABLE scan_sessions DROP COLUMN IF EXISTS confirmed_at`);
    for (const column of ['meal_formats', 'flavor_preferences', 'dietary_restrictions', 'time_preference', 'grocery_frequency', 'initial_craving']) {
      await qr.query(`ALTER TABLE user_profiles DROP COLUMN IF EXISTS ${column}`);
    }
  }
}
