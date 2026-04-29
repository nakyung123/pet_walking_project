import { Request, Response, NextFunction } from 'express';
import {
  getOrCreateConversation,
  getConversations,
  getMessages,
  saveMessage,
  getConversationParticipants,
} from '../services/chatService';
import { emitNewMessage } from '../socket';
import { createNotification } from '../services/notificationService';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/authMiddleware';

export const startConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const myId = (req as AuthRequest).uid;
    const otherId = req.params.userId;
    if (myId === otherId) {
      res.status(400).json({ success: false, data: null, error: '자기 자신과 대화할 수 없습니다.' });
      return;
    }
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
    const { text } = req.body as { text?: string };

    if (!text?.trim()) {
      res.status(400).json({ success: false, data: null, error: '메시지 내용이 없습니다.' });
      return;
    }

    const participants = await getConversationParticipants(convId);
    if (!participants) {
      res.status(404).json({ success: false, data: null, error: '대화방을 찾을 수 없습니다.' });
      return;
    }

    const message = await saveMessage(convId, myId, text.trim());
    emitNewMessage(participants[0], participants[1], message);

    const recipientId = participants.find((id) => id !== myId);
    if (recipientId) {
      createNotification(
        recipientId,
        'new_chat_message',
        '새 메시지가 도착했어요',
        text.trim().length > 30 ? `${text.trim().slice(0, 30)}…` : text.trim(),
        { conversationId: convId },
      ).catch((err) => logger.error('[chatController] 메시지 알림 실패:', err));
    }

    res.json({ success: true, data: message, error: null });
  } catch (err) {
    next(err);
  }
};
