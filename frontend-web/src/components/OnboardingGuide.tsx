'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const CORE_RULES = [
  { step: '01', icon: '🐾', title: '산책 시작 & 마킹', desc: '"산책 시작" 후 현재 위치에서 "마킹"을 눌러 점수를 쌓으세요.' },
  { step: '02', icon: '🏆', title: '점유 & 경쟁', desc: '가장 많이 마킹한 사람이 타일 소유. 빼앗길 수 있어요!' },
  { step: '03', icon: '🚗', title: '속도 제한', desc: '15km/h 초과 시 마킹 자동 차단. 반드시 걸어서 마킹하세요.' },
];

const ALL_RULES = [
  { icon: '🗺️', title: '타일이란?', desc: '지도를 약 50m × 50m 격자로 나눈 구역입니다. 각 타일은 한 명의 플레이어만 점유할 수 있어요.' },
  { icon: '🐾', title: '산책 시작 & 마킹', desc: '"산책 시작하기" 버튼을 누른 뒤, 현재 위치 타일에서 "마킹하기"를 눌러 점수를 쌓으세요. 점수가 가장 높은 플레이어가 그 타일을 점유합니다.' },
  { icon: '🏆', title: '점유 & 경쟁', desc: '내 타일은 주황색, 경쟁자 타일은 다른 색으로 표시됩니다. 누군가 더 많이 마킹하면 점유권을 빼앗길 수 있어요.' },
  { icon: '⏳', title: '감쇄', desc: '산책을 쉬면 점유 점수가 매일 조금씩 줄어듭니다. 꾸준히 산책해야 영역을 지킬 수 있어요.' },
  { icon: '🚗', title: '속도 제한', desc: '이동 속도가 15km/h를 넘으면 마킹이 자동으로 차단됩니다. 반드시 걸어서 마킹하세요!' },
  { icon: '📍', title: '타일 프리뷰', desc: '내 위치에서 마킹 시 점유될 타일이 지도에 미리 노란색으로 표시됩니다. 확인하고 마킹하세요.' },
];

export default function OnboardingGuide() {
  const [expanded, setExpanded] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const visited = localStorage.getItem('guideVisited');
    if (!visited) {
      setShowOverlay(true);
      localStorage.setItem('guideVisited', '1');
    }
  }, []);

  return (
    <>
      {/* 첫 방문 오버레이 */}
      {mounted && showOverlay && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-xs bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div
              className="h-20 flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
            >
              <p className="text-white font-bold text-lg">🐕 펫국지 환영해요!</p>
              <p className="text-white/80 text-xs mt-1">핵심 규칙 3가지만 알면 시작할 수 있어요</p>
            </div>

            <div className="px-6 pt-5 pb-6 space-y-4">
              {CORE_RULES.map((rule) => (
                <div key={rule.step} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {rule.step}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-800">{rule.icon} {rule.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{rule.desc}</p>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setShowOverlay(false)}
                className="w-full mt-2 h-11 rounded-full text-sm font-bold text-white active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
              >
                시작하기 🐾
              </button>
              <button
                onClick={() => { setShowOverlay(false); setExpanded(true); }}
                className="w-full text-xs text-gray-400 text-center hover:text-gray-600 transition-colors pb-1"
              >
                자세히 보기
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* 접힌 상태 카드 */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="absolute top-[116px] left-3 z-20 flex items-center gap-2 bg-white/92 backdrop-blur-md rounded-2xl shadow-lg px-4 py-3 hover:bg-white transition-colors active:scale-95"
        >
          <span className="text-base">🐕</span>
          <span className="text-sm font-bold text-gray-800">이용 가이드</span>
          <span className="text-xs text-gray-400 border border-gray-300 rounded-full w-4 h-4 flex items-center justify-center leading-none">?</span>
        </button>
      )}

      {/* 펼친 상태 패널 */}
      {expanded && (
        <div className="absolute top-[116px] left-3 z-20 w-72 bg-white/92 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden">
          <div className="px-4 pt-3.5 pb-2.5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-800">🐕 펫국지 이용 가이드</p>
            <button
              onClick={() => setExpanded(false)}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
          <ul className="px-4 py-3.5 space-y-4 max-h-[480px] overflow-y-auto scrollbar-hide">
            {ALL_RULES.map((rule, i) => (
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
      )}
    </>
  );
}
