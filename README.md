# Pet Territory (펫 테리토리)

- GPS 기반의 격자 시스템을 활용한 반려견 산책 영역 점유 게임형 플랫폼입니다. 사용자는 반려견과 산책하며 실제 지도의 타일을 점유하고, 동네 반려인들과 실시간으로 경쟁하며 건강한 산책 습관을 형성할 수 있습니다.

## 프로젝트 개요

- 목적: 반려견 산책의 게임화(Gamification)를 통한 리텐션 강화 및 산책 데이터의 가산화

- 주요 타겟: 일상적인 산책에 재미를 더하고 싶은 견주 및 지역 기반 반려인 커뮤니티 사용자

- 핵심 기술: 위치 기반 서비스(LBS), 격자(Grid) 점유 알고리즘, AI 기반 보행 패턴 분석

## 주요 기능

1. GPS 기반 격자 점유 시스템

- 지도 전체를 10m x 10m 크기의 타일로 분할하여 관리합니다.
- 사용자가 해당 타일에 체류하거나 통과할 때 점유 포인트를 부여합니다.
- 누적 포인트가 가장 높은 사용자가 타일의 소유권을 획득하며, 지도상에 사용자 고유의 색상이 표시됩니다.

2. 점유 포인트 산출 및 감쇄 로직
   
- 체류 시간과 이동 속도를 분석하여 실시간으로 포인트를 계산합니다.
- 일정 기간 산책을 수행하지 않을 경우 점유 포인트가 서서히 감소(Decay)하는 시스템을 도입하여 지속적인 사용을 유도합니다.

3. 어뷰징 방지 엔진
   
- 15km/h 이상의 이동 속도가 감지될 경우 데이터 기록을 차단하여 차량 및 이동수단 이용을 방지합니다.
- 기기 가속도 센서 데이터를 분석하여 실제 보행 패턴 여부를 검증합니다.

4. 실시간 알림 및 랭킹
   
- 점유 중인 영역의 탈환 시도가 감지되거나 소유권이 변경될 경우 실시간 푸시 알림을 발송합니다.
- 지역별(동, 구 단위) 점유율 랭킹을 제공하여 경쟁 요소를 강화합니다.

# 기술 스택

## 프론트엔드

- Flutter (Dart)
- flutter_naver_map 1.4.4 — 네이버 지도 SDK
- geolocator — GPS 위치 추적
- dio — HTTP 통신
- flutter_dotenv — 환경변수 관리
- provider — 상태 관리

## 백엔드

- Node.js + Express + TypeScript
- PostgreSQL + PostGIS — 공간 데이터(타일 좌표) 처리
- node-cron — 점수 감쇄 배치 작업
- Firebase Admin SDK — 인증

## 인프라

-  Docker (PostgreSQL + PostGIS 컨테이너)
-  Firebase Auth — 사용자 인증 (예정)


## 프로젝트 구조

pet_walking_project/
├── frontend/                  # Flutter 앱
│   └── lib/
│       ├── main.dart          # 앱 진입점, 네이버 지도 SDK 초기화
│       ├── screens/
│       │   └── map_screen.dart  # 지도 화면, 타일 오버레이, Marking 버튼
│       └── services/
│           └── api_service.dart # 백엔드 API 통신
│
├── backend/                   # Node.js 서버
│   └── src/
│       ├── index.ts           # 서버 진입점
│       ├── types/             # 공유 타입 정의
│       ├── db/
│       │   ├── pool.ts        # DB 커넥션 풀
│       │   └── schema.sql     # 테이블 정의
│       ├── routes/            # API 라우터
│       ├── controllers/       # 요청/응답 처리
│       ├── services/          # 비즈니스 로직
│       │   ├── markingService.ts  # 마킹 처리, PostGIS 타일 계산
│       │   ├── tileService.ts     # 타일 조회
│       │   └── userService.ts     # 유저 관리
│       ├── jobs/
│       │   └── decayJob.ts    # 점수 감쇄 배치 (매일 00:00)
│       └── middlewares/       # 인증, 에러 핸들링
│
├── docs/                      # PRD, API 명세
└── docker-compose.yml         # PostgreSQL + PostGIS 컨테이너

## 핵심 게임 로직

- 타일: 지도를 10m × 10m 격자로 분할 (PostGIS Web Mercator 기반)
- 점수: (체류시간(초) / 30) + 10 (마킹 버튼 보너스)
- 점유: 타일에서 가장 높은 점수를 가진 유저가 점유자
- 감쇄: 매일 00:00, 24시간 미방문 타일 점수 -10%
- 속도 제한: 15km/h 이상 이동 시 마킹 불가
