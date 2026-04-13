/**
 * 위경도 좌표 → Socket.IO 룸 키 변환
 * 프론트엔드의 frontend-web/src/lib/areaKey.ts 와 동일한 로직이어야 합니다.
 * 소수점 2자리 기준 ~1.1km × 1.1km 격자.
 */
export function toAreaKey(lat: number, lng: number): string {
  return `area_${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

/** areaKey 형식 검증 (join_area 이벤트 입력값 방어) */
export function isValidAreaKey(key: unknown): key is string {
  return typeof key === 'string' && /^area_-?\d+\.\d{2}_-?\d+\.\d{2}$/.test(key);
}
