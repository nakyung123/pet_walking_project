import { getTiles, postMarking, startSession, getScore } from '@/services/api';

const MOCK_TOKEN = 'test-id-token';

// fetch 전역 mock
global.fetch = jest.fn();

function mockFetch(data: unknown, ok = true, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve({ success: true, data, error: null }),
    text: () => Promise.resolve(JSON.stringify({ success: true, data, error: null })),
  });
}

function mockFetchError(status: number, text: string) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(text),
  });
}

afterEach(() => jest.clearAllMocks());

describe('getTiles', () => {
  it('경계 좌표를 쿼리 파라미터로 전달한다', async () => {
    mockFetch([]);
    const bounds = { minLat: 37.56, maxLat: 37.58, minLng: 126.97, maxLng: 126.99 };
    await getTiles(bounds, MOCK_TOKEN);

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('minLat=37.56');
    expect(url).toContain('maxLat=37.58');
    expect(url).toContain('minLng=126.97');
    expect(url).toContain('maxLng=126.99');
  });

  it('Authorization 헤더에 Bearer 토큰을 포함한다', async () => {
    mockFetch([]);
    await getTiles({ minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 }, MOCK_TOKEN);

    const options = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(options.headers['Authorization']).toBe(`Bearer ${MOCK_TOKEN}`);
  });

  it('서버 에러 시 예외를 던진다', async () => {
    mockFetchError(401, 'Unauthorized');
    await expect(
      getTiles({ minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 }, MOCK_TOKEN),
    ).rejects.toThrow('401');
  });
});

describe('postMarking', () => {
  it('POST 메서드로 마킹 페이로드를 전송한다', async () => {
    mockFetch({ newScore: 100, isOccupied: true });
    const now = new Date().toISOString();
    const payload = { userId: 'u1', sessionId: 's1', lat: 37.56, lng: 126.97, speed: 5, timestamp: now, enteredAt: now };
    await postMarking(payload, MOCK_TOKEN);

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/api/marking');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject(payload);
  });
});

describe('startSession', () => {
  it('idToken만으로 세션을 시작한다 (userId는 서버에서 토큰으로 추출)', async () => {
    mockFetch({ sessionId: 'sess-123' });
    await startSession(MOCK_TOKEN);

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/api/sessions');
    expect(options.method).toBe('POST');
  });
});

describe('getScore', () => {
  it('/api/users/me/score 경로로 점수를 조회한다', async () => {
    mockFetch({ totalScore: 500 });
    await getScore(MOCK_TOKEN);

    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/users/me/score');
  });
});
