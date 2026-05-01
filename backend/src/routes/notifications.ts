import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markOneRead,
  markChatNotificationsRead,
  markConversationNotificationsRead,
  deleteNotification,
} from '../services/notificationService';
import logger from '../utils/logger';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).uid;
    const notifications = await getNotifications(userId);
    const unreadCount = await getUnreadCount(userId);
    res.json({ success: true, data: { notifications, unreadCount }, error: null });
  } catch (e) {
    logger.error('[notifications] 조회 실패:', e);
    res.status(500).json({ success: false, data: null, error: '알림 조회 실패' });
  }
});

router.patch('/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).uid;
    await markAllRead(userId);
    res.json({ success: true, data: null, error: null });
  } catch (e) {
    logger.error('[notifications] 읽음 처리 실패:', e);
    res.status(500).json({ success: false, data: null, error: '읽음 처리 실패' });
  }
});

router.patch('/read/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).uid;
    await markChatNotificationsRead(userId);
    res.json({ success: true, data: null, error: null });
  } catch (e) {
    logger.error('[notifications] 채팅 알림 읽음 처리 실패:', e);
    res.status(500).json({ success: false, data: null, error: '읽음 처리 실패' });
  }
});

router.patch('/read/chat/:convId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).uid;
    await markConversationNotificationsRead(userId, req.params.convId);
    res.json({ success: true, data: null, error: null });
  } catch (e) {
    logger.error('[notifications] 대화 알림 읽음 처리 실패:', e);
    res.status(500).json({ success: false, data: null, error: '읽음 처리 실패' });
  }
});

router.patch('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).uid;
    await markOneRead(req.params.id, userId);
    res.json({ success: true, data: null, error: null });
  } catch (e) {
    logger.error('[notifications] 개별 읽음 처리 실패:', e);
    res.status(500).json({ success: false, data: null, error: '읽음 처리 실패' });
  }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).uid;
    await deleteNotification(req.params.id, userId);
    res.json({ success: true, data: null, error: null });
  } catch (e) {
    logger.error('[notifications] 알림 삭제 실패:', e);
    res.status(500).json({ success: false, data: null, error: '알림 삭제 실패' });
  }
});

export default router;
