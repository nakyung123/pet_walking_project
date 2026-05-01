'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  AppNotification,
} from '@/services/api';

const NOTIF_ICON: Record<AppNotification['type'], string> = {
  tile_stolen:      '⚔️',
  comment_on_post:  '💬',
  like_on_post:     '❤️',
  new_chat_message: '💬',
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
  photoUrl?: string;
  connected?: boolean;
  expiringCount?: number;
  idToken?: string;
  onWalkLog: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onUnreadChatChange?: (count: number) => void;
  onStolenTiles?: (tileIds: string[]) => void;
}

interface PointRecord {
  timestamp: number;
  type: 'marking' | 'mission' | 'occupy';
  points: number;
  label: string;
}

const SCORE_TYPE_ICON: Record<string, string> = {
  marking: '🐾',
  mission: '⭐',
  occupy: '🏆',
};

function ScoreHistoryModal({ onClose }: { onClose: () => void }) {
  const [history, setHistory] = useState<PointRecord[]>([]);

  useEffect(() => {
    try {
      const records: PointRecord[] = JSON.parse(localStorage.getItem('pointHistory') || '[]');
      setHistory(records.sort((a, b) => b.timestamp - a.timestamp));
    } catch {
      setHistory([]);
    }
  }, []);

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="text-base font-bold text-gray-900">점수 내역</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm">✕</button>
        </div>

        <div className="border-t border-gray-100 mx-5" />

        <div className="overflow-y-auto flex-1 px-5 py-3 [&::-webkit-scrollbar]:hidden">
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">아직 점수 내역이 없어요</p>
          ) : (
            <div className="space-y-0.5">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{SCORE_TYPE_ICON[h.type] ?? '📌'}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{h.label}</p>
                      <p className="text-[11px] text-gray-400">{fmt(h.timestamp)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-orange-500">+{h.points.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ScorePanel({
  score, tileCount, userName, photoUrl, expiringCount = 0, idToken,
  onWalkLog, onProfile, onSettings, onUnreadChatChange, onStolenTiles,
}: ScorePanelProps) {
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);
  const [showScoreHistory, setShowScoreHistory] = useState(false);
  // 만료 경고 배지 dismiss 상태 (알림 탭 열면 사라지고, expiringCount가 새로 증가하면 복원)
  const [expiringDismissed, setExpiringDismissed] = useState(false);
  const prevExpiringCount = useRef(expiringCount);

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
        const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
        const stolenIds = res.data.notifications
          .filter((n) => n.type === 'tile_stolen' && new Date(n.createdAt).getTime() > sixHoursAgo && n.metadata?.tileId)
          .map((n) => n.metadata!.tileId as string);
        onStolenTiles?.(stolenIds);
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

  // expiringCount가 새로 증가하면 dismiss 초기화
  useEffect(() => {
    if (expiringCount > prevExpiringCount.current) {
      setExpiringDismissed(false);
    }
    prevExpiringCount.current = expiringCount;
  }, [expiringCount]);

  // 패널 열릴 때 전체 읽음 처리 (채팅 알림 isRead는 건드리지 않음)
  useEffect(() => {
    if (!showNotif) return;
    setExpiringDismissed(true);
    if (!idToken || unreadCount === 0) return;
    markAllNotificationsRead(idToken)
      .then(() => {
        setUnreadCount(0);
        // new_chat_message는 isRead 상태를 바꾸지 않아 채팅 뱃지 독립 유지
        setNotifications((prev) =>
          prev.map((n) => n.type === 'new_chat_message' ? n : { ...n, isRead: true }),
        );
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

  const handleScoreClick = () => {
    setShowScoreHistory(true);
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!idToken) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    deleteNotification(id, idToken).catch(() => {});
  };

  const totalBadge = showNotif ? 0 : unreadCount + (expiringCount > 0 && !expiringDismissed ? 1 : 0);

  return (
    <>
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

        {/* 중앙: 점수 pill + 원형 프로필 + 이름 */}
        <div className="flex justify-center items-center overflow-visible">
          <div className="bg-gray-100 rounded-full flex items-center px-5 py-2 overflow-visible">
            <div className="relative">
            <button
              onClick={handleScoreClick}
              className="text-base text-gray-600 whitespace-nowrap hover:text-orange-500 transition-colors"
            >
              내 점수: <span className="font-bold text-gray-900">{score.toLocaleString()}</span>
            </button>
            </div>

            <div className="relative shrink-0 mx-4" style={{ width: 96, height: 36 }}>
              <div
                className="absolute bg-white rounded-full shadow-lg border-2 border-gray-200 overflow-hidden p-2"
                style={{ width: 96, height: 96, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
              >
                <img
                  src={photoUrl ?? '/bichon.png'}
                  alt="강아지"
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/bichon.png'; }}
                />
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
                            <div className="flex items-center gap-1 shrink-0">
                              {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                              <button
                                onClick={(e) => handleDeleteNotification(e, n.id)}
                                className="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors text-xs"
                                aria-label="알림 삭제"
                              >
                                ✕
                              </button>
                            </div>
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

    {showScoreHistory && typeof document !== 'undefined' &&
      createPortal(<ScoreHistoryModal onClose={() => setShowScoreHistory(false)} />, document.body)}
    </>
  );
}
