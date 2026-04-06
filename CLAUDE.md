# 프로젝트 개요: 펫 테리토리 (Pet Territory)
GPS 격자 시스템 기반의 반려견 영역 점유 산책 앱. 
UI 컨셉: 지도 중심, 파란색(내 영역), 빨간색(경쟁자), 하단 대형 노란색 'Marking' 버튼.

## 기술 스택
- 프론트엔드: Flutter (Mobile App)
- 백엔드: Node.js (Express) + TypeScript
- 데이터베이스: PostgreSQL + PostGIS (Docker 사용)
- 인프라: Firebase (Auth, Push Notification)

## 절대 규칙
1. UI 디자인은 제공된 참조 이미지의 레이아웃(지도 80%, 타일 오버레이)을 최우선으로 반영한다.
2. 모든 GPS 관련 로직은 실제 거리 계산(Haversine 공식 등)이 아닌 PostGIS 함수를 우선 사용한다.
3. 15km/h 이상의 이동 속도가 감지되면 점유 포인트를 기록하지 않는 로직을 반드시 포함한다.

## 아키텍처 및 폴더 구조
- `/frontend`: Flutter 프로젝트 루트
- `/backend`: Node.js 프로젝트 루트 (src/ 폴더 내에 기능별 분리)
- `/docs`: PRD 및 API 명세서 저장

## 빌드 & 테스트 (검증 방법)
- 백엔드 실행: `npm run dev` (backend 폴더)
- 프론트엔드 실행: `flutter run` (frontend 폴더)
- 린트 체크: `npm run lint` / `flutter analyze`
- DB 상태 확인: `docker ps` 명령어로 컨테이너 가동 확인

## 코딩 컨벤션
- 함수는 단일 책임 원칙을 따르며 40줄 이하로 작성한다.
- 변수 및 함수명: camelCase 사용.
- 데이터베이스 테이블/컬럼명: snake_case 사용.
- API 응답 구조: `{ "success": boolean, "data": T, "error": string | null }` 통일.

## 도메인 용어 정의
- 타일(Tile): 지도 위의 10m x 10m 격자 단위.
- 마킹(Marking): 특정 타일에서 점유 포인트를 얻기 위해 사용자가 취하는 액션.
- 점유(Occupancy): 특정 타일에서 누적 점수가 가장 높아 소유권을 가진 상태.
- 감쇄(Decay): 산책을 하지 않을 때 점유 포인트가 일정 비율로 깎이는 현상.

## 워크플로우
1. 코드 수정 전 관련 타입(Type/Interface)을 먼저 정의한다.
2. 구현 후에는 반드시 의도대로 작동하는지 로그(console.log/debug print)를 포함한 검증 코드를 작성한다.
3. 한 번에 하나의 기능만 수정하며, 완료 후 나에게 '검토 요청'을 보낸다.