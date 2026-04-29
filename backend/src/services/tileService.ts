import pool from '../db/pool';
import logger from '../utils/logger';
import { Tile } from '../types';
import { getTileInfo } from '../utils/tileCalc';

/**
 * 뷰포트 범위 내 타일 목록 조회
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
     WHERE center_lat BETWEEN $1 AND $2
       AND center_lng BETWEEN $3 AND $4`,
    [minLat, maxLat, minLng, maxLng]
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

/** 현재 위치의 타일 점유 초기화 */
export const clearTileAtPosition = async (lat: number, lng: number): Promise<string | null> => {
  const { tileId } = getTileInfo(lng, lat);
  const res = await pool.query<{ tile_id: string }>(
    `UPDATE tiles
     SET occupant_user_id = NULL, occupancy_score = 0, last_marked_at = NULL, updated_at = NOW()
     WHERE tile_id = $1
     RETURNING tile_id`,
    [tileId]
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
