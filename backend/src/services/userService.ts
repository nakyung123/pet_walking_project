import pool from '../db/pool';
import logger from '../utils/logger';
import { User, LeaderboardEntry, LeaderboardData } from '../types';

/**
 * 사용자 등록 또는 조회 (upsert)
 * 최초 로그인 시 users 테이블에 삽입, 이미 존재하면 그대로 반환
 */
export const upsertUser = async (
  userId: string,
  displayName: string,
  dogName: string
): Promise<User> => {
  const result = await pool.query<{
    user_id: string;
    display_name: string;
    dog_name: string;
    created_at: string;
  }>(
    `INSERT INTO users (user_id, display_name, dog_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           dog_name = EXCLUDED.dog_name
     RETURNING user_id, display_name, dog_name, created_at`,
    [userId, displayName, dogName]
  );

  const row = result.rows[0];
  logger.debug('[userService] upsert 완료: %s', row.user_id);

  return {
    userId: row.user_id,
    displayName: row.display_name,
    dogName: row.dog_name,
    createdAt: row.created_at,
  };
};

const LEADERBOARD_QUERY = `
  SELECT
    u.user_id,
    u.display_name,
    COUNT(t.tile_id)::INTEGER                    AS tile_count,
    COALESCE(SUM(t.occupancy_score), 0)::INTEGER AS total_score
  FROM users u
  LEFT JOIN tiles t ON t.occupant_user_id = u.user_id
  GROUP BY u.user_id, u.display_name
`;

const toEntry = (row: { user_id: string; display_name: string; tile_count: number; total_score: number }, i: number): LeaderboardEntry => ({
  rank: i + 1,
  userId: row.user_id,
  displayName: row.display_name,
  tileCount: row.tile_count,
  totalScore: row.total_score,
});

/** 반경 내 활동 유저 기준 타일 수 / 점수 상위 10명 조회 (반경: km, 바운딩박스 근사) */
export const getNearbyLeaderboard = async (lat: number, lng: number, radiusKm: number): Promise<LeaderboardData> => {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const NEARBY_QUERY = `
    SELECT
      u.user_id,
      u.display_name,
      COUNT(t.tile_id)::INTEGER                    AS tile_count,
      COALESCE(SUM(t.occupancy_score), 0)::INTEGER AS total_score
    FROM users u
    JOIN tiles t ON t.occupant_user_id = u.user_id
    WHERE t.center_lat BETWEEN $1 AND $2
      AND t.center_lng BETWEEN $3 AND $4
    GROUP BY u.user_id, u.display_name
  `;
  const [byTileRes, byScoreRes] = await Promise.all([
    pool.query<{ user_id: string; display_name: string; tile_count: number; total_score: number }>(
      `${NEARBY_QUERY} ORDER BY tile_count DESC, total_score DESC LIMIT 10`,
      [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta]
    ),
    pool.query<{ user_id: string; display_name: string; tile_count: number; total_score: number }>(
      `${NEARBY_QUERY} ORDER BY total_score DESC, tile_count DESC LIMIT 10`,
      [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta]
    ),
  ]);
  return {
    byTile:  byTileRes.rows.map(toEntry),
    byScore: byScoreRes.rows.map(toEntry),
  };
};

/** 타일 수 / 점수 각각 상위 10명 조회 */
export const getLeaderboard = async (): Promise<LeaderboardData> => {
  const [byTileRes, byScoreRes] = await Promise.all([
    pool.query<{ user_id: string; display_name: string; tile_count: number; total_score: number }>(
      `${LEADERBOARD_QUERY} ORDER BY tile_count DESC, total_score DESC LIMIT 10`
    ),
    pool.query<{ user_id: string; display_name: string; tile_count: number; total_score: number }>(
      `${LEADERBOARD_QUERY} ORDER BY total_score DESC, tile_count DESC LIMIT 10`
    ),
  ]);

  return {
    byTile:  byTileRes.rows.map(toEntry),
    byScore: byScoreRes.rows.map(toEntry),
  };
};
