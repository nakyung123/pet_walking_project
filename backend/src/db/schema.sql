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
