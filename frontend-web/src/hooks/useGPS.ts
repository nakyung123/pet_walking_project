'use client';

import { useEffect, useState, useRef } from 'react';

export interface Position {
  lat: number;
  lng: number;
  speedKmh: number;
}

export function useGPS(enabled = true) {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!navigator.geolocation) {
      setError('이 브라우저는 GPS를 지원하지 않습니다.');
      return;
    }

    const applyPosition = (pos: GeolocationPosition) => {
      const speedMs = pos.coords.speed ?? 0;
      const speedKmh = speedMs * 3.6;
      setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, speedKmh });
      setError(null);
    };

    const handleError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setError('위치 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
      } else {
        setError('위치를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.');
      }
    };

    // 지도 초기화를 위해 즉시 한 번 위치를 받고, watchPosition으로 이어서 추적
    navigator.geolocation.getCurrentPosition(applyPosition, handleError, {
      enableHighAccuracy: true, maximumAge: 10000, timeout: 10000,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(applyPosition, handleError, {
      enableHighAccuracy: true, maximumAge: 0, timeout: 10000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled]);

  return { position, error };
}
