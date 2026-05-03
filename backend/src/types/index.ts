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
  lastMarkedAt: string | null;
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
  photoUrl: string | null;
  tileCount: number;
  totalScore: number;
}

/** 리더보드 응답 (타일 수 / 점수 각각 분리) */
export interface LeaderboardData {
  byTile: LeaderboardEntry[];
  byScore: LeaderboardEntry[];
}

/** 유저 프로필 (다른 유저 조회 포함) */
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

// ========================
// 커뮤니티 타입
// ========================

export type PostCategory = 'walk_log' | 'brag' | 'other';

export interface PostImage {
  id: string;
  postId: string;
  url: string;
  orderIndex: number;
}

export interface Post {
  id: string;
  userId: string;
  displayName: string;
  photoUrl: string | null;
  category: PostCategory;
  title: string;
  content: string;
  images: PostImage[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  userId: string;
  displayName: string;
  photoUrl: string | null;
  content: string;
  depth: number;
  replies: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostInput {
  category: PostCategory;
  title: string;
  content: string;
  imageUrls: string[];
}

export interface CreateCommentInput {
  parentId?: string;
  content: string;
}

export interface ReportInput {
  postId?: string;
  commentId?: string;
  reason?: string;
}

// ========================
// 알림 타입
// ========================

export type NotificationType =
  | 'tile_stolen'
  | 'comment_on_post'
  | 'like_on_post'
  | 'new_chat_message'
  | 'decay_warning'
  | 'mission_complete'
  | 'badge_earned';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface MarkingResultV2 extends MarkingResult {
  prevOccupantUserId: string | null;
}
