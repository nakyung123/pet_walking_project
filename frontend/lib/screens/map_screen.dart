import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_naver_map/flutter_naver_map.dart';
import 'package:geolocator/geolocator.dart';
import '../services/api_service.dart';

// 내 영역: 파란색, 경쟁자 영역: 빨간색
const _myColor = Color(0x882196F3);
const _rivalColor = Color(0x88F44336);

// 개발 모드 고정 userId (Firebase 연동 전)
const _devUserId = 'dev-user-001';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  NaverMapController? _mapController;
  final ApiService _api = ApiService();

  Position? _currentPosition;
  bool _isMarking = false;

  // 현재 타일 진입 시각 (체류시간 계산용)
  DateTime _tileEnteredAt = DateTime.now();
  // 임시 세션 ID (DB walking_sessions에 등록된 UUID와 일치해야 함)
  final String _sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  // 타일 오버레이 목록 (tileId → overlay)
  final Map<String, NPolygonOverlay> _tileOverlays = {};

  @override
  void initState() {
    super.initState();
    _initLocation();
  }

  // GPS 권한 확인 및 위치 스트림 시작
  Future<void> _initLocation() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      debugPrint('[GPS] 위치 권한 영구 거부');
      return;
    }

    // 위치 변경 감지 스트림
    Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5, // 5m 이상 이동 시 갱신
      ),
    ).listen((position) {
      setState(() => _currentPosition = position);
      _loadTilesInView();
      debugPrint('[GPS] 위치 갱신: ${position.latitude}, ${position.longitude} | 속도: ${position.speed}m/s');
    });
  }

  // 뷰포트 내 타일 로드 및 오버레이 렌더링
  Future<void> _loadTilesInView() async {
    final controller = _mapController;
    if (controller == null) return;

    final bounds = await controller.getContentBounds();

    try {
      final tiles = await _api.getTiles(
        minLat: bounds.southWest.latitude,
        maxLat: bounds.northEast.latitude,
        minLng: bounds.southWest.longitude,
        maxLng: bounds.northEast.longitude,
      );

      debugPrint('[Tile] 조회된 타일 수: ${tiles.length}');
      await _renderTiles(tiles);
    } catch (e) {
      debugPrint('[Tile] 조회 실패: $e');
    }
  }

  // 타일 목록을 지도 위에 폴리곤 오버레이로 렌더링
  Future<void> _renderTiles(List<dynamic> tiles) async {
    final controller = _mapController;
    if (controller == null) return;

    for (final tile in tiles) {
      final tileId = tile['tileId'] as String;
      final lat = (tile['lat'] as num).toDouble();
      final lng = (tile['lng'] as num).toDouble();
      final occupantId = tile['occupantUserId'] as String?;

      // 10m × 10m 격자 꼭짓점 계산 (위도 1도 ≈ 111,000m)
      const halfDeg = 0.000045; // 약 5m
      final coords = [
        NLatLng(lat - halfDeg, lng - halfDeg),
        NLatLng(lat + halfDeg, lng - halfDeg),
        NLatLng(lat + halfDeg, lng + halfDeg),
        NLatLng(lat - halfDeg, lng + halfDeg),
      ];

      final color = occupantId == _devUserId ? _myColor : _rivalColor;
      final overlay = NPolygonOverlay(
        id: tileId,
        coords: coords,
        color: color,
        outlineColor: color.withAlpha(200),
        outlineWidth: 1,
      );

      // 기존 오버레이 제거 후 새로 추가
      if (_tileOverlays.containsKey(tileId)) {
        await controller.deleteOverlay(NOverlayInfo(type: NOverlayType.polygonOverlay, id: tileId));
      }
      _tileOverlays[tileId] = overlay;
      await controller.addOverlay(overlay);
      debugPrint('[Tile] 오버레이 추가: $tileId');
    }
  }

  // 마킹 버튼 처리
  Future<void> _onMarkingPressed() async {
    final position = _currentPosition;
    if (position == null) {
      _showSnackBar('GPS 신호를 기다리는 중입니다...');
      return;
    }

    // 속도 km/h 변환 (position.speed는 m/s)
    final speedKmh = position.speed * 3.6;

    setState(() => _isMarking = true);
    try {
      final result = await _api.postMarking(
        userId: _devUserId,
        lat: position.latitude,
        lng: position.longitude,
        speed: speedKmh,
        sessionId: _sessionId,
        enteredAt: _tileEnteredAt.toIso8601String(),
      );

      debugPrint('[Marking] 결과: $result');

      if (result['success'] == true) {
        final data = result['data'] as Map<String, dynamic>;
        final score = data['newScore'];
        final isOccupied = data['isOccupied'] as bool;
        _showSnackBar(isOccupied ? '마킹 성공! 점수: $score' : '마킹! 점수: $score (점유 도전 중)');
        _tileEnteredAt = DateTime.now(); // 체류시간 리셋
        _loadTilesInView();
      } else {
        _showSnackBar(result['error'] ?? '마킹 실패');
      }
    } catch (e) {
      debugPrint('[Marking] 오류: $e');
      _showSnackBar('서버 연결 오류');
    } finally {
      setState(() => _isMarking = false);
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 2)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // 지도 (화면 전체)
          NaverMap(
            options: const NaverMapViewOptions(
              initialCameraPosition: NCameraPosition(
                target: NLatLng(37.5665, 126.9780), // 서울 기본값
                zoom: 17,
              ),
              minZoom: 14,
              maxZoom: 20,
              locationButtonEnable: true,
            ),
            onMapReady: (controller) {
              _mapController = controller;
              debugPrint('[NaverMap] 지도 준비 완료');
              _loadTilesInView();
            },
            onCameraIdle: () => _loadTilesInView(),
          ),

          // 하단 UI 패널 (화면 20%)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 10)],
              ),
              child: SafeArea(
                top: false,
                child: Row(
                  children: [
                    // 내 영역 타일 수 표시
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('내 영역', style: TextStyle(fontSize: 12, color: Colors.grey)),
                          Text(
                            '${_tileOverlays.values.length} 타일',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),

                    // Marking 버튼
                    GestureDetector(
                      onTap: _isMarking ? null : _onMarkingPressed,
                      child: Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          color: _isMarking ? Colors.grey : const Color(0xFFFFD600),
                          shape: BoxShape.circle,
                          boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 4))],
                        ),
                        child: _isMarking
                            ? const Center(child: CircularProgressIndicator(color: Colors.white))
                            : const Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.pets, size: 32, color: Colors.white),
                                  SizedBox(height: 4),
                                  Text('Marking', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                ],
                              ),
                      ),
                    ),

                    // 점수 표시
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Text('포인트', style: TextStyle(fontSize: 12, color: Colors.grey)),
                          Text('0', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
