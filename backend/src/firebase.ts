import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (projectId) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    console.log('[Firebase] Admin SDK 초기화 완료');
  } else {
    // 개발 환경에서 Firebase 키가 없을 때 — 인증 미들웨어가 우회 모드로 동작
    console.warn('[Firebase] FIREBASE_PROJECT_ID 미설정 — 개발 모드로 실행 (인증 비활성화)');
  }
}

export default admin;
