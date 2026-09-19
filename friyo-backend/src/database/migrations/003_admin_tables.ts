import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminTables1700000003000 implements MigrationInterface {
  name = 'AdminTables1700000003000';

  async up(qr: QueryRunner): Promise<void> {
    // ── Banners ────────────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TYPE banner_status_enum AS ENUM ('active', 'inactive');
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS banners (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title       VARCHAR(255) NOT NULL,
        image_url   VARCHAR(2048) NOT NULL,
        link_url    VARCHAR(2048),
        status      banner_status_enum NOT NULL DEFAULT 'active',
        start_at    TIMESTAMPTZ,
        end_at      TIMESTAMPTZ,
        created_by  UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await qr.query(`CREATE INDEX IF NOT EXISTS idx_banners_status_start ON banners(status, start_at);`);

    // ── Agreements ─────────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TYPE agreement_type_enum AS ENUM ('terms_of_service', 'privacy_policy', 'community_rules');
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS agreements (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type         agreement_type_enum NOT NULL,
        version      VARCHAR(50) NOT NULL,
        content      TEXT NOT NULL,
        is_current   BOOLEAN NOT NULL DEFAULT FALSE,
        published_at TIMESTAMPTZ,
        created_by   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(type, version)
      );
    `);

    await qr.query(`CREATE INDEX IF NOT EXISTS idx_agreements_type_version ON agreements(type, version);`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS agreements;`);
    await qr.query(`DROP TYPE IF EXISTS agreement_type_enum;`);
    await qr.query(`DROP TABLE IF EXISTS banners;`);
    await qr.query(`DROP TYPE IF EXISTS banner_status_enum;`);
  }
}
