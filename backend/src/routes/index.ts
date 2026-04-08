import { Router } from 'express';
import markingRouter from './marking';
import tileRouter from './tile';
import userRouter from './user';
import sessionRouter from './session';

const router = Router();

router.use('/users', userRouter);
router.use('/marking', markingRouter);
router.use('/tiles', tileRouter);
router.use('/sessions', sessionRouter);

export default router;
