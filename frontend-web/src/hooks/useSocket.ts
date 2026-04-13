'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toAreaKey } from '@/lib/areaKey';

const SERVER = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface TileUpdatedPayload {
  tileId: string;
  occupantUserId: string | null;
}

interface UseSocketOptions {
  idToken: string | null;
  onTileUpdated: (payload: TileUpdatedPayload) => void;
  onConnectError: () => void;
}

export function useSocket({ idToken, onTileUpdated, onConnectError }: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const areaKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!idToken) return;

    const socket = io(SERVER, {
      transports: ['websocket'],
      auth: { token: idToken },
    });

    socket.on('connect_error', onConnectError);
    socket.on('tile_updated', onTileUpdated);

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken]);

  // 카메라 중심 좌표가 바뀔 때 구독 구역 변경
  const updateArea = useCallback((lat: number, lng: number) => {
    const socket = socketRef.current;
    if (!socket) return;

    const newKey = toAreaKey(lat, lng);
    if (newKey === areaKeyRef.current) return;

    if (areaKeyRef.current) socket.emit('leave_area', areaKeyRef.current);
    socket.emit('join_area', newKey);
    areaKeyRef.current = newKey;
  }, []);

  return { updateArea };
}
