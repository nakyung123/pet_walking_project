'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGPS } from '@/hooks/useGPS';
import { useSocket, TileUpdatedPayload } from '@/hooks/useSocket';
import { getTiles, postMarking, startSession, getScore, getOccupiedTiles, getLeaderboard, deleteTile } from '@/services/api';
import NaverMap, { Tile } from '@/components/NaverMap';
import MarkingButton from '@/components/MarkingButton';
import ScorePanel from '@/components/ScorePanel';
import Toast, { ToastType } from '@/components/Toast';
import Leaderboard from '@/components/Leaderboard';

type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };
type TileFilter = 'all' | 'mine' | 'rivals';

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
  // race condition 방지: 가장 마지막 요청만 반영
  const fetchCounterRef = useRef(0);

  // 마킹 / 삭제 버튼
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  // 산책 경로 좌표 누적
  const [pathCoords, setPathCoords] = useState<{ lat: number; lng: number }[]>([]);

  // 타일 소유자 이름 (userId → displayName)
  const [tileOwners, setTileOwners] = useState<Record<string, string>>({});

  // 타일 필터
  const [tileFilter, setTileFilter] = useState<TileFilter>('all');


  // 토스트 메시지
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
  }, []);

  // idToken
  const [idToken, setIdToken] = useState<string | null>(null);

  // GPS
  const { position, error: gpsError } = useGPS();

  // 드래그로 수동 설정한 위치 (GPS 위치를 덮어씀, localStorage 영속)
  const [manualPosition, setManualPosition] = useState<{ lat: number; lng: number; speedKmh: number } | null>(() => {
    try {
      const saved = localStorage.getItem('manualPosition');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const effectivePosition = manualPosition ?? position;

  const handlePositionOverride = useCallback((lat: number, lng: number) => {
    const pos = { lat, lng, speedKmh: 0 };
    setManualPosition(pos);
    localStorage.setItem('manualPosition', JSON.stringify(pos));
  }, []);

  // GPS 위치 변경 시 경로 누적
  useEffect(() => {
    if (!position) return;
    setPathCoords((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.lat === position.lat && last.lng === position.lng) return prev;
      return [...prev, { lat: position.lat, lng: position.lng }];
    });
  }, [position]);

  // 점령 타일 수 (내 타일만)
  const myTileCount = tiles.filter((t) => t.occupantUserId === user?.uid).length;

  // 필터 적용 타일
  const filteredTiles = useMemo(() => {
    if (!user) return tiles;
    switch (tileFilter) {
      case 'mine':   return tiles.filter((t) => t.occupantUserId === user.uid);
      case 'rivals': return tiles.filter((t) => t.occupantUserId && t.occupantUserId !== user.uid);
      default:       return tiles;
    }
  }, [tiles, tileFilter, user]);

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

        // 점령 타일 전체 선로드 + 소유자 이름 맵 구성
        const [occupiedRes, leaderRes] = await Promise.all([
          getOccupiedTiles(idToken),
          getLeaderboard(idToken),
        ]);
        if (occupiedRes.success && occupiedRes.data) {
          const occupied = occupiedRes.data as Tile[];
          occupied.forEach((t) => tileMapRef.current.set(t.tileId, t));
          setTiles(Array.from(tileMapRef.current.values()));
        }
        if (leaderRes.success && leaderRes.data) {
          const owners: Record<string, string> = {};
          [...leaderRes.data.byTile, ...leaderRes.data.byScore].forEach((e) => {
            owners[e.userId] = e.displayName;
          });
          setTileOwners(owners);
        }
      } catch (e) {
        console.error('[MapPage] 세션/점수 초기화 실패:', e);
      }
    })();
  }, [user, idToken]);

  // 타일 목록 API 호출 (경계 기반)
  const fetchTiles = useCallback(
    async (bounds: Bounds) => {
      if (!idToken) return;
      const requestId = ++fetchCounterRef.current;
      try {
        const res = await getTiles(bounds, idToken);
        if (!res.success) return;
        if (requestId !== fetchCounterRef.current) return; // 더 최신 요청이 있으면 무시

        const newTiles = res.data as Tile[];
        // 완전 교체 대신 병합: 뷰포트 밖 타일이 사라지는 현상 방지
        newTiles.forEach((t) => tileMapRef.current.set(t.tileId, t));
        setTiles(Array.from(tileMapRef.current.values()));
      } catch (e) {
        console.error('[MapPage] 타일 조회 실패:', e);
      }
    },
    [idToken],
  );

  // 타일 업데이트 핸들러 (Socket.IO → 단일 타일 갱신)
  const handleTileUpdated = useCallback((payload: TileUpdatedPayload) => {
    const existing = tileMapRef.current.get(payload.tileId); // tileId = blockId
    if (!existing) return; // 뷰포트 밖 블록이면 무시

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
    if (!user || !idToken || !effectivePosition || !sessionIdRef.current) return;
    if (effectivePosition.speedKmh > 15) {
      showToast('속도가 너무 빠릅니다. 걸어서 마킹하세요.', 'error');
      return;
    }

    setMarking(true);
    try {
      const now = new Date();
      const enteredAt = new Date(now.getTime() - 1000).toISOString();
      const res = await postMarking(
        {
          userId: user.uid,
          sessionId: sessionIdRef.current,
          lat: effectivePosition.lat,
          lng: effectivePosition.lng,
          speed: effectivePosition.speedKmh,
          timestamp: now.toISOString(),
          enteredAt,
        },
        idToken,
      );
      if (res.success && res.data) {
        // 서버가 쿨다운 거부 응답을 보낸 경우
        if (res.data.rejectedReason?.startsWith('cooldown:')) {
          const secs = parseInt(res.data.rejectedReason.split(':')[1], 10);
          setCooldownUntil(Date.now() + secs * 1000);
          showToast(`${secs}초 후에 다시 마킹할 수 있습니다.`, 'info');
          return;
        }
        setScore(res.data.newScore);
        if (lastBoundsRef.current) fetchTiles(lastBoundsRef.current);
        showToast(
          res.data.isOccupied ? '🐾 영역을 점령했습니다!' : `+${res.data.newScore}점`,
          'success',
        );
      }
    } catch (e) {
      console.error('[MapPage] 마킹 실패:', e);
      showToast('마킹에 실패했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setMarking(false);
    }
  };

  // 타일 삭제 핸들러
  const handleDelete = async () => {
    if (!idToken || !effectivePosition) return;
    setDeleting(true);
    try {
      const res = await deleteTile(effectivePosition.lat, effectivePosition.lng, idToken);
      if (res.success) {
        if (lastBoundsRef.current) fetchTiles(lastBoundsRef.current);
        showToast('타일이 삭제됐습니다.', 'info');
      }
    } catch (e) {
      console.error('[MapPage] 타일 삭제 실패:', e);
      showToast('삭제에 실패했습니다.', 'error');
    } finally {
      setDeleting(false);
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

  const FILTER_TABS: { key: TileFilter; label: string }[] = [
    { key: 'all',    label: '전체' },
    { key: 'rivals', label: '경쟁 지역' },
    { key: 'mine',   label: '내 영역' },
  ];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gray-100">
      {/* 지도 (전체 화면) */}
      <NaverMap
        userId={user.uid}
        tiles={filteredTiles}
        myPosition={effectivePosition}
        initialPosition={effectivePosition ?? undefined}
        pathCoords={pathCoords}
        tileOwners={tileOwners}
        onBoundsChange={handleBoundsChange}
        onCenterChange={handleCenterChange}
        onPositionOverride={handlePositionOverride}
      />

      {/* 상단 바 */}
      <ScorePanel
        score={score}
        tileCount={myTileCount}
        userName={user.displayName ?? user.email ?? '사용자'}
        connected={true}
        onLogout={logout}
      />

      {/* 필터 탭 */}
      <div className="absolute top-[108px] left-0 right-0 z-10 flex justify-center">
        <div className="bg-white/92 backdrop-blur-md rounded-full shadow-md flex p-1 gap-0.5">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTileFilter(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                tileFilter === key
                  ? 'bg-orange-400 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* GPS 오류 배너 */}
      {gpsError && (
        <div className="absolute top-28 left-4 right-4 z-10 bg-red-500/90 text-white text-sm rounded-xl px-4 py-2 text-center shadow">
          {gpsError}
        </div>
      )}

      {/* 마킹 버튼 */}
      <MarkingButton
        onMark={handleMark}
        onDelete={handleDelete}
        disabled={!effectivePosition}
        loading={marking}
        deleting={deleting}
        cooldownUntil={cooldownUntil}
      />

      {/* 토스트 메시지 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* 리더보드 */}
      {idToken && (
        <Leaderboard
          idToken={idToken}
          currentUserId={user.uid}
        />
      )}
    </div>
  );
}
