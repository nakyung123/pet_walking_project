import pool from '../db/pool';
import { Notification, NotificationType } from '../types';

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, message, metadata ?? null],
  );
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const result = await pool.query<{
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    is_read: boolean;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>(
    `SELECT id, user_id, type, title, message, is_read, metadata, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
    [userId],
  );
  return parseInt(result.rows[0].count, 10);
}

export async function markAllRead(userId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [userId],
  );
}

export async function markOneRead(id: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
}

export async function markChatNotificationsRead(userId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET is_read = true
     WHERE user_id = $1 AND type = 'new_chat_message' AND is_read = false`,
    [userId],
  );
}

export async function markConversationNotificationsRead(userId: string, convId: string): Promise<void> {
  await pool.query(
    `UPDATE notifications SET is_read = true
     WHERE user_id = $1 AND type = 'new_chat_message' AND is_read = false
       AND metadata->>'conversationId' = $2`,
    [userId, convId],
  );
}

export async function deleteNotification(id: string, userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
}
