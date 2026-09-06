import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { validateImageMagicBytes } from '../utils/fileValidation';
import { detectNudity } from '../moderation/nudity';
import { saveMediaFile } from '../utils/storage';

export async function uploadMedia(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }

    // Step 1: Magic Byte & MIME Type Verification (Do not trust client header)
    const magicCheck = validateImageMagicBytes(file.buffer);
    if (!magicCheck.isValid) {
      res.status(400).json({
        error: 'INVALID_FILE_TYPE',
        message: magicCheck.error || 'Invalid file format.'
      });
      return;
    }

    // Step 2: Server-Side Nudity / Explicit Content Moderation
    const moderation = await detectNudity(file.buffer, file.originalname);
    if (!moderation.isSafe) {
      res.status(422).json({
        error: 'MODERATION_REJECTED',
        message: moderation.reason,
        score: moderation.score,
        threshold: moderation.threshold,
        details: moderation.details
      });
      return;
    }

    // Step 3: Safe Storage (Strips EXIF metadata, saves to disk/object storage)
    const saved = await saveMediaFile(file.buffer, magicCheck.extension);

    res.status(201).json({
      url: saved.url,
      filename: saved.filename,
      size: saved.size,
      width: saved.width,
      height: saved.height,
      moderation: {
        status: 'APPROVED',
        score: moderation.score,
        model: moderation.details.model,
        latencyMs: moderation.details.inferenceTimeMs
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process media upload', details: error.message });
  }
}
