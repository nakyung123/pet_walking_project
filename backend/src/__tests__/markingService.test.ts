/**
 * markingService 단위 테스트
 * - DB pool을 mock 처리하여 실제 DB 연결 없이 비즈니스 로직을 검증
 */
import { markingService } from '../services/markingService';
import pool from '../db/pool';

// DB pool mock
jest.mock('../db/pool', () => ({
  connect: jest.fn(),
}));

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (pool.connect as jest.Mock).mockResolvedValue(mockClient);
});

describe('markingService', () => {
  it('정상 속도에서 마킹 성공 시 tileId와 newScore를 반환한다', async () => {
    // BEGIN
    mockClient.query.mockResolvedValueOnce({});
    // PostGIS 타일 좌표 계산
    mockClient.query.mockResolvedValueOnce({
      rows: [{ tile_id: '282552_90122', center_lat: 37.479, center_lng: 126.910 }],
    });
    // tiles upsert
    mockClient.query.mockResolvedValueOnce({});
    // tile_visits insert
    mockClient.query.mockResolvedValueOnce({ rows: [{ stay_seconds: 30 }] });
    // tiles update
    mockClient.query.mockResolvedValueOnce({
      rows: [{ occupancy_score: 21, occupant_user_id: 'user-001' }],
    });
    // COMMIT
    mockClient.query.mockResolvedValueOnce({});

    const result = await markingService({
      userId: 'user-001',
      lat: 37.479193,
      lng: 126.910496,
      speed: 5,
      timestamp: new Date().toISOString(),
      sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      enteredAt: new Date().toISOString(),
    });

    expect(result.tileId).toBe('282552_90122');
    expect(result.newScore).toBe(21);
    expect(result.isOccupied).toBe(true);
  });

  it('DB 오류 발생 시 ROLLBACK 후 에러를 던진다', async () => {
    mockClient.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockRejectedValueOnce(new Error('DB 연결 실패')); // 타일 계산 쿼리 실패

    await expect(
      markingService({
        userId: 'user-001',
        lat: 37.479193,
        lng: 126.910496,
        speed: 5,
        timestamp: new Date().toISOString(),
        sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        enteredAt: new Date().toISOString(),
      })
    ).rejects.toThrow('DB 연결 실패');

    // ROLLBACK 호출 확인
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
