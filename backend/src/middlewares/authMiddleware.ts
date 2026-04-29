import { Request, Response, NextFunction } from 'express';
import admin from '../firebase';
import { ApiResponse } from '../types';

export type AuthRequest = Request & { uid: string; displayName: string };

const DEV_MODE = process.env.NODE_ENV === 'development' && !process.env.FIREBASE_PROJECT_ID;
const DEV_UID = 'dev-user-001';

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Firebase 키 미설정 시 개발 모드 — 인증 우회
  if (DEV_MODE) {
    (req as AuthRequest).uid = DEV_UID;
    (req as AuthRequest).displayName = 'Dev User';
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const body: ApiResponse<null> = { success: false, data: null, error: '인증 토큰이 없습니다.' };
    res.status(401).json(body);
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as AuthRequest).uid = decoded.uid;
    (req as AuthRequest).displayName = decoded.name ?? decoded.uid;
    next();
  } catch (err) {
    const body: ApiResponse<null> = { success: false, data: null, error: '유효하지 않은 토큰입니다.' };
    res.status(401).json(body);
  }
};
