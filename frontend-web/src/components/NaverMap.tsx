'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Tile {
  tileId: string;
  lat: number;
  lng: number;
  occupantUserId: string | null;
  occupancyScore?: number;
  lastMarkedAt?: string | null;
}

interface NaverMapProps {
  userId: string;
  tiles: Tile[];
  myPosition: { lat: number; lng: number } | null;
  initialPosition?: { lat: number; lng: number };
  tileOwners?: Record<string, string>;
  previewPosition?: { lat: number; lng: number } | null;
  walkPathCoords?: { lat: number; lng: number }[];
  onBoundsChange: (bounds: {
    minLat: number; maxLat: number; minLng: number; maxLng: number;
  }) => void;
  onCenterChange: (lat: number, lng: number) => void;
  onPositionOverride?: (lat: number, lng: number) => void;
  onUserClick?: (userId: string) => void;
  onTileClick?: (tile: Tile | null, lat: number, lng: number) => void;
  highlightLatLng?: { lat: number; lng: number } | null;
  flyTo?: { lat: number; lng: number; zoom: number } | null;
  visibleRivalUserId?: string | null;
  showAllRivals?: boolean;
}

declare global {
  interface Window { naver: typeof naver; }
}

// 내 타일 색상: 감쇄 상태에 따라 녹색→노란→빨강
function getMyTileStatus(lastMarkedAt: string | null | undefined): 'green' | 'yellow' | 'red' {
  if (!lastMarkedAt) return 'green';
  const hoursSince = (Date.now() - new Date(lastMarkedAt).getTime()) / (1000 * 60 * 60);
  if (hoursSince < 20) return 'green';
  if (hoursSince < 30) return 'yellow';
  return 'red';
}

const MY_TILE_COLORS: Record<string, [string, string]> = {
  green:  ['rgba(74, 222, 128, 0.62)', '#16A34A'],
  yellow: ['rgba(250, 204, 21, 0.62)',  '#CA8A04'],
  red:    ['rgba(239, 68, 68, 0.62)',   '#DC2626'],
};

// 줌 레벨별 강아지 마커 크기
function getIconSize(zoom: number): number {
  if (zoom >= 18) return 52;
  if (zoom >= 17) return 44;
  if (zoom >= 16) return 36;
  if (zoom >= 15) return 28;
  return 22;
}
// Web Mercator (EPSG:3857) 변환
const R = 6378137;
const TILE_M = 50;
const lngToX = (lng: number) => (lng * Math.PI / 180) * R;
const latToY = (lat: number) => Math.log(Math.tan((90 + lat) * Math.PI / 360)) * R;
const xToLng = (x: number) => (x / R) * 180 / Math.PI;
const yToLat = (y: number) => (Math.atan(Math.exp(y / R)) * 360 / Math.PI) - 90;

function calcPreviewCorners(lat: number, lng: number): [number, number][] {
  const mx = lngToX(lng);
  const my = latToY(lat);
  const gx = Math.floor(mx / TILE_M);
  const gy = Math.floor(my / TILE_M);
  return [
    [xToLng(gx * TILE_M),        yToLat(gy * TILE_M)],
    [xToLng((gx + 1) * TILE_M),  yToLat(gy * TILE_M)],
    [xToLng((gx + 1) * TILE_M),  yToLat((gy + 1) * TILE_M)],
    [xToLng(gx * TILE_M),        yToLat((gy + 1) * TILE_M)],
  ];
}

// 상대 유저 색상 팔레트 [fill, stroke]
// 내 타일 색(녹색·노란색·빨간색)과 겹치지 않는 색상만 사용
const RIVAL_COLORS: [string, string][] = [
  ['rgba(249,115,22,0.45)', '#EA580C'],
  ['rgba(6,182,212,0.45)',  '#0891B2'],
  ['rgba(139,92,246,0.45)', '#7C3AED'],
  ['rgba(236,72,153,0.45)', '#DB2777'],
  ['rgba(20,184,166,0.45)', '#0D9488'],
  ['rgba(99,102,241,0.45)', '#4F46E5'],
  ['rgba(14,165,233,0.45)', '#0284C7'],
];

function hashIndex(uid: string, len: number): number {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) & 0xffff;
  return h % len;
}

/**
 * 인접한 타일들을 연결 성분별로 묶어 CCW 외곽 폴리곤 꼭짓점 배열을 반환.
 */
function buildBoundaryPolygons(tiles: Tile[]): [number, number][][] {
  if (tiles.length === 0) return [];

  const cellSet = new Set<string>();
  tiles.forEach(t => {
    const u = t.tileId.indexOf('_');
    cellSet.add(`${t.tileId.slice(0, u)},${t.tileId.slice(u + 1)}`);
  });

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

  const nextVtx = (
    fx: number, fy: number, cx: number, cy: number, neighbors: Set<string>
  ): [number, number] | null => {
    const dx = cx - fx, dy = cy - fy;
    for (const [nx, ny] of [
      [cx - dy, cy + dx] as [number,number],
      [cx + dx, cy + dy] as [number,number],
      [cx + dy, cy - dx] as [number,number],
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

/** 폴리곤 코너를 살짝 깎아 라운드 효과를 냄 */
function roundPolygon(pts: naver.maps.LatLng[]): naver.maps.LatLng[] {
  return pts;
}

function findTileByLatLng(lat: number, lng: number, tileList: Tile[]): Tile | null {
  const mx = lngToX(lng);
  const my = latToY(lat);
  const gx = Math.floor(mx / TILE_M);
  const gy = Math.floor(my / TILE_M);
  const tileId = `${gx}_${gy}`;
  return tileList.find(t => t.tileId === tileId) ?? null;
}

// 항상 핀 스타일로 상대 유저 표시
const getPinContent = (stroke: string) =>
  `<div style="width:30px;height:30px;border-radius:50%;background:${stroke};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;pointer-events:auto;display:flex;align-items:center;justify-content:center;">
    <img src="/bichon.png" style="width:20px;height:20px;object-fit:contain;" />
  </div>`;

function getDogMarkerHTML(deg: number, size: number = 52): string {
  return `<div style="cursor:grab;filter:drop-shadow(0 3px 8px rgba(33,150,243,0.6));display:inline-block;transform:rotate(${deg}deg);transition:transform 0.3s ease;transform-origin:center center;width:${size}px;height:${size}px">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 24" width="${size}" height="${size}"
         style="image-rendering:pixelated;image-rendering:crisp-edges;display:block">
      <!-- 비숑 왼쪽 귀 (옆으로 늘어지는 플랩형, 위에서 내려다보기) -->
      <rect x="0" y="2" width="1" height="6" fill="#C8A87A"/>
      <rect x="1" y="1" width="3" height="8" fill="#D4B88A"/>
      <rect x="4" y="1" width="1" height="7" fill="#C8A87A"/>
      <!-- 비숑 오른쪽 귀 -->
      <rect x="17" y="1" width="1" height="7" fill="#C8A87A"/>
      <rect x="18" y="1" width="3" height="8" fill="#D4B88A"/>
      <rect x="21" y="2" width="1" height="6" fill="#C8A87A"/>
      <!-- 머리 흰 털 가장자리 -->
      <rect x="5" y="0" width="12" height="1" fill="#C8C3BA"/>
      <rect x="4" y="1" width="14" height="1" fill="#D0CBC2"/>
      <rect x="4" y="8" width="14" height="1" fill="#C8C3BA"/>
      <!-- 머리 흰 털 내부 -->
      <rect x="4" y="1" width="14" height="8" fill="#F8F5F0"/>
      <!-- 눈 (검고 뚜렷) -->
      <rect x="6" y="2" width="3" height="3" fill="#0D0D0D"/>
      <rect x="13" y="2" width="3" height="3" fill="#0D0D0D"/>
      <!-- 눈 하이라이트 -->
      <rect x="6" y="2" width="1" height="1" fill="#555555"/>
      <rect x="13" y="2" width="1" height="1" fill="#555555"/>
      <!-- 코 -->
      <rect x="9" y="6" width="4" height="2" fill="#1A1210"/>
      <!-- 목줄 (파란색) -->
      <rect x="4" y="9" width="14" height="2" fill="#2196F3"/>
      <!-- 몸통 흰 털 -->
      <rect x="5" y="11" width="12" height="8" fill="#F8F5F0"/>
      <rect x="4" y="12" width="14" height="6" fill="#F8F5F0"/>
      <!-- 몸통 털 가장자리 -->
      <rect x="3" y="12" width="1" height="6" fill="#D0CBC2"/>
      <rect x="18" y="12" width="1" height="6" fill="#D0CBC2"/>
      <rect x="4" y="11" width="14" height="1" fill="#D0CBC2"/>
      <rect x="4" y="19" width="14" height="1" fill="#D0CBC2"/>
      <!-- 앞 왼쪽 다리 (페어 A) -->
      <g style="animation:dk-pa 0.38s ease-in-out infinite;transform-origin:2px 13px">
        <rect x="1" y="12" width="3" height="3" fill="#EDE9E2"/>
      </g>
      <!-- 앞 오른쪽 다리 (페어 B) -->
      <g style="animation:dk-pb 0.38s ease-in-out infinite;transform-origin:20px 13px">
        <rect x="18" y="12" width="3" height="3" fill="#EDE9E2"/>
      </g>
      <!-- 뒤 왼쪽 다리 (페어 B) -->
      <g style="animation:dk-pb 0.38s ease-in-out infinite;transform-origin:2px 16px">
        <rect x="1" y="15" width="3" height="3" fill="#EDE9E2"/>
      </g>
      <!-- 뒤 오른쪽 다리 (페어 A) -->
      <g style="animation:dk-pa 0.38s ease-in-out infinite;transform-origin:20px 16px">
        <rect x="18" y="15" width="3" height="3" fill="#EDE9E2"/>
      </g>
      <!-- 꼬리: 위에서 본 말린 원형 -->
      <g style="animation:dk-tw 0.5s ease-in-out infinite;transform-origin:11px 21px">
        <rect x="7" y="20" width="8" height="1" fill="#D0CBC2"/>
        <rect x="6" y="21" width="2" height="2" fill="#D0CBC2"/>
        <rect x="14" y="21" width="2" height="2" fill="#D0CBC2"/>
        <rect x="7" y="22" width="8" height="1" fill="#D0CBC2"/>
        <rect x="8" y="21" width="6" height="2" fill="#F8F5F0"/>
      </g>
    </svg>
  </div>`;
}

export default function NaverMap({
  userId, tiles, myPosition, initialPosition, tileOwners = {},
  previewPosition, walkPathCoords = [], highlightLatLng,
  onBoundsChange, onCenterChange, onPositionOverride, onUserClick, onTileClick,
  flyTo, visibleRivalUserId, showAllRivals = false,
}: NaverMapProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<naver.maps.Map | null>(null);
  const polygsRef       = useRef<naver.maps.Polygon[]>([]);
  const labelsRef       = useRef<Map<string, naver.maps.Marker>>(new Map());
  const markerMetaRef   = useRef<Map<string, { colorIdx: number; name: string }>>(new Map());
  const myMarkerRef     = useRef<naver.maps.Marker | null>(null);
  const previewPolyRef  = useRef<naver.maps.Polygon | null>(null);
  const walkPolylineRef = useRef<naver.maps.Polyline | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapZoom, setMapZoom] = useState(17);
  const highlightPolyRef = useRef<naver.maps.Polygon | null>(null);
  const warningMarkersRef = useRef<naver.maps.Marker[]>([]);
  const tilesRef = useRef<Tile[]>(tiles);
  const onTileClickRef = useRef(onTileClick);
  const prevPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const headingRef = useRef<number>(0);
  const hasDraggedRef = useRef<boolean>(false);

  useEffect(() => { tilesRef.current = tiles; }, [tiles]);
  useEffect(() => { onTileClickRef.current = onTileClick; }, [onTileClick]);

  // 강아지 걷기 CSS 애니메이션 한 번만 주입
  useEffect(() => {
    if (document.getElementById('dk-walk-style')) return;
    const s = document.createElement('style');
    s.id = 'dk-walk-style';
    s.textContent = `
      @keyframes dk-pa{0%,100%{transform:translateY(-2px)}50%{transform:translateY(2px)}}
      @keyframes dk-pb{0%,100%{transform:translateY(2px)}50%{transform:translateY(-2px)}}
      @keyframes dk-tw{0%,100%{transform:rotate(-25deg)}50%{transform:rotate(25deg)}}
    `;
    document.head.appendChild(s);
  }, []);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current || !initialPosition) return;

    const center = new window.naver.maps.LatLng(initialPosition.lat, initialPosition.lng);
    const map = new window.naver.maps.Map(containerRef.current, {
      center, zoom: 17, minZoom: 14, maxZoom: 21,
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

    window.naver.maps.Event.addListener(map, 'click', (e: { coord: naver.maps.LatLng }) => {
      const lat = e.coord.lat();
      const lng = e.coord.lng();
      const found = findTileByLatLng(lat, lng, tilesRef.current);
      onTileClickRef.current?.(found, lat, lng);
    });

    window.naver.maps.Event.addListener(map, 'zoom_changed', () => {
      setMapZoom(map.getZoom() as number);
    });

    mapRef.current = map;
    setMapReady(true);
  }, [initialPosition, onBoundsChange, onCenterChange]);

  useEffect(() => {
    if (window.naver?.maps) initMap();
  }, [initMap]);

  // 스크립트가 이미 로드된 상태에서 GPS가 뒤늦게 들어오면 initMap 재시도
  useEffect(() => {
    if (!mapRef.current && initialPosition && window.naver?.maps) initMap();
  }, [initialPosition, initMap]);

  // 현재 위치로 이동
  useEffect(() => {
    if (!flyTo || !mapRef.current || !window.naver?.maps) return;
    mapRef.current.setCenter(new window.naver.maps.LatLng(flyTo.lat, flyTo.lng));
    mapRef.current.setZoom(flyTo.zoom);
  }, [flyTo]);

  // 타일 변경 시 폴리곤 + 라벨 재렌더
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.naver?.maps) return;

    // 기존 오버레이 제거
    polygsRef.current.forEach(p => p.setMap(null));
    polygsRef.current = [];
    labelsRef.current.forEach(m => m.setMap(null));
    labelsRef.current.clear();
    markerMetaRef.current.clear();
    warningMarkersRef.current.forEach(m => m.setMap(null));
    warningMarkersRef.current = [];

    // 절대 Web Mercator 좌표 변환 (타일 ID 계산과 동일한 공식)
    const toLatLng = (cx: number, cy: number) =>
      new window.naver.maps.LatLng(yToLat(cy * TILE_M), xToLng(cx * TILE_M));

    // 유저별 타일 그룹
    const groups = new Map<string, Tile[]>();
    tiles.forEach(tile => {
      if (!tile.occupantUserId) return;
      if (!groups.has(tile.occupantUserId)) groups.set(tile.occupantUserId, []);
      groups.get(tile.occupantUserId)!.push(tile);
    });

    groups.forEach((userTiles, uid) => {
      const isMine = uid === userId;
      const showRivalTiles = isMine || uid === visibleRivalUserId || showAllRivals;

      const colorIdx = hashIndex(uid, RIVAL_COLORS.length);
      const [rivalFill, rivalStroke] = RIVAL_COLORS[colorIdx];

      if (!showRivalTiles) {
        // 핀 마커만 표시
        const name = tileOwners[uid];
        if (!name) return;
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
          map, position: centerPos,
          icon: {
            content: getPinContent(rivalStroke),
            anchor: new window.naver.maps.Point(15, 15),
          },
          zIndex: 10,
        });
        markerMetaRef.current.set(uid, { colorIdx, name });
        if (onUserClick) {
          window.naver.maps.Event.addListener(marker, 'click', () => onUserClick(uid));
        }
        labelsRef.current.set(uid, marker);
        return;
      }

      if (isMine) {
        // 내 타일: 감쇄 상태별로 그룹화해 색상 구분
        const colorGroups: Record<string, Tile[]> = { green: [], yellow: [], red: [] };
        userTiles.forEach(t => colorGroups[getMyTileStatus(t.lastMarkedAt)].push(t));

        (Object.entries(colorGroups) as [string, Tile[]][]).forEach(([status, statusTiles]) => {
          if (statusTiles.length === 0) return;
          const [fill, stroke] = MY_TILE_COLORS[status];
          buildBoundaryPolygons(statusTiles).forEach(corners => {
            const pts = corners.map(([cx, cy]) => toLatLng(cx, cy));
            const polygon = new window.naver.maps.Polygon({
              map,
              paths: [pts] as unknown as naver.maps.ArrayOfCoords[],
              fillColor: fill,
              fillOpacity: 1,
              strokeColor: stroke,
              strokeWeight: 2,
              strokeOpacity: 1,
            });
            window.naver.maps.Event.addListener(polygon, 'click', (e: { coord: naver.maps.LatLng }) => {
              const lat = e.coord.lat();
              const lng = e.coord.lng();
              const found = findTileByLatLng(lat, lng, userTiles);
              onTileClickRef.current?.(found ?? userTiles[0] ?? null, lat, lng);
            });
            polygsRef.current.push(polygon);
          });
        });
        return;
      }

      // 상대 유저 타일 폴리곤
      buildBoundaryPolygons(userTiles).forEach(corners => {
        const pts = corners.map(([cx, cy]) => toLatLng(cx, cy));
        const polygon = new window.naver.maps.Polygon({
          map,
          paths: [pts] as unknown as naver.maps.ArrayOfCoords[],
          fillColor: rivalFill,
          fillOpacity: 1,
          strokeColor: rivalStroke,
          strokeWeight: 2,
          strokeOpacity: 1,
        });
        if (onUserClick) {
          window.naver.maps.Event.addListener(polygon, 'click', (e: { coord: naver.maps.LatLng }) => {
            onUserClick(uid);
            const lat = e.coord.lat();
            const lng = e.coord.lng();
            const found = findTileByLatLng(lat, lng, userTiles);
            onTileClickRef.current?.(found ?? userTiles[0] ?? null, lat, lng);
          });
        }
        polygsRef.current.push(polygon);
      });

      // 상대 유저 핀 마커
      const name = tileOwners[uid];
      if (!name) return;
      const avgGx = userTiles.reduce((s, t) => {
        const u = t.tileId.indexOf('_');
        return s + parseInt(t.tileId.slice(0, u), 10) + 0.5;
      }, 0) / userTiles.length;
      const avgGy = userTiles.reduce((s, t) => {
        const u = t.tileId.indexOf('_');
        return s + parseInt(t.tileId.slice(u + 1), 10) + 0.5;
      }, 0) / userTiles.length;
      const centerPos = toLatLng(avgGx, avgGy);
      const pinMarker = new window.naver.maps.Marker({
        map, position: centerPos,
        icon: {
          content: getPinContent(rivalStroke),
          anchor: new window.naver.maps.Point(15, 15),
        },
        zIndex: 10,
      });
      markerMetaRef.current.set(uid, { colorIdx, name });
      if (onUserClick) {
        window.naver.maps.Event.addListener(pinMarker, 'click', () => onUserClick(uid));
      }
      labelsRef.current.set(uid, pinMarker);
    });
  }, [tiles, userId, mapReady, tileOwners, visibleRivalUserId, showAllRivals]);

  // 내 위치 마커 (산책 캐릭터)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !myPosition || !window.naver?.maps) return;

    // 이전 위치와의 차이로 heading 계산 (1m 이상 이동 시에만 업데이트)
    if (prevPositionRef.current) {
      const dLat = myPosition.lat - prevPositionRef.current.lat;
      const dLng = myPosition.lng - prevPositionRef.current.lng;
      if (Math.sqrt(dLat * dLat + dLng * dLng) > 0.000009) {
        headingRef.current = Math.atan2(dLng, dLat) * (180 / Math.PI);
      }
    }
    prevPositionRef.current = myPosition;

    const pos = new window.naver.maps.LatLng(myPosition.lat, myPosition.lng);
    const currentZoom = (map.getZoom() as number) ?? mapZoom;
    const iconSize = getIconSize(currentZoom);
    const icon = {
      content: getDogMarkerHTML(headingRef.current, iconSize),
      anchor: new window.naver.maps.Point(Math.round(iconSize / 2), Math.round(iconSize * 12 / 26)),
    };

    if (myMarkerRef.current) {
      // 드래그한 적 없을 때만 GPS 위치로 마커 이동
      if (!hasDraggedRef.current) {
        myMarkerRef.current.setPosition(pos);
        map.panTo(pos);
      }
      myMarkerRef.current.setIcon(icon);
    } else {
      hasDraggedRef.current = false;
      myMarkerRef.current = new window.naver.maps.Marker({
        map, position: pos, draggable: true, icon,
      });
      window.naver.maps.Event.addListener(myMarkerRef.current, 'dragend', () => {
        hasDraggedRef.current = true;
        const p = myMarkerRef.current!.getPosition() as naver.maps.LatLng;
        map.setCenter(p);
        onPositionOverride?.(p.lat(), p.lng());
      });
      map.panTo(pos);
    }
  }, [myPosition, mapReady]);

  // 줌 변경 시 강아지 마커 크기 업데이트
  useEffect(() => {
    if (!myMarkerRef.current || !mapReady || !window.naver?.maps) return;
    const iconSize = getIconSize(mapZoom);
    const icon = {
      content: getDogMarkerHTML(headingRef.current, iconSize),
      anchor: new window.naver.maps.Point(Math.round(iconSize / 2), Math.round(iconSize * 12 / 26)),
    };
    myMarkerRef.current.setIcon(icon);
  }, [mapZoom, mapReady]);

  // 현재 위치 타일 프리뷰 폴리곤 (절대좌표 직접 계산으로 toLatLngRef 의존 제거)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.naver?.maps) return;

    if (!previewPosition) {
      previewPolyRef.current?.setMap(null);
      previewPolyRef.current = null;
      return;
    }

    const mx = lngToX(previewPosition.lng);
    const my = latToY(previewPosition.lat);
    const gx = Math.floor(mx / TILE_M);
    const gy = Math.floor(my / TILE_M);

    const paths = [
      new window.naver.maps.LatLng(yToLat(gy * TILE_M),       xToLng(gx * TILE_M)),
      new window.naver.maps.LatLng(yToLat(gy * TILE_M),       xToLng((gx + 1) * TILE_M)),
      new window.naver.maps.LatLng(yToLat((gy + 1) * TILE_M), xToLng((gx + 1) * TILE_M)),
      new window.naver.maps.LatLng(yToLat((gy + 1) * TILE_M), xToLng(gx * TILE_M)),
    ];

    if (previewPolyRef.current) {
      previewPolyRef.current.setPaths([paths] as unknown as naver.maps.ArrayOfCoords[]);
    } else {
      previewPolyRef.current = new window.naver.maps.Polygon({
        map,
        paths: [paths] as unknown as naver.maps.ArrayOfCoords[],
        fillColor: 'rgba(250, 204, 21, 0.30)',
        fillOpacity: 1,
        strokeColor: '#EAB308',
        strokeWeight: 2.5,
        strokeOpacity: 0.9,
        strokeStyle: 'dashed' as unknown as naver.maps.StrokeStyleType,
        zIndex: 5,
      });
    }
  }, [previewPosition, mapReady]);

  // 선택된 타일 하이라이트
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.naver?.maps) return;

    if (!highlightLatLng) {
      highlightPolyRef.current?.setMap(null);
      highlightPolyRef.current = null;
      return;
    }

    const { lat, lng } = highlightLatLng;
    const mx = lngToX(lng);
    const my = latToY(lat);
    const gx = Math.floor(mx / TILE_M);
    const gy = Math.floor(my / TILE_M);

    const paths = [
      new window.naver.maps.LatLng(yToLat(gy * TILE_M),       xToLng(gx * TILE_M)),
      new window.naver.maps.LatLng(yToLat(gy * TILE_M),       xToLng((gx + 1) * TILE_M)),
      new window.naver.maps.LatLng(yToLat((gy + 1) * TILE_M), xToLng((gx + 1) * TILE_M)),
      new window.naver.maps.LatLng(yToLat((gy + 1) * TILE_M), xToLng(gx * TILE_M)),
    ];

    if (highlightPolyRef.current) {
      highlightPolyRef.current.setPaths([paths] as unknown as naver.maps.ArrayOfCoords[]);
    } else {
      highlightPolyRef.current = new window.naver.maps.Polygon({
        map,
        paths: [paths] as unknown as naver.maps.ArrayOfCoords[],
        fillColor: 'rgba(59, 130, 246, 0.20)',
        fillOpacity: 1,
        strokeColor: '#3B82F6',
        strokeWeight: 3,
        strokeOpacity: 1,
        zIndex: 9,
      });
    }
  }, [highlightLatLng, mapReady, tiles]);

  // 산책 경로 폴리라인
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.naver?.maps) return;

    if (walkPathCoords.length < 2) {
      walkPolylineRef.current?.setMap(null);
      walkPolylineRef.current = null;
      return;
    }

    const path = walkPathCoords.map(
      (c) => new window.naver.maps.LatLng(c.lat, c.lng),
    );

    if (walkPolylineRef.current) {
      walkPolylineRef.current.setPath(path);
    } else {
      walkPolylineRef.current = new window.naver.maps.Polyline({
        map,
        path,
        strokeColor: '#F97316',
        strokeWeight: 4,
        strokeOpacity: 0.85,
        strokeStyle: 'solid' as unknown as naver.maps.StrokeStyleType,
        zIndex: 6,
      });
    }
  }, [walkPathCoords, mapReady]);

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
