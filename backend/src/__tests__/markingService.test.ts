import { markingService } from '../services/markingService';
import pool from '../db/pool';

jest.mock('../db/pool', () => ({ connect: jest.fn() }));

const mockClient = { query: jest.fn(), release: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (pool.connect as jest.Mock).mockResolvedValue(mockClient);
});

const baseReq = {
  userId: 'user-001',
  lat: 37.479193,
  lng: 126.910496,
  speed: 5,
  timestamp: new Date().toISOString(),
  sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  enteredAt: new Date(Date.now() - 60_000).toISOString(),
};

const setupMocks = (opts: { staySeconds?: number; prevOccupant?: string | null; finalOccupant?: string; score?: number } = {}) => {
  const { staySeconds = 60, prevOccupant = null, finalOccupant = 'user-001', score = 12 } = opts;
  mockClient.query
    .mockResolvedValueOnce(undefined) // BEGIN
    .mockResolvedValueOnce({ rows: [{ tile_id: '100_200', center_lat: 37.479, center_lng: 126.910 }] }) // tileRes
    .mockResolvedValueOnce(undefined) // upsert
    .mockResolvedValueOnce({ rows: [{ stay_seconds: staySeconds }] }) // tile_visits
    .mockResolvedValueOnce({ rows: [{ occupant_user_id: prevOccupant }] }) // prevRes
    .mockResolvedValueOnce({ rows: [{ occupancy_score: score, occupant_user_id: finalOccupant }] }) // updateRes
    .mockResolvedValueOnce(undefined); // COMMIT
};

describe('markingService', () => {
  it('정상 마킹 시 tileId, newScore, isOccupied를 반환한다', async () => {
    setupMocks();
    const result = await markingService(baseReq);

    expect(result.tileId).toBe('100_200');
    expect(result.newScore).toBe(12);
    expect(result.isOccupied).toBe(true);
    expect(result.prevOccupantUserId).toBeNull();
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  it('체류 시간이 길수록 더 높은 점수를 받는다', async () => {
    setupMocks({ staySeconds: 300, score: 20 });
    const result = await markingService({ ...baseReq });

    expect(result.newScore).toBe(20);
  });

  it('다른 유저 타일 빼앗을 때 prevOccupantUserId가 rival 유저로 설정된다', async () => {
    setupMocks({ prevOccupant: 'rival-001' });
    const result = await markingService(baseReq);

    expect(result.prevOccupantUserId).toBe('rival-001');
    expect(result.isOccupied).toBe(true);
  });

  it('점수 부족으로 점유 실패 시 isOccupied가 false다', async () => {
    setupMocks({ prevOccupant: 'rival-001', finalOccupant: 'rival-001' });
    const result = await markingService(baseReq);

    expect(result.isOccupied).toBe(false);
    expect(result.prevOccupantUserId).toBe('rival-001');
  });

  it('DB 오류 발생 시 ROLLBACK 후 에러를 던진다', async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockRejectedValueOnce(new Error('DB 연결 오류')); // tileRes 실패

    await expect(markingService(baseReq)).rejects.toThrow('DB 연결 오류');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
