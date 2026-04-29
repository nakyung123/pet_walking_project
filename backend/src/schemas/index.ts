import { z } from 'zod';

// ─── 마킹 ─────────────────────────────────────────────────────────────────────
export const markingSchema = z.object({
  lat:       z.number().min(-90).max(90),
  lng:       z.number().min(-180).max(180),
  speed:     z.number().min(0).max(200),
  timestamp: z.iso.datetime(),
  sessionId: z.uuid(),
  enteredAt: z.iso.datetime(),
});

// ─── 산책 세션 ────────────────────────────────────────────────────────────────
export const sessionEndSchema = z.object({
  distanceKm: z.number().min(0).max(1000),
});

// ─── 커뮤니티 게시글 ──────────────────────────────────────────────────────────
export const createPostSchema = z.object({
  category:  z.enum(['walk_log', 'brag', 'other'] as const),
  title:     z.string().min(1, '제목 필수').max(60, '제목은 60자 이하'),
  content:   z.string().min(1, '내용 필수').max(2000, '내용은 2000자 이하'),
  imageUrls: z.array(z.string().min(1)).max(3, '이미지는 최대 3장').default([]),
});

// ─── 댓글 ─────────────────────────────────────────────────────────────────────
export const createCommentSchema = z.object({
  content:  z.string().min(1, '내용 필수').max(500, '댓글은 500자 이하'),
  parentId: z.uuid().optional(),
});

// ─── 사용자 프로필 ────────────────────────────────────────────────────────────
export const upsertProfileSchema = z.object({
  displayName:    z.string().min(1).max(30),
  dogName:        z.string().min(1).max(20),
  dogBreed:       z.string().max(30).optional(),
  dogAge:         z.string().max(10).optional(),
  dogPersonality: z.string().max(50).optional(),
  photoUrl:       z.url().optional().or(z.literal('')),
});
