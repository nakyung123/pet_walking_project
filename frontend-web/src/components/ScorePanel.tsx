'use client';

interface ScorePanelProps {
  score: number;
  tileCount: number;
  userName: string;
}

export default function ScorePanel({ score, tileCount, userName }: ScorePanelProps) {
  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between bg-gray-900/80 backdrop-blur-sm rounded-2xl px-5 py-3 text-white shadow-lg">
      <div>
        <p className="text-xs text-gray-400 leading-none">점수</p>
        <p className="text-2xl font-bold text-yellow-400 leading-tight">{score.toLocaleString()}</p>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold truncate max-w-[120px]">{userName}</p>
        <p className="text-xs text-gray-400">{tileCount} 타일 점유 중</p>
      </div>

      <div className="text-right">
        <p className="text-xs text-gray-400 leading-none">🐾 Pet Territory</p>
      </div>
    </div>
  );
}
