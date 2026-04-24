import { Request, Response, NextFunction } from 'express';
import {
  getOrCreateConversation,
  getConversations,
  getMessages,
  saveMessage,
  getConversationParticipants,
} from '../services/chatService';
import { emitNewMessage } from '../socket';

type AuthRequest = Request & { uid: string };

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
    const messages = await getMessages(req.params.convId);
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

    res.json({ success: true, data: message, error: null });
  } catch (err) {
    next(err);
  }
};
