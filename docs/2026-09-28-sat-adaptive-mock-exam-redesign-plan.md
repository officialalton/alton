# Digital SAT 4모듈 MST 모의고사 재설계 — 조사 + 계획 (2026-09-28, v2 정정판)

> **정정 이력**: 이 문서의 최초 버전(같은 날 커밋 `51c621d`)은 오래된 브랜치(`f146af2`, 9월 초)를 기준으로 조사해 "모의고사 기능이 없다(그린필드)"고 잘못 결론냈다. 실제 개발 라인 `preview/m4-integration-verification`에는 **고정형 SAT 모의고사 V1**(`docs/2026-09-17-fixed-mock-exam-v1-spec.md`)이 구현·UAT 완료돼 있다. 이 v2는 그 V1을 기준으로 전면 재작성했다. 기준 커밋: `99280a4`.

## 0. 결론 요약

- V1은 **고정형(fixed set)**: 관리자가 문제은행(공개 문항, College Board 8영역·30세부기술 코드 태깅)에서 가중치 기반으로 R&W 27 + Math 22 세트를 조립·버전·공개하고, 교사/관리자가 학생에게 배정, 학생은 두 섹션을 자유롭게 오가며 응시, 제출 즉시 자동 채점(`graded`), 학생·보호자는 채점 후에만 정답 열람, 교사는 실시간 열람.
- MST 재설계는 **그린필드가 아니라 V1의 additive 확장**이다. 재사용: 세트/버전/공개 모델, `mock_exam_set_items`(세트 내 문항 중복 방지 unique 이미 존재), 가중치 조립 알고리즘(`lib/mock-exam/assemble.ts`), 배정/응시/답안 테이블과 RPC-only 학생 접근 원칙(20261429 P0), 자동 채점, 역할별 탭, Math 계산기·참조표(`MockExamMathTools`), 리포트 집계(`report.ts`).
- 완전히 새로 필요한 것: **모듈 개념**(세트 문항의 모듈 귀속, attempt별 모듈 상태·서버 시각 기준 마감·잠금), **서버 권위 타이머와 자동 제출**(현재는 클라이언트가 남은 시간을 저장하고 되감기 가능, 시간 종료 시 자동 제출 없음), **휴식**, **M1→M2 라우팅 정책**, **문항 snapshot**(현재 `problem_version_id` 참조 — 공개 버전은 불변 정책이지만 `problems` 삭제 시 cascade), **환산 점수·난이도 캘리브레이션**(현재 raw count만, IRT/캘리브레이션 데이터 전무).
- **정책 충돌 1건(제품 오너 결정 필요, Phase 4 전)**: 요구사항의 "총점 400-1600 / 섹션 200-800"은 V1 사양 §1·§7("College Board 점수와 동등하다고 표시하지 않음", 결과 화면 면책 문구)과 충돌한다. 제안: Phase 4에서 "예상 점수 범위(내부 추정)"로 표시하고 raw 결과와 분리, 면책 문구 유지.

## 1. 현재 V1 구조 (조사 결과, 커밋 99280a4)

### 1.1 스키마 (`supabase/migrations/20261415000000_p7_mock_exam_v1_foundation.sql` 이후)
- `mock_exam_sets`: `set_group_id`/`version_no`(unique), `difficulty_tier`(foundation/standard/advanced), `status`(draft/published/archived, 그룹당 published 1개 partial unique), `rw_time_limit_minutes`(64)/`math_time_limit_minutes`(70), `math_calculator_allowed`, `math_reference_sheet_allowed`. RLS: 관리자 전체, 인증 사용자는 published만 SELECT.
- `mock_exam_set_items`: `section`(rw/math), `position`, `problem_id`+`problem_version_id`, 비정규화 `sat_domain`/`skill_code`/`difficulty`. unique `(exam_set_id, section, position)`, **`(exam_set_id, problem_id)`** → 세트 내 중복 불가. RLS 관리자 전용(학생·교사·보호자는 RPC로만).
- `mock_exam_domain_weights` / `mock_exam_difficulty_weights`: tier×section별 영역·난이도 비율(시드: R&W 26/28/20/26, Math 35/35/15/15; 난이도 tier별 50/40/10, 25/50/25, 10/40/50). Math mc/spr 75/25는 코드 상수.
- `mock_exam_attempts`: `status`(assigned/in_progress/submitted/graded — submitted는 사실상 미사용), `start_by`/`due_at`/`max_attempts`(저장만, 미강제), `time_remaining_seconds jsonb {rw,math}`(**클라이언트가 15초마다 저장, 서버 검증 없음**), `entry_count`, `exam_set_group_id`(트리거), unique `(student_id, exam_set_group_id)`(세트 가족당 1회). RLS: 학생 SELECT 본인, 교사 SELECT/INSERT/UPDATE `teaches_student()`, 보호자·컨설턴트 SELECT.
- `mock_exam_answers`: `response jsonb`(문자열), `correct`(저장 시 서버 계산), `flagged`, `time_spent_seconds`, `saved_to_practice`. unique `(attempt_id, set_item_id)`. 학생 직접 접근 정책 없음(RPC만).
- 문제은행: `problems`(`sat_domain`, `skill_code`→`problem_skill_codes`, `exam_system`, `format` mc/spr/…, `status` confirmed, `archived_at`) + `problem_versions`(passage/question/options/correct_index/`answers`(SPR 허용답)/figure/`difficulty` 텍스트/`status` published 1개). **캘리브레이션·IRT·노출 이력 없음.**

### 1.2 RPC (전부 SECURITY DEFINER, 학생 쓰기 경로는 20261429로 RPC 고정)
- 읽기: `mock_exam_attempt_summaries(student)`(보드·학생·보호자·교사·컨설턴트 공용 — **필드명·예외 없음 보장 필수**), `mock_exam_attempt_detail(attempt)`(항목·답안·남은시간, 채점 전 정답 마스킹), `mock_exam_set_content_for_staff(set)`.
- 쓰기: `mock_exam_save_answer`(소유·상태 확인, `correct` 즉시 계산, 첫 저장 시 in_progress — **시간·마감·섹션 잠금 미확인**), `mock_exam_toggle_flag`, `mock_exam_save_section_time`(클라이언트 값 신뢰), `mock_exam_record_entry`, `mock_exam_submit`(→ 곧바로 `graded`, 재호출 시 예외).
- 채점 헬퍼 `_answer_auto_grade`: MC 인덱스 일치, SPR 공백 제거 후 문자열 일치 또는 `abs(diff)<1e-9`. **분수↔소수 동치·앞자리 0·쉼표 미지원**(숙제와 공유).

### 1.3 조립·UI
- `assembleMockExamSet`(`app/admin/mock-exam-actions.ts`) → `lib/mock-exam/assemble.ts`(largest-remainder 배분, 영역×난이도×형식 셀, `problemId` 정렬 결정적 선택, 같은 tier 공개 세트 사용 문항 우선 회피, 부족분은 보고만). 세트 insert + items insert 비원자적.
- `MockExamTakeClient.tsx`: 문항당 1화면, 좌측 번호 목록(답변✓/표시★), **섹션 pill로 R&W↔Math 자유 이동**, 섹션별 카운트다운(활성 섹션만 진행), 0초 시 클라이언트만 잠금(자동 제출 없음, 새로고침 시 서버는 계속 답안 수용), 하이라이트/소거기(미저장), 필기 canvas, Math 계산기(Desmos v1.11, API 키)·참조표.
- 역할 탭: 학생 `StudentMockExamTab`, 교사 `TeacherMockExamTab`(배정/현황/열람/내역), 보호자 읽기 전용, 세션 탭, 관리자 `MockExamSetsPanel`(생성/검토/배정/내역/공개/보관).
- 테스트: `assemble/grading/report.test.ts`, `mock-exam-attempt-flow.integration.test.ts`(로컬 DB 필요, skip 가드 없음), `app/admin/mock-exam-actions.integration.test.ts`. **모의고사 E2E 없음.**

## 2. Gap 분석 (6영역)

| 영역 | 재사용 (V1) | 신규 |
|---|---|---|
| 1. 엔진/상태 | `mock_exam_attempts` 상태·배정·`entry_count`, `mock_exam_answers`(답안·flag·`correct`), RPC-only 원칙, 자동 채점 | `mock_exam_attempt_modules`(모듈별 started/ends/locked/auto_submitted/raw), `attempts.current_module`·경로 컬럼, 서버 시각 만료 정산(모든 쓰기 RPC 진입 시), 휴식, 모듈 잠금 후 쓰기 거부, 미시작 모듈 문항 비노출 |
| 2. 문제은행 메타 | `sat_domain`/`skill_code`/`difficulty`/`format`(mc·spr)/`answers`/figure/공개 게이트/`(set,problem)` unique | 문항 난이도 추정치·M1/M2(higher/lower) 배정 가능 플래그(초기엔 difficulty 라벨에서 파생 규칙), 유사문항 그룹, 노출 이력, snapshot jsonb |
| 3. 라우팅 | 가중치 테이블 패턴(`mock_exam_*_weights`) | `mock_exam_routing_policies`(section·threshold_type·value·version), M1 잠금 시 경로 결정, `set_items.route` + M2 higher/lower 변형 조립, UI 비노출 |
| 4. 점수/리포트 | `report.ts`(섹션·영역·기술 집계), 결과 화면·면책 문구 | 난이도 분해, `mock_exam_scoring_models`(raw→예상범위 lookup, 버전·캘리브레이션 플래그), 스킬 진단 저장, 학생용 "다음 행동" |
| 5. UI | `MockExamMathTools`(계산기·참조표), 번호 네비·flag·필기·결과 뷰, 역할 탭 | MST 전용 응시 클라이언트(모듈 타이머·경고·모듈 제출 확인·휴식·자동 제출·이전 모듈 차단), 관리자 세트 생성 "형식: 고정형/MST" |
| 6. 출시 단계 | — | §6 |

## 3. 데이터 모델 (additive, 기존 컬럼 변경 없음)

- `mock_exam_sets` + `format text default 'fixed' check in ('fixed','mst')`, `module_time_limits jsonb`(mst: `{rw_m1:1920, rw_m2:1920, break:600, math_m1:2100, math_m2:2100}`).
- enum `mock_exam_module_key` (rw_m1/rw_m2/break/math_m1/math_m2), `mock_exam_route`(higher/lower — 내부 전용).
- `mock_exam_set_items` + `module_key mock_exam_module_key null`(fixed는 null), + `route mock_exam_route null`(Phase 3: M2 변형). unique `(exam_set_id, problem_id)`는 그대로 attempt 내 중복 차단(한 attempt = 한 세트).
- `mock_exam_attempts` + `current_module`, `rw_m2_route`, `math_m2_route`(내부 감사 전용).
- 신규 `mock_exam_attempt_modules(attempt_id, module_key, position, time_limit_seconds, started_at, ends_at, submitted_at, locked, auto_submitted, raw_correct_count, item_count)` unique `(attempt_id, module_key)`. RLS: 본인·`_mock_exam_can_view` SELECT, 쓰기 RPC만.
- Phase 2: `mock_exam_attempt_item_snapshots`(attempt_id, set_item_id, content jsonb) 또는 `set_items.content_snapshot jsonb` — 공개 버전 불변 정책이 있으므로 Phase 1에서는 참조 유지.
- Phase 3: `mock_exam_routing_policies`. Phase 4: `mock_exam_scoring_models`, `mock_exam_skill_diagnostics`.

## 4. RPC 설계

- `mock_exam_start_mst(p_attempt_id)`: 소유·`assigned`·세트 `format='mst'` 확인 → 모듈 5행 생성 → `rw_m1` 시작(`started_at/ends_at`) → `in_progress`.
- `_mock_exam_settle(p_attempt_id)`(내부): 현재 모듈 `ends_at < now()`면 잠금(`auto_submitted`)·raw 계산 → 다음 모듈 시작(휴식 포함) → 마지막이면 attempt `graded`(V1 자동 채점 의미 유지). 연쇄 만료 루프.
- `mock_exam_submit_module(p_attempt_id, p_expected_module)`: settle 후 현재 모듈이 기대값일 때만 잠금·전환(멱등). 휴식 조기 종료도 이 함수.
- `mock_exam_mst_state(p_attempt_id)`: 모듈 목록(서버 계산 `remaining_seconds`), 현재 모듈 문항(정답 마스킹)·답안·flag, `server_now`.
- `mock_exam_save_answer`/`mock_exam_toggle_flag` 재정의: MST attempt면 settle 후 해당 문항 모듈이 현재·미잠금일 때만 허용(fixed 동작 불변).
- `mock_exam_attempt_detail` 재정의(기존 본문은 rename해 위임): MST 진행 중 attempt를 학생/보호자가 호출하면 미시작·잠긴 모듈 문항을 제거(미래 문항 사전 노출 차단). 교사/관리자·graded는 기존 그대로.
- `_answer_auto_grade` 재정의: SPR 정규화(공백·쉼표·앞자리 0·분수↔소수 동치, 소수 4자리 허용오차) — 숙제도 공유하므로 기존 통과 사례 회귀 테스트 포함.
- Phase 3: `mock_exam_submit_module`이 M1 잠금 시 `mock_exam_routing_policies` 적용 → `*_m2_route` 저장 → M2 문항은 `set_items.route` 일치분만 노출.

## 5. 화면

- 학생: `app/student/mock-exam/[attemptId]/MockExamMstTakeClient.tsx` 신규(Bluebook 셸: 상단 모듈 라벨·타이머(5분 경고)·계산기/참조표(Math만, `MockExamMathTools` 재사용)·"모듈 제출", 좌측 번호 네비(답변/검토), 이전/다음, 휴식 화면(카운트다운·"시험 재개"), 완료 시 V1 결과 뷰). `[attemptId]/page.tsx`가 세트 `format`으로 클라이언트 선택. 모바일은 리뷰(결과)만.
- 관리자: `MockExamSetsPanel` 생성 폼에 형식 선택(고정형/4모듈 MST). Phase 2에서 검수 화면에 M1/M2 배정 플래그.
- 교사/보호자: V1 탭 그대로(요약 필드 유지). Phase 4에서 교사 리포트에 모듈별 성과·문항별 약점(제품 오너 확정: 교사는 전체·모듈·문항 단위 열람).

## 6. Phase 계획 (이 코드베이스 기준)

- **Phase 1 — 4모듈 shell + 서버 타이머 + 모듈 잠금 + 답안 저장** (이번 세션): §3의 `format`/`module_key`/`current_module`/`mock_exam_attempt_modules`, §4의 start/settle/submit_module/state + save_answer·toggle_flag·attempt_detail 재정의 + SPR 정규화; 조립 `format:'mst'`(모듈별 27/27/22/22, V1 가중치·중복 회피 재사용); MST 응시 클라이언트; 관리자 형식 선택. 완료 기준: rw_m1→rw_m2→휴식→math_m1→math_m2 완주, 만료 자동 제출·잠금, 재접속 복구, 중복 제출 no-op, 이전 모듈 쓰기 거부, 세트 내 문항 중복 0.
- **Phase 2 — 메타데이터 + 조립 강화**: M1/M2 배정 플래그(초기 규칙: easy·medium→M1/lower, medium·hard→higher), snapshot, 부족분 시 조립 실패 처리, 청사진 검증 RPC(`validate_mst_set`).
- **Phase 3 — 라우팅**: 정책 테이블, M2 higher/lower 변형(세트 내 `route`), 경로 비노출 감사 테스트.
- **Phase 4 — 점수·진단**: 난이도 분해, 예상 범위 모델(면책 유지 — 제품 오너 결정), 스킬 진단, 교사 문항별 약점 뷰.
- **Phase 5 — 캘리브레이션**: 응답 축적 후 모델 버전 재계산, 과거 attempt 점수 불변.

## 7. 테스트 계획 (완료 기준 6항)

1. 완주: `e2e/mock-exam-mst-flow.spec.ts`(관리자 MST 세트 조립·공개 → psql 배정 → 학생 5모듈 완주).
2. M2 세트 차이: Phase 3 통합 테스트(두 attempt M1 성과 상이 → `set_items.route` 다른 문항 노출).
3. 만료/복구/중복 제출/재진입: 통합 테스트(psql `set role authenticated`) — `ends_at` 과거로 이동 후 state 호출 시 자동 잠금, 새로고침 복구, `submit_module` 2회 no-op, 잠긴 모듈 `save_answer` 예외.
4. 중복 없음: 조립 통합 테스트에서 `(exam_set_id, problem_id)` 카운트 = distinct.
5. 문항 수·시간·영역 분포: 조립 결과 모듈별 count·`module_time_limits`·영역 비율 assert.
6. 점수·리포트·UI: Phase 4 E2E + Preview UAT.

## 8. Phase 1 구현 결과 (2026-09-28)

구현 파일: `supabase/migrations/20261901000000_mock_exam_mst_phase1.sql`(모듈 모델·RPC·SPR 정규화), `20261901000001_mock_exam_mst_readiness.sql`(출시 조건 게이트), `lib/mock-exam/mst.ts`·`mst-actions.ts`, `app/student/mock-exam/[attemptId]/MockExamMstTakeClient.tsx`(+page 분기), `app/admin/mock-exam-actions.ts`(MST 조립·readiness·공개 게이트), `app/admin/mock-exam/MockExamSetsPanel.tsx`(형식 선택·readiness 표시). 테스트: `lib/mock-exam/mst.test.ts`, `MockExamMstTakeClient.test.tsx`, `lib/mock-exam/mock-exam-mst-flow.integration.test.ts`, `app/admin/mock-exam-actions.integration.test.ts`(MST 2건 추가), `e2e/mock-exam-mst-flow.spec.ts`.

### 8.1 출시 조건 — 문항 부족 시 학생이 Module 2에서 막히지 않게 (제품 오너 2026-09-28)
- 세트 조립 직후 `mock_exam_validate_mst_set()`이 모듈·경로(Phase 3 higher/lower 포함, 세트에 존재하는 경로 변형마다)별 정원과 중복을 검증해 `mock_exam_sets.readiness_status`(`ready`/`incomplete`)와 `readiness_report`(모듈별 found/needed + 조립이 못 채운 영역·난이도·형식 셀)를 기록. 관리자 화면에 배지·상세 표시, 공개 버튼 비활성.
- DB 트리거: mst 세트는 `ready`가 아니면 `published` 전환 거부(`mock_exam_sets_publish_gate`), attempt 배정(insert/exam_set_id 변경) 거부(`mock_exam_attempts_assign_gate`). 관리자 service_role 경로도 동일하게 막힘.
- `mock_exam_start_mst()`가 Module 1 시작 직전에 같은 검증을 다시 수행 — 배정 후 세트가 훼손돼도 시작 자체가 관리자 오류로 거부되고 attempt는 `assigned`로 남는다.
- 응시 중 fallback 없음: 응시 RPC는 세트에 고정된 문항만 내려주며 어떤 경로에서도 다른 난이도·중복 문항을 채워 넣지 않는다.
- 한계(정직하게): 현재 조립 목표 셀은 영역×난이도(×형식)이며 **skill 단위 정원은 V1 조립 알고리즘에 없다** — 보고서에는 영역·난이도·형식 부족만 나온다. skill 균형·정원은 Phase 2(조립 강화)에서 추가한다.

### 8.1.1 검증 환경 (2026-09-28)
- 공유 로컬 Supabase 컨테이너(`ALTON`)는 다른 세션들이 `db reset`을 반복해 검증 중 스키마가 되돌아갔다. 최종 검증은 이 워크트리 전용 격리 스택(`config.toml`의 `project_id`/포트를 임시로 545xx로 바꿔 `supabase start`, 커밋 안 함)에서 수행: 모의고사 관련 Vitest 8파일 76건 통과, Playwright `e2e/mock-exam-mst-flow.spec.ts` 3건 통과, `tsc`/`eslint` 클린.
- 통합·E2E 테스트는 `SUPABASE_TEST_DB_URL` / `SUPABASE_TEST_API_URL` 환경변수로 대상 DB를 바꿀 수 있게 했다(기본값은 기존 54422/54421). 조립 통합 테스트의 `beforeAll`은 문항 100여 개를 psql로 심어 기본 hook timeout(10s)을 넘길 수 있어 `--hookTimeout=180000`으로 실행했다.
- 전체 Vitest는 공유 컨테이너 reset 영향으로 무관한 통합 스위트(세션 필기·커리큘럼 오버레이·정산·온보딩 등)가 대량 실패해 판정에서 제외했다(CURRENT.md의 "전체 통합 테스트 green 복구(로컬 DB 격리)" 기존 항목과 동일 원인).
- 관찰(기존 V1, 미수정): 관리자 세트 목록의 R&W/Math 문항 수는 `mock_exam_set_items` 전체를 한 번에 읽어 세는데 PostgREST 기본 1,000행 상한에 걸리면 최신 세트가 0으로 표시된다(테스트 데이터가 누적된 환경에서 재현). 별도 티켓 권장.

### 8.2 마이그레이션 영향 (non-prod 적용 전 보고)
- 변경 테이블: `mock_exam_sets`(+`format`, `module_time_limits`, `module_item_counts`, `readiness_status`, `readiness_report`, `readiness_checked_at`), `mock_exam_set_items`(+`module_key`, `route`, 인덱스), `mock_exam_attempts`(+`current_module`, `rw_m2_route`, `math_m2_route`), 신규 `mock_exam_attempt_modules`. enum 2개 신규. 함수: `_answer_auto_grade` 재정의(숙제 공유 — 기존 통과 사례 유지, 분수↔소수·쉼표·앞자리 0 동치 추가), `mock_exam_save_answer`/`mock_exam_toggle_flag`/`mock_exam_submit`/`mock_exam_start_mst` 재정의, `mock_exam_attempt_detail`은 기존 본문을 `_mock_exam_attempt_detail_v1`로 rename 후 래퍼(`format`/`currentModule` 추가, MST 진행 중 학생·보호자 문항 필터). 트리거 2개 신규.
- 기존 시험 데이터 영향: 모든 신규 컬럼은 nullable 또는 기본값(`format='fixed'`, `readiness_status='not_applicable'`)이라 기존 고정형 세트·응시·답안은 값·동작 변화 없음. 트리거는 `format='mst'`일 때만 작동. `_answer_auto_grade`는 저장 시점에만 호출되므로 이미 저장된 `correct` 값은 재계산되지 않는다(과거 채점 불변). `mock_exam_attempt_detail`의 기존 JSON 필드는 전부 유지되고 두 필드가 추가될 뿐이다(보드·컨설턴트·보호자 화면 호환).
- 되돌리기: 두 마이그레이션 모두 additive라 역순 DOWN이 단순하다 — (1) 트리거 2개·`mock_exam_validate_mst_set`·게이트 함수 drop, `mock_exam_start_mst` 이전 본문(20261901000000)으로 복원, readiness 컬럼 3개+`module_item_counts` drop; (2) `mock_exam_attempt_detail` drop 후 `_mock_exam_attempt_detail_v1`를 원래 이름으로 rename, `mock_exam_save_answer`/`toggle_flag`/`submit`/`_answer_auto_grade`를 20261429/20261432 본문으로 재생성, `mock_exam_attempt_modules` drop, 컬럼·enum drop. mst 세트·응시가 이미 생성된 상태라면 그 데이터는 되돌리기 전에 보관(archive)한다. 적용 순서: 로컬(완료) → 원격 dev(`db push --linked`, 제품 오너 승인 후) → Preview UAT.

## 9. 확정된 기본값 (2026-09-28 제품 오너)

1. 계산기: Digital SAT와 동일 — R&W 없음, Math 두 모듈에서 내장 Desmos(`MockExamMathTools` 재사용).
2. 교사 열람: 완료된 리포트 전체·모듈·문항 단위 약점까지.
3. SPR 채점: 공백·쉼표·분수↔소수·앞자리 0 정규화, 수학적 동치는 정답, 문항이 명시하지 않는 한 범위 채점 없음.

### 9.1 skill 균형 하드 게이트 OFF (제품 오너 2026-09-29)

- skill 쏠림·영역별 skill 종류 부족은 **출시·배정 차단 사유가 아니다.** `mock_exam_validate_mst_set`(마이그레이션 `20261905000000_mock_exam_skill_gate_off.sql`)은 쏠림을 `skillWarnings`로만 반환하고 `ready`에 반영하지 않는다. 관리자 패널은 이를 "skill 분포 경고(출시에는 영향 없음)"로 표시한다.
- 조립기는 skill을 고르게 뽑는 것을 소프트 선호로만 유지한다(정원을 비우거나 실패시키지 않음). 다른 게이트(모듈 정원·중복·유사문항 반복·스냅샷·M1 배정 가능=easy/medium만)는 그대로다.
- 다시 켜기: 세트 `assembly_rules`에 `skillHardGate: true`를 넣으면 `skillMaxSharePct`(기본 50) 초과가 다시 `skillViolations`+`ready=false`가 된다. 신규 세트 기본 규칙(`MST_ASSEMBLY_RULES`)에 넣으면 이후 세트에 적용된다.
- 롤백: 20261901000002의 `mock_exam_validate_mst_set` 본문을 새 번호 마이그레이션으로 재적용.

