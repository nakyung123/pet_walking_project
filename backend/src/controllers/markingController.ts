import { Request, Response, NextFunction } from 'express';
import { markingService } from '../services/markingService';
import { MarkingRequestV2, ApiResponse, MarkingResult } from '../types';

const MAX_SPEED_KMH = 15;

export const postMarking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = req.body as MarkingRequestV2;
    console.log('[Marking] 요청:', body);

    // 15km/h 초과 시 점유 포인트 기록 거부 (절대 규칙 3)
    if (body.speed >= MAX_SPEED_KMH) {
      const response: ApiResponse<MarkingResult> = {
        success: false,
        data: null,
        error: `이동 속도(${body.speed}km/h)가 ${MAX_SPEED_KMH}km/h를 초과하여 마킹이 거부되었습니다.`,
      };
      res.status(400).json(response);
      return;
    }

    const result = await markingService(body);
    console.log('[Marking] 결과:', result);

    const response: ApiResponse<MarkingResult> = {
      success: true,
      data: result,
      error: null,
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};
