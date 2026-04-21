'use client';

import { useEffect, useState, useCallback } from 'react';
import { getLeaderboard, LeaderboardEntry, LeaderboardData } from '@/services/api';

interface LeaderboardProps {
  idToken: string;
  currentUserId: string;
}

const RANK_KO = ['1위', '2위', '3위'];
const sanitizeName = (name: string) =>
  name.replace(/[^\p{L}\p{N}\s]/gu, '').trim() || '알 수 없음';

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

function EntryRow({ entry, isMe, tab }: { entry: LeaderboardEntry; isMe: boolean; tab: Tab }) {
  const primary = tab === 'score' ? entry.totalScore : entry.tileCount;
  const unit    = tab === 'score' ? '점' : '개';
  const rankLabel = entry.rank <= 3 ? RANK_KO[entry.rank - 1] : `${entry.rank}위`;

  return (
    <li className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${
      isMe ? 'bg-blue-500/12 border border-blue-400/30' : ''
    }`}>
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
  const [data, setData]       = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  const [tab, setTab]         = useState<Tab>('score');

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

  const list    = data ? (tab === 'score' ? data.byScore : data.byTile) : [];
  const preview = list.slice(0, 5);

  return (
    <>
      {/* 우측 고정 패널 */}
      <div className="absolute bottom-8 right-3 z-20 w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden">
        {/* 헤더 */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">랭킹</span>
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-orange-500 font-semibold hover:text-orange-600 transition-colors"
          >
            전체보기 ↑
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1.5 px-4 pb-3">
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

        {/* 목록 */}
        <ul className="px-4 pb-4 space-y-1">
          {loading ? (
            <li className="flex justify-center py-5">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </li>
          ) : preview.length === 0 ? (
            <li className="text-gray-400 text-xs text-center py-5">데이터 없음</li>
          ) : (
            preview.map((e) => (
              <EntryRow key={e.userId} entry={e} isMe={e.userId === currentUserId} tab={tab} />
            ))
          )}
        </ul>
      </div>

      {/* 전체 보기 모달 */}
      {open && (
        <div className="absolute inset-0 z-40 flex items-center justify-center px-5">
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
            <div className="flex gap-1 px-4 pt-3 pb-2">
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
                  <EntryRow key={e.userId} entry={e} isMe={e.userId === currentUserId} tab={tab} />
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
