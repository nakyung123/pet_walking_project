import pool from '../db/pool';

export interface ChatMessage {
  id: number;
  conversationId: string;
  senderId: string;
  text: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  otherUserId: string;
  otherDisplayName: string;
  otherDogName: string;
  otherDogBreed: string | null;
  otherDogAge: string | null;
  otherPhotoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isOtherDeleted: boolean;
}

function makeConvId(a: string, b: string): string {
  return [a, b].sort().join('__');
}

export async function getOrCreateConversation(myId: string, otherId: string): Promise<string> {
  const convId = makeConvId(myId, otherId);
  const [uid1, uid2] = [myId, otherId].sort();
  await pool.query(
    `INSERT INTO conversations (id, user_id_1, user_id_2)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [convId, uid1, uid2],
  );
  return convId;
}

export async function getConversations(myId: string): Promise<ConversationSummary[]> {
  const result = await pool.query<{
    id: string;
    other_user_id: string;
    other_display_name: string;
    other_dog_name: string;
    other_dog_breed: string | null;
    other_dog_age: string | null;
    other_photo_url: string | null;
    last_message: string | null;
    last_message_at: string | null;
    unread_count: string;
    is_other_deleted: boolean;
  }>(
    `SELECT
       c.id,
       COALESCE(u.user_id, CASE WHEN c.user_id_1 = $1 THEN c.user_id_2 ELSE c.user_id_1 END) AS other_user_id,
       COALESCE(u.display_name, '탈퇴한 유저')  AS other_display_name,
       COALESCE(u.dog_name, '')                   AS other_dog_name,
       u.dog_breed                                AS other_dog_breed,
       u.dog_age                                  AS other_dog_age,
       u.photo_url                                AS other_photo_url,
       m.text                                     AS last_message,
       m.created_at                               AS last_message_at,
       COALESCE((
         SELECT COUNT(*) FROM notifications n
         WHERE n.user_id = $1
           AND n.type = 'new_chat_message'
           AND n.is_read = false
           AND n.metadata->>'conversationId' = c.id
       ), 0) AS unread_count,
       COALESCE(u.is_deleted, true) AS is_other_deleted
     FROM conversations c
     LEFT JOIN users u ON u.user_id = CASE WHEN c.user_id_1 = $1 THEN c.user_id_2 ELSE c.user_id_1 END
     LEFT JOIN LATERAL (
       SELECT text, created_at FROM messages
       WHERE conversation_id = c.id
       ORDER BY created_at DESC LIMIT 1
     ) m ON true
     WHERE (c.user_id_1 = $1 AND NOT c.deleted_for_user1)
        OR (c.user_id_2 = $1 AND NOT c.deleted_for_user2)
     ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
    [myId],
  );
  return result.rows.map((r) => ({
    id: r.id,
    otherUserId: r.other_user_id,
    otherDisplayName: r.other_display_name,
    otherDogName: r.other_dog_name,
    otherDogBreed: r.other_dog_breed,
    otherDogAge: r.other_dog_age,
    otherPhotoUrl: r.other_photo_url,
    lastMessage: r.last_message,
    lastMessageAt: r.last_message_at,
    unreadCount: parseInt(r.unread_count),
    isOtherDeleted: r.is_other_deleted,
  }));
}

export async function getMessages(convId: string, limit = 100): Promise<ChatMessage[]> {
  const result = await pool.query<{
    id: string;
    conversation_id: string;
    sender_id: string;
    text: string | null;
    image_url: string | null;
    created_at: string;
  }>(
    `SELECT id, conversation_id, sender_id, text, image_url, created_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [convId, limit],
  );
  return result.rows.map((r) => ({
    id: Number(r.id),
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    text: r.text,
    imageUrl: r.image_url,
    createdAt: r.created_at,
  }));
}

export async function saveMessage(convId: string, senderId: string, text: string | null, imageUrl?: string | null): Promise<ChatMessage> {
  // 새 메시지 전송 시 양측의 소프트 딜리트 플래그 리셋 (대화방 복원)
  await pool.query(
    `UPDATE conversations SET deleted_for_user1 = false, deleted_for_user2 = false WHERE id = $1`,
    [convId],
  );
  const result = await pool.query<{
    id: string;
    conversation_id: string;
    sender_id: string;
    text: string | null;
    image_url: string | null;
    created_at: string;
  }>(
    `INSERT INTO messages (conversation_id, sender_id, text, image_url)
     VALUES ($1, $2, $3, $4)
     RETURNING id, conversation_id, sender_id, text, image_url, created_at`,
    [convId, senderId, text ?? null, imageUrl ?? null],
  );
  const r = result.rows[0];
  return {
    id: Number(r.id),
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    text: r.text,
    imageUrl: r.image_url,
    createdAt: r.created_at,
  };
}

export async function deleteConversation(convId: string, myId: string): Promise<boolean> {
  const participants = await getConversationParticipants(convId);
  if (!participants || !participants.includes(myId)) return false;
  // 소프트 딜리트: 요청한 유저에게만 숨김 처리 (상대방 대화는 유지)
  await pool.query(
    `UPDATE conversations
     SET deleted_for_user1 = CASE WHEN user_id_1 = $2 THEN true ELSE deleted_for_user1 END,
         deleted_for_user2 = CASE WHEN user_id_2 = $2 THEN true ELSE deleted_for_user2 END
     WHERE id = $1`,
    [convId, myId],
  );
  return true;
}

export async function getConversationParticipants(convId: string): Promise<[string, string] | null> {
  const result = await pool.query<{ user_id_1: string; user_id_2: string }>(
    `SELECT user_id_1, user_id_2 FROM conversations WHERE id = $1`,
    [convId],
  );
  if (result.rows.length === 0) return null;
  return [result.rows[0].user_id_1, result.rows[0].user_id_2];
}
