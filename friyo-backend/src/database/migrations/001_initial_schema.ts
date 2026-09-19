import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1699999999000 implements MigrationInterface {
  name = 'InitialSchema1699999999000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Extensions ────────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    // ── Enums ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE auth_provider_enum AS ENUM ('local','google','apple','facebook')
    `);
    await queryRunner.query(`
      CREATE TYPE diet_type_enum AS ENUM
        ('omnivore','vegetarian','vegan','pescatarian','keto','paleo','halal','kosher')
    `);
    await queryRunner.query(`
      CREATE TYPE cooking_skill_enum AS ENUM ('beginner','intermediate','advanced','chef')
    `);
    await queryRunner.query(`
      CREATE TYPE ingredient_category_enum AS ENUM ('fresh','freeze','pantry','condiment')
    `);
    await queryRunner.query(`
      CREATE TYPE storage_type_enum AS ENUM ('fridge','freezer','pantry')
    `);
    await queryRunner.query(`
      CREATE TYPE scan_status_enum AS ENUM ('processing','completed','failed')
    `);
    await queryRunner.query(`
      CREATE TYPE recipe_difficulty_enum AS ENUM ('easy','medium','hard')
    `);
    await queryRunner.query(`
      CREATE TYPE recipe_status_enum AS ENUM ('draft','published','archived')
    `);
    await queryRunner.query(`
      CREATE TYPE recipe_meal_type_enum AS ENUM ('breakfast','lunch','dinner','snack')
    `);
    await queryRunner.query(`
      CREATE TYPE recipe_review_status_enum AS ENUM ('pending','approved','rejected')
    `);
    await queryRunner.query(`
      CREATE TYPE step_type_enum AS ENUM ('hands_on','hands_off')
    `);
    await queryRunner.query(`
      CREATE TYPE meal_type_enum AS ENUM ('breakfast','lunch','dinner','snack')
    `);
    await queryRunner.query(`
      CREATE TYPE moderation_status_enum AS ENUM ('pending','approved','flagged','removed')
    `);
    await queryRunner.query(`
      CREATE TYPE friend_status_enum AS ENUM ('pending','accepted','blocked')
    `);
    await queryRunner.query(`
      CREATE TYPE content_type_enum AS ENUM ('post','comment','user')
    `);
    await queryRunner.query(`
      CREATE TYPE report_status_enum AS ENUM ('pending','resolved','dismissed')
    `);
    await queryRunner.query(`
      CREATE TYPE admin_role_enum AS ENUM ('super_admin','ops','content_reviewer')
    `);

    // ── users ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE users (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email           VARCHAR UNIQUE,
        phone           VARCHAR UNIQUE,
        name            VARCHAR NOT NULL,
        avatar_url      VARCHAR,
        password_hash   VARCHAR,
        auth_provider   auth_provider_enum NOT NULL DEFAULT 'local',
        provider_id     VARCHAR,
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
        last_active_at  TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_users_email    ON users (email)`);
    await queryRunner.query(`CREATE INDEX idx_users_phone    ON users (phone)`);
    await queryRunner.query(`CREATE INDEX idx_users_provider ON users (auth_provider, provider_id)`);

    // ── user_profiles ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE user_profiles (
        id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id                  UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        diet_type                diet_type_enum NOT NULL DEFAULT 'omnivore',
        allergies                JSONB NOT NULL DEFAULT '[]',
        cooking_skill            cooking_skill_enum NOT NULL DEFAULT 'beginner',
        cooking_tools            JSONB NOT NULL DEFAULT '[]',
        household_size           INT NOT NULL DEFAULT 1,
        health_goals             JSONB NOT NULL DEFAULT '[]',
        preferred_cuisines       JSONB NOT NULL DEFAULT '[]',
        disliked_ingredients     JSONB NOT NULL DEFAULT '[]',
        weekly_cooking_days      INT NOT NULL DEFAULT 3,
        onboarding_completed_at  TIMESTAMPTZ,
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── user_friends ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE user_friends (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        requester_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status        friend_status_enum NOT NULL DEFAULT 'pending',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (requester_id, receiver_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_user_friends_requester ON user_friends (requester_id)`);
    await queryRunner.query(`CREATE INDEX idx_user_friends_receiver  ON user_friends (receiver_id)`);

    // ── ingredients ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE ingredients (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name                VARCHAR NOT NULL,
        name_zh             VARCHAR,
        category            ingredient_category_enum NOT NULL DEFAULT 'fresh',
        calories_per_100g   DECIMAL(7,2),
        default_shelf_days  INT,
        unit                VARCHAR,
        tags                TEXT,
        aliases             TEXT,
        image_url           VARCHAR,
        created_by_admin    BOOLEAN NOT NULL DEFAULT FALSE,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_ingredients_name     ON ingredients (name)`);
    await queryRunner.query(`CREATE INDEX idx_ingredients_category ON ingredients (category)`);
    await queryRunner.query(`
      CREATE INDEX idx_ingredients_name_trgm ON ingredients USING GIN (name gin_trgm_ops)
    `);

    // ── scan_sessions ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE scan_sessions (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        image_url      VARCHAR NOT NULL,
        ai_raw_result  JSONB,
        status         scan_status_enum NOT NULL DEFAULT 'processing',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_scan_sessions_user ON scan_sessions (user_id, created_at DESC)`);

    // ── fridge_items ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE fridge_items (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ingredient_id     UUID REFERENCES ingredients(id) ON DELETE SET NULL,
        custom_name       VARCHAR,
        quantity          DECIMAL(10,2) NOT NULL DEFAULT 1,
        unit              VARCHAR,
        storage_type      storage_type_enum NOT NULL DEFAULT 'fridge',
        expiry_date       DATE,
        calories_override DECIMAL(7,2),
        scan_session_id   UUID REFERENCES scan_sessions(id) ON DELETE SET NULL,
        added_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_fridge_items_user       ON fridge_items (user_id)`);
    await queryRunner.query(`CREATE INDEX idx_fridge_items_expiry     ON fridge_items (user_id, expiry_date)`);
    await queryRunner.query(`CREATE INDEX idx_fridge_items_ingredient ON fridge_items (ingredient_id)`);

    // ── admin_users (before recipes — recipes.approved_by references it) ──────
    await queryRunner.query(`
      CREATE TABLE admin_users (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        username       VARCHAR NOT NULL UNIQUE,
        email          VARCHAR NOT NULL UNIQUE,
        password_hash  VARCHAR NOT NULL,
        role           admin_role_enum NOT NULL DEFAULT 'content_reviewer',
        permissions    JSONB NOT NULL DEFAULT '{}',
        is_active      BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at  TIMESTAMPTZ,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ── recipes ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE recipes (
        id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title                VARCHAR NOT NULL,
        title_zh             VARCHAR,
        description          TEXT,
        cuisine_type         VARCHAR,
        meal_type            recipe_meal_type_enum,
        difficulty           recipe_difficulty_enum NOT NULL DEFAULT 'medium',
        status               recipe_status_enum NOT NULL DEFAULT 'draft',
        review_status        recipe_review_status_enum NOT NULL DEFAULT 'pending',
        prep_time_min        INT NOT NULL DEFAULT 0,
        cook_time_min        INT NOT NULL DEFAULT 0,
        servings             INT NOT NULL DEFAULT 2,
        calories_per_serving INT,
        cuisines             JSONB NOT NULL DEFAULT '[]',
        tags                 JSONB NOT NULL DEFAULT '[]',
        diet_types           JSONB NOT NULL DEFAULT '[]',
        required_tools       JSONB NOT NULL DEFAULT '[]',
        cover_image_url      VARCHAR,
        is_system            BOOLEAN NOT NULL DEFAULT FALSE,
        is_published         BOOLEAN NOT NULL DEFAULT FALSE,
        xp_reward            INT NOT NULL DEFAULT 50,
        likes_count          INT NOT NULL DEFAULT 0,
        saves_count          INT NOT NULL DEFAULT 0,
        cook_count           INT NOT NULL DEFAULT 0,
        average_rating       DECIMAL(3,2) NOT NULL DEFAULT 0,
        rating_count         INT NOT NULL DEFAULT 0,
        author_id            UUID REFERENCES users(id) ON DELETE SET NULL,
        approved_by          UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        is_ai_generated      BOOLEAN NOT NULL DEFAULT FALSE,
        source_url           VARCHAR,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_recipes_author       ON recipes (author_id)`);
    await queryRunner.query(`CREATE INDEX idx_recipes_status       ON recipes (status, is_published, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_recipes_review       ON recipes (review_status)`);
    await queryRunner.query(`CREATE INDEX idx_recipes_meal_type    ON recipes (meal_type)`);
    await queryRunner.query(`CREATE INDEX idx_recipes_is_system    ON recipes (is_system)`);
    await queryRunner.query(`
      CREATE INDEX idx_recipes_title_trgm ON recipes USING GIN (title gin_trgm_ops)
    `);

    // ── recipe_ingredients ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE recipe_ingredients (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        recipe_id      UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        ingredient_id  UUID REFERENCES ingredients(id) ON DELETE SET NULL,
        display_name   VARCHAR,
        quantity       DECIMAL(10,2),
        unit           VARCHAR,
        is_optional    BOOLEAN NOT NULL DEFAULT FALSE,
        substitutes    JSONB,
        sort_order     INT NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_recipe_ingredients_recipe     ON recipe_ingredients (recipe_id)`);
    await queryRunner.query(`CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients (ingredient_id)`);

    // ── recipe_steps ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE recipe_steps (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        recipe_id    UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        step_number  INT NOT NULL,
        description  TEXT NOT NULL,
        duration_min INT,
        step_type    step_type_enum NOT NULL DEFAULT 'hands_on',
        image_url    VARCHAR,
        tips         TEXT
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_recipe_steps_recipe ON recipe_steps (recipe_id, step_number)`);

    // ── recipe_adaptations ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE recipe_adaptations (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        original_recipe_id  UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        adapted_ingredients JSONB NOT NULL DEFAULT '[]',
        adapted_steps       JSONB NOT NULL DEFAULT '[]',
        adaptation_reason   TEXT,
        ai_generated        BOOLEAN NOT NULL DEFAULT FALSE,
        notes               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_recipe_adaptations_recipe ON recipe_adaptations (original_recipe_id)`);
    await queryRunner.query(`CREATE INDEX idx_recipe_adaptations_user   ON recipe_adaptations (user_id)`);

    // ── meal_logs ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE meal_logs (
        id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipe_id          UUID REFERENCES recipes(id) ON DELETE SET NULL,
        adaptation_id      UUID REFERENCES recipe_adaptations(id) ON DELETE SET NULL,
        meal_type          meal_type_enum NOT NULL DEFAULT 'dinner',
        servings_eaten     DECIMAL(4,1) NOT NULL DEFAULT 1,
        photo_url          VARCHAR,
        use_original_photo BOOLEAN NOT NULL DEFAULT FALSE,
        calories_total     INT,
        notes              TEXT,
        logged_at          TIMESTAMPTZ NOT NULL,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_meal_logs_user   ON meal_logs (user_id, logged_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_meal_logs_recipe ON meal_logs (recipe_id)`);

    // ── meal_plans ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE meal_plans (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_start_date  DATE NOT NULL,
        plan_data        JSONB NOT NULL DEFAULT '{}',
        is_ai_generated  BOOLEAN NOT NULL DEFAULT FALSE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, week_start_date)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_meal_plans_user ON meal_plans (user_id, week_start_date DESC)`);

    // ── community_posts ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE community_posts (
        id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipe_id          UUID REFERENCES recipes(id) ON DELETE SET NULL,
        caption            TEXT,
        photo_urls         JSONB NOT NULL DEFAULT '[]',
        likes_count        INT NOT NULL DEFAULT 0,
        comments_count     INT NOT NULL DEFAULT 0,
        is_hidden          BOOLEAN NOT NULL DEFAULT FALSE,
        moderation_status  moderation_status_enum NOT NULL DEFAULT 'pending',
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_community_posts_user       ON community_posts (user_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_community_posts_moderation ON community_posts (moderation_status, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_community_posts_hidden     ON community_posts (is_hidden)`);

    // ── post_comments ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE post_comments (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        post_id           UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content           TEXT NOT NULL,
        parent_comment_id UUID REFERENCES post_comments(id) ON DELETE SET NULL,
        is_hidden         BOOLEAN NOT NULL DEFAULT FALSE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_post_comments_post ON post_comments (post_id, created_at)`);
    await queryRunner.query(`CREATE INDEX idx_post_comments_user ON post_comments (user_id)`);

    // ── post_likes (UUID PK + unique constraint) ──────────────────────────────
    await queryRunner.query(`
      CREATE TABLE post_likes (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (post_id, user_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_post_likes_post ON post_likes (post_id)`);
    await queryRunner.query(`CREATE INDEX idx_post_likes_user ON post_likes (user_id)`);

    // ── parties ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE parties (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        host_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name         VARCHAR NOT NULL,
        description  TEXT,
        event_date   TIMESTAMPTZ,
        invite_code  VARCHAR(8) NOT NULL UNIQUE,
        is_active    BOOLEAN NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_parties_host        ON parties (host_id)`);
    await queryRunner.query(`CREATE INDEX idx_parties_invite_code ON parties (invite_code)`);

    // ── party_members ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE party_members (
        id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        party_id  UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
        user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (party_id, user_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_party_members_party ON party_members (party_id)`);
    await queryRunner.query(`CREATE INDEX idx_party_members_user  ON party_members (user_id)`);

    // ── party_posts ───────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE party_posts (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        party_id   UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
        post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (party_id, post_id)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_party_posts_party ON party_posts (party_id)`);
    await queryRunner.query(`CREATE INDEX idx_party_posts_post  ON party_posts (post_id)`);

    // ── content_reports ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE content_reports (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        reporter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content_type  content_type_enum NOT NULL,
        content_id    UUID NOT NULL,
        reason        TEXT NOT NULL,
        status        report_status_enum NOT NULL DEFAULT 'pending',
        handled_by    UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        resolved_at   TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_content_reports_status  ON content_reports (status, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_content_reports_content ON content_reports (content_type, content_id)`);

    // ── admin_logs ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE admin_logs (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id     UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        action       VARCHAR NOT NULL,
        target_type  VARCHAR,
        target_id    UUID,
        before_data  JSONB,
        after_data   JSONB,
        ip           VARCHAR(45),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_admin_logs_admin  ON admin_logs (admin_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_admin_logs_target ON admin_logs (target_type, target_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS admin_logs CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS content_reports CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS party_posts CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS party_members CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS parties CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS post_likes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS post_comments CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS community_posts CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS meal_plans CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS meal_logs CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS recipe_adaptations CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS recipe_steps CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS recipe_ingredients CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS recipes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS admin_users CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS fridge_items CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS scan_sessions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS ingredients CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_friends CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_profiles CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE`);

    await queryRunner.query(`DROP TYPE IF EXISTS admin_role_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS report_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS content_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS friend_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS moderation_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS meal_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS step_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS recipe_review_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS recipe_meal_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS recipe_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS recipe_difficulty_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS scan_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS storage_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS ingredient_category_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS cooking_skill_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS diet_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS auth_provider_enum`);
  }
}
