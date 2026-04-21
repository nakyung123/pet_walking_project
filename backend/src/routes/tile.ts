import { Router } from 'express';
import { getTilesInView, getOccupied, deleteTileAtPosition } from '../controllers/tileController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/occupied', authMiddleware, getOccupied);
router.get('/', authMiddleware, getTilesInView);
router.delete('/', authMiddleware, deleteTileAtPosition);

export default router;
