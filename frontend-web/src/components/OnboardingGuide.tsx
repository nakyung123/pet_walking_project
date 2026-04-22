'use client';

const RULES = [
  {
    icon: '🗺️',
    title: '타일이란?',
    desc: '지도를 약 50m × 50m 격자로 나눈 구역입니다. 각 타일은 한 명의 플레이어만 점유할 수 있어요.',
  },
  {
    icon: '🐾',
    title: '산책 시작 & 마킹',
    desc: '"산책 시작하기" 버튼을 누른 뒤, 현재 위치 타일에서 "마킹하기"를 눌러 점수를 쌓으세요. 점수가 가장 높은 플레이어가 그 타일을 점유합니다.',
  },
  {
    icon: '🏆',
    title: '점유 & 경쟁',
    desc: '내 타일은 주황색, 경쟁자 타일은 다른 색으로 표시됩니다. 누군가 더 많이 마킹하면 점유권을 빼앗길 수 있어요.',
  },
  {
    icon: '⏳',
    title: '감쇄',
    desc: '산책을 쉬면 점유 점수가 매일 조금씩 줄어듭니다. 꾸준히 산책해야 영역을 지킬 수 있어요.',
  },
  {
    icon: '🚗',
    title: '속도 제한',
    desc: '이동 속도가 15km/h를 넘으면 마킹이 자동으로 차단됩니다. 반드시 걸어서 마킹하세요!',
  },
  {
    icon: '📍',
    title: '타일 프리뷰',
    desc: '내 위치에서 마킹 시 점유될 타일이 지도에 미리 노란색으로 표시됩니다. 확인하고 마킹하세요.',
  },
];

export default function OnboardingGuide() {
  return (
    <div className="absolute top-[116px] left-3 z-20 w-72 bg-white/92 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-800">🐕 펫국지 이용 가이드</p>
      </div>
      <ul className="px-4 py-3.5 space-y-4 max-h-[480px] overflow-y-auto scrollbar-hide">
        {RULES.map((rule, i) => (
          <li key={i} className="flex gap-3">
            <span className="text-lg shrink-0 mt-0.5">{rule.icon}</span>
            <div>
              <p className="text-xs font-bold text-gray-800">{rule.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{rule.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
