import { Router } from 'express';
import { getMessages, sendMessageRest } from '../controllers/message.controller';
import { requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(requireAuth);

// Message send rate limiter (max 10 messages per 2 seconds per user)
const messageSendLimiter = rateLimiter({
  windowMs: 2000,
  max: 10,
  message: 'You are sending messages too quickly. Please pause for a moment.'
});

router.get('/:conversationId/messages', getMessages);
router.post('/:conversationId/messages', messageSendLimiter, sendMessageRest);

export default router;
