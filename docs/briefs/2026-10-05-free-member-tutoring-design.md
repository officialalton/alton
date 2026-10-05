# 무료 학습 회원 + 과외 전환 — 조사·설계 보고서

작성: 하위 에이전트(조사·설계 전용, 구현·마이그레이션·DB·환경변수 변경 없음), 2026-10-05

- worktree 실경로: `/Users/jangjiman/Developer/ALTON-worktrees/free-member`
- 브랜치: `feat/free-member`
- 기준 커밋: `9685b54f` (`origin/preview/m4-integration-verification`, "chore(data): 영어 해설 승인 목록 갱신")
- 읽은 것: `CLAUDE.md`, `docs/CURRENT.md`(1~80행·관련 절 검색), `docs/BRANCH-WORKFLOW.md`, 아래 각 절의 코드·마이그레이션만. 모의고사 UI(`app/student/mock-exam/**`)·도형 렌더러·수학 생성은 읽기만 했고 건드리지 않았다.
- 마이그레이션 번호: 사용 중인 `20262002…`는 피하고 **`20262100…` 대역**을 제안한다(5절).

표기: 확인된 사실은 파일:함수로 적었다. "권고"는 내 제안, "결정 필요"는 오너 결정 항목(7절)이다.

---

## 0. 한 장 요약

1. **현재 코드에는 학생 셀프 가입 경로가 전혀 없다.** 학생 계정은 (a) 상담 → 체험 온보딩 링크(`lib/trial-onboarding-finalize.ts`), (b) 관리자 직접 생성(`app/admin/direct-account-actions.ts`), (c) `account_invites`(`app/api/invite/accept/route.ts`)로만 생기며, 셋 다 **보호자·household가 먼저 있거나 동시에 만들어진다.** 무료 회원은 "household 없는 학생"이라는 새 상태를 도입한다. `household_members`에는 "자녀는 정확히 1개 household" 유니크 인덱스(`household_members_one_household_per_child`)가 있어, 나중에 보호자가 수락할 때 **기존 학생 행에 household 멤버십만 붙이면** 계정·기록 복사 없이 연결된다.
2. **게이트 축을 네 개로 분리**한다: 회원 유형(`students.member_type`), 계정 상태(기존 `students.status`), 계약/수강 상태(기존 `contracts`·`subject_enrollments`·`entitlement_grants`), 기능 권한(신규 단일 함수 `student_feature_access`). 지금은 학생 서버 액션 대부분이 `requireUser()`만 호출하고 **권한 근거가 "내가 학생인가"뿐**이라, 메뉴 숨김만으로는 막히지 않는다(2절 표).
3. **기존 상담 경로와의 합류점은 `consultations` 행 하나**다. `consultations.household_id`·`child_id`가 이미 nullable로 있고(`20260912000000`), 체험 수업권 지급(`grant_trial_entitlement_for_consultation`)·정규 계약 큐잉(`consultations_enqueue_contract_dispatch`)이 모두 `child_id`+별도 수동 게이트(Smart Notes 동의, 생년월일 확인, `outcome='regular_recommended'`)를 요구하므로 **보호자 연결만으로는 체험권·계약·크레딧이 자동 발생하지 않는다.** 단 기존 온보딩 경로 4곳이 "학생 계정을 항상 새로 만든다"는 전제로 짜여 있어 재사용 분기를 넣어야 한다(4절).
4. **정책과 충돌하는 기존 코드 6건**을 6절에 모았다(자동 해소하지 않음). 가장 큰 것: Supabase Auth `enable_signup=true`(로컬 config, 원격 미확인)인데 이메일 확인 `enable_confirmations=false`.

---

## 1. 실제 코드 인벤토리 요약 (근거)

### 1.1 계정·게이트
- `lib/auth.ts: requireUser()` → `resolveAccountDestination()`가 RPC 3개(`current_account_status`, `current_student_profile_completed`, `current_account_access_allowed`)를 병렬 호출. 학생 프로필 미완성 → `/complete-profile`(생년월일·학교·학년 필수, `complete_student_profile`), `students.status='pending'` → `/account-pending`, 13세 미만 + 보호자 동의 없음 → `/consent-pending`. 서버 액션도 전부 이 함수를 거치지만 **기능별 권한 검사는 없다.**
- `get_account_status()`(`20261448000000`)는 `students.status`(active/pending/suspended/closure_pending/closed)를 그대로 돌려준다. `pending`은 "관리자 매칭 전 온보딩"이라는 의미로 이미 쓰인다 → 무료 회원은 `pending`이 아니라 `active`여야 한다(`mock_exam_open_start`가 `students.status='active'` 요구: `20261995000000`).
- 철회/탈퇴: `closure_pending` 30일 유예 후 자동 `closed`(`close_expired_pending_accounts`, 크론 `/api/cron/close-pending-accounts`). 무료 회원 탈퇴에 그대로 재사용 가능.
- 미들웨어(`middleware.ts`)는 역할 접두사(`/student` 등)만 본다. 무료 학생은 `role='student'`라 `/student` 진입.
- `students`에는 `member_type` 류 컬럼이 없다. household 없는 학생의 선례가 없다(`households.primary_guardian_id`는 nullable이지만 학생 쪽 조인은 `household_members` 기준).

### 1.2 학생 포털 탭 (`app/student/StudentShell.tsx` NAV_ITEMS)
Home, Roadmap, Courses(`enrollment`), Classes, My Teacher, Consultant, Mock Exams, Assignments(`homework`), Practice(`problemlog`), Vocabulary(`vocab`), Materials. 로더는 `app/student/page.tsx`에서 15개 이상을 `Promise.all`로 한 번에 부른다(수업권·선생님 목록·로드맵 등 포함) → 무료 회원에게는 **불필요 로더를 건너뛰는 분기**가 필요(쿼리 수 증가 아님, 감소).

### 1.3 학생이 호출 가능한 서버 액션/RPC (`"use server"` 목록)
`app/student/{board,booking,chat,consultant-messenger,consultant-schedule,credits,curriculum-overlay,incident-report,memo,mock-exam-tab,review,stats,vocab-library}-actions.ts`, `app/session/[id]/*-actions.ts`(수업 세션 전용), `app/materials/asset-actions.ts`, `lib/mock-exam/{attempt,mst}-actions.ts`, `lib/problem-notes-actions.ts`, `lib/homework-batch-actions.ts`, `lib/roadmap/actions.ts`, `lib/universities/user-actions.ts`, `lib/problem-error-reports/actions.ts`, `app/complete-profile/actions.ts`.

### 1.4 자료(교재)
- 목록: `app/student/materials-data.ts: studentEnrolledSubjectIds()` — `enrollments`(active) ∪ `subject_enrollments`(active)의 과목만. 즉 **수강 과목 기준**. 무료 회원은 0건.
- 상세: `app/materials/[id]/page.tsx` → `loadLibraryDoc()`가 **사용자 세션 클라이언트**로 `curriculum_docs`를 읽는다 → 접근 통제는 RLS가 전부(`20261267000000` 정책 "배포된 문서는 관련자…": `status='published'` and (enrollments 또는 subject_enrollments 존재)). `curriculum_doc_versions` 정책(`20261348000000`)은 "교재를 볼 수 있으면 그 버전도". 파일 사본은 비공개 버킷 `curriculum-assets`, `storage.objects` 정책은 **관리자만** 직접 조회, 학생에게는 `app/materials/asset-actions.ts: getAssetVersionUrlAction()`이 RLS 검사 통과 후 10분 서명 URL 발급.
- 결론: 무료 공개 자료를 열려면 **RLS 정책 한 곳(+목록 로더)**만 바꾸면 되고, 비공개 자료의 직접 URL/파일 차단 구조(RLS + 비공개 버킷 + 서명 URL)는 이미 있다.

### 1.5 모의고사 (기존 구현, 건드리지 않음)
- `mock_exam_open_catalog(student)` / `mock_exam_open_start(set)`(`20261995000000`): 공개(`status='published'`)·보관 아님·MST는 `readiness_status='ready'`인 **모든 세트**가 모든 활성 학생에게 노출. 세트 계열당 응시 1회(`mock_exam_attempts_one_per_student_per_exam` 고유 인덱스, 재응시 불가).
- 제출 즉시 자동 채점·해설 공개(`submitMockExamAttemptAction`, 교사 확정 단계 제거됨). 결과 화면에 영역·세부 기술 집계(`lib/mock-exam/report.ts`) 이미 있음.
- `_mock_exam_can_view()`(`20261467000000`)는 본인·관리자·담당교사·**`is_guardian_of`**·**`is_assigned_consultant_of`**에게 열려 있다 → 보호자 연결·컨설턴트 배정이 곧바로 상세 열람권이 된다(3절·6절 쟁점).
- 문제 풀 분리: `problems.usage_scope`(general / mock_exam / both)로 모의고사 문항이 수업·과제 후보에서 이미 빠진다(`docs/briefs/2026-09-29-problem-usage-scope-onepager.md`). 무료 공개 세트 문항이 수업 문제로 재노출되는 문제는 구조적으로 차단되어 있다.

### 1.6 오답노트·단어장 (기존)
- 오답노트에 해당하는 기능 = **Practice 탭**(`ProblemHistoryTab`, `app/student/problem-history-data.ts`): 수업/과제 풀이 기록 + 모의고사에서 학생이 "문제 저장"한 문항(`mock_exam_answers.saved_to_practice`, `loadSavedMockExamPractice`). 모의고사 결과의 "Review Mistakes" 서브탭과 연결. 무료 회원은 모의고사 저장분만 채워지고 수업/과제 소스는 자연히 비어 있어 **코드 변경 없이 재사용 가능**.
- 단어장: `vocab_words`(학생 본인 RLS), `vocab_word_folders`(기본 폴더 "오답 노트" 자동 생성 `ensure_default_vocab_folder`), `vocab_library_books/words`(공용 라이브러리, 로더가 학생 필터 없이 전체 조회), `vocab_quizzes`. 서버 액션 `app/student/vocab-library-actions.ts`는 `requireUser()` 후 본인 행만 쓴다. **재사용 가능**. 단 `assignVocabQuizAction`·`assignLibraryWordsToStudentAction`(교사용 배정 경로)은 무료 회원과 무관.

### 1.7 상담 경로 (기존)
1. 랜딩 `app/ConsultForm.tsx` → `app/consult-actions.ts: submitHomepageConsultRequest` → RPC `submit_homepage_consult_request`(최신 `20261910000000`): `prospect_contacts` **매번 신규 insert**(이메일로 기존 prospect 재사용 안 함) + `consultations(source='homepage', status='requested', household_id/child_id=null)`. 같은 `contact_email`로 `status='requested'`가 이미 있으면 거절. 자동 배정 설정(`consultant_assignment_settings.auto_assign_enabled`)이 켜져 있으면 무작위 활성 컨설턴트에게 `intake_owner_id`/`admissions_consultant_id` 배정.
2. 관리자가 `app/admin/consultant-assignment-actions.ts: sendConsultationSchedulingLinkAction`("링크 보내기" **수동 안전장치**) → `consultation_scheduling_links`(7일 토큰) 생성 + `sendConsultationSchedulingLinkEmail`.
3. 고객이 `/schedule/[token]`(`app/schedule/[token]/ScheduleForm.tsx`) → `app/schedule-actions.ts: redeemSchedulingLinkAction` → RPC `redeem_consultation_scheduling_link`(원자적 슬롯 확정, `status='scheduled'`) → `syncOneConsultationCalendarEvent`(Google Calendar/Meet 초대 = "확정 안내"). 토큰 기반이라 **비로그인**.
4. 상담 후 체험 진행 확정(`confirm_trial_intent`) → `app/admin/trial-onboarding-actions.ts: sendTrialOnboardingNoticeAction` → `create_trial_onboarding_link_multi` → 보호자 메일 → `/api/trial-onboarding/redeem` → `app/consult/trial-onboarding-finalize-actions.ts` → `lib/trial-onboarding-finalize.ts: createGuardianAndStudentThenRedirect` → **보호자·학생 Auth 계정 생성** + RPC `finalize_trial_onboarding_students`(profiles/parents/students/households/household_members/칸반 카드 생성).
5. 이후 체험 수업권(`grant_trial_entitlement_for_consultation`) → 체험 → 계약 큐(`consultations_enqueue_contract_dispatch`, `outcome='regular_recommended' ∧ child_id`) → DocuSign 발송.

---

## 2. 기능별 권한표 (재사용 계획 포함)

범례: **F**=무료 회원 허용, **T**=과외(tutoring) 권한 필요, **C**=공통(계정·지원), 보호자(P)/교사/관리자 열은 현행 유지 여부. 권한 근거 = 신규 `student_feature_access(student_id)`(5절)의 기능 키.

### 2.1 학생 포털 메뉴·서버 액션

| 기능(탭/액션) | 키 | 무료 | 재사용/변경 계획 | 현재 서버 가드 | 필요한 가드 |
|---|---|---|---|---|---|
| Mock Exams 목록/시작/응시/제출/결과 (`lib/mock-exam/*`, `mock-exam-tab-actions.ts`, `/student/mock-exam/[id]`) | `mock_exam` | **F** | 기존 그대로. 단 세트 노출을 `mock_exam_sets.access_tier`로 필터(무료 공개 세트만), `mock_exam_open_catalog/start`에 티어 조건 추가 | RPC에서 `students.status='active'`만 | `mock_exam_open_start`에서 티어·세트 `access_tier` 검사 |
| 결과·히스토리·영역/세부기술 약점 | `mock_exam` | **F** | 단일 응시 집계는 `report.ts` 재사용. **누적(응시 간) 약점 요약은 신규 RPC 1개**(`mock_exam_weakness_summary`) 필요 — 기존 Stats 탭은 수업 데이터 중심(`StatsTier` family는 모의고사 강약 제외) | `_mock_exam_can_view` | 본인만 |
| Practice(오답노트) | `problem_log` | **F** | **재사용**. 수업·과제 소스는 비어 있음. 코드 변경 최소(빈 상태 문구만) | RLS/admin 로더, 항상 본인 id | 변경 없음 |
| Vocabulary(내 단어장·라이브러리·퀴즈) | `vocab` | **F** | **재사용**. 교사 배정 액션은 차단 | `requireUser`, RLS 본인 | 유지 |
| Materials | `materials_free` | **F(지정분만)** | 목록 로더에 "무료 공개 문서" 합집합, RLS에 `access_tier='free'` 절 추가(4.4절) | RLS(수강 과목) | RLS가 최종 방어 |
| 상담 문의(관심 등록) + 과외 안내 | `tutoring_info` | **F** | 신규: 결과/약점 화면 "선생님과 이야기하기" → 관심 등록 | - | 신규 RPC |
| Home | `home` | **F(축소 홈)** | 무료용 홈: 최근 응시·약점·다음 행동. 기존 `HomeTab`의 수업/보드는 숨김 | `loadDashboardData`(수업권 로더 포함) | 로더 분기 |
| Roadmap(`lib/roadmap/*`, `loadRoadmapData`) | `roadmap` | **T** | 기본값 T(오너: 기타는 과외 권한). 로드맵은 SAT/GPA/대학 입력 포함 → 상담 연결 시 요약 대상 후보 | `requireUser` | `student_feature_access` |
| Courses(`enrollment`) / Classes / My Teacher / Assignments | 각 `course`/`class`/`teacher`/`homework` | **T** | 숨김 + 서버 가드. 과거 수업 기록은 전환 후 계속 읽기(공통 이력 R) | `requireUser` + RLS 관계 | 가드 |
| 예약·취소·반복 예약 (`booking-actions.ts`) | `lesson_booking` | **T** | 가드 필수(수업권 `hold_entitlement`가 DB에서 막지만 근거를 통일) | `hold_entitlement` | 가드 |
| 선생님 채팅(`chat-actions.ts`) | `teacher_chat` | **T** | 가드 | RLS 관계 | 가드 |
| Consultant 탭·메신저·스케줄 (`consultant-*-actions.ts`) | `consultant_portal` | **T** (무료는 별도 "상담 안내" 화면) | 무료는 컨설턴트 배정이 없으므로 현 화면은 빈 상태. 신규 상담 화면으로 대체 | `consultant_assignments` RLS | 가드 |
| `requestParentPayment`(`credits-actions.ts`) | `credits` | **T** | 가드(보호자 없는 학생이 호출하면 오류) | household 조회 | 가드 + 친절한 오류 |
| 대학 탐색·진학 프로필(`lib/universities/user-actions.ts`, `student_academic_profile` 등) | `college` | **T** | 기본 T. (무료에서 열지 말지는 결정 7-13) | `requireUser` | 가드 |
| 문제 오류 신고(`lib/problem-error-reports`) | `problem_report` | **F** | 기존 재사용(모의고사 응시 중 노출됨) | 본인 | 유지 |
| 문제 위 필기·화이트보드(`problem-notes-actions`, 모의고사 주석) | `mock_exam` | **F** | 기존 재사용 | RPC 본인 | 유지 |
| 프로필 완성 `/complete-profile` | `account` | **C** | 재사용(생년월일·학교·학년만 필수). SAT/GPA/목표대학 입력 UI는 무료에선 접어 둠 | `complete_student_profile` | 유지 |
| 시간대 설정(`timezone-actions`) | `account` | **C** | 재사용 | 본인 | 유지 |
| 계정 탈퇴/철회 | `account` | **C** | 기존 `closure_pending` 흐름 재사용(학생 본인 요청 진입점만 추가) | 관리자만 | 신규 학생 진입점 |
| 수업 세션 `/session/[id]/*` 전체 | `session` | **T** | RLS가 관계 기반이라 무료는 이미 접근 불가. 가드 불필요, 테스트로 확인 | RLS | 테스트만 |

### 2.2 보호자·교사·컨설턴트·관리자

| 역할/기능 | 변경 | 비고 |
|---|---|---|
| 보호자 포털(`app/parent/ParentShell.tsx`) | 수락 직후 해당 자녀가 무료 회원이면 자녀 전환기에 "무료 학습 회원" 배지, 수강권·수업·예약 탭은 빈 상태/안내. `loadChildren`(`children-data.ts`)은 `household_members`만 보므로 자동 포함 | 수락 직후 첫 화면 = 상담 예약 화면(3.3) |
| 보호자의 모의고사 탭(`ParentMockExamTab`, `_mock_exam_can_view`) | 연결 즉시 자녀 응시 상세 전체 열람 가능(현행 보호자 권한 그대로) | **결정 7-9**: 연결 전 기록은 보이게 할지 |
| 교사 | 변경 없음. 무료 회원은 `teaches_student` 관계가 없어 보이지 않음 | 회귀 테스트만 |
| 컨설턴트(`assertCanViewStudent`, `lib/staff-student-view.ts`) | 담당 학생 = `consultant_assignments`. 무료 회원에게는 **배정을 만들지 않고** 요약 전용 RPC만 허용(3.5) | 6절 충돌 참고 |
| 관리자 | 사용자 목록·매칭 탭·대시보드(`app/admin/matching-data.ts: loadStudentsForMatching`, `dashboard-data.ts`, `users-data.ts`)에서 `member_type='free'`를 **고객 모집단과 분리**(필터/배지). 관리자 모의고사 세트에 `access_tier` 지정, 자료에 `access_tier`·권리 상태 지정, 가입 퍼널·관심 큐 보기 | 신규 탭 1개(무료 회원) |

---

## 3. 설계

### 3.1 상태 모델 (네 축 분리)

| 축 | 저장 | 값 | 비고 |
|---|---|---|---|
| 회원 유형 | 신규 `students.member_type` text, default `'tutoring'` | `free`, `tutoring` | **기존 행 전부 `tutoring`으로 백필**(동작 변화 0). `signup_source`(`self_signup`/`consultation`/`admin_direct`)도 같이 둠 — 퍼널·분석용, 권한에는 쓰지 않음 |
| 계정 상태 | 기존 `students.status` | active/pending/suspended/closure_pending/closed | 무료 가입 완료 시 `active`. `closed`는 기존 인증 차단(`resolveAccountDestination`) 그대로 |
| 계약/수강 상태 | 기존 `contracts`, `subject_enrollments`, `entitlement_grants`, `consultations.outcome` | 기존 | 신규 컬럼 없음. 읽기만 |
| 기능 권한 | 파생 함수 `student_feature_access(student_id) → text[]` (SQL stable, 서버 헬퍼 `requireStudentFeature(key)`가 동일 함수 호출) | 기능 키 집합 | 규칙: 계정 `active` 아니면 빈 집합(단 `suspended`는 기존대로 전용 화면). `free ∪ common` 항상. `tutoring` 키는 `member_type='tutoring'` **그리고** 과외 관계가 활성(`has_tutoring_access`: active subject_enrollment ∨ 유효 체험 grant ∨ 온보딩 진행 중 ∨ 기존 `pending` 고객)일 때 |

- **전환 규칙**: `member_type`은 한 방향(`free → tutoring`)만, 전환은 오직 아래 한 RPC 안에서: `convert_free_member_to_tutoring(student_id, consultation_id)` — **관리자/컨설턴트의 체험 온보딩 최종화(`finalize_trial_onboarding_students`의 기존 자녀 행) 또는 첫 체험권 지급 시점**에 호출. 보호자 연결·상담 예약·관심 등록만으로는 호출되지 않는다(요구: 연결만으로 과외 권한 불가).
- **계약 종료/중지**: `has_tutoring_access`가 거짓이 되면 과외 기능 키만 사라지고 `free`/공통 키는 유지(데이터·`member_type` 변경 없음). 과거 수업·결제 이력은 읽기 전용 "공통 이력"으로 유지(기존 RLS "과거 열람 허용" 원칙과 동일: `20261267000000` 주석).
- **학습 기록 보존**: 같은 `profiles.id`/`students.id`를 쓰므로 `mock_exam_attempts`, `vocab_words`, `mock_exam_answers.saved_to_practice` 등 전부 그대로 유지. 복사/이관 코드 없음.

### 3.2 무료 회원 가입 (학생 셀프)

- 화면: `/signup/student`(신규, 공개). 입력 = 이름, 이메일, 비밀번호, 생년월일, 학년, (선택)학교. 약관·개인정보 동의(별도 동의 버전 기록).
- 방식(권고): 클라이언트 `supabase.auth.signUp()` + **이메일 확인 필수**, 확인 후 첫 로그인에서 서버 RPC `provision_free_member(...)`가 `profiles(role='student')` + `students(status='active', member_type='free', signup_source='self_signup')`를 생성. 규칙: (a) `auth.users.email_confirmed_at` not null, (b) 이미 profile 있으면 거절(멱등), (c) **역할은 입력으로 받지 않고 항상 student/free**로 고정 — `user_metadata`는 위조 가능하므로 신뢰하지 않음(기존 `verifyOrphanOwnership` 주석과 동일 원칙), (d) 약관 버전·동의 시각 기록. 이 RPC는 `authenticated` 전용, 프로필 없는 계정만.
  - 근거: 이 코드베이스에는 `auth.users` 트리거가 없어(`handle_new_user` 없음) "프로필 없는 Auth 계정"이 `unknown`으로 fail-closed 처리되는 것이 기존 안전장치다. 가입 직후 프로비저닝 RPC 한 곳만 새 입구가 된다.
  - 대안(서버 `admin.createUser`)은 이메일 확인 메일을 직접 보내야 해서 비권고.
- **13세 미만**: 기존 `current_account_access_allowed()`가 `is_under_13`이면 보호자 동의 필요(`/consent-pending`). 무료 셀프 가입은 보호자가 없으므로 **13세 미만은 가입 차단**(권고, 결정 7-3). `is_under_13`는 생년월일이 null이면 true이므로 생년월일은 가입 필수.
- 중복 이메일: Supabase가 막는다. 이미 상담 경로로 생성되어 비밀번호 미설정인 학생 계정이면 "이미 있는 계정입니다 — 로그인/비밀번호 재설정"으로 안내(자동 연결·병합 없음).
- 봇·반복 계정(운영 권고): Supabase Captcha(Turnstile) + 이메일 도메인 일회용 차단 + IP/시간당 가입 제한(`[auth.rate_limit]`). 문제은행 노출은 이미 `usage_scope` 분리로 수업 풀과 격리되어 있고, 무료 세트 수를 소수로 한정하면 노출 상한이 정해진다.

### 3.3 전환 흐름 (학생 시작)

```
무료 학생: 결과/약점 화면 "선생님과 이야기하기"
 → ① register_consult_interest()      [student_consult_interests: status=registered]  ← 상담 예약 아님
 → ② 보호자 이메일 입력 → create_guardian_link_invite()   [guardian_link_invites: pending, 토큰, 7일]
     · 이미 보호자 연결됨 → 초대 생성 안 함, 보호자에게 "예약하세요" 알림 메일(1회), interest=parent_linked
 → ③ 보호자 메일 링크 /guardian-link/[token]
     · 계정 없음  → 토큰으로 메일 소유 입증(기존 trial-onboarding과 같은 방식) → 보호자 계정 생성(email_confirm) → 비밀번호 설정
     · 계정 있음(이메일 일치) → 로그인 후 진행 (자동 연결 금지)
     · 로그인 계정 이메일 ≠ 초대 이메일 → 거절 + 안내(학생에게 올바른 이메일로 재초대 요청)
 → ④ 수락 화면: "연결하면 공유되는 정보"를 명시(모의고사 응시·결과·단어장·오답 기록, 보호자 포털 권한 범위) + 체크박스 동의
 → ⑤ accept_guardian_link_invite(): household 연결 + 상담 요청 생성 + (가능하면) 컨설턴트 배정 + 예약 링크 발급
 → ⑥ 즉시 /schedule/[token] 로 이동(기존 예약 화면 재사용) → redeem_consultation_scheduling_link → Calendar/Meet 확정 메일(기존)
 → ⑦ 이후 기존: 상담 → 체험 → 계약
 * 중단 복귀: 수락 후 예약 안 한 채 이탈 → 보호자 포털 상담 탭에 "상담 시간 선택" 배너 + 재진입 링크(/schedule/[token] 만료 시 재발급 RPC) + 일일 크론 리마인더
```

상태 요약:
- `student_consult_interests.status`: `registered → invite_sent → parent_linked → consultation_requested → booked | cancelled | expired`
- `guardian_link_invites.status`: `pending → accepted | expired | revoked | superseded | manual_review`

### 3.4 계정·보호자·household·학습기록 연결 설계

**연결 RPC `accept_guardian_link_invite(p_token)` (SECURITY DEFINER, 보호자 로그인 세션, 단일 트랜잭션)**

1. `guardian_link_invites`를 `for update`로 잠그고 토큰 해시 검증, 만료/상태 검사. 이미 `accepted`면 같은 결과 반환(멱등, 더블클릭 안전).
2. `auth.uid()`의 `profiles.role='parent'` 및 계정 `active`; `lower(auth.users.email) = invite.email_normalized` 불일치 → 거절.
3. 학생 행 잠금(`students for update`). 학생의 기존 `household_members(role='child')` 확인:
   - 없음 → 보호자의 household를 찾는다(`households where primary_guardian_id = auth.uid() order by created_at limit 1`, 없으면 `finalize_trial_onboarding_students`와 동일하게 생성). `household_members(child)` insert. 고유 인덱스 `household_members_one_household_per_child`가 동시 수락의 최종 방어.
   - 있고 같은 household → 멱등 성공("이미 연결됨", 반복 초대 없음).
   - 있고 다른 household → `manual_review`로 두고 관리자 큐에 적재(자동 이동 금지: 병합/가족 이동은 사람이 판단).
4. **같은 이름·생년월일의 자녀가 보호자 household에 이미 있는 경우**(보호자가 상담 경로로 먼저 만든 학생): 자동 병합 금지 → `manual_review` + 관리자에게 기존 `MergeAccountsPanel`(`app/admin/merge-actions.ts: mergeAccounts`)로 처리 안내. 이메일이 같으면 가입 단계에서 이미 중복 차단(3.2).
5. `prospect_contacts` 신규(또는 같은 보호자 이메일로 기존 열린 것 재사용) + `converted_guardian_id`는 **명시적으로** 설정(이메일 일치 자동 채움 금지: `20261009000000` 주석의 정책과 동일).
6. 상담 요청 생성: 이미 같은 보호자 이메일 또는 같은 `child_id`로 `status in ('requested','scheduled')` 상담이 있으면 **새로 만들지 않고 그 상담에 `child_id`/`household_id`만 채운다**(중복 방지). 없으면 `consultations(source='free_member', status='requested', child_id, household_id, prospect_contact_id, contact_email=보호자 이메일)`.
7. 컨설턴트 자동 배정: `submit_homepage_consult_request` 안의 자동 배정 로직을 공용 함수 `_auto_assign_consultation(consultation_id)`로 추출해 재사용(5절). 배정되면 `consultation_scheduling_links`를 즉시 생성해 토큰 반환(수동 "링크 보내기" 안전장치의 의도적 예외 — **6절 충돌 #3, 결정 7-5**). 배정 불가(설정 꺼짐/후보 없음) → 상담은 `requested` 미배정으로 큐에 남고 보호자 화면은 "담당자 배정 후 안내" + 배정 시 기존 `sendConsultationSchedulingLinkAction` 경로로 메일.
8. `learning_summary_grants`(3.5) 행 생성(동의 시각·범위 `summary_v1`).
9. **하지 않는 것**(테스트로 고정): `consultant_assignments` 생성, 체험권/계약/크레딧 생성, `member_type` 변경, `subject_enrollments`·`teacher_assignments` 생성, 칸반 카드 생성, 계약 큐잉(`consultations.outcome`은 null).

**보호자 사전 정보 비공개**: 수락 전에는 보호자에게 학생 이름·학년(초대 메일 문구에 필요한 최소)만 노출. `guardian_link_invites`는 RLS로 학생 본인(생성자)·관리자만 select, 보호자는 토큰 RPC로만.

**다자녀·다중 초대**: 한 보호자가 여러 자녀에게 초대받으면 수락은 자녀별로 독립(초대 행 1:1 학생). 보호자 포털 자녀 전환기로 노출. 학생이 같은 이메일로 재초대하면 기존 pending을 `superseded`로 돌리고 토큰 세대(`token_generation`)를 올려 이전 링크 무효화(`account_invites`와 동일 패턴: `20260902000000`).

**두 번째 보호자(부/모)**: v1은 지원하지 않음 — household에 이미 주 보호자가 있으면 추가 초대는 `manual_review`(결정 7-8).

### 3.5 컨설턴트가 볼 수 있는 학습 요약과 접근 조건

- 조건(모두 충족): (a) `learning_summary_grants` 활성(보호자 수락 시 동의, 철회 가능), (b) 해당 학생의 상담(`consultations.child_id`)이 존재하고 **그 컨설턴트가 `admissions_consultant_id`**, (c) 상담 상태가 `requested/scheduled/completed`(취소·종료 후 N일 이후 만료), (d) 열람은 감사 기록(`document-access-audit`와 같은 패턴).
- 범위 `summary_v1`(집계만): 최근 응시 N회의 총점 추정·영역별 정답률, 약점 상위 영역/세부기술 5개, 응시 횟수·마지막 활동일, 단어장 규모(숫자). **제외**: 문항별 답안·필기·메모·하이라이트·오답노트 본문·단어 목록·프로필 민감 항목(성적/GPA는 이미 학생이 입력한 경우에 한해 로드맵 정책 따름).
- 구현: `_mock_exam_can_view`는 건드리지 않고 신규 SECURITY DEFINER RPC `free_member_learning_summary(student_id)` 하나로 제공. **전환 전에는 `consultant_assignments`를 만들지 않는다**(만들면 `is_assigned_consultant_of`로 `_mock_exam_can_view`·단어장 폴더·칸반 등 전부 열려 요약 범위를 넘는다). 전환(체험 온보딩 최종화) 후 기존 정책이 적용됨.

### 3.6 무료 회원 화면 (UI 기준, 마일스톤 종료 때 폴리싱)

| 화면 | 표시 | 행동 | 빈/오류/로딩 | 모바일/키보드 |
|---|---|---|---|---|
| 가입 `/signup/student` | 필드 5개 + 동의 | 제출 → 확인 메일 안내 화면 | 중복 이메일·13세 미만·약한 비밀번호 오류, 제출 중 비활성 | 단일 칼럼, 엔터 제출 |
| 무료 홈 | 다음 모의고사, 최근 결과 점수, 약점 상위 3, 연습/단어장 바로가기, "선생님과 이야기하기" 카드(상태별 문구) | 응시 시작, 탭 이동 | 응시 0회 빈 상태 | 하단 내비(`MobileBottomNav`) 재사용 |
| Mock Exams | 무료 세트 N개(응시 상태 칩) | 시작/이어하기/결과 | 기존 | 기존 |
| 결과/약점 | 기존 결과 화면 + 상단 하단 CTA | "선생님과 이야기하기" | CTA는 상태별: 관심 등록 전/초대 중/연결됨/예약됨 | - |
| 관심 등록·보호자 초대 | 안내 문구, 보호자 이메일 입력, 초대 상태·재발송(쿨다운)·취소 | 초대/재발송/취소/이메일 수정 | 만료·잘못된 이메일·발송 실패 | - |
| 보호자 수락 `/guardian-link/[token]` | 학생 이름·초대 메일, 공유 항목 목록, 동의 | 로그인/가입 → 수락 → 예약 화면 | 만료/철회/이메일 불일치/이미 연결/충돌(검토 중) 각 상태 문구 | 단일 칼럼 |
| 상담 예약 | 기존 `/schedule/[token]` | 기존 | 기존 | 기존 |

---

## 4. 기존 상담 경로와의 합류점 (정확한 지점)

### 4.1 합류 지점
- **공통 키 = `consultations` 행.** 신규 경로는 계정이 먼저, 상담이 나중; 기존 경로는 반대. 둘 다 `consultations.child_id/household_id/prospect_contact_id`가 채워진 상태로 수렴해야 하고, 그 뒤(체험권·칸반·계약)는 기존 로직을 그대로 쓴다.
- 신규 `source` 값: `consult_slot_source` enum에 `'free_member'` 추가(additive, `alter type … add value`).
- 식별자 연결: `student_consult_interests.consultation_id`, `guardian_link_invites.interest_id`, `consultations.child_id`(기존), `prospect_contacts.converted_guardian_id`(명시 설정). 이메일 일치만으로는 어떤 연결도 하지 않는다.

### 4.2 "무조건 계정 생성/온보딩 링크/자녀 연결"이 일어나는 지점 전수 (file:function → 재사용 변경)

| # | 위치 | 현재 동작 | 무료 회원 시나리오에서의 문제 | 변경(reuse-if-exists) |
|---|---|---|---|---|
| 1 | `lib/trial-onboarding-finalize.ts: finalizeWithGuardian` (`students` 루프) | 링크의 학생마다 `status<>'created'`면 **무조건** `admin.auth.admin.createUser` + `cleanup_orphaned_auth_identities` | 이미 무료 가입한 학생의 이메일이면 createUser 실패 → 그 학생이 `failed`로 남음 | 링크 학생 행에 `existing_child_id`가 있으면(아래 #3) 생성 건너뛰고 기존 `status='created'` 분기(코드에 이미 존재: `s.status==="created" && s.child_auth_user_id` → `continue`)를 탄다. 코드 변경은 최소, 핵심은 RPC가 행을 `created`로 미리 넣는 것 |
| 2 | `app/admin/trial-onboarding-actions.ts: sendTrialOnboardingNoticeInternal` → `lib/onboarding-email-guard.ts: findExistingAuthEmailCollisions` | 자녀 이메일이 `auth.users`에 있으면 **발송 자체를 막음**(`duplicate_emails`) | 무료 회원이 연결된 상담에서는 항상 막힘 | 상담에 `child_id`가 있으면 그 학생을 "기존 자녀"로 payload에 넣고 충돌 검사에서 제외. 그 외 충돌은 그대로 차단(정책 유지) |
| 3 | `create_trial_onboarding_link_multi` (최신 `20261922000000`) | `p_students` payload는 항상 신규 학생(이메일 필수) 가정, 링크 학생 행 `pending` | 기존 자녀를 표현할 수 없음 | payload 항목에 선택 키 `existing_child_id` 추가: 있으면 해당 학생이 `consultations.child_id`와 같은지 검증 후 행을 `status='created', child_auth_user_id=…`로 삽입 |
| 4 | `finalize_trial_onboarding_students` (`20261900000033`) | `v_student.status='created'` 행은 **카운트만 하고 continue** → `_create_student_kanban_card`·household_members insert를 건너뜀 | 기존 자녀는 칸반 카드가 안 생김 | 상담 경로(`v_row.consultation_id is not null`)에서 `created`+기존 자녀 행은 `household_members`(없을 때만 insert)와 `_create_student_kanban_card`를 멱등 호출. `convert_free_member_to_tutoring` 호출 위치도 여기 |
| 5 | 같은 함수의 직접 생성 분기 (`consultation_id is null`) | **무조건** `grant_trial_entitlement_for_student` + 직접 계정 계약 큐(`scheduleContractDispatch` → `direct_account_created`) | 직접 생성 경로에서 기존 자녀를 연결하면 의도치 않게 체험권·계약 발송 | 직접 생성 경로는 `existing_child_id` 행을 **거절**(무료→과외 전환은 상담 경로 전용, 결정 7-6) |
| 6 | `app/admin/trial-onboarding-actions.ts: retryFailedTrialOnboardingStudentAction` | 실패 학생 재시도 시 `find_auth_user_id_by_email`로 기존 계정 확인(재사용 로직 일부 있음) | 기존 자녀 행은 실패 상태가 아니므로 해당 없음 | 변경 없음, 테스트만 |
| 7 | `app/api/invite/accept/route.ts` (`account_invites`) | 이메일이 이미 `auth.users`에 있으면 `manual_review`로 보냄(`claim_account_invite`) | 이미 올바른 정책(자동 병합 금지) | 변경 없음. 신규 보호자 초대도 같은 정책을 따름 |
| 8 | `submit_homepage_consult_request` (`20261910000000`) | **매번 `prospect_contacts` 신규 insert**(이메일 기준 재사용 없음), 같은 이메일 `requested`면 거절 | 보호자가 랜딩 폼으로 먼저 상담 신청한 뒤 자녀가 무료 가입→초대하면, 보호자 prospect와 상담이 이미 존재 | 신규 RPC가 보호자 이메일로 열린 상담을 찾아 재사용(3.4-6). 랜딩 RPC는 건드리지 않되 `prospect_contacts`를 이메일로 재사용하도록 보완은 선택(결정 7-12) |
| 9 | `_create_student_kanban_card` (`20261922000000`) | 온보딩 최종화에서 호출 | 신규 경로는 수락 시점에 칸반이 필요한가? | 수락 시점에는 만들지 않음(체험 온보딩 최종화에서 #4로 생성) |
| 10 | `consultations_enqueue_contract_dispatch` (`20261902000000`) | `outcome='regular_recommended' ∧ child_id` 확정 순간 계약 **큐잉만** | 신규 경로에서 수락 시 `child_id` 세팅 → `outcome`이 null이라 큐잉 안 됨(안전) | 변경 없음. 단 컨설턴트가 outcome을 지정하면 정상적으로 큐잉(의도된 기존 흐름). 통합 테스트로 "수락만으로 큐 0건" 고정 |

### 4.3 기존 경로 유지 확인
랜딩 상담 → 컨설턴트 배정 → 예약 링크 → 상담 → 온보딩 링크 → 보호자·학생 신규 생성은 `existing_child_id`가 없으면 코드·RPC 모두 이전과 동일하게 동작하도록 분기만 추가(회귀 테스트: 기존 `app/consult/*.integration.test.ts` 전체).

### 4.4 자료(교재) 무료 공개 관리
- 컬럼(`curriculum_docs`): `access_tier text not null default 'tutoring' check in ('tutoring','free')`, `rights_status text not null default 'needs_review' check in ('confirmed','needs_review','restricted')`, `rights_note text`, `rights_confirmed_by uuid`, `rights_confirmed_at timestamptz`. **check 제약**: `access_tier='free'`이면 `rights_status='confirmed'`(권리 미확인 자료는 무료 지정 불가를 DB가 보장). 기존 행은 전부 `tutoring`+`needs_review`.
- RLS: `curriculum_docs` 조회 정책에 `or (status='published' and access_tier='free' and is_free_member_or_any_active_student())` 절 추가. `curriculum_doc_sections`("상위 문서 규칙 상속")·`curriculum_doc_versions`("교재를 볼 수 있으면 그 버전도")는 상위 문서 RLS를 따르므로 **자동 연동**. 비공개로 되돌리면 즉시 차단(행 기준).
- 직접 URL/파일: (1) `/materials/[id]`는 사용자 세션 RLS라 비공개는 "교재를 찾을 수 없습니다" (2) PDF/영상 파일은 비공개 버킷 + `getAssetVersionUrlAction`이 RLS 검사 뒤에 서명 URL → 비공개 자료는 서명 URL 자체가 안 나옴. 신규 테스트: 비공개 doc id·version id로 직접 호출 시 무료 계정 실패(서버 액션/페이지/RLS 3계층).
- 목록 로더: `studentEnrolledSubjectIds` 기반 로더(`loadMaterialsLibraryTree`, `loadMaterialsLibrary`)에 "무료 공개 docs 합집합" 분기 추가(무료 회원은 이 합집합만).
- HTML 교재 내 문제 정답: `loadLibraryDoc`은 `loadLegacyProblemAnswers`(admin)로 정답을 읽고 호출부 `redactProblem`으로 가린다 — 무료 공개 HTML 문서도 동일(테스트 포함). `teaching_tip`은 학생에게 노출되지 않는지 확인 필요(테스트 항목).
- 관리자 UI: 교재 탭에 "무료 공개" 토글 + 권리 확인 체크(확인자·일시 기록). `권리 확인됨` 목록과 `확인 필요` 목록 분리 보기. 공개 전환 시 감사 이벤트.
- 어떤 자료가 무료 후보인지는 코드가 아닌 **관리자 지정**(권고). 초기 무료 지정은 권리 확인된 자체 제작 자료만.

---

## 5. 변경 대상 목록 (파일·함수·테이블·RLS·마이그레이션)

### 5.1 마이그레이션 (모두 additive, 20262100… 대역)

| 번호(제안) | 내용 |
|---|---|
| `20262100000000_free_member_foundation.sql` | `students.member_type`(default `tutoring`, 백필 불필요), `students.signup_source`, `consult_slot_source` += `free_member`; 함수 `is_free_member(uuid)`, `has_tutoring_access(uuid)`, `student_feature_access(uuid)`, `provision_free_member(...)`(authenticated, 프로필 없는 계정만, 약관 동의 기록 테이블 `terms_acceptances` 또는 기존 consent 정책 재사용 확인 필요); `mock_exam_sets.access_tier` |
| `20262100000001_free_member_content_access.sql` | `curriculum_docs.access_tier/rights_*` + check; `curriculum_docs` RLS 절 추가(sections/versions는 상속); `mock_exam_open_catalog/start` 티어 필터; 누적 약점 요약 RPC `mock_exam_weakness_summary(student_id)`(본인·기존 보호자 권한 기준) |
| `20262100000002_tutoring_feature_guards.sql` | 학생 자기서비스 쓰기 RPC/정책 중 과외 기능(채팅 전송, `request_parent_payment`, 상담 메신저/미팅 요청, 로드맵 저장 등)에 `not is_free_member(auth.uid())` 추가. 대상은 구현 단계 S2에서 읽기 전용 쿼리(`pg_policies`에서 `cmd in ('INSERT','UPDATE','DELETE')`이고 조건이 `auth.uid()` 본인 컬럼만 보는 학생 자기서비스 정책 + 학생이 `execute` 가능한 `security definer` 함수 목록)로 열거해 확정(기존 RLS가 관계 기반이라 대부분은 이미 막힘; 서버 액션이 쓰는 테이블 후보: `chat_messages`, `household_messages`, `meeting_requests`, `parent_requests`, `student_roadmap_milestones`, `student_academic_profile`, `student_college_interests`, `session_memos`) |
| `20262100000003_consult_interest_and_guardian_link.sql` | `student_consult_interests`, `guardian_link_invites`(+`_events`), RPC: `register_consult_interest`, `create_guardian_link_invite`, `resend_guardian_link_invite`(쿨다운·일일 상한), `revoke_guardian_link_invite`, `claim_guardian_link_invite`(토큰→상태, 이메일 존재 시 로그인 필요 표시), `accept_guardian_link_invite`, `reissue_consult_scheduling_link_for_parent`; 고유 제약: 학생당 열린 interest 1개(partial unique), (student, email_normalized) pending 1개(partial unique), 토큰 해시 unique; RLS: 학생 본인/관리자 select, 쓰기는 RPC만 |
| `20262100000004_learning_summary_grants.sql` | `learning_summary_grants`, 열람 감사 테이블, RPC `free_member_learning_summary` |
| `20262100000005_old_route_reuse.sql` | `_auto_assign_consultation(uuid)` 추출(및 `submit_homepage_consult_request`가 이를 호출하도록 `create or replace`), `create_trial_onboarding_link_multi` `existing_child_id` 지원, `finalize_trial_onboarding_students` 기존 자녀 분기+전환 RPC 호출, `convert_free_member_to_tutoring` |

규칙: 적용 후 수정은 새 번호로(`CLAUDE.md` 마이그레이션 원칙), `create or replace` + `drop trigger if exists`. 이 세션은 파일도 만들지 않았다(설계만).

### 5.2 서버 코드

| 영역 | 파일/함수 | 변경 |
|---|---|---|
| 게이트 | `lib/auth.ts`(`requireUser` 반환에 `memberType`·`featureAccess` 추가 또는 신규 `lib/feature-access.ts: requireStudentFeature(key)`) | 모든 학생 서버 액션 진입에 키 검사. 키 목록은 단일 상수 파일. **화면 숨김 = 같은 함수 결과 사용** |
| 학생 홈 | `app/student/page.tsx` | 무료 분기(15개 로더 중 필요한 것만), `StudentShell`에 `featureAccess` 전달, `NAV_ITEMS` 필터 |
| 학생 가입 | 신규 `app/signup/student/*`, `app/auth/confirm`(이메일 확인 라우트가 없다면) , `provision_free_member` 호출부 | 신규 |
| 자료 | `app/student/materials-data.ts`, `lib/subject-material-library.ts` | 무료 공개 합집합 |
| 모의고사 | `lib/mock-exam/attempt-data.ts: loadMockExamOverview`(티어), `attempt-actions.ts: startMockExamAction`(RPC가 최종 방어). **UI 파일은 건드리지 않음**(`app/student/mock-exam/**`는 다른 세션 소유) | 서버 데이터 계층만 |
| 전환 | 신규 `app/student/consult-interest-actions.ts`, `app/guardian-link/[token]/*`, `app/api/guardian-link/redeem/route.ts`(`api/invite/accept` 패턴, 토큰 소비는 GET이 아닌 명시적 버튼 서버 액션 — `trial-onboarding-finalize.ts` 상단 주석의 GET 부작용 금지 원칙) | 신규 |
| 기존 경로 | `lib/trial-onboarding-finalize.ts`(#1), `app/admin/trial-onboarding-actions.ts`(#2), `lib/onboarding-email-guard.ts`(기존 자녀 예외), `app/admin/direct-account-actions.ts`(#5 거절) | 소규모 분기 |
| 이메일 | `lib/email.ts: sendEmail` 재사용 — 템플릿 3종(보호자 초대, 이미 연결된 보호자 예약 안내, 수락 후 예약 리마인더), 예약 확정은 기존 Calendar 초대 | |
| 크론 | 기존 일일 크론에 단계 추가(`/api/cron/mark-expired-invites`에 보호자 초대 만료·미예약 리마인더). **Vercel Hobby는 하루 1회 초과 크론이면 배포가 조용히 실패**(메모리: vercel-hobby-cron-blocks-deploy)하므로 새 크론 항목은 일일 스케줄만 | |
| 관리자 | 신규 "무료 회원" 탭(목록, 관심 큐, 수동검토 큐), 자료 탭 토글, 모의고사 세트 `access_tier`, `matching-data/dashboard-data/users-data`의 모집단 분리 | |
| 분석 | `lib/analytics/events.ts`(Surface 확장 `free_member`, 이벤트 추가) | 5.3절 |

### 5.3 분석(측정)
- 기존 인프라(`lib/analytics/track.ts`)는 **이벤트별 속성 화이트리스트**(`ALLOWED_EVENT_PROPS`)라 PII 유입이 구조적으로 막혀 있다. 이를 그대로 따른다.
- 이벤트(클라이언트, 속성은 `entry_point`, `member_type`, `step` 같은 비식별 값만): `free_signup_started/completed`, `free_exam_started/completed`, `free_result_viewed`, `free_study_opened(kind: notebook|vocab|material)`, `consult_interest_registered`, `guardian_invite_sent/accepted`, `consult_booked`.
- **권위 있는 퍼널은 DB 집계**(방문 제외): `students.member_type/created_at` → `mock_exam_attempts` → `student_consult_interests` → `guardian_link_invites` → `consultations(source='free_member')` → `contracts`. 클라이언트 이벤트는 방문·단계 클릭 보조. 무료 vs 기존 고객은 `member_type`/`signup_source`로 분리(기존 고객의 퍼널과 섞지 않음). 연락처·답안은 이벤트에 넣지 않음.
- 재방문 정의: 가입 후 7/14/30일 내 `mock_exam_attempts`·`vocab_words` 등 활동 유무를 DB 기준으로(이벤트 불필요).

---

## 6. 정책 충돌·주의 사항 (자동 해소하지 않음)

1. **Supabase Auth 셀프 가입 설정.** `supabase/config.toml`: `[auth] enable_signup = true`, 이메일 `enable_confirmations = false`. 즉 지금도 anon 키로 누구나 Auth 계정을 만들 수 있고(프로필이 없어 `unknown` → 로그아웃되는 fail-closed에 의존) 이메일 확인도 꺼져 있다. 무료 가입을 열면 **원격 프로젝트(`worpsqwqgnspddnrtnvq`)의 대시보드 설정(이메일 확인 ON, 최소 비밀번호 길이 6→8+, 캡차, 레이트리밋)을 확인·정렬해야 한다.** 이 설정은 repo 밖이므로 이번 조사에서 값을 확인하지 못했다.
2. **`students.status='pending'` 의미.** 지금 `pending` = "관리자 승인 전 온보딩"이고 `/account-pending`으로 보낸다. 무료 회원에 재사용하면 안 된다(모의고사 시작 RPC도 `active` 요구). 무료는 `active` + `member_type='free'`가 맞다. 대신 기존 `active` 학생을 "고객"으로 가정한 코드가 있다 → `app/admin/matching-data.ts: loadStudentsForMatching`(모든 students 로드), `app/admin/dashboard-data.ts`, `app/admin/users-data.ts`, `app/teacher/roster-data.ts`, `lib/roadmap/data.ts`, `app/student/credits-data.ts`는 `member_type` 필터 검토 필요.
3. **컨설턴트 예약 링크 "수동 발송" 안전장치.** `app/admin/consultant-assignment-actions.ts: sendConsultationSchedulingLinkAction` 주석: "Phase 2b는 자동 발송이 아니라 관리자가 '링크 보내기'를 눌러야만 실제 이메일이 나간다(안전장치)". 오너 스펙(보호자 수락 직후 예약 화면 직행)은 이 안전장치를 우회하는 신규 경로를 만든다. 의도된 예외인지 오너 확인 필요(결정 7-5). 예외를 둔다면 범위를 `source='free_member'` 상담으로 한정.
4. **보호자 권한이 연결 즉시 전체 상세 열람.** `_mock_exam_can_view`·`is_guardian_of`는 연결된 보호자에게 해당 학생의 모의고사 응시 상세(및 단어장 등)를 전부 연다. 오너 스펙 "수락 전에는 상세 학습 데이터 비공개"는 충족하지만 "수락 후 어디까지"는 정해지지 않았다. 학생의 필기·한 줄 메모(`mock_exam_annotations`, `20262002000000`) 같은 개인 메모를 보호자가 볼 수 있는지 별도 확인 필요 → 결정 7-9. (`20262002` 파일은 다른 세션 소유라 내용은 확인하지 않음.)
5. **`prospect_contacts` 중복 생성.** `submit_homepage_consult_request`가 이메일 재사용 없이 매 신청마다 prospect를 새로 만든다. 신규 경로가 prospect를 이메일로 재사용하면 정책(이메일만으로 자동 연결 금지, `converted_guardian_id` 명시 설정)과 충돌하지 않지만, 랜딩과 신규 경로가 서로 다른 prospect를 만드는 중복 위험이 있다.
6. **모의고사 "응시 1회" 고정 인덱스.** `mock_exam_attempts_one_per_student_per_exam`(학생×세트 계열 1회). 오너가 무료 재응시를 허용하려면 이 고유 인덱스와 `mock_exam_open_start`의 멱등 로직을 바꿔야 한다(모의고사 UI/RPC 소유 세션과 조율 필요). 권고는 v1 재응시 불허(결정 7-2).
7. (참고) `current_account_access_allowed`의 13세 미만 규칙은 무료 셀프 가입과 양립 불가 → 가입 연령 하한 필요.

---

## 7. 결정 필요 항목 (권고 포함)

| # | 질문 | 권고 | 영향 |
|---|---|---|---|
| 1 | 무료 세트 수 | 3세트(난이도·형식 대표), `access_tier='free'` 관리자 지정 | 적을수록 문항 노출·원가 상한 명확. 세트 추가는 지정만 바꾸면 됨 |
| 2 | 재응시 | v1 불허, 결과·해설·오답노트로 복습만. 재응시는 과외 전환 혜택 후보 | 허용 시 고유 인덱스 변경+문항 노출 증가 |
| 3 | 가입 연령 | 만 13세 이상만 셀프 가입. 미만은 보호자 대신 가입(상담 경로) 안내 | 허용 시 보호자 동의 선행 필요, `/consent-pending` 상시 노출 |
| 4 | 가입 필수 정보 | 이름·이메일·비밀번호·생년월일·학년(학교 선택). SAT/GPA/목표대학은 선택·나중에 | 기존 게이트(`complete_student_profile`)는 생년월일·학교·학년 필수 — 학교를 무료에서 선택으로 낮출지 |
| 5 | 수락 직후 예약 링크 자동 발급(수동 발송 안전장치 예외) | 예외 허용(`free_member` 소스 한정), 담당 컨설턴트 자동배정 실패 시 큐 대기 | 거부 시 보호자가 이메일 대기하게 되어 스펙 위배 |
| 6 | 무료→과외 전환 허용 경로 | 상담 경로(체험 온보딩 최종화)만. 관리자 직접 생성 경로로는 기존 자녀 연결 불가 | 직접 경로 허용 시 체험권·계약이 무인 발생할 위험 |
| 7 | 무료 결과·해설 범위 | 점수·영역/세부기술·정오·해설 전부(오너 스펙의 "해설" 포함 가정). 영어 해설 기본+한글 토글은 기존 정책 유지 | 해설 일부 잠금(유료 유도)은 UI 비용 증가 |
| 8 | 두 번째 보호자 | v1 미지원(`manual_review`) | 지원 시 주 보호자 승인 플로우 필요 |
| 9 | 보호자 수락 후 열람 범위 | 현행 보호자 권한 유지하되 학생 개인 필기·메모는 제외 확인(미확인이면 제외) | 열람 범위 변경은 `_mock_exam_can_view` 및 여러 RPC 영향 |
| 10 | 비용 발생 기능 한도 | 무료는 AI 문제 생성 등 **LLM 호출 기능을 열지 않음**(현재 무료 범위에 없음). 모의고사·단어장·Practice는 LLM 호출 없음. 서버 렌더링 부하만 → 일일 응시 시작 상한(예: 일 2세트) | 향후 AI 기능 추가 시 키별 한도 테이블 필요 |
| 11 | 보존·탈퇴 | 무료 회원 비활동 24개월 후 `closure_pending` 안내→30일 유예→`closed`→보존 배치(`run_data_retention_batch`) 비식별화. 학생 본인 탈퇴 버튼=`closure_pending` | 전환자는 과외 보존 정책으로 편입. 보존 배치 실제 활성화는 별도 오너 결정 대기 중(CURRENT.md) |
| 12 | `prospect_contacts` 이메일 재사용 | 신규 경로만 재사용, 랜딩 RPC는 그대로 | 랜딩까지 바꾸면 기존 상담 통합 테스트 영향 |
| 13 | Roadmap/대학 탐색 무료 허용 | 1차 불허(과외 권한) | 허용 시 상담 요약 입력원이 됨, 입력 데이터 보호 범위 증가 |
| 14 | 리마인더 방식 | 일일 크론(이메일): 초대 후 3일 미수락, 수락 후 2일 미예약에 1회씩, 최대 2회. 푸시/SMS 없음 | Hobby 크론 제한상 일 1회 |
| 15 | 학생 이메일/보호자 이메일 동일 입력 | 거절 | 학생이 자기 이메일로 초대하면 수락 불가능 |
| 16 | 초대 만료/재발송 | 7일 만료(예약 링크와 동일), 재발송 쿨다운 10분·일 3회, 학생당 열린 초대 3개 한도 | 스팸·괴롭힘 방지 |

---

## 8. 엣지 케이스 매트릭스 (설계 + 검증)

| 케이스 | 처리 | 검증 |
|---|---|---|
| 보호자에게 이미 ALTON 계정 | 토큰 → 로그인 요구 → 이메일 일치 시 수락 가능. 자동 연결 없음 | 통합: 계정 있는 보호자 수락, 로그인 안 한 상태 수락 불가 |
| 한 보호자에게 여러 자녀가 초대 | 초대 행 학생별 독립, 자녀별 수락. 같은 household에 child 멤버로 추가 | 통합: 2명 수락 → household_members 2건, 상담은 자녀별 |
| 학생이 이미 연결됨 | 초대 생성 거절, 보호자에게 "예약하세요" 알림 1회 | 통합: 초대 0건·알림 1건·중복 호출 시 추가 알림 없음 |
| 보호자가 먼저 같은 아이를 등록(상담 경로 학생, 이메일 다름) | 자동 병합 금지 → `manual_review`, 관리자 병합 패널 | 통합: manual_review 상태, 병합 전 데이터 미이동 |
| 같은 이메일로 상담 경로 학생 존재 | 셀프 가입 단계에서 중복 차단 | 통합: 가입 실패 문구 |
| 초대 재발송 | 새 토큰 세대, 이전 링크 `superseded` | 이전 토큰으로 수락 실패 |
| 초대 만료 | 만료 상태 문구 + 학생에게 재초대 안내 | 만료 직후/크론 전 모두 시간으로 검사(`claim_account_invite`의 패턴) |
| 초대 취소 | revoked → 수락 불가 | |
| 잘못된 이메일로 초대 | 학생이 취소 후 재초대(이미 가입한 다른 계정 이메일이면 로그인 불일치로 거절) | |
| 학생 또는 보호자가 이미 상담 신청함 | 3.4-6: 기존 열린 상담 재사용, 새 상담 생성 안 함 | 통합: 같은 보호자 이메일 `requested` 존재 시 consultations 행 수 불변 |
| 수락 후 예약 이탈 | 보호자 포털 배너+재발급+리마인더 | 통합: 토큰 만료 후 재발급 성공 |
| 더블클릭/중복 요청 | 초대 생성: partial unique. 수락: 행 잠금+멱등. 관심 등록: 학생당 열린 1개 | 동시성 테스트(Promise.all 2~5회) → 행 수 1 |
| 수락과 동시에 학생이 초대 취소 | 행 잠금으로 직렬화, 선행 쪽이 승리 | 동시성 |
| 보호자가 계정 생성 직후 이탈(비밀번호 미설정) | 같은 토큰으로 `/set-password` 복구 링크 재발급(기존 `generateGuardianRecoveryRedirect` 패턴) | |

---

## 9. 구현 단계와 검증 순서

원칙: 데이터 제약·서버 → 화면 → 자동 테스트 → Preview UAT → 문서 고정(CLAUDE.md "새 기능 착수 전 1장 정리" 순서). 한 단계 = 한 세션/브랜치로 순차(같은 마이그레이션·정책 파일을 건드리므로 병렬화 금지).

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| S0 | 오너 결정 7-1~7-6 확정, 원격 Auth 설정 점검(6.1) | 결정표 확정 |
| S1 | `…0000` 기반: `member_type`, 함수 `student_feature_access`, `provision_free_member`, 가입 화면, 이메일 확인 | 무료 가입 → 학생 홈 진입, **과외 자동동작 0건** |
| S2 | 접근 통제: `requireStudentFeature` 전면 적용, 학생 홈 분기, `…0002` 가드, 모의고사 티어/`…0001` | 아래 검증 항목 1~3·6·7 통과 |
| S3 | 자료: `access_tier`·권리 상태·RLS·관리자 UI·목록 로더 | 항목 4 통과 |
| S4 | 전환 데이터층: `…0003/0004` RPC, 보호자 수락 화면, 메일 3종 | 항목 8·9 통과(수락→예약 직행) |
| S5 | 기존 경로 재사용 분기 `…0005`, 관리자 모집단 분리 | 항목 9·10 통과 + 기존 상담 테스트 회귀 |
| S6 | 통합 회귀 + Preview UAT + 문서(`CURRENT.md`, 정책 기준선) | 전체 목록 통과 |

### 9.1 필수 검증 목록 → 테스트 방식 (공유 로컬 DB 54422 규칙 준수)

규칙: `supabase db reset`은 조정 세션만. 기능 세션은 **격리 스택**(CLAUDE.md "작업 위치": `project_id`·포트 임시 변경 → `npx supabase start`, 테스트는 `SUPABASE_TEST_DB_URL`/`SUPABASE_TEST_API_URL`), 공유 DB 테스트는 실행 ID가 붙은 전용 계정·가족(`test/reservation-slots.ts`, `test/per-run-teacher.ts` 방식), 종료 후 실행 ID 단위 정리, 공식 시드 계정 보존 확인. 단위 테스트(Vitest, DB 없음)는 서버 액션 모킹으로.

| # | 항목 | 방법 |
|---|---|---|
| 1 | 무료 가입 시 과외 자동동작 없음 | 통합: 가입 후 `contracts`, `contract_dispatch_jobs`, `entitlement_grants`, `entitlement_ledger`, `subject_enrollments`, `teacher_assignments`, `consultations`, `consultant_assignments`, `household_members` 행 수 0 |
| 2 | 모의고사 전체(적응형 분기 포함) | 기존 `mock-exam-mst-*.integration.test.ts`를 무료 계정으로 재실행(분기별 module routing), 티어 필터로 비무료 세트는 시작 불가 |
| 3 | 기존 오답노트·단어장 | 통합+단위: 무료 계정으로 Practice 저장·폴더·퀴즈 CRUD |
| 4 | 무료 자료 열림 / 비공개 차단 | 통합: 무료 doc 접근 성공, 비공개 doc id·version id로 `/materials/[id]`·`getAssetVersionUrlAction`·REST 직접 select 모두 실패, `access_tier='free'+rights<>confirmed` insert 거절, 무료→비공개 전환 즉시 차단 |
| 5 | 사용자 간 기록 격리 | 통합: 무료 A/B 교차 접근(응시·단어·Practice·초대) 전부 거절 |
| 6 | 과외 기능 서버/DB 권한 | 통합: 무료 계정으로 예약·채팅·결제요청·컨설턴트 미팅요청·로드맵 저장 각 호출 실패 + 직접 REST/RPC 호출도 실패 |
| 7 | 메뉴·서버·DB 근거 일치 | 단위: 기능 키 ↔ 메뉴 ↔ 서버 가드 테이블 정합성 스냅샷 테스트(키 누락 시 실패) |
| 8 | 보호자 초대→예약 전체 | 통합(서버 액션 레벨) + Playwright E2E 1개: 관심 등록 → 초대 → 신규 보호자 가입 → 수락 → `/schedule/[token]` → 예약 확정 |
| 9 | 기존/신규 경로 중복 방지 | 통합: 같은 보호자 이메일 기존 상담 있을 때, 같은 학생 기존 household 있을 때, prospect 중복, `duplicate_emails` 예외 |
| 10 | 전환 후 기록 보존 | 통합: 체험 온보딩 최종화(기존 자녀 행) 후 `students.id` 동일, 응시·단어 행 id 동일, `member_type='tutoring'` |
| 11 | 학생·보호자·교사·관리자 회귀 | 기존 `npm test`(unit 병렬/integration 순차) 전체, 특히 `app/consult/*.integration.test.ts`, `app/parent/*.integration.test.ts`, `lib/staff-student-view.integration.test.ts` |
| 12 | 퍼널·분석에 PII 없음 | 단위: `track()` 화이트리스트 스냅샷에 이메일·답안 키 부재 |
| 13 | 동시성/멱등 | 초대 생성·수락·관심 등록 병렬 호출 후 유니크 제약 확인 |
| 14 | 성능 | 학생 홈 쿼리 수 전/후 비교(무료 분기는 감소해야 함), 자료 목록 합집합 쿼리 수 확인 |

### 9.2 UAT 데이터(CLAUDE.md 규칙)
- 실행 ID(`freeuat-<Date.now()>`)가 붙은 전용 학생·보호자·가족을 사용하고, 공식 시드·실제 학부모 이메일로는 메일을 보내지 않는다(Preview는 샌드박스 SMTP/수신 주소 지정). 시작 전 사전 점검, 종료 후 실행 ID 단위 정리 + 공식 계정 보존 확인을 완료 기준에 포함. 최종 보고에 실행 ID·정리 결과·남은 레거시 경로를 적는다.

---

## 10. 참고: 세션 간 경계
- `app/student/mock-exam/**`(UI), 도형 렌더러, 수학 생성은 다른 세션이 편집 중 → 이 설계는 서버 데이터 계층(`lib/mock-exam/*` 읽기 경로, RPC)만 건드리도록 했다. 모의고사 RPC 변경(`access_tier` 필터)은 해당 세션과 마이그레이션 충돌이 없도록 `20262100…` 대역을 쓰고, `mock_exam_open_*` 함수는 `create or replace`로 덮어쓰기 전에 최신 정의를 반드시 다시 읽을 것.
- 모든 마이그레이션은 조정 세션이 통합 시 non-prod에 적용(BRANCH-WORKFLOW (d)); 이 세션은 적용하지 않았다.
