import { toAreaKey } from '@/lib/areaKey';

describe('toAreaKey', () => {
  it('소수점 2자리로 반올림된 키를 반환한다', () => {
    expect(toAreaKey(37.5665, 126.978)).toBe('area_37.57_126.98');
  });

  it('소수점 2자리 이하 값이 같으면 동일한 키를 반환한다', () => {
    expect(toAreaKey(37.5601, 126.9701)).toBe(toAreaKey(37.5649, 126.9749));
  });

  it('소수점 경계에서 올바르게 구분된다', () => {
    // 부동소수점 특성: 37.565.toFixed(2) === '37.56' 이므로 .5651 이상부터 올림
    const key1 = toAreaKey(37.5649, 126.9749); // → 37.56, 126.97
    const key2 = toAreaKey(37.5651, 126.9751); // → 37.57, 126.98
    expect(key1).not.toBe(key2);
  });

  it('음수 좌표도 올바르게 처리한다', () => {
    expect(toAreaKey(-33.865, 151.2099)).toBe('area_-33.87_151.21');
  });

  it('key 형식이 area_{lat}_{lng} 이다', () => {
    const key = toAreaKey(37.5, 126.9);
    expect(key).toMatch(/^area_-?\d+\.\d{2}_-?\d+\.\d{2}$/);
  });
});
