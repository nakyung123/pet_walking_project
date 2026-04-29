-- walking_sessions 테이블에 산책 거리 컬럼 추가
ALTER TABLE walking_sessions ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION DEFAULT 0 CHECK (distance_km >= 0);
