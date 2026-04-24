import { Request, Response } from 'express';
import * as svc from '../services/communityService';
import { PostCategory } from '../types';

export async function listPosts(req: Request, res: Response) {
  try {
    const category = (req.query.category as string) || 'all';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const requesterId = (req as Request & { userId?: string }).userId ?? '';
    const posts = await svc.getPosts(category as PostCategory | 'all', page, requesterId);
    res.json({ success: true, data: posts, error: null });
  } catch (e) {
    console.error('[Community] 게시글 목록 조회 실패:', e);
    res.status(500).json({ success: false, data: null, error: '게시글 조회 실패' });
  }
}

export async function getPostDetail(req: Request, res: Response) {
  try {
    const requesterId = (req as Request & { userId?: string }).userId ?? '';
    const post = await svc.getPost(req.params.id, requesterId);
    if (!post) return res.status(404).json({ success: false, data: null, error: '게시글 없음' });
    res.json({ success: true, data: post, error: null });
  } catch (e) {
    console.error('[Community] 게시글 조회 실패:', e);
    res.status(500).json({ success: false, data: null, error: '게시글 조회 실패' });
  }
}

export async function createPost(req: Request, res: Response) {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ success: false, data: null, error: '인증 필요' });
    const { category, title, content, imageUrls = [] } = req.body;
    if (!category || !title || !content) {
      return res.status(400).json({ success: false, data: null, error: '필수 항목 누락' });
    }
    const post = await svc.createPost(userId, { category, title, content, imageUrls });
    res.status(201).json({ success: true, data: post, error: null });
  } catch (e) {
    console.error('[Community] 게시글 작성 실패:', e);
    res.status(500).json({ success: false, data: null, error: '게시글 작성 실패' });
  }
}

export async function deletePost(req: Request, res: Response) {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ success: false, data: null, error: '인증 필요' });
    const deleted = await svc.deletePost(req.params.id, userId);
    if (!deleted) return res.status(403).json({ success: false, data: null, error: '권한 없음' });
    res.json({ success: true, data: null, error: null });
  } catch (e) {
    console.error('[Community] 게시글 삭제 실패:', e);
    res.status(500).json({ success: false, data: null, error: '게시글 삭제 실패' });
  }
}

export async function toggleLike(req: Request, res: Response) {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ success: false, data: null, error: '인증 필요' });
    const result = await svc.toggleLike(req.params.id, userId);
    res.json({ success: true, data: result, error: null });
  } catch (e) {
    console.error('[Community] 좋아요 실패:', e);
    res.status(500).json({ success: false, data: null, error: '좋아요 실패' });
  }
}

export async function listComments(req: Request, res: Response) {
  try {
    const comments = await svc.getComments(req.params.id);
    res.json({ success: true, data: comments, error: null });
  } catch (e) {
    console.error('[Community] 댓글 조회 실패:', e);
    res.status(500).json({ success: false, data: null, error: '댓글 조회 실패' });
  }
}

export async function createComment(req: Request, res: Response) {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ success: false, data: null, error: '인증 필요' });
    const { parentId, content } = req.body;
    if (!content) return res.status(400).json({ success: false, data: null, error: '내용 필요' });
    const comment = await svc.createComment(req.params.id, userId, { parentId, content });
    res.status(201).json({ success: true, data: comment, error: null });
  } catch (e) {
    console.error('[Community] 댓글 작성 실패:', e);
    res.status(500).json({ success: false, data: null, error: '댓글 작성 실패' });
  }
}

export async function deleteComment(req: Request, res: Response) {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ success: false, data: null, error: '인증 필요' });
    const deleted = await svc.deleteComment(req.params.commentId, userId);
    if (!deleted) return res.status(403).json({ success: false, data: null, error: '권한 없음' });
    res.json({ success: true, data: null, error: null });
  } catch (e) {
    console.error('[Community] 댓글 삭제 실패:', e);
    res.status(500).json({ success: false, data: null, error: '댓글 삭제 실패' });
  }
}

export async function createReport(req: Request, res: Response) {
  try {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ success: false, data: null, error: '인증 필요' });
    const { postId, commentId, reason } = req.body;
    if (!postId && !commentId) {
      return res.status(400).json({ success: false, data: null, error: 'postId 또는 commentId 필요' });
    }
    await svc.createReport(userId, postId, commentId, reason);
    res.json({ success: true, data: null, error: null });
  } catch (e) {
    console.error('[Community] 신고 실패:', e);
    res.status(500).json({ success: false, data: null, error: '신고 실패' });
  }
}
