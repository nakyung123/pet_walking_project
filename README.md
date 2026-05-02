# 퍼피랜드 (Puppy Land)

**배포 URL**: https://pet-walking-project.vercel.app

GPS 격자 기반 반려견 영역 점유 산책 웹 서비스.
반려견과 산책하며 실제 지도의 50m×50m 타일을 점유하고, 동네 반려인들과 실시간으로 경쟁하며 건강한 산책 습관을 형성할 수 있습니다.

## 성능 최적화 성과

| 문제 | 해결 방법 | 결과 |
|------|----------|------|
| CORS preflight 매 요청 발생 | `Access-Control-Max-Age: 86400` 캐시 설정 | score API 730ms → 254ms (65% 개선) |
| 프로필 API 매 요청마다 DB 쿼리 | 서버 인메모리 캐시 (Map + TTL 60s) | 캐시 히트 시 응답 ~0ms |
| 채팅 목록 N+1 쿼리 | Correlated Subquery → LEFT JOIN 서브쿼리 | 단일 쿼리 처리로 DB 부하 감소 |
| 채팅 새로고침 후 반영 | Optimistic Update + 실패 시 자동 롤백 | 전송 즉시 UI 반영 |

## 기술 스택

**프론트엔드**
- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Naver Maps API — 지도 렌더링 및 타일 오버레이
- Socket.IO Client — 실시간 채팅
- Firebase Auth — 구글 로그인

**백엔드**
- Node.js + Express + TypeScript
- Socket.IO — 실시간 1:1 채팅
- PostgreSQL — 타일 점수 및 사용자 데이터
- Firebase Admin SDK — 인증 토큰 검증 및 FCM 푸시 알림
- node-cron — 점수 감쇄 배치 작업 (매일 00:00)

**인프라**
- Railway — 백엔드 서버 배포
- Vercel — 프론트엔드 배포
- GitHub Actions — CI/CD 파이프라인
- Docker — 로컬 PostgreSQL 컨테이너

## 주요 기능

- **GPS 격자 점유** — 지도를 50m×50m 타일로 분할, 산책 시 타일 점유 포인트 적립
- **어뷰징 방지** — 15km/h 이상 이동 속도 감지 시 마킹 차단
- **점수 감쇄** — 24시간 미방문 타일 점수 매일 10% 감소
- **실시간 채팅** — Socket.IO 기반 1:1 채팅
- **커뮤니티** — 게시글 작성, 좋아요, 댓글
- **랭킹** — 지역별 타일 점유율 랭킹
- **푸시 알림** — FCM 기반 타일 탈환 알림

## 프로젝트 구조

```
pet_walking_project/
├── frontend-web/               # Next.js 15 앱
│   └── src/
│       ├── app/                # App Router 페이지
│       │   ├── page.tsx        # 온보딩/홈
│       │   ├── login/          # 로그인
│       │   └── map/            # 지도 메인 화면
│       ├── components/         # UI 컴포넌트
│       ├── hooks/              # useAuth, useGPS, useSocket
│       ├── services/           # API 호출 (api.ts)
│       └── lib/                # firebase.ts, areaKey.ts
│
├── backend/                    # Node.js 서버
│   └── src/
│       ├── controllers/        # 요청/응답 처리
│       ├── services/           # 비즈니스 로직
│       ├── routes/             # API 라우터
│       ├── middlewares/        # 인증, 검증, 에러 핸들러
│       ├── schemas/            # Zod 유효성 검사
│       ├── jobs/               # decayJob.ts (점수 감쇄 배치)
│       ├── db/                 # pool.ts, schema.sql, migrations/
│       ├── utils/              # tileCalc.ts, areaKey.ts
│       ├── socket.ts           # Socket.IO 채팅 핸들러
│       └── firebase.ts         # Firebase Admin 초기화
│
├── docs/                       # API 명세서
└── docker-compose.yml          # 로컬 PostgreSQL 컨테이너
```

## 로컬 실행 방법

### 사전 준비
- Node.js 18+
- Docker Desktop
- Firebase 프로젝트 (Auth, FCM 활성화)
- Naver Cloud Platform 계정 (Maps API 키)

### 1. DB 실행
```bash
docker-compose up -d
```

### 2. 백엔드 실행
```bash
cd backend
cp .env.example .env   # 환경변수 설정
npm install
npm run dev            # http://localhost:3000
```

### 3. 프론트엔드 실행
```bash
cd frontend-web
cp .env.development .env.local   # 환경변수 설정
npm install
npm run dev                      # http://localhost:3001
```

### 환경변수 (.env.example 참고)

**backend/.env**
```
DATABASE_URL=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

**frontend-web/.env.local**
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=
NEXT_PUBLIC_API_URL=
```

## 핵심 로직

- **타일 계산** — GPS 좌표를 50m×50m 격자로 변환 (Web Mercator 기반 순수 TypeScript 구현)
- **점수 산정** — 마킹 버튼 클릭 시 포인트 적립, 누적 점수 최고 유저가 타일 점유
- **감쇄** — 매일 00:00, 24시간 미방문 타일 점수 -10%
- **속도 제한** — 15km/h 이상 이동 시 마킹 불가 (차량 어뷰징 방지)
