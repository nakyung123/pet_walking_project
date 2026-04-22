const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type ApiResponse<T> = { success: boolean; data: T; error: string | null };

async function request<T>(
  path: string,
  options?: RequestInit,
  idToken?: string,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} 실패: ${res.status} ${text}`);
  }
  return res.json() as Promise<ApiResponse<T>>;
}

// 타일 목록 조회
export async function getTiles(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  idToken: string,
) {
  const params = new URLSearchParams({
    minLat: String(bounds.minLat),
    maxLat: String(bounds.maxLat),
    minLng: String(bounds.minLng),
    maxLng: String(bounds.maxLng),
  });
  return request<unknown[]>(`/api/tiles?${params}`, undefined, idToken);
}

// 마킹 요청
export async function postMarking(
  payload: {
    userId: string;
    sessionId: string;
    lat: number;
    lng: number;
    speed: number;
    timestamp: string;
    enteredAt: string;
  },
  idToken: string,
) {
  return request<{ newScore: number; isOccupied: boolean; rejectedReason?: string }>(
    '/api/marking',
    { method: 'POST', body: JSON.stringify(payload) },
    idToken,
  );
}

// 세션 시작
export async function startSession(userId: string, idToken: string) {
  return request<{ sessionId: string }>(
    '/api/sessions',
    { method: 'POST', body: JSON.stringify({ userId }) },
    idToken,
  );
}

// 내 점수 조회
export async function getScore(_userId: string, idToken: string) {
  return request<{ totalScore: number }>(`/api/users/me/score`, undefined, idToken);
}

// 점령 타일 전체 조회 (초기 로드용)
export async function getOccupiedTiles(idToken: string) {
  return request<unknown[]>('/api/tiles/occupied', undefined, idToken);
}

// 현재 위치 타일 삭제
export async function deleteTile(lat: number, lng: number, idToken: string) {
  return request<{ tileId: string | null }>(
    '/api/tiles',
    { method: 'DELETE', body: JSON.stringify({ lat, lng }) },
    idToken,
  );
}

// 유저 프로필 조회
export async function getUserProfile(userId: string, idToken: string) {
  return request<UserProfile>(`/api/users/${encodeURIComponent(userId)}/profile`, undefined, idToken);
}

// 내 반려견 프로필 저장
export async function updateMyProfile(
  profile: { dogBreed?: string; dogAge?: string; dogPersonality?: string; photoUrl?: string },
  idToken: string,
) {
  return request<null>('/api/users/me/profile', { method: 'PUT', body: JSON.stringify(profile) }, idToken);
}

// 리더보드 조회
export async function getLeaderboard(idToken: string) {
  return request<LeaderboardData>('/api/leaderboard', undefined, idToken);
}

export interface UserProfile {
  userId: string;
  displayName: string;
  dogName: string;
  dogBreed: string | null;
  dogAge: string | null;
  dogPersonality: string | null;
  photoUrl: string | null;
  totalScore: number;
  tileCount: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  tileCount: number;
  totalScore: number;
}

export interface LeaderboardData {
  byTile: LeaderboardEntry[];
  byScore: LeaderboardEntry[];
}
