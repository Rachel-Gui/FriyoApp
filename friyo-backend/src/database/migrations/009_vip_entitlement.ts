import { MigrationInterface, QueryRunner } from 'typeorm';
export class VipEntitlement1791800000001 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> { await q.query('ALTER TABLE users ADD COLUMN vip_expires_at timestamptz NULL'); }
  async down(q: QueryRunner): Promise<void> { await q.query('ALTER TABLE users DROP COLUMN vip_expires_at'); }
}
