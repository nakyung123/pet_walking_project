'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  AppNotification,
} from '@/services/api';

const NOTIF_ICON: Record<AppNotification['type'], string> = {
  tile_stolen:      '⚔️',
  comment_on_post:  '💬',
  like_on_post:     '❤️',
  new_chat_message: '✉️',
  decay_warning:    '⚠️',
  mission_complete: '🎯',
  badge_earned:     '🏅',
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

interface ScorePanelProps {
  score: number;
  tileCount: number;
  userName: string;
  connected?: boolean;
  expiringCount?: number;
  idToken?: string;
  onWalkLog: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onUnreadChatChange?: (count: number) => void;
}

export default function ScorePanel({
  score, tileCount, userName, expiringCount = 0, idToken,
  onWalkLog, onProfile, onSettings, onUnreadChatChange,
}: ScorePanelProps) {
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!idToken) return;
    try {
      const res = await getNotifications(idToken);
      if (res.success && res.data) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
        const chatUnread = res.data.notifications.filter(
          (n) => n.type === 'new_chat_message' && !n.isRead,
        ).length;
        onUnreadChatChange?.(chatUnread);
      }
    } catch (e) {
      console.error('[ScorePanel] 알림 조회 실패:', e);
    }
  }, [idToken, onUnreadChatChange]);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // 패널 열릴 때 전체 읽음 처리
  useEffect(() => {
    if (!showNotif || !idToken || unreadCount === 0) return;
    markAllNotificationsRead(idToken)
      .then(() => {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      })
      .catch((e) => console.error('[ScorePanel] 읽음 처리 실패:', e));
  }, [showNotif, idToken, unreadCount]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!showNotif) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotif]);

  const totalBadge = unreadCount + (expiringCount > 0 ? 1 : 0);

  return (
    <div className="absolute top-0 left-0 right-0 z-10">
      <div
        className="mx-3 mt-3 bg-white/92 backdrop-blur-md rounded-[24px] shadow-lg px-5 py-4 grid grid-cols-3 items-center overflow-visible relative"
        style={{ minHeight: 64 }}
      >
        {/* 좌측: SVG 로고 + 퍼피랜드 */}
        <div className="flex items-center gap-2 min-w-0">
          <img src="/footprint_logo.svg" alt="로고" style={{ height: 40 }} />
          <span className="text-base font-bold text-gray-900 whitespace-nowrap">퍼피랜드</span>
        </div>

        {/* 중앙: 점수 pill + 원형 로고 + 이름 */}
        <div className="flex justify-center items-center overflow-visible">
          <div className="bg-gray-100 rounded-full flex items-center px-5 py-2 overflow-visible">
            <span className="text-base text-gray-600 whitespace-nowrap">
              내 점수: <span className="font-bold text-gray-900">{score.toLocaleString()}</span>
            </span>

            <div className="relative shrink-0 mx-4" style={{ width: 96, height: 36 }}>
              <div
                className="absolute bg-white rounded-full shadow-lg border-2 border-gray-200 overflow-hidden p-2"
                style={{ width: 96, height: 96, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <img src="/bichon.png" alt="강아지" className="w-full h-full object-contain" />
              </div>
            </div>

            <span className="text-base font-bold text-gray-900 whitespace-nowrap">
              {userName}
            </span>
          </div>
        </div>

        {/* 우측: 아이콘 버튼 4개 */}
        <div className="flex justify-end items-center gap-1">
          {/* 알림 버튼 */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotif((v) => !v)}
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:scale-95 transition-all"
              aria-label="알림"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {totalBadge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                  {totalBadge > 99 ? '99+' : totalBadge}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 top-[44px] w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">알림</p>
                  {notifications.length > 0 && (
                    <span className="text-xs text-gray-400">{notifications.length}개</span>
                  )}
                </div>

                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {/* 실시간 만료 경고 (프론트 계산) */}
                  {expiringCount > 0 && (
                    <li className="flex items-start gap-3 px-4 py-3 bg-red-50">
                      <span className="text-base mt-0.5 shrink-0">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-600">내 영역 {expiringCount}곳 곧 만료</p>
                        <p className="text-xs text-red-400 mt-0.5">산책을 나가 마킹을 갱신하세요!</p>
                      </div>
                    </li>
                  )}

                  {/* 백엔드 알림 목록 */}
                  {notifications.length === 0 && expiringCount === 0 ? (
                    <li className="text-xs text-gray-400 text-center py-6">새 알림이 없어요</li>
                  ) : (
                    notifications.map((n) => (
                      <li
                        key={n.id}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                        onClick={() => {
                          if (!n.isRead && idToken) {
                            markNotificationRead(n.id, idToken).catch(() => {});
                            setNotifications((prev) =>
                              prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x),
                            );
                          }
                        }}
                      >
                        <span className="text-base mt-0.5 shrink-0">{NOTIF_ICON[n.type]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className={`text-sm font-semibold truncate ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                              {n.title}
                            </p>
                            {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>

          {[
            {
              label: '산책일지',
              onClick: onWalkLog,
              svg: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              ),
            },
            {
              label: '프로필',
              onClick: onProfile,
              svg: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              ),
            },
            {
              label: '설정',
              onClick: onSettings,
              svg: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              ),
            },
          ].map(({ svg, label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:scale-95 transition-all"
              aria-label={label}
            >
              {svg}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
