'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { io, Socket } from 'socket.io-client';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import ReportModal from './ReportModal';
import {
  startConversation,
  getConversationMessages,
  sendChatMessage,
  markConversationNotificationsRead,
  ChatMessage,
} from '@/services/api';
import { storage } from '@/lib/firebase';

export interface ChatUser {
  userId: string;
  displayName: string;
  dogName: string;
  dogBreed: string | null;
  dogAge: string | null;
  photoUrl: string | null;
  isDeleted?: boolean;
}

export interface ConversationRecord {
  id: string;
  otherUserId: string;
  otherDisplayName: string;
  otherDogName: string;
  otherDogBreed: string | null;
  otherDogAge: string | null;
  otherPhotoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

interface ChatRoomProps {
  currentUserId: string;
  idToken: string;
  otherUser: ChatUser;
  onBack: () => void;
  onClose: () => void;
}

const SERVER = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const TRUNCATE_LEN = 100;

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h >= 12 ? '오후' : '오전'} ${h % 12 || 12}:${m}`;
}

export default function ChatRoom({ currentUserId, idToken, otherUser, onBack, onClose }: ChatRoomProps) {
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [fullTextMsg, setFullTextMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // 대화방 생성 또는 조회 후 메시지 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const convRes = await startConversation(otherUser.userId, idToken);
        if (cancelled || !convRes.success || !convRes.data) return;
        const id = convRes.data.conversationId;
        setConvId(id);
        // 이 대화방의 미읽은 알림 읽음 처리 (fire-and-forget)
        markConversationNotificationsRead(id, idToken).catch(() => {});
        const msgRes = await getConversationMessages(id, idToken);
        if (!cancelled && msgRes.success && msgRes.data) {
          setMessages(msgRes.data);
        }
      } catch (e) {
        console.error('[ChatRoom] 초기화 실패', e);
      }
    })();
    return () => { cancelled = true; };
  }, [otherUser.userId, idToken]);

  // 소켓 연결 — new_message 수신 시 메시지 추가
  useEffect(() => {
    const socket = io(SERVER, {
      transports: ['websocket', 'polling'],
      auth: { token: idToken },
    });
    socketRef.current = socket;

    socket.on('new_message', ({ message }: { message: ChatMessage }) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [idToken]);

  // 새 메시지 오면 스크롤 최하단
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !convId || sending) return;
    setSending(true);
    setInput('');
    try {
      await sendChatMessage(convId, text, idToken);
    } catch (e) {
      console.error('[ChatRoom] 전송 실패', e);
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, convId, sending, idToken]);

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !convId || sending) return;
    e.target.value = '';
    setSending(true);
    try {
      const storageRef = ref(storage, `chat/${convId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(storageRef);
      await sendChatMessage(convId, null, idToken, imageUrl);
    } catch (e) {
      console.error('[ChatRoom] 이미지 전송 실패', e);
    } finally {
      setSending(false);
    }
  }, [convId, sending, idToken]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5">
      <div className="absolute inset-0 bg-black/50" onClick={onBack} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col min-h-[60vh] max-h-[75vh] overflow-hidden">

        {/* 헤더 */}
        <div
          style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
          className="flex items-center gap-3 px-4 pt-4 pb-4 shrink-0 rounded-t-3xl"
        >
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white text-lg shrink-0"
          >
            ←
          </button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full border-2 border-white/80 overflow-hidden bg-orange-100 shrink-0">
              {otherUser.photoUrl ? (
                <img src={otherUser.photoUrl} alt={otherUser.dogName} className="w-full h-full object-cover" />
              ) : (
                <img
                  src={`https://place.dog/40/40?${otherUser.userId.slice(0, 6)}`}
                  alt={otherUser.dogName}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">{otherUser.dogName}</p>
              <p className="text-white/80 text-[11px] truncate">
                {otherUser.displayName}
                {otherUser.dogBreed ? ` · ${otherUser.dogBreed}` : ''}
                {otherUser.dogAge ? ` · ${otherUser.dogAge}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowReport(true)}
            className="shrink-0 px-3 h-8 rounded-full bg-white/20 text-white text-xs font-bold border border-white/30 hover:bg-white/30 transition-colors"
          >
            신고
          </button>
        </div>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-gray-50">
          {messages.length === 0 && (
            <p className="text-center text-xs text-gray-400 mt-10">
              {otherUser.dogName}에게 첫 메시지를 보내보세요
            </p>
          )}
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            const isLong = (msg.text?.length ?? 0) > TRUNCATE_LEN;
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMine && (
                  <div className="w-7 h-7 rounded-full bg-orange-100 overflow-hidden shrink-0">
                    <img
                      src={`https://place.dog/28/28?${otherUser.userId.slice(0, 6)}`}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className={`max-w-[70%] flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                  {msg.imageUrl ? (
                    <img
                      src={msg.imageUrl}
                      alt="사진"
                      className="max-w-full rounded-2xl shadow-sm cursor-pointer"
                      onClick={() => window.open(msg.imageUrl!, '_blank')}
                    />
                  ) : (
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed select-text ${
                      isMine
                        ? 'bg-orange-400 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                    }`}>
                      {isLong ? (
                        <>
                          {msg.text!.slice(0, TRUNCATE_LEN)}…
                          <button
                            onClick={() => setFullTextMsg(msg.text!)}
                            className={`block text-[11px] font-semibold mt-1 ${isMine ? 'text-white/80' : 'text-orange-500'}`}
                          >
                            전체보기 &gt;
                          </button>
                        </>
                      ) : msg.text}
                    </div>
                  )}
                  <span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* 입력창 */}
        {otherUser.isDeleted ? (
          <div className="shrink-0 px-4 py-3 border-t border-gray-100 bg-gray-50 text-center">
            <p className="text-xs text-gray-400">탈퇴한 유저와는 메시지를 보낼 수 없어요</p>
          </div>
        ) : (
          <div className="shrink-0 flex items-center gap-2 px-3 py-3 border-t border-gray-100 bg-white">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-orange-500 transition-colors disabled:opacity-40 shrink-0"
              aria-label="사진 전송"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="메시지 입력..."
              className="flex-1 h-10 px-4 rounded-full bg-gray-100 text-sm outline-none text-gray-900"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-400 text-white text-lg disabled:opacity-40 shrink-0 active:scale-95 transition-transform"
            >
              ↑
            </button>
          </div>
        )}

      </div>

      {showReport && (
        <ReportModal
          targetName={otherUser.dogName}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* 긴 메시지 전체보기 */}
      {fullTextMsg !== null && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/60" onClick={() => setFullTextMsg(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">전체 메시지</p>
              <button
                onClick={() => setFullTextMsg(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm"
              >✕</button>
            </div>
            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap select-text">{fullTextMsg}</p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>,
    document.body,
  );
}
