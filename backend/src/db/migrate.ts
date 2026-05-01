import pool from './pool';
import logger from '../utils/logger';

export async function runMigrations(): Promise<void> {
  logger.info('[Migration] 마이그레이션 시작');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id      TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      dog_name     TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dog_breed       TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dog_age         TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dog_personality TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url       TEXT`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tiles (
      tile_id          TEXT PRIMARY KEY,
      center_lat       DOUBLE PRECISION NOT NULL,
      center_lng       DOUBLE PRECISION NOT NULL,
      occupant_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
      occupancy_score  INTEGER DEFAULT 0 CHECK (occupancy_score >= 0),
      last_marked_at   TIMESTAMPTZ,
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tiles_lat ON tiles (center_lat)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tiles_lng ON tiles (center_lng)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_tiles_occupant ON tiles (occupant_user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS walking_sessions (
      session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at   TIMESTAMPTZ,
      distance_km NUMERIC(8,3),
      CONSTRAINT chk_session_time CHECK (ended_at IS NULL OR ended_at > started_at)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON walking_sessions (user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tile_visits (
      visit_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES walking_sessions(session_id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      tile_id    TEXT NOT NULL REFERENCES tiles(tile_id) ON DELETE CASCADE,
      entered_at TIMESTAMPTZ DEFAULT NOW(),
      exited_at  TIMESTAMPTZ,
      CONSTRAINT chk_visit_time CHECK (exited_at IS NULL OR exited_at > entered_at)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_visits_tile    ON tile_visits (tile_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_visits_session ON tile_visits (session_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      category      TEXT NOT NULL CHECK (category IN ('walk_log', 'brag', 'other')),
      title         TEXT NOT NULL,
      content       TEXT NOT NULL,
      like_count    INT DEFAULT 0,
      comment_count INT DEFAULT 0,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_user     ON posts (user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_category ON posts (category)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_created  ON posts (created_at DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_images (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      url         TEXT NOT NULL,
      order_index INT NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_post_images_post ON post_images (post_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      content    TEXT NOT NULL,
      depth      INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_post   ON comments (post_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
      comment_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
      reason      TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT chk_report_target CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR
        (post_id IS NULL AND comment_id IS NOT NULL)
      )
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      message    TEXT NOT NULL,
      is_read    BOOLEAN DEFAULT false,
      metadata   JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user
      ON notifications (user_id, is_read, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_conv
      ON notifications (user_id, (metadata->>'conversationId'))
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id         TEXT PRIMARY KEY,
      user_id_1  TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      user_id_2  TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations (user_id_1)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations (user_id_2)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id              BIGSERIAL PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id       TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      text            TEXT NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, created_at)`);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_score INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await pool.query(`ALTER TABLE messages ALTER COLUMN text DROP NOT NULL`);
  // 소프트 딜리트: 각 유저가 독립적으로 대화를 숨길 수 있도록
  await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_for_user1 BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_for_user2 BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_for_user1_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_for_user2_at TIMESTAMPTZ`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_daily_missions (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      mission_date DATE NOT NULL,
      mission_type TEXT NOT NULL,
      bonus_points INTEGER NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, mission_date, mission_type)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_daily_missions_user ON user_daily_missions (user_id, mission_date)`);

  logger.info('[Migration] 마이그레이션 완료');
}
