import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationsTables1700000004000 implements MigrationInterface {
  name = 'NotificationsTables1700000004000';

  async up(qr: QueryRunner): Promise<void> {
    // ── User device tokens (FCM / APNs registration tokens) ───────────────────
    await qr.query(`
      CREATE TYPE device_platform_enum AS ENUM ('fcm', 'apns');
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS user_device_tokens (
        id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token       VARCHAR(512) NOT NULL,
        platform    device_platform_enum NOT NULL DEFAULT 'fcm',
        is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, token)
      );
    `);

    await qr.query(`CREATE INDEX IF NOT EXISTS idx_udt_user_id ON user_device_tokens(user_id);`);

    // ── Analytics snapshots (daily aggregated stats) ───────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS analytics_snapshots (
        id                        UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
        date                      DATE    NOT NULL,
        daily_active_users        INTEGER NOT NULL DEFAULT 0,
        new_users                 INTEGER NOT NULL DEFAULT 0,
        total_meal_logs           INTEGER NOT NULL DEFAULT 0,
        total_scans               INTEGER NOT NULL DEFAULT 0,
        total_community_posts     INTEGER NOT NULL DEFAULT 0,
        total_recipe_adaptations  INTEGER NOT NULL DEFAULT 0,
        recipe_usage              JSONB   NOT NULL DEFAULT '{}',
        cuisine_distribution      JSONB   NOT NULL DEFAULT '{}',
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(date)
      );
    `);

    await qr.query(`CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_snapshots(date);`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS analytics_snapshots;`);
    await qr.query(`DROP TABLE IF EXISTS user_device_tokens;`);
    await qr.query(`DROP TYPE IF EXISTS device_platform_enum;`);
  }
}
