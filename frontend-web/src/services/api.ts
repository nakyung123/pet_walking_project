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
  return request<{ tileId: string; newScore: number; isOccupied: boolean; rejectedReason?: string }>(
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

// ─── 채팅 ────────────────────────────────────────────────

export interface ChatMessage {
  id: number;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  otherUserId: string;
  otherDisplayName: string;
  otherDogName: string;
  otherDogBreed: string | null;
  otherDogAge: string | null;
  otherPhotoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

export async function startConversation(otherUserId: string, idToken: string) {
  return request<{ conversationId: string }>(
    `/api/chat/with/${encodeURIComponent(otherUserId)}`,
    { method: 'POST' },
    idToken,
  );
}

export async function getConversations(idToken: string) {
  return request<ConversationSummary[]>('/api/chat', undefined, idToken);
}

export async function getConversationMessages(convId: string, idToken: string) {
  return request<ChatMessage[]>(`/api/chat/${encodeURIComponent(convId)}/messages`, undefined, idToken);
}

export async function sendChatMessage(convId: string, text: string, idToken: string) {
  return request<ChatMessage>(
    `/api/chat/${encodeURIComponent(convId)}/messages`,
    { method: 'POST', body: JSON.stringify({ text }) },
    idToken,
  );
}

// ─── 커뮤니티 ────────────────────────────────────────────────

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

export async function getPosts(category: PostCategory | 'all', page: number, idToken: string) {
  return request<Post[]>(`/api/community/posts?category=${category}&page=${page}`, undefined, idToken);
}

export async function getPostDetail(postId: string, idToken: string) {
  return request<Post>(`/api/community/posts/${postId}`, undefined, idToken);
}

export async function createPost(
  data: { category: PostCategory; title: string; content: string; imageUrls: string[] },
  idToken: string,
) {
  return request<Post>(
    '/api/community/posts',
    { method: 'POST', body: JSON.stringify(data) },
    idToken,
  );
}

export async function deletePost(postId: string, idToken: string) {
  return request<null>(`/api/community/posts/${postId}`, { method: 'DELETE' }, idToken);
}

export async function toggleLike(postId: string, idToken: string) {
  return request<{ liked: boolean; likeCount: number }>(
    `/api/community/posts/${postId}/like`,
    { method: 'POST' },
    idToken,
  );
}

export async function getComments(postId: string, idToken: string) {
  return request<Comment[]>(`/api/community/posts/${postId}/comments`, undefined, idToken);
}

export async function createComment(
  postId: string,
  data: { parentId?: string; content: string },
  idToken: string,
) {
  return request<Comment>(
    `/api/community/posts/${postId}/comments`,
    { method: 'POST', body: JSON.stringify(data) },
    idToken,
  );
}

export async function deleteComment(postId: string, commentId: string, idToken: string) {
  return request<null>(
    `/api/community/posts/${postId}/comments/${commentId}`,
    { method: 'DELETE' },
    idToken,
  );
}

export async function reportContent(
  data: { postId?: string; commentId?: string; reason?: string },
  idToken: string,
) {
  return request<null>(
    '/api/community/report',
    { method: 'POST', body: JSON.stringify(data) },
    idToken,
  );
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
