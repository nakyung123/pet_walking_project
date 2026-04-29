import { Router, Request, Response } from 'express';
import { getLeaderboard, getNearbyLeaderboard } from '../services/userService';
import { authMiddleware } from '../middlewares/authMiddleware';
import logger from '../utils/logger';

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const entries = await getLeaderboard();
    res.json({ success: true, data: entries, error: null });
  } catch (e) {
    logger.error('[leaderboard] 조회 실패:', e);
    res.status(500).json({ success: false, data: null, error: '리더보드 조회 실패' });
  }
});

router.get('/nearby', authMiddleware, async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat((req.query.radius as string) ?? '3');
    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ success: false, data: null, error: 'lat, lng 파라미터가 필요합니다' });
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ success: false, data: null, error: '유효하지 않은 좌표입니다' });
      return;
    }
    if (isNaN(radius) || radius <= 0 || radius > 50) {
      res.status(400).json({ success: false, data: null, error: 'radius는 0~50km 범위여야 합니다' });
      return;
    }
    const entries = await getNearbyLeaderboard(lat, lng, radius);
    res.json({ success: true, data: entries, error: null });
  } catch (e) {
    logger.error('[leaderboard/nearby] 조회 실패:', e);
    res.status(500).json({ success: false, data: null, error: '주변 랭킹 조회 실패' });
  }
});

export default router;
