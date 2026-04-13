import 'dart:async';
import 'dart:ui' as ui;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_naver_map/flutter_naver_map.dart';
import 'package:geolocator/geolocator.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

// Fill: 불투명도 40%
const _myFillColor      = Color(0x662196F3);
const _rivalFillColor   = Color(0x66F44336);
// Stroke: 100% 불투명, 진한 색
const _myStrokeColor    = Color(0xFF1565C0);
const _rivalStrokeColor = Color(0xFFB71C1C);

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  NaverMapController? _mapController;
  NLocationOverlay? _locationOverlay;
  final ApiService _api = ApiService();

  // 현재 로그인된 유저 UID (Firebase)
  String get _userId => FirebaseAuth.instance.currentUser!.uid;

  Position? _currentPosition;
  bool _isMarking = false;

  // 현재 타일 진입 시각 (체류시간 계산용)
  DateTime _tileEnteredAt = DateTime.now();
  // 세션 ID — initState에서 백엔드로부터 발급
  String? _sessionId;

  // 타일 오버레이 목록 (tileId → overlay)
  final Map<String, NGroundOverlay> _tileOverlays = {};
  NMarker? _youLabelMarker;
  int _myTileCount = 0;

  // 마킹 버튼 애니메이션 (눌릴 때 축소)
  bool _markingButtonPressed = false;
  // 점수 팝업 (+N 텍스트) — key는 팝업 고유 ID
  final Map<int, int> _scorePopups = {}; // id → score
  int _popupIdCounter = 0;

  // 내 총 점수
  int _totalScore = 0;

  @override
  void initState() {
    super.initState();
    _startSession();
    _initLocation();
    _refreshScore();
  }

  Future<void> _refreshScore() async {
    try {
      final data = await _api.getMyScore();
      setState(() => _totalScore = data['totalScore'] as int);
    } catch (e) {
      debugPrint('[Score] 점수 조회 실패: $e');
    }
  }

  // 산책 세션 시작 — 유저 upsert 후 session_id 발급
  Future<void> _startSession() async {
    try {
      final user = FirebaseAuth.instance.currentUser!;
      // 앱 실행마다 유저 정보 upsert (재로그인 시에도 DB에 존재 보장)
      await _api.registerUser(
        userId: user.uid,
        displayName: user.displayName ?? '유저',
        dogName: '강아지',
      );
      final sessionId = await _api.createSession(_userId);
      setState(() => _sessionId = sessionId);
      debugPrint('[Session] 세션 시작: $sessionId');
    } catch (e) {
      debugPrint('[Session] 세션 생성 실패: $e');
    }
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
      _locationOverlay?.setPosition(NLatLng(position.latitude, position.longitude));
      _locationOverlay?.setBearing(position.heading);
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

  /// PictureRecorder로 둥근 모서리 타일 이미지를 생성합니다.
  Future<NOverlayImage> _generateTileImage(
    Color fillColor,
    Color strokeColor, {
    bool glow = false,
    String? cacheKey,
  }) async {
    const double size   = 256.0;
    const double inset  = 8.0;
    const double radius = 12.0;
    const double stroke = 2.0;

    final recorder = ui.PictureRecorder();
    final canvas   = Canvas(recorder, Rect.fromLTWH(0, 0, size, size));
    final rrect    = RRect.fromRectAndRadius(
      Rect.fromLTWH(inset, inset, size - inset * 2, size - inset * 2),
      const Radius.circular(radius),
    );

    if (glow) {
      canvas.drawRRect(rrect, Paint()
        ..color      = fillColor.withAlpha(180)
        ..maskFilter = const MaskFilter.blur(BlurStyle.outer, 10.0));
    }
    canvas.drawRRect(rrect, Paint()..color = fillColor);
    canvas.drawRRect(rrect, Paint()
      ..color       = strokeColor
      ..style       = PaintingStyle.stroke
      ..strokeWidth = stroke);

    final picture  = recorder.endRecording();
    final img      = await picture.toImage(size.toInt(), size.toInt());
    final byteData = await img.toByteData(format: ui.ImageByteFormat.png);
    return NOverlayImage.fromByteArray(
      byteData!.buffer.asUint8List(),
      cacheKey: cacheKey,
    );
  }

  /// 현재 위치가 타일 범위 안에 있는지 확인합니다.
  bool _isPositionInTile(double pLat, double pLng, double tLat, double tLng) {
    const halfLng = 0.000225;
    const halfLat = 0.000225 * 0.7986;
    return (pLat - tLat).abs() <= halfLat && (pLng - tLng).abs() <= halfLng;
  }

  /// 현재 위치 타일 위에 "You" 라벨 마커를 추가합니다.
  Future<void> _addYouLabel(NaverMapController c, NLatLng pos) async {
    final rec = ui.PictureRecorder();
    Canvas(rec, const Rect.fromLTWH(0, 0, 1, 1));
    final bd = await (await rec.endRecording().toImage(1, 1))
        .toByteData(format: ui.ImageByteFormat.png);
    final icon = await NOverlayImage.fromByteArray(
      bd!.buffer.asUint8List(), cacheKey: 'transparent_1x1');

    final marker = NMarker(
      id: 'you_label', position: pos, icon: icon,
      anchor: const NPoint(0.5, 0.5),
      caption: const NOverlayCaption(
        text: 'You', textSize: 13,
        color: Colors.white, haloColor: Colors.black87,
      ),
      captionAligns: const [NAlign.top],
      captionOffset: 4,
    );
    marker.setGlobalZIndex(300000);
    _youLabelMarker = marker;
    await c.addOverlay(marker);
  }

  // 타일 목록을 지도 위에 NGroundOverlay로 렌더링 (둥근 모서리 + Glow 지원)
  Future<void> _renderTiles(List<dynamic> tiles) async {
    final controller = _mapController;
    if (controller == null) return;

    // 기존 오버레이 전체 제거
    for (final id in _tileOverlays.keys.toList()) {
      await controller.deleteOverlay(
        NOverlayInfo(type: NOverlayType.groundOverlay, id: id));
    }
    _tileOverlays.clear();

    if (_youLabelMarker != null) {
      await controller.deleteOverlay(
        NOverlayInfo(type: NOverlayType.marker, id: 'you_label'));
      _youLabelMarker = null;
    }

    int myCount = 0;
    NLatLng? glowCenter;
    // EPSG:3857 50m 격자 → 위경도 변환 (3% 축소로 타일 간 간격 확보)
    const halfLng = 0.000225 * 0.97;           // 경도 방향
    const halfLat = 0.000225 * 0.7986 * 0.97; // 위도 방향 (cos(37°) 보정)
    final pos = _currentPosition;

    for (final tile in tiles) {
      final tileId     = tile['tileId'] as String;
      final lat        = (tile['lat'] as num).toDouble();
      final lng        = (tile['lng'] as num).toDouble();
      final occupantId = tile['occupantUserId'] as String?;
      final isMyTile   = occupantId == _userId;
      final isGlowing  = pos != null &&
          _isPositionInTile(pos.latitude, pos.longitude, lat, lng);

      if (isMyTile) myCount++;
      if (isGlowing) glowCenter = NLatLng(lat, lng);

      final fillColor   = isMyTile ? _myFillColor   : _rivalFillColor;
      final strokeColor = isMyTile ? _myStrokeColor : _rivalStrokeColor;
      final cacheKey    = '${isMyTile ? "my" : "rival"}_${isGlowing ? "glow" : "normal"}';

      final image = await _generateTileImage(fillColor, strokeColor,
          glow: isGlowing, cacheKey: cacheKey);

      final overlay = NGroundOverlay(
        id: tileId,
        bounds: NLatLngBounds(
          southWest: NLatLng(lat - halfLat, lng - halfLng),
          northEast: NLatLng(lat + halfLat, lng + halfLng),
        ),
        image: image,
      );
      overlay.setGlobalZIndex(100);

      _tileOverlays[tileId] = overlay;
      await controller.addOverlay(overlay);
      debugPrint('[Tile] GroundOverlay 추가: $tileId (glow: $isGlowing)');
    }

    setState(() => _myTileCount = myCount);

    if (glowCenter != null) await _addYouLabel(controller, glowCenter);
  }

  // 마킹 버튼 처리
  Future<void> _onMarkingPressed() async {
    final position = _currentPosition;
    if (position == null) {
      _showSnackBar('GPS 신호를 기다리는 중입니다...');
      return;
    }

    // 속도 km/h 변환 (position.speed는 m/s)
    // 에뮬레이터 GPS 노이즈 방지: 4.2 m/s(15km/h) 초과 시 0으로 처리
    final rawSpeed = position.speed;
    final speedKmh = (rawSpeed <= 0 || rawSpeed > 4.2) ? 0.0 : rawSpeed * 3.6;

    final sessionId = _sessionId;
    if (sessionId == null) {
      _showSnackBar('세션 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setState(() {
      _isMarking = true;
      _markingButtonPressed = true;
    });
    // 버튼 눌림 효과: 150ms 후 원래 크기로 복귀
    Future.delayed(const Duration(milliseconds: 150), () {
      if (mounted) setState(() => _markingButtonPressed = false);
    });

    try {
      final result = await _api.postMarking(
        userId: _userId,
        lat: position.latitude,
        lng: position.longitude,
        speed: speedKmh,
        sessionId: sessionId,
        enteredAt: _tileEnteredAt.toIso8601String(),
      );

      debugPrint('[Marking] 결과: $result');

      if (result['success'] == true) {
        final data = result['data'] as Map<String, dynamic>;
        final score = data['newScore'] as int;
        final isOccupied = data['isOccupied'] as bool;
        _showSnackBar(isOccupied ? '마킹 성공! 점수: $score' : '마킹! 점수: $score (점유 도전 중)');

        // 점수 팝업 추가
        final popupId = _popupIdCounter++;
        setState(() => _scorePopups[popupId] = score);
        Future.delayed(const Duration(milliseconds: 1200), () {
          if (mounted) setState(() => _scorePopups.remove(popupId));
        });

        _tileEnteredAt = DateTime.now(); // 체류시간 리셋
        _loadTilesInView();
        _refreshScore();
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

  Future<void> _onSignOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('로그아웃'),
        content: const Text('로그아웃 하시겠습니까?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('로그아웃')),
        ],
      ),
    );
    if (confirmed == true) {
      await AuthService().signOut();
    }
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
                tilt: 30,
              ),
              minZoom: 14,
              maxZoom: 20,
              locationButtonEnable: true,
            ),
            onMapReady: (controller) async {
              _mapController = controller;
              debugPrint('[NaverMap] 지도 준비 완료');

              // 현재 위치 오버레이 활성화
              _locationOverlay = controller.getLocationOverlay();
              _locationOverlay!.setIsVisible(true);

              // 현재 위치가 이미 있으면 즉시 표시
              if (_currentPosition != null) {
                _locationOverlay!.setPosition(
                  NLatLng(_currentPosition!.latitude, _currentPosition!.longitude),
                );
              }

              _loadTilesInView();
            },
            onCameraIdle: () => _loadTilesInView(),
          ),

          // 우상단 버튼들
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            right: 12,
            child: SafeArea(
              child: Column(
                children: [
                  // 내 위치로 이동 버튼
                  FloatingActionButton.small(
                    heroTag: 'myLocation',
                    backgroundColor: Colors.white,
                    onPressed: () {
                      final pos = _currentPosition;
                      if (pos == null) return;
                      _mapController?.updateCamera(
                        NCameraUpdate.scrollAndZoomTo(
                          target: NLatLng(pos.latitude, pos.longitude),
                          zoom: 17,
                        ),
                      );
                    },
                    child: const Icon(Icons.gps_fixed, color: Color(0xFF2196F3)),
                  ),
                  const SizedBox(height: 8),
                  // 로그아웃 버튼
                  FloatingActionButton.small(
                    heroTag: 'logout',
                    backgroundColor: Colors.white,
                    onPressed: _onSignOut,
                    child: const Icon(Icons.logout, color: Colors.black54),
                  ),
                ],
              ),
            ),
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
                            '$_myTileCount 타일',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    ),

                    // 점수 팝업 + 마킹 버튼
                    Stack(
                      alignment: Alignment.topCenter,
                      clipBehavior: Clip.none,
                      children: [
                        // +N 팝업들
                        ..._scorePopups.entries.map((e) => Positioned(
                          top: -60,
                          child: _ScorePopupWidget(score: e.value),
                        )),
                        // 마킹 버튼
                        GestureDetector(
                          onTap: _isMarking ? null : _onMarkingPressed,
                          child: AnimatedScale(
                            scale: _markingButtonPressed ? 0.88 : 1.0,
                            duration: const Duration(milliseconds: 120),
                            child: Container(
                              width: 100,
                              height: 100,
                              decoration: BoxDecoration(
                                color: _isMarking ? Colors.grey : const Color(0xFFFFD600),
                                shape: BoxShape.circle,
                                boxShadow: [BoxShadow(
                                  color: _markingButtonPressed ? Colors.black38 : Colors.black26,
                                  blurRadius: _markingButtonPressed ? 4 : 8,
                                  offset: Offset(0, _markingButtonPressed ? 2 : 4),
                                )],
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
                        ),
                      ],
                    ),

                    // 점수 표시
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('포인트', style: TextStyle(fontSize: 12, color: Colors.grey)),
                          Text('$_totalScore', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
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

/// 마킹 성공 시 "+N" 텍스트가 위로 올라가며 사라지는 팝업 위젯
class _ScorePopupWidget extends StatefulWidget {
  final int score;
  const _ScorePopupWidget({required this.score});

  @override
  State<_ScorePopupWidget> createState() => _ScorePopupWidgetState();
}

class _ScorePopupWidgetState extends State<_ScorePopupWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _opacity;
  late Animation<double> _offset;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    )..forward();

    _opacity = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.5, 1.0)),
    );
    _offset = Tween<double>(begin: 0.0, end: -40.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) => Transform.translate(
        offset: Offset(0, _offset.value),
        child: Opacity(
          opacity: _opacity.value,
          child: Text(
            '+${widget.score}',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFFD600),
              shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
            ),
          ),
        ),
      ),
    );
  }
}
