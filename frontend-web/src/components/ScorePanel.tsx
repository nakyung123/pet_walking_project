'use client';

interface ScorePanelProps {
  score: number;
  tileCount: number;
  userName: string;
  location?: string;
  connected?: boolean;
  onLogout: () => void;
}

export default function ScorePanel({
  score, tileCount, userName, onLogout,
}: ScorePanelProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-10">
      <div
        className="mx-3 mt-3 bg-white/92 backdrop-blur-md rounded-[24px] shadow-lg px-5 py-4 grid grid-cols-3 items-center overflow-visible relative"
        style={{ minHeight: 64 }}
      >
        {/* 좌측: SVG 로고 + 펫국지 */}
        <div className="flex items-center gap-2 min-w-0">
          <img src="/footprint_logo.svg" alt="로고" style={{ height: 40 }} />
          <span className="text-base font-bold text-gray-900 whitespace-nowrap">펫국지</span>
        </div>

        {/* 중앙: 점수 pill + 원형 로고 + 이름 */}
        <div className="flex justify-center items-center overflow-visible">
          <div className="bg-gray-100 rounded-full flex items-center px-5 py-2 overflow-visible">
            <span className="text-base text-gray-600 whitespace-nowrap">
              내 점수: <span className="font-bold text-gray-900">{score.toLocaleString()}</span>
            </span>

            {/* 원형 로고 — placeholder 기준 absolute, pill 내 정확히 정렬 */}
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

        {/* 우측: 로그아웃 버튼 */}
        <div className="flex justify-end">
          <button
            onClick={onLogout}
            className="text-sm font-semibold text-red-500 bg-red-50 px-3 py-1.5 rounded-full border border-red-200 hover:bg-red-100 transition-colors whitespace-nowrap"
          >
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
