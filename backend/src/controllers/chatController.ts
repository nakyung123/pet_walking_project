import { Request, Response, NextFunction } from 'express';
import {
  getOrCreateConversation,
  getConversations,
  getMessages,
  saveMessage,
  getConversationParticipants,
  deleteConversation,
} from '../services/chatService';
import { emitNewMessage } from '../socket';
import { createNotification } from '../services/notificationService';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/authMiddleware';
import pool from '../db/pool';

export const startConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const myId = (req as AuthRequest).uid;
    const displayName = (req as AuthRequest).displayName;
    const otherId = req.params.userId;
    if (myId === otherId) {
      res.status(400).json({ success: false, data: null, error: '자기 자신과 대화할 수 없습니다.' });
      return;
    }
    // FK 오류 방지: 대화 참여자 양쪽 모두 users 테이블에 존재 보장
    await pool.query(
      `INSERT INTO users (user_id, display_name, dog_name) VALUES ($1, $2, '')
       ON CONFLICT (user_id) DO NOTHING`,
      [myId, displayName],
    );
    const conversationId = await getOrCreateConversation(myId, otherId);
    res.json({ success: true, data: { conversationId }, error: null });
  } catch (err) {
    next(err);
  }
};

export const listConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const myId = (req as AuthRequest).uid;
    const conversations = await getConversations(myId);
    res.json({ success: true, data: conversations, error: null });
  } catch (err) {
    next(err);
  }
};

export const listMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const myId = (req as AuthRequest).uid;
    const { convId } = req.params;

    const participants = await getConversationParticipants(convId);
    if (!participants) {
      res.status(404).json({ success: false, data: null, error: '대화방을 찾을 수 없습니다.' });
      return;
    }
    if (!participants.includes(myId)) {
      res.status(403).json({ success: false, data: null, error: '접근 권한이 없습니다.' });
      return;
    }

    const messages = await getMessages(convId);
    res.json({ success: true, data: messages, error: null });
  } catch (err) {
    next(err);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const myId = (req as AuthRequest).uid;
    const { convId } = req.params;
    const { text, imageUrl } = req.body as { text?: string; imageUrl?: string };

    if (!text?.trim() && !imageUrl) {
      res.status(400).json({ success: false, data: null, error: '메시지 내용이 없습니다.' });
      return;
    }

    const participants = await getConversationParticipants(convId);
    if (!participants) {
      res.status(404).json({ success: false, data: null, error: '대화방을 찾을 수 없습니다.' });
      return;
    }

    const message = await saveMessage(convId, myId, text?.trim() ?? null, imageUrl ?? null);
    emitNewMessage(participants[0], participants[1], message);

    const recipientId = participants.find((id) => id !== myId);
    if (recipientId) {
      const senderName = (req as AuthRequest).displayName ?? '알 수 없음';
      const notifBody = imageUrl ? '사진을 보냈어요' : (text!.trim().length > 30 ? `${text!.trim().slice(0, 30)}…` : text!.trim());
      createNotification(
        recipientId,
        'new_chat_message',
        `${senderName}님이 메시지를 보냈어요`,
        notifBody,
        { conversationId: convId },
      ).catch((err) => logger.error('[chatController] 메시지 알림 실패:', err));
    }

    res.json({ success: true, data: message, error: null });
  } catch (err) {
    next(err);
  }
};

export const removeConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const myId = (req as AuthRequest).uid;
    const { convId } = req.params;
    const ok = await deleteConversation(convId, myId);
    if (!ok) {
      res.status(403).json({ success: false, data: null, error: '대화방을 삭제할 수 없습니다.' });
      return;
    }
    res.json({ success: true, data: null, error: null });
  } catch (err) {
    next(err);
  }
};
