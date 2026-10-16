# 상담 화면 로딩 진단 + 키워드 콘텐츠 운영 흐름 완성 — 조사 보고 (구현 전)

조사만 수행, 코드/마이그레이션 변경 없음. Production 무변경, non-prod에도 접속하지 않고
로컬 `supabase start` + 로컬 DB(seed 61건)로 측정.

## 측정 환경 제약 (먼저 명시)

Claude Code 자동 모드 classifier가 이번 세션에서 `preview_start`(dev 서버 브라우저
프리뷰) 호출을 거부해, 관리자 로그인 후 브라우저 Network 탭으로 종단간(E2E)
요청 타이밍을 직접 캡처하지 못했다. 대신:

- **DB 계층은 실제 측정값**(로컬 Postgres, `psql \timing`, seed 데이터 61건 기준)
- **요청 구조(순차/병렬, 호출 횟수, 워터폴)는 실제 소스 코드를 읽어 확정** — 추정이 아니라
  코드에 그렇게 쓰여 있음을 파일·라인으로 인용
- 브라우저 렌더링 시간만 측정하지 못했고, 이는 상담 카드에 실질적 렌더링 부하(이미지/차트
  없음, 순수 텍스트 카드)가 없어 병목일 가능성이 낮다고 코드 검토로 판단(측정 아님, 명시)

## A. 상담 탭 "불러오는 중…" 원인 — 실측 결과

### 대상 화면

관리자 `상담 → 상담 현황`(`app/admin/ConsultationTab.tsx` → `ConsultationKanbanBoard.tsx`).
"불러오는 중..." 문자열이 코드에 정확히 이 컴포넌트에만 존재한다
([ConsultationKanbanBoard.tsx:90](app/admin/ConsultationKanbanBoard.tsx:90)).

### 요청 워터폴 (실제 코드 순서)

**1단계 — SSR, 관리자 페이지 진입 시 (`app/admin/page.tsx:44-95`)**

`admin/page.tsx`는 **관리자 앱 전체 탭의 데이터를 한 번에** `Promise.all`로
로드한다 — 상담 탭만 여는 경우에도 정산 배치, 워크스페이스 프로비저닝, 결제
분쟁, 환불 요청, 가격 변경 알림, 전체 교재 목록(`loadAllCurriculumDocs`),
전체 학생/교사(+ 배치 크레딧 이력·QC 경고) 등 **22개 로더**가 전부 실행된
뒤에야 페이지가 그려진다. `Promise.all`로 병렬화는 되어 있으나(순차 아님),
상담 탭과 무관한 20개 로더가 이 화면의 TTFB 하한을 같이 정한다.

**2단계 — 클라이언트, 상담 탭 mount 후 (`ConsultationKanbanBoard.tsx:70-82`)**

`ConsultationTab`은 `consultations` prop을 받지만 `ConsultationKanbanBoard`에
전달하지 않는다([ConsultationTab.tsx:100](app/admin/ConsultationTab.tsx:100) 부근 —
`subjects`/`teacherCandidatesBySubject`만 전달). 대신 보드는 mount 시
`useEffect`로 **자체 서버 액션을 다시 호출**한다
(`listKanbanBoardAction()`, [ConsultationKanbanBoard.tsx:73](app/admin/ConsultationKanbanBoard.tsx:73)).
즉 1단계의 `loadConsultations(supabase)` 결과는 이 화면에서 버려지고,
**상담 목록을 통째로 다시 조회**한다 — 중복 요청 확정.

이 두 번째 요청이 오기 전까지는 카드 골격조차 그리지 않고 텍스트 한 줄만
보여준다(`if (!cards) return <p>...불러오는 중...</p>`, 스켈레톤 없음).

**3단계 — `listKanbanBoardAction()` 내부** (`app/admin/consultation-kanban-actions.ts:64-83`)

코드에 나타난 순서 그대로:

1. `listConsultationsForAdmin({ from: "2020-01-01", to: "2035-01-01" })` — **await 1**
   ([consultation-scheduling-actions.ts:124-126](app/admin/consultation-scheduling-actions.ts:124)):
   실제 쿼리 조건이 `starts_at >= 2020-01-01 AND < 2035-01-01`로, 사실상
   **전체 기간**을 필터 없이 가져온다. 종료/취소/노쇼 제외는 이 시점이 아니라
   **가져온 뒤 JS에서** `active = rows.filter(...)`로 걸러진다
   ([consultation-kanban-actions.ts:69](app/admin/consultation-kanban-actions.ts:69)).
   → **질문 "과거·오류·체험 이력까지 함께 불러오는지"의 답: 그렇다, DB 쿼리
   단계부터 전체 이력을 가져온다.**
2. 위 함수 내부에서 `attachTrialGrantExpiry()` 추가 쿼리 1회 더 발생
   ([consultation-scheduling-actions.ts:129](app/admin/consultation-scheduling-actions.ts:129)).
3. `closedIdsData` 조회 — **await 2**, 1단계 결과와 **독립적**인데도 순차 실행
   ([consultation-kanban-actions.ts:67](app/admin/consultation-kanban-actions.ts:67)).
4. `classifyStage()`를 `active` 각 건에 `Promise.all`로 실행 — **await 3(병렬 배치)**.
   `outcome === 'trial_recommended'`인 건마다 `getTrialOnboardingPipelineAction()`
   호출([consultation-kanban-actions.ts:44](app/admin/consultation-kanban-actions.ts:44)) →
   그 함수 안에서 다시 **순차** 3~5회 쿼리(`consultations` 1회 →
   `subject_enrollments` 1회 → 있으면 `teacher_assignments` 1회 → 이하 생략된
   추가 단계, [trial-onboarding-actions.ts:545-577](app/admin/trial-onboarding-actions.ts:545)).
   로컬 seed 기준 `outcome='trial_recommended'` 61건 중 **42건** — 즉 이 한 번의
   화면 진입에서 카드 개수 × 최대 5회의 순차 DB 왕복이 **병렬로 42배** 발생한다.
5. `rootIdsData` 조회 — **await 4**, 역시 3단계 결과와 독립인데 순차
   ([consultation-kanban-actions.ts:78](app/admin/consultation-kanban-actions.ts:78)).

### DB 계층 실측 (로컬, seed 61건 기준)

```
select id,status,outcome from consultations where starts_at>=2020-01-01 and <2035-01-01 order by starts_at;
  → 10.6ms (44 rows 반환 시점 측정, 재현 시 유사)
select id from consultations where closure_type is not null;
  → 2.1ms
outcome='trial_recommended' 건수 → 42 / 61
```

로컬 loopback 기준 원시 쿼리 자체는 전부 수 ms대로 **DB 쿼리 자체가 느린 것은
아니다.** 병목은 쿼리 실행 시간이 아니라 **호출 횟수와 순차 구조**다:
Supabase JS 클라이언트는 각 `.from().select()` 호출마다 PostgREST에 별도
HTTP 요청을 보낸다. 로컬에서도 왕복당 통상 수 ms~수십 ms의 고정 오버헤드가
붙고, Vercel(서버리스 함수) → Supabase(별도 리전 가능) 구조인 실제 배포
환경에서는 왕복당 수십~150ms 이상이 흔하다. 이 화면 하나가 만들어내는 순차
왕복 체인은 최소 **4~5회(보드 레벨) + 카드당 최대 5회(파이프라인, 병렬 배치지만
각 배치 내부는 순차)** — trial_recommended 카드가 있는 한 이 파이프라인
체인 길이가 전체 함수의 하한을 정한다. 즉 "느리다"의 실체는 **N+1성 다단
왕복 + SSR 단계의 22-로더 동시 완료 대기 + 클라이언트 재조회 중복** 세
가지의 합이며, 개별 쿼리 자체의 저속이 아니다(실측으로 반증됨).

### "왜 카드 구조가 전혀 렌더링되지 않는가"

`cards`가 `null`인 동안 조건부 렌더가 텍스트 한 줄만 반환하기 때문
([ConsultationKanbanBoard.tsx:90](app/admin/ConsultationKanbanBoard.tsx:90)). 5개
칸반 컬럼 헤더조차 데이터 도착 전에는 그리지 않는다 — 즉시 그릴 수 있는
정적 구조(5개 컬럼 라벨)까지 데이터에 묶여 있다.

### 개선 원칙 적용 지점 (구현 범위, 미착수)

- **컬럼 헤더 + 스켈레톤 카드 즉시 렌더**: `cards === null`일 때 5개 컬럼과
  스켈레톤 placeholder(카드 모양) 렌더 — 데이터 도착 후 교체만.
- **SSR 단계 분리**: 상담 탭 데이터(`loadConsultations` 등)를 admin
  `page.tsx`의 거대 `Promise.all`에서 분리하거나, 최소한 상담 탭에 필요한
  것만 우선 스트리밍(Next.js `<Suspense>` 경계)하고 나머지 20개 로더는
  탭별로 지연 로드.
- **중복 조회 제거**: `ConsultationTab`이 이미 가진 `consultations` prop을
  `ConsultationKanbanBoard`에 내려주고 첫 렌더는 그것으로, 이후 새로고침만
  `listKanbanBoardAction()` 사용 — 또는 반대로 보드를 client-fetch 전용으로
  통일하고 `page.tsx`의 `loadConsultations` 호출을 상담 탭에서는 제거(다른
  하위탭이 그 prop을 실제로 쓰는지 확인 필요 — `ConsultationSchedulingPanel`/
  `ClosedConsultationsSection`이 사용 중일 가능성, 구현 단계에서 확인).
- **쿼리 범위 축소**: `listKanbanBoardAction`이 부르는 `listConsultationsForAdmin`을
  "종료/취소/노쇼 아님" 조건을 **DB 쿼리 자체**(`.is("closure_type", null)`,
  `.not("status", "in", ...)`)로 옮겨 전체 이력을 애초에 가져오지 않게 한다.
- **독립 쿼리 병렬화**: `closedIdsData`/`rootIdsData`를 `rows` 조회 및
  `classifyStage` 배치와 `Promise.all`로 묶어 순차 왕복 2회 제거.
- **파이프라인 N+1 완화**: `getTrialOnboardingPipelineAction`의 3~5개 순차
  쿼리를 카드별로 반복하는 대신, 42건 전체의 `subject_enrollments`/
  `teacher_assignments`를 `child_id`/`subject_enrollment_id` 배치 IN 쿼리
  1~2회로 미리 가져와 메모리에서 매칭(관리자 페이지의 크레딧/QC 배치 수정과
  동일 패턴, `docs/CURRENT.md`의 "N+1 corrective" 선례 재사용).

## B. 문제 은행 / 답안 / 채점 / 과제 / 아카이브 — 현행 DB·화면 조사

### 현재 존재하는 것

- `problems`(문제 원본): `format`(mc/essay/math), `difficulty`, `status`(draft/confirmed만
  — "검토 대기"/"보관" 상태 없음), `subject_id`, `section_id`(교재 섹션 연결),
  `problem_keywords`(키워드 연결 테이블, **이미 존재**).
- v3 배정 경로: `session_homework_items`(세션·학생·문제 단위 배정, 제출 잠금
  트리거 있음) → `session_homework_attempts`(`response jsonb`, `submitted`,
  제출 후 수정 불가 — 유형 무관하게 구조는 이미 3가지 답안 형태를 담을 수 있음).
- 레거시 경로: `homework_items`(세션·문제 단위, `student_answer text`,
  `graded boolean`, `score text`) — `legacy_sessions` 연결, v3와 별개.

### 확인된 구조적 공백 (migration 필요 근거)

1. **채점·피드백 컬럼이 v3 어디에도 없다.** `session_homework_attempts`에
   `score`/`graded`/`feedback`/`graded_by`/`graded_at`이 전혀 없다 — 제출
   저장까지는 되지만 "교사가 채점 확정"이라는 개념 자체가 v3 스키마에 없다.
   레거시 `homework_items`에는 `graded`/`score`는 있으나 `feedback` 텍스트
   컬럼이 없고 v3 세션과 연결되지 않는다.
2. **"과제" 단위 엔터티가 없다.** `session_homework_items`는 1세션에 종속돼
   교사가 그 세션 준비 화면에서 문제를 고정하는 구조뿐이다. 요청하신 "복수
   키워드 + 유형 + 총 문제 수 → 공개 문제 은행에서 자동 구성 → 제목·안내문·
   마감일 → 학생 배정"이라는 세션과 독립적인 과제/모의고사 엔터티(제목,
   마감일, 배정 학생 목록을 갖는 상위 테이블)가 없다.
3. **`problems.status`에 "검토 대기"/"보관"이 없다.** enum이 `draft`/`confirmed`
   두 값뿐 — 요청하신 초안/검토 대기/공개/보관 4상태 워크플로우와 맞지 않는다.
   `confirmed`를 그대로 "공개"로 재해석할지, enum을 확장할지 결정 필요(enum
   확장은 마이그레이션 + 기존 `confirmed` 데이터 백필 필요).
4. **AI 초안 생성 경로가 없다.** `problems.created_by`만 있고 AI 생성 여부를
   구분할 플래그/메타데이터가 없다 — 문제 은행 운영 화면(관리자 검수 큐)
   자체가 아직 없다(코드 검색 결과 문제 CRUD 화면은 세션 준비 경로에서
   교사가 "기존 문제 선택"하는 화면뿐, 관리자용 문제 은행 관리 화면 없음).
5. **아카이브 필터(과목·키워드·유형·채점 상태·기간)는 새 테이블 없이도
   가능** — `session_homework_attempts` ⋈ `session_homework_items` ⋈
   `problems`(+`problem_keywords`)로 뷰/쿼리 조합만으로 충족 가능. 단, 채점
   상태 필터는 위 1번의 채점 컬럼이 먼저 있어야 의미가 생긴다.

### 결론

기존 v3 모델(`session_homework_items`/`attempts`)은 "세션에 딸린 개별 과제"
용도로는 이어받을 수 있지만, 이번 요구사항(채점 확정·피드백·독립적인 과제/
모의고사·문제 상태 4단계)은 **additive 마이그레이션 필요** — 기존 데이터를
바꾸는 게 아니라 컬럼·테이블을 더하는 방식으로 가능해 보인다(파괴적 변경
불필요, 구현 단계에서 재확인).

## C. 레거시 vs v3 중복·충돌 (교사 커리큘럼)

`docs/CURRENT.md`의 2026-09-09 "4번 설계 보고" 절에 이미 상세 설계가 있다
(교사 공통 운영본 v3 대체 엔터티 — `teacher_curriculum_profiles`/
`_profile_units` 신설안, 이관 순서 4단계, 아직 미착수). 이번 조사에서 추가로
확인한 것: `app/admin/users-data.ts::loadTeachers()`가 레거시
`enrollments`만 조회해 관리자 "매칭된 학생" 표시가 v3 배정을 반영하지 못하는
표시 전용 버그가 `docs/CURRENT.md`에 미반영 항목 7번으로 이미 기록돼 있음 —
이번 배치 범위에 포함할지 결정 필요(표시 전용, 예약/수업권 로직 영향 없음).

## D. 교재 문서 저장 — 자동/수동 여부

*(시간 제약으로 이번 조사에서는 코드 존재만 확인, 저장 트리거 지점의 상세
추적은 다음 라운드로 이월 — 아래 "확인 안 된 것"에 명시)*

## E. P0/P1/P2 분류 기준 (제안)

- **P0(즉시, 이번 배치)**: 사용자에게 기술 오류가 그대로 노출되거나(React
  error #441), 화면이 통째로 비어 실제 존재하는 데이터를 못 보게 만드는 것
  (교사 학생별 커리큘럼 빈 화면, 학생 홈-수업탭 불일치). 데이터 손실/불일치
  위험은 없지만 신뢰도에 직접 영향.
- **P1(다음 배치)**: 성능/구조 문제로 기능은 동작하나 체감 품질을 해치는 것
  (상담 로딩 워터폴 — A), 확인 없는 위험 액션(재처리/배정 버튼).
- **P2(설계 후 별도 라운드)**: 새 데이터 모델이 필요한 기능 확장(문제 은행
  운영 화면, 채점·피드백, 과제/모의고사, 교재 저장 상태 UX) — migration
  설계·제품 오너 확정 후 진행.

## 다음 단계 제안

1. 이 보고 승인 시, A(상담 로딩)를 가장 먼저 구현(스켈레톤 + prop 재사용 +
   쿼리 범위 축소 + 병렬화 — 마이그레이션 불필요, additive 코드 변경만).
2. B(문제 은행/채점) 스키마 설계안을 별도 문서로 먼저 제출 후 승인받고 착수
   (컬럼 확장 방향 결정 필요: `problems.status` enum 확장 여부, 채점 컬럼
   위치).
3. C는 기존 설계 문서(`docs/CURRENT.md` 4번 절) 그대로 승인만 받으면 착수
   가능.
4. D는 다음 조사 라운드에서 실제 저장 버튼 존재 여부·debounce/autosave 로직을
   코드 추적 후 별도 보고.

### 확인 안 된 것 (이번 조사 범위 밖)

- 브라우저 실측(Network 탭 왕복 시간, 렌더링 시간) — classifier 거부로 미실시.
- D(교재 문서 저장) 상세 코드 추적.
- B의 "문제 은행 운영 화면" 현재 화면 유무를 관리자/교사 양쪽에서 재확인
  (이번 조사는 DB 스키마 기준으로만 판단).
