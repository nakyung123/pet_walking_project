import * as communityService from '../services/communityService';
import pool from '../db/pool';

jest.mock('../db/pool', () => ({ connect: jest.fn(), query: jest.fn() }));
jest.mock('../services/storageService', () => ({
  uploadBase64Image: jest.fn().mockResolvedValue('https://example.com/image.jpg'),
}));

const mockClient = { query: jest.fn(), release: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (pool.connect as jest.Mock).mockResolvedValue(mockClient);
});

const mockPostRow = {
  id: 'post-uuid',
  user_id: 'user-001',
  display_name: '테스터',
  photo_url: null,
  category: 'brag',
  title: '자랑이요',
  content: '산책 갔다왔어요',
  like_count: 0,
  comment_count: 0,
  liked_by_me: false,
  images: [],
  created_at: new Date(),
  updated_at: new Date(),
};

describe('communityService.toggleLike', () => {
  it('좋아요 없을 때 누르면 liked: true, likeCount가 증가한다', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] }) // SELECT 기존 좋아요 없음
      .mockResolvedValueOnce(undefined) // INSERT post_likes
      .mockResolvedValueOnce(undefined) // UPDATE like_count + 1
      .mockResolvedValueOnce({ rows: [{ like_count: 1 }] }); // SELECT like_count

    const result = await communityService.toggleLike('post-uuid', 'user-001');

    expect(result.liked).toBe(true);
    expect(result.likeCount).toBe(1);
  });

  it('이미 좋아요 눌렀을 때 다시 누르면 liked: false (토글)', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ 1: 1 }] }) // SELECT 기존 좋아요 있음
      .mockResolvedValueOnce(undefined) // DELETE post_likes
      .mockResolvedValueOnce(undefined) // UPDATE like_count - 1
      .mockResolvedValueOnce({ rows: [{ like_count: 0 }] });

    const result = await communityService.toggleLike('post-uuid', 'user-001');

    expect(result.liked).toBe(false);
    expect(result.likeCount).toBe(0);
  });
});

describe('communityService.deletePost', () => {
  it('본인 게시글 삭제 시 true 반환', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });

    const result = await communityService.deletePost('post-uuid', 'user-001');
    expect(result).toBe(true);
  });

  it('다른 사람 게시글 삭제 시 false 반환', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 0 });

    const result = await communityService.deletePost('post-uuid', 'user-999');
    expect(result).toBe(false);
  });
});

describe('communityService.deleteComment', () => {
  it('본인 댓글 삭제 시 comment_count 감소 후 true 반환', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ post_id: 'post-uuid' }] }) // SELECT 본인 확인
      .mockResolvedValueOnce(undefined) // DELETE
      .mockResolvedValueOnce(undefined); // UPDATE comment_count

    const result = await communityService.deleteComment('comment-uuid', 'user-001');
    expect(result).toBe(true);
  });

  it('본인이 아닌 댓글 삭제 시 false 반환', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] }); // 본인 아님

    const result = await communityService.deleteComment('comment-uuid', 'user-999');
    expect(result).toBe(false);
  });
});

describe('communityService.createPost', () => {
  it('게시글 작성 시 이미지가 Storage에 업로드되고 URL이 저장된다', async () => {
    const { uploadBase64Image } = await import('../services/storageService');

    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [mockPostRow] }) // INSERT post
      .mockResolvedValueOnce(undefined) // INSERT post_images
      .mockResolvedValueOnce(undefined); // COMMIT

    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockPostRow] }); // getPost

    await communityService.createPost('user-001', {
      category: 'brag',
      title: '자랑',
      content: '내용',
      imageUrls: ['data:image/jpeg;base64,/9j/abc123'],
    });

    expect(uploadBase64Image).toHaveBeenCalledWith('data:image/jpeg;base64,/9j/abc123');
  });
});
