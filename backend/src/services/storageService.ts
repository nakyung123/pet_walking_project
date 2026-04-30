import { randomUUID } from 'crypto';
import admin from '../firebase';
import logger from '../utils/logger';

const BUCKET = process.env.FIREBASE_STORAGE_BUCKET;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/gif':  'gif',
  'image/webp': 'webp',
};

/**
 * base64 이미지를 Firebase Storage에 업로드하고 공개 URL을 반환한다.
 * FIREBASE_STORAGE_BUCKET 미설정 시 base64 데이터를 그대로 반환 (개발 폴백).
 */
export async function uploadBase64Image(
  base64Data: string,
  folder = 'community',
): Promise<string> {
  if (!BUCKET) {
    logger.warn('[Storage] FIREBASE_STORAGE_BUCKET 미설정 — base64 원본 사용 (개발 모드)');
    return base64Data;
  }

  const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches) throw new Error('잘못된 base64 이미지 형식');

  const mimeType = matches[1];
  const ext = ALLOWED_MIME[mimeType];
  if (!ext) throw new Error(`허용되지 않는 이미지 형식입니다: ${mimeType}`);

  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.byteLength > MAX_SIZE_BYTES) {
    throw new Error(`이미지 크기는 5MB 이하여야 합니다 (현재: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);
  }
  const fileName = `${folder}/${randomUUID()}.${ext}`;

  const bucket = admin.storage().bucket(BUCKET);
  const file = bucket.file(fileName);

  try {
    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000',
      },
    });
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${BUCKET}/${fileName}`;
    logger.debug('[Storage] 업로드 완료: %s', publicUrl);
    return publicUrl;
  } catch (uploadErr) {
    logger.warn('[Storage] Firebase Storage 업로드 실패, base64 원본 사용:', uploadErr);
    return base64Data;
  }
}
