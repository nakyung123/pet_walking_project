// ========================
// 공통 API 응답 타입
// ========================
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

// ========================
// 도메인 타입 정의
// ========================

/** 지도 위의 50m x 50m 격자 단위 */
export interface Tile {
  tileId: string;
  lat: number;
  lng: number;
  occupantUserId: string | null;
  occupancyScore: number;
}

/** 마킹 요청 페이로드 */
export interface MarkingRequest {
  userId: string;
  lat: number;
  lng: number;
  speed: number; // km/h — 15 이상이면 서버에서 거부
  timestamp: string;
}

/** 마킹 결과 */
export interface MarkingResult {
  tileId: string;
  newScore: number;
  isOccupied: boolean;
  rejectedReason?: string;
}

/** 사용자 */
export interface User {
  userId: string;
  displayName: string;
  dogName: string;
  createdAt: string;
}

/** 산책 세션 */
export interface WalkingSession {
  sessionId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
}

/** 타일 방문 기록 (체류시간 계산용) */
export interface TileVisit {
  visitId: string;
  sessionId: string;
  userId: string;
  tileId: string;
  enteredAt: string;
  exitedAt: string | null;
  /** exitedAt - enteredAt (초 단위), exitedAt이 없으면 null */
  staySeconds: number | null;
}

/** 마킹 요청 (세션 정보 포함) */
export interface MarkingRequestV2 extends MarkingRequest {
  sessionId: string;
  /** 현재 타일에 진입한 시각 (ISO 8601) */
  enteredAt: string;
}

/** 리더보드 항목 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  tileCount: number;
  totalScore: number;
}

/** 리더보드 응답 (타일 수 / 점수 각각 분리) */
export interface LeaderboardData {
  byTile: LeaderboardEntry[];
  byScore: LeaderboardEntry[];
}
