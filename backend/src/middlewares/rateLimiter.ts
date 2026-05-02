import rateLimit from 'express-rate-limit';

/** 마킹 API: 1분에 최대 30회 (자동 마킹 고려) */
export const markingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  keyGenerator: (req) => (req as { uid?: string }).uid ?? 'unknown',
});

/** 커뮤니티 게시글 작성: 1분에 최대 5회 */
export const postCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: '게시글은 1분에 최대 5개까지 작성할 수 있습니다.' },
  keyGenerator: (req) => (req as { uid?: string }).uid ?? 'unknown',
});

/** 댓글 작성: 1분에 최대 20회 */
export const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: '댓글은 1분에 최대 20개까지 작성할 수 있습니다.' },
  keyGenerator: (req) => (req as { uid?: string }).uid ?? 'unknown',
});

/** 일반 API 전역 제한: 1분에 최대 10000회 (부하테스트용 임시) */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});
