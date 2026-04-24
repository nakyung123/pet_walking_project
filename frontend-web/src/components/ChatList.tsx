'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ChatRoom, { ChatUser } from './ChatRoom';
import { getConversations, ConversationSummary } from '@/services/api';

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

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

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
            ) : conversations.filter((c) => c.lastMessage).length === 0 ? (
              <li className="flex flex-col items-center justify-center py-14 gap-3">
                <span className="text-5xl">💬</span>
                <p className="text-sm font-bold text-gray-500">아직 대화가 없어요</p>
                <p className="text-xs text-gray-400">랭킹이나 프로필에서 메시지를 보내보세요</p>
              </li>
            ) : (
              conversations
                .filter((c) => c.lastMessage)
                .map((conv) => (
                  <li
                    key={conv.id}
                    onClick={() => setActiveChat({
                      userId: conv.otherUserId,
                      displayName: conv.otherDisplayName,
                      dogName: conv.otherDogName,
                      dogBreed: conv.otherDogBreed,
                      dogAge: conv.otherDogAge,
                      photoUrl: conv.otherPhotoUrl,
                    })}
                    className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 cursor-pointer active:bg-gray-100 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-orange-100 overflow-hidden shrink-0 border-2 border-orange-100">
                      <img
                        src={conv.otherPhotoUrl ?? `https://place.dog/48/48?${conv.otherUserId.slice(0, 6)}`}
                        alt={conv.otherDogName}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900 truncate">{conv.otherDogName}</p>
                        <span className="text-[11px] text-gray-400 shrink-0 ml-2">{timeAgo(conv.lastMessageAt)}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {conv.otherDisplayName}
                        {conv.otherDogBreed ? ` · ${conv.otherDogBreed}` : ''}
                      </p>
                    </div>
                  </li>
                ))
            )}
          </ul>

        </div>
      </div>

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
