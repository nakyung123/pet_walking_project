import { Router } from 'express';
import { postMarking } from '../controllers/markingController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// POST /api/marking — 마킹 액션 처리
router.post('/', authMiddleware, postMarking);

export default router;
