'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import ChatRoom, { ChatUser } from './ChatRoom';
import { getConversations, deleteConversation, markChatNotificationsRead, ConversationSummary } from '@/services/api';

const SERVER = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface ChatListProps {
  currentUserId: string;
  idToken: string;
  initialChatUser?: ChatUser;
  onClose: () => void;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default function ChatList({ currentUserId, idToken, initialChatUser, onClose }: ChatListProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeChat, setActiveChat] = useState<ChatUser | null>(initialChatUser ?? null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
  const [deleteError, setDeleteError] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await getConversations(idToken);
      if (res.success && res.data) setConversations(res.data);
    } catch (e) {
      console.error('[ChatList] 대화 목록 조회 실패', e);
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  // 채팅 탭 열릴 때 채팅 알림 일괄 읽음 처리
  useEffect(() => {
    markChatNotificationsRead(idToken).catch(() => {});
    fetchConversations();
  }, [idToken, fetchConversations]);

  // 채팅 목록에 있을 때 새 메시지 실시간 반영
  useEffect(() => {
    if (activeChat) return;
    const socket = io(SERVER, {
      transports: ['websocket', 'polling'],
      auth: { token: idToken },
    });
    socket.on('new_message', () => { fetchConversations(); });
    return () => { socket.disconnect(); };
  }, [idToken, activeChat, fetchConversations]);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setConversations((prev) => prev.filter((c) => c.id !== target.id));
    try {
      await deleteConversation(target.id, idToken);
    } catch {
      setConversations((prev) => [target, ...prev]);
      setDeleteError(true);
      setTimeout(() => setDeleteError(false), 3000);
    }
  }

  function handleBack() {
    fetchConversations();
    setActiveChat(null);
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col min-h-[60vh] max-h-[75vh]">

          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
            <h2 className="text-base font-bold text-gray-900">💬 메시지</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* 목록 */}
          <ul className="overflow-y-auto scrollbar-hide py-2 pb-10 flex-1">
            {loading ? (
              <li className="flex justify-center py-14">
                <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              </li>
            ) : conversations.length === 0 ? (
              <li className="flex flex-col items-center justify-center py-14 gap-3">
                <span className="text-5xl">💬</span>
                <p className="text-sm font-bold text-gray-500">아직 대화가 없어요</p>
                <p className="text-xs text-gray-400">랭킹이나 프로필에서 메시지를 보내보세요</p>
              </li>
            ) : (
              conversations.map((conv) => (
                <li
                  key={conv.id}
                  className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => setActiveChat({
                      userId: conv.otherUserId,
                      displayName: conv.isOtherDeleted ? '탈퇴한 유저' : conv.otherDisplayName,
                      dogName: conv.isOtherDeleted ? '' : conv.otherDogName,
                      dogBreed: conv.otherDogBreed,
                      dogAge: conv.otherDogAge,
                      photoUrl: conv.isOtherDeleted ? null : conv.otherPhotoUrl,
                      isDeleted: conv.isOtherDeleted,
                    })}
                  >
                    <div className={`w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 ${conv.isOtherDeleted ? 'bg-gray-100 border-gray-200' : 'bg-orange-100 border-orange-100'}`}>
                      {conv.isOtherDeleted ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">👤</div>
                      ) : (
                        <img
                          src={conv.otherPhotoUrl ?? `https://place.dog/48/48?${conv.otherUserId.slice(0, 6)}`}
                          alt={conv.otherDogName}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-bold truncate ${conv.isOtherDeleted ? 'text-gray-400' : 'text-gray-900'}`}>
                          {conv.isOtherDeleted ? '탈퇴한 유저' : (conv.otherDogName || conv.otherDisplayName)}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="text-[11px] text-gray-400">{timeAgo(conv.lastMessageAt)}</span>
                          {conv.unreadCount > 0 && (
                            <span className="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1 leading-none">
                              {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {conv.lastMessage ?? '대화를 시작해보세요'}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {conv.otherDisplayName}
                        {conv.otherDogBreed ? ` · ${conv.otherDogBreed}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv); }}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                    aria-label="대화 삭제"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </li>
              ))
            )}
          </ul>

        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl px-5 py-6 w-full max-w-xs text-center">
            <p className="text-base font-bold text-gray-900">대화를 삭제할까요?</p>
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-semibold">{deleteTarget.otherDogName || deleteTarget.otherDisplayName}</span>님과의
              대화가 영구 삭제됩니다.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-bold text-white hover:bg-red-600 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-red-500 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg">
          삭제에 실패했어요. 다시 시도해주세요.
        </div>
      )}

      {activeChat && (
        <ChatRoom
          currentUserId={currentUserId}
          idToken={idToken}
          otherUser={activeChat}
          onBack={handleBack}
          onClose={() => { handleBack(); onClose(); }}
        />
      )}
    </>,
    document.body,
  );
}
