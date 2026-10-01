# 포털 전수 점검 보고 (2026-09-29)

- 대상: `~/Developer/ALTON` 이전 후 로컬 앱(worktree `qa/portal-sweep`, 포트 3011) + 로컬 Supabase(54421/54422). 원격·Preview·외부 API 호출 없음.
- 방법: Playwright 헤드리스 스윕(데스크톱 1400px / 모바일 375px). 콘솔 오류·4xx/5xx·깨진 링크·권한 경계·탭별 크래시 수집. 스크립트는 `qa-scratch/`(git 제외).
- 계정: 시드 7개 + 로컬 전용 컨설턴트 `qa-sweep-<ts>@example.com`(종료 시 삭제 확인, 잔여 0).
- DB 는 다른 에이전트 테스트 데이터가 누적된 상태(학부모 379·학생 634·교사 213)라 규모 관련 결함이 드러났다.

## 1. 라우트 점검 결과

모든 라우트 HTTP 200, 수정 후 데스크톱 재스윕에서 콘솔 오류·실패 요청 0건. (표의 "수정 전 문제"는 아래 버그 번호)

| 포털 | 점검 경로 | 결과 |
|---|---|---|
| 공개 | `/`, `/login`, `/reset-password`, `/set-password`, `/invite/manual-review`, `/consult/consent`, `/consult/trial-onboarding/confirm-email`, `/schedule/[token]`, 404 | 통과. `/schedule/bogus-token` 만 서버 액션 500(#8) |
| 관리자 | `/admin?tab=` home users inquiry consult consultants matching unified-schedule booking entitlements payouts documents messenger workspace catalog problem-bank mock-exam admin-accounts devlog, `/admin/universities`, `/admin/students/[id]/roadmap`, `/admin/mock-exam`(리다이렉트) | 통과. users 탭 실패는 #3 수정. 375px 가로 넘침: home/users/payouts/catalog/problem-bank/devlog(#7, 미수정) |
| 선생님 | `/teacher?tab=` home lesson-schedule assignments assignment-requests curriculum homework materials mock-exam settlement availability vocab, planner/roadmap, session-prep, review | 통과. 375px curriculum 3px 넘침(#7) |
| 학생 | `/student?tab=` home classes homework materials mock-exam problemlog roadmap enrollment teacher consultant vocab, `/student/mock-exam/[id]` | homework 하이드레이션 오류(#1), vocab 시험 탭 크래시(#2), 타인 응시 URL 500(#4), 375px homework/enrollment 넘침(#5) — 모두 수정 |
| 학부모 | `/parent?tab=` home lessons consult enrollment entitlements roadmap bookings homework vocab (+ 숨김 consent credits materials), `/parent/mock-exam/[sid](/[aid])` | #1, #2, #5 동일 증상 — 수정. `messenger`/`history` 는 home 으로 폴백(의도된 폴백으로 추정) |
| 컨설턴트 | `/consultant?tab=` students assignments schedule documents profile settlement staff-messages college-explore | 빈 계정 기준 통과(배정 데이터가 있는 칸반·메신저는 미검증 → 아래 외부/수동 확인) |
| 수업 세션뷰 | `/session/[id]` v3(live/scheduled)·legacy × 탭 교재·문제·단어장·과제·모의고사·수업 준비 × 교사·학생·학부모·관리자 | 오류 0. 세션뷰는 교사/학생/학부모(읽기전용)/관리자(읽기전용) 라벨 정상 |

### 권한 경계 (HTTP + 콘솔)
- 비로그인: 포털 5종·`/admin/*`·`/teacher/student/*` 전부 `/login` 307. `/api/admin/*` 401.
- 타 역할: 5개 포털 루트·서브경로 전부 자기 홈으로 307. `/api/admin/*` 는 비관리자 403. `/api/cron/*` 는 비인증 503/410.
- 세션·교재: 다른 학생(형제 seoah)이 jihoon 세션·교재 접근 시 404/"찾을 수 없음". 담당 아닌 교사(dohyun)는 세션 404, session-prep "권한 없음", 플래너 "권한 없음". 컨설턴트는 세션 404.
- 같은 가구 공동 보호자(minji/hyunwoo)는 같은 자녀 세션·결과를 읽기전용으로 열람(설계와 일치).
- REST(publishable key + 로그인 JWT) 행 수 점검: 컨설턴트는 학생·세션·계약 0행. 교사 `contracts` 0행. → 주요 테이블 격리는 양호. 예외는 #9, #10.

## 2. 버그 목록

| # | 심각도 | 상태 | 요약 |
|---|---|---|---|
| 1 | 중 | 수정 | 학생·학부모 `과제` 탭 하이드레이션 오류(React #418) |
| 2 | 높 | 수정 | 단어장 `시험` 탭 크래시(`q.source.bookIds is not iterable`) |
| 3 | 높 | 수정 | 관리자 Users 탭 "불러오지 못했습니다"(URI too long), 학생·교사 목록 관계 열 누락 |
| 4 | 낮 | 수정 | 남의 모의고사 응시 URL 직접 열면 500 |
| 5 | 중 | 수정 | 375px 학생 과제·수강 과목, 학부모 수강 과목 탭 가로 넘침 |
| 6 | 낮 | 수정 | `e2e/landing.spec.ts` 가 개편된 랜딩과 불일치(스펙 부채) |
| 7 | 낮 | 보고 | 관리자 다수 탭·교사 커리큘럼 모바일 가로 넘침 |
| 8 | 낮 | 보고 | `/schedule/[token]` 잘못된 링크가 500 서버 액션 + "다시 시도" |
| 9 | 높 | 보고 | 학생·학부모가 REST 로 게시된 문제의 정답·해설(`problem_versions.correct_index/explanation`)을 직접 읽을 수 있음 |
| 10 | 중 | 보고 | 학부모가 진행 중 응시의 문항별 `correct`(정오)를 REST 로 읽을 수 있음 |
| 11 | 중 | 보고 | 학생 세션에서 `profiles` 전체 count 가 40초(RLS 정책 비용), REST 500 |
| 12 | 중 | 보고 | `.in(id목록)` 패턴이 다른 곳에도 다수(학생 데이터 로더 등) — 200개 초과 시 동일 실패 |
| 13 | 낮 | 보고 | 서버 액션이 권한 거부·빈 상태를 throw → 500 로그(planner 과제 조회, 학생 메신저 미읽음 카운트) |
| 14 | 낮 | 보고 | e2e 스펙 다수가 정책 변경 이후 낡음(아래 3절) |

### #1 과제 탭 하이드레이션 오류 — 수정(e90e893)
- 재현: 학생(jihoon) 로그인 → `/student?tab=homework`. 콘솔에 hydration 오류(`Answer Eliminator` 버튼 뒤에 Highlight 버튼 유무 불일치).
- 원인: 렌더 중 `typeof window !== "undefined" && "highlights" in CSS` 로 지원 판정 → 지원 브라우저의 첫 클라이언트 렌더가 서버 HTML 과 다름.
- 수정: `lib/use-highlight-supported.ts`(useSyncExternalStore, 서버 스냅샷 false). 적용: `app/components/HomeworkBatchPanel.tsx`, `app/session/[id]/ProblemsPanel.tsx`, `app/student/mock-exam/[attemptId]/MockExamTakeClient.tsx`. 회귀 테스트 `lib/use-highlight-supported.test.tsx`.

### #2 단어장 시험 탭 크래시 — 수정(aaf7ddc)
- 재현: 학생/학부모 `?tab=vocab` → `시험`. `TypeError: q.source.bookIds is not iterable`, 오류 화면.
- 원인: `vocab_quizzes.source` 가 `{}` 인 행(6행 중 3행)이 있는데 화면은 `bookIds/folderIds` 를 전제. 이 행을 만드는 경로(교사 발급/다른 RPC)는 미확인 — 수정은 로더에서 기본값 정규화.
- 수정: `app/student/vocab-library-data.ts` `normalizeVocabQuizSource` + `vocab-library-data.test.ts`.

### #3 Users 탭 실패 — 수정(c8e05e6)
- 재현: 관리자 `/admin?tab=users`(학부모 379명 환경) → "불러오지 못했습니다". 서버 로그 `guardian_links_query_failed`. `.in("profile_id", 379개)` → PostgREST "URI too long"(250개에서 이미 실패).
- 학생(634)·교사(213) 로더는 오류를 확인하지 않아 보호자명·과목·AP·활동 열이 **조용히 비어** 있었다.
- 수정: `app/admin/users-data.ts` `selectInChunks`(100개 단위) 를 12개 조회에 적용. 테스트 `users-data-chunk.test.ts`. 운영에서도 학부모 ~200명이 넘는 순간 재현되므로 오픈 전 필수 수정이었다.

### #4 타인 응시 URL 500 — 수정(ad36344)
- 재현: seoah 로그인 → `/student/mock-exam/<jihoon 응시 id>` → 500 "참조 코드". RPC 권한 오류가 throw. 데이터 노출은 없음.
- 수정: 학생·학부모 상세 페이지에서 `.catch(() => null)` → `notFound()`. 테스트 `app/student/mock-exam/[attemptId]/page.test.tsx`.

### #5 모바일 가로 넘침 — 수정(875306e)
- 재현: 375px 학생 `?tab=homework`(문서 폭 800px), `?tab=enrollment`(387px), 학부모 동일.
- 원인: 셸 본문 컬럼 `flex-1` 에 `min-w-0` 없음 + 과제 배치 탭 줄이 nowrap 이라 min-content 가 800px.
- 수정: Student/Parent/Teacher Shell `min-w-0`, 배치 탭 줄 `overflow-x-auto`, `StudentHomeworkTab` `min-w-0`. 테스트는 클래스 계약만(`app/shell-mobile-overflow.test.ts`, jsdom 으로 레이아웃 측정 불가 — 실측은 스윕으로 확인).

### #6 landing 스펙 — 수정(c8884df)
랜딩 개편(히어로 카피·`#consult`→`#book`)으로 스펙 실패. 스펙만 정정.

### #7 관리자 모바일 넘침 — 보고
관리자 home/users/payouts/catalog/problem-bank/devlog, 교사 curriculum(3px). 관리자는 데스크톱 전제일 수 있어 UX 결정 필요.

### #8 잘못된 예약 링크 — 보고
`/schedule/bogus-token` 이 상담 시간 선택 UI 를 그린 뒤 슬롯 조회 서버 액션이 throw(500). 개발 모드에선 "유효하지 않거나 만료된 예약 링크입니다"가 보이지만, **프로덕션 빌드는 서버 액션 오류 문구를 가려** 일반 오류 + "다시 시도"만 보일 가능성이 크다(외부 확인 필요). 제안: 액션이 `{ok:false, error}` 를 반환하도록 바꾸고 무효 토큰이면 페이지에서 바로 안내(`app/schedule-actions.ts`, `app/schedule/[token]/ScheduleForm.tsx`).

### #9 정답·해설 REST 직접 조회 — 보고(높음, DB 정책 변경 제안)
- 재현: 학생(jihoon) 로그인 후 publishable key 로 `from("problem_versions").select("id,correct_index,explanation,answers")` → 게시 문제의 `correct_index`·`explanation` 반환. 학부모도 동일. 정책 `문제 버전 조회`가 `status='published'` 이면 모든 인증 사용자에게 열려 있음.
- 정책("정답·해설은 채점 뒤에만")은 앱 payload 에서만 지켜지고 REST 로는 우회 가능. 2026-09-21 P0(모의고사·과제 JSON)와 같은 종류의 구멍이 문제 은행에 남아 있음.
- 제안(마이그레이션 금지 범위라 미수정): 학생·학부모 SELECT 를 막고(교사·관리자·작성자만) 학생 화면은 기존 정의자 RPC 경유로 정리하거나, 컬럼 단위 GRANT 로 `correct_index/explanation/answers` 제외. 적용 전 학생 화면이 이 테이블을 직접 읽는 곳 전수 확인 필요.

### #10 학부모의 진행 중 응시 정오 조회 — 보고
`mock_exam_answers` "답안 보호자 조회" 정책으로 학부모가 자녀 응시 답안의 `correct` 를 응시 중에도 읽을 수 있다(학생 본인은 0행). 의도된 열람 범위인지 제품 확인 필요.

### #11 profiles RLS 성능 — 보고
학생 JWT 로 `select count(*) from profiles`(8행 반환) 가 40초, PostgREST 500. `본인/관계자/관리자 조회` 정책의 OR 다중 EXISTS(`enrollments`, `guardian_students`, `shares_household_as_guardian_or_child`, ...)가 프로필 수에 비례해 비싸다. limit 조회는 빠르므로 화면 영향은 제한적이나, 프로필을 넓게 읽는 쿼리는 위험. EXPLAIN ANALYZE 후 정책 단순화/인덱스 제안 필요.

### #12 `.in()` 패턴 — 보고
`app/student/*-data.ts`(homework, lessons, dashboard, stats, review, problem-history …)의 `sessionIds`/`enrollmentIds` 기반 `.in()` 은 한 학생 세션이 ~200을 넘으면(주 2회 약 2년) 동일하게 실패한다. `selectInChunks` 를 공용 유틸(`lib/`)로 승격해 일괄 적용 권장.

### #13 서버 액션 throw — 보고
교사가 담당 아닌 학생의 planner 를 열면 화면은 "권한 없음"을 보이지만 서버 액션이 throw → 500 로그(`이 학생의 과제를 볼 권한이 없습니다`). 가구 없는 학생 계정의 `getMyHouseholdMessengerUnreadCountAction` 도 throw. 기능 영향은 없고 로그·모니터링 노이즈.

## 3. 이전(iCloud → Developer) 부작용 점검
- 코드·설정에 iCloud/절대경로 잔재 없음(`app lib utils scripts supabase e2e *.json *.ts` 전수 grep). 언급은 `CLAUDE.md`·`docs/` 이력뿐(의도됨).
- `.env.local` vs `.env.example`: 앱이 읽지만 `.env.example` 에 없는 변수 다수 — `CRON_SECRET`, `PAYOUT_CRON_ENABLED`, `RETENTION_BATCH_ENABLED`, `DRIVE_ARTIFACTS_ALLOW_REAL_WRITES`, `CALENDAR_SYNC_ALLOW_REAL_CALLS`, `DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS`, `COMPANY_DOCUMENTS_*`, `CONSULT_ORGANIZER_EMAIL`, `WORKSPACE_EVENTS_PUBSUB_TOPIC/PUSH_*`, `VERCEL_*`(`SUPABASE_SERVICE_ROLE_KEY` 는 실제로는 `SUPABASE_SECRET_KEY` 를 씀). `.env.local` 에만 남은 미사용 값: `CALENDLY_*`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, `VERCEL_OIDC_TOKEN`. `.env.example` 은 `CONTRACT_AUTO_DISPATCH_ENABLED`, `GOOGLE_WORKLOAD_IDENTITY_AUDIENCE`, `GOOGLE_WORKSPACE_*`, `WORKSPACE_*_ALLOW_REAL_*` 가 있으나 `.env.local` 에는 없음(외부 연동 비활성 상태로 정상). → `.env.example` 갱신 권장(문서 작업).
- 포트: `NEXT_PUBLIC_SITE_URL`·`supabase/config.toml` redirect·`playwright.config.ts`·`.claude/launch.json` 은 모두 3010. 3011 로 띄우면 비밀번호 재설정 링크 등 콜백이 3010 을 가리킨다(이번 점검엔 영향 없음).
- Supabase 로컬 스택 포트(54421/54422/54425/…)는 `config.toml`·`.env.local` 일치. 로컬 SMTP(54325) 연결 설정 일치.
- `.env.local` 에 Anthropic·Stripe·DocuSign 키가 채워져 있어 로컬에서도 해당 기능을 누르면 실제 호출이 나간다(이번 점검에서는 호출하지 않음).

## 4. 기존 e2e 부분 실행(스펙 부채, #14)
실행: smoke landing auth-roles r6-lesson-booking-flow problem-bank-flow m1-consultation-flow 등 + 부가 스펙. 통과 49 / 실패 12(랜딩 1건은 수정) / 미실행 서열 의존 다수.
- `landing`(수정), `m1-consultation-flow`: 랜딩의 슬롯 캘린더가 제거된 정책(커밋 9b9f734 "슬롯-제거 흐름") 이후 스펙 미갱신.
- `account-invites`×5: 관리자 Users 탭의 `+ 초대`·학부모 `?tab=family` 가 비활성화됨(`FamilyTab` 미사용) — 스펙 미갱신.
- `account-lifecycle` suspended: `protect_account_status` 트리거가 `app.bypass_status_protect` 로도 막음.
- `m4-trial…` 1번, `minor-consent`, `r4-admin-entitlement-ledger`(제목 "수업권 원장"→"Entitlements"), `session-review-flow`(`?tab=schedule`→`lesson-schedule`): UI 개편 후 미갱신.
→ 앱 결함이 아니라 스펙 정리 대상. 별도 라운드에서 정책 확인 후 갱신 권장.

## 5. 외부 확인 필요(오늘 검증 못 함)
| 항목 | 이유 | 확인 방법 |
|---|---|---|
| Google Calendar/Meet, Drive, Workspace | 실제 호출 금지 | Preview 에서 상담 확정·교재 동기화·Smart Notes reader 권한 |
| DocuSign | 샌드박스 호출 금지 | 계약 발송·웹훅·`/api/admin/docusign-preflight` |
| Stripe 결제·웹훅 | 호출 금지 | 테스트 카드로 수업권 구매·환불 |
| Anthropic(문제 생성·리뷰 초안·단어 뜻풀이) | 호출 금지 | 문제은행 AI 생성 표본 1건 |
| 이메일 발송(초대·비밀번호 재설정·상담 예약 링크) | 로컬 Mailpit 만 | Preview 실제 SMTP 수신 |
| Vercel env / cron | 접근 금지 | `CRON_SECRET`, `PAYOUT_CRON_ENABLED`, `RETENTION_BATCH_ENABLED`, `NEXT_PUBLIC_SITE_URL`(Preview 도메인), 프로덕션 빌드에서 #8 문구 |
| 컨설턴트 칸반·메신저·문서 | 배정 데이터 있는 컨설턴트 계정 없음 | Preview UAT 컨설턴트로 신규 배정→예약 링크→상담 결과 |
| 관리자 문제은행 상세 편집·모의고사 조립·정산 화면의 쓰기 동작 | 스윕은 읽기·서브탭 전환 위주 | 수동 UAT |
