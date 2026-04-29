import { Pool } from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
);

pool.on('connect', () => {
  logger.info('[DB] PostgreSQL 연결 성공');
});

pool.on('error', (err) => {
  logger.error('[DB] 예상치 못한 오류 발생: %s', err.message);
});

export default pool;
