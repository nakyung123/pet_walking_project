import { Router } from 'express';
import { getTilesInView } from '../controllers/tileController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// GET /api/tiles?minLat=&maxLat=&minLng=&maxLng= — 뷰포트 내 타일 조회
router.get('/', authMiddleware, getTilesInView);

export default router;
