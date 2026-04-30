'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { HintItem } from '@/components/ActionHint';

const HINT_STYLE: Record<HintItem['variant'], string> = {
  default: 'bg-white/95 border border-gray-200/80 text-gray-800',
  warning: 'bg-red-50 border border-red-200 text-red-700',
  gold:    'bg-amber-50 border border-amber-200 text-amber-800',
};

const CORE_RULES = [
  { step: '01', icon: '🦮', title: '산책 시작 & 자동 마킹', desc: '"산책 시작하기"를 누른 뒤 새로운 타일로 이동하면 자동으로 마킹됩니다. 많이 걸을수록 랭킹이 올라갑니다.' },
  { step: '02', icon: '🏆', title: '점유 & 경쟁', desc: '마킹 점수가 가장 높은 사람이 그 타일의 주인. 빼앗기면 알림이 와요!' },
  { step: '03', icon: '🚗', title: '속도 제한', desc: '15km/h 초과 시 마킹 자동 차단. 뛰거나 차를 타면 안 돼요.' },
];

const ALL_RULES = [
  { icon: '🗺️', title: '타일이란?', desc: '지도를 50m × 50m 격자로 나눈 구역이에요. 각 타일은 한 명만 점유할 수 있고, 타일 색이 곧 주인의 색입니다.' },
  { icon: '🦮', title: '산책 시작 & 자동 마킹', desc: '"산책 시작하기"를 눌러 세션을 시작하세요. 새로운 타일로 이동하면 자동으로 마킹되어 체류시간 + 보너스 점수가 쌓입니다.' },
  { icon: '🏆', title: '점유 & 경쟁', desc: '내 타일은 주황색, 경쟁자 타일은 다른 색으로 표시됩니다. 상대방이 더 많이 마킹하면 타일을 빼앗겨요. 타일을 클릭하면 누가 점유 중인지 확인할 수 있어요.' },
  { icon: '⏳', title: '감쇄 시스템', desc: '24시간 동안 마킹이 없으면 매일 자정에 점수가 10%씩 줄어듭니다. 점수가 0이 되면 점유가 해제돼요. 꾸준히 산책하세요!' },
  { icon: '🚗', title: '속도 제한', desc: '이동 속도가 15km/h를 넘으면 마킹이 자동 차단됩니다. 뛰거나 탈것을 타면 적용되지 않아요.' },
  { icon: '📍', title: '타일 프리뷰', desc: '산책 중 내 위치의 타일이 지도에 노란색 점선으로 미리 표시됩니다.' },
];

export default function OnboardingGuide({ hints = [] }: { hints?: HintItem[] }) {
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
              <p className="text-white font-bold text-lg">🐕 퍼피랜드 환영해요!</p>
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
                시작하기
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

      {/* 접힌 상태 카드 + 힌트 */}
      {!expanded && (
        <div className="absolute top-[116px] left-3 z-20 flex flex-col gap-2 items-start">
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 bg-white/92 backdrop-blur-md rounded-2xl shadow-lg px-4 py-3 hover:bg-white transition-colors active:scale-95"
          >
            <span className="text-base">🐕</span>
            <span className="text-sm font-bold text-gray-800">이용 가이드</span>
            <span className="text-xs text-gray-400 border border-gray-300 rounded-full w-4 h-4 flex items-center justify-center leading-none">?</span>
          </button>
          {hints.map((hint, i) => (
            <div
              key={i}
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 shadow-sm backdrop-blur-sm ${HINT_STYLE[hint.variant]}`}
            >
              <span className="text-sm leading-none">{hint.icon}</span>
              <span className="text-xs font-semibold whitespace-nowrap">{hint.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* 펼친 상태 패널 + 힌트 */}
      {expanded && (
        <div className="absolute top-[116px] left-3 z-20 flex flex-col gap-2 items-start">
          <div className="w-72 bg-white/92 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden">
            <div className="px-4 pt-3.5 pb-2.5 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800">🐕 퍼피랜드 이용 가이드</p>
              <button
                onClick={() => setExpanded(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors text-xs"
              >
                ✕
              </button>
            </div>
            <ul className="px-4 py-3.5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              {ALL_RULES.map((rule, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-lg shrink-0 mt-0.5">{rule.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-gray-800">{rule.title}</p>
                    {rule.desc && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{rule.desc}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {hints.map((hint, i) => (
            <div
              key={i}
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 shadow-sm backdrop-blur-sm ${HINT_STYLE[hint.variant]}`}
            >
              <span className="text-sm leading-none">{hint.icon}</span>
              <span className="text-xs font-semibold whitespace-nowrap">{hint.text}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
