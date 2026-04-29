import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(`[ErrorHandler] ${err.message} | stack: ${err.stack}`);
  const isProd = process.env.NODE_ENV === 'production';
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error: isProd ? '서버 내부 오류' : (err.message || '서버 내부 오류'),
  };
  res.status(500).json(body);
};
