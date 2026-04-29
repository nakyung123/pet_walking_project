import * as notifService from '../services/notificationService';
import pool from '../db/pool';

jest.mock('../db/pool', () => ({ query: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('notificationService.createNotification', () => {
  it('알림을 DB에 INSERT한다', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await notifService.createNotification(
      'user-001',
      'tile_stolen',
      '타일 빼앗김',
      '누군가 내 타일을 점령했어요!',
      { tileId: '100_200' },
    );

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notifications'),
      ['user-001', 'tile_stolen', '타일 빼앗김', '누군가 내 타일을 점령했어요!', { tileId: '100_200' }],
    );
  });
});

describe('notificationService.getUnreadCount', () => {
  it('읽지 않은 알림 수를 반환한다', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '3' }] });

    const count = await notifService.getUnreadCount('user-001');
    expect(count).toBe(3);
  });

  it('알림이 없을 때 0을 반환한다', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const count = await notifService.getUnreadCount('user-001');
    expect(count).toBe(0);
  });
});

describe('notificationService.markAllRead', () => {
  it('해당 유저의 모든 알림을 읽음 처리한다', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 5 });

    await notifService.markAllRead('user-001');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE notifications SET is_read = true'),
      ['user-001'],
    );
  });
});

describe('notificationService.getNotifications', () => {
  it('알림 목록을 camelCase로 변환해 반환한다', async () => {
    const now = new Date().toISOString();
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{
        id: 'notif-uuid',
        user_id: 'user-001',
        type: 'tile_stolen',
        title: '타일 빼앗김',
        message: '누군가 내 타일을 점령했어요!',
        is_read: false,
        metadata: { tileId: '100_200' },
        created_at: now,
      }],
    });

    const result = await notifService.getNotifications('user-001');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'notif-uuid',
      userId: 'user-001',
      type: 'tile_stolen',
      isRead: false,
    });
  });
});
