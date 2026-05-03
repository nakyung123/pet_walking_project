'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { io, Socket } from 'socket.io-client';
import ReportModal from './ReportModal';
import UserProfilePopup from './UserProfilePopup';
import {
  startConversation,
  getConversationMessages,
  sendChatMessage,
  markConversationNotificationsRead,
  getUserProfile,
  ChatMessage,
  UserProfile,
} from '@/services/api';

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
const IMAGE_MAX_SIZE = 1280;
const IMAGE_QUALITY = 0.78;

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h >= 12 ? '오후' : '오전'} ${h % 12 || 12}:${m}`;
}

function compressImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일만 전송할 수 있습니다.'));
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const ratio = Math.min(1, IMAGE_MAX_SIZE / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * ratio));
      const height = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('이미지를 처리할 수 없습니다.'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 불러올 수 없습니다.'));
    };

    img.src = objectUrl;
  });
}

export default function ChatRoom({ currentUserId, idToken, otherUser, onBack, onClose }: ChatRoomProps) {
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendImageError, setSendImageError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [fullTextMsg, setFullTextMsg] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  // 이미지 미리보기
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  // 상대방 프로필 팝업
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // 대화방 생성 또는 조회 후 메시지 로드
  useEffect(() => {
    let cancelled = false;
    setMessagesLoaded(false);
    setMessages([]);
    (async () => {
      try {
        const convRes = await startConversation(otherUser.userId, idToken);
        if (cancelled || !convRes.success || !convRes.data) return;
        const id = convRes.data.conversationId;
        setConvId(id);
        markConversationNotificationsRead(id, idToken).catch(() => {});
        const msgRes = await getConversationMessages(id, idToken);
        if (!cancelled && msgRes.success && msgRes.data) {
          setMessages(msgRes.data);
        }
      } catch (e) {
        console.error('[ChatRoom] 초기화 실패', e);
      } finally {
        if (!cancelled) setMessagesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [otherUser.userId, idToken]);

  // 소켓 연결
  useEffect(() => {
    const socket = io(SERVER, {
      transports: ['websocket', 'polling'],
      auth: { token: idToken },
    });
    socketRef.current = socket;

    socket.on('new_message', ({ message }: { message: ChatMessage }) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === message.id)) return prev;
        const optimisticIdx = prev.findIndex((m) =>
          m.id < 0 &&
          m.conversationId === message.conversationId &&
          m.senderId === message.senderId &&
          m.text === message.text &&
          m.imageUrl === message.imageUrl
        );
        if (optimisticIdx !== -1) {
          return prev.map((m, i) => (i === optimisticIdx ? message : m));
        }
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

    const optimisticMsg: ChatMessage = {
      id: -Date.now(),
      conversationId: convId,
      senderId: currentUserId,
      text,
      imageUrl: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await sendChatMessage(convId, text, idToken);
      if (res.success && res.data) {
        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimisticMsg.id);
          if (withoutOptimistic.some((m) => m.id === res.data!.id)) return withoutOptimistic;
          return [...withoutOptimistic, res.data!];
        });
      }
    } catch (e) {
      console.error('[ChatRoom] 전송 실패', e);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, convId, sending, idToken, currentUserId]);

  // 이미지 선택 시 미리보기만 저장 (아직 업로드 안 함)
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingImage({ file, previewUrl });
  }, []);

  // 미리보기 확인 후 실제 업로드 및 전송
  const handleImageSend = useCallback(async () => {
    if (!pendingImage || !convId || sending) return;
    const { file, previewUrl } = pendingImage;
    setPendingImage(null);
    URL.revokeObjectURL(previewUrl);
    setSending(true);
    setSendImageError(null);
    try {
      const imageUrl = await compressImageToBase64(file);
      const res = await sendChatMessage(convId, null, idToken, imageUrl);
      if (res.success && res.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data!.id)) return prev;
          return [...prev, res.data!];
        });
      }
    } catch (e) {
      console.error('[ChatRoom] 이미지 전송 실패', e);
      setSendImageError('사진 전송에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  }, [pendingImage, convId, sending, idToken]);

  const handleImageCancel = useCallback(() => {
    if (pendingImage) {
      URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage(null);
    }
  }, [pendingImage]);

  // 헤더 프로필 클릭 → 상대방 프로필 팝업
  const handleProfileClick = useCallback(async () => {
    if (otherUser.isDeleted || profileLoading) return;
    setProfileLoading(true);
    try {
      const res = await getUserProfile(otherUser.userId, idToken);
      if (res.success && res.data) setOtherProfile(res.data);
    } catch (e) {
      console.error('[ChatRoom] 프로필 조회 실패', e);
    } finally {
      setProfileLoading(false);
    }
  }, [otherUser.userId, otherUser.isDeleted, profileLoading, idToken]);

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

          {/* 프로필 영역: 클릭 시 팝업 */}
          <button
            onClick={handleProfileClick}
            disabled={otherUser.isDeleted || profileLoading}
            className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
          >
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
              <p className="text-white font-bold text-sm truncate">
                {otherUser.dogName}
                {profileLoading && <span className="ml-1 text-white/60 text-xs">···</span>}
              </p>
              <p className="text-white/80 text-[11px] truncate">
                {otherUser.displayName}
                {otherUser.dogBreed ? ` · ${otherUser.dogBreed}` : ''}
                {otherUser.dogAge ? ` · ${otherUser.dogAge}살` : ''}
              </p>
            </div>
          </button>

          <button
            onClick={() => setShowReport(true)}
            className="shrink-0 px-3 h-8 rounded-full bg-white/20 text-white text-xs font-bold border border-white/30 hover:bg-white/30 transition-colors"
          >
            신고
          </button>
        </div>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-gray-50">
          {!messagesLoaded && (
            <div className="flex justify-center mt-10">
              <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {messagesLoaded && messages.length === 0 && (
            <p className="text-center text-xs text-gray-400 mt-10">
              {otherUser.dogName}에게 첫 메시지를 보내보세요
            </p>
          )}
          {sendImageError && (
            <p className="text-center text-xs text-red-400">{sendImageError}</p>
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
                      onClick={() => setSelectedImageUrl(msg.imageUrl)}
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

      {/* 이미지 미리보기 모달 */}
      {pendingImage && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/70" onClick={handleImageCancel} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* 미리보기 헤더 */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <p className="text-sm font-bold text-gray-900">사진 전송</p>
              <button
                onClick={handleImageCancel}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm"
              >
                ✕
              </button>
            </div>
            {/* 이미지 미리보기 */}
            <div className="px-5 pb-3 flex justify-center bg-gray-50">
              <img
                src={pendingImage.previewUrl}
                alt="전송할 사진"
                className="max-h-64 max-w-full rounded-2xl object-contain shadow"
              />
            </div>
            {/* 전송 버튼 */}
            <div className="px-5 py-4">
              <button
                onClick={handleImageSend}
                disabled={sending}
                className="w-full py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
              >
                {sending ? '전송 중…' : '사진 보내기'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {showReport && (
        <ReportModal
          targetName={otherUser.dogName}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* 상대방 프로필 팝업 (메시지 보내기 버튼 없음) */}
      {otherProfile && (
        <UserProfilePopup
          profile={otherProfile}
          onClose={() => setOtherProfile(null)}
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

      {selectedImageUrl && createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90"
          onClick={() => setSelectedImageUrl(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 text-white text-lg hover:bg-white/30 transition-colors"
            onClick={() => setSelectedImageUrl(null)}
            aria-label="Close image"
          >
            X
          </button>
          <img
            src={selectedImageUrl}
            alt="chat image"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      )}
    </div>,
    document.body,
  );
}
