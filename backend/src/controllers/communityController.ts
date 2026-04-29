import { Request, Response } from 'express';
import * as svc from '../services/communityService';
import { PostCategory } from '../types';
import { createNotification } from '../services/notificationService';
import logger from '../utils/logger';
import pool from '../db/pool';
import { AuthRequest } from '../middlewares/authMiddleware';

export async function listPosts(req: Request, res: Response) {
  try {
    const category = (req.query.category as string) || 'all';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const requesterId = (req as AuthRequest).uid;
    const posts = await svc.getPosts(category as PostCategory | 'all', page, requesterId);
    res.json({ success: true, data: posts, error: null });
  } catch (e) {
    logger.error('[Community] 게시글 목록 조회 실패:', e);
    res.status(500).json({ success: false, data: null, error: '게시글 조회 실패' });
  }
}

export async function getPostDetail(req: Request, res: Response) {
  try {
    const requesterId = (req as AuthRequest).uid;
    const post = await svc.getPost(req.params.id, requesterId);
    if (!post) return res.status(404).json({ success: false, data: null, error: '게시글 없음' });
    res.json({ success: true, data: post, error: null });
  } catch (e) {
    logger.error('[Community] 게시글 조회 실패:', e);
    res.status(500).json({ success: false, data: null, error: '게시글 조회 실패' });
  }
}

export async function createPost(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).uid;
    const { category, title, content, imageUrls = [] } = req.body;
    const post = await svc.createPost(userId, { category, title, content, imageUrls });
    res.status(201).json({ success: true, data: post, error: null });
  } catch (e) {
    logger.error('[Community] 게시글 작성 실패:', e);
    res.status(500).json({ success: false, data: null, error: '게시글 작성 실패' });
  }
}

export async function deletePost(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).uid;
    const deleted = await svc.deletePost(req.params.id, userId);
    if (!deleted) return res.status(403).json({ success: false, data: null, error: '권한 없음' });
    res.json({ success: true, data: null, error: null });
  } catch (e) {
    logger.error('[Community] 게시글 삭제 실패:', e);
    res.status(500).json({ success: false, data: null, error: '게시글 삭제 실패' });
  }
}

export async function toggleLike(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).uid;
    const result = await svc.toggleLike(req.params.id, userId);

    if (result.liked) {
      const postRes = await pool.query<{ user_id: string; title: string }>(
        'SELECT user_id, title FROM posts WHERE id = $1',
        [req.params.id],
      );
      const post = postRes.rows[0];
      if (post && post.user_id !== userId) {
        createNotification(
          post.user_id,
          'like_on_post',
          '게시글에 좋아요가 달렸어요!',
          `"${post.title}" 게시글에 좋아요가 달렸어요.`,
          { postId: req.params.id },
        ).catch((err) => logger.error('[communityController] 좋아요 알림 실패:', err));
      }
    }

    res.json({ success: true, data: result, error: null });
  } catch (e) {
    logger.error('[Community] 좋아요 실패:', e);
    res.status(500).json({ success: false, data: null, error: '좋아요 실패' });
  }
}

export async function listComments(req: Request, res: Response) {
  try {
    const comments = await svc.getComments(req.params.id);
    res.json({ success: true, data: comments, error: null });
  } catch (e) {
    logger.error('[Community] 댓글 조회 실패:', e);
    res.status(500).json({ success: false, data: null, error: '댓글 조회 실패' });
  }
}

export async function createComment(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).uid;
    const { parentId, content } = req.body;
    const comment = await svc.createComment(req.params.id, userId, { parentId, content });

    const postRes = await pool.query<{ user_id: string; title: string }>(
      'SELECT user_id, title FROM posts WHERE id = $1',
      [req.params.id],
    );
    const post = postRes.rows[0];
    if (post && post.user_id !== userId) {
      createNotification(
        post.user_id,
        'comment_on_post',
        '게시글에 댓글이 달렸어요!',
        `"${post.title}" 게시글에 새 댓글이 달렸어요.`,
        { postId: req.params.id, commentId: comment.id },
      ).catch((err) => logger.error('[communityController] 댓글 알림 실패:', err));
    }

    res.status(201).json({ success: true, data: comment, error: null });
  } catch (e) {
    logger.error('[Community] 댓글 작성 실패:', e);
    res.status(500).json({ success: false, data: null, error: '댓글 작성 실패' });
  }
}

export async function deleteComment(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).uid;
    const deleted = await svc.deleteComment(req.params.commentId, userId);
    if (!deleted) return res.status(403).json({ success: false, data: null, error: '권한 없음' });
    res.json({ success: true, data: null, error: null });
  } catch (e) {
    logger.error('[Community] 댓글 삭제 실패:', e);
    res.status(500).json({ success: false, data: null, error: '댓글 삭제 실패' });
  }
}

export async function createReport(req: Request, res: Response) {
  try {
    const userId = (req as AuthRequest).uid;
    const { postId, commentId, reason } = req.body;
    if (!postId && !commentId) {
      return res.status(400).json({ success: false, data: null, error: 'postId 또는 commentId 필요' });
    }
    await svc.createReport(userId, postId, commentId, reason);
    res.json({ success: true, data: null, error: null });
  } catch (e) {
    logger.error('[Community] 신고 실패:', e);
    res.status(500).json({ success: false, data: null, error: '신고 실패' });
  }
}
