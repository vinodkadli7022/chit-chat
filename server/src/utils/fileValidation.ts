/**
 * Secure File Magic-Byte / MIME Type Verification
 * Does NOT trust file extensions or HTTP Content-Type headers alone.
 */

export interface FileValidationResult {
  isValid: boolean;
  mimeType: string;
  extension: string;
  error?: string;
}

export function validateImageMagicBytes(buffer: Buffer): FileValidationResult {
  if (!buffer || buffer.length < 12) {
    return { isValid: false, mimeType: 'unknown', extension: '', error: 'File buffer too small or empty.' };
  }

  // Check JPEG (FF D8 FF)
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { isValid: true, mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // Check PNG (89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { isValid: true, mimeType: 'image/png', extension: 'png' };
  }

  // Check GIF (47 49 46 38)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return { isValid: true, mimeType: 'image/gif', extension: 'gif' };
  }

  // Check WebP (RIFF .... WEBP)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { isValid: true, mimeType: 'image/webp', extension: 'webp' };
  }

  return {
    isValid: false,
    mimeType: 'unknown',
    extension: '',
    error: 'Invalid file signature. Only authentic JPEG, PNG, GIF, and WebP images are permitted.'
  };
}
