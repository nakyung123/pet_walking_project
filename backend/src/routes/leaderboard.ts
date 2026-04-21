import { Router, Request, Response } from 'express';
import { getLeaderboard } from '../services/userService';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const entries = await getLeaderboard();
    res.json({ success: true, data: entries, error: null });
  } catch (e) {
    console.error('[leaderboard] 조회 실패:', e);
    res.status(500).json({ success: false, data: null, error: '리더보드 조회 실패' });
  }
});

export default router;
