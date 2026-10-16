# 외부 검수자 여정 감사 (2026-10-08)

범위: 공개 가입(무료 회원, 13세 이상) → 이메일 확인 → 로그인 → 무료 모의고사 응시 → 문제 신고 → 관리자 확인 → 운영 이전 가능성.
환경: 로컬 공유 Supabase(54422, db reset 없음), 로컬 전용, 원격·메일·푸시 없음. 실행 ID `rvw<base36>` 데이터는 종료 시 정리(재확인: 계정·세트·문항 잔여 0).
신규 파일: `e2e/reviewer-flow.spec.ts`(4개 테스트, 로컬 실행 4/4 통과, 11~17초). 앱 코드 변경 없음(명백한 버그 없음).

## 1. 결과 요약

| 단계 | 결과 | 근거 |
|---|---|---|
| 공개 가입 `/signup/student` (13+; 성인 검수자는 생년월일 입력 + 학년란 필수라 "N/A" 입력) | 통과 | e2e 1, `SignupForm.tsx`, `lib/free-member-signup.ts` |
| 확인 메일 → `/signup/student/confirm` (token_hash, verifyOtp) → `provision_free_member` → `/student` | 통과(로컬은 `admin.generateLink(magiclink)`의 token_hash로 같은 화면 사용) | e2e 1: `students.member_type='free'` |
| implicit flow | 가입만 `createSignupClient()`(implicit)라 다른 브라우저에서 열어도 됨 | `utils/supabase/client.ts` |
| 로그인 → Practice Tests 탭 → Start → 답안 → Mark for Review → 모듈 4개 제출(R&W M2 뒤 휴식) → 결과 | 통과 | e2e 2 |
| 해설: 영어 기본, 한국어 토글 | 통과 | `MockExamResultView` 해설 그룹 "Explanation language" |
| 신고 버튼(응시 중 아이콘, 결과 화면 알약) | 통과 | `ProblemErrorReportButton` |
| 신고 원본 저장 | 통과: `problem_id` + `problem_version_id` + `mock_set_item_id` + `reporter_id` 저장 | e2e 3 |
| 관리자 > Error Reports 에서 보임 | 통과: 문항 본문·해설·신고 유형·신고자 이름·메모·일시 | e2e 4 |

## 2. 신고 기능 상세 (질문 1)

- 유형: `wrong_key`(정답 오류) / `flawed_problem`(문제 자체 오류) / `other`(메모 필수). `bad_explanation`(해설 오류)은 선생님 전용이라 **학생(검수자)은 해설 오류를 고를 수 없다**. (`labels.ts reportTypesFor`, DB 제약 `problem_error_reports_explanation_teacher_only`)
- 자유 서술: 모든 유형에서 메모 가능(선택, `other`만 필수), 최대 1000자. 건의·제안 전용 필드는 없다.
- 버전: 제출 시 서버가 세트 문항의 `problem_version_id`를 고정 저장(클라이언트 값 무시). `problem_error_report_submit` 안에서 응시 소유권·모듈 공개 여부 검사.
- 내 신고 상태: 문항 단위 칩만 있다("Reported · Under review" / 확인됨 / 오류 아님, 결과 화면 `loadMyProblemErrorReportsAction`). **"내 신고 목록" 화면은 없다.** 응시 중 화면에는 이미 신고한 상태 칩이 안 뜬다(재클릭 시 "already reported").
- 중복: `unique(reporter_id, problem_id, problem_version_id)` — 검수자가 같은 문항에 두 번째 의견(유형 추가·메모 보강)을 남길 수 없고 신고 내용은 수정·삭제 불가(트리거). 응시 중 성급히 쓴 메모가 최종본이 된다.

## 3. 관리자 화면 (질문 2)

위치: 관리자 포털 > Error Reports(`app/admin/ErrorReportsTab.tsx`, `ReportedProblemsPanel.tsx`, 통계 `ErrorReportStatsPanel.tsx`). 한국어 본문 + 영어 사이드바 라벨(검수자와 무관).
- 목록: 문항별 그룹(신고 수·유형별·출처별·최근 신고·검토 필요/전체). 상세: 문항·정답·해설, 신고별 (출처·역할·**신고자 이름**·유형·메모·일시), 영향 범위, 판정.
- 판정: 오류 확정 3종(정답 오류/문제 오류/해설 오류) 또는 오류 아님 + 내부 메모(선택). **주의: 오류 확정은 문항 보관 + 이미 나간 응시 전원 정답 처리 + 여분 자동 교체까지 일으키는 운영 동작**이며, 검수자 의견을 "참고 기록"으로만 남기는 용도가 아니다.
- 필터: 영역·skill·난이도·기간(통계 화면에서 이동)과 열림/전체. **신고자별·세트별·문항번호별 필터 없음. 목록 행에 세트 이름·문항 번호 없음.** 상세에도 세트명이 없다(`mock_set_item_id`는 DB에만).
- 내보내기: **CSV/내보내기 없음**(`grep csv`는 정산 파일만). 총괄에 결과를 넘기려면 지금은 SQL 조회 또는 `scripts/prod-launch/export-reviewers.ts`(이전용 JSON)뿐.

## 4. 운영 이전 시 키 구조 (질문 3)

`problem_error_reports`의 FK: `problem_id→problems`, `problem_version_id→problem_versions`, `mock_set_item_id→mock_exam_set_items`, `reporter_id→profiles`, `resolved_verdict_id→problem_error_verdicts`, (`mock_attempt_id`, `session_id`, `homework_batch_id`는 이전 시 NULL 처리 — `content-tables.ts` REVIEWER_TABLES `nullAlways`). `problem_error_verdicts`: `problem_id`, `problem_version_id`, `decided_by→profiles(관리자, override 필요)`. `profiles.id`는 `auth.users.id`와 같은 값이지만 **DB FK는 없다**(앱·키트 규칙) → UUID를 보존한 auth.users 복사(비밀번호 해시 포함)가 전제이고 키트가 그렇게 한다. `students`·`student_terms_acceptances`는 `profiles` FK. 결론: 문항·버전·세트 문항 ID 보존 복사가 선행되면(콘텐츠 먼저, 검수자 키트 나중) 신고는 ID 그대로 이전된다. 응시가 제외돼 신고의 "어느 응시에서"는 사라지지만 `mock_set_item_id`로 세트·문항 위치는 복원 가능.
위험: 콘텐츠 복사 뒤에 문항 버전이 바뀌면(검수 중 관리자 수정 → 새 버전) 신고의 `problem_version_id`가 가리키는 버전이 복사 대상에 없을 수 있다 → 키트의 ORPHAN 검사(`REVIEWER_FK_CHECKS`)로 이전 전에 0건 확인 필수(이미 구현됨).

## 5. 검수자 표시 식별 (질문 4)

`auth.users.raw_app_meta_data.external_reviewer=true`는 **앱 코드·관리자 화면 어디에도 읽는 곳이 없다**(`grep external_reviewer app lib supabase` 0건). 관리자는 신고자 이름만 보며 이메일·검수자 여부·가입일은 안 보인다(e2e 4가 이를 고정: 이메일·"검수자" 미노출). 표시 확인은 SQL뿐: `select … from auth.users where raw_app_meta_data->>'external_reviewer'='true'`.
최소안(권장 안 B): 새 기능 없이 `scripts/prod-launch/`에 `list-reviewer-reports.ts`(읽기 전용 SQL → CSV: 세트명·문항 위치·문항 ID·버전 ID·신고자 이름/이메일·유형·메모·일시·판정). 앱 변경이 필요하면(안 C) `problem_error_report_detail`의 `reporter` 항목에 `externalReviewer` 불리언만 추가(additive 마이그레이션, security definer 함수가 `auth.users`를 읽음) 하고 상세 행에 "검수자" 배지.

## 6. 검수자 진행을 막는 요소 (질문 5)

1. **무료 회원 일일 응시 시작 상한 2회(UTC)** — `mock_exam_open_start`(마이그레이션 20262100000001). SAT Practice Test 9개를 보려면 최소 5일. 세트당 응시는 세트 계열당 1회(재응시 불가, 멱등 반환). 가장 큰 현실적 장애물. 정책 결정 필요(아래 권고 1).
2. **세트가 `access_tier='free'`여야 무료 회원이 시작 가능.** 컬럼 기본값은 `'tutoring'`(정책 대장 "다 프리로"는 값으로 적용돼 있어야 함). 새 세트·새 버전을 게시하면 기본값이 다시 'tutoring'이므로 **오픈 직전·검수 중 새 세트 게시 후 `access_tier` 확인 필요**(이 로컬 e2e는 세트 생성 뒤 `access_tier='free'`를 명시해서 통과).
3. **이메일 확인이 Supabase Auth 메일(SMTP)에 의존.** 로컬은 `enable_confirmations=false`·메일 없음이라 이 구간을 e2e로 완전 재현하지 못함(확인 화면은 token_hash로 검증). 운영: 내장 SMTP는 시간당 2통 → 검수자 수십 명이 동시에 가입하면 막힘. 런북 §2-Auth의 커스텀 SMTP·`email_sent` 상향·**Confirm signup 템플릿에 `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup`(`supabase/templates/confirmation.html`) 붙여넣기**가 필수. 대시보드 기본 템플릿(`{{ .ConfirmationURL }}`)을 그대로 두면 링크가 `/signup/student/confirm`에서 token_hash 없이 열려 "link is invalid"가 된다.
4. **캡차 없음**(런북 §7-2) — 봇 가입 방어는 확인 메일과 rate limit(5분당 IP 30)뿐. 검수자 계정 공개 URL이 퍼지면 스팸 가입 가능.
5. **13세 미만**: 가입 폼·DB 모두 차단(정책 확정 줄과 일치), 보호자 동의 경로는 가입 화면에 없음. 검수자가 미성년이면 막힘 — 성인 검수자만 안내.
6. **온보딩 화면**: 확인 후 곧바로 `/student`(Practice Tests 탭 사용 가능). 프로필 보완 화면 없음. 확인 링크를 다른 기기에서 열어도 동작(implicit).
7. 모듈 제한 시간·자동 제출은 그대로 적용(31분 등). 검수 목적으로 시간 압박 없이 보려면 불가 — 결과 화면에서 해설과 함께 문항 재열람은 가능(그 화면에서 정답 오류 신고 가능).
8. 신고는 응시 후 결과 화면에서 하는 것이 자연스럽다(응시 중에는 정답을 모름). `bad_explanation` 미제공(위 2절)으로 해설 품질 지적은 `other` + 메모로 해야 한다.

## 7. 권고 (우선순위)

1. [결정 필요, 높음] 검수자 일일 2회 상한 처리. 옵션: (a) 상한을 검수 기간 동안 올림(설정이 없어 코드·마이그레이션 변경 필요), (b) `external_reviewer` 계정만 상한 면제(함수에서 JWT `app_metadata` 확인, 소규모 additive 마이그레이션), (c) 상한 유지하고 검수자에게 "하루 2세트" 안내. 권장: (c)가 즉시 가능, 9세트 5일 소요가 부담이면 (b).
2. [확인, 높음] 운영 오픈·검수 시작 전 SAT Practice Test 1~9와 이후 게시분이 `access_tier='free'`인지 `select name, access_tier, status, readiness_status from mock_exam_sets` 로 확인(기본값 'tutoring').
3. [설정, 높음] 운영 Auth: 커스텀 SMTP + 확인 템플릿 붙여넣기 + email_sent 상향(런북 §2-Auth). 검수자 가입 전 실제 메일 1통으로 확인 링크 클릭 테스트.
4. [작업 안내, 중] 검수자에게 알릴 것: 학년란에 "N/A"(성인), 해설 오류는 `Other`+메모, 문항당 신고 1회뿐이므로 메모를 한 번에 충분히 쓰기, 응시 후 결과 화면에서 신고하는 것을 권장.
5. [갭 보고, 중] 총괄 인수용 출력 부재: 신고자별·세트별 필터와 내보내기가 없다 → 읽기 전용 스크립트(안 B)가 가장 작다. 앱 화면 기능 추가는 v3 범위 확인 후.
6. [갭 보고, 낮음] 관리자 상세에 세트명·문항 번호 없음(검수자가 "Test 4 module 2 문제 5" 식으로 이야기해도 관리자가 찾기 어려움). 안 B 스크립트가 같은 정보를 CSV에 담아 해결.
7. [갭 보고, 낮음] "내 신고 목록"과 신고 보강(두 번째 의견)이 없음. 검수 의견 수집 목적이면 `other` 메모 하나로 충분한지 총괄 판단.
8. [위험, 중] 판정 적용은 문항 보관·전원 정답 처리를 일으킨다. 검수자 신고를 처리하는 관리자에게 "오류 확정은 즉시 운영 동작"임을 인지시키고, 시험 응시자가 있는 동안엔 신중하게 적용.

## 8. 검증 로그

- `npx playwright test e2e/reviewer-flow.spec.ts` → 4 passed (최종 실행 11.2s). 전체 흐름: 가입 폼 제출("Check your email") → 확인 화면 → `/student` → 세트 Start → MST 4모듈 완주 → 해설 영어/한국어 토글 → 신고 2건(문제 오류+메모, 정답 오류) → DB: 신고 2행·버전 ID 존재·재신고 불가 → 관리자 상세에 이름·메모 표시, 이메일·검수자 표시·세트명 미노출.
- 정리 확인: `auth.users like 'rvw%'`=0, 테스트 세트=0, 테스트 문항=0(신고 삭제는 `session_replication_role=replica`로만, 테스트 데이터 한정).
