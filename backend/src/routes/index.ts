import { Router } from 'express';
import markingRouter from './marking';
import tileRouter from './tile';
import userRouter from './user';

const router = Router();

router.use('/users', userRouter);
router.use('/marking', markingRouter);
router.use('/tiles', tileRouter);

export default router;
