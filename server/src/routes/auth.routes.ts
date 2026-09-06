import { Router } from 'express';
import { login, register, getMe, getDemoAccounts, getAllUsers } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Rate limit login and register endpoints
const authLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts. Please try again later.'
});

router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register);
router.get('/me', requireAuth, getMe);
router.get('/demo-accounts', getDemoAccounts);
router.get('/users', requireAuth, getAllUsers);

export default router;
