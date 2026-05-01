import pool from '../db/pool';
import logger from '../utils/logger';
import admin from '../firebase';
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
    COUNT(t.tile_id)::INTEGER                                          AS tile_count,
    (COALESCE(SUM(t.occupancy_score), 0) + u.bonus_score)::INTEGER    AS total_score
  FROM users u
  LEFT JOIN tiles t ON t.occupant_user_id = u.user_id
  WHERE u.is_deleted = FALSE
  GROUP BY u.user_id, u.display_name, u.bonus_score
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
      COUNT(t.tile_id)::INTEGER                                         AS tile_count,
      (COALESCE(SUM(t.occupancy_score), 0) + u.bonus_score)::INTEGER   AS total_score
    FROM users u
    JOIN tiles t ON t.occupant_user_id = u.user_id
    WHERE t.center_lat BETWEEN $1 AND $2
      AND t.center_lng BETWEEN $3 AND $4
    GROUP BY u.user_id, u.display_name, u.bonus_score
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

let leaderboardCache: { data: LeaderboardData; ts: number } | null = null;
const LEADERBOARD_TTL = 30_000;

/** 타일 수 / 점수 각각 상위 10명 조회 (30초 캐시) */
export const getLeaderboard = async (): Promise<LeaderboardData> => {
  if (leaderboardCache && Date.now() - leaderboardCache.ts < LEADERBOARD_TTL) {
    return leaderboardCache.data;
  }

  const [byTileRes, byScoreRes] = await Promise.all([
    pool.query<{ user_id: string; display_name: string; tile_count: number; total_score: number }>(
      `${LEADERBOARD_QUERY} ORDER BY tile_count DESC, total_score DESC LIMIT 10`
    ),
    pool.query<{ user_id: string; display_name: string; tile_count: number; total_score: number }>(
      `${LEADERBOARD_QUERY} ORDER BY total_score DESC, tile_count DESC LIMIT 10`
    ),
  ]);

  const data = {
    byTile:  byTileRes.rows.map(toEntry),
    byScore: byScoreRes.rows.map(toEntry),
  };
  leaderboardCache = { data, ts: Date.now() };
  return data;
};

export const hardDeleteUser = async (userId: string): Promise<void> => {
  // 1. 점유 타일 초기화 (ON DELETE SET NULL만으로는 score가 남으므로 명시적으로 처리)
  await pool.query(
    `UPDATE tiles SET occupant_user_id = NULL, occupancy_score = 0, last_marked_at = NULL
     WHERE occupant_user_id = $1`,
    [userId],
  );

  // 2. DB에서 유저 하드 삭제 (CASCADE로 posts, comments, tile_visits, 채팅 등 연쇄 삭제)
  await pool.query(`DELETE FROM users WHERE user_id = $1`, [userId]);

  // 3. Firebase Auth 계정 삭제
  try {
    await admin.auth().deleteUser(userId);
  } catch (err) {
    // Firebase 계정이 이미 없는 경우(auth/user-not-found) 무시
    logger.warn('[hardDeleteUser] Firebase Auth 삭제 실패 (무시): %s', (err as Error).message);
  }
};
