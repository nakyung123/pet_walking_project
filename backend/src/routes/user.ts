import { Router } from 'express';
import { registerUser, getMyScore } from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// POST /api/users — 최초 로그인 시 사용자 등록 (또는 정보 갱신)
router.post('/', authMiddleware, registerUser);

// GET /api/users/me/score — 내 총 점수 조회
router.get('/me/score', authMiddleware, getMyScore);

export default router;
