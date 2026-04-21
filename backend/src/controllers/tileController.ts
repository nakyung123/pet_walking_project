import { Request, Response, NextFunction } from 'express';
import { getTilesByViewport, getAllOccupiedTiles, clearTileAtPosition } from '../services/tileService';
import { ApiResponse, Tile } from '../types';

export const getTilesInView = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { minLat, maxLat, minLng, maxLng } = req.query;
    console.log('[Tile] 뷰포트 조회:', { minLat, maxLat, minLng, maxLng });

    const tiles = await getTilesByViewport(
      Number(minLat),
      Number(maxLat),
      Number(minLng),
      Number(maxLng)
    );

    console.log('[Tile] 조회된 타일 수:', tiles.length);
    const response: ApiResponse<Tile[]> = { success: true, data: tiles, error: null };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

export const deleteTileAtPosition = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { lat, lng } = req.body;
    const tileId = await clearTileAtPosition(Number(lat), Number(lng));
    const response: ApiResponse<{ tileId: string | null }> = { success: true, data: { tileId }, error: null };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};

export const getOccupied = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tiles = await getAllOccupiedTiles();
    const response: ApiResponse<Tile[]> = { success: true, data: tiles, error: null };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};
