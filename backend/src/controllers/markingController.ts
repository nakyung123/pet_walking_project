import { Request, Response, NextFunction } from 'express';
import { markingService } from '../services/markingService';
import { MarkingRequestV2, ApiResponse, MarkingResult } from '../types';
import { toAreaKey } from '../utils/areaKey';
import { emitTileUpdated } from '../socket';
import { createNotification } from '../services/notificationService';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/authMiddleware';

const MAX_SPEED_KMH = 15;

export const postMarking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // userId는 반드시 인증 토큰에서 추출 (클라이언트 body 값 무시)
    const body: MarkingRequestV2 = { ...req.body, userId: (req as AuthRequest).uid };
    logger.debug('[Marking] 요청:', body);

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
    logger.debug('[Marking] 결과:', result);

    // 마킹 성공 → 같은 구역 클라이언트에게 실시간 타일 변경 알림
    const areaKey = toAreaKey(body.lat, body.lng);
    emitTileUpdated(areaKey, {
      tileId: result.tileId,
      occupantUserId: result.isOccupied ? body.userId : null,
    });

    // 타일 빼앗김 알림: 이전 점유자가 있고 다른 사람이 점유했을 때
    if (
      result.prevOccupantUserId &&
      result.prevOccupantUserId !== body.userId &&
      result.isOccupied
    ) {
      createNotification(
        result.prevOccupantUserId,
        'tile_stolen',
        '내 타일을 빼앗겼어요!',
        `누군가 내 영역을 점령했어요. 산책을 나가 되찾아보세요!`,
        { tileId: result.tileId },
      ).catch((err) => logger.error('[markingController] 알림 생성 실패:', err));
    }

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
