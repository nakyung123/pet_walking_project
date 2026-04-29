import cron from 'node-cron';
import pool from '../db/pool';
import logger from '../utils/logger';
import { createNotification } from '../services/notificationService';

/** 24시간 미방문 타일의 점수를 매일 00:00에 10% 차감 */
export const startDecayJob = (): void => {
  // 매일 자정 실행 (운영) — 개발 테스트 시 '* * * * *' 으로 변경 가능
  cron.schedule('0 0 * * *', async () => {
    logger.info('[DecayJob] 감쇄 배치 실행 시작');
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
      logger.info(`[DecayJob] 감쇄 완료 — 영향받은 타일: ${affected}개`);
    } catch (err) {
      logger.error('[DecayJob] 감쇄 배치 오류:', (err as Error).message);
    }
  });

  // 매일 20:00 — 감쇄 위험 타일 보유 유저에게 사전 경고
  cron.schedule('0 20 * * *', async () => {
    logger.info('[DecayJob] 감쇄 경고 알림 실행');
    try {
      const result = await pool.query<{ occupant_user_id: string; tile_count: number }>(
        `SELECT occupant_user_id, COUNT(*)::INTEGER AS tile_count
         FROM tiles
         WHERE occupant_user_id IS NOT NULL
           AND last_marked_at IS NOT NULL
           AND last_marked_at < NOW() - INTERVAL '20 hours'
         GROUP BY occupant_user_id`,
      );
      await Promise.all(
        result.rows.map((row) =>
          createNotification(
            row.occupant_user_id,
            'decay_warning',
            '내 영역이 곧 감쇄돼요!',
            `${row.tile_count}개 타일이 산책 부재로 곧 점수가 줄어들어요. 오늘 산책을 나가보세요!`,
            { tileCount: row.tile_count },
          ).catch((err) => logger.error('[DecayJob] 경고 알림 생성 실패:', err)),
        ),
      );
      logger.info(`[DecayJob] 감쇄 경고 발송 완료 — ${result.rows.length}명`);
    } catch (err) {
      logger.error('[DecayJob] 감쇄 경고 알림 오류:', (err as Error).message);
    }
  });

  logger.info('[DecayJob] 감쇄 배치 등록 완료 (매일 00:00 실행, 경고 20:00 실행)');
};
