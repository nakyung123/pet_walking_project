import pool from '../db/pool';
import { User } from '../types';

/**
 * 사용자 등록 또는 조회 (upsert)
 * 최초 로그인 시 users 테이블에 삽입, 이미 존재하면 그대로 반환
 */
export const upsertUser = async (
  userId: string,
  displayName: string,
  dogName: string
): Promise<User> => {
  const result = await pool.query<{
    user_id: string;
    display_name: string;
    dog_name: string;
    created_at: string;
  }>(
    `INSERT INTO users (user_id, display_name, dog_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           dog_name = EXCLUDED.dog_name
     RETURNING user_id, display_name, dog_name, created_at`,
    [userId, displayName, dogName]
  );

  const row = result.rows[0];
  console.log('[userService] upsert 완료:', row.user_id);

  return {
    userId: row.user_id,
    displayName: row.display_name,
    dogName: row.dog_name,
    createdAt: row.created_at,
  };
};
