import { Router } from 'express';
import markingRouter from './marking';
import tileRouter from './tile';
import userRouter from './user';
import sessionRouter from './session';
import leaderboardRouter from './leaderboard';
import chatRouter from './chat';
import communityRouter from './community';

const router = Router();

router.use('/users', userRouter);
router.use('/marking', markingRouter);
router.use('/tiles', tileRouter);
router.use('/sessions', sessionRouter);
router.use('/leaderboard', leaderboardRouter);
router.use('/chat', chatRouter);
router.use('/community', communityRouter);

export default router;
