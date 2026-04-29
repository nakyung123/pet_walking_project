/**
 * 서버 시작 시 필수 환경 변수를 검증한다.
 * 누락된 변수가 있으면 즉시 프로세스를 종료해 조용한 실패를 방지한다.
 */

const REQUIRED_VARS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
] as const;

const OPTIONAL_VARS = [
  'PORT',
  'NODE_ENV',
  'DATABASE_URL',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'FIREBASE_STORAGE_BUCKET',
] as const;

export type EnvConfig = {
  [K in typeof REQUIRED_VARS[number]]: string;
} & {
  [K in typeof OPTIONAL_VARS[number]]?: string;
};

export function validateEnv(): EnvConfig {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('[Env] 필수 환경 변수 누락:', missing.join(', '));
    console.error('[Env] .env 파일을 확인하세요.');
    process.exit(1);
  }

  return process.env as unknown as EnvConfig;
}

export const env = process.env.NODE_ENV === 'test'
  ? (process.env as unknown as EnvConfig)
  : validateEnv();
