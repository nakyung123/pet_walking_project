import pool from '../db/pool';
import { MarkingRequestV2, MarkingResult } from '../types';

/** 30초당 1점 */
const STAY_WEIGHT = 1 / 30;
/** 마킹 버튼 보너스 */
const MARKING_BONUS = 10;
/**
 * 마킹 처리 서비스
 *
 * 동작 순서:
 * 1. PostGIS로 위경도 → 타일ID + 중심 좌표 계산
 * 2. tile_visits에 방문 기록 upsert (체류시간 기록)
 * 3. 체류시간 기반 점수 계산 후 tiles 테이블 업데이트
 * 4. 점수 경쟁 방식으로 점유자 결정
 */
export const markingService = async (req: MarkingRequestV2): Promise<MarkingResult> => {

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. PostGIS: 위경도 → 타일ID + 타일 중심 좌표 계산
    const tileRes = await client.query<{
      tile_id: string;
      center_lat: number;
      center_lng: number;
    }>(
      `WITH mercator AS (
        SELECT ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857) AS pt
      ),
      grid AS (
        SELECT
          floor(ST_X(pt) / 50) AS gx,
          floor(ST_Y(pt) / 50) AS gy
        FROM mercator
      )
      SELECT
        gx::text || '_' || gy::text AS tile_id,
        ST_Y(ST_Transform(
          ST_SetSRID(ST_MakePoint((gx + 0.5) * 50, (gy + 0.5) * 50), 3857),
          4326
        )) AS center_lat,
        ST_X(ST_Transform(
          ST_SetSRID(ST_MakePoint((gx + 0.5) * 50, (gy + 0.5) * 50), 3857),
          4326
        )) AS center_lng
      FROM grid`,
      [req.lng, req.lat]
    );
    const { tile_id: tileId, center_lat: centerLat, center_lng: centerLng } = tileRes.rows[0];
    console.log('[markingService] tileId:', tileId, '| 중심:', { centerLat, centerLng });

    // 2. 타일 upsert (tiles 테이블에 없으면 생성)
    await client.query(
      `INSERT INTO tiles (tile_id, center_lat, center_lng, occupancy_score)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (tile_id) DO NOTHING`,
      [tileId, centerLat, centerLng]
    );

    // 3. tile_visits에 방문 기록 저장
    const visitRes = await client.query<{ stay_seconds: number }>(
      `INSERT INTO tile_visits (session_id, user_id, tile_id, entered_at, exited_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING EXTRACT(EPOCH FROM (exited_at - entered_at))::INTEGER AS stay_seconds`,
      [req.sessionId, req.userId, tileId, req.enteredAt, req.timestamp]
    );
    const staySeconds = visitRes.rows[0]?.stay_seconds ?? 0;
    console.log('[markingService] 체류시간(초):', staySeconds);

    // 4. 점수 계산: (체류시간 / 30) + 마킹 보너스
    const addScore = Math.floor(staySeconds * STAY_WEIGHT) + MARKING_BONUS;
    console.log('[markingService] 추가 점수:', addScore);

    // 5. 타일 점수 업데이트 + 점유자 결정
    const updateRes = await client.query<{
      occupancy_score: number;
      occupant_user_id: string | null;
    }>(
      `UPDATE tiles
       SET
         occupancy_score = occupancy_score + $1,
         occupant_user_id = CASE
           WHEN occupant_user_id IS NULL THEN $2
           WHEN occupant_user_id = $2    THEN $2
           WHEN (occupancy_score + $1) >
                (SELECT MAX(v.occupancy_score)
                 FROM tiles v WHERE v.tile_id = $3)
                THEN $2
           ELSE occupant_user_id
         END,
         last_marked_at = NOW(),
         updated_at = NOW()
       WHERE tile_id = $3
       RETURNING occupancy_score, occupant_user_id`,
      [addScore, req.userId, tileId]
    );

    await client.query('COMMIT');

    const { occupancy_score, occupant_user_id } = updateRes.rows[0];
    console.log('[markingService] 최종 점수:', occupancy_score, '| 점유자:', occupant_user_id);

    return {
      tileId,
      newScore: occupancy_score,
      isOccupied: occupant_user_id === req.userId,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
