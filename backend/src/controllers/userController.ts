import { Request, Response, NextFunction } from 'express';
import { upsertUser } from '../services/userService';
import { ApiResponse, User } from '../types';

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
