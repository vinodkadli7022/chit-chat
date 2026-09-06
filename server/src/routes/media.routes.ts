import { Router } from 'express';
import multer from 'multer';
import { uploadMedia } from '../controllers/media.controller';
import { requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const uploadLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Upload limit reached. Please wait a minute before uploading more files.'
});

router.use(requireAuth);

router.post('/upload', uploadLimiter, upload.single('file'), uploadMedia);

export default router;
