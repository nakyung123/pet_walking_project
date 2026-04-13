'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGPS } from '@/hooks/useGPS';
import { useSocket, TileUpdatedPayload } from '@/hooks/useSocket';
import { getTiles, postMarking, startSession, getScore } from '@/services/api';
import NaverMap, { Tile } from '@/components/NaverMap';
import MarkingButton from '@/components/MarkingButton';
import ScorePanel from '@/components/ScorePanel';

type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

export default function MapPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  // 세션 / 점수
  const sessionIdRef = useRef<string | null>(null);
  const [score, setScore] = useState(0);

  // 타일 상태
  const [tiles, setTiles] = useState<Tile[]>([]);
  const tileMapRef = useRef<Map<string, Tile>>(new Map());

  // 마지막 뷰포트 경계 (마킹 후 재조회에 사용)
  const lastBoundsRef = useRef<Bounds | null>(null);

  // 마킹 버튼
  const [marking, setMarking] = useState(false);

  // idToken
  const [idToken, setIdToken] = useState<string | null>(null);

  // GPS
  const { position, error: gpsError } = useGPS();

  // 점령 타일 수 (내 타일만)
  const myTileCount = tiles.filter((t) => t.occupantUserId === user?.uid).length;

  // 인증 확인 후 리다이렉트
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // idToken 갱신
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(setIdToken);
  }, [user]);

  // 세션 시작 + 초기 점수 로드
  useEffect(() => {
    if (!user || !idToken) return;

    (async () => {
      try {
        const sessRes = await startSession(user.uid, idToken);
        if (sessRes.success) sessionIdRef.current = sessRes.data.sessionId;

        const scoreRes = await getScore(user.uid, idToken);
        if (scoreRes.success) setScore(scoreRes.data.totalScore);
      } catch (e) {
        console.error('[MapPage] 세션/점수 초기화 실패:', e);
      }
    })();
  }, [user, idToken]);

  // 타일 목록 API 호출 (경계 기반)
  const fetchTiles = useCallback(
    async (bounds: Bounds) => {
      if (!idToken) return;
      try {
        const res = await getTiles(bounds, idToken);
        if (!res.success) return;

        const newTiles = res.data as Tile[];
        const newMap = new Map<string, Tile>();
        newTiles.forEach((t) => newMap.set(t.tileId, t));
        tileMapRef.current = newMap;
        setTiles(newTiles);
      } catch (e) {
        console.error('[MapPage] 타일 조회 실패:', e);
      }
    },
    [idToken],
  );

  // 타일 업데이트 핸들러 (Socket.IO → 단일 타일 갱신)
  const handleTileUpdated = useCallback((payload: TileUpdatedPayload) => {
    const existing = tileMapRef.current.get(payload.tileId);
    if (!existing) return; // 뷰포트 밖 타일이면 무시

    const updated: Tile = { ...existing, occupantUserId: payload.occupantUserId };
    tileMapRef.current.set(payload.tileId, updated);
    setTiles(Array.from(tileMapRef.current.values()));
  }, []);

  // Socket.IO 연결 오류
  const handleConnectError = useCallback(() => {
    console.warn('[MapPage] Socket 연결 실패. idToken을 갱신합니다.');
    user?.getIdToken(true).then(setIdToken);
  }, [user]);

  const { updateArea } = useSocket({ idToken, onTileUpdated: handleTileUpdated, onConnectError: handleConnectError });

  // 지도 경계 변경 → 타일 목록 API 호출
  const handleBoundsChange = useCallback(
    (bounds: Bounds) => {
      lastBoundsRef.current = bounds;
      fetchTiles(bounds);
    },
    [fetchTiles],
  );

  // 지도 중심 이동 → Socket.IO 구독 구역 변경
  const handleCenterChange = useCallback(
    (lat: number, lng: number) => {
      updateArea(lat, lng);
    },
    [updateArea],
  );

  // 마킹 버튼 핸들러
  const handleMark = async () => {
    if (!user || !idToken || !position || !sessionIdRef.current) return;
    if (position.speedKmh > 15) {
      alert('이동 속도가 너무 빠릅니다. 걸어서 마킹하세요.');
      return;
    }

    setMarking(true);
    try {
      const now = new Date();
      const enteredAt = new Date(now.getTime() - 1000).toISOString(); // 최소 1초 체류
      const res = await postMarking(
        {
          userId: user.uid,
          sessionId: sessionIdRef.current,
          lat: position.lat,
          lng: position.lng,
          speed: position.speedKmh,
          timestamp: now.toISOString(),
          enteredAt,
        },
        idToken,
      );
      if (res.success) {
        setScore(res.data.newScore);
        // 마킹 후 현재 뷰포트 타일 재조회 (신규 타일 반영)
        if (lastBoundsRef.current) fetchTiles(lastBoundsRef.current);
      }
    } catch (e) {
      console.error('[MapPage] 마킹 실패:', e);
    } finally {
      setMarking(false);
    }
  };

  // 로딩 중
  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gray-900">
      {/* 지도 (전체 화면) */}
      <NaverMap
        userId={user.uid}
        tiles={tiles}
        myPosition={position}
        onBoundsChange={handleBoundsChange}
        onCenterChange={handleCenterChange}
      />

      {/* 상단 점수 패널 */}
      <ScorePanel
        score={score}
        tileCount={myTileCount}
        userName={user.displayName ?? user.email ?? '사용자'}
      />

      {/* GPS 오류 배너 */}
      {gpsError && (
        <div className="absolute top-24 left-4 right-4 z-10 bg-red-600/90 text-white text-sm rounded-xl px-4 py-2 text-center">
          {gpsError}
        </div>
      )}

      {/* 마킹 버튼 */}
      <MarkingButton onMark={handleMark} disabled={!position} loading={marking} />

      {/* 로그아웃 버튼 (임시) */}
      <button
        onClick={logout}
        className="absolute top-4 right-16 z-20 text-xs text-gray-400 px-2 py-1 rounded bg-gray-800/60"
      >
        로그아웃
      </button>
    </div>
  );
}
