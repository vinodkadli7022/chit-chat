import { Router } from 'express';
import {
  getConversations,
  createOrGetDirectConversation,
  createGroupConversation,
  markAsRead
} from '../controllers/conversation.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', getConversations);
router.post('/direct', createOrGetDirectConversation);
router.post('/group', createGroupConversation);
router.post('/:conversationId/read', markAsRead);

export default router;
