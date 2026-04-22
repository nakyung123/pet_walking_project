'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useGPS } from '@/hooks/useGPS';
import { useSocket, TileUpdatedPayload } from '@/hooks/useSocket';
import { getTiles, postMarking, startSession, getScore, getOccupiedTiles, getLeaderboard, deleteTile, getUserProfile, UserProfile } from '@/services/api';
import NaverMap, { Tile } from '@/components/NaverMap';
import MarkingButton from '@/components/MarkingButton';
import ScorePanel from '@/components/ScorePanel';
import Toast, { ToastType } from '@/components/Toast';
import Leaderboard from '@/components/Leaderboard';
import PetProfile from '@/components/PetProfile';
import OnboardingGuide from '@/components/OnboardingGuide';
import WalkSummaryModal, { WalkSummaryData } from '@/components/WalkSummaryModal';
import UserProfilePopup from '@/components/UserProfilePopup';

type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };
type TileFilter = 'all' | 'mine' | 'rivals';

const MISSIONS = [
  { emoji: '🦴', text: '오늘 3칸 마킹하면 간식 배지' },
  { emoji: '🔥', text: '7일 연속 산책 시 스페셜 타일 스킨' },
  { emoji: '📍', text: '같은 동네 1위 달성 시 지역 배지' },
  { emoji: '🤝', text: '친구와 함께 산책하면 협동 보너스' },
  { emoji: '⭐', text: '오늘 1칸만 더 마킹하면 미션 완료!' },
];

interface SimplePet { name: string; photoUrl?: string; }

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

  // 산책 상태
  const [isWalking, setIsWalking] = useState(false);
  const walkStartTimeRef = useRef<number | null>(null);
  const walkStartPathIndexRef = useRef<number>(0);
  const walkStartPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const walkStartScoreRef = useRef<number>(0);
  const walkStartTileCountRef = useRef<number>(0);
  const [walkSeconds, setWalkSeconds] = useState(0);
  const [walkDistance, setWalkDistance] = useState(0);
  const [walkSummary, setWalkSummary] = useState<WalkSummaryData | null>(null);

  // 다른 유저 프로필 팝업
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // 좌측 아이콘 상태
  const [missionState, setMissionState] = useState<'hidden' | 'popup' | 'banner'>('hidden');
  const [showDogList, setShowDogList] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [activePetIdx, setActivePetIdx] = useState(0);
  const [petList, setPetList] = useState<SimplePet[]>([]);
  const [petReloadTrigger, setPetReloadTrigger] = useState(0);
  const [addingPet, setAddingPet] = useState(false);

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

  // 강아지 목록 로드 (localStorage)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('petProfiles');
      const idx = localStorage.getItem('activePetIdx');
      if (saved) setPetList(JSON.parse(saved));
      if (idx) setActivePetIdx(Number(idx));
    } catch {}
  }, []);

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

  // 수동 위치 변경 시 경로 누적
  useEffect(() => {
    if (!manualPosition) return;
    setPathCoords((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.lat === manualPosition.lat && last.lng === manualPosition.lng) return prev;
      return [...prev, { lat: manualPosition.lat, lng: manualPosition.lng }];
    });
  }, [manualPosition]);

  // 산책 타이머
  useEffect(() => {
    if (!isWalking) return;
    const id = setInterval(() => {
      if (walkStartTimeRef.current !== null) {
        setWalkSeconds(Math.floor((Date.now() - walkStartTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isWalking]);

  // 산책 중 거리 계산 (Haversine)
  useEffect(() => {
    if (!isWalking) return;
    const tail = pathCoords.slice(walkStartPathIndexRef.current);
    const walkCoords = walkStartPositionRef.current ? [walkStartPositionRef.current, ...tail] : tail;
    if (walkCoords.length < 2) return;
    let total = 0;
    for (let i = 1; i < walkCoords.length; i++) {
      const { lat: lat1, lng: lng1 } = walkCoords[i - 1];
      const { lat: lat2, lng: lng2 } = walkCoords[i];
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    setWalkDistance(total);
  }, [pathCoords, isWalking]);

  // 산책 시작 핸들러
  const handleStartWalk = useCallback(() => {
    const curTileCount = tiles.filter((t) => t.occupantUserId === user?.uid).length;
    walkStartTimeRef.current = Date.now();
    walkStartPathIndexRef.current = pathCoords.length;
    // 산책 시작 시점의 실제 위치를 출발점으로 고정
    walkStartPositionRef.current = effectivePosition
      ? { lat: effectivePosition.lat, lng: effectivePosition.lng }
      : null;
    walkStartScoreRef.current = score;
    walkStartTileCountRef.current = curTileCount;
    setWalkSeconds(0);
    setWalkDistance(0);
    setIsWalking(true);
    showToast('산책을 시작합니다!', 'success');
  }, [pathCoords.length, score, tiles, user?.uid, showToast]);

  // 산책 마치기 핸들러
  const handleEndWalk = useCallback(() => {
    const curTileCount = tiles.filter((t) => t.occupantUserId === user?.uid).length;
    setIsWalking(false);
    const tail = pathCoords.slice(walkStartPathIndexRef.current);
    const summaryPath = walkStartPositionRef.current
      ? [walkStartPositionRef.current, ...tail]
      : tail;
    const summaryData = {
      seconds: walkSeconds,
      distance: walkDistance,
      scoreGained: Math.max(0, score - walkStartScoreRef.current),
      tilesGained: Math.max(0, curTileCount - walkStartTileCountRef.current),
      pathCoords: summaryPath,
    };
    setWalkSummary(summaryData);

    // 산책 기록 localStorage 저장
    try {
      const now = new Date();
      const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const walkRecord = { ...summaryData, date: dateKey, savedAt: Date.now() };
      const existing: unknown[] = JSON.parse(localStorage.getItem('walkLogs') || '[]');
      localStorage.setItem('walkLogs', JSON.stringify([...existing, walkRecord]));
    } catch {}
  }, [walkSeconds, walkDistance, score, tiles, user?.uid, pathCoords]);

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
        // 타일 점수가 아닌 유저 총점을 다시 조회해서 반영
        const scoreBeforeMarking = score;
        const scoreRes = await getScore(user.uid, idToken);
        if (scoreRes.success) {
          const delta = Math.max(0, scoreRes.data.totalScore - scoreBeforeMarking);
          setScore(scoreRes.data.totalScore);

          // 포인트 기록 저장
          try {
            const records: unknown[] = JSON.parse(localStorage.getItem('pointHistory') || '[]');
            if (delta > 0) {
              records.push({ timestamp: Date.now(), type: 'marking', points: delta, label: '마킹 완료' });
            }
            if (res.data.isOccupied) {
              records.push({ timestamp: Date.now() + 1, type: 'occupy', points: 1000, label: '타일 점유 성공' });
            }
            localStorage.setItem('pointHistory', JSON.stringify(records));
          } catch {}
        }
        if (lastBoundsRef.current) fetchTiles(lastBoundsRef.current);
        showToast(
          res.data.isOccupied ? '🐾 영역을 점령했습니다!' : '마킹 완료!',
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

  // 다른 유저 클릭 → 프로필 팝업
  const handleUserClick = useCallback(async (clickedUserId: string) => {
    if (!idToken) return;
    try {
      const res = await getUserProfile(clickedUserId, idToken);
      if (res.success && res.data) setUserProfile(res.data);
    } catch (e) {
      console.error('[MapPage] 유저 프로필 조회 실패:', e);
    }
  }, [idToken]);

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
        tileOwners={tileOwners}
        previewPosition={effectivePosition}
        onBoundsChange={handleBoundsChange}
        onCenterChange={handleCenterChange}
        onPositionOverride={handlePositionOverride}
        onUserClick={handleUserClick}
        flyTo={flyTo}
      />

      {/* 온보딩 가이드 */}
      <OnboardingGuide />

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

      {/* 미션 배너 — 필터 탭 아래 상시 표시 */}
      {missionState === 'banner' && (
        <div className="absolute top-[168px] left-0 right-0 z-10 flex justify-center px-4">
          <div className="flex items-center gap-2.5 bg-white/97 backdrop-blur-sm rounded-full px-5 py-3 shadow-md border border-orange-100">
            <span className="text-lg">⭐</span>
            <span className="text-sm font-semibold text-gray-800">오늘 1칸만 더 마킹하면 미션 완료!</span>
            <span className="text-sm font-black text-orange-500">+50P</span>
          </div>
        </div>
      )}

      {/* 미션 팝업 — 화면 중앙 */}
      {missionState === 'popup' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMissionState('banner')} />
          <div className="relative w-full max-w-xs bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="h-24 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}>
              <span className="text-5xl">⭐</span>
            </div>
            <button
              onClick={() => setMissionState('banner')}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors text-sm"
            >✕</button>
            <div className="px-6 pt-5 pb-6 text-center">
              <p className="text-xs font-bold text-orange-400 tracking-widest mb-2">일일 미션</p>
              <p className="text-xl font-bold text-gray-900 leading-snug mb-5">
                오늘 1칸만 더 마킹하면<br />미션 완료!
              </p>
              <div className="bg-amber-50 rounded-2xl py-4 flex flex-col items-center border border-amber-100">
                <p className="text-xs text-gray-400 mb-1">달성 보상</p>
                <p className="text-4xl font-black text-orange-500">+50P</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GPS 오류 배너 */}
      {gpsError && (
        <div className="absolute top-28 left-4 right-4 z-10 bg-red-500/90 text-white text-sm rounded-xl px-4 py-2 text-center shadow">
          {gpsError}
        </div>
      )}

      {/* 마킹 버튼 / 산책 시작하기 */}
      <MarkingButton
        onMark={handleMark}
        onStartWalk={handleStartWalk}
        isWalking={isWalking}
        disabled={!effectivePosition}
        loading={marking}
        cooldownUntil={cooldownUntil}
      />

      {/* 산책 중 정보 pill */}
      {isWalking && (
        <div className="absolute bottom-[21px] left-0 right-0 z-10 flex justify-center">
          <div className="bg-white/95 backdrop-blur-sm rounded-full flex items-center gap-5 px-8 h-14 shadow-lg overflow-visible">
            {/* 시간 */}
            <div className="flex flex-col items-center min-w-[52px]">
              <span className="text-lg font-bold text-gray-800 tabular-nums leading-tight">
                {Math.floor(walkSeconds / 60)}:{String(walkSeconds % 60).padStart(2, '0')}
              </span>
              <span className="text-[11px] text-gray-400 leading-tight">시간</span>
            </div>

            {/* 종료 버튼 — pill보다 12px 크게 해서 위아래 6px씩 삐져나옴 */}
            <button
              onClick={handleEndWalk}
              className="w-[68px] h-[68px] rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-lg shrink-0"
              style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
            >
              <div className="w-[20px] h-[20px] bg-white rounded-[2px]" />
            </button>

            {/* 거리 */}
            <div className="flex flex-col items-center min-w-[52px]">
              <span className="text-lg font-bold text-gray-800 tabular-nums leading-tight">
                {walkDistance >= 1
                  ? `${walkDistance.toFixed(2)}km`
                  : `${Math.round(walkDistance * 1000)}m`}
              </span>
              <span className="text-[11px] text-gray-400 leading-tight">거리</span>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 메시지 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* 오른쪽 패널: 프로필 + 리더보드 (상하 절반) */}
      {idToken && (
        <div className="absolute top-[104px] bottom-3 right-3 z-20 flex flex-col gap-3 w-80">
          <div className="flex-1 min-h-0 relative">
            {/* 프로필 좌측 상단 아이콘 3개 */}
            <div className="absolute -left-14 top-0 z-30 flex flex-col gap-2">
              {/* ① 미션 버튼 */}
              <button
                onClick={() => setMissionState(missionState === 'hidden' ? 'popup' : missionState === 'banner' ? 'popup' : 'hidden')}
                className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg border transition-colors ${
                  missionState !== 'hidden'
                    ? 'bg-orange-400 border-orange-400'
                    : 'bg-white/95 backdrop-blur-sm border-white/60'
                }`}
              >
                <span className={`text-xl ${missionState === 'hidden' ? 'animate-pulse' : ''}`}>
                  {missionState !== 'hidden' ? '❕' : '❗'}
                </span>
              </button>

              {/* ② 현재 위치로 이동 */}
              <button
                onClick={() => {
                  if (!effectivePosition) return;
                  setFlyTo({ lat: effectivePosition.lat, lng: effectivePosition.lng, zoom: 18 });
                  setTimeout(() => setFlyTo(null), 100);
                }}
                className="w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm border border-white/60 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                {/* Material Design "My Location" 아이콘 */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#F97316">
                  <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                </svg>
              </button>

              {/* ③ 강아지 선택 — 현재 강아지 이름 표시 */}
              <div className="relative">
                <button
                  onClick={() => {
                    try {
                      const saved = localStorage.getItem('petProfiles');
                      if (saved) setPetList(JSON.parse(saved));
                    } catch {}
                    setShowDogList((v) => !v);
                  }}
                  className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg border transition-colors text-sm font-bold ${
                    showDogList
                      ? 'bg-orange-400 border-orange-400 text-white'
                      : 'bg-white/95 backdrop-blur-sm border-white/60 text-gray-700'
                  }`}
                >
                  {(petList[activePetIdx]?.name ?? '🐾').slice(0, 2)}
                </button>

                {/* 강아지 이름 목록 — 아래로 펼침 */}
                {showDogList && (
                  <div className="absolute left-0 top-[52px] flex flex-col gap-1.5">
                    {petList
                      .map((pet, i) => ({ pet, i }))
                      .filter(({ i }) => i !== activePetIdx)
                      .map(({ pet, i }) => (
                        <button
                          key={i}
                          onClick={() => {
                            setActivePetIdx(i);
                            localStorage.setItem('activePetIdx', String(i));
                            setShowDogList(false);
                          }}
                          className="w-11 h-11 rounded-full shadow-md text-sm font-bold flex items-center justify-center bg-white/95 backdrop-blur-sm text-gray-700 border border-white/60"
                        >
                          {pet.name.slice(0, 2)}
                        </button>
                      ))}
                    {/* 강아지 추가 버튼 */}
                    <button
                      onClick={() => {
                        setShowDogList(false);
                        setAddingPet(true);
                      }}
                      className="w-11 h-11 rounded-full shadow-md text-xl font-bold flex items-center justify-center bg-white/95 backdrop-blur-sm border border-white/60 text-orange-400"
                    >+</button>
                  </div>
                )}
              </div>
            </div>

            <PetProfile
              walkSeconds={walkSeconds}
              walkDistance={walkDistance}
              isWalking={isWalking}
              idToken={idToken}
              activePetIdx={activePetIdx}
              reloadTrigger={petReloadTrigger}
              addingPet={addingPet}
              onAddPetDone={(newPets, newIdx) => {
                setPetList(newPets);
                setActivePetIdx(newIdx);
                setAddingPet(false);
              }}
              onAddPetCancel={() => setAddingPet(false)}
              onPetsChange={(pets, idx) => {
                setPetList(pets);
                setActivePetIdx(idx);
              }}
            />
          </div>
          {/* 리더보드 + 휴지통 버튼 */}
          <div className="flex-1 min-h-0 relative">
            <Leaderboard
              idToken={idToken}
              currentUserId={user.uid}
            />
            {/* 휴지통 — 리더보드 좌측 하단, 상시 표시 */}
            <button
              onClick={handleDelete}
              disabled={!effectivePosition || deleting}
              className="absolute bottom-3 -left-14 w-11 h-11 rounded-full bg-white/90 backdrop-blur-sm
                shadow-lg border border-gray-200 flex items-center justify-center text-xl
                active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting
                ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : '🗑️'}
            </button>
          </div>
        </div>
      )}

      {/* 유저 프로필 팝업 */}
      {userProfile && (
        <UserProfilePopup
          profile={userProfile}
          onClose={() => setUserProfile(null)}
        />
      )}

      {/* 산책 일지 팝업 */}
      {walkSummary && (
        <WalkSummaryModal
          summary={walkSummary}
          onClose={() => setWalkSummary(null)}
        />
      )}
    </div>
  );
}
