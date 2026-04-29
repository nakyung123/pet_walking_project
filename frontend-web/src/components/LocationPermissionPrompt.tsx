'use client';

interface Props {
  onAllow: () => void;
  onDeny: () => void;
}

export default function LocationPermissionPrompt({ onAllow, onDeny }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8"
      style={{ background: 'linear-gradient(160deg, #FFF7ED 0%, #FFEDD5 60%, #FED7AA 100%)' }}
    >
      {/* 배경 장식 */}
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full opacity-30 -translate-x-1/3 -translate-y-1/3"
        style={{ background: 'radial-gradient(circle, #FB923C, transparent)' }} />
      <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-20 translate-x-1/4 translate-y-1/4"
        style={{ background: 'radial-gradient(circle, #F97316, transparent)' }} />

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-xs text-center">
        {/* 위치 아이콘 */}
        <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}>
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none" />
          </svg>
        </div>

        {/* 타이틀 */}
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800">위치 권한이 필요해요</h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            퍼피랜드는 내 위치를 기반으로<br />
            동네 영역을 점령하는 앱이에요.<br />
            위치 정보 없이는 게임을 즐길 수 없어요.
          </p>
        </div>

        {/* 안내 항목 */}
        <div className="w-full bg-white/70 rounded-2xl px-5 py-4 space-y-3 text-left">
          {[
            '현재 위치에서 타일을 점령해요',
            '내 산책 경로를 지도에 기록해요',
            '위치 정보는 게임 외 용도로 사용되지 않아요',
          ].map((text) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-xs text-gray-600">{text}</span>
            </div>
          ))}
        </div>

        {/* 버튼 */}
        <div className="w-full space-y-3">
          <button
            onClick={onAllow}
            className="w-full h-13 py-4 rounded-2xl text-white font-bold text-sm shadow-md active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
          >
            위치 허용하고 시작하기
          </button>
          <button
            onClick={onDeny}
            className="w-full py-2 text-xs text-gray-400"
          >
            나중에 허용할게요
          </button>
        </div>
      </div>
    </div>
  );
}
