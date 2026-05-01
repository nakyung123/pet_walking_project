import { Router } from 'express';
import { registerUser, getMyScore, getProfile, updateMyProfile, withdrawUser } from '../controllers/userController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// POST /api/users — 최초 로그인 시 사용자 등록 (또는 정보 갱신)
router.post('/', authMiddleware, registerUser);

// GET /api/users/me/score — 내 총 점수 조회
router.get('/me/score', authMiddleware, getMyScore);

// PUT /api/users/me/profile — 내 반려견 프로필 저장
router.put('/me/profile', authMiddleware, updateMyProfile);

// DELETE /api/users/me — 회원 탈퇴 (소프트 삭제)
router.delete('/me', authMiddleware, withdrawUser);

// GET /api/users/:userId/profile — 특정 유저 프로필 조회
router.get('/:userId/profile', authMiddleware, getProfile);

export default router;
