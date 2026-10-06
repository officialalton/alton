# Admin "Free Accounts" 탭 + SAT 점수 열람 — 조사·설계

- 작성: 2026-10-06 (조사·설계 전용. 코드·DB·마이그레이션 변경 없음)
- 경로: `~/Developer/ALTON-worktrees/admin-free-accounts` / 브랜치 `feat/admin-free-accounts`
- 기준 커밋: `94acf119` (로컬 `preview/m4-integration-verification`; origin보다 23커밋 앞섬 — worktree 생성 후 로컬 통합 브랜치를 merge해 동일)
- UI 문자열은 전부 영어(스펙). 설명은 한국어. SQL은 텍스트 제안이며 어느 DB에도 적용하지 않았다.

---

## 0. 한 장 요약

1. **재사용 가능한 것이 많다.** 계정 상태 전이(`transition_account_status` + `account_status_events`), 학생 열람 권한 판정(`assertCanViewStudent`·`record_staff_student_view`), 응시 요약/상세 RPC(`mock_exam_attempt_summaries`, `mock_exam_attempt_detail`), 결과 화면(`MockExamResultView readOnly`), 점수 추정(`estimateScore`), 무료 회원 상담 상태 3테이블(`student_consult_interests`/`guardian_link_invites`/`consultations`), 전환 RPC(`convert_free_member_to_tutoring`)가 이미 있다.
2. **저장돼 있지 않은 것(추정 금지, 신규 추적 필요)**: 마지막 접속(`last_active`), 전환 시각, 테스트 계정 표식, 오답노트 "복습", 단어 "학습(플래시카드 등)", 자료 열람 횟수/시간, AP 모의고사(시험 트랙 자체가 없음), 재응시(고유 인덱스로 불가). 상세는 §3.
3. **점수는 "범위(low–high)"다.** `ScoreEstimate`는 점수가 아니라 `{low, high}` 범위이고 MST(4모듈) 응시에만 존재한다(고정형 `fixed` 세트는 정답 수만). 집계 규칙(최고/평균/최근/추이)은 범위에 맞게 정의했다(§5).
4. **점수 집계는 순수 TS 모듈 1개(`lib/mock-exam/score-aggregate.ts`)로 통일**하고, 기존 `computeMockStats`(학생·학부모·컨설턴트·관리자 Stats 탭)와 관리자 학생 상세(StudentDetailPanel)가 모두 이를 쓰게 한다. 원자료는 SQL RPC 1개(`admin_student_mock_attempt_facts`)가 `mock_exam_attempt_detail`과 같은 헬퍼(`_mock_exam_item_in_route`, 조정 채점)로 만든다.
5. **권한은 서버+DB 이중.** 모든 신규 RPC는 `SECURITY DEFINER` + 내부 `_free_accounts_staff()` 검사(관리자, supervisor는 `학생관리` capability) 후 **사용자 세션 클라이언트**로 호출. 컨설턴트는 탭 접근 없음(기존 `free_member_learning_summary`의 grant+담당 조건 유지).
6. **마이그레이션 `20262100000020`~`27`**(additive 전용). 목록/상세/통계 쿼리는 분리, 목록은 응시 이력을 읽지 않는다(집계 카운트만).

---

## 1. 재사용 인벤토리 (file:function)

### 1.1 관리자 탭·계정

| 용도 | 위치 | 비고 |
|---|---|---|
| 기존 무료 회원 탭 | `app/admin/FreeMembersTab.tsx` (default export), `app/admin/free-members-actions.ts: loadFreeMembersOverviewAction` | 한국어 UI, 200건 limit, **전 회원의 `mock_exam_attempts` 행을 통째로 읽어 카운트**(스펙 위반 — 교체 대상). 서브탭 `회원 목록/상담 관심/보호자 연결 수동 검토/초대 이벤트`와 `MergeAccountsPanel` 연결은 운영 기능이라 보존(§10 D7). |
| 탭 등록 | `app/admin/admin-tabs.ts: ADMIN_NAV_TAB_IDS("free-members")`, `resolveAdminTab`, `app/admin/AdminShell.tsx`(NAV_ITEMS `{id:"free-members",label:"Free Members"}`, OPERATIONS_IDS, 렌더 `activeTab === "free-members"`) | 라벨만 영어 "Free Members" → 스펙의 "Free Accounts"로. id 변경 시 `LEGACY_INQUIRY_TAB_ID`처럼 옛 id alias 유지. |
| 서브탭 UI | `app/components/UnderlineSubTabs` | 그대로 사용. |
| 학생 상세 패널 구조 | `app/admin/StudentDetailPanel.tsx`(상태 select → `setStudentStatus`, 프로필 정보 카드, `StaffStudentViews`(Overview/Board/Stats, 읽기 전용), 학부모, `SubjectEnrollmentPanel`, 수업권) | Free Accounts 상세는 이 카드 구조(`border-[1.5px] rounded-xl px-5 py-4` 섹션 카드)를 그대로 따른다. |
| 학생 목록 데이터 | `app/admin/users-data.ts: loadStudents`(전 학생, `memberType` 포함), `UsersTab.tsx`(`memberFilter` all/tutoring/free, `free-member-badge`) | 전환 후 학생은 일반 학생관리(Users)에 이미 `tutoring`으로 나타남 → 추가 작업 없음. |
| 계정 상태 전이 | `app/admin/users-actions.ts: setStudentStatus` → `transitionAccountStatus` → RPC `transition_account_status(p_profile_id,p_new_status,p_reason)` (`20260831011000`) | 허용 전이: pending→active, active↔suspended, active/suspended→closure_pending, closure_pending→closed. 감사: `account_status_events`(INSERT-only: profile_id, previous_status, new_status, changed_by, reason, created_at). **TS 시그니처가 4값만 받음 → closure_pending/closed 허용하도록 타입 확장 필요**(RPC는 이미 허용). |
| 이메일 조회 | `app/admin/users-data.ts: loadEmailById`(auth admin API) | 목록은 RPC가 `auth.users`를 직접 조인(관리자 DEFINER 내부)하므로 불필요. 상세는 RPC 응답. |
| 관리자 권한 | `lib/admin-auth.ts: requireAdmin / requireAdminOrCapability / requireMasterAdmin`, `lib/admin-capabilities.ts`(`학생관리`), DB `is_admin()`, `current_user_has_capability()` | supervisor만 capability 실검사(`admin_tier` master/full은 무제한). |
| 학생 열람 감사 | `lib/staff-student-view.ts: assertCanViewStudent / studentViewPolicy`, DB `record_staff_student_view`(10분 디듀프, view_kind CHECK `overview/board/stats`), 테이블 `staff_student_view_log` | `free_profile` view_kind 추가 필요(§6 M26). |
| 통계 탭(재사용) | `app/components/StaffStudentViews.tsx` → `loadStaffViewStatsAction` → `loadStudentStats`(`student_stats_aggregate`, tier=`admin`) → `app/student/StatsTab.tsx: StatsPanel` | 무료 회원 상세의 "Learning stats" 서브섹션으로 그대로 끼울 수 있으나, 점수 집계는 아래 공유 모듈로 교체(§5). |

### 1.2 모의고사·점수

| 용도 | 위치 |
|---|---|
| 점수 추정(변경 금지) | `lib/mock-exam/score-estimate.ts: estimateSectionRange / estimateScore / SCORE_MODEL_VERSION="v1-adaptive" / SCORE_DISCLAIMER(_EN)` — 범위 `{low,high}`, 10점 반올림, 섹션 200–800, 총점 = rw+math 각각의 low/high 합. lower 경로 상한 650. 입력: 섹션별 정답/문항 수 + `rw_m2_route`/`math_m2_route`. |
| 응시 읽기 계층 | `lib/mock-exam/attempt-data.ts: loadMockExamAttemptDetail`(RPC `mock_exam_attempt_detail`; MST면 `computeScoreEstimate`+`loadMstSectionTime` 추가), `loadTeacherMockExamAttemptsForStudent`/`loadSummaries`(RPC `mock_exam_attempt_summaries(p_student_id)`) |
| 리포트 집계 | `lib/mock-exam/report.ts: computeMockExamReport`(섹션·도메인·스킬·소요시간) |
| 결과 화면 | `app/student/mock-exam/[attemptId]/MockExamResultView.tsx`(`readOnly` prop, 문항별 답·해설 포함), 학부모 선례 `app/parent/mock-exam/[studentId]/[attemptId]/page.tsx`, 교사 선례 `app/teacher/mock-exam-tab-actions.ts: getMockExamAttemptDetailForTeacherAction` |
| 권한 | DB `_mock_exam_can_view(student)` = service ∨ 본인 ∨ `is_admin()` ∨ 담당교사 ∨ 보호자 ∨ 담당 컨설턴트. 관리자는 채점 확정 전에도 정오·정답 비마스킹. |
| 누적 약점 | RPC `mock_exam_weakness_summary(p_student_id)`(`20262100000001`; 조정 채점 반영 `mock_exam_answer_adjustments`) — 도메인/스킬별. 점수 아님. |
| 통계 집계 | RPC `student_stats_aggregate`(`20261960000000`, **service_role 전용**) — 최근 graded 12건을 `mock_exam_attempt_detail`로 펼쳐 `v_mock`을 만들고 `lib/student-stats/metrics.ts: computeMockStats`가 `estimateScore`로 점수 포인트를 만든다(family tier는 섹션 점수 숨김). |
| 컨설턴트 요약 | RPC `free_member_learning_summary`(`20262100000005`; 활성 grant + 담당 상담 컨설턴트, 호출마다 `learning_summary_access_audit`) — 관리자 경로는 이 RPC를 쓰지 않는다. |

### 1.3 상담·전환

| 용도 | 위치 |
|---|---|
| 관심 등록 | 테이블 `student_consult_interests`(status: registered/invite_sent/parent_linked/consultation_requested/booked/cancelled/expired; 학생당 열린 행 1개 부분 유니크), RPC `register_consult_interest / cancel_consult_interest` |
| 보호자 초대 | `guardian_link_invites`(status: pending/accepted/expired/revoked/superseded/manual_review; `consultation_id`, `scheduling_link_id`, `accepted_by`), `guardian_link_invite_events`, RPC `create_/resend_/revoke_/claim_/accept_guardian_link_invite` |
| 상담 | `consultations`(status enum `v3_consultation_status`: requested/scheduled/completed/trial_planned/trial_completed/proposed/contracted/converted/closed; `source='free_member'`, `child_id`, `starts_at`, `completed_at`, `cancelled_at`, `no_show_at`, `admissions_consultant_id`), `consultation_status_events`, `consultation_scheduling_links`. 수락 시 `accept_guardian_link_invite`가 `requested/scheduled` 기존 상담을 **재사용**하고 없을 때만 INSERT(중복 상담 방지의 기존 근거). 칸반 `app/admin/consultation-kanban-data.ts`, 상담 관리 `app/admin/ConsultationTab.tsx`. |
| 예약 반영 | 트리거 `consult_interest_mark_booked`(상담 status→scheduled 시 interest→booked) |
| 전환 | RPC `convert_free_member_to_tutoring(p_student_id, p_consultation_id)`(service_role 전용, `students.id` 불변, 멱등) — **전환 시각을 기록하지 않는다(§3 갭)**. 호출: `finalize_trial_onboarding_students` 기존 자녀 분기. |
| 회원 유형 | `students.member_type('free'|'tutoring')`, `signup_source`, `students_member_type_idx`, `is_free_member()`, `has_tutoring_access()`, `student_feature_access()` |

### 1.4 학습 사용 기록

| 용도 | 테이블/컬럼 |
|---|---|
| 오답노트(문제 기록) 저장 | `mock_exam_answers.saved_to_practice`(`20261435000000`, RPC `mock_exam_toggle_saved_to_practice`), 로더 `app/student/problem-history-data.ts: loadSavedMockExamPractice` — 저장 **시각** 컬럼 없음(`updated_at`은 답안 갱신과 공유) |
| 단어 | `vocab_words`(student_id, created_at), `vocab_review_items`(added_at, cleared_at), `vocab_quizzes`(owner_id, status, score, total, submitted_at, created_at), `vocab_word_folders`, `vocab_session_links`(수업용) |
| 자료 열람 | `material_reading_positions`(user_id, curriculum_doc_id, section_id, updated_at — 문서당 1행, 마지막 읽던 섹션만, HTML 교재만) |
| 필기 | `problem_note_strokes`(context=mock_exam 등, updated_at), `mock_exam_annotations` |
| 분석 이벤트 | `lib/analytics/events.ts`(화이트리스트 속성), `lib/analytics/track.ts` — **외부 분석 도구로만 전송(프로덕션 한정), DB에 없음** → 관리자 화면 지표의 원천으로 쓸 수 없다. |

---

## 2. 현재 스펙과의 구조적 불일치 (먼저 알아야 할 사실)

1. **AP 모의고사가 없다.** `mock_exam_sets`에는 시험 트랙/AP 과목 컬럼이 없고 섹션이 `rw`/`math`뿐이다. `problems.exam_system('sat_rw','sat_math','ap')`·`problems.ap_subject`는 문제은행 분류일 뿐 응시 단위가 아니다. → 스펙의 "AP 과목별 통계·필터"는 **현재 보여줄 데이터가 0건**. 설계는 `exam_track`/`ap_subject`를 세트에 추가하는 additive 컬럼으로 확장 가능하게 하되 UI 필터는 데이터가 있을 때만 활성(§5.5, D4).
2. **재응시가 불가능하다.** `mock_exam_attempts_one_per_student_per_exam (student_id, exam_set_group_id)` 유니크 + `mock_exam_open_start` 멱등. 응시 이력의 `retake` 플래그는 구조상 항상 false. 재응시는 "다른 세트"일 뿐 재응시가 아니다. 설계는 `attempt_seq = row_number() over (student, set_group by created_at)`를 응시 이력에 싣고 `>1`이면 "Retake"를 표시해 향후 정책 변경(D5)에도 대응.
3. **점수는 MST만.** `format='fixed'` 응시는 정답 수만(추정 없음, `estimateScore`는 `format==='mst'`에서만 호출됨 — `computeMockStats`, `attempt-data.computeScoreEstimate`). 고정형은 "Score estimate not available (fixed-format test)"로 표시하고 점수 통계에서 제외하며 제외 건수를 표시.
4. **부분 응시 점수는 현재 산출되지 않는다.** 응시는 `in_progress`로 남고 `graded`는 모든 모듈 종료 후. 모듈 단위(`mock_exam_attempt_modules.locked`)로 "R&W 완료, Math 미완료"는 존재 가능하지만 추정 점수는 `graded` 응시에만 쓰이고 있다. 스펙의 "partial (if supported)"는 **v1 미지원 권고**(D3): 이력에서 진행 상태 배지만 표시, 점수 통계는 `graded`만. 집계 모듈에는 `partial` 필드를 예약.

---

## 3. 데이터 가용성 매트릭스

| 항목 | 현재 저장 | 출처 | 부족분 / 신규 추적 |
|---|---|---|---|
| 이름·이메일·ID·학년 | 있음 | `profiles.name`, `auth.users.email`, `students.grade/school_name` | 없음. 이메일은 RPC 내부(DEFINER)에서 `auth.users` 조인 |
| 가입일 | 있음 | `students.joined_at` | 없음 |
| 계정 상태·변경 이력 | 있음 | `students.status`, `account_status_events` | 없음 |
| 현재 권한(entitlement) | 파생 | `student_feature_access()`, `has_tutoring_access()`, `entitlement_grants` | 무료 회원은 feature keys 표시로 충분 |
| 보호자 연결 | 있음 | `guardian_link_invites`, `household_members(role=guardian)` | 없음 |
| 상담 단계 | 있음(분산) | interests + invites + consultations | 단일 단계 파생 로직 필요(§7, 뷰/함수) |
| 전환 시각 | **없음** | `convert_free_member_to_tutoring`가 시각 미기록 | `students.converted_at` 추가 + 함수 갱신(M21). 기존 전환 건 백필: `consultations.updated_at`(해당 상담의 최종 상태 변경)로 근사 불가 → 파일럿 단계라 null 허용 |
| **last_active** | **없음** | `auth.users.last_sign_in_at`은 로그인 시점뿐(토큰 refresh로 계속 쓰는 세션은 갱신 안 됨); 학습 이벤트 시각은 테이블별로 흩어짐 | **§4 권고안** |
| 완료한 시험 수 | 있음 | `mock_exam_attempts.status='graded'` 카운트 | 목록은 집계 카운트만(이력 미로드) |
| 응시 시작/완료 | 있음 | `started_at`, `submitted_at`, `graded_at` | 없음 |
| 섹션별 정답/문항 수 | 있음 | `mock_exam_answers`+`set_items`+조정, `_mock_exam_item_in_route` | 새 RPC가 조립(저장 아님) |
| SAT 총점/R&W/Math | 파생 범위 | `estimateScore` | 저장하지 않음(§5). 분석 집계가 필요하면 팩트 테이블(§8.4) |
| AP 과목/결과 | **없음** | — | `mock_exam_sets.exam_track/ap_subject` 컬럼(M27) + AP 점수 모델 별도 결정(D4) |
| 재응시 | 구조상 불가 | 유니크 인덱스 | `attempt_seq` 파생만(D5) |
| 오답노트 저장 수 | 있음 | `saved_to_practice=true` 카운트 | 저장 **시각**은 `updated_at` 근사(답안 수정과 공유 → "저장 시각"으로 표기 금지, 카운트만) |
| 오답노트 사용/복습 | **복습 없음** | 열람·복습·재풀이 이벤트 미저장(무료 회원의 `session_problem_work`는 수업 전용) | 복습 이벤트 테이블 필요 → **"Not tracked"로 표시** 후 신규 추적(`student_learning_events`, §4.3) |
| 단어 저장 | 있음 | `vocab_words`(count, 최근 created_at) | 없음 |
| 단어 학습 | 부분 | `vocab_quizzes`(완료 수·점수·`submitted_at`), `vocab_review_items`(open/cleared) | 플래시카드/열람 등 비퀴즈 학습은 **없음** |
| 자료 사용 | 부분 | `material_reading_positions`(열어본 문서 수, 문서별 마지막 시각) | 열람 횟수·시간·재방문, 무료 자료 유형별 사용은 **없음**(`document_access_events`는 계약/교사서류 전용) → 이벤트 추적 필요 |
| 상담 연동 | 있음 | §1.3 | 없음 |
| 테스트 계정 표식 | **없음** | 이메일 패턴만(`${RUN}-…@example.com`, `uat-<RUN>-…@example.com`) | `students.is_test_account` (M20) |
| 분석 이벤트(DB) | **없음** | GA류 외부 전송만 | DB 권위 지표만 사용(§8) |

**원칙**: "저장 안 됨"인 항목은 값을 추정해 채우지 않는다. UI는 `Not tracked yet`(회색) 표시 + 신규 추적 후 해당 시점부터의 수치만 표시(`Tracking since <date>`).

---

## 4. last_active 및 사용 추적 제안

### 4.1 선택지와 비용

| 방안 | 내용 | 장점 | 비용/단점 |
|---|---|---|---|
| A. 파생(쓰기 없음) | `greatest(auth.users.last_sign_in_at, max(attempt.started/submitted/answers.updated_at), max(vocab_words.created_at), max(vocab_quizzes.submitted_at), max(material_reading_positions.updated_at), …)` | 쓰기 0, 즉시 사용 가능 | 읽기 열 개 테이블 조인 → 목록 정렬(`Last Active`)이 O(회원 수×테이블). 로그인만 하고 둘러본 활동은 누락 |
| B. **하트비트 컬럼(권고)** | `students.last_active_at timestamptz` + RPC `touch_student_activity()`: `update … where id=auth.uid() and (last_active_at is null or last_active_at < now()-interval '10 minutes')` | 정렬·필터가 단일 컬럼+인덱스, 정의 단순("학생 포털 페이지를 연 마지막 시각") | 학생 포털 진입마다 경량 RPC 1회(클라이언트에서 sessionStorage로 10분 1회로 제한) → 쓰기 ≤ 6회/시/활성 사용자. 이전 기간 소급 불가(최초 1회 파생 백필로 보완) |
| C. B + 일 단위 활동 테이블 | `student_activity_days(student_id, day date, primary key(student_id, day))` — 같은 RPC에서 `insert … on conflict do nothing` | **기간 필터 "Active in period"를 정확히** 계산(§8) | 행 ≤ 1/학생/일(저렴) |

**권고: C(= B + 일 단위 테이블).** 백필(1회): `last_active_at = A식 파생`, `student_activity_days`는 응시·단어·퀴즈·자료 날짜에서 distinct day 삽입. "active"의 정의는 §8.2에 문서화(로그인이 아니라 학생 포털 화면 진입 기준; 관리자·보호자 열람 제외).

호출 위치: 학생 포털 레이아웃 클라이언트 훅 1곳(`app/student/StudentShell.tsx`에 `useEffect` → 서버 액션 `touchActivityAction` → RPC). 무료 회원도 같은 포털을 쓰므로 한 곳으로 충분.

### 4.2 선택지 D: 로그인 시각만 쓰기
`auth.users.last_sign_in_at`만 노출하는 최소안은 거짓 "비활성"을 만든다(장기 세션). 비권고. 단 상세에 "Last sign-in"을 보조 표시로 붙이는 것은 가능(비교용).

### 4.3 신규 추적이 필요한 사용 지표 (D에 명시된 항목 중 미저장분)

최소 이벤트 테이블 1개로 해결: `student_learning_events (id, student_id, kind, ref_id uuid null, created_at)`, `kind ∈ {'mistake_review_opened','vocab_study_opened','material_opened'}`, 학생당 `kind`별 분 단위 디듀프(서버 RPC `log_learning_event(kind, ref_id)`에서 같은 학생·종류·ref 10분 내 중복 무시). **PII 없음**(ID·종류·시각만). 이 테이블이 생기기 전 기간은 "Not tracked"로 표시. 이 작업은 학생 화면 3곳(문제 기록 탭, 단어장 탭, 교재 뷰어)의 호출 추가가 필요하므로 **별도 단계(S6)로 분리하고 오너 승인 후 진행**(D1).

---

## 5. 공유 점수 집계 모듈 설계

### 5.1 위치와 책임

- 신규 `lib/mock-exam/score-aggregate.ts` — **순수 함수, DB·네트워크 없음.** `score-estimate.ts`는 그대로(추정 방법 불변, 면책 문구 `SCORE_DISCLAIMER_EN` 계속 사용).
- 입력은 "응시 팩트"(§5.2), 출력은 점수 포인트·통계. 소비처: ① `lib/student-stats/metrics.ts: computeMockStats`(기존 Stats 탭 — 기존 출력 shape 유지, 내부만 교체), ② 관리자 학생 상세(StudentDetailPanel)의 새 "Mock exam scores" 카드, ③ Free Accounts 상세 B/C, ④ `lib/mock-exam/attempt-data.ts: computeScoreEstimate`(단일 응시 경로도 같은 `estimateAttempt`를 호출하도록 정리).
- 숫자 일치 보장: 서로 다른 화면이 같은 함수·같은 팩트 RPC만 사용 → 일치 테스트(§12)로 고정.

### 5.2 팩트 타입 (RPC 출력 = 모듈 입력)

```ts
type ExamTrack = "sat" | "ap";
type SectionFacts = { total: number; correct: number | null; complete: boolean; route: "higher" | "lower" | null };
type AttemptFacts = {
  attemptId: string; examSetId: string; examSetGroupId: string; examName: string;
  track: ExamTrack; apSubject: string | null; difficultyTier: string;
  format: "fixed" | "mst";
  status: "assigned" | "in_progress" | "submitted" | "graded";
  startedAt: string | null; submittedAt: string | null; gradedAt: string | null;
  attemptSeq: number;                 // 같은 세트 계열 내 순번(현재 항상 1)
  scoreAdjusted: boolean;             // 문항 오류 판정 조정 반영 여부
  sections: { rw: SectionFacts; math: SectionFacts };
};
```

### 5.3 규칙 → 구현 매핑

| 스펙 규칙 | 구현 |
|---|---|
| completed + graded-final만 | `isScorable(f) = f.status==='graded' && f.gradedAt != null`. 아니면 점수 포인트 없음(이력에는 상태로만 표시) |
| SAT Total은 같은 응시의 R&W·Math 둘 다 완료일 때만 | `estimateScore(bySection, routes)`(이미 둘 다 non-null일 때만 반환)를 한 응시 안에서만 호출. 총점 = 그 응시의 rw+math 범위 합 |
| 다른 응시의 섹션 점수 합성 금지 | 총점 계산 함수는 **단일 `AttemptFacts`만** 입력으로 받는다(타입으로 강제). 통계 함수는 포인트를 응시별로 보존, 섹션 평균끼리 더해 총점을 만들지 않음("SAT Total average"는 **총점 포인트들의 평균**) |
| 부분 응시 | v1 미지원(D3). `ScorePoint.partial: boolean` 필드를 예약(`false` 고정), 진행 중 응시는 점수 없음 |
| 재응시는 별개 레코드 | 응시 단위 포인트. `attemptSeq>1`이면 이력에 "Retake" 배지. 평균·최고에는 각각 1표본 |
| 기록 없음·미완료는 0이 아님 | 반환 `null`/`sampleSize:0`. UI는 `—` 또는 `No scored attempts yet`. 합계·평균에 0을 넣지 않음 |
| 표본 수 표시 | 모든 `best/average/latest` 결과에 `sampleSize`(n) 포함, UI "avg of n attempts" |
| 추정 방식·고지 유지 | `estimateScore` 불변. 모든 점수 영역에 `SCORE_DISCLAIMER_EN`("…not equivalent to an official SAT / College Board score. Score ranges are internal estimates.") 표시 |
| AP/과목 간 평균 금지 | 통계는 `group key = track==='sat' ? 'sat' : 'ap:'+apSubject`별로 따로 계산, 합산 API 없음 |

### 5.4 점수가 "범위"일 때의 통계 정의 (D9 확인 필요)

- 포인트 `range = {low, high}`, 대표값 `mid = (low+high)/2`.
- **Latest**: `gradedAt` 최신 포인트의 범위. **Best**: `mid` 최대 포인트의 범위(동률 시 더 최근). **Average**: `{low: mean(low), high: mean(high)}`를 10점 단위 반올림(추정 규칙과 동일 단위). **Change by attempt date**: `gradedAt` 오름차순 시계열, 각 포인트 옆에 직전 포인트 대비 `mid` 차이(첫 포인트는 `—`). 화면은 범위 표기 `1,180–1,240`, 변화량은 `+25` 식(중간값 기준임을 툴팁에 명시).
- 토글 3종(SAT Total / Reading & Writing / Math): 같은 포인트 배열에서 지표(`total|rw|math`)만 바꿔 요약. **SAT Total 보기는 총점+R&W+Math를 한 줄에 함께 표시**(스펙).
- 제외 건수 안내: `n fixed-format attempts have no score estimate` / `n attempts not yet graded`.

### 5.5 AP

`group key`별로 독립 요약. AP 응시가 없으면 AP 섹션/필터를 비활성+`No AP tests available yet`. **AP 결과 표현**(점수 1–5 환산 모델이 없음)은 현 시점 `raw accuracy %`만 표시, 환산 모델은 별도 결정(D4).

### 5.6 공개 API(안)

```ts
estimateAttempt(f: AttemptFacts): { rw: ScoreRange|null; math: ScoreRange|null; total: ScoreRange|null; reason: null|"not_graded"|"no_estimate_fixed"|"route_missing" }
buildScorePoints(facts: AttemptFacts[]): ScorePoint[]            // 응시 단위, gradedAt 오름차순
groupKey(f: AttemptFacts): string                                 // 'sat' | 'ap:<subject>'
summarize(points: ScorePoint[], metric: "total"|"rw"|"math"): { sampleSize: number; latest: ScoreRange|null; best: ScoreRange|null; average: ScoreRange|null; trend: {at: string; range: ScoreRange; deltaMid: number|null}[] }
accuracySummary(facts: AttemptFacts[]): { sampleSize: number; pct: number|null }   // fixed·AP용 정답률
```

`computeMockStats`는 `RawStatsAggregate["mock"]`(기존 RPC 출력)를 `AttemptFacts`로 어댑트해 `buildScorePoints`를 호출하도록 바꾼다 — 출력 `MockStats`(`points[]`, `strengths`)는 변경 없음.

---

## 6. 마이그레이션 계획 (`20262100000020` 이후, additive, 한 번 적용되면 수정 금지 — 정정은 새 번호)

| 번호 | 파일(안) | 내용 |
|---|---|---|
| `20262100000020` | `free_accounts_foundation.sql` | `students.is_test_account boolean not null default false`, `students.test_account_source text`(`pattern`/`manual`), `students.last_active_at timestamptz`, `students.converted_at timestamptz`; 함수 `_email_is_test(text)`; **백필**(기존 행 `is_test_account` 갱신); BEFORE INSERT 트리거로 신규 학생 자동 표식; `_free_accounts_staff()`; `student_activity_days` 테이블+RLS(없음, RPC만); 인덱스(아래); RPC `touch_student_activity()` |
| `20262100000021` | `convert_free_member_records_time.sql` | `convert_free_member_to_tutoring` create or replace — 전환 시 `converted_at = now()`(멱등: null일 때만) |
| `20262100000022` | `student_mock_attempt_facts.sql` | RPC `admin_student_mock_attempt_facts(p_student_id)`(§7.2) — 일반 학생 상세와 Free Accounts 공용 |
| `20262100000023` | `admin_free_accounts_list.sql` | RPC `admin_free_accounts_list(...)`(§7.3) + 뷰 `v_free_account_consult_stage` 또는 함수 `_free_account_consult_stage(uuid)` |
| `20262100000024` | `admin_free_account_profile.sql` | RPC `admin_free_account_profile(p_student_id)`(§7.4), 응시 이력 RPC `admin_free_account_attempts(p_student_id)`, 사용 지표 RPC `admin_free_account_learning_usage(p_student_id)` |
| `20262100000025` | `admin_free_accounts_analytics.sql` | RPC `admin_free_accounts_analytics(...)`(§8) |
| `20262100000026` | `staff_view_free_profile.sql` | `staff_student_view_log` CHECK에 `free_profile` 추가, `record_staff_student_view` 갱신; `admin_set_test_account(p_student_id, p_flag, p_reason)` + 감사 테이블 `student_flag_events`(INSERT-only) |
| `20262100000027` | `mock_exam_sets_exam_track.sql` | `mock_exam_sets.exam_track text not null default 'sat' check in ('sat','ap')`, `ap_subject text` + CHECK(ap면 ap_subject 필수); 팩트 RPC가 이 컬럼을 읽도록 `create or replace`(22는 `'sat'` 상수로 먼저 출시해도 됨 — 순서상 27이 22를 대체) |
| `20262100000028` (S6, 오너 승인 후) | `student_learning_events.sql` | `student_learning_events` + `log_learning_event()` + 인덱스 |

DB 적용은 구현 세션이 비프로덕션(`worpsqwqgnspddnrtnvq`)에 `db push --linked`로 직접 수행(CLAUDE.md). `db reset` 금지(공유 로컬 DB 규칙).

### 6.1 인덱스 (additive)

```sql
create index if not exists students_free_list_idx on students (joined_at desc) where member_type = 'free';
create index if not exists students_converted_idx on students (converted_at desc) where converted_at is not null;
create index if not exists students_last_active_idx on students (last_active_at desc nulls last) where member_type = 'free';
create index if not exists students_test_account_idx on students (id) where is_test_account;
create index if not exists mock_exam_attempts_student_status_idx on mock_exam_attempts (student_id, status);
create index if not exists mock_exam_attempts_started_idx on mock_exam_attempts (started_at) where started_at is not null;
create index if not exists mock_exam_attempts_graded_idx on mock_exam_attempts (graded_at) where graded_at is not null;
create index if not exists student_activity_days_day_idx on student_activity_days (day);
-- 기존 재사용: students_member_type_idx, student_consult_interests_student_idx, guardian_link_invites_student_idx,
-- consultations(child_id), vocab_words(student_id, created_at), vocab_quizzes(owner_id, created_at)
create index if not exists consultations_free_member_child_idx on consultations (child_id, created_at desc) where source = 'free_member';
```

---

## 7. 제안 SQL (텍스트 전용)

### 7.1 공통 헬퍼

```sql
create or replace function public._free_accounts_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role = 'admin'
      and (p.admin_tier is distinct from 'supervisor' or coalesce(current_user_has_capability('학생관리'), false))
  );
$$;  -- revoke from public, anon; grant execute to authenticated

create or replace function public._email_is_test(p_email text) returns boolean
language sql immutable as $$
  select p_email is not null and (
       lower(split_part(p_email, '@', 2)) in ('example.com','example.org','example.net','example.test','test.local')
    or lower(split_part(p_email, '@', 2)) ~ '\.(test|invalid|localhost|example)$'
    or lower(split_part(p_email, '@', 1)) ~ '^(uat|it|e2e|qa|test)[-_.]'
  );
$$;
```

(UAT 시드 `scripts/uat-20260918-problembank-seed.ts`는 `uat-<RUN>-student@example.com`, 통합 테스트 픽스처는 `<RUN>-<label>@example.com` 형태 — 둘 다 첫 규칙에 걸린다.)

### 7.2 팩트 RPC(점수 원자료, 일반 학생·무료 회원 공용)

```sql
create or replace function public.admin_student_mock_attempt_facts(p_student_id uuid) returns table (
  attempt_id uuid, exam_set_id uuid, exam_set_group_id uuid, exam_name text,
  exam_track text, ap_subject text, difficulty_tier text, format text,
  status text, started_at timestamptz, submitted_at timestamptz, graded_at timestamptz,
  attempt_seq int, score_adjusted boolean,
  rw_total int, rw_correct int, rw_complete boolean, rw_route text,
  math_total int, math_correct int, math_complete boolean, math_route text
) language plpgsql stable security definer set search_path = public as $$
begin
  if not (_free_accounts_staff() or _mock_exam_can_view(p_student_id)) then raise exception 'not_allowed'; end if;
  -- 문항 집합 = mock_exam_attempt_detail 과 동일 규칙(_mock_exam_item_in_route), 정오 = coalesce(adjustment.adjusted_correct, answer.correct)
  -- complete = (format='fixed' and status='graded') or (format='mst' and 해당 섹션 두 모듈 locked)
  return query ... ;  -- 구현 시 mock_exam_weakness_summary(20262100000001)의 조정 조인 패턴 재사용
end $$;
```

주의: 지표는 **응시 1명 분만** 반환(학생당 응시 수 ≤ 수십). 전 학생 대량 집계에 쓰지 않는다.

### 7.3 목록 RPC

```sql
create or replace function public.admin_free_accounts_list(
  p_search text default null,                 -- 이름/이메일 부분일치(소문자)
  p_joined_from timestamptz default null, p_joined_to timestamptz default null,
  p_active_from timestamptz default null, p_active_to timestamptz default null,
  p_has_attempts boolean default null,        -- true: 완료 응시 ≥1 / false: 0
  p_exam_track text default null,             -- 'sat'|'ap' (응시한 시험 트랙)
  p_ap_subject text default null,
  p_consult_stage text default null,          -- §7.6 stage key
  p_account_status text default null,         -- active|pending|suspended|closure_pending|closed
  p_scope text default 'free',                -- 'free'(기본: member_type=free) | 'converted'(converted_at not null) | 'all'
  p_include_test boolean default false,
  p_sort text default 'joined_at', p_dir text default 'desc',   -- joined_at|last_active_at|completed_tests|name|email|consult_stage
  p_limit int default 25, p_offset int default 0
) returns table (
  student_id uuid, name text, email text, joined_at timestamptz, last_active_at timestamptz,
  completed_tests int, in_progress_tests int,
  consult_stage text, consult_flags text[],   -- 예: {'invite_needs_review'}
  account_status text, member_type text, converted_at timestamptz, is_test_account boolean,
  total_count bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not _free_accounts_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 100);
  -- 1) students 필터(scope/status/joined/test) → 2) lateral count(응시 graded / in_progress; 이력 행은 반환하지 않음)
  -- 3) consult_stage 파생(§7.6) → 4) 검색(profiles.name ilike, auth.users.email ilike) → 5) 정렬(화이트리스트 case) + count(*) over()
  -- 정렬 키는 case 화이트리스트(동적 SQL 금지).
end $$;
```

- 성능: 필터는 `students_free_list_idx`로 먼저 줄어든 뒤 `auth.users`를 PK로 조인(전체 사용자 스캔 아님). 검색은 필터 후 행에만 적용. 쿼리 1회 + `total_count`는 window 함수(추가 요청 0). 클라이언트는 검색 디바운스 300ms, 페이지 크기 25.
- 목록은 `mock_exam_attempts` **행 자체를 반환/전송하지 않는다**(카운트만).

### 7.4 상세 RPC (3개 분리 호출 — 탭 전환 시 지연 로드)

```sql
admin_free_account_profile(p_student_id uuid) returns jsonb   -- A + E: basics, status, entitlements(feature keys, has_tutoring_access), guardian link, consult stage, linked consultations, conversion
admin_free_account_attempts(p_student_id uuid) returns table (...)  -- C: 위 7.2 팩트 + 시험명/유형 (점수 계산은 TS 모듈)
admin_free_account_learning_usage(p_student_id uuid) returns jsonb  -- D: §9.4
```

프로필 jsonb 키(안): `studentId,name,email,grade,schoolName,joinedAt,lastActiveAt,lastSignInAt,accountStatus,memberType,signupSource,isTestAccount,convertedAt,featureKeys[],hasTutoringAccess,guardians[{id,name,email,linkedAt}],invite{status,sentAt,acceptedAt,needsReview,reason},interest{status,entryPoint,createdAt},consultations[{id,status,startsAt,completedAt,cancelledAt,noShowAt,closedAt,consultantName,createdAt}],consultStage,statusHistory[{previous,new,changedBy,reason,at}]`. 이름 외 PII(전화번호 등)는 포함하지 않는다.

### 7.5 점수 계산 위치

점수/범위 계산은 SQL이 아니라 TS 모듈에서(§5). SQL은 정답/문항/경로 원자료만. (SQL에 `estimateScore` 앵커 표를 복제하면 두 구현이 어긋난다 — 금지.)

### 7.6 상담 단계 파생 (아래 §8 매핑 표의 구현)

```sql
create or replace function public._free_account_consult_stage(p_student_id uuid) returns table (stage text, flags text[])
-- 입력: students.member_type/converted_at, 최신 interest(열린 것 우선), 최신 invite(상태), 최신 consultations(source='free_member', child_id=student)
```

---

## 8. 상담 상태 매핑 (기존 상태 모델 → 스펙 단계)

계정 상태(`students.status`)와 상담 상태는 **별개 컬럼/필터**. 단계는 아래 우선순위(위가 우선)로 결정.

| 우선 | Stage key | UI 라벨 | 판정(기존 데이터) |
|---|---|---|---|
| 1 | `converted` | Converted to Tutoring | `students.member_type='tutoring'` ∧ `consultations(source='free_member', child_id=student)` 존재 (또는 `converted_at is not null`) |
| 2 | `completed` | Consultation Completed | 최신 free_member 상담 `status ∈ (completed, trial_planned, trial_completed, proposed, contracted, converted)` ∧ 아직 `member_type='free'` |
| 3 | `booked` | Consultation Booked | 최신 상담 `status='scheduled'`(또는 `starts_at is not null` ∧ status requested/scheduled) 또는 interest `booked` |
| 4 | `parent_linked` | Parent Linked | invite `accepted`(또는 interest `parent_linked`/`consultation_requested`) ∧ 상담 아직 미예약(`requested`) — 수락 시 상담이 자동 생성/재사용되므로 "보호자 연결됨 + 예약 대기" |
| 5 | `invitation_pending` | Parent Invitation Pending | interest `invite_sent` 또는 invite `pending`; invite `manual_review`이면 flag `invite_needs_review` |
| 6 | `requested` | Consultation Requested | interest `registered`(관심 등록 = 학생의 상담 요청, 보호자 초대 전) |
| 7 | `booking_cancelled` | Consultation Cancelled / Unbooked | 최신 상담 `cancelled_at is not null` 또는 `no_show_at is not null`(미예약으로 복귀) — 정확한 컬럼 의미는 구현 시 `consultation-actions.ts` 취소 경로로 재확인 |
| 8 | `closed` | Consultation Closed | 최신 상담 `status='closed'`(`admin_close_consultation`) 또는 interest `cancelled/expired` |
| 9 | `none` | No consultation request | 위 어느 것도 없음 |

- **중복 상담 방지**: 반복 요청은 (a) interest 학생당 열린 행 1개 부분 유니크(`student_consult_interests_one_open`), (b) `register_consult_interest` 멱등 반환, (c) `accept_guardian_link_invite`가 `requested/scheduled` 상담 재사용으로 이미 보장. **Free Accounts 화면은 새 상담을 만들지 않는다** — "Request consultation"은 기존 상담 관리(`?tab=consult`, 해당 상담 카드)로의 링크. 기존 상담이 없을 때의 수동 생성은 범위 밖(D8).
- **무료 계정은 이동/삭제되지 않는다**: 단계가 바뀌어도 `students` 행·`member_type`은 그대로(전환만 단방향 변경). 전환 후 Users 탭에 `tutoring`으로 나타나고, Free Accounts에서는 `scope='converted'`(또는 상담 단계 필터 `converted`)로 계속 조회 가능.
- 링크: 상담 → `/admin?tab=consult`(+상담 id 하이라이트가 가능하면 쿼리 파라미터; 현재 칸반은 id 쿼리가 없을 수 있어 구현 시 확인), 학생 관리 → `/admin?tab=users`(해당 학생 선택 — 현재 Users 탭 선택은 내부 state라 딥링크 지원 추가가 필요, D 항목에 포함하지 않고 구현 세부).

---

## 9. Analytics 지표 정의

### 9.1 공통 규칙

- **테스트 계정 제외 기본**(`is_test_account=false`). 토글 "Include test accounts"(기본 off), 카드 하단에 `N test accounts excluded`.
- 권위 원천은 **DB 집계만**(외부 분석 도구 이벤트는 쓰지 않음, PII 없음). 기간 `p_from, p_to`는 `Asia/Seoul` 일 경계로 해석(기존 stats 규칙 `v_tz`와 동일).
- **이벤트 건수(기간 내)** 와 **코호트 전환율(분모 고정)** 을 구분해 표기한다: 이벤트는 "in period", 코호트는 "of students who signed up in period".

### 9.2 지표표

| 섹션 | 지표 | 정의(분자) | 분모 | 중복 제거 | 비고 |
|---|---|---|---|---|---|
| Signups | Total free accounts | `member_type='free'`, status ≠ closed | — | 학생 1행 | 전환된 계정은 제외(Converted 카운트 별도) |
| | New in period | `joined_at ∈ [from,to]` | — | 학생 1행 | |
| | Active last 7 days | `last_active_at ≥ now()-7d` | Total free accounts | 학생 1행 | "relative to now" — 기간 필터 영향 없음(툴팁) |
| | Active in period | `student_activity_days.day ∈ [from,to]` distinct 학생 | Total free accounts(기간 말 시점 기준 아님, 현재) | distinct student | C안 필요(D1) |
| Learning | Tests started | `mock_exam_attempts.started_at ∈ period` | — | 응시 1행(학생×세트 1회 구조라 자연 중복 없음) | 이벤트 건수 |
| | Tests completed | `status='graded' ∧ graded_at ∈ period` | — | 응시 1행 | 이벤트 건수 |
| | Completion rate | 기간 내 started 응시 중 현재 graded 수 | 기간 내 started 응시 수 | 응시 1행 | **코호트 비율**(started 코호트). 기간 말에 아직 진행 중인 응시는 분모에 남음 → 라벨 "of tests started in period" |
| | SAT / AP usage | 위 started를 `exam_track`별 | 동일 | 응시 1행 | AP는 데이터 없으면 0 대신 `No AP tests yet` |
| | Mistake-notebook usage | 기간 내 `saved_to_practice=true` 문항 수 / 사용 학생 수(distinct) | — | 학생 distinct | "저장"만 측정(복습은 S6 전까지 Not tracked) — 저장 시각은 `updated_at` 근사이므로 **기간 내 건수는 정확하지 않음** → 지표는 *누적 저장 수*와 *저장한 학생 수*(전 기간)만 제공, 기간 필터 비적용 명시 |
| | Vocabulary usage | 기간 내 `vocab_words.created_at` 건수 + distinct 학생; 퀴즈 `submitted_at ∈ period` 완료 수 + distinct 학생 | — | distinct student | |
| | Materials usage | `material_reading_positions.updated_at ∈ period` distinct (학생,문서) | — | (user,doc) 1행 — 문서당 마지막 시각만 저장돼 **기간 내 최초/횟수는 알 수 없음** | 횟수·시간은 S6 이후 |
| Conversion | Consultation requests | 기간 내 `student_consult_interests.created_at` | — | 학생당 열린 행 1개 제약 → 사실상 distinct | 이벤트 건수 |
| | Parent invites sent / accepts | 기간 내 `guardian_link_invites.created_at` / `accepted_at` | sent는 이벤트, accept rate = accepted ÷ sent(같은 invite 코호트 `created_at ∈ period`) | invite 1행 | resend는 `guardian_link_invite_events`로 별도, sent 카운트에 넣지 않음 |
| | Bookings | 기간 내 free_member 상담이 `scheduled`로 최초 전이(`consultation_status_events`) | — | 상담 1건 | 취소 후 재예약은 최초 1회만 |
| | Completions | `completed_at ∈ period` free_member 상담 | — | 상담 1건 | |
| | Tutoring conversions | `students.converted_at ∈ period` | — | 학생 1행 | 이벤트 건수 |
| | **Cohort conversion rates** | 가입 코호트(`joined_at ∈ period`) 중 단계 도달 학생 수 | 코호트 크기 | distinct student | 예: signup→request, request→invite accepted, accepted→booked, booked→completed, completed→converted. "도달" = 현재 stage가 해당 단계 이상(§8 우선순위 기준) — 단, 현재 단계는 되돌아갈 수 있어(취소) `ever reached`는 events/타임스탬프로 계산: interest.created_at, invite.accepted_at, 상담 최초 scheduled 이벤트, completed_at, converted_at |
| Scores (선택, S7) | SAT Total / R&W / Math 평균·최고·표본 수, AP 과목별 | 공유 모듈 규칙(graded·같은 응시) | 표본 수 병기 | 응시 1행(학생별 평균 후 평균 아님 — "응시 기준"임을 라벨) | 전 학생 응시를 `mock_exam_attempt_detail`로 펼치면 O(응시×문항) → **팩트 테이블 필요**(§9.3) |

### 9.3 점수 분석용 팩트 테이블(선택)

`mock_exam_attempt_score_facts (attempt_id pk, student_id, exam_track, ap_subject, format, rw_total, rw_correct, rw_route, math_total, math_correct, math_route, graded_at, computed_at, adjustments_version)` — 채점 완료 시 `refresh_attempt_score_facts(attempt_id)`로 기록, 문항 오류 판정(조정) 발생 시 재계산 훅 필요. 구현 비용이 크므로 **점수 분석은 마지막 단계(S7)에서 오너 확인 후**(D 항목). 그 전에는 Analytics에서 점수 섹션을 숨기고 개별 상세에서만 점수 노출.

### 9.4 학습 사용 지표(프로필 D) — `admin_free_account_learning_usage`

```
mistakeNotebook: { savedCount, firstSavedAt: null /*not tracked*/, lastUpdatedAt /*updated_at 근사*/, reviewed: "not_tracked" }
vocabulary:      { wordsSaved, lastWordAt, quizzesCompleted, avgQuizPct, lastQuizAt, reviewItemsOpen, reviewItemsCleared, flashcardStudy: "not_tracked" }
materials:       { docsOpened /*material_reading_positions 행 수*/, lastReadAt, views: "not_tracked", timeSpent: "not_tracked" }
tracking:        { learningEventsSince: null | date }   // S6 적용일
```

---

## 10. 권한·성능

### 10.1 보는 범위

| 주체 | Free Accounts 탭 | 근거 |
|---|---|---|
| 관리자 `admin_tier` master/full | 전체(목록·상세·점수·응시 문항 상세·Analytics) | 기존 requireAdmin 동일 |
| supervisor | `학생관리` capability 보유 시만(그 외 탭 숨김 + 서버/DB 거절) | `assertCanViewStudent`·`record_staff_student_view`와 동일 규칙 |
| consultant | **탭 없음**. 학습 요약은 기존 `free_member_learning_summary`(활성 grant + 담당 상담 컨설턴트, 집계만, 감사)로 한정. 전환 전에는 `consultant_assignments`를 만들지 않는 기존 결정 유지 | free-member-tutoring-design §3.5 |
| teacher/parent/student | 접근 불가 | |

- **서버**: 신규 서버 액션은 `requireAdminOrCapability("학생관리")` 후 **사용자 세션 클라이언트**(`createClient()`)로 RPC 호출. 서비스 롤 클라이언트(`createAdminClient`)로 우회하지 않는다(현 `loadFreeMembersOverviewAction`은 `requireAdmin`+서비스 롤 — supervisor capability 미검사 → 교체).
- **DB**: 모든 신규 RPC는 `_free_accounts_staff()`를 첫 줄에서 검사하고 `revoke execute … from public, anon; grant execute … to authenticated`. 응시 문항 상세는 기존 `mock_exam_attempt_detail`의 `_mock_exam_can_view`가 이미 `is_admin()`을 허용(supervisor capability는 거기서 검사하지 않음 → **상세 열람 서버 액션에서 `requireAdminOrCapability("학생관리")`를 먼저 호출**하고 후속 개선으로 RPC도 동일 검사 추가는 별도 이슈).
- **감사**: 프로필 열기 → `record_staff_student_view(student, 'free_profile')`(10분 디듀프); 상태 변경 → `account_status_events`(reason 필수 UI); 테스트 표식 변경 → `student_flag_events`.
- **PII**: Analytics RPC/응답은 집계 숫자·ID 없는 코호트만. 목록은 이름·이메일을 반환하지만 관리자 세션에서만. 분석 이벤트(외부 도구)에는 새 이벤트 추가 없음. 비공개 필기(`mock_exam_annotations`, 보호자 비공개 정책 `…0012`)는 프로필에 노출하지 않음(D10).

### 10.2 쿼리 분리와 비용

| 화면 | 호출 | 요청 수 |
|---|---|---|
| 목록 | `admin_free_accounts_list` 1회(페이지·정렬·필터 변경 때마다) | 1 (+ 디바운스된 검색) |
| 상세 열기 | `admin_free_account_profile` 1회, 이후 탭/섹션 확장 시 `…_attempts`, `…_learning_usage` 지연 호출 + `admin_student_mock_attempt_facts`는 attempts와 동일 데이터 재사용(중복 호출 금지) | 최초 1, 섹션당 +1 |
| Analytics | `admin_free_accounts_analytics` 1회(기간 변경 때) | 1 |
| 결과 상세 | 서버 액션 `getMockExamAttemptDetailForAdminAction`(응시 클릭 시) → `MockExamResultView readOnly` | 클릭당 1 |

재사용: 목록·분석 모두 저장된 컬럼·인덱스 기반 집계, 점수만 상세에서 1명분 계산. 클라이언트 캐시는 기존 `tab-data-cache.ts` 패턴(관리자 id 묶음, 단기)을 목록에만 적용.

---

## 11. 테스트 계정 제외 방식

- 컬럼 `students.is_test_account`(M20). 표식 규칙: (1) `_email_is_test(email)` 패턴(예시 도메인, `.test`, `uat-|it-|e2e-|qa-|test-` 로컬파트, `${RUN}-` 픽스처), (2) 관리자 수동 토글 `admin_set_test_account`(사유 필수, 감사). `test_account_source`로 구분.
- 신규 계정: BEFORE INSERT 트리거가 `auth.users.email`로 자동 설정(`provision_free_member` 수정 불필요). 기존 행은 M20 백필.
- 사용처: 목록 기본 필터, Analytics 모든 지표(`join students s on … and (p_include_test or not s.is_test_account)`), 팩트 테이블.
- UAT 규칙(CLAUDE.md): UAT 계정은 `uat-<runId>-…@example.com`를 유지(자동 표식) → 종료 후 정리 쿼리도 `is_test_account` + runId로 한정, 공식 계정 보존 확인.
- 위험: 실제 고객이 `example.com`류를 쓰는 경우는 사실상 없음. 오탐 시 수동 해제 가능.

---

## 12. 파일별 변경 목록 (구현 단계용)

신규
- `lib/mock-exam/score-aggregate.ts`(+ `score-aggregate.test.ts`) — §5
- `lib/free-accounts/types.ts`, `lib/free-accounts/consult-stage.ts`(stage key↔UI 라벨·색 매핑, 순수) (+test)
- `app/admin/free-accounts/FreeAccountsTab.tsx`(탭 루트, 서브탭 Accounts/Analytics), `AccountsList.tsx`(검색·필터·정렬·페이지), `AccountDetail.tsx`(A–E 섹션), `ScoreStatsCard.tsx`(토글 SAT Total/R&W/Math), `AttemptHistoryTable.tsx`, `LearningUsageCard.tsx`, `ConsultationLinkCard.tsx`, `AnalyticsPanel.tsx`
- `app/admin/free-accounts-actions.ts`(`"use server"`: list/profile/attempts/usage/analytics/attemptDetail/setStatus/setTestAccount; 전부 `requireAdminOrCapability("학생관리")`)
- `app/admin/StudentMockScoresCard.tsx`(일반 학생 상세용 — 같은 공유 모듈·같은 `ScoreStatsCard` 사용)
- `supabase/migrations/20262100000020…28`(§6), 통합 테스트들(§13)

수정
- `lib/student-stats/metrics.ts: computeMockStats` — 내부를 공유 모듈로 위임(출력 불변)
- `lib/mock-exam/attempt-data.ts: computeScoreEstimate` — `estimateAttempt` 사용
- `app/admin/admin-tabs.ts`(`free-accounts` id + `free-members` legacy alias), `app/admin/admin-tabs.test.ts`, `app/admin/AdminShell.tsx`(NAV label "Free Accounts", capability 없는 supervisor에게 숨김), `app/admin/page.tsx`(탭 로더 분기 — 이 탭은 클라이언트 지연 로드라 로더 추가 없음)
- `app/admin/FreeMembersTab.tsx`/`free-members-actions.ts` — 기존 서브탭(상담 관심 큐·보호자 연결 수동 검토·초대 이벤트·계정 병합)은 새 탭 하위 "Review queue"로 이관(영어 UI), 회원 목록 서브탭은 삭제
- `app/admin/users-actions.ts: setStudentStatus` — `closure_pending|closed` 허용(+reason 인자), 기존 호출부 호환
- `app/admin/StudentDetailPanel.tsx` — "Mock exam scores" 카드 삽입(공유 모듈)
- `app/student/StudentShell.tsx` — `touchActivityAction` 하트비트(B/C안 채택 시)
- 건드리지 않음: `score-estimate.ts`, 기존 상담·전환 RPC(21만 create or replace로 `converted_at` 기록), 학생 포털 화면

### UI 문자열(영어, 목록)

탭 `Free Accounts`; 서브탭 `Accounts` `Analytics`; 컬럼 `Name` `Email` `Joined` `Last Active` `Completed Tests` `Consultation Status` `Account Status`; 검색 placeholder `Search by name or email`; 필터 `Joined` `Last active` `Attempts` (`Any` `Has attempts` `No attempts`) `Exam type` (`SAT` `AP`) `AP subject` `Consultation status` `Account status` `Show` (`Free active` `Converted to tutoring` `All`) `Include test accounts`; 빈/오류/로딩 `No accounts match these filters.` `Couldn't load accounts.` `Loading…`; 상세 섹션 `Account` `Score stats` `Attempt history` `Learning usage` `Consultation`; 점수 토글 `SAT Total` `Reading & Writing` `Math`; 지표 `Latest` `Best` `Average` `Attempts counted` `Change by attempt date`; 안내 `Estimated score range — not an official SAT / College Board score.` + `avg of {n} attempts`, `No scored attempts yet`, `Score estimate not available (fixed-format test)`, `Not tracked yet`, `Tracking since {date}`, `Partial` `In progress` `Retake`; 상담 단계 라벨은 §8 표; 상태 `Active` `Suspended` `Closure pending` `Closed`, 버튼 `Suspend account` `Reactivate account` `Close account`(사유 입력 + 확인 대화), `Status history`.

---

## 13. 구현 단계와 테스트 (공유 로컬 DB 규칙 준수)

모든 DB 통합 테스트: 기존 `*.integration.test.ts` 관행(psql 직접, 기본 `postgresql://postgres:postgres@127.0.0.1:54422/postgres`, `SUPABASE_TEST_DB_URL`), 실행 ID(`RUN`) 접두 픽스처(`<RUN>-<label>@example.com`), **`supabase db reset` 금지**, 단언은 자신의 RUN 학생 집합 기준(분석 RPC는 `p_cohort_ids uuid[] default null` 관리자 전용 파라미터로 범위를 한정해 병렬 세션 데이터 영향 제거). 전체 스위트는 R 종료 시 1회, 개발 중엔 변경 영역만.

| 단계 | 내용 | 테스트 |
|---|---|---|
| S0 | `score-aggregate.ts` + `computeMockStats` 위임 | **Unit**: 규칙 표 §5.3 전 항목(고정형 제외, 미완료 null, 총점 단일 응시, 섹션 합성 금지, 재응시 별개, 표본 수, AP/SAT 그룹 분리, 범위 평균·최고·추이), 기존 `metrics.test.ts` 회귀 무변화 |
| S1 | M20·21(컬럼·마커·활동·converted_at) + 하트비트 | **통합**: `_email_is_test` 패턴·트리거·백필, `touch_student_activity` 10분 쓰로틀, `convert_free_member_to_tutoring`이 `converted_at` 1회만 기록(멱등) |
| S2 | M22 팩트 RPC + 관리자 학생 상세 점수 카드 | **통합**: 같은 픽스처 응시에 대해 `student_stats_aggregate`→`computeMockStats`와 팩트→공유 모듈 결과 **일치**, 조정 채점 반영, MST 경로별 문항 수, 권한(타 역할 거절) · **컴포넌트**: 카드 상태(빈/표본1/고정형 혼합/오류) |
| S3 | M23 목록 RPC + Accounts 목록 UI + 탭 등록 | **통합**: 필터 조합·정렬·페이지·`total_count`·검색·테스트 제외·scope(free/converted/all), 이력 행 미반환, 비관리자/capability 없는 supervisor/consultant 거절 · **Unit**: 탭 id/legacy alias · 쿼리 수 확인(요청 1/변경) |
| S4 | M24·26 상세 RPC·감사·상태 변경 + 상세 UI(A–E) | **통합**: stage 매핑(상태별 픽스처 9종), 반복 요청이 상담 중복 생성 안 함(기존 RPC 재확인), 전환 후 목록 필터, 상태 전이+`account_status_events`, 열람 감사 디듀프 · **UAT(Preview)**: 역할별 화면 확인 |
| S5 | M25 Analytics RPC + UI | **통합**: 지표별 분자/분모/중복 제거 픽스처(경계일·테스트 계정 제외·코호트 vs 이벤트) |
| S6 (승인 후) | M28 `student_learning_events` + 학생 화면 3곳 호출 | 통합(디듀프) + 컴포넌트(호출 1회) |
| S7 (선택) | M27 AP 트랙 + 점수 분석 팩트 | 통합 + 단위 |

완료 기준(CLAUDE.md): UAT 실행 ID 부여, 시작 전 사전 점검·종료 후 정리·공식 계정 보존 확인, Preview 확인 범위 보고, 마일스톤 종료 때 폴리싱 라운드(개별 단위 폴리싱 없음).

---

## 14. 결정 필요 항목 (권고 포함)

| # | 질문 | 영향 | 권고 |
|---|---|---|---|
| D1 | `last_active` 추적 방식 — C안(하트비트 컬럼+일 단위 테이블)과 학생 화면 3곳 학습 이벤트(S6) 신규 추적을 승인하는가 | 쓰기 부하(≤6회/시/활성 사용자)·학생 포털 수정 범위. 승인 전에는 Active 지표를 파생(A안) 근사로 | **C 승인**, S6는 분리 단계로 후순위 |
| D2 | 테스트 계정 표식 컬럼+자동 패턴 규칙 | 분석 정확도 | 승인(수동 해제 가능) |
| D3 | 부분 응시 점수 | 스펙의 "partial (if supported)" | **v1 미지원**(진행 배지만), 모듈에 `partial` 예약 |
| D4 | AP: `exam_track/ap_subject` 컬럼 추가 시점, AP 결과 표현(1–5 환산 모델 vs 정답률) | AP 화면은 데이터 생길 때까지 빈 상태 | 컬럼은 S7, AP 결과는 **정답률만**(환산 모델은 별도 오너 결정, 추정 점수 표기 금지) |
| D5 | 재응시 허용 여부(현재 1회 고유 인덱스) | 정책·모의고사 소유 세션과 조율 필요 | 현행 유지, `Retake` 표시는 파생 필드로만 준비 |
| D6 | 컨설턴트에게 Free Accounts 열람 부여 여부 | 권한 범위 | **부여하지 않음**(기존 학습 요약 RPC 유지) |
| D7 | 기존 S5 서브탭(상담 관심 큐·보호자 연결 수동 검토·초대 이벤트·계정 병합)의 위치 | 스펙은 서브탭 2개만 | Accounts 하위 "Review queue" 섹션/필터 칩으로 보존(운영 기능 손실 방지) |
| D8 | 상담이 없는 무료 계정에서 "상담 요청" 수동 생성을 지원할지 | 중복 생성 위험 | v1은 **기존 상담 관리로 링크만**, 생성은 학생·보호자 흐름에서만 |
| D9 | 범위 점수의 평균/최고 정의(low·high 각각 평균, 최고=중간값 최대) | 화면 숫자 | §5.4안 승인 |
| D10 | 관리자 프로필에서 학생 필기·메모(`mock_exam_annotations`) 노출 | 개인 메모 프라이버시 | 노출하지 않음(문항별 답·해설만) |
| D11 | 기본 목록 범위: `member_type='free'` 전 상태 vs 활성만 | 폐쇄 계정 가시성 | 기본 `free` + 상태 필터 기본 "closed 제외", closed는 필터로 |
| D12 | 점수 분석(Analytics Scores) 포함 여부와 팩트 테이블 투자 | 구현 비용 | S7로 미루고 개별 상세만 먼저 |
| D13 | Preview/운영 DB의 기존 학생을 `is_test_account` 백필할 때 수동 검토 목록 제공 | 오분류 | 백필 결과 건수 보고 후 관리자 토글 |

---

## 15. 위험·주의

- `ScoreEstimate`가 범위라서 "best/average" 숫자는 사용자에게 범위로 보인다 — 임의로 한 점수로 환산하지 말 것(오너 승인된 "예상 점수 범위(내부 추정)" 표기 정책).
- `student_stats_aggregate`는 service_role 전용·최근 12건 한정이다. 관리자 상세의 점수 카드는 별도 팩트 RPC로 **전체 이력**을 읽는다 → 기존 통계 탭(12건)과 표본이 다를 수 있으므로 카드에 "Counted attempts"를 항상 표시하고, 일치 테스트는 동일 표본(≤12) 조건에서 수행.
- 상담 `cancelled_at`/`no_show_at`의 정확한 상태 의미는 구현 시 `consultation-actions.ts`로 재검증(§8 7번).
- `convert_free_member_to_tutoring`의 `converted_at` 기록은 해당 함수를 `create or replace`하므로 `20262100000006` 이후 다른 세션이 같은 함수를 고치지 않았는지 구현 직전 확인.
- 다른 세션 소유 영역(모의고사 응시 RPC, 학생 포털) 수정은 하트비트 훅 1곳 외에는 하지 않는다.
