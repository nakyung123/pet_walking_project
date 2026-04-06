import pool from '../db/pool';
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
  }>(
    `SELECT tile_id, center_lat, center_lng, occupant_user_id, occupancy_score
     FROM tiles
     WHERE ST_Within(
       ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326),
       ST_MakeEnvelope($1, $2, $3, $4, 4326)
     )`,
    [minLng, minLat, maxLng, maxLat]
  );

  console.log('[tileService] 조회 범위:', { minLat, maxLat, minLng, maxLng });
  return result.rows.map((row) => ({
    tileId: row.tile_id,
    lat: row.center_lat,
    lng: row.center_lng,
    occupantUserId: row.occupant_user_id,
    occupancyScore: row.occupancy_score,
  }));
};
