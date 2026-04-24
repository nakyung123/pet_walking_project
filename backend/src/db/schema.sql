-- ============================================================
-- Pet Territory DB 스키마
-- 실행: psql -U $DB_USER -d $DB_NAME -f schema.sql
-- ============================================================

-- PostGIS 확장 활성화
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 1. 사용자 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  user_id      TEXT PRIMARY KEY,           -- Firebase UID
  display_name TEXT NOT NULL,
  dog_name     TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. 타일 테이블 (핵심)
-- tile_id: "x_y" 형태 (Web Mercator EPSG:3857 기준 10m 격자)
-- ============================================================
CREATE TABLE IF NOT EXISTS tiles (
  tile_id           TEXT PRIMARY KEY,
  center_lat        DOUBLE PRECISION NOT NULL,  -- 타일 중심 위도 (WGS84)
  center_lng        DOUBLE PRECISION NOT NULL,  -- 타일 중심 경도 (WGS84)
  occupant_user_id  TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  occupancy_score   INTEGER DEFAULT 0 CHECK (occupancy_score >= 0),
  last_marked_at    TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 뷰포트 조회 성능을 위한 PostGIS 공간 인덱스
CREATE INDEX IF NOT EXISTS idx_tiles_location
  ON tiles USING GIST (
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)
  );

-- occupant_user_id 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_tiles_occupant
  ON tiles (occupant_user_id);

-- ============================================================
-- 3. 산책 세션 테이블 (체류시간 추적)
-- ============================================================
CREATE TABLE IF NOT EXISTS walking_sessions (
  session_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  CONSTRAINT chk_session_time CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user
  ON walking_sessions (user_id);

-- ============================================================
-- 4. 타일 방문 기록 테이블 (StayTime 계산)
-- ============================================================
CREATE TABLE IF NOT EXISTS tile_visits (
  visit_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES walking_sessions(session_id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  tile_id     TEXT NOT NULL REFERENCES tiles(tile_id) ON DELETE CASCADE,
  entered_at  TIMESTAMPTZ DEFAULT NOW(),
  exited_at   TIMESTAMPTZ,
  CONSTRAINT chk_visit_time CHECK (exited_at IS NULL OR exited_at > entered_at)
);

CREATE INDEX IF NOT EXISTS idx_visits_tile
  ON tile_visits (tile_id);

CREATE INDEX IF NOT EXISTS idx_visits_session
  ON tile_visits (session_id);

-- ============================================================
-- 5. 반려견 프로필 컬럼 추가 (기존 users 테이블 확장)
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS dog_breed      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dog_age        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dog_personality TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url      TEXT;

-- ============================================================
-- 6. 커뮤니티: 게시글
-- ============================================================
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
);

CREATE INDEX IF NOT EXISTS idx_posts_user     ON posts (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts (category);
CREATE INDEX IF NOT EXISTS idx_posts_created  ON posts (created_at DESC);

-- ============================================================
-- 7. 커뮤니티: 게시글 이미지 (최대 3장)
-- ============================================================
CREATE TABLE IF NOT EXISTS post_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_images_post ON post_images (post_id);

-- ============================================================
-- 8. 커뮤니티: 댓글 (무한 중첩, parent_id=NULL 이면 최상위)
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  depth      INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post   ON comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);

-- ============================================================
-- 9. 커뮤니티: 좋아요 (post_id + user_id 복합 PK)
-- ============================================================
CREATE TABLE IF NOT EXISTS post_likes (
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- ============================================================
-- 10. 커뮤니티: 신고 (게시글 또는 댓글 대상)
-- ============================================================
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
);
