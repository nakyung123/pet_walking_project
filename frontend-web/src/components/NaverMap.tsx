'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

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
  onBoundsChange: (bounds: {
    minLat: number; maxLat: number; minLng: number; maxLng: number;
  }) => void;
  onCenterChange: (lat: number, lng: number) => void;
}

declare global {
  interface Window { naver: typeof naver; }
}

const MY_FILL      = 'rgba(33, 150, 243, 0.4)';
const RIVAL_FILL   = 'rgba(244, 67, 54, 0.4)';
const MY_STROKE    = '#1565C0';
const RIVAL_STROKE = '#B71C1C';
const HALF_LNG = 0.000225 * 0.97;
const HALF_LAT = 0.000225 * 0.7986 * 0.97;

export default function NaverMap({
  userId, tiles, myPosition, onBoundsChange, onCenterChange,
}: NaverMapProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<naver.maps.Map | null>(null);
  const rectsRef      = useRef<Map<string, naver.maps.Rectangle>>(new Map());
  const myMarkerRef   = useRef<naver.maps.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const initMap = () => {
    if (!containerRef.current || mapRef.current) return;

    const map = new window.naver.maps.Map(containerRef.current, {
      center: new window.naver.maps.LatLng(37.5665, 126.9780),
      zoom: 17,
      minZoom: 14,
      maxZoom: 20,
    });

    window.naver.maps.Event.addListener(map, 'idle', () => {
      const b = map.getBounds() as naver.maps.LatLngBounds;
      onBoundsChange({
        minLat: b.getSW().lat(), maxLat: b.getNE().lat(),
        minLng: b.getSW().lng(), maxLng: b.getNE().lng(),
      });
      const c = map.getCenter();
      onCenterChange(c.lat(), c.lng());
    });

    mapRef.current = map;
    setMapReady(true);
  };

  // tiles 배열 변경 시 전체 오버레이 교체
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.naver?.maps) return;

    rectsRef.current.forEach((r) => r.setMap(null));
    rectsRef.current.clear();

    tiles.forEach((tile) => {
      const isMine = tile.occupantUserId === userId;
      const rect = new window.naver.maps.Rectangle({
        map,
        bounds: new window.naver.maps.LatLngBounds(
          new window.naver.maps.LatLng(tile.lat - HALF_LAT, tile.lng - HALF_LNG),
          new window.naver.maps.LatLng(tile.lat + HALF_LAT, tile.lng + HALF_LNG),
        ),
        fillColor:   isMine ? MY_FILL    : RIVAL_FILL,
        fillOpacity: 1,
        strokeColor: isMine ? MY_STROKE  : RIVAL_STROKE,
        strokeWeight: 2,
      });
      rectsRef.current.set(tile.tileId, rect);
    });
  }, [tiles, userId, mapReady]);

  // 내 위치 마커
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !myPosition || !window.naver?.maps) return;

    const pos = new window.naver.maps.LatLng(myPosition.lat, myPosition.lng);
    if (myMarkerRef.current) {
      myMarkerRef.current.setPosition(pos);
    } else {
      myMarkerRef.current = new window.naver.maps.Marker({
        map,
        position: pos,
        icon: {
          content: '<div style="width:14px;height:14px;border-radius:50%;background:#2196F3;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>',
          anchor: new window.naver.maps.Point(7, 7),
        },
      });
      map.panTo(pos);
    }
  }, [myPosition, mapReady]);

  return (
    <>
      <Script
        src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}`}
        strategy="afterInteractive"
        onLoad={initMap}
        onError={() =>
          console.error('[NaverMap] 스크립트 로드 실패. 클라이언트 ID 및 허용 도메인을 확인하세요.')
        }
      />
      <div ref={containerRef} className="w-full h-full" />
    </>
  );
}
