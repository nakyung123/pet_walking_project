import { Router } from 'express';
import { postMarking } from '../controllers/markingController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { markingLimiter } from '../middlewares/rateLimiter';
import { validate } from '../middlewares/validate';
import { markingSchema } from '../schemas';

const router = Router();

// POST /api/marking — 마킹 액션 처리
router.post('/', authMiddleware, markingLimiter, validate(markingSchema), postMarking);

export default router;
