import { Request, Response, NextFunction } from 'express';
import { upsertUser } from '../services/userService';
import { ApiResponse, User } from '../types';
import pool from '../db/pool';

interface RegisterUserBody {
  displayName: string;
  dogName: string;
}

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const uid = (req as Request & { uid: string }).uid;
    const { displayName, dogName } = req.body as RegisterUserBody;

    if (!displayName || !dogName) {
      const body: ApiResponse<null> = {
        success: false,
        data: null,
        error: 'displayName과 dogName은 필수 항목입니다.',
      };
      res.status(400).json(body);
      return;
    }

    console.log('[UserController] 사용자 등록 요청 — uid:', uid);
    const user = await upsertUser(uid, displayName, dogName);

    const body: ApiResponse<User> = { success: true, data: user, error: null };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
};

export const getMyScore = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const uid = (req as Request & { uid: string }).uid;
    const result = await pool.query<{ total_score: string; tile_count: string }>(
      `SELECT
         COALESCE(SUM(occupancy_score), 0) AS total_score,
         COUNT(*) AS tile_count
       FROM tiles
       WHERE occupant_user_id = $1`,
      [uid]
    );
    const { total_score, tile_count } = result.rows[0];
    res.json({
      success: true,
      data: {
        totalScore: parseInt(total_score),
        tileCount: parseInt(tile_count),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
};
