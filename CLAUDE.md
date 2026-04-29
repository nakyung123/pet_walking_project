# 프로젝트 개요: 퍼피랜드 (Puppy Land)
GPS 격자 시스템 기반의 반려견 영역 점유 산책 앱.
UI 컨셉: 지도 중심, 오렌지 테마, 타일 점유 시각화, 하단 네비게이션(지도/랭킹/커뮤니티).

## 기술 스택
- 프론트엔드: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- 백엔드: Node.js (Express) + TypeScript + Socket.IO
- 데이터베이스: PostgreSQL + PostGIS (Docker 사용)
- 인프라: Firebase (Auth, Push Notification)

## 절대 규칙
1. UI는 오렌지(#F97316) 테마를 기준으로 한다. 임의로 색상 체계를 변경하지 않는다.
2. 모든 GPS 관련 로직은 실제 거리 계산(Haversine 공식 등)이 아닌 PostGIS 함수를 우선 사용한다.
3. 15km/h 이상의 이동 속도가 감지되면 점유 포인트를 기록하지 않는 로직을 반드시 포함한다.
4. userId는 반드시 인증 토큰(req.uid)에서 추출한다. 클라이언트 body의 userId는 절대 신뢰하지 않는다.

## 아키텍처 및 폴더 구조
- `/frontend-web`: Next.js 프로젝트 루트
  - `src/app/`: 페이지 라우트 (App Router)
  - `src/components/`: UI 컴포넌트
  - `src/hooks/`: 커스텀 훅
  - `src/services/`: API 호출 함수
- `/backend`: Node.js 프로젝트 루트
  - `src/controllers/`: 요청 처리 로직
  - `src/services/`: 비즈니스 로직
  - `src/routes/`: 라우터 정의
  - `src/middlewares/`: 인증, 검증, 에러 핸들러
  - `src/schemas/`: Zod 유효성 검사 스키마
  - `src/jobs/`: 크론 배치 (감쇄 등)
  - `src/db/`: 마이그레이션 및 풀 설정
- `/docs`: PRD 및 API 명세서

## 빌드 & 테스트 (검증 방법)
- 백엔드 실행: `npm run dev` (backend 폴더)
- 프론트엔드 실행: `npm run dev` (frontend-web 폴더, 포트 3001)
- 백엔드 테스트: `npm test` (backend 폴더)
- 프론트엔드 테스트: `npm test` (frontend-web 폴더)
- 린트 체크: `npm run lint` (각 폴더)
- DB 상태 확인: `docker ps` 명령어로 컨테이너 가동 확인

## 코딩 컨벤션
- 함수는 단일 책임 원칙을 따르며 40줄 이하로 작성한다.
- 변수 및 함수명: camelCase 사용.
- 데이터베이스 테이블/컬럼명: snake_case 사용.
- API 응답 구조: `{ "success": boolean, "data": T, "error": string | null }` 통일.
- AuthRequest 타입은 `authMiddleware.ts`에서만 정의하고 import해서 사용한다.

## 도메인 용어 정의
- 타일(Tile): 지도 위의 50m × 50m 격자 단위.
- 마킹(Marking): 특정 타일에서 점유 포인트를 얻기 위해 사용자가 취하는 액션.
- 점유(Occupancy): 특정 타일에서 누적 점수가 가장 높아 소유권을 가진 상태.
- 감쇄(Decay): 24시간 이상 마킹이 없을 때 매일 자정 점수가 10%씩 줄어드는 현상.

## 워크플로우
1. 코드 수정 전 관련 타입(Type/Interface)을 먼저 정의한다.
2. 구현 후에는 의도대로 작동하는지 검증한다.
3. 한 번에 하나의 기능만 수정하며, 완료 후 나에게 '검토 요청'을 보낸다.

## Trigger Keywords (Slash Commands)

사용자가 아래 키워드를 입력하면 해당 워크플로우를 자동 실행한다.

### `배포` or `ship`
1. **테스트 실행**: 백엔드(`cd backend && npm test`) 및 프론트엔드(`cd frontend-web && npm test`) 테스트 전체 실행.
2. **테스트 실패 시**: 실패 내용을 보고하고 즉시 중단. commit/push 하지 않음.
3. **테스트 전체 통과 시**: 아래 순서로 자동화 공정 실행:
   - `git add -A` (변경된 파일 전체 스테이징)
   - 변경 내용을 분석하여 적절한 커밋 메시지 자동 작성
   - `git commit` 실행
   - `git push origin <현재브랜치>`
4. push 완료 후 결과 요약 출력

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
