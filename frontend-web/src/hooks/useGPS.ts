'use client';

import { useEffect, useState, useRef } from 'react';

export interface Position {
  lat: number;
  lng: number;
  speedKmh: number;
}

export function useGPS() {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('이 브라우저는 GPS를 지원하지 않습니다.');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const speedMs = pos.coords.speed ?? 0;
        // 음수 speed(미지원 브라우저) 또는 4.2m/s(15km/h) 초과 시 0으로 처리
        const speedKmh = speedMs > 0 && speedMs <= 4.2 ? speedMs * 3.6 : 0;

        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speedKmh,
        });
        setError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError('위치 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
        } else {
          setError('위치를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { position, error };
}
