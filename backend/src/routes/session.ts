import { Router } from 'express';
import pool from '../db/pool';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';
import { validate } from '../middlewares/validate';
import { sessionEndSchema } from '../schemas';

const router = Router();

// POST /api/sessions — 산책 세션 시작 (uid는 토큰에서 추출)
router.post('/', authMiddleware, async (req, res, next) => {
  const userId = (req as AuthRequest).uid;
  const displayName = (req as AuthRequest).displayName;
  try {
    await pool.query(
      `INSERT INTO users (user_id, display_name, dog_name)
       VALUES ($1, $2, '')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, displayName],
    );
    const result = await pool.query<{ session_id: string }>(
      `INSERT INTO walking_sessions (user_id) VALUES ($1) RETURNING session_id`,
      [userId],
    );
    res.json({ success: true, data: { sessionId: result.rows[0].session_id }, error: null });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/sessions/:sessionId — 산책 세션 종료 + 거리 저장
router.patch('/:sessionId', authMiddleware, validate(sessionEndSchema), async (req, res, next) => {
  const userId = (req as AuthRequest).uid;
  const { sessionId } = req.params;
  const { distanceKm } = req.body as { distanceKm: number };
  try {
    const result = await pool.query<{ session_id: string; distance_km: number }>(
      `UPDATE walking_sessions
       SET ended_at = NOW(), distance_km = $1
       WHERE session_id = $2 AND user_id = $3 AND ended_at IS NULL
       RETURNING session_id, distance_km`,
      [distanceKm, sessionId, userId]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, data: null, error: '세션을 찾을 수 없거나 이미 종료되었습니다.' });
      return;
    }
    res.json({ success: true, data: { sessionId, distanceKm: result.rows[0].distance_km }, error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
