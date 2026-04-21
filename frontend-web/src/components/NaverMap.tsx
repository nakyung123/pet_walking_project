'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Tile {
  tileId: string;
  lat: number;
  lng: number;
  occupantUserId: string | null;
}

interface NaverMapProps {
  userId: string;
  tiles: Tile[];
  myPosition: { lat: number; lng: number } | null;
  initialPosition?: { lat: number; lng: number };
  pathCoords: { lat: number; lng: number }[];
  tileOwners?: Record<string, string>;
  onBoundsChange: (bounds: {
    minLat: number; maxLat: number; minLng: number; maxLng: number;
  }) => void;
  onCenterChange: (lat: number, lng: number) => void;
  onPositionOverride?: (lat: number, lng: number) => void;
}

declare global {
  interface Window { naver: typeof naver; }
}

const MY_FILL   = 'rgba(249, 115, 74, 0.62)';
const MY_STROKE = '#C2440A';
const HALF_LNG  = 0.000225 * 0.97;
const HALF_LAT  = 0.000225 * 0.7986 * 0.97;

// 상대 유저 색상 팔레트 [fill, stroke]
const RIVAL_COLORS: [string, string][] = [
  ['rgba(239,68,68,0.45)',  '#DC2626'],
  ['rgba(249,115,22,0.45)', '#EA580C'],
  ['rgba(34,197,94,0.45)',  '#16A34A'],
  ['rgba(6,182,212,0.45)',  '#0891B2'],
  ['rgba(139,92,246,0.45)', '#7C3AED'],
  ['rgba(236,72,153,0.45)', '#DB2777'],
  ['rgba(20,184,166,0.45)', '#0D9488'],
  ['rgba(245,158,11,0.45)', '#D97706'],
  ['rgba(99,102,241,0.45)', '#4F46E5'],
];

function hashIndex(uid: string, len: number): number {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) & 0xffff;
  return h % len;
}

/**
 * 인접한 타일들을 연결 성분별로 묶어 CCW 외곽 폴리곤 꼭짓점 배열을 반환.
 * tileId = "gx_gy" 형식. 반환값은 그리드 정수 좌표 배열.
 */
function buildBoundaryPolygons(tiles: Tile[]): [number, number][][] {
  if (tiles.length === 0) return [];

  const cellSet = new Set<string>();
  tiles.forEach(t => {
    const u = t.tileId.indexOf('_');
    cellSet.add(`${t.tileId.slice(0, u)},${t.tileId.slice(u + 1)}`);
  });

  // 방향별 경계 엣지 (CCW 외곽선 기준 방향)
  const graph = new Map<string, Set<string>>();
  const addEdge = (x1: number, y1: number, x2: number, y2: number) => {
    const k = `${x1},${y1}`;
    if (!graph.has(k)) graph.set(k, new Set());
    graph.get(k)!.add(`${x2},${y2}`);
  };

  cellSet.forEach(cell => {
    const c = cell.indexOf(',');
    const gx = parseInt(cell.slice(0, c), 10);
    const gy = parseInt(cell.slice(c + 1), 10);
    if (!cellSet.has(`${gx},${gy - 1}`)) addEdge(gx,     gy,     gx + 1, gy    );
    if (!cellSet.has(`${gx + 1},${gy}`)) addEdge(gx + 1, gy,     gx + 1, gy + 1);
    if (!cellSet.has(`${gx},${gy + 1}`)) addEdge(gx + 1, gy + 1, gx,     gy + 1);
    if (!cellSet.has(`${gx - 1},${gy}`)) addEdge(gx,     gy + 1, gx,     gy    );
  });

  const usedEdges = new Set<string>();
  const polygons: [number, number][][] = [];
  const ek = (x1: number, y1: number, x2: number, y2: number) => `${x1},${y1}→${x2},${y2}`;

  // 좌회전 우선으로 내부가 왼쪽에 오게 추적 (CCW)
  const nextVtx = (
    fx: number, fy: number, cx: number, cy: number, neighbors: Set<string>
  ): [number, number] | null => {
    const dx = cx - fx, dy = cy - fy;
    for (const [nx, ny] of [
      [cx - dy, cy + dx] as [number,number],  // 좌회전
      [cx + dx, cy + dy] as [number,number],  // 직진
      [cx + dy, cy - dx] as [number,number],  // 우회전
    ]) {
      if (neighbors.has(`${nx},${ny}`) && !usedEdges.has(ek(cx, cy, nx, ny))) return [nx, ny];
    }
    return null;
  };

  for (const [startKey, startNeighbors] of graph) {
    const sc = startKey.indexOf(',');
    const sx = parseInt(startKey.slice(0, sc), 10);
    const sy = parseInt(startKey.slice(sc + 1), 10);

    for (const firstKey of startNeighbors) {
      if (usedEdges.has(ek(sx, sy, ...firstKey.split(',').map(Number) as [number, number]))) continue;

      const fc = firstKey.indexOf(',');
      const fx0 = parseInt(firstKey.slice(0, fc), 10);
      const fy0 = parseInt(firstKey.slice(fc + 1), 10);

      const poly: [number, number][] = [[sx, sy]];
      usedEdges.add(ek(sx, sy, fx0, fy0));

      let fromX = sx, fromY = sy, curX = fx0, curY = fy0;
      let steps = 0;

      while ((curX !== sx || curY !== sy) && steps++ < 10000) {
        poly.push([curX, curY]);
        const nbrs = graph.get(`${curX},${curY}`);
        if (!nbrs) break;
        const next = nextVtx(fromX, fromY, curX, curY, nbrs);
        if (!next) break;
        usedEdges.add(ek(curX, curY, next[0], next[1]));
        fromX = curX; fromY = curY;
        [curX, curY] = next;
      }

      if (poly.length >= 3) polygons.push(poly);
    }
  }

  return polygons;
}

export default function NaverMap({
  userId, tiles, myPosition, initialPosition, pathCoords, tileOwners = {},
  onBoundsChange, onCenterChange, onPositionOverride,
}: NaverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<naver.maps.Map | null>(null);
  const polygsRef    = useRef<naver.maps.Polygon[]>([]);
  const labelsRef    = useRef<Map<string, naver.maps.Marker>>(new Map());
  const myMarkerRef  = useRef<naver.maps.Marker | null>(null);
  const polylineRef  = useRef<naver.maps.Polyline | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current || !initialPosition) return;

    const center = new window.naver.maps.LatLng(initialPosition.lat, initialPosition.lng);
    const map = new window.naver.maps.Map(containerRef.current, {
      center, zoom: 17, minZoom: 14, maxZoom: 20,
    });

    window.naver.maps.Event.addListener(map, 'idle', () => {
      const b = map.getBounds() as naver.maps.LatLngBounds;
      onBoundsChange({
        minLat: b.getSW().lat(), maxLat: b.getNE().lat(),
        minLng: b.getSW().lng(), maxLng: b.getNE().lng(),
      });
      const c = map.getCenter() as naver.maps.LatLng;
      onCenterChange(c.lat(), c.lng());
    });

    mapRef.current = map;
    setMapReady(true);
  }, [initialPosition, onBoundsChange, onCenterChange]);

  useEffect(() => {
    if (window.naver?.maps) initMap();
  }, [initMap]);

  // 타일 변경 시 폴리곤 + 라벨 재렌더
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.naver?.maps) return;

    // 기존 오버레이 제거
    polygsRef.current.forEach(p => p.setMap(null));
    polygsRef.current = [];
    labelsRef.current.forEach(m => m.setMap(null));
    labelsRef.current.clear();

    // 전체 타일에서 공통 기준점 계산 (모든 유저가 같은 좌표계를 공유해야 경계가 맞물림)
    const occupiedTiles = tiles.filter(t => t.occupantUserId);
    const globalRef = occupiedTiles[0];
    let toLatLng: (cx: number, cy: number) => naver.maps.LatLng = () => new window.naver.maps.LatLng(0, 0);
    if (globalRef) {
      const gu = globalRef.tileId.indexOf('_');
      const refGx = parseInt(globalRef.tileId.slice(0, gu), 10);
      const refGy = parseInt(globalRef.tileId.slice(gu + 1), 10);
      toLatLng = (cx: number, cy: number) => new window.naver.maps.LatLng(
        (globalRef.lat - HALF_LAT) + (cy - refGy) * 2 * HALF_LAT,
        (globalRef.lng - HALF_LNG) + (cx - refGx) * 2 * HALF_LNG,
      );
    }

    // 유저별 타일 그룹
    const groups = new Map<string, Tile[]>();
    tiles.forEach(tile => {
      if (!tile.occupantUserId) return;
      if (!groups.has(tile.occupantUserId)) groups.set(tile.occupantUserId, []);
      groups.get(tile.occupantUserId)!.push(tile);
    });

    groups.forEach((userTiles, uid) => {
      const isMine = uid === userId;
      const [fill, stroke] = isMine
        ? [MY_FILL, MY_STROKE]
        : RIVAL_COLORS[hashIndex(uid, RIVAL_COLORS.length)];

      // 병합 폴리곤 그리기
      buildBoundaryPolygons(userTiles).forEach(corners => {
        const polygon = new window.naver.maps.Polygon({
          map,
          paths: [corners.map(([cx, cy]) => toLatLng(cx, cy))] as unknown as naver.maps.ArrayOfCoords[],
          fillColor: fill,
          fillOpacity: 1,
          strokeColor: stroke,
          strokeWeight: 2,
          strokeOpacity: 1,
        });
        polygsRef.current.push(polygon);
      });

      // 상대 유저 라벨: GPS 핀 스타일
      if (isMine) return;
      const name = tileOwners[uid];
      if (!name) return;

      // 폴리곤과 동일한 좌표계로 타일 중심 평균 계산
      const avgGx = userTiles.reduce((s, t) => {
        const u = t.tileId.indexOf('_');
        return s + parseInt(t.tileId.slice(0, u), 10) + 0.5;
      }, 0) / userTiles.length;
      const avgGy = userTiles.reduce((s, t) => {
        const u = t.tileId.indexOf('_');
        return s + parseInt(t.tileId.slice(u + 1), 10) + 0.5;
      }, 0) / userTiles.length;
      const centerPos = toLatLng(avgGx, avgGy);

      const marker = new window.naver.maps.Marker({
        map,
        position: centerPos,
        icon: {
          content: `
            <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
              <div style="
                width:56px;height:56px;border-radius:50%;
                border:3px solid ${stroke};box-sizing:border-box;
                box-shadow:0 2px 10px rgba(0,0,0,0.45);
                overflow:hidden;background:white;
              ">
                <img src="https://place.dog/56/56?${uid.slice(0,6)}" alt="${name}"
                  style="width:100%;height:100%;object-fit:cover;"
                  onerror="this.style.display='none';this.parentNode.innerHTML='<div style=\\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:26px;\\'>🐕</div>'"
                />
              </div>
              <div style="
                margin-top:4px;
                background:rgba(17,24,39,0.88);backdrop-filter:blur(4px);
                color:white;padding:2px 8px;border-radius:10px;
                font-size:11px;font-weight:700;white-space:nowrap;
                box-shadow:0 2px 6px rgba(0,0,0,0.4);
              ">${name}</div>
              <div style="
                width:0;height:0;
                border-left:7px solid transparent;
                border-right:7px solid transparent;
                border-top:9px solid ${stroke};
                margin-top:2px;
              "></div>
            </div>`,
          anchor: new window.naver.maps.Point(28, 91),
        },
        zIndex: 10,
      });
      labelsRef.current.set(uid, marker);
    });
  }, [tiles, userId, mapReady, tileOwners]);

  // 내 위치 마커
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !myPosition || !window.naver?.maps) return;

    const pos = new window.naver.maps.LatLng(myPosition.lat, myPosition.lng);
    if (myMarkerRef.current) {
      myMarkerRef.current.setPosition(pos);
    } else {
      myMarkerRef.current = new window.naver.maps.Marker({
        map, position: pos,
        draggable: true,
        icon: {
          content: '<div style="width:14px;height:14px;border-radius:50%;background:#2196F3;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,.4);cursor:grab"></div>',
          anchor: new window.naver.maps.Point(7, 7),
        },
      });
      window.naver.maps.Event.addListener(myMarkerRef.current, 'dragend', () => {
        const p = myMarkerRef.current!.getPosition() as naver.maps.LatLng;
        onPositionOverride?.(p.lat(), p.lng());
      });
      map.panTo(pos);
    }
  }, [myPosition, mapReady]);

  // 산책 경로 폴리라인
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.naver?.maps || pathCoords.length < 2) return;

    const path = pathCoords.map(c => new window.naver.maps.LatLng(c.lat, c.lng));
    if (polylineRef.current) {
      polylineRef.current.setPath(path as unknown as naver.maps.ArrayOfCoords);
    } else {
      polylineRef.current = new window.naver.maps.Polyline({
        map,
        path: path as unknown as naver.maps.ArrayOfCoords,
        strokeColor: '#60A5FA',
        strokeWeight: 4,
        strokeOpacity: 0.8,
        strokeStyle: 'solid',
      });
    }
  }, [pathCoords, mapReady]);

  return (
    <>
      <Script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}`}
        strategy="afterInteractive"
        onLoad={initMap}
        onError={() => console.error('[NaverMap] 스크립트 로드 실패.')}
      />
      <div ref={containerRef} className="w-full h-full" />
    </>
  );
}
