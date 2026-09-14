# 상담 로딩·포털 공통 로딩·UAT 3건·콘텐츠 모델 — 보완 조사 보고 (v2, 구현 전)

조사만 수행, 코드/마이그레이션/Preview/Production 변경 없음. v1
(`docs/2026-09-09-consult-loading-and-keyword-content-investigation.md`)의
"실측 완료" 표현이 부정확했던 부분(브라우저 계층)을 이번 보고에서 실제
Playwright 계측으로 교체하고, 지적받은 수치 오류를 정정한다.

## 0. 측정 방법 정정

v1에서는 브라우저 계층을 못 재고 DB 원시 쿼리만 쟀다. 이번엔 로컬
`supabase start` + `next dev`(포트 3000, 로컬 seed 61건) 위에서 **Playwright로
실제 로그인 → 페이지 이동 → 네트워크 요청을 계측**했다(`e2e/helpers.ts`의
기존 `loginAs()`/`ACCOUNTS`를 그대로 재사용, 계측 스크립트는 저장소에 커밋하지
않고 조사 후 삭제함). Claude Code 브라우저 프리뷰 도구는 admin 계정이 첫 화면
좌표 오차로 관리자 Google 로그인 버튼을 잘못 클릭해 실제 Google OAuth로
빠지는 문제가 있어(계정 없음, 외부 인증 시도 중단) 포기했고, 대신 Playwright
스크립트로 전환해 정상 재현했다. 이 정정 자체가 "실측 완료"를 함부로 쓰면 안
된다는 지적이 맞았음을 보여준다.

로컬 seed 데이터는 실제 운영 규모보다 훨씬 작다(상담 61건, 활성 57건). 아래
숫자는 **"현재 코드 구조가 만드는 요청 패턴"의 실측이지, 운영 규모에서의
절대 체감 속도의 실측은 아니다** — 이 구분을 표에도 명시한다.

## 1. 상담 화면 요청 단위 실측 (정정)

### 1-1. 요청 타임라인 (Playwright 실측, `/admin?tab=consult`)

| 시각(탭 진입 기준 +ms) | 종류 | 대상 | 소요(ms) | 측정 구간 | 상태 |
|---|---|---|---|---|---|
| +1 | GET | `/admin?tab=consult` (SSR, 23개 로더 Promise.all) | 576 | **GET 요청 전송 시작 → 해당 응답의 `domcontentloaded` 이벤트까지**(Playwright `page.goto(waitUntil:"domcontentloaded")` 기준 — 네트워크 왕복 + 서버의 23개 로더 실행 + 최초 HTML 파싱을 모두 포함한 값이며, 서버가 응답 바이트를 보내기 시작한 최초 시점만 재는 표준적 의미의 TTFB(Time To First Byte)가 아니다) | 200 |
| +626 | POST(Server Action) | `listKanbanBoardAction` (next-action `00ab99ea...`) | 734 | 요청 전송 시작 → 해당 요청의 `requestfinished` 이벤트(응답 바디 수신 완료)까지 | 200 |
| +1362 | POST(Server Action) | 동일 `listKanbanBoardAction` (next-action 해시 동일) | 632 | 위와 동일 | 200 |
| — | networkidle 도달 | — | **2496** (합계) | 페이지 진입 시각 → Playwright `networkidle`(500ms간 신규 네트워크 요청 없음) 도달까지 | — |

**같은 액션이 두 번 호출된 이유**: 두 POST의 `next-action` 헤더 해시가
동일해, 서로 다른 액션이 아니라 **같은 `listKanbanBoardAction()`이 두 번
실행**된 것이다. 이 프로젝트는 React 19.2.8을 쓰고 있고(`package.json`),
React 19에서도 Strict Mode는 dev 모드에서 컴포넌트를 의도적으로 두 번
마운트/언마운트해 `useEffect`를 두 번 실행시키는 동작을 유지한다(React
18에서 도입된 동작이 19까지 이어짐 — "React 18 Strict Mode"라고 쓴 v1의
표현은 버전 표기가 부정확했다, 이번 판에서 정정). 실제 프로덕션 빌드에서는
StrictMode의 이 dev 전용 이중 마운트가 없으므로 1회만 호출된다. 이번 실측의 "2회"
수치 자체를 프로덕션 체감 지연에 그대로 대입하면 안 된다 — **프로덕션에서는
최소 1회**이고, 이 정정 보고에서는 "1회 기준 실제 소요"를 아래에 별도로
정리한다. 다만 dev/prod 어느 쪽이든 **"SSR이 이미 가진 `consultations`를
버리고 마운트 후 클라이언트에서 다시 조회한다"는 구조 자체는 그대로 남는다**
— 이번 실측이 새로 확인한 것은 그 낭비의 정확한 크기(SSR 576ms + 클라이언트
재조회 최소 632~734ms)다.

**"페이지 TTFB / 첫 화면 도착 / 칸반 서버 액션 시작·완료 / 카드 렌더링
완료"에 대한 답** — 요청하신 "TTFB"는 이번 실측 방식(Playwright 페이지
레벨 계측)으로는 표준적 정의(서버 응답 첫 바이트 도달 시점)로 분리해 잴 수
없었다. 대신 위 표의 "GET 요청 전체 소요(576ms)"로 대체해 보고한다 — 이
값은 TTFB보다 크고(서버가 23개 로더를 다 끝내고 HTML을 완성해 보내는
시간까지 포함, dev 서버라 컴파일 오버헤드도 일부 섞여 있을 수 있음),
순수 TTFB만 별도로 재려면 서버 쪽에서 `Server-Timing` 헤더를 임시로
추가하거나 Chrome DevTools Protocol의 `Network.responseReceived`
타이밍을 직접 읽어야 한다(이번 조사에서는 안 함 — 다음 조사 항목으로 이월):
- GET 요청 전체 소요(SSR 완료, DOM 첫 콘텐츠 도달): **576ms** — 이 시점엔 칸반
  컬럼도 스켈레톤도 없이 하위 트리가 비어 있다가 클라이언트 컴포넌트가
  붙는다.
- 첫 화면(칸반 5개 컬럼 헤더 포함) 도착 시점: **데이터 도착 전에는 컬럼
  헤더조차 렌더링되지 않는다**(코드 확인, [ConsultationKanbanBoard.tsx:90](app/admin/ConsultationKanbanBoard.tsx:90)) —
  "첫 화면 도착"이라는 중간 상태 자체가 현재 코드에 없다.
  "불러오는 중..." 텍스트 한 줄만 576ms~1360ms 구간에 노출된다.
- 칸반 서버 액션 시작: SSR GET 완료 직후 +626ms(≈마운트 시점).
- 칸반 서버 액션 완료: +1360ms(dev 2회 호출 중 첫 번째 완료 시점) —
  프로덕션에서 1회만 호출된다면 이 완료 시점이 곧 카드 렌더링 시점.
- 카드 렌더링 완료: 서버 액션 완료 직후(React 상태 갱신, 밀리초 단위 —
  카드 자체는 순수 텍스트/버튼이라 렌더 비용이 별도 병목이 아님, 이는 코드
  구조상의 판단이며 별도로 렌더 프레임 단위 실측은 하지 않았다).

### 1-2. 다른 포털 대표 화면과의 비교(같은 방식으로 실측)

| 화면 | GET(SSR) | networkidle까지 | 정적 자산 제외 요청 수 | 마운트 후 추가 클라이언트 재조회 |
|---|---|---|---|---|
| 관리자 `/admin?tab=consult` | 576ms | 2496ms | 3 (GET 1 + POST 2) | **있음**(칸반 보드) |
| 학생 `/student` | 508ms | 1021ms | 1 (GET만) | 없음 |
| 교사 `/teacher` | 434ms | 955ms | 1 (GET만) | 없음 |
| 학부모 `/parent` | 421ms | 969ms | 1 (GET만) | 없음 |

**정정(사실과 결론을 분리)**: 이번 실측에서 확인된 **사실**은 하나뿐이다 —
학생/교사/학부모의 대표 첫 화면(홈 대시보드)은 **마운트 후 추가 클라이언트
재조회가 없다**(`HomeDashboard.tsx`/`TeacherHomeDashboard.tsx`/
`ParentShell.tsx` 홈 카드, 2026-09-09 "UI/UX 정리 1차" 라운드 구현).

이 사실에서 "포털 공통의 초기 과다 로딩 문제가 없다"는 결론까지 끌어낸
것은 v1 표현이 과했다 — **정정한다.** 코드를 보면 학생/교사 홈의 SSR
자체가 가볍지 않다 — 실제로 파일 단위로 세어 확인했다: `app/student/page.tsx`는
홈 화면에 필요 없는 단어장(`loadVocabWords`), 오답노트(`loadProblemLog`),
수업(`loadLessons`), 커리큘럼(`loadCurricula`), 과제
(`loadStudentHomework`/`loadStudentHomeworkV3`), 교재(`loadMaterialsLibrary`),
크레딧(`loadCreditsData`) 등을 포함해 **13개 로더를 첫 번째
`Promise.all`**([app/student/page.tsx:45-58](app/student/page.tsx:45))로,
과거 세션 메모·리뷰·피드백 등을 **2차 `Promise.all`**
([app/student/page.tsx:63](app/student/page.tsx:63))로 한 번에 읽는다.
같은 방식으로 센 결과 `app/teacher/page.tsx`는 7개, `app/parent/page.tsx`는
11개 로더다. admin의 23개보다는 적지만, "지금 연 탭에 필요한 것만 먼저
읽는다"는 원칙과는 분명히 다른 구조다. 즉:

- **마운트 후 중복 재조회(클라이언트가 SSR 결과를 버리고 다시 요청하는
  것)는 확인된 범위에서 admin `ConsultationKanbanBoard`(상담 탭)에 국한된
  문제다.** 이건 이번 실측이 뒷받침하는 좁은 결론이다.
- **"SSR 한 번에 여러 탭 데이터를 미리 다 읽는" 과다 로딩 자체가 포털
  공통으로 있는지 없는지는 이번 실측만으로 결론 내릴 수 없다** —
  networkidle까지의 시간이 짧다는 것은 "재조회가 없다"는 근거는 되지만
  "그 한 번의 SSR 자체가 가볍다"는 근거는 아니다(로컬 seed 데이터가 작아
  SSR 응답 자체도 실측상 400~500ms대로 나온 것일 수 있다 — 데이터 규모가
  커졌을 때도 가벼운지는 별도로 재야 한다). 이 질문은 결론을 내지 않고
  다음 성능 배치의 측정 대상으로 남긴다.

**"상담 탭 로딩 문제"는 확인된 범위에서 admin 포털의 일부 화면(최소
`ConsultationKanbanBoard` 패턴 — mount 후 자체 서버 액션 재호출 + 상세
패널 지연 로드가 함께 있는 구조)에 국한된 것으로 보이며, 4개 포털 전체에
동일한 "mount 후 중복 재조회" 패턴이 있다는 근거는 이번 실측에서 나오지
않았다** — 이 범위로 결론을 좁힌다.

이는 "각 역할의 **가장 데이터가 많은 탭**"을 잰 것이 아니라 **첫 화면
(홈)**만 잰 것이다 — 학생의 "수업" 탭, 교사의 "커리큘럼→학생별" 탭, 관리자의
"사용자" 탭처럼 목록이 큰 화면, 그리고 위에서 새로 지적한 "학생/교사 홈
SSR이 여러 탭 데이터를 한 번에 읽는 구조"의 실제 쿼리 수·소요 시간은
이번 라운드에서 아직 같은 방식으로 재지 않았다 — **다음 성능 배치의
1순위 측정 대상으로 명시한다**(아래 "다음 측정 필요" 참고). 관리자 포털
안에서도 `ConsultationKanbanBoard`와 같은 "SSR로 이미 받은 데이터를 버리고
mount 후 재조회" 패턴이 다른 탭에도 있는지는 코드 검색만으로는 전수
확인하지 못했다(관리자 탭이 20개 이상이라 이번 조사 범위에서 전수 재현
측정은 하지 않음 — 우선순위 판단 근거로 아래
"P0/배치" 절 참고).

### 1-3. 사용자 규모가 늘 때 함께 늘어나는 경로

- `listKanbanBoardAction`의 `active.map(classifyStage)` — 활성 상담 카드
  수(현재 57건)에 **선형 비례**해 `Promise.all` 배치 크기가 늘어난다.
  카드 수가 늘어도 개별 카드의 내부 순차 왕복 횟수(최대 11회, 1-4절 참고)는
  줄지 않으므로, DB 커넥션 동시 사용량은 "활성 카드 수 × 최대 11"로
  선형 증가한다.
- `admin/page.tsx`의 `loadStudents`/`loadTeachers`도 전체 학생·교사를
  무조건 전부 로드한다(페이지네이션 없음) — 학생·교사 수가 늘면 이 SSR
  단계 자체가 함께 느려진다(이번 라운드에서 시간 추적은 안 했으나 코드
  구조상 확정적).
- 반대로 이미 배치 조회로 고쳐진 부분(`loadStudentCreditHistoryBatch`/
  `loadTeacherQcWarningsBatch`, 2026-09-09 corrective)은 학생·교사 수가
  늘어도 쿼리 **횟수**는 늘지 않는다(1회 배치) — 이 패턴이 아직 안 된
  나머지 로더들과 대비된다.

## 2. 칸반 카드·쿼리 수 정정 (정확한 수치)

| 항목 | 수치 |
|---|---|
| `consultations` 전체 행 수(로컬 seed) | **61** |
| `closure_type IS NOT NULL`(종료 처리됨, 지난 상담) | **4** |
| `status IN ('cancelled','no_show')` | **0** |
| 활성 카드(칸반에 실제 표시되는 수, `closure_type IS NULL AND status NOT IN (...)`) | **57** |
| 그중 `status='completed' AND outcome='trial_recommended'`(파이프라인 조회 대상) | **42** |

### 2-1. `admin/page.tsx` 로더 수 정정

**23개**(지적하신 대로 22가 아니라 23이 맞다 — `loadAdminDashboard`부터
`listOpenOrRecentPaymentDisputes`까지 [app/admin/page.tsx:70-92](app/admin/page.tsx:70)),
+ 그 결과에 의존하는 2차 배치 `Promise.all` 2건(`loadStudentCreditHistoryBatch`/
`loadTeacherQcWarningsBatch`, [app/admin/page.tsx:97-100](app/admin/page.tsx:97)) = **총 25개 로더 호출**,
1차 23개는 서로 병렬, 2차 2개는 1차 완료 후 실행(의도된 순차 — 학생/교사 id
목록이 먼저 있어야 배치 조회 가능).

### 2-2. "완전한 체험 추천 카드"의 실제 순차 조회 수 (누락 없이 재검토)

`getTrialOnboardingPipelineAction()`을 처음부터 끝까지 다시 읽어 전수
확인한 결과, v1에서 "3~5회"로 축소해 적었던 것이 **틀렸다**. `childId`가
있고 `contracts` 행까지 있는(정규 계약까지 진행된) "가장 완전한" 카드
기준, 실제로는 아래 **11개**의 DB 조회가 전부 `await`로 순차 실행된다
(중간에 `Promise.all`이 전혀 없음, [trial-onboarding-actions.ts:544-649](app/admin/trial-onboarding-actions.ts:544)):

1. `consultations`(grant status/error)
2. `subject_enrollments`(최신 1건)
3. `teacher_assignments`(활성 배정, subjectEnrollmentId 있을 때)
4. `trial_smart_notes_consents`
5. `entitlement_grants` ⋈ `entitlement_products`
6. `sessions`(최신 체험 세션, subjectEnrollmentId 있을 때)
7. `lesson_reviews`
8. `trial_regular_progress_selections`
9. `contracts`(최신 1건)
10. `contract_versions`(contract 있을 때)
11. `purchases`(contract 있을 때)

`childId`가 없거나 계약 전 단계면 일부(9~11, 또는 3·6~8)는 생략되지만,
**정규 계약까지 간 카드는 정확히 11회** 순차 왕복한다. 이 배치가 카드마다
`Promise.all`로 병렬 실행되므로 벽시계 시간은 "가장 느린 카드의 11회 순차
왕복" 하나로 수렴하지만(카드 수가 늘어도 이론상 벽시계는 안 늘 수 있음 —
DB 커넥션 풀이 병목이 아니라면), **DB에 동시에 걸리는 쿼리 총량**은
"42건 × 각 카드의 실제 단계 수(최소 2 ~ 최대 11)"로, 로컬 seed 기준으로도
수백 건대 동시 요청이 발생한다. 이 총량이 로컬 Postgres 커넥션 풀·PostgREST
동시 처리 한도를 실제로 압박하는지는 이번 조사에서 별도로 부하 재현은
하지 않았다(다음 조사 항목으로 명시).

## 3. UAT 오류 3건 — 개별 조사

### 3-1. 관리자 과목 키워드 저장 — React error #441

**재현 시도 결과(Playwright, 로컬)**: 정상 흐름(신규 키워드 1건 생성) →
성공, DB 반영 확인, 화면에 칩 정상 표시. 재진입 후 같은 라벨 재입력 →
서버가 `23505`(unique violation)를 감지해 `"이미 존재하는 키워드입니다."`로
정확히 매핑, 화면에도 그 문구가 정확히 노출됨(`updateSection` 계열과 달리
이 경로는 실제로 설계대로 동작하는 것을 이번에 직접 확인했다). **즉 "중복
입력 시 사용자용 안내"는 이미 정상 작동한다 — 재현 실패, 이 부분은 추가
수정이 필요 없어 보인다(반증 완료).**

**React error #441 자체는 이번 조사에서 재현하지 못했다 — 이건 조사
종료 사유가 아니라 재현 조건이 이번 로컬 dev 시도와 달랐다는 뜻으로만
취급한다.** 원인 후보를 코드로 좁혀 남긴다(추가 재현 필요, 결론 아님):
- `handleCreateKeyword()`([SubjectTemplateTab.tsx:186](app/admin/SubjectTemplateTab.tsx:186))가
  요청 진행 중 버튼을 비활성화하지 않는다 — 이중 클릭 시 같은 라벨로 두
  요청이 동시에 나갈 수 있다(유니크 제약이 있어 DB 정합성은 깨지지 않지만,
  두 프라미스가 서로 다른 타이밍에 resolve하면서 `keywords` state를 클로저로
  읽는 `setKeywords(next)`가 경쟁해 화면 쪽 배열에 항목이 씹히거나 중복되는
  시나리오는 코드상 배제되지 않는다).
- React 미니파이드 에러 번호(#441)는 **프로덕션 빌드**에서만 나타나는
  형식이다 — 이번 재현은 `next dev`(비압축 에러)로 했다. dev 원인 재현이
  안 됐다고 여기서 조사를 끝내지 않는다 — 실제 UAT가 발생했던 조건과
  최대한 같은 조건에서 다시 재현해야 원인을 특정할 수 있다.

**배치 P0-2 재현·수정 계획(구체화)**:

1. **재현 조건**: 로컬 `next dev`가 아니라 (a) `next build && next start`로
   띄운 로컬 프로덕션 빌드, 또는 (b) 실제 UAT가 발생한 Preview 배포
   (`preview/m4-integration-verification` 계열 최신 브랜치)에서 그대로
   재현한다 — 어느 쪽이든 **압축된 에러 번호(#441)가 실제로 뜨는 조건**을
   먼저 확보하는 것이 착수 조건이다. Preview에서 재현할 경우 실행
   ID가 붙은 전용 UAT 계정을 새로 발급해 쓴다(CLAUDE.md 정책, 기존
   운영 데이터 오염 금지).
2. **재현 시나리오 4가지**(전부 같은 빌드/환경에서 순서대로):
   a. 새 과목의 새 키워드 최초 생성(정상 흐름) — 이 단계에서 크래시가
      나는지부터 확정.
   b. 같은 화면에서 이어서 이미 태깅에 쓰이는 기존 키워드를 다른 단원에
      적용(toggle) — `assignUnitKeyword`/`removeUnitKeyword` 경로가
      섞였을 때도 크래시가 나는지.
   c. 같은 라벨을 중복 입력(이미 3-1에서 로컬 dev 기준으로는 정상 확인된
      경로) — 프로덕션 빌드에서도 "이미 존재하는 키워드입니다."만 뜨고
      크래시가 없는지 재확인(로컬 dev 결과가 프로덕션에서도 유지되는지
      확인하는 게 목적, 이미 맞다고 단정하지 않는다).
   d. "추가" 버튼 이중 클릭(위에서 코드로 지적한 경쟁 상태 후보) — 실제로
      크래시를 유발하는지.
   e. 키워드 추가 성공 후 브라우저 새로고침으로 재진입 → 방금 만든
      키워드가 칩으로 남아 있는지(DB와 화면 상태 일치 여부의 최종 확인).
3. **재현되면**: 콘솔/서버 로그의 실제(비압축) 에러 메시지와 스택을 먼저
   확보한 뒤에만 수정한다 — 에러 메시지를 보지 않고 추측성 수정(예:
   이중 클릭 방지만 넣고 끝내는 것)으로 종료하지 않는다.
4. **수정 후 화면 노출 방식**: 원인이 무엇이든, 실패 시 사용자에게는
   React/기술 스택 트레이스가 아니라 안전한 한국어 안내 문구만 보이게
   한다(예: "키워드를 추가하지 못했습니다. 잠시 후 다시 시도해주세요.") —
   현재 `keywordError` state가 `e.message`를 그대로 노출하는 지점
   ([SubjectTemplateTab.tsx:194](app/admin/SubjectTemplateTab.tsx:194))이
   서버가 예상 못한 에러(예: React 크래시로 인한 경우)를 던지면 사용자
   문구가 아닌 원본 에러 문자열이 그대로 노출될 여지가 있는지도 함께
   재확인한다.
5. **P0-2 UAT 합격 기준**(Preview, 실행 ID 붙은 전용 계정):
   - 신규 생성: 크래시 없이 칩이 즉시 표시.
   - 기존 키워드 재적용(다른 단원에 toggle): 크래시 없음.
   - 중복 입력: 크래시 없이 "이미 존재하는 키워드입니다." 안내만 노출.
   - 이중 클릭: 크래시 없음, 키워드가 중복 생성되지 않음(정확히 1건).
   - 새로고침 후 재진입: 방금 만든 키워드가 칩으로 정확히 남아 있음.
   - 위 5가지 중 어느 것에서 실패가 나더라도 화면에는 기술 에러 텍스트가
     아니라 안내 문구만 노출됨.

### 3-2. 학생 홈-수업 탭 일정 불일치 — 확정 원인

코드로 완전히 특정했다(추정 아님):

- **홈 대시보드**(`app/student/HomeDashboard.tsx`의 캘린더·예정 수업 위젯)는
  `app/student/dashboard-data.ts::loadDashboardData()`가 공급하며, 이 함수는
  **레거시 `enrollments` + `legacy_sessions`만** 조회한다
  ([dashboard-data.ts:38-70](app/student/dashboard-data.ts:38)). `status='upcoming'`인
  `legacy_sessions` 행만 `upcoming`/캘린더에 들어간다.
- **"수업" 탭**(`app/student/ClassesTab.tsx`)은 설계상(주석,
  [ClassesTabProps 위 주석](app/student/ClassesTab.tsx:9)) v3
  예약(`sessions`/`reservations`, `upcomingBookings` prop)과 레거시
  `upcoming`/`past`(`legacy_sessions`, 동일하게 `app/student/lessons-data.ts::loadLessons()`가
  공급)를 **두 개의 분리된 블록으로 이어 붙여** 보여준다 — "행 단위로 합칠
  수 없어 v3 블록 아래에 레거시 블록을 이어서 보여주는 방식"이라고 코드
  주석에 명시돼 있다.
- **결론**: 학생의 예정 수업이 **v3 `sessions`/`reservations`(신규 예약
  경로)에만 있고 레거시 `enrollments`/`legacy_sessions`에는 없는 경우**,
  "수업" 탭의 v3 블록에는 뜨지만, 홈 대시보드(`loadDashboardData`)는 v3를
  전혀 조회하지 않으므로 캘린더와 예정 수업 위젯 어디에도 나타나지 않는다.
  **레거시/v3 어느 쪽이 원본인지의 문제가 아니라, 홈 대시보드 하나만 v3
  경로 자체를 아직 조회하지 않는다는 단순 누락이다.**
- 시간대 처리는 두 로더 모두 `Date`를 직접 비교하며 별도 타임존 변환이
  없다(서버 로컬 타임존 그대로) — 이번 조사에서 시간대 경계값(자정 근처)
  버그는 별도로 재현하지 않았다.

### 3-3. 교사 학생별 커리큘럼 빈 화면 — 확정 원인

이것도 코드로 완전히 특정했다:

- 학생 선택 버튼 목록(`students` prop, `app/teacher/roster-data.ts::loadRoster()`)은
  **2026-09-09에 이미 레거시+v3(`teacher_assignments`+`subject_enrollments`)를
  합치도록 고쳐졌다** — 즉 v3로만 배정된 학생도 이름 버튼 자체는 정상 노출된다
  ([roster-data.ts:23-46](app/teacher/roster-data.ts:23), 주석에 수정 이력 명시).
- 문제는 그 다음 단계: 학생을 클릭한 뒤 **과목 카드 목록**을 렌더링하는
  `StudentSubjectPicker`([CurriculumTab.tsx:301](app/teacher/CurriculumTab.tsx:301))가
  `curricula: TeacherCurriculumData[]`를 `studentId`로 필터링하는데
  (`subjectsForStudent = curricula.filter(c => c.studentId === selectedStudentId)`,
  [CurriculumTab.tsx:322](app/teacher/CurriculumTab.tsx:322)), 이 `curricula`는
  `app/teacher/curriculum-data.ts::loadAllStudentCurricula()` →
  `app/student/curriculum-data.ts::loadCurricula()`로 이어지는 **레거시
  전용 소스**다(v3 `subject_enrollments`/`teacher_assignments`를 전혀 보지
  않음).
- **결론**: v3로만 배정된 학생은 이름 버튼은 보이지만 클릭하면
  `subjectsForStudent.length === 0`이 되어 "아직 배정된 커리큘럼이
  없습니다." 빈 상태만 보인다 — 이것이 정확히 보고된 "실제 v3 배정과
  학생이 있는데도 학생별 탭이 비어 있다"의 원인이다. v3 전용 화면
  (`StudentCurriculumOperatingView`, `subView.type === "operating-curriculum"`)은
  이미 구현돼 있지만, 이 일반 클릭 경로에서는 **연결되지 않고** 있고,
  다른 화면에서 넘어오는 딥링크(`jumpTo`/`operatingCurriculumJumpTo`
  props)로만 도달 가능하다.
- 수정 방향(참고, 미착수): `StudentSubjectPicker`가 과목이 legacy
  `enrollment`인지 v3 `subject_enrollment`인지 구분해 후자는
  `{type:"operating-curriculum", subjectEnrollmentId, subjectId}`로,
  전자는 기존 `{type:"curriculum", enrollmentId}`로 분기해야 한다 —
  `roster-data.ts`가 이미 두 소스를 구분해 담고 있으므로(`RosterSubject`
  타입에 출처 플래그만 추가하면), 이 변경은 **코드 변경만으로 가능해
  보인다(마이그레이션 불필요)** — 최종 확인은 구현 착수 시.

## 4. 관리자 후보 미리보기 / 문제 은행 — 기존 모델 가능 범위

### 4-1. 후보 수·원인 분리 계산 가능 여부

`SessionPrepPanel`/`session-prep-data.ts`(R9 Task 1-2, 이미 구현됨)가 이미
"키워드로 검색되는 공개 교재 섹션·확정 문제 후보를 표시"하는 정확히 같은
질의 패턴(키워드 조인 → 후보 목록)을 쓰고 있음을 확인했다(`docs/CURRENT.md`
2026-09-09 절 3번 참고, 코드 재확인 완료:
`curriculum_doc_section_keywords`/`problem_keywords` 조인 테이블이 이미
있어 "이 키워드를 가진 공개 섹션/문제" 질의 자체는 **기존 테이블만으로
가능**하다). 관리자 화면(과목 템플릿 회차별)에 이 후보 수·미리보기를
붙이는 것은 **같은 조회 로직을 재사용하는 신규 UI**이지 새 테이블이 필요한
작업이 아니다.

원인 분리("키워드 없음"/"공개 교재 없음"/"공개 문제 없음")도 판별 로직만
추가하면 된다: 그 회차에 태그된 키워드가 0개면 "키워드 없음", 있는데 그
키워드로 `curriculum_doc_sections.status='published'`(정확한 컬럼명은
`curriculum_docs.status`이고 섹션은 그 아래 — 구현 시 정확한 조인 경로
재확인 필요) 조인 결과가 0이면 "공개 교재 없음", `problems.status='confirmed'`
조인 결과가 0이면 "공개 문제 없음" — **모두 additive migration 불필요,
UI+쿼리 조합만으로 가능.**

### 4-2. 문제 상태·AI 초안·채점·과제·아카이브 — 기존 모델 가능 범위 표

| 기능 | 현재 스키마 | 기존 모델로 가능? | additive migration 필요 사항 |
|---|---|---|---|
| 문제 상태 4단계(초안/검토 대기/공개/보관) | `problems.status`는 `draft`/`confirmed` 2값 enum | **불가** | enum에 `in_review`/`archived` 추가(또는 값 이름 재정의) — 기존 `confirmed` 데이터 백필 방향 결정 필요 |
| AI 초안 생성 표시 | `problems.created_by`만 있음, AI 여부 구분 불가 | **불가** | `problems.generated_by`(`'ai'`\|`'admin'`) 또는 `created_by IS NULL`을 AI로 규약화 — 컬럼 추가 쪽을 권장(명시적) |
| 관리자 검수 큐 화면 | 코드 검색 결과 관리자용 "문제 은행 관리" 화면 자체가 없음(교사가 세션 준비에서 "기존 문제 선택"하는 화면만 존재) | 화면 신규 개발 필요(스키마는 상태 컬럼만 있으면 됨) | 위 상태 enum 확장에 의존 |
| 과목·난이도·유형·키워드 관리 | `subject_id`/`difficulty`/`format`/`problem_keywords` 전부 존재 | **가능** | 없음 |
| 교사 확정 채점(문제별/일괄) | `session_homework_attempts`에 `score`/`graded`/`feedback`/`graded_by`/`graded_at` **전무** | **불가** | 해당 컬럼들 추가(additive) — 일괄 채점은 UI 레벨 배치 UPDATE로 충분, 새 테이블 불필요 |
| 미채점 수 카운트 | 위 채점 컬럼이 있어야 의미 있음 | 채점 컬럼 선행 필요 | 위와 동일 |
| 독립 과제/모의고사(제목·안내문·마감일·학생 배정) | `session_homework_items`는 **세션 1개에 종속**, 세션과 독립적인 상위 엔터티 없음 | **불가** | 신규 테이블 `assignments`(제목/안내문/마감일/생성 교사) + `assignment_items`(problem_id) + `assignment_students`(배정 학생) — additive, 기존 `session_homework_*`와 별개로 신설 권장(세션 종속 과제 개념을 건드리지 않음) |
| 학생 아카이브(과목·키워드·유형·채점상태·기간 필터) | `session_homework_attempts` ⋈ `session_homework_items` ⋈ `problems`(+`problem_keywords`)로 조합 가능 | **채점 컬럼 추가 후 가능**(새 테이블 불필요, 인덱스만 점검) | 위 채점 컬럼에 의존, 조회 성능을 위한 인덱스만 추가 검토 |
| 객관식/서술형/풀이형 구분 | `problem_format`(`mc`/`essay`/`math`) 이미 3종 — 요청한 3유형과 매핑 가능(math≈풀이형) | **가능** | 화이트보드 입력을 `session_homework_attempts.response jsonb`가 이미 임의 구조를 담을 수 있어 스키마 변경 불필요, 프런트 캔버스 직렬화 포맷만 정의 필요 |

## 5. "키워드 자동 구성" — 확정된 제품 정책과 현행 구현의 차이

**제품 오너가 정책으로 확정**: 교사가 매 회차 교재·문제를 직접 선택해
`pinSessionSelection()`으로 pin하는 현행 방식은 유지하지 않는다. 예정
수업에서는 회차 키워드와 공개 콘텐츠(공개 교재 섹션·공개 문제)로 목록을
**자동 구성**하고, 교사는 그 위에서 **기존 키워드의 적용·제거만** 한다.
키워드를 바꾸면 목록은 **즉시** 그 결과를 반영한다. 그리고 **수업이
시작되는 시점에 그 자동 구성 목록과 교재 버전을 불변 스냅샷으로 고정**해,
이후 그 세션을 다시 열어도(또는 원본 교재/문제가 나중에 바뀌어도) 그때
그대로 재현되게 한다. 이 절은 이 정책을 기준으로 현행 구현과의 차이,
필요한 migration, UAT 기준을 다시 정리한다.

| 계층 | 확정된 정책 | 현재 구현(`session-prep-data.ts`/`SessionPrepPanel.tsx`) | 차이 |
|---|---|---|---|
| 관리자 과목 템플릿 회차 키워드 | 회차에 키워드 태깅 | 이미 구현됨 | 없음 |
| 교사 공통 운영 커리큘럼 / 학생별 회차·키워드 조정 | 키워드 적용·제거만(콘텐츠 개별 선택 없음) | `setActiveKeywords()`로 키워드 추가/제외만, 콘텐츠 선택 UI 자체가 이 계층엔 없음 | 없음(이 계층은 이미 정책과 일치) |
| 세션(예정 수업) 콘텐츠 구성 | **자동 구성** — 회차 키워드와 일치하는 공개 교재 섹션·공개 문제가 목록에 자동으로 채워짐, 교사는 목록에서 빼는 것(키워드 제거) 외에 개별 콘텐츠를 "선택"하지 않음 | **다르다**: 후보 목록만 키워드로 좁혀 보여주고, 실제 세션에 붙이려면 교사가 후보 중 항목을 하나씩 **명시적으로 선택해 `pinSessionSelection()`으로 pin**해야 한다 — 아무것도 자동으로 붙지 않는다 | **핵심 차이 — 이번 배치의 수정 대상** |
| 키워드 변경 시 목록 갱신 | 즉시 반영(자동 구성이므로 키워드를 빼면 그 키워드로만 걸리던 콘텐츠도 즉시 빠짐) | 후보 목록은 키워드 변경에 반응해 갱신되지만, 이미 pin된 콘텐츠는 키워드를 나중에 빼도 그대로 남아있음(pin은 키워드와 재연동되지 않는 별도 상태) | pin이라는 중간 상태 자체가 없어져야 함 |
| 수업 시작 시점 스냅샷 | **불변 스냅샷 고정** — 그 시점의 자동 구성 목록 + 교재 버전을 기록해, 이후 원본이 바뀌어도 그 세션은 그때 그대로 재현 | 스냅샷 개념 없음 — `pinSessionSelection()`으로 pin된 항목은 세션에 남지만, 그 항목이 가리키는 교재 본문 자체는 6절에서 확인한 대로 라이브 참조(버전 격리 없음) — pin한 "문제/교재 목록"은 고정되지만 "그 교재의 내용"은 고정되지 않음 | **6절과 동일한 버전 고정 문제 — 반드시 함께 해결** |
| 콘텐츠 원본 수정 권한 | 관리자 전용 유지 | 유지 | 없음 |

**핵심 차이는 두 가지로 좁혀진다** (임의 판단이 아니라 위 표에서 도출):
1. 세션 콘텐츠가 "교사가 고르는 것"에서 "회차 키워드가 자동으로 채우고
   교사는 키워드만 다루는 것"으로 바뀐다 — `pinSessionSelection()`(개별
   콘텐츠 선택 액션)을 정책상 더 이상 쓰지 않는다.
2. "수업 시작 시점 스냅샷"은 현재 전혀 없는 개념이다 — 이건 6절에서
   확인한 "배포된 교재 수정이 과거 세션에도 즉시 반영된다"는 문제와
   **정확히 같은 근본 원인(버전 격리 부재)**을 공유한다. 두 절의 스냅샷
   요구를 **하나의 스냅샷 메커니즘으로 함께 설계**해야 한다(교재 스냅샷과
   문제은행 스냅샷을 따로 만들 필요는 없어 보임 — 세션이 참조하는
   교재 섹션·문제 각각의 "그 시점 버전"을 기록하면 됨).

## 6. 교재 문서 저장·배포 — 완결 조사

### 6-1. 자동 저장 지점(정확한 필드·트리거)

- **제목**: `<input onBlur={(e) => handleTitleBlur(e.target.value)}>`
  ([CurriculumDocEditor.tsx:145](app/admin/CurriculumDocEditor.tsx:145)) →
  포커스를 벗어날 때만 `updateDocTitle()` 호출.
- **섹션 본문(`body`)/티칭 팁(`teachingTip`)**: `RichTextEditable`
  컴포넌트가 `contentEditable` 영역의 `onBlur`에서만 `onChange(innerHTML)`을
  호출하므로([RichTextEditable.tsx:54](app/admin/RichTextEditable.tsx:54)),
  실제로는 **키 입력마다가 아니라 포커스 이탈 시 1회** `updateSection()`이
  호출된다([CurriculumDocEditor.tsx:374-391](app/admin/CurriculumDocEditor.tsx:374)) —
  "자동 저장인지 수동인지 불분명하다"는 지적의 실체는 **자동 저장은
  맞지만(디바운스 아님, blur 기준) 그 사실이 화면 어디에도 표시되지 않는다**는
  것이다.
- **명시적 저장 버튼**: 없음. "배포하기/배포 취소" 버튼만 있고, 이건
  `status` 필드(draft/published) 토글이지 "저장" 개념이 아니다.
- **저장 상태 표시**: 없음. `updateSection()` 호출은 `await` 없이
  fire-and-forget 형태로 쓰이고([CurriculumDocEditor.tsx:376](app/admin/CurriculumDocEditor.tsx:376),
  `onChange` 콜백 자체가 `async`가 아니며 반환 프라미스를 처리하지 않음),
  실패해도 화면에 아무 표시가 없다 — 네트워크 오류 시 **그 변경분은 조용히
  유실**된다.
- **미저장 이탈 경고**: 없음. `beforeunload`/라우트 이탈 가드가 이 화면에
  없다 — 다만 blur 저장이라 "타이핑 중 탭을 그냥 닫는" 극단적 케이스가
  아니면 대부분의 이탈(다른 필드 클릭, 뒤로가기 버튼)은 blur를 먼저
  유발해 저장되긴 한다. 브라우저 탭을 직접 닫거나 새로고침하면서 포커스가
  아직 입력 필드에 있는 경우엔 경고 없이 유실.

### 6-2. 배포/배포 취소가 과거·진행 중 수업에 미치는 실제 영향

- `setDocPublished()`는 `curriculum_docs.status`만 `draft`↔`published`로
  바꾸는 **단순 플래그**다 — 버전 스냅샷을 만들지 않는다.
- 세션 화면(`app/session/[id]/material-data.ts`)은 `curriculum_doc_id`로
  **그 문서의 현재(live) 섹션을 직접 조회**한다
  ([material-data.ts:52-61](app/session/[id]/material-data.ts:52)) — 세션이
  어떤 시점의 콘텐츠를 봤는지 기록/고정하지 않는다.
- `sessions.material_version_id` 컬럼은 스키마에 존재하지만, 실제로
  이 값을 채우는 로직이 **없다** — 코드 주석이 직접 "material_version_id
  배정 메커니즘은 R9 범위(과목 템플릿 기반) — 아직 없다"고 명시한다
  ([session-source-data.ts:167](app/session/[id]/session-source-data.ts:167)).
  `curriculum_doc_versions` 테이블도 같은 이유로 죽은 상태.
- **실제 영향(결론)**: 관리자가 배포된 교재의 본문을 수정하면(blur 즉시
  저장), **이미 끝난 세션을 포함해 그 `curriculum_doc_id`를 참조하는 모든
  세션이 다음에 그 교재를 열 때 곧바로 새 내용을 본다** — 버전 격리가
  전혀 없다. "배포 취소(초안으로)"도 마찬가지로 `status`만 바꾸므로, 이미
  진행 중인 세션이 그 문서를 열려고 하면(권한/조회 조건에 `published`
  필터가 걸려 있다면) 갑자기 조회가 막히는 시나리오도 코드상 배제되지
  않는다(이번 조사에서 조회 RLS/필터 쪽까지는 재확인 못함 — 다음 조사
  항목).

### 6-3. 필요한 변경 — 코드 vs migration 분리

| 변경 | 종류 | 비고 |
|---|---|---|
| 저장 상태 표시(저장 중/완료/실패) | 코드만(UI 상태 추가, `updateSection` 호출을 await하고 결과 반영) | migration 불필요 |
| 미저장 이탈 경고 | 코드만(dirty 상태 추적 + `beforeunload`) | migration 불필요 |
| "배포된 교재 수정이 기존 수업에 영향" 안내 문구 | 코드만(수정 시도 시 경고 배너) | migration 불필요, 버전 격리 자체는 안 됨(경고만) |
| 실제 버전 격리(과거 세션은 그때 그 콘텐츠 유지) | 코드+migration | `material_version_id` 배정 시점 결정(세션 생성 시? 세션 준비 확정 시?) + `curriculum_doc_versions`에 실제 스냅샷 기록 로직 신설 — 5절의 "키워드 자동 구성 시 스냅샷 필요" 결정과 함께 설계해야 함(별개로 두 번 만들지 않기 위해) |

## 7. 구현 배치 제안 (우선순위 + 배치 단위)

각 배치는 이 보고 승인 후 별도로 착수 승인받는다(지금은 배치 설계만).

### 배치 P0-1: UAT 오류 3건 중 코드로 원인이 확정된 2건

- **대상 흐름**: 학생 홈 캘린더/예정 수업 위젯, 교사 "학생별" 커리큘럼 진입.
- **범위**: `dashboard-data.ts::loadDashboardData()`에 v3 `sessions`/
  `reservations`(`upcomingBookings`와 동일 소스) 조회 추가해 레거시와 병합;
  `CurriculumTab.tsx`의 `StudentSubjectPicker`가 legacy/v3 과목을 구분해
  올바른 `subView`로 분기. **migration 불필요**(코드만).
- **기존 데이터 이관**: 없음(조회 로직만 확장).
- **Preview UAT 시나리오**: (a) v3 전용 배정 학생으로 예약 생성 → 홈
  캘린더·위젯·수업탭 3곳에 동일하게 노출되는지, (b) v3 전용 배정 학생을
  교사 "학생별" 탭에서 선택 → 운영 커리큘럼 화면 진입되는지(빈 화면 아님).
  **(c) 시간대·날짜 경계 검증(추가)**: `loadDashboardData()`가 v3
  `sessions`/`reservations`를 병합할 때 `dashboard-data.ts`가 기존에
  `Date`를 서버 로컬 타임존 그대로 비교하던 방식을 그대로 물려받으면
  자정 근처 예약에서 날짜가 하루 밀리는 회귀가 새로 생길 수 있다 —
  아래 3가지를 전용 UAT 계정으로 실제로 만들어 확인한다:
  - v3 예정 수업을 **자정 직전**(예: 현지 23:30)과 **자정 직후**(예:
    현지 00:30)에 각각 하나씩 생성 → 홈 월간 캘린더, 홈 예정 수업
    위젯, 캘린더에서 그 날짜를 클릭했을 때의 날짜 상세, "수업" 탭
    4곳 모두 **같은 현지 날짜**에 그 수업을 표시하는지.
  - 학생 계정과 관리자/교사 계정이 **서로 다른 시스템 시간대**(예:
    학생 브라우저는 KST, 관리자 조작 서버는 UTC)에서 접근했을 때도
    학생 화면 4곳끼리는 서로 어긋나지 않는지(학생 화면 4곳 간의 내부
    일관성이 검증 목표이지, 서버-클라이언트 절대 시간 변환 정확성
    자체는 이번 배치 범위 밖이면 그렇게 명시하고 별도 항목으로 남긴다).
  - 월 경계(예: 8월 31일 23:50 KST 예약)에서 캘린더가 그 예약을 8월
    달력에 표시하는지, 9월로 밀려 보이지 않게 되지는 않는지.
  **합격 기준**: (a)(b) 두 시나리오 + (c) 3가지 시간대 경계 시나리오
  전부 회귀 테스트로 고정 + 실제 Preview 계정으로 (a)(b)(c) 각 1건씩
  수동 확인.

### 배치 P0-2: 관리자 키워드 저장 React error #441 — 프로덕션 빌드 재현 후 수정

- **범위**: 우선 `next build && next start`로 정확한 크래시 재현(이번
  조사에서 못한 부분) → 원인 확정 후 수정(이중 클릭 방지 등 후보 중 실제
  원인만 고침). **migration 불필요로 예상**(재현 후 재확인).
- **Preview UAT**: 새 키워드 생성, 기존 키워드 재적용, 중복 입력, 새로고침
  후 재진입 4가지 전부 프로덕션 빌드 기준 재확인.

### 배치 P1: 상담 탭 로딩 구조 개선

**정정된 범위 판단**: 4개 포털 첫 화면(홈) 실측 결과 학생·교사·학부모
홈에서는 **mount 후 추가 클라이언트 재조회가 없었다** — 이것만 확인된
사실이다. **"다른 포털은 이미 문제 없음이 확인됐다"는 결론은 쓰지 않는다**
— SSR 초기 과다 로딩(한 번의 페이지 로드에 여러 탭 데이터를 한꺼번에
읽는 구조 자체)은 이번 실측에서 측정·판정하지 않았다(2절 참고).
이 배치는 **"mount 후 중복 재조회"라는, 이번에 실제로 확인되고 원인까지
특정된 문제만** 고친다 — admin 상담 탭 국소 범위로 한정.

아래 화면들은 이번 배치에 포함하지 않고, **각각 별도 성능 배치의 측정
대상으로 남긴다**(우선순위·구현 여부는 그 측정 결과가 나온 뒤에 정한다):
- 관리자: 사용자 탭, 정산 탭
- 학생: 수업 탭, 교재 탭, 문제 아카이브
- 교사: 학생별 커리큘럼 탭, 수업 준비 화면
- 학부모: 다자녀 화면

- **범위**: `ConsultationKanbanBoard`가 SSR의 `consultations` prop을 첫
  렌더에 사용(중복 조회 제거), `listKanbanBoardAction`의 종료/취소 조건을
  DB 쿼리로 이동(전체 이력 로드 방지), `closedIdsData`/`rootIdsData`를
  독립 쿼리로 병렬화, `getTrialOnboardingPipelineAction`의 11단계 조회를
  카드 전체 배치 IN 쿼리로 전환(N+1 제거), 데이터 도착 전 5개 컬럼 헤더 +
  스켈레톤 카드 렌더. **migration 불필요.**
- **Preview UAT**: 활성 카드 57건(또는 그 이상) 기준 재측정해 이번 보고의
  실측 수치(2496ms/dev 2회 호출) 대비 개선 폭을 같은 Playwright 스크립트로
  재측정해 비교표로 제시.
- **후속(별도 배치로 분리 권장)**: 관리자 포털의 다른 탭에도 같은
  "SSR 데이터 버리고 mount 후 재조회" 패턴이 있는지 전수 조사(이번
  라운드에서 못함) — 있으면 이 배치와 같은 원칙으로 후속 배치.

### 배치 P2-1: 교재 저장 UX (버전 격리 없이 가능한 부분만 먼저)

- **범위**: 저장 상태 표시, 미저장 이탈 경고, 배포된 교재 수정 시 영향
  경고 배너. **migration 불필요.**
- **Preview UAT**: 저장 실패를 인위로 유발(네트워크 차단)해 실패 표시
  확인, 입력 중 새로고침 시도 시 경고 확인, published 문서 수정 시 경고
  노출 확인.

### 배치 P2-2: 문제 은행 스키마 확장 (설계 승인 먼저, 이 배치는 스키마만)

- **범위**: `problems.status` enum 확장(`in_review`/`archived` 추가 방식
  결정 필요), `problems.generated_by` 추가, `session_homework_attempts`에
  `score`/`graded`/`feedback`/`graded_by`/`graded_at` 추가. **additive
  migration.** 기존 데이터 이관: `problems.status='confirmed'`는 그대로
  "공개"로 백필(값 이름 유지 시 이관 불필요, 값 이름을 바꾼다면 백필 1회).
- **Preview UAT**: 마이그레이션 후 기존 세션 준비 화면(교사가 문제 선택하는
  기존 흐름)이 회귀 없이 그대로 동작하는지 먼저 확인(문제 은행 신규 화면은
  이 배치에 포함 안 함).

### 배치 P2-3: 문제 은행 관리 화면 + 채점 화면 + 독립 과제/모의고사

- **범위**: P2-2 스키마 위에 (a) 관리자 문제 검수 큐 화면, (b) 세션/아카이브
  채점 화면(문제별·일괄, 미채점 수), (c) 신규 `assignments`/
  `assignment_items`/`assignment_students` 테이블 + 생성·배정·미리보기 화면.
  **additive migration + 대량 신규 코드.** 기존 데이터 이관 없음(신규
  엔터티).
- **Preview UAT**: 객관식/서술형/풀이형 각 1건씩 학생 제출→교사 채점→
  아카이브 노출까지 골든 패스, 복수 키워드 과제 생성→학생 배정→채점까지
  별도 시나리오.

### 배치 P2-4: 키워드 자동 구성 전환 (5절 확정 정책 기준)

- **대상 사용자 흐름**: 교사가 "세션 준비" 화면에서 확정 회차를 열면,
  그 회차 키워드와 일치하는 공개 교재 섹션·공개 문제가 자동으로 목록에
  채워진다. 교사는 개별 콘텐츠를 고르지 않고 키워드만 적용·제거한다.
  수업이 시작되면 그 시점의 목록·교재 버전이 스냅샷으로 고정돼, 이후
  다시 열어도(또는 원본이 바뀌어도) 그때 그 구성 그대로 보인다.
- **코드 범위**:
  - `SessionPrepPanel.tsx`/`session-prep-actions.ts`에서 개별 콘텐츠
    "선택→pin" UI(`pinSessionSelection()` 호출 지점)를 제거하고, 키워드
    적용·제거 UI만 남긴다. 후보 목록 조회 로직(키워드 조인 쿼리)은 이미
    있으므로 그대로 재사용해 "후보=최종 목록"으로 바꾼다.
  - 세션 시작 액션(교사의 "수업 시작" 트리거 지점 — 기존 `finalize`/세션
    상태 전이 함수 근처, 정확한 훅 지점은 착수 시 재확인)에서 그 시점의
    키워드로 다시 검색해 나온 교재 섹션 id·문제 id 목록 + 각 교재
    섹션의 그 시점 본문(또는 버전 참조)을 스냅샷 테이블에 기록한다.
  - 세션 열람 화면(`app/session/[id]/material-data.ts`)이 세션이
    `not_started` 상태면 라이브 조회, 스냅샷이 있으면(=한 번이라도 시작된
    세션) 스냅샷을 우선 읽도록 분기(6절의 버전 격리와 동일 메커니즘 공유).
- **migration 범위(additive)**:
  - `session_content_snapshot`(가칭): `session_id`, `curriculum_doc_section_id`,
    `section_body_snapshot`(그 시점 본문 복사) 또는
    `curriculum_doc_section_version_id`(버전 테이블을 따로 둘 경우) —
    설계 시 "본문을 통째로 복사"와 "버전 테이블+참조" 두 방식 중 하나
    선택 필요(전자가 더 단순, 후자가 더 정규화됨 — 6절 교재 버전 설계와
    함께 결정).
  - `session_content_snapshot_problems`(가칭): `session_id`, `problem_id`
    (+ 그 시점 문제 내용이 바뀔 수 있다면 문제 쪽도 스냅샷 필요 여부 결정).
  - `session_prepared_selections`/`pinSessionSelection()` 관련 기존
    테이블·함수는 정책 전환 후 사용되지 않게 되지만, 과거 세션 데이터가
    이미 그 테이블을 참조하고 있다면 **삭제하지 않고 읽기 전용으로 보존**
    (과거 이력 조회 경로가 있다면 유지).
- **기존 데이터 이관**: 기존에 이미 pin되어 진행된(또는 완료된) 세션은
  소급 스냅샷을 만들지 않는다 — 정책 전환 시점 이후 새로 시작되는 세션부터
  적용(과거 세션은 기존 pin 데이터 그대로 유지, 조회 경로만 하위 호환
  유지).
- **Preview UAT 시나리오**:
  1. 회차에 키워드 2개 태깅 → 세션 준비 화면 진입 시 그 키워드로 검색되는
     공개 교재 섹션·문제가 개별 선택 없이 목록에 자동으로 채워지는지.
  2. 키워드 1개 제거 → 그 키워드로만 걸리던 항목이 목록에서 즉시 빠지는지
     (재조회 없이 반응하는지, 혹은 재조회라면 체감 지연 없는지).
  3. 그 세션을 "수업 시작" → 이후 관리자가 원본 교재 섹션 본문을 수정 →
     이미 시작된 세션을 다시 열었을 때 **수정 전 내용 그대로** 보이는지
     (스냅샷 검증의 핵심 시나리오).
  4. 아직 시작 안 한 다른 세션(같은 회차·키워드)을 열었을 때는 방금 수정한
     최신 본문이 반영되는지(라이브 조회가 살아있는지 대조 확인).
  5. 후보가 0건인 경우(키워드는 있는데 공개 교재·문제가 없음) 4-1절에서
     설계한 원인 분리 문구가 세션 준비 화면에도 동일하게 노출되는지.
- **합격 기준**: 위 5개 시나리오 전부 통과 + 기존 회귀 테스트(세션 준비
  관련 기존 테스트 스위트) 무손상.

## 확인 안 된 것 (다음 성능 배치의 측정 대상)

- **학생/교사/학부모의 "가장 데이터가 많은 탭"의 실제 요청 수·소요 시간**
  (학생 "수업" 탭, 교사 "커리큘럼→학생별" 탭 등) — 이번엔 각 포털의
  홈(첫 화면)만 쟀다.
- **학생/교사/학부모 홈 SSR 자체의 로더별 소요 시간** — 이번엔 "마운트 후
  재조회가 있는지"만 확인했고, `app/student/page.tsx`(13+로더)/
  `app/teacher/page.tsx`(7개)/`app/parent/page.tsx`(11개) 각 로더의
  개별 소요 시간과 지금 탭에 불필요한 로더가 얼마나 섞여 있는지는 아직
  재지 않았다.
- 관리자 포털 내 다른 탭들(사용자, 매칭, 예약, 정산 등)의 "SSR-후-재조회"
  패턴 전수 조사(이번엔 상담 탭만 확인).
- React error #441의 프로덕션 빌드/Preview 재현(P0-2 착수 시 1단계로 수행).
- 순수 TTFB(서버 응답 첫 바이트) 실측 — 이번 576ms는 GET 요청 전체
  소요이지 TTFB가 아니다(0절/1-1절 참고). `Server-Timing` 헤더 또는
  CDP 타이밍으로 별도 측정 필요.
- `curriculum_docs`/`curriculum_doc_sections` 조회 RLS가 `status='draft'`로
  바뀐 순간 진행 중 세션의 열람을 실제로 막는지(코드 판단상 우려만 기록,
  RLS 정책 원문 재확인 안 함).
- 로컬 seed(61건) 대비 운영 규모에서의 절대 지연(DB 커넥션 풀 포화 등)은
  부하 재현 없이는 추정 불가 — 명시.
