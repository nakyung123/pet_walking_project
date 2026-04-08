/**
 * API 엔드포인트 통합 테스트
 * - Firebase auth middleware를 mock 처리하여 인증 없이 테스트
 */
import request from 'supertest';
import app from '../index';

// Firebase admin mock
jest.mock('../firebase', () => ({
  auth: () => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-user-001' }),
  }),
}));

// DB pool mock
jest.mock('../db/pool', () => ({
  connect: jest.fn(),
  query: jest.fn(),
}));

import pool from '../db/pool';

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (pool.connect as jest.Mock).mockResolvedValue(mockClient);
});

describe('GET /health', () => {
  it('서버 상태를 반환한다', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });
});

describe('POST /api/marking', () => {
  it('속도가 15km/h 이상이면 400을 반환한다', async () => {
    const res = await request(app)
      .post('/api/marking')
      .set('Authorization', 'Bearer test-token')
      .send({
        lat: 37.479193,
        lng: 126.910496,
        speed: 20,
        timestamp: new Date().toISOString(),
        sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        enteredAt: new Date().toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/users/me/score', () => {
  it('사용자 점수를 반환한다', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ total_score: '150', tile_count: '3' }],
    });

    const res = await request(app)
      .get('/api/users/me/score')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalScore');
    expect(res.body.data).toHaveProperty('tileCount');
  });
});
