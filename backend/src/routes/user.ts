import { Router } from 'express';
import { registerUser } from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// POST /api/users — 최초 로그인 시 사용자 등록 (또는 정보 갱신)
router.post('/', authMiddleware, registerUser);

export default router;
