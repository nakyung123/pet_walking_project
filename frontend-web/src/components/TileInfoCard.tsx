'use client';

import { Tile } from './NaverMap';

interface TileInfoCardProps {
  tile: Tile | null;
  currentUserId: string;
  tileOwners: Record<string, string>;
  allTiles: Tile[];
  onClose: () => void;
  onViewProfile?: (userId: string) => void;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function DecayBadge({ lastMarkedAt }: { lastMarkedAt: string | null | undefined }) {
  if (!lastMarkedAt) return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
      ⏳ 감쇄 정보 없음
    </span>
  );

  const hoursElapsed = (Date.now() - new Date(lastMarkedAt).getTime()) / 3600000;

  if (hoursElapsed < 16) return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 rounded-full px-2 py-0.5 border border-green-200">
      ✅ 안전 · 마지막 마킹 {timeAgo(lastMarkedAt)}
    </span>
  );
  if (hoursElapsed < 24) return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 rounded-full px-2 py-0.5 border border-amber-200">
      ⚠️ 주의 · {Math.ceil(24 - hoursElapsed)}시간 후 감쇄
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-700 rounded-full px-2 py-0.5 border border-red-200">
      🔴 감쇄 중 · 매일 10% 차감
    </span>
  );
}

export default function TileInfoCard({
  tile, currentUserId, tileOwners, allTiles, onClose, onViewProfile,
}: TileInfoCardProps) {
  const isUnclaimed = !tile || !tile.occupantUserId;
  const isMyTile = !isUnclaimed && tile!.occupantUserId === currentUserId;
  const ownerUserId = tile?.occupantUserId ?? null;
  const ownerName = ownerUserId ? (tileOwners[ownerUserId] ?? '알 수 없음') : null;
  const ownerTileCount = ownerUserId
    ? allTiles.filter(t => t.occupantUserId === ownerUserId).length
    : 0;
  const myTileCount = allTiles.filter(t => t.occupantUserId === currentUserId).length;
  const score = tile?.occupancyScore ?? null;

  return (
    <div className="absolute bottom-[160px] left-0 right-0 z-20 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-xs bg-white/97 backdrop-blur-md rounded-2xl shadow-xl border border-gray-100 overflow-hidden">

        {/* 상태 헤더 */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            background: isUnclaimed
              ? 'linear-gradient(135deg, #6B7280, #4B5563)'
              : isMyTile
              ? 'linear-gradient(135deg, #FB923C, #F97316)'
              : 'linear-gradient(135deg, #EF4444, #DC2626)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">{isUnclaimed ? '📍' : isMyTile ? '🏠' : '⚔️'}</span>
            <span className="text-white font-bold text-sm">
              {isUnclaimed ? '미점령 구역' : isMyTile ? '내 영역' : `${ownerName}의 영역`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors text-xs"
          >✕</button>
        </div>

        {/* 본문 */}
        <div className="px-4 py-3 space-y-2.5">
          {isUnclaimed ? (
            <p className="text-xs text-gray-500">
              아무도 점유하지 않은 타일이에요. 지금 마킹하면 점유할 수 있어요!
            </p>
          ) : isMyTile ? (
            <>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-lg font-black text-orange-500">{score?.toLocaleString() ?? '-'}</p>
                  <p className="text-[10px] text-gray-400">점유 점수</p>
                </div>
                <div className="w-px bg-gray-100 self-stretch" />
                <div className="text-center">
                  <p className="text-lg font-black text-orange-400">{myTileCount}</p>
                  <p className="text-[10px] text-gray-400">내 타일 수</p>
                </div>
                <div className="w-px bg-gray-100 self-stretch" />
                <p className="text-[11px] text-gray-400 flex-1 leading-relaxed">
                  마킹할수록 점수가 쌓이고 타일을 지킬 수 있어요
                </p>
              </div>
              <DecayBadge lastMarkedAt={tile?.lastMarkedAt} />
            </>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="text-center shrink-0">
                  <p className="text-lg font-black text-red-500">{score?.toLocaleString() ?? '-'}</p>
                  <p className="text-[10px] text-gray-400">점유 점수</p>
                </div>
                <div className="w-px bg-gray-100 self-stretch" />
                <div className="text-center shrink-0">
                  <p className="text-lg font-black text-red-400">{ownerTileCount}</p>
                  <p className="text-[10px] text-gray-400">타일 수</p>
                </div>
                <div className="w-px bg-gray-100 self-stretch" />
                <p className="text-[11px] text-gray-400 flex-1 leading-relaxed">
                  더 많이 마킹하면 점유권을 가져올 수 있어요
                </p>
              </div>
              {tile?.lastMarkedAt && (
                <p className="text-[11px] text-gray-400">
                  마지막 마킹: {timeAgo(tile.lastMarkedAt)}
                </p>
              )}
              {onViewProfile && ownerUserId && (
                <button
                  onClick={() => onViewProfile(ownerUserId)}
                  className="w-full h-8 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  프로필 보기
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
