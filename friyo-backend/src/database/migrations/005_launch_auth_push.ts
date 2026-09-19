import { MigrationInterface, QueryRunner } from 'typeorm';
export class LaunchAuthPush1700000005000 implements MigrationInterface {
  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_refresh_token TEXT`);
    await qr.query(`ALTER TYPE device_platform_enum ADD VALUE IF NOT EXISTS 'expo'`);
    await qr.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ`);
    // A physical installation must belong to only one signed-in account.
    await qr.query(`DELETE FROM user_device_tokens a USING user_device_tokens b
      WHERE a.token=b.token AND (a.updated_at, a.id) < (b.updated_at, b.id)`);
    await qr.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_device_token_unique ON user_device_tokens(token)`);
  }
  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP INDEX IF EXISTS idx_device_token_unique`);
    await qr.query(`ALTER TABLE users DROP COLUMN IF EXISTS apple_refresh_token`);
    await qr.query(`ALTER TABLE users DROP COLUMN IF EXISTS password_changed_at`);
    // PostgreSQL enum values cannot be removed safely while records reference them.
  }
}
