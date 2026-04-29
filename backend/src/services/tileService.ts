import pool from '../db/pool';
import logger from '../utils/logger';
import { Tile } from '../types';

/**
 * 뷰포트 범위 내 타일 목록 조회
 * PostGIS ST_MakeEnvelope 사용
 */
export const getTilesByViewport = async (
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number
): Promise<Tile[]> => {
  const result = await pool.query<{
    tile_id: string;
    center_lat: number;
    center_lng: number;
    occupant_user_id: string | null;
    occupancy_score: number;
    last_marked_at: string | null;
  }>(
    `SELECT tile_id, center_lat, center_lng, occupant_user_id, occupancy_score, last_marked_at
     FROM tiles
     WHERE ST_Within(
       ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326),
       ST_MakeEnvelope($1, $2, $3, $4, 4326)
     )`,
    [minLng, minLat, maxLng, maxLat]
  );

  logger.debug('[tileService] 조회 범위: %o', { minLat, maxLat, minLng, maxLng });
  return result.rows.map((row) => ({
    tileId: row.tile_id,
    lat: row.center_lat,
    lng: row.center_lng,
    occupantUserId: row.occupant_user_id,
    occupancyScore: row.occupancy_score,
    lastMarkedAt: row.last_marked_at ?? null,
  }));
};

/** 현재 위치의 타일 점유 초기화 (tileId는 PostGIS로 계산) */
export const clearTileAtPosition = async (lat: number, lng: number): Promise<string | null> => {
  const res = await pool.query<{ tile_id: string }>(
    `WITH mercator AS (
      SELECT ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857) AS pt
    ),
    grid AS (
      SELECT floor(ST_X(pt) / 50) AS gx, floor(ST_Y(pt) / 50) AS gy FROM mercator
    )
    UPDATE tiles
    SET occupant_user_id = NULL, occupancy_score = 0, last_marked_at = NULL, updated_at = NOW()
    WHERE tile_id = (SELECT gx::text || '_' || gy::text FROM grid)
    RETURNING tile_id`,
    [lng, lat]
  );
  return res.rows[0]?.tile_id ?? null;
};

/** 점령된 타일 전체 조회 (지도 초기 로드용) */
export const getAllOccupiedTiles = async (): Promise<import('../types').Tile[]> => {
  const result = await pool.query<{
    tile_id: string;
    center_lat: number;
    center_lng: number;
    occupant_user_id: string;
    occupancy_score: number;
    last_marked_at: string | null;
  }>(
    `SELECT tile_id, center_lat, center_lng, occupant_user_id, occupancy_score, last_marked_at
     FROM tiles
     WHERE occupant_user_id IS NOT NULL`
  );

  return result.rows.map((row) => ({
    tileId: row.tile_id,
    lat: row.center_lat,
    lng: row.center_lng,
    occupantUserId: row.occupant_user_id,
    occupancyScore: row.occupancy_score,
    lastMarkedAt: row.last_marked_at ?? null,
  }));
};
