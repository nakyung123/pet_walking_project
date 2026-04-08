import { Router } from 'express';
import pool from '../db/pool';

const router = Router();

// POST /api/sessions — 산책 세션 시작, session_id 반환
router.post('/', async (req, res, next) => {
  const { userId } = req.body;
  if (!userId) {
    res.json({ success: false, data: null, error: 'userId 필요' });
    return;
  }
  try {
    const result = await pool.query<{ session_id: string }>(
      `INSERT INTO walking_sessions (user_id) VALUES ($1) RETURNING session_id`,
      [userId]
    );
    res.json({ success: true, data: { sessionId: result.rows[0].session_id }, error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
