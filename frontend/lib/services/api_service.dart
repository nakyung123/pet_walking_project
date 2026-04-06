import 'package:dio/dio.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  late final Dio _dio;

  ApiService._internal() {
    final baseUrl = dotenv.env['API_BASE_URL'] ?? 'http://10.0.2.2:3000';
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 5),
    ));
  }

  // 마킹 요청
  Future<Map<String, dynamic>> postMarking({
    required String userId,
    required double lat,
    required double lng,
    required double speed,
    required String sessionId,
    required String enteredAt,
  }) async {
    final response = await _dio.post('/api/marking', data: {
      'userId': userId,
      'lat': lat,
      'lng': lng,
      'speed': speed,
      'sessionId': sessionId,
      'enteredAt': enteredAt,
      'timestamp': DateTime.now().toIso8601String(),
    });
    return response.data as Map<String, dynamic>;
  }

  // 뷰포트 내 타일 조회
  Future<List<dynamic>> getTiles({
    required double minLat,
    required double maxLat,
    required double minLng,
    required double maxLng,
  }) async {
    final response = await _dio.get('/api/tiles', queryParameters: {
      'minLat': minLat,
      'maxLat': maxLat,
      'minLng': minLng,
      'maxLng': maxLng,
    });
    final body = response.data as Map<String, dynamic>;
    return body['data'] as List<dynamic>;
  }
}
