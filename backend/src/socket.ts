import { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import admin from './firebase';
import { isValidAreaKey } from './utils/areaKey';
import logger from './utils/logger';
import type { ChatMessage } from './services/chatService';

export interface TileUpdatedPayload {
  tileId: string;
  occupantUserId: string | null;
}

let io: IOServer | null = null;

/**
 * Socket.IO 서버 초기화.
 * index.ts에서 http.Server 생성 후 한 번만 호출합니다.
 */
export function initSocketIO(httpServer: HttpServer): IOServer {
  io = new IOServer(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket'],
  });

  // Firebase ID 토큰 인증 미들웨어
  io.use(async (socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    // Firebase 키 미설정(개발 모드) → 인증 우회
    if (!process.env.FIREBASE_PROJECT_ID) {
      (socket as Socket & { uid: string }).uid = 'dev-user-001';
      return next();
    }

    if (!token) {
      return next(new Error('인증 토큰이 없습니다.'));
    }

    try {
      const decoded = await admin.auth().verifyIdToken(token);
      (socket as Socket & { uid: string }).uid = decoded.uid;
      next();
    } catch {
      next(new Error('유효하지 않은 토큰입니다.'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const uid = (socket as Socket & { uid: string }).uid;
    logger.debug(`[Socket] 연결: ${socket.id} (uid=${uid})`);

    // 유저 개인 룸 자동 입장 (DM 수신용)
    socket.join(`user:${uid}`);

    // 클라이언트가 특정 areaKey 룸에 입장
    socket.on('join_area', (areaKey: unknown) => {
      if (!isValidAreaKey(areaKey)) {
        logger.warn(`[Socket] 잘못된 areaKey: ${areaKey}`);
        return;
      }
      socket.join(areaKey);
      logger.debug(`[Socket] ${socket.id} join_area → ${areaKey}`);
    });

    // 클라이언트가 areaKey 룸에서 퇴장
    socket.on('leave_area', (areaKey: unknown) => {
      if (!isValidAreaKey(areaKey)) return;
      socket.leave(areaKey);
      logger.debug(`[Socket] ${socket.id} leave_area → ${areaKey}`);
    });

    socket.on('disconnect', (reason) => {
      logger.debug(`[Socket] 연결 해제: ${socket.id} (reason=${reason})`);
    });
  });

  logger.info('[Socket] Socket.IO 서버 초기화 완료');
  return io;
}

/**
 * 메시지 전송 후 대화 참여자 두 명의 개인 룸에 new_message 이벤트 전송.
 * chatController.ts에서 호출합니다.
 */
export function emitNewMessage(userId1: string, userId2: string, message: ChatMessage): void {
  if (!io) return;
  const payload = { message };
  io.to(`user:${userId1}`).emit('new_message', payload);
  io.to(`user:${userId2}`).emit('new_message', payload);
  logger.debug(`[Socket] new_message → user:${userId1}, user:${userId2}`);
}

/**
 * 마킹 성공 후 해당 타일이 속한 areaKey 룸에 tile_updated 이벤트 브로드캐스트.
 * markingController.ts에서 호출합니다.
 */
export function emitTileUpdated(
  areaKey: string,
  payload: TileUpdatedPayload,
): void {
  if (!io) {
    console.warn('[Socket] io가 초기화되지 않았습니다. emitTileUpdated 무시.');
    return;
  }
  io.to(areaKey).emit('tile_updated', payload);
  logger.debug(`[Socket] tile_updated → ${areaKey}`, payload);
}
