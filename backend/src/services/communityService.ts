import pool from '../db/pool';
import { Post, Comment, CreatePostInput, CreateCommentInput, PostCategory } from '../types';
import { uploadBase64Image } from './storageService';

const POST_LIMIT = 20;

// ─── 게시글 목록 조회 ────────────────────────────────────────────────────────
export async function getPosts(
  category: PostCategory | 'all',
  page: number,
  requesterId: string,
): Promise<Post[]> {
  const offset = (page - 1) * POST_LIMIT;
  const params: unknown[] = [POST_LIMIT, offset, requesterId];
  const categoryClause = category !== 'all' ? `AND p.category = $4` : '';
  if (category !== 'all') params.push(category);

  const { rows } = await pool.query(
    `SELECT
       p.id, p.user_id, u.display_name, u.photo_url,
       p.category, p.title, p.content,
       p.like_count, p.comment_count,
       p.created_at, p.updated_at,
       EXISTS (
         SELECT 1 FROM post_likes pl
         WHERE pl.post_id = p.id AND pl.user_id = $3
       ) AS liked_by_me,
       COALESCE(
         json_agg(pi ORDER BY pi.order_index) FILTER (WHERE pi.id IS NOT NULL),
         '[]'
       ) AS images
     FROM posts p
     JOIN users u ON u.user_id = p.user_id
     LEFT JOIN post_images pi ON pi.post_id = p.id
     WHERE 1=1 ${categoryClause}
     GROUP BY p.id, u.display_name, u.photo_url
     ORDER BY p.created_at DESC
     LIMIT $1 OFFSET $2`,
    params,
  );
  return rows.map(mapPost);
}

// ─── 게시글 단건 조회 ─────────────────────────────────────────────────────────
export async function getPost(postId: string, requesterId: string): Promise<Post | null> {
  const { rows } = await pool.query(
    `SELECT
       p.id, p.user_id, u.display_name, u.photo_url,
       p.category, p.title, p.content,
       p.like_count, p.comment_count,
       p.created_at, p.updated_at,
       EXISTS (
         SELECT 1 FROM post_likes pl
         WHERE pl.post_id = p.id AND pl.user_id = $2
       ) AS liked_by_me,
       COALESCE(
         json_agg(pi ORDER BY pi.order_index) FILTER (WHERE pi.id IS NOT NULL),
         '[]'
       ) AS images
     FROM posts p
     JOIN users u ON u.user_id = p.user_id
     LEFT JOIN post_images pi ON pi.post_id = p.id
     WHERE p.id = $1
     GROUP BY p.id, u.display_name, u.photo_url`,
    [postId, requesterId],
  );
  return rows.length ? mapPost(rows[0]) : null;
}

// ─── 게시글 작성 ─────────────────────────────────────────────────────────────
export async function createPost(userId: string, input: CreatePostInput): Promise<Post> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO posts (user_id, category, title, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, input.category, input.title, input.content],
    );
    const post = rows[0];

    for (let i = 0; i < Math.min(input.imageUrls.length, 3); i++) {
      const url = input.imageUrls[i].startsWith('data:')
        ? await uploadBase64Image(input.imageUrls[i])
        : input.imageUrls[i];
      await client.query(
        `INSERT INTO post_images (post_id, url, order_index) VALUES ($1, $2, $3)`,
        [post.id, url, i],
      );
    }

    await client.query('COMMIT');
    const created = await getPost(post.id, userId);
    return created!;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ─── 게시글 삭제 ─────────────────────────────────────────────────────────────
export async function deletePost(postId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM posts WHERE id = $1 AND user_id = $2`,
    [postId, userId],
  );
  return (rowCount ?? 0) > 0;
}

// ─── 좋아요 토글 ─────────────────────────────────────────────────────────────
export async function toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
  const { rowCount: deleted } = await pool.query(
    `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`,
    [postId, userId],
  );
  const liked = (deleted ?? 0) === 0;
  if (liked) {
    await pool.query(
      `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [postId, userId],
    );
  }
  const { rows } = await pool.query(
    `UPDATE posts SET like_count = GREATEST(0, like_count + $2) WHERE id = $1 RETURNING like_count`,
    [postId, liked ? 1 : -1],
  );
  return { liked, likeCount: rows[0]?.like_count ?? 0 };
}

// ─── 댓글 목록 조회 (트리 구조 변환) ───────────────────────────────────────────
export async function getComments(postId: string): Promise<Comment[]> {
  const { rows } = await pool.query(
    `SELECT c.id, c.post_id, c.parent_id, c.user_id,
            u.display_name, u.photo_url,
            c.content, c.depth, c.created_at, c.updated_at
     FROM comments c
     JOIN users u ON u.user_id = c.user_id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC`,
    [postId],
  );

  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  rows.forEach((r) => {
    map.set(r.id, mapComment(r));
  });

  map.forEach((comment) => {
    if (comment.parentId) {
      const parent = map.get(comment.parentId);
      if (parent) parent.replies.push(comment);
    } else {
      roots.push(comment);
    }
  });

  return roots;
}

// ─── 댓글 작성 ───────────────────────────────────────────────────────────────
export async function createComment(
  postId: string,
  userId: string,
  input: CreateCommentInput,
): Promise<Comment> {
  let depth = 0;
  if (input.parentId) {
    const { rows } = await pool.query(`SELECT depth FROM comments WHERE id = $1`, [input.parentId]);
    if (rows.length) depth = rows[0].depth + 1;
  }

  const { rows } = await pool.query(
    `INSERT INTO comments (post_id, parent_id, user_id, content, depth)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [postId, input.parentId ?? null, userId, input.content, depth],
  );

  await pool.query(`UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1`, [postId]);

  const { rows: userRows } = await pool.query(
    `SELECT display_name, photo_url FROM users WHERE user_id = $1`,
    [userId],
  );

  return mapComment({ ...rows[0], display_name: userRows[0].display_name, photo_url: userRows[0].photo_url });
}

// ─── 댓글 삭제 ───────────────────────────────────────────────────────────────
export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT post_id FROM comments WHERE id = $1 AND user_id = $2`, [commentId, userId]);
  if (!rows.length) return false;

  await pool.query(`DELETE FROM comments WHERE id = $1`, [commentId]);
  await pool.query(`UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = $1`, [rows[0].post_id]);
  return true;
}

// ─── 신고 ────────────────────────────────────────────────────────────────────
export async function createReport(
  reporterId: string,
  postId: string | undefined,
  commentId: string | undefined,
  reason: string | undefined,
): Promise<void> {
  await pool.query(
    `INSERT INTO reports (reporter_id, post_id, comment_id, reason) VALUES ($1, $2, $3, $4)`,
    [reporterId, postId ?? null, commentId ?? null, reason ?? null],
  );
}

// ─── 매핑 헬퍼 ───────────────────────────────────────────────────────────────
function mapPost(r: Record<string, unknown>): Post {
  const images = Array.isArray(r.images) ? r.images : [];
  return {
    id: r.id as string,
    userId: r.user_id as string,
    displayName: r.display_name as string,
    photoUrl: (r.photo_url as string) ?? null,
    category: r.category as PostCategory,
    title: r.title as string,
    content: r.content as string,
    images: images.map((img: Record<string, unknown>) => ({
      id: img.id as string,
      postId: img.post_id as string,
      url: img.url as string,
      orderIndex: img.order_index as number,
    })),
    likeCount: Number(r.like_count),
    commentCount: Number(r.comment_count),
    likedByMe: Boolean(r.liked_by_me),
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}

function mapComment(r: Record<string, unknown>): Comment {
  return {
    id: r.id as string,
    postId: r.post_id as string,
    parentId: (r.parent_id as string) ?? null,
    userId: r.user_id as string,
    displayName: r.display_name as string,
    photoUrl: (r.photo_url as string) ?? null,
    content: r.content as string,
    depth: Number(r.depth),
    replies: [],
    createdAt: (r.created_at as Date).toISOString(),
    updatedAt: (r.updated_at as Date).toISOString(),
  };
}
