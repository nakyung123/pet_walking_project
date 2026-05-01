import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { startConversation, listConversations, listMessages, sendMessage, removeConversation } from '../controllers/chatController';

const router = Router();

router.use(authMiddleware);

router.post('/with/:userId', startConversation);
router.get('/', listConversations);
router.get('/:convId/messages', listMessages);
router.post('/:convId/messages', sendMessage);
router.delete('/:convId', removeConversation);

export default router;
