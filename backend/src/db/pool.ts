import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on('connect', () => {
  console.log('[DB] PostgreSQL 연결 성공');
});

pool.on('error', (err) => {
  console.error('[DB] 예상치 못한 오류 발생:', err.message);
});

export default pool;
