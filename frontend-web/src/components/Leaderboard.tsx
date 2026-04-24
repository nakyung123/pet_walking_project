'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getLeaderboard, getUserProfile, LeaderboardEntry, LeaderboardData, UserProfile } from '@/services/api';
import UserProfilePopup from '@/components/UserProfilePopup';

interface LeaderboardProps {
  idToken: string;
  currentUserId: string;
}

const RANK_KO = ['1위', '2위', '3위'];
const sanitizeName = (name: string) =>
  name.replace(/[^\p{L}\p{N}\s]/gu, '').trim() || '알 수 없음';

function getGapText(myEntry: LeaderboardEntry, list: LeaderboardEntry[], tab: Tab): string {
  const { rank } = myEntry;
  if (rank === 1) return '1위 달성! 👑';
  const targetRank = rank > 10 ? 10 : 1;
  const target = list.find((e) => e.rank === targetRank);
  if (!target) return '';
  const diff = (tab === 'score' ? target.totalScore - myEntry.totalScore : target.tileCount - myEntry.tileCount);
  const unit = tab === 'score' ? '점' : '개';
  return `${targetRank}위까지 ${diff.toLocaleString()}${unit} 남음`;
}

function MyRankCard({ myEntry, list, tab, total, compact = false }: {
  myEntry: LeaderboardEntry | null;
  list: LeaderboardEntry[];
  tab: Tab;
  total: number;
  compact?: boolean;
}) {
  if (!myEntry) {
    return (
      <div className={`mx-4 ${compact ? 'mb-2' : 'mb-3'} rounded-2xl bg-gray-100 px-4 py-3`}>
        <p className="text-xs text-gray-400 font-medium">아직 순위가 없어요</p>
        <p className="text-sm font-bold text-gray-600 mt-0.5">첫 마킹을 해보세요! 🐾</p>
      </div>
    );
  }
  const topPercent = Math.ceil((myEntry.rank / total) * 100);
  const gapText = getGapText(myEntry, list, tab);
  return (
    <div
      className={`mx-4 ${compact ? 'mb-2' : 'mb-3'} rounded-2xl overflow-hidden`}
      style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-white/70 font-medium">내 순위</p>
          <p className="text-3xl font-black text-white leading-tight">{myEntry.rank}위</p>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center bg-white/20 rounded-full px-2.5 py-1 mb-1.5">
            <span className="text-xs font-bold text-white">상위 {topPercent}%</span>
          </div>
          {gapText && <p className="text-[11px] text-white/80">{gapText}</p>}
        </div>
      </div>
    </div>
  );
}

type Tab = 'score' | 'tile';

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

export default function Leaderboard({ idToken, currentUserId }: LeaderboardProps) {
  const [data, setData]             = useState<LeaderboardData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [open, setOpen]             = useState(false);
  const [tab, setTab]               = useState<Tab>('score');
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading]   = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await getLeaderboard(idToken);
      if (res.success && res.data) setData(res.data);
    } catch (e) {
      console.error('[Leaderboard]', e);
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    fetchLeaderboard();
    const id = setInterval(fetchLeaderboard, 30_000);
    return () => clearInterval(id);
  }, [fetchLeaderboard]);

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

  const list      = data ? (tab === 'score' ? data.byScore : data.byTile) : [];
  const preview   = list.slice(0, 3);
  const myEntry   = list.find((e) => e.userId === currentUserId) ?? null;

  return (
    <>
      {/* 패널 (위치·높이는 부모 컨테이너가 담당) */}
      <div className="w-full h-full bg-white/95 backdrop-blur-md rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
          <span className="text-base font-bold text-gray-900">랭킹</span>
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-orange-500 font-semibold hover:text-orange-600 transition-colors"
          >
            전체보기 ↑
          </button>
        </div>

        {/* 내 순위 카드 */}
        {!loading && (
          <MyRankCard myEntry={myEntry} list={list} tab={tab} total={list.length} />
        )}

        {/* 탭 */}
        <div className="flex gap-1.5 px-4 pb-3 shrink-0">
          {(['score', 'tile'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 text-xs font-bold py-1.5 rounded-xl transition-colors ${
                tab === t
                  ? 'bg-orange-400 text-white'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'score' ? '점수' : '타일 수'}
            </button>
          ))}
        </div>

        {/* 목록 (남은 공간을 채우고 스크롤) */}
        <ul className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pb-4 space-y-1">
          {loading ? (
            <li className="flex justify-center py-5">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </li>
          ) : preview.length === 0 ? (
            <li className="text-gray-400 text-xs text-center py-5">데이터 없음</li>
          ) : (
            preview.map((e) => (
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

      {/* 프로필 팝업 */}
      {selectedProfile && createPortal(
        <UserProfilePopup profile={selectedProfile} onClose={() => setSelectedProfile(null)} />,
        document.body,
      )}

      {/* 프로필 로딩 오버레이 */}
      {profileLoading && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>,
        document.body,
      )}

      {/* 전체 보기 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col max-h-[75vh]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">🏆 전체 랭킹</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
              >
                ✕
              </button>
            </div>
            {/* 모달 내 내 순위 카드 */}
            <MyRankCard myEntry={myEntry} list={list} tab={tab} total={list.length} compact />

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
              {list.length === 0 ? (
                <li className="text-gray-400 text-center py-10 text-sm">아직 데이터가 없습니다.</li>
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
    </>
  );
}
