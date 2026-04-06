import cron from 'node-cron';
import pool from '../db/pool';

/** 24시간 미방문 타일의 점수를 매일 00:00에 10% 차감 */
export const startDecayJob = (): void => {
  // 매일 자정 실행 (운영) — 개발 테스트 시 '* * * * *' 으로 변경 가능
  cron.schedule('0 0 * * *', async () => {
    console.log('[DecayJob] 감쇄 배치 실행 시작');
    try {
      const result = await pool.query<{ affected: string }>(
        `WITH decayed AS (
          UPDATE tiles
          SET
            occupancy_score = GREATEST(0, FLOOR(occupancy_score * 0.9)::INTEGER),
            occupant_user_id = CASE
              WHEN FLOOR(occupancy_score * 0.9) = 0 THEN NULL
              ELSE occupant_user_id
            END,
            updated_at = NOW()
          WHERE
            last_marked_at IS NOT NULL
            AND last_marked_at < NOW() - INTERVAL '24 hours'
          RETURNING tile_id
        )
        SELECT COUNT(*) AS affected FROM decayed`
      );
      const affected = result.rows[0]?.affected ?? '0';
      console.log(`[DecayJob] 감쇄 완료 — 영향받은 타일: ${affected}개`);
    } catch (err) {
      console.error('[DecayJob] 감쇄 배치 오류:', (err as Error).message);
    }
  });

  console.log('[DecayJob] 감쇄 배치 등록 완료 (매일 00:00 실행)');
};
