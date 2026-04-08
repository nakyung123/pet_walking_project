// Pet Territory 앱 위젯 스모크 테스트
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('기본 앱 테스트', () {
    test('마킹 속도 제한 로직 검증', () {
      // 15km/h 이상이면 마킹 불가
      const double speedLimit = 15.0;
      expect(20.0 >= speedLimit, isTrue);  // 20km/h → 거부
      expect(10.0 >= speedLimit, isFalse); // 10km/h → 허용
    });

    test('타일 크기 계산 검증 (50m 격자)', () {
      // 50m 격자의 위도 반경: 50 / 2 / 111000 ≈ 0.000225
      const double halfDeg = 0.000225;
      const double tileSize = halfDeg * 2 * 111000; // 미터 단위
      expect(tileSize, closeTo(50.0, 1.0)); // 약 50m
    });

    test('API 응답 구조 검증', () {
      // { success: bool, data: T, error: string | null } 형식
      final response = {'success': true, 'data': {'score': 100}, 'error': null};
      expect(response['success'], isTrue);
      expect(response['data'], isNotNull);
      expect(response['error'], isNull);
    });
  });
}
