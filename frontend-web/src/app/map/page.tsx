'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useGPS } from '@/hooks/useGPS';
import { useSocket, TileUpdatedPayload } from '@/hooks/useSocket';
import { getTiles, postMarking, startSession, endSession, getScore, getOccupiedTiles, getLeaderboard, deleteTile, getUserProfile, updateProfile, UserProfile, LeaderboardEntry } from '@/services/api';
import NaverMap, { Tile } from '@/components/NaverMap';
import MarkingButton from '@/components/MarkingButton';
import ScorePanel from '@/components/ScorePanel';
import Toast, { ToastType } from '@/components/Toast';
import Leaderboard from '@/components/Leaderboard';
import PetProfile from '@/components/PetProfile';
import OnboardingGuide from '@/components/OnboardingGuide';
import WalkSummaryModal, { WalkSummaryData } from '@/components/WalkSummaryModal';
import UserProfilePopup from '@/components/UserProfilePopup';
import ChatList from '@/components/ChatList';
import CommunityPanel from '@/components/CommunityPanel';
import { ChatUser } from '@/components/ChatRoom';
import TileInfoCard from '@/components/TileInfoCard';
import { WalkCalendarModal } from '@/components/PetProfile';
import LocationPermissionPrompt from '@/components/LocationPermissionPrompt';
import DogSetupScreen from '@/components/DogSetupScreen';
import ConfirmDialog from '@/components/ConfirmDialog';

type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };
type TileFilter = 'all' | 'mine' | 'rivals';

const MISSIONS = [
  { emoji: '🦴', text: '오늘 3칸 마킹하면 간식 배지' },
  { emoji: '🔥', text: '7일 연속 산책 시 스페셜 타일 스킨' },
  { emoji: '📍', text: '같은 동네 1위 달성 시 지역 배지' },
  { emoji: '🤝', text: '친구와 함께 산책하면 협동 보너스' },
  { emoji: '⭐', text: '오늘 1칸만 더 마킹하면 미션 완료!' },
];

// 타일 ID 계산 (NaverMap과 동일한 공식)
const _R = 6378137;
const _TILE_M = 50;
const _lngToX = (lng: number) => (lng * Math.PI / 180) * _R;
const _latToY = (lat: number) => Math.log(Math.tan((90 + lat) * Math.PI / 360)) * _R;
const computeTileId = (lat: number, lng: number): string => {
  const gx = Math.floor(_lngToX(lng) / _TILE_M);
  const gy = Math.floor(_latToY(lat) / _TILE_M);
  return `${gx}_${gy}`;
};

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

  // 삭제 버튼
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
  const lastAutoMarkTileIdRef = useRef<string | null>(null);
  const [walkSeconds, setWalkSeconds] = useState(0);
  const [walkDistance, setWalkDistance] = useState(0);
  const [walkSummary, setWalkSummary] = useState<WalkSummaryData | null>(null);

  // 다른 유저 프로필 팝업 + 선택된 상대 유저 영역 표시
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [visibleRivalUserId, setVisibleRivalUserId] = useState<string | null>(null);

  // 채팅
  const [showChatList, setShowChatList] = useState(false);
  const [showCommunity, setShowCommunity] = useState(false);
  const [pendingChatUser, setPendingChatUser] = useState<ChatUser | null>(null);

  // 타일 정보 카드
  const [selectedTile, setSelectedTile] = useState<Tile | null | undefined>(undefined);
  const [selectedTileLatLng, setSelectedTileLatLng] = useState<{ lat: number; lng: number } | null>(null);

  const handleTileClick = useCallback((tile: Tile | null, lat: number, lng: number) => {
    setSelectedTile(tile);
    setSelectedTileLatLng({ lat, lng });
    setVisibleRivalUserId(null);
  }, []);

  // 모달 상태
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'notifications' | 'terms' | 'withdraw'>('main');
  const [notifSettings, setNotifSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notifSettings') || '{}'); } catch { return {}; }
  });
  const [withdrawStep, setWithdrawStep] = useState(0);
  const [showWalkLog, setShowWalkLog] = useState(false);

  // 좌측 아이콘 상태
  const [missionState, setMissionState] = useState<'hidden' | 'popup' | 'banner'>('hidden');
  const [hasSeenMission, setHasSeenMission] = useState(false);
  const [showDogList, setShowDogList] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [activePetIdx, setActivePetIdx] = useState(0);
  const [petList, setPetList] = useState<SimplePet[]>([]);
  const [petReloadTrigger, setPetReloadTrigger] = useState(0);
  const [addingPet, setAddingPet] = useState(false);

  // 타일 소유자 이름 (userId → displayName)
  const [tileOwners, setTileOwners] = useState<Record<string, string>>({});

  // 랭킹 데이터 (추천 행동 힌트용)
  const [leaderboardByScore, setLeaderboardByScore] = useState<LeaderboardEntry[]>([]);

  // 타일 필터
  const [tileFilter, setTileFilter] = useState<TileFilter>('all');


  // 토스트 메시지 (key로 매번 재마운트하여 타이머 리셋)
  const [toast, setToast] = useState<{ message: string; type: ToastType; key: number } | null>(null);
  const toastKeyRef = useRef(0);
  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type, key: ++toastKeyRef.current });
  }, []);

  // idToken
  const [idToken, setIdToken] = useState<string | null>(null);
  const idTokenRef = useRef<string | null>(null);

  // 강아지 목록 로드 (localStorage)
  useEffect(() => {
    try {
      localStorage.removeItem('manualPosition');
      const saved = localStorage.getItem('petProfiles');
      const idx = localStorage.getItem('activePetIdx');
      if (saved) setPetList(JSON.parse(saved));
      if (idx) setActivePetIdx(Number(idx));
    } catch {}
  }, []);


  // 로그인 후 위치 권한 안내 화면 (세션마다 1회, 새로고침 시 재표시 안 함)
  const [showLocationPrompt, setShowLocationPrompt] = useState(() => {
    try {
      return !sessionStorage.getItem('locationPromptSeen');
    } catch {
      return true;
    }
  });

  const dismissLocationPrompt = () => {
    try { sessionStorage.setItem('locationPromptSeen', '1'); } catch {}
    setShowLocationPrompt(false);
  };

  // 강아지 정보 입력 화면 (최초 1회, petProfiles 없을 때)
  const [showDogSetup, setShowDogSetup] = useState(() => {
    try {
      const saved = localStorage.getItem('petProfiles');
      const pets = saved ? JSON.parse(saved) : [];
      return !Array.isArray(pets) || pets.length === 0;
    } catch {
      return true;
    }
  });

  // 삭제/로그아웃 확인 다이얼로그
  const [pendingLogout, setPendingLogout] = useState(false);
  const [pendingTileDelete, setPendingTileDelete] = useState(false);

  const handleAllowLocation = () => {
    navigator.geolocation.getCurrentPosition(() => {}, () => {});
    dismissLocationPrompt();
  };

  // GPS
  const { position, error: gpsError } = useGPS(!showLocationPrompt);

  const [overridePosition, setOverridePosition] = useState<{ lat: number; lng: number; speedKmh: number } | null>(null);

  // 드래그 후에는 override가 우선, 그 전까지는 GPS
  const effectivePosition = overridePosition ?? position;

  const handlePositionOverride = useCallback((lat: number, lng: number) => {
    setOverridePosition({ lat, lng, speedKmh: 0 });
  }, []);

  // 위치 변경 시 경로 누적 (GPS + 드래그 모두 반영)
  useEffect(() => {
    if (!effectivePosition) return;
    setPathCoords((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.lat === effectivePosition.lat && last.lng === effectivePosition.lng) return prev;
      return [...prev, { lat: effectivePosition.lat, lng: effectivePosition.lng }];
    });
  }, [effectivePosition?.lat, effectivePosition?.lng]);

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
    lastAutoMarkTileIdRef.current = null;
    setWalkSeconds(0);
    setWalkDistance(0);
    setIsWalking(true);
    showToast('산책을 시작했습니다!', 'success');
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

    // 세션 종료 + 거리 서버 저장
    if (sessionIdRef.current && idToken) {
      endSession(sessionIdRef.current, walkDistance, idToken).catch(() => {});
    }

    // 산책 기록 localStorage 저장
    try {
      const now = new Date();
      const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const walkRecord = { ...summaryData, date: dateKey, savedAt: Date.now() };
      const existing: unknown[] = JSON.parse(localStorage.getItem('walkLogs') || '[]');
      localStorage.setItem('walkLogs', JSON.stringify([...existing, walkRecord]));
    } catch {}
  }, [walkSeconds, walkDistance, score, tiles, user?.uid, pathCoords, idToken]);

  // 점령 타일 수 (내 타일만)
  const myTileCount = tiles.filter((t) => t.occupantUserId === user?.uid).length;

  // 곧 만료될 내 타일 수
  const expiringCount = useMemo(() => {
    if (!user) return 0;
    const WARN_MS = 20 * 60 * 60 * 1000;
    return tiles.filter(t =>
      t.occupantUserId === user.uid &&
      t.lastMarkedAt &&
      Date.now() - new Date(t.lastMarkedAt).getTime() > WARN_MS
    ).length;
  }, [tiles, user]);

  // 필터 적용 타일
  const filteredTiles = useMemo(() => {
    if (!user) return tiles;
    switch (tileFilter) {
      case 'mine':   return tiles.filter((t) => t.occupantUserId === user.uid);
      case 'rivals': return tiles.filter((t) => t.occupantUserId !== null);
      default:       return tiles;
    }
  }, [tiles, tileFilter, user]);

  // 인증 확인 후 리다이렉트
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // idToken 자동 갱신 (Firebase가 만료 전 자동 갱신할 때마다 최신 토큰 수신)
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (u) => {
      if (u) {
        const token = await u.getIdToken();
        idTokenRef.current = token;
        setIdToken(token);
      } else {
        idTokenRef.current = null;
        setIdToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 세션 시작 + 초기 점수 로드 (user 변경 시 1회만 실행, 토큰 갱신에는 반응 안 함)
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      // onIdTokenChanged가 먼저 세팅하지 못한 경우를 대비해 직접 획득
      const token = idTokenRef.current ?? await user.getIdToken();
      if (!token) return;

      try {
        const sessRes = await startSession(token);
        if (sessRes.success) sessionIdRef.current = sessRes.data.sessionId;

        const scoreRes = await getScore(token);
        if (scoreRes.success) setScore(scoreRes.data.totalScore);

        const [occupiedRes, leaderRes] = await Promise.all([
          getOccupiedTiles(token),
          getLeaderboard(token),
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
          setLeaderboardByScore(leaderRes.data.byScore);
        }
      } catch (e) {
        console.error('[MapPage] 세션/점수 초기화 실패:', e);
      }
    };

    init();
  }, [user]);

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
    user?.getIdToken(true).then((token) => { idTokenRef.current = token; setIdToken(token); });
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

  // 자동 마킹 핸들러 (산책 중 새 타일 진입 시 호출)
  const handleMark = async () => {
    if (!user || !idToken || !effectivePosition || !sessionIdRef.current) return;
    if (effectivePosition.speedKmh > 15) return;

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
          return;
        }
        // 기존 타일만 즉시 반영 (신규 타일은 fetchTiles가 정확한 중심 좌표로 갱신)
        const { tileId: markedTileId, isOccupied } = res.data;
        if (markedTileId) {
          const existing = tileMapRef.current.get(markedTileId);
          if (existing) {
            tileMapRef.current.set(markedTileId, { ...existing, occupantUserId: isOccupied ? user.uid : existing.occupantUserId });
            setTiles(Array.from(tileMapRef.current.values()));
          }
        }

        // 타일 점수가 아닌 유저 총점을 다시 조회해서 반영
        const scoreBeforeMarking = score;
        const scoreRes = await getScore(idToken);
        if (scoreRes.success) {
          const delta = Math.max(0, scoreRes.data.totalScore - scoreBeforeMarking);
          setScore(scoreRes.data.totalScore);

          // 포인트 기록 저장
          try {
            const records: unknown[] = JSON.parse(localStorage.getItem('pointHistory') || '[]');
            if (delta > 0) {
              records.push({ timestamp: Date.now(), type: 'marking', points: delta, label: '마킹 완료' });
            }
            if (isOccupied) {
              records.push({ timestamp: Date.now() + 1, type: 'occupy', points: 1000, label: '타일 점유 성공' });
            }
            localStorage.setItem('pointHistory', JSON.stringify(records));
          } catch {}
        }
        if (lastBoundsRef.current) fetchTiles(lastBoundsRef.current);
        if (res.data.isOccupied) {
          setTimeout(() => showToast('영역을 점령했습니다!', 'success'), 2000);
        }
      }
    } catch (e) {
      console.error('[MapPage] 자동 마킹 실패:', e);
    }
  };

  // handleMark 최신 참조 유지 (자동 마킹에서 stale closure 방지)
  const handleMarkRef = useRef(handleMark);
  useEffect(() => { handleMarkRef.current = handleMark; });

  // 산책 중 자동 마킹: GPS 위치가 새 타일로 바뀔 때 자동 호출
  useEffect(() => {
    if (!isWalking || !effectivePosition) return;
    if (cooldownUntil && Date.now() < cooldownUntil) return;
    const tileId = computeTileId(effectivePosition.lat, effectivePosition.lng);
    if (tileId === lastAutoMarkTileIdRef.current) return;
    lastAutoMarkTileIdRef.current = tileId;

    // 경쟁자 타일 진입 알림
    const currentTile = tileMapRef.current.get(tileId);
    if (currentTile?.occupantUserId && currentTile.occupantUserId !== user?.uid) {
      const ownerName = tileOwners[currentTile.occupantUserId] ?? '다른 유저';
      showToast(`${ownerName}의 구역입니다! 마킹으로 빼앗아보세요.`, 'warning');
    }

    handleMarkRef.current();
  }, [effectivePosition?.lat, effectivePosition?.lng, isWalking, cooldownUntil]);

  // 다른 유저 핀 클릭 → 프로필 팝업 + 해당 유저 영역 표시
  const handleUserClick = useCallback(async (clickedUserId: string) => {
    if (!idToken) return;
    setVisibleRivalUserId(clickedUserId);
    try {
      const res = await getUserProfile(clickedUserId, idToken);
      if (res.success && res.data) setUserProfile(res.data);
    } catch (e) {
      console.error('[MapPage] 유저 프로필 조회 실패:', e);
    }
  }, [idToken]);

  // 타일 삭제 핸들러
  const handleDelete = () => {
    if (!idToken || !effectivePosition) return;
    setPendingTileDelete(true);
  };

  const confirmTileDelete = async () => {
    setPendingTileDelete(false);
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
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'linear-gradient(160deg, #FFF7ED 0%, #FFEDD5 60%, #FED7AA 100%)' }}>
        <img src="/bichon.png" alt="로딩 중" className="w-24 h-24 object-contain animate-bounce" />
        <p className="mt-4 text-sm font-semibold text-gray-500">잠시만 기다려주세요!</p>
      </div>
    );
  }

  // 위치 권한 안내 화면 (로그인 후 세션마다 1회)
  if (showLocationPrompt) {
    return (
      <LocationPermissionPrompt
        onAllow={handleAllowLocation}
        onDeny={dismissLocationPrompt}
      />
    );
  }

  // 강아지 정보 입력 화면 (최초 1회)
  if (showDogSetup) {
    return (
      <DogSetupScreen
        onDone={(pet) => {
          const newPets = [pet];
          localStorage.setItem('petProfiles', JSON.stringify(newPets));
          localStorage.setItem('activePetIdx', '0');
          setPetList(newPets);
          setActivePetIdx(0);
          setShowDogSetup(false);
          if (idToken) {
            updateProfile(
              { dogBreed: pet.breed, dogAge: pet.age, dogPersonality: pet.personality },
              idToken,
            ).catch(() => {});
          }
        }}
      />
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
        walkPathCoords={isWalking ? [
          ...(walkStartPositionRef.current ? [walkStartPositionRef.current] : []),
          ...pathCoords.slice(walkStartPathIndexRef.current),
        ] : []}
        onBoundsChange={handleBoundsChange}
        onCenterChange={handleCenterChange}
        onPositionOverride={handlePositionOverride}
        onUserClick={handleUserClick}
        onTileClick={handleTileClick}
        highlightLatLng={selectedTile !== undefined ? selectedTileLatLng : null}
        flyTo={flyTo}
        visibleRivalUserId={visibleRivalUserId}
        showAllRivals={tileFilter === 'rivals'}
      />

      {/* 온보딩 가이드 */}
      <OnboardingGuide />

      {/* 타일 정보 카드 */}
      {selectedTile !== undefined && selectedTileLatLng && (
        <TileInfoCard
          tile={selectedTile}
          currentUserId={user.uid}
          tileOwners={tileOwners}
          allTiles={tiles}
          onClose={() => { setSelectedTile(undefined); setSelectedTileLatLng(null); }}
          onViewProfile={handleUserClick}
        />
      )}

      {/* 상단 바 */}
      <ScorePanel
        score={score}
        tileCount={myTileCount}
        userName={user.displayName ?? user.email ?? '사용자'}
        connected={true}
        expiringCount={expiringCount}
        idToken={idToken ?? undefined}
        onWalkLog={() => setShowWalkLog(true)}
        onProfile={() => setShowProfile(true)}
        onSettings={() => setShowSettings(true)}
      />

      {/* 필터 탭 */}
      <div className="absolute top-[108px] left-0 right-0 z-10 flex justify-center">
        <div className="bg-white/92 backdrop-blur-md rounded-full shadow-md flex p-1 gap-0.5">
          {FILTER_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTileFilter(key); setVisibleRivalUserId(null); }}
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
        onStartWalk={handleStartWalk}
        isWalking={isWalking}
        disabled={!effectivePosition}
        onDelete={handleDelete}
        deleting={deleting}
        deleteDisabled={!effectivePosition || deleting}
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
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* 우측 아이콘 컬럼 */}
      {idToken && (
        <div className="absolute top-[104px] right-3 z-20 flex flex-col gap-2">
          {/* ① 미션 버튼 */}
          <button
            onClick={() => {
              if (missionState !== 'hidden') { setMissionState('hidden'); return; }
              if (!hasSeenMission) { setHasSeenMission(true); setMissionState('popup'); }
              else { setMissionState('banner'); }
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center border transition-colors ${
              missionState !== 'hidden'
                ? 'bg-orange-400 border-orange-400 shadow-lg'
                : 'bg-white/95 backdrop-blur-sm border-yellow-300 mission-glow'
            }`}
          >
            <span className="text-xl">❕</span>
          </button>

          {/* ② 랭킹 */}
          <button
            onClick={() => setShowLeaderboard(true)}
            className="w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm border border-white/60 flex items-center justify-center shadow-lg active:scale-95 transition-transform text-xl"
          >
            🏆
          </button>

          {/* ③ 현재 위치로 이동 */}
          <button
            onClick={() => {
              if (!effectivePosition) return;
              setFlyTo({ lat: effectivePosition.lat, lng: effectivePosition.lng, zoom: 18 });
              setTimeout(() => setFlyTo(null), 100);
            }}
            className="w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm border border-white/60 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#F97316">
              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
            </svg>
          </button>

          {/* ④ 메시지 */}
          <button
            onClick={() => setShowChatList(true)}
            className="w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm border border-white/60 flex items-center justify-center shadow-lg active:scale-95 transition-transform text-xl"
          >
            💬
          </button>

          {/* ⑤ 커뮤니티 */}
          <button
            onClick={() => setShowCommunity(true)}
            className="w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm border border-white/60 flex items-center justify-center shadow-lg active:scale-95 transition-transform text-xl"
          >
            📋
          </button>

          {/* ⑥ 강아지 선택 */}
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
              {(petList[activePetIdx]?.name ?? '🐕').slice(0, 2)}
            </button>
            {showDogList && (
              <div className="absolute right-0 top-[52px] flex flex-col gap-1.5">
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
                <button
                  onClick={() => { setShowDogList(false); setAddingPet(true); }}
                  className="w-11 h-11 rounded-full shadow-md text-xl font-bold flex items-center justify-center bg-white/95 backdrop-blur-sm border border-white/60 text-orange-400"
                >+</button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 유저 프로필 팝업 */}
      {userProfile && (
        <UserProfilePopup
          profile={userProfile}
          onClose={() => setUserProfile(null)}
          onMessage={(p) => {
            setUserProfile(null);
            setPendingChatUser({
              userId: p.userId,
              displayName: p.displayName,
              dogName: p.dogName,
              dogBreed: p.dogBreed,
              dogAge: p.dogAge,
              photoUrl: p.photoUrl,
            });
            setShowChatList(true);
          }}
        />
      )}

      {/* 채팅 */}
      {showChatList && idToken && (
        <ChatList
          currentUserId={user.uid}
          idToken={idToken}
          initialChatUser={pendingChatUser ?? undefined}
          onClose={() => { setShowChatList(false); setPendingChatUser(null); }}
        />
      )}

      {/* 커뮤니티 */}
      {showCommunity && idToken && (
        <CommunityPanel
          idToken={idToken}
          currentUserId={user.uid}
          onClose={() => setShowCommunity(false)}
        />
      )}

      {/* 산책 일지 팝업 */}
      {walkSummary && (
        <WalkSummaryModal
          summary={walkSummary}
          onClose={() => setWalkSummary(null)}
        />
      )}

      {/* 랭킹 모달 */}
      {showLeaderboard && idToken && (
        <Leaderboard
          idToken={idToken}
          currentUserId={user.uid}
          currentLat={effectivePosition?.lat}
          currentLng={effectivePosition?.lng}
          initialOpen
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {/* 강아지 추가 모달 (+ 버튼에서 직접 열림) */}
      {addingPet && idToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAddingPet(false)} />
          <div className="relative w-full max-w-xs" style={{ maxHeight: '85vh' }}>
            <PetProfile
              walkSeconds={walkSeconds}
              walkDistance={walkDistance}
              isWalking={isWalking}
              idToken={idToken}
              activePetIdx={activePetIdx}
              reloadTrigger={petReloadTrigger}
              addingPet={true}
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
        </div>
      )}

      {/* 프로필 모달 */}
      {showProfile && idToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowProfile(false)} />
          <div className="relative w-full max-w-xs" style={{ maxHeight: '85vh' }}>
            <PetProfile
              walkSeconds={walkSeconds}
              walkDistance={walkDistance}
              isWalking={isWalking}
              idToken={idToken}
              activePetIdx={activePetIdx}
              reloadTrigger={petReloadTrigger}
              addingPet={false}
              onAddPetDone={(newPets, newIdx) => {
                setPetList(newPets);
                setActivePetIdx(newIdx);
              }}
              onAddPetCancel={() => {}}
              onPetsChange={(pets, idx) => {
                setPetList(pets);
                setActivePetIdx(idx);
              }}
            />
            <button
              onClick={() => setShowProfile(false)}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs hover:bg-gray-200 z-10"
            >✕</button>
          </div>
        </div>
      )}

      {/* 산책일지 모달 */}
      {showWalkLog && <WalkCalendarModal onClose={() => setShowWalkLog(false)} />}

      {/* 로그아웃 확인 */}
      {pendingLogout && (
        <ConfirmDialog
          message="로그아웃 하시겠습니까?"
          confirmLabel="로그아웃"
          onConfirm={() => { setPendingLogout(false); logout(); }}
          onCancel={() => setPendingLogout(false)}
        />
      )}

      {/* 타일 삭제 확인 */}
      {pendingTileDelete && (
        <ConfirmDialog
          message="현재 위치의 타일을 삭제하시겠습니까?"
          confirmLabel="삭제"
          onConfirm={confirmTileDelete}
          onCancel={() => setPendingTileDelete(false)}
        />
      )}

      {/* 설정 모달 */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowSettings(false); setSettingsView('main'); setWithdrawStep(0); }} />
          <div className={`relative w-full ${settingsView === 'terms' ? 'max-w-sm' : 'max-w-xs'} bg-white rounded-3xl shadow-2xl overflow-hidden`}>

            {settingsView === 'main' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-gray-900">설정</h2>
                  <button onClick={() => { setShowSettings(false); setSettingsView('main'); }}
                    className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs">✕</button>
                </div>
                <div className="space-y-2">
                  {[
                    { label: '알림 설정', icon: '🔔', onClick: () => setSettingsView('notifications') },
                    { label: '이용약관', icon: '📄', onClick: () => setSettingsView('terms') },
                  ].map(({ label, icon, onClick }) => (
                    <button key={label} onClick={onClick}
                      className="w-full h-12 rounded-2xl bg-gray-50 flex items-center px-4 gap-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                      <span className="text-base">{icon}</span>
                      <span className="flex-1 text-left">{label}</span>
                      <span className="text-gray-400 text-xs">›</span>
                    </button>
                  ))}
                  <button onClick={() => { setShowSettings(false); setPendingLogout(true); }}
                    className="w-full h-12 rounded-2xl bg-gray-50 flex items-center px-4 gap-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
                    <span className="text-base">🚪</span>
                    <span className="flex-1 text-left">로그아웃</span>
                  </button>
                  <button onClick={() => setSettingsView('withdraw')}
                    className="w-full h-12 rounded-2xl bg-red-50 flex items-center px-4 gap-3 text-sm font-semibold text-red-500 hover:bg-red-100 transition-colors">
                    <span className="text-base">⚠️</span>
                    <span className="flex-1 text-left">회원 탈퇴</span>
                  </button>
                </div>
              </div>
            )}

            {settingsView === 'notifications' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-gray-900">알림 설정</h2>
                  <button onClick={() => setSettingsView('main')} className="text-orange-500 font-bold text-sm">뒤로</button>
                </div>
                <div className="space-y-3">
                  {[
                    { key: 'tileStolen', label: '내 영역 탈취 알림' },
                    { key: 'newComment', label: '댓글 알림' },
                    { key: 'newLike', label: '좋아요 알림' },
                    { key: 'newMessage', label: '새 메시지 알림' },
                    { key: 'decayWarning', label: '영역 만료 경고' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <button
                        onClick={() => {
                          const updated = { ...notifSettings, [key]: !notifSettings[key] };
                          setNotifSettings(updated);
                          localStorage.setItem('notifSettings', JSON.stringify(updated));
                        }}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${notifSettings[key] !== false ? 'bg-orange-400' : 'bg-gray-200'}`}
                      >
                        <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${notifSettings[key] !== false ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {settingsView === 'terms' && (
              <div className="p-6 max-h-[80vh] overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-gray-900">이용약관</h2>
                  <button onClick={() => setSettingsView('main')} className="text-orange-500 font-bold text-sm">뒤로</button>
                </div>
                <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                  <div>
                    <p className="font-bold text-gray-800 mb-1">제1조 (목적)</p>
                    <p>이 약관은 퍼피랜드 서비스(이하 "서비스")의 이용 조건 및 절차, 이용자와 서비스 운영자의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 mb-1">제2조 (서비스 이용)</p>
                    <p>서비스는 반려견과 함께 산책하며 GPS 기반 영역을 점령하는 게임입니다. 이용자는 실제 산책 중에만 서비스를 이용해야 하며, 부정한 방법으로 포인트를 획득해서는 안 됩니다.</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 mb-1">제3조 (개인정보 보호)</p>
                    <p>서비스는 이용자의 GPS 위치 정보를 산책 중에만 수집·이용하며, 개인정보 보호법에 따라 안전하게 관리합니다. 수집된 위치 정보는 타일 점령 계산에만 사용됩니다.</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 mb-1">제4조 (금지 행위)</p>
                    <p>이용자는 다른 이용자를 비방하거나, 허위 정보를 게시하거나, 시스템을 부정하게 조작하는 행위를 해서는 안 됩니다.</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 mb-1">제5조 (면책)</p>
                    <p>서비스는 천재지변, GPS 오류 등 불가피한 사유로 인한 서비스 중단에 대해 책임을 지지 않습니다. 실외 활동 중 발생하는 안전 사고에 대해서도 책임을 지지 않습니다.</p>
                  </div>
                  <p className="text-gray-400 text-xs mt-4">최종 수정일: 2026년 4월 27일</p>
                </div>
              </div>
            )}

            {settingsView === 'withdraw' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-gray-900">회원 탈퇴</h2>
                  <button onClick={() => { setSettingsView('main'); setWithdrawStep(0); }} className="text-orange-500 font-bold text-sm">뒤로</button>
                </div>
                {withdrawStep === 0 ? (
                  <div className="text-center">
                    <p className="text-4xl mb-3">⚠️</p>
                    <p className="text-sm font-bold text-gray-800 mb-2">정말 탈퇴하시겠어요?</p>
                    <p className="text-xs text-gray-500 mb-6 leading-relaxed">탈퇴 시 모든 영역 데이터, 포인트, 산책 기록이 삭제되며 복구할 수 없습니다.</p>
                    <div className="flex gap-2">
                      <button onClick={() => { setSettingsView('main'); setWithdrawStep(0); }}
                        className="flex-1 h-11 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold">
                        취소
                      </button>
                      <button onClick={() => setWithdrawStep(1)}
                        className="flex-1 h-11 rounded-2xl bg-red-500 text-white text-sm font-bold">
                        다음
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-bold text-red-600 mb-2">탈퇴를 최종 확인합니다</p>
                    <p className="text-xs text-gray-500 mb-6">아래 버튼을 누르면 계정이 즉시 삭제됩니다.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setWithdrawStep(0)}
                        className="flex-1 h-11 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold">
                        취소
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            localStorage.clear();
                            await user.delete();
                          } catch {
                            logout();
                          }
                        }}
                        className="flex-1 h-11 rounded-2xl bg-red-500 text-white text-sm font-bold">
                        탈퇴하기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
