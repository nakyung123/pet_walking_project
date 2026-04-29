import { Request, Response, NextFunction } from 'express';
import { upsertUser } from '../services/userService';
import { ApiResponse, User, UserProfile } from '../types';
import logger from '../utils/logger';
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

    logger.debug('[UserController] 사용자 등록 요청 — uid: %s', uid);
    const user = await upsertUser(uid, displayName, dogName);

    const body: ApiResponse<User> = { success: true, data: user, error: null };
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const result = await pool.query<{
      user_id: string; display_name: string; dog_name: string;
      dog_breed: string | null; dog_age: string | null;
      dog_personality: string | null; photo_url: string | null;
      total_score: string; tile_count: string;
    }>(
      `SELECT u.user_id, u.display_name, u.dog_name,
              u.dog_breed, u.dog_age, u.dog_personality, u.photo_url,
              COALESCE(SUM(t.occupancy_score), 0) AS total_score,
              COUNT(t.tile_id) AS tile_count
       FROM users u
       LEFT JOIN tiles t ON t.occupant_user_id = u.user_id
       WHERE u.user_id = $1
       GROUP BY u.user_id`,
      [userId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, data: null, error: '사용자를 찾을 수 없습니다.' });
      return;
    }
    const r = result.rows[0];
    const body: ApiResponse<UserProfile> = {
      success: true,
      data: {
        userId: r.user_id,
        displayName: r.display_name,
        dogName: r.dog_name,
        dogBreed: r.dog_breed,
        dogAge: r.dog_age,
        dogPersonality: r.dog_personality,
        photoUrl: r.photo_url,
        totalScore: parseInt(r.total_score),
        tileCount: parseInt(r.tile_count),
      },
      error: null,
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
};

export const updateMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const uid = (req as Request & { uid: string }).uid;
    const { dogBreed, dogAge, dogPersonality, photoUrl } = req.body as {
      dogBreed?: string; dogAge?: string; dogPersonality?: string; photoUrl?: string;
    };
    await pool.query(
      `UPDATE users
       SET dog_breed=$1, dog_age=$2, dog_personality=$3, photo_url=$4
       WHERE user_id=$5`,
      [dogBreed ?? null, dogAge ?? null, dogPersonality ?? null, photoUrl ?? null, uid],
    );
    res.json({ success: true, data: null, error: null });
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
