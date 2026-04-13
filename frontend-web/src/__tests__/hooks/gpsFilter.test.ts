/**
 * useGPS.ts의 속도 필터 로직을 순수 함수로 추출하여 테스트합니다.
 * speedMs > 0 && speedMs <= 4.2  → speedMs * 3.6
 * 그 외                           → 0
 */
function applySpeedFilter(speedMs: number | null): number {
  const s = speedMs ?? 0;
  return s > 0 && s <= 4.2 ? s * 3.6 : 0;
}

describe('GPS 속도 필터 (15km/h = 4.167m/s)', () => {
  it('null speed → 0', () => {
    expect(applySpeedFilter(null)).toBe(0);
  });

  it('0m/s → 정지 상태이므로 0', () => {
    expect(applySpeedFilter(0)).toBe(0);
  });

  it('1m/s(3.6km/h) → 정상 반환', () => {
    expect(applySpeedFilter(1)).toBeCloseTo(3.6);
  });

  it('4.2m/s(15.12km/h) 경계값 → 정상 반환', () => {
    expect(applySpeedFilter(4.2)).toBeCloseTo(15.12);
  });

  it('4.21m/s → 15km/h 초과이므로 0 반환', () => {
    expect(applySpeedFilter(4.21)).toBe(0);
  });

  it('음수 speed(미지원 브라우저) → 0', () => {
    expect(applySpeedFilter(-1)).toBe(0);
  });

  it('매우 빠른 속도(30m/s 차량) → 0', () => {
    expect(applySpeedFilter(30)).toBe(0);
  });
});
