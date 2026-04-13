/**
 * 위경도를 Socket.IO 룸 키로 변환합니다.
 * 백엔드 backend/src/utils/areaKey.ts 와 동일한 로직을 유지해야 합니다.
 *
 * 소수점 2자리 반올림 → 약 1.1km × 1.1km 격자
 * 예: toAreaKey(37.5665, 126.9780) === 'area_37.57_126.98'
 */
export function toAreaKey(lat: number, lng: number): string {
  return `area_${lat.toFixed(2)}_${lng.toFixed(2)}`;
}
