'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window { naver: typeof naver; }
}

interface PetData {
  name: string;
  photoUrl?: string;
  weight: number;
}

export interface WalkSummaryData {
  seconds: number;
  distance: number;
  scoreGained: number;
  tilesGained: number;
  pathCoords: { lat: number; lng: number }[];
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

function formatDate(): string {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일`;
}

function calcCalories(weight: number, seconds: number): number {
  return Math.round((0.8 / 0.453) * weight * (seconds / 3600));
}

function initRouteOnMap(
  map: naver.maps.Map,
  coords: { lat: number; lng: number }[],
) {
  if (coords.length >= 2) {
    new window.naver.maps.Polyline({
      map,
      path: coords.map((c) => new window.naver.maps.LatLng(c.lat, c.lng)),
      strokeColor: '#60A5FA',
      strokeWeight: 4,
      strokeLineCap: 'round' as naver.maps.StrokeLineCapType,
      strokeLineJoin: 'round' as naver.maps.StrokeLineJoinType,
    });

    new window.naver.maps.Marker({
      map,
      position: new window.naver.maps.LatLng(coords[0].lat, coords[0].lng),
      icon: {
        content: '<div style="width:12px;height:12px;border-radius:50%;background:#34D399;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
        anchor: new window.naver.maps.Point(6, 6),
      },
    });

    const last = coords[coords.length - 1];
    new window.naver.maps.Marker({
      map,
      position: new window.naver.maps.LatLng(last.lat, last.lng),
      icon: {
        content: '<div style="width:12px;height:12px;border-radius:50%;background:#F97316;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
        anchor: new window.naver.maps.Point(6, 6),
      },
    });

    const bounds = new window.naver.maps.LatLngBounds(
      new window.naver.maps.LatLng(
        Math.min(...coords.map((c) => c.lat)),
        Math.min(...coords.map((c) => c.lng)),
      ),
      new window.naver.maps.LatLng(
        Math.max(...coords.map((c) => c.lat)),
        Math.max(...coords.map((c) => c.lng)),
      ),
    );
    map.fitBounds(bounds, { top: 60, right: 40, bottom: 40, left: 40 });
  } else if (coords.length === 1) {
    new window.naver.maps.Marker({
      map,
      position: new window.naver.maps.LatLng(coords[0].lat, coords[0].lng),
      icon: {
        content: '<div style="width:12px;height:12px;border-radius:50%;background:#F97316;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>',
        anchor: new window.naver.maps.Point(6, 6),
      },
    });
  }
}

function MiniMapRoute({
  coords,
  onClick,
}: {
  coords: { lat: number; lng: number }[];
  onClick: () => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current || !window.naver?.maps) return;

    const center = coords.length > 0
      ? {
          lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
          lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
        }
      : { lat: 37.5665, lng: 126.978 };

    const map = new window.naver.maps.Map(divRef.current, {
      center: new window.naver.maps.LatLng(center.lat, center.lng),
      zoom: 17,
      mapTypeControl: false,
      zoomControl: false,
      scaleControl: false,
      logoControl: false,
      mapDataControl: false,
      draggable: false,
      scrollWheel: false,
      disableDoubleClickZoom: true,
    });

    initRouteOnMap(map, coords);

    return () => { map.destroy(); };
  }, [coords]);

  return (
    <div className="relative w-full h-40 rounded-2xl overflow-hidden cursor-pointer group" onClick={onClick}>
      <div ref={divRef} className="w-full h-full" />
      {/* 확대 힌트 오버레이 */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-2xl">
        <div className="bg-white/90 rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow">
          <span className="text-xs font-bold text-gray-700">크게 보기</span>
        </div>
      </div>
    </div>
  );
}

function FullRouteMap({
  coords,
  onClose,
}: {
  coords: { lat: number; lng: number }[];
  onClose: () => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current || !window.naver?.maps) return;

    const center = coords.length > 0
      ? {
          lat: coords.reduce((s, c) => s + c.lat, 0) / coords.length,
          lng: coords.reduce((s, c) => s + c.lng, 0) / coords.length,
        }
      : { lat: 37.5665, lng: 126.978 };

    const map = new window.naver.maps.Map(divRef.current, {
      center: new window.naver.maps.LatLng(center.lat, center.lng),
      zoom: 17,
      mapTypeControl: false,
      zoomControl: true,
      zoomControlOptions: {
        position: window.naver.maps.Position.RIGHT_CENTER,
      },
      scaleControl: false,
      logoControl: false,
      mapDataControl: false,
    });

    initRouteOnMap(map, coords);

    return () => { map.destroy(); };
  }, [coords]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      <div ref={divRef} className="flex-1" />
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-700 active:scale-95 transition-transform"
      >
        ✕
      </button>
    </div>
  );
}

interface WalkSummaryModalProps {
  summary: WalkSummaryData;
  onClose: () => void;
  isPast?: boolean;
  dateLabel?: string;
}

function formatPastDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${y}년 ${m}월 ${d}일 ${days[date.getDay()]}요일`;
}

export default function WalkSummaryModal({ summary, onClose, isPast, dateLabel }: WalkSummaryModalProps) {
  const [pet, setPet] = useState<PetData>({ name: '우리 강아지', weight: 5 });
  const [showFullMap, setShowFullMap] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('petProfiles');
      const idxStr = localStorage.getItem('activePetIdx');
      if (saved) {
        const arr = JSON.parse(saved);
        const idx = idxStr ? Math.min(Number(idxStr), arr.length - 1) : 0;
        const parsed = arr[idx];
        if (parsed) {
          setPet({
            name: parsed.name || '우리 강아지',
            photoUrl: parsed.photoUrl,
            weight: parsed.weight || 5,
          });
          return;
        }
      }
      // 구버전 fallback
      const legacy = localStorage.getItem('petProfile');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        setPet({ name: parsed.name || '우리 강아지', photoUrl: parsed.photoUrl, weight: parsed.weight || 5 });
      }
    } catch {}
  }, []);

  const calories = calcCalories(pet.weight, summary.seconds);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-y-auto scrollbar-hide">

          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
            <div>
              <p className="text-xs text-gray-400">
                {dateLabel ? formatPastDate(dateLabel) : formatDate()}
              </p>
              <p className="text-base font-bold text-gray-900 mt-0.5">
                {isPast ? '이 날의 산책 기록 🐾' : '오늘도 건실히 땅을 지켜냈다! 🐕'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors shrink-0"
            >
              ✕
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* 강아지와 함께 */}
            <div className="flex items-center gap-3 bg-orange-50 rounded-2xl px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 border-2 border-orange-200 overflow-hidden flex items-center justify-center shrink-0">
                {pet.photoUrl ? (
                  <img src={pet.photoUrl} alt={pet.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">🐶</span>
                )}
              </div>
              <p className="text-sm font-bold text-gray-800">
                <span className="text-orange-500">{pet.name}</span>와 함께 산책했어요!
              </p>
            </div>

            {/* 산책 통계 */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '산책시간', value: formatTime(summary.seconds), icon: '⏱' },
                {
                  label: '거리',
                  value: summary.distance >= 1
                    ? `${summary.distance.toFixed(2)}km`
                    : `${Math.round(summary.distance * 1000)}m`,
                  icon: '📍',
                },
                { label: '칼로리', value: `${calories}kcal`, icon: '🔥' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-gray-50 rounded-2xl px-3 py-3 text-center">
                  <p className="text-lg">{icon}</p>
                  <p className="text-xs font-bold text-gray-900 mt-1">{value}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* 이동 경로 */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">산책 이동 경로</p>
              <MiniMapRoute
                coords={summary.pathCoords}
                onClick={() => setShowFullMap(true)}
              />
            </div>

            {/* 획득 결과 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-blue-50 rounded-2xl px-4 py-3">
                <span className="text-sm text-gray-600">
                  {isPast ? '이 날 산책 획득 점수' : '이번 산책 획득 점수'}
                </span>
                <span className="text-sm font-bold text-blue-600">
                  +{summary.scoreGained.toLocaleString()}점
                </span>
              </div>
              <div className="flex items-center justify-between bg-orange-50 rounded-2xl px-4 py-3">
                <span className="text-sm text-gray-600">
                  {isPast ? '이 날 산책 획득 영역' : '이번 산책 획득 영역'}
                </span>
                <span className="text-sm font-bold text-orange-600">
                  {summary.tilesGained}개 타일
                </span>
              </div>
            </div>
          </div>

          {/* 확인 버튼 */}
          <div className="px-5 pb-5 shrink-0">
            <button
              onClick={onClose}
              className="w-full h-11 rounded-2xl text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #FB923C, #F97316)' }}
            >
              확인
            </button>
          </div>
        </div>
      </div>

      {/* 전체 화면 경로 지도 */}
      {showFullMap && (
        <FullRouteMap
          coords={summary.pathCoords}
          onClose={() => setShowFullMap(false)}
        />
      )}
    </>
  );
}
