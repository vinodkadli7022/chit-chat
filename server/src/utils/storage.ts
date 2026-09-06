import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { config } from '../config';

export interface SavedMedia {
  filename: string;
  url: string;
  thumbnailUrl?: string;
  size: number;
  width?: number;
  height?: number;
}

export async function saveMediaFile(
  buffer: Buffer,
  extension: string
): Promise<SavedMedia> {
  // Ensure uploads directory exists
  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }

  const uniqueId = crypto.randomUUID();
  const filename = `${uniqueId}.${extension}`;
  const filePath = path.join(config.uploadDir, filename);

  // Generate a compressed/optimized version while stripping EXIF metadata for privacy
  let finalBuffer = buffer;
  let width: number | undefined;
  let height: number | undefined;

  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    width = metadata.width;
    height = metadata.height;

    // Strips EXIF, auto-rotates by orientation, applies clean compression
    if (extension === 'jpg' || extension === 'jpeg') {
      finalBuffer = await image.rotate().jpeg({ quality: 85 }).toBuffer();
    } else if (extension === 'png') {
      finalBuffer = await image.rotate().png({ compressionLevel: 8 }).toBuffer();
    } else if (extension === 'webp') {
      finalBuffer = await image.rotate().webp({ quality: 85 }).toBuffer();
    }
  } catch (e) {
    // If not processable with sharp (e.g. animated gif), save raw buffer
    finalBuffer = buffer;
  }

  await fs.promises.writeFile(filePath, finalBuffer);

  const url = `/uploads/${filename}`;
  return {
    filename,
    url,
    size: finalBuffer.length,
    width,
    height
  };
}
