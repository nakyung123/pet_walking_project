'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getLeaderboard, getNearbyLeaderboard, getUserProfile, LeaderboardEntry, LeaderboardData, UserProfile } from '@/services/api';
import UserProfilePopup from '@/components/UserProfilePopup';

interface LeaderboardProps {
  idToken: string;
  currentUserId: string;
  currentLat?: number;
  currentLng?: number;
  /** true로 전달하면 컴포넌트 마운트 시 전체보기 모달이 바로 열림 */
  initialOpen?: boolean;
  onClose?: () => void;
}

const RANK_KO = ['1위', '2위', '3위'];
const sanitizeName = (name: string) =>
  name.replace(/[^\p{L}\p{N}\s]/gu, '').trim() || '알 수 없음';

type Tab = 'score' | 'tile';
type Scope = 'nearby' | 'global';

function Avatar({ userId, name, size = 44 }: { userId: string; name: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full bg-orange-100 border-2 border-orange-200 overflow-hidden flex items-center justify-center"
    >
      <img
        src={`https://place.dog/${size}/${size}?${userId.slice(0, 6)}`}
        alt={name}
        className="w-full h-full object-cover"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    </div>
  );
}

function EntryRow({
  entry, isMe, tab, onClick,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
  tab: Tab;
  onClick: () => void;
}) {
  const primary = tab === 'score' ? entry.totalScore : entry.tileCount;
  const unit    = tab === 'score' ? '점' : '개';
  const rankLabel = entry.rank <= 3 ? RANK_KO[entry.rank - 1] : `${entry.rank}위`;

  return (
    <li
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl px-3 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
        isMe ? 'bg-blue-500/12 border border-blue-400/30' : ''
      }`}
    >
      <span className={`w-10 text-center shrink-0 text-sm font-bold whitespace-nowrap ${
        entry.rank <= 3 ? 'text-orange-500' : 'text-gray-400'
      }`}>
        {rankLabel}
      </span>
      <Avatar userId={entry.userId} name={sanitizeName(entry.displayName)} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${isMe ? 'text-blue-600' : 'text-gray-900'}`}>
          {sanitizeName(entry.displayName)}{isMe && ' (나)'}
        </p>
        <p className="text-xs text-gray-400 leading-snug mt-0.5">
          {tab === 'score' ? `${entry.tileCount} 타일` : `${entry.totalScore.toLocaleString()} 점`}
        </p>
      </div>
      <span className={`text-sm font-bold shrink-0 ${isMe ? 'text-blue-600' : 'text-gray-800'}`}>
        {primary.toLocaleString()}{unit}
      </span>
    </li>
  );
}

export default function Leaderboard({
  idToken, currentUserId, currentLat, currentLng,
  initialOpen = false, onClose,
}: LeaderboardProps) {
  const [open, setOpen]               = useState(initialOpen);
  const [tab, setTab]                 = useState<Tab>('score');
  const [scope, setScope]             = useState<Scope>('nearby');
  const [data, setData]               = useState<LeaderboardData | null>(null);
  const [loading, setLoading]         = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading]   = useState(false);

  const fetchData = useCallback(async (s: Scope) => {
    setLoading(true);
    try {
      const res = s === 'nearby' && currentLat != null && currentLng != null
        ? await getNearbyLeaderboard(currentLat, currentLng, idToken)
        : await getLeaderboard(idToken);
      if (res.success && res.data) setData(res.data);
    } catch (e) {
      console.error('[Leaderboard]', e);
    } finally {
      setLoading(false);
    }
  }, [idToken, currentLat, currentLng]);

  useEffect(() => {
    if (open) fetchData(scope);
  }, [open, scope, fetchData]);

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const handleEntryClick = useCallback(async (userId: string) => {
    if (profileLoading) return;
    setProfileLoading(true);
    try {
      const res = await getUserProfile(userId, idToken);
      if (res.success && res.data) setSelectedProfile(res.data);
    } catch (e) {
      console.error('[Leaderboard] 프로필 조회 실패', e);
    } finally {
      setProfileLoading(false);
    }
  }, [idToken, profileLoading]);

  const list = data ? (tab === 'score' ? data.byScore : data.byTile) : [];

  return (
    <>
      {/* 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col max-h-[75vh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">랭킹</h2>
              <button
                onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* 내 주변 / 전체 탭 */}
            <div className="flex gap-1.5 px-4 pt-3 pb-1">
              {(['nearby', 'global'] as Scope[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`flex-1 text-xs font-bold py-1.5 rounded-xl transition-colors ${
                    scope === s
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s === 'nearby' ? '내 주변' : '전체'}
                </button>
              ))}
            </div>

            {/* 점수 / 타일 수 탭 */}
            <div className="flex gap-1 px-4 pt-2 pb-2">
              {(['score', 'tile'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors ${
                    tab === t
                      ? 'bg-orange-400 text-white'
                      : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'score' ? '점수 랭킹' : '타일 수 랭킹'}
                </button>
              ))}
            </div>

            <ul className="overflow-y-auto scrollbar-hide px-4 pb-5 space-y-1">
              {loading ? (
                <li className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </li>
              ) : list.length === 0 ? (
                <li className="text-gray-400 text-center py-10 text-sm">
                  {scope === 'nearby' ? '주변 3km 내 활동 유저가 없어요' : '아직 데이터가 없습니다.'}
                </li>
              ) : (
                list.map((e) => (
                  <EntryRow
                    key={e.userId}
                    entry={e}
                    isMe={e.userId === currentUserId}
                    tab={tab}
                    onClick={() => handleEntryClick(e.userId)}
                  />
                ))
              )}
            </ul>
          </div>
        </div>
      )}

      {/* 프로필 팝업 */}
      {selectedProfile && createPortal(
        <UserProfilePopup profile={selectedProfile} onClose={() => setSelectedProfile(null)} />,
        document.body,
      )}

      {profileLoading && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>,
        document.body,
      )}
    </>
  );
}
