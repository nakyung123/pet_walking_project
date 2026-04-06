import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_naver_map/flutter_naver_map.dart';
import 'screens/map_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // .env 파일 로드
  await dotenv.load(fileName: '.env');

  // 네이버 지도 SDK 초기화 (새 NCP 인증 방식)
  final clientId = dotenv.env['NAVER_MAP_CLIENT_ID'] ?? '';
  await FlutterNaverMap().init(
    clientId: clientId,
    onAuthFailed: (error) {
      debugPrint('[NaverMap] 인증 실패: $error');
    },
  );

  debugPrint('[App] 네이버 지도 SDK 초기화 완료');
  runApp(const PetTerritoryApp());
}

class PetTerritoryApp extends StatelessWidget {
  const PetTerritoryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '펫 테리토리',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2196F3)),
        useMaterial3: true,
      ),
      home: const MapScreen(),
    );
  }
}
