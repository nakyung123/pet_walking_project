import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import * as ctrl from '../controllers/communityController';

const router = Router();

// 게시글
router.get('/posts', authMiddleware, ctrl.listPosts);
router.post('/posts', authMiddleware, ctrl.createPost);
router.get('/posts/:id', authMiddleware, ctrl.getPostDetail);
router.delete('/posts/:id', authMiddleware, ctrl.deletePost);

// 좋아요
router.post('/posts/:id/like', authMiddleware, ctrl.toggleLike);

// 댓글
router.get('/posts/:id/comments', authMiddleware, ctrl.listComments);
router.post('/posts/:id/comments', authMiddleware, ctrl.createComment);
router.delete('/posts/:postId/comments/:commentId', authMiddleware, ctrl.deleteComment);

// 신고
router.post('/report', authMiddleware, ctrl.createReport);

export default router;
