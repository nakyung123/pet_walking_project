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
  return request<{ newScore: number; isOccupied: boolean }>(
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
