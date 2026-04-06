import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('[ErrorHandler]', err.message);
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error: err.message || '서버 내부 오류',
  };
  res.status(500).json(body);
};
