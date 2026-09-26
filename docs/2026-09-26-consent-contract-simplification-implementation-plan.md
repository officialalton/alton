# 초기 고객 절차 단순화 + 정규 수업 AI 기록 — 구현 계획

작성일: 2026-09-26
근거: `docs/2026-09-26-consent-contract-ai-records-simplification-prd.md`
상태: **계획만 확정, 구현 착수 전** (토큰/세션 사정으로 다음 개발 세션에서 실행)

이 문서는 PRD의 정책을 실제 코드의 현재 상태(2026-09-26 기준 조사 완료)에 맞춰
구체적인 파일·함수·마이그레이션 단위 작업으로 쪼갠 것이다. 다음 개발 세션은
이 문서의 순서를 그대로 따라가면 된다.

## 0. PRD 대비 코드 조사에서 확인된 차이 (착수 전 반드시 반영)

1. PRD가 말하는 `app/consult/trial-onboarding/trial-onboarding-actions.ts`는
   실제로는 `app/consult/trial-onboarding-actions.ts`(형제 파일)이다. 별도로
   `app/admin/trial-onboarding-actions.ts`(관리자 전용)도 존재하니 혼동 주의.
2. `sendRegularContractForSubjectEnrollment`는 `app/` 밑이 아니라
   **`lib/regular-contract-send.ts:23`** 에 있다.
3. 나머지 PRD 서술(계약 게이트, RPC 존재 여부, transcript 미처리 등)은 전부
   현재 코드와 정확히 일치 — 별도 재확인 불필요.

4. **(정정, 최초 조사 오류) "만 13세 이상" 검증은 신규 항목이 아니라 기존
   시스템을 교체하는 항목이다.** 최초 조사에서 "연령 검증이 코드베이스에
   전혀 없다"고 잘못 보고했다 — 실제로는 **2026-08-31에 만든 완결된
   "13세 미만 보호자 동의" 시스템이 이미 운영 중**이며, 다만 지금 PRD가
   요구하는 "13세 미만은 무조건 차단"과는 **반대 방향의 정책**(13세 미만도
   검증된 보호자 동의가 있으면 이용 허용)을 구현하고 있어서 최초 조사가
   "연령 검증"이라는 키워드로 찾지 못했다.

   기존 시스템(`supabase/migrations/20260904000000_r2_minor_consent.sql`,
   R2 Task 6):
   - `is_under_13(student_id)` — `profiles.date_of_birth` 기준 UTC로 만 13세
     여부 판정. DOB 없으면 fail-closed(13세 미만으로 취급).
   - `has_valid_guardian_consent(student_id)` — `guardian_consents` 테이블에
     유효(미철회, 정책 재동의 불필요)한 동의가 있는지.
   - `current_account_access_allowed()` — `current_account_active() AND
     (not is_under_13() OR has_valid_guardian_consent())`. 26개 자기서비스
     RLS 정책이 이 함수로 최종 방어선을 건다.
   - `transition_account_status()` — 학생을 `active`로 전환할 때 13세 미만이면
     유효한 보호자 동의 없이는 전환 자체를 막는다(`20260904000000_...sql:401-403`).
   - `consent_as_guardian()` / `record_manual_guardian_consent()` — 보호자
     본인(household 검증) 또는 관리자(증빙 필수)가 동의를 기록하는 두 경로.
   - `revoke_guardian_consent()` — 동의 철회 시 `privacy_review_tasks` 자동 생성.
   - `set_student_date_of_birth()` — 생년월일은 학생 본인이 못 고치고 보호자/
     관리자만 변경 가능.
   - UI: `app/parent/ConsentTab.tsx` + `app/parent/consent-data.ts`/
     `consent-actions.ts`(보호자가 직접 동의), `app/admin/ConsentGapPanel.tsx` +
     `ConsentGapSection.tsx` + `consultation-data.ts`의 `loadConsentGaps()`(관리자가
     "생년월일 미입력 또는 유효한 동의 없어 막힌 학생" 목록을 보는 "문서 > 동의서"
     탭), `app/admin/consent-actions.ts`(관리자의 수동 동의 기록 action).
   - `e2e/minor-consent.spec.ts`에 골든패스 E2E 존재.

   **이것은 PRD 3번(4번? 문서 §3-E) "미성년 동의·이용약관 체크 게이트"가
   가리키는 바로 그 대상이다** — PRD도 `guardian_consents`,
   `consent_policy_versions`, `ConsentTab`, `consent-pending`을 명시적으로
   언급하고 있으니(§3-E) PRD 자체는 이 시스템의 존재를 전제하고 있었다.
   최초 조사가 "정책이 반대 방향이라 못 찾았다"는 것만 정정하면 되고,
   **PRD의 작업 지시(§3-E, "정상 신규 고객 흐름에서는 별도 보호자 AI 동의를
   차단 조건으로 쓰지 않는다", "기존 동의 테이블은 파기하지 않는다")는 그대로
   유효**하다. 아래 2단계-A를 이 사실에 맞춰 다시 썼다.

## 1. 단계별 실행 순서 (PRD §7 그대로, 각 단계에 구체 파일/함수 매핑)

### 1단계 — 정책·계약 문구 확정 (구현 착수 전 완료해야 함)

- `docs/CURRENT.md`에 "9–12학년·만 13세 이상" 자격 기준의 **학년 판정 시점**
  (신청 시점 학년? 학년도 기준?)과 생년월일 수집·보관 안내 문구를 확정해
  기록해둔다(PRD §9-3).
- `lib/contracts/family-contract-template.ts` 제12조 개정안 초안을 만들어
  법률 검토를 받는다 — 아래 2단계 항목 A 참고.
- **이 단계가 끝나기 전에는 DB 마이그레이션을 작성하지 않는다** (계약 문구가
  transcript 처리를 허용하지 않는 상태에서 transcript on 금지 — PRD 10번).

### 2단계 — DB·서버 게이트 (additive migration)

새 마이그레이션 파일들(각각 새 타임스탬프, `create or replace function` +
`drop trigger if exists` 패턴 — CLAUDE.md 규칙대로 이미 적용된 번호는 고치지
않고 새 번호로 얹는다):

**A. 연령·학년 서버 검증 — 기존 "13세 미만 허용(보호자 동의)" 모델을
   "13세 미만 전면 차단" 모델로 교체 (신규 코드 + 기존 시스템 정리, 둘 다 필요)**

이 항목은 처음에 "완전 신규"로 잘못 정리했었다 — 정정: 기존
`is_under_13`/`has_valid_guardian_consent`/`current_account_access_allowed`/
`transition_account_status`(0-4 참고)가 이미 있고, **방향만 반대**(13세 미만도
동의 있으면 허용 → 이제 13세 미만은 예외 없이 차단)다. 할 일은 두 갈래다.

1. **신규 진입 지점에 하드 차단 추가(진짜 신규 코드)**: 상담 신청, 체험 신청,
   `create_direct_onboarding_link_multi`
   (`supabase/migrations/20261473000000_r_consultant_assignment_from_onboarding.sql:159`,
   현재 생년월일 파라미터 자체가 없어 추가 필요), `complete_student_profile`
   (`supabase/migrations/20261124000000_m5c_final_reconciliation_integrity_gaps.sql:311`,
   생년월일은 이미 필수로 받지만 나이 계산·기준 검사가 없음) 네 곳 모두에서
   생년월일+학년을 받아 `is_under_13()`과 같은 계산 방식(UTC 기준, DOB 없으면
   fail-closed)을 재사용하는 새 헬퍼(`is_eligible_age_and_grade(dob, grade)`
   또는 `is_under_13()` 자체를 재사용)로 **만 13세 미만이면 그 자리에서 즉시
   거절**(상담·체험·계정·계약 전부 생성 안 함). 클라이언트 검증만으로 처리 금지.
2. **기존 "13세 미만+동의 있으면 허용" 경로의 운명 결정(정리 작업)**:
   - `is_under_13`/`has_valid_guardian_consent`/`current_account_access_allowed`/
     `transition_account_status`의 DB 로직 자체는 **삭제하지 않는다** — 1번이
     신규 유입을 원천 차단하면 이 경로는 자연히 도달 불가능해지고, 혹시 이미
     활성화된(과거에 동의받아 active인) 13세 미만 기존 고객이 있다면 이 로직이
     없어지는 순간 오히려 그 계정들의 서비스 접근이 깨진다("기존 고객 데이터·
     접근 유지" 원칙과 충돌). **즉 이 함수들은 그대로 두고 방어선(defense-in-depth)
     으로만 남긴다.**
   - `app/parent/ConsentTab.tsx`, `consent-data.ts`, `consent-actions.ts`(보호자가
     새로 동의를 "기록"하는 UI)는 PRD §3-E 지시대로 **신규 고객 흐름에서 제거**한다.
     단, 이미 13세 미만 상태로 활성 이용 중인 기존 가구가 있다면 그 가구의 동의
     철회·재확인 UI가 완전히 사라지는 게 맞는지 제품 결정 필요(운영상 아예 없는
     케이스면 통째로 제거, 있다면 관리자 전용 화면으로 이관 검토).
   - `app/admin/ConsentGapPanel.tsx`/`ConsentGapSection.tsx`/
     `consultation-data.ts`의 `loadConsentGaps()`(만 13세 미만·동의 없어 막힌
     기존 학생을 보여주는 관리자 뷰)는 **신규 유입 차단 이후에는 이론상 0건이
     계속 나와야 정상**이다 — 즉시 삭제하기보다는 "레거시 확인용" 이라는
     문구를 붙여 남겨두고, 실제로 몇 마일스톤 지나 0건이 유지되면 그때
     제거하는 편이 안전(PRD "기존 감사 데이터 보존" 원칙과 일치).
   - `app/admin/consent-actions.ts`(`record_manual_guardian_consent()` 호출,
     관리자의 수동 동의 기록)는 신규 고객에게는 이제 쓸 일이 없어야 정상이지만,
     함수 자체는 감사·예외처리용으로 유지.
   - `e2e/minor-consent.spec.ts`는 "기존 시스템이 여전히 정상 동작"을 검증하는
     회귀 테스트로 남긴다(삭제하지 않음) — 새로 추가하는 "13세 미만 신규 유입
     차단" 테스트는 별도 스펙으로 추가.
3. **배포 전 결정 필요(신규 항목)**: 실제 운영 데이터에 13세 미만으로 이미
   active인 학생이 몇 명이나 있는지 non-prod/운영 DB에서 먼저 확인해야
   위 2번의 세부 처리(제거 vs 유지)를 확정할 수 있다 — 착수 시 가장 먼저
   할 조사.

**B. `confirm_lesson_booking` 수정**
- 최신 정의: `supabase/migrations/20261125000000_m5d_session_completion_integrity.sql:182-268`.
- 현재 `smart_notes_status`를 무조건 `'pending'`으로 삽입(line 241-248) —
  `lesson_types.code = 'trial'`이면 `'not_applicable'`로 분기하도록 새
  마이그레이션에서 `create or replace function`.

**C. Trial entitlement RPC에서 동의 확인 제거**
- `grant_trial_entitlement_for_consultation`
  (`supabase/migrations/20261265000000_m4_drop_dob_verification_gate_from_trial_grant.sql:11-85`,
  동의 체크는 line 32-34) — 해당 `if not exists (... trial_smart_notes_consents ...)` 블록 삭제.
- `grant_trial_entitlement_for_student`(같은 파일 line 88-139, 체크는 103-105) — 동일 처리.
- `trial_smart_notes_consents` 테이블/`record_trial_smart_notes_consent` 함수(
  `supabase/migrations/20261272000000_p0_direct_creation_consent_entitlement_fix.sql:272-370`)는
  **삭제하지 않는다** — 신규 흐름에서 호출만 안 하면 됨(과거 데이터 보존).

**D. 직접 계정 생성의 `awaiting_consent` 제거**
- `awaiting_consent` 설정 위치: `20261272000000_...sql:143,241`,
  `20261280000000_m4_trial_onboarding_claim_ownership_and_orphan_recovery.sql:260`.
- 계정·학생 연결 확정 직후 바로 entitlement 발급 가능 상태로 변경(새 마이그레이션).

**E. `contract_dispatch_jobs` outbox 테이블 신설**
- PRD §5 스키마 그대로: `id`, `subject_enrollment_id`, `trigger_type`
  (`completed_trial` | `direct_account_created`), `status`
  (`queued`/`processing`/`sent`/`retryable_failed`/`permanent_failed`),
  `attempt_count`, `last_error`, `sent_at`.
- **유니크 키 결정 필요**: 계약이 `contracts.child_id` 단위로 이미 1인당
  1개만 존재(`get_or_create_draft_contract_for_child`,
  `20261017000000_m4_admin_function_auth_fix.sql:87-112`가 `child_id`로 기존
  draft/active 계약을 재사용) — 따라서 outbox 유니크 키는
  **`(child_id, trigger_type)`으로 고정** (PRD §9-2 결정: 자녀당 하나, 이미
  기존 계약 모델이 그렇게 되어 있으므로 별도 선택지 없음, 이 문서로 확정).
  `subject_enrollment_id`는 참고 컬럼으로만 둔다.

**F. session_transcripts (또는 session_ai_artifacts) 테이블 신설**
- PRD §6 필드 그대로: `session_id`, `artifact_type`, `drive_file_id`,
  `source_resource_name`, `status`, `generated_at`, `retention_delete_at`,
  `created_at`. 세션+종류 유니크 키.
- 이 단계에서는 테이블만 만들고 실제 이벤트 파싱은 5단계에서.

### 3단계 — 첫 상담·체험 AI 비활성화 (코드, additive migration 이후)

- `lib/consultation/calendar-sync.ts`의 `processOneConsultation()`(180-275)에서
  4개 동작 중 3개 제거:
  - `issueConsentUrl()` 호출(197) 및 캘린더 설명 삽입(204-207) 제거
  - `sendStandaloneConsentRequestEmail()` 호출(223) 제거
  - `applySmartNotesBestEffort()` 호출(261) 제거
  - `ensureSubscriptionForOrganizer(..., "consult_organizer")`(268) 제거
- `app/admin/consultation-scheduling-actions.ts`:
  - `computeConsultReadiness()`(78-87) line 84의 `consent_confirmed_at` 체크 제거
  - `computeCompletionReadiness()`(89-104) line 101의 동일 체크 제거
  - `admin_record_consultation_outcome()` RPC도 같은 4조건을 서버에서
    재검사하므로 **이 RPC의 최신 SQL 정의를 먼저 확인**한 뒤 동일하게 수정
    (2단계 그룹 마이그레이션에 포함 권장).
- `app/consult/trial-onboarding/page.tsx`, `TrialConsentButton.tsx`,
  `app/consult/trial-onboarding-actions.ts`(경로 수정 반영) — 신규 흐름
  진입점에서 라우트/컴포넌트 제거 또는 조건부 숨김.
- `app/parent/ConsentTab.tsx`, `app/parent/consent-data.ts`,
  `app/parent/consent-actions.ts` — 신규 고객 흐름 탭에서 제거(과거 데이터
  조회용 어드민 화면은 유지 검토).
- `app/parent/TrialConversionPanel.tsx`, `app/parent/trial-conversion-actions.ts`
  의 `confirmRegularProgressIntent`/`hasConfirmedRegularProgressIntent`(70-103) —
  "정규 진행 희망" 버튼·탭 제거. `tryAutoSendRegularContract()`(95-100) 호출
  경로는 4단계의 outbox 방식으로 대체되므로 이 함수 자체는 삭제 또는 outbox
  enqueue로 교체.
- `lib/booking/calendar-sync.ts`의 `applySmartNotesConfigBestEffort()`(84-115,
  호출부 190)와 `ensureSubscriptionForOrganizer(...)`(195) — 현재 예약
  타입 구분 없이 무조건 호출됨. 예약 조회 쿼리(153-157)에 `lesson_type_id`
  추가해서 정규 수업일 때만 두 호출 실행하도록 분기.

### 4단계 — 자동 계약 발송 (outbox 워커)

- `finalize_lesson_session`(또는 그 호출부 server action)이 성공 후,
  체험 타입 + `sessions.final_status = 'completed'`이면
  `contract_dispatch_jobs`에 `(child_id, 'completed_trial')` upsert.
  **DB 트리거 안에서 DocuSign 호출 금지**(PRD 10번) — 반드시 애플리케이션
  레이어에서 enqueue.
- 직접 계정 생성 완료 서버 action에서 `(child_id, 'direct_account_created')` upsert.
- 워커(cron 또는 관리자 재시도 action)가 큐를 가져와 기존
  `sendRegularContractForSubjectEnrollment`(`lib/regular-contract-send.ts:23`)를
  호출 — 이 함수의 기존 idempotency(내부적으로
  `get_or_create_draft_contract_for_child` + `contract_versions`의
  `docusign_envelope_id` 존재 확인, check-then-act)를 그대로 활용.
  **주의**: 이 idempotency는 DB 유니크 제약이 아니라 애플리케이션 체크라서
  동시 실행 레이스 가능성이 있음 — outbox 작업 자체를 `processing` 상태로
  잠그는 방식(예: `select ... for update skip locked`)으로 워커 동시 실행을
  막는 걸 권장.
- 관리자 화면에 큐 상태(대기/처리중/송부됨/실패)와 재시도 버튼 추가.

### 5단계 — 정규 수업 AI 기록 (Smart Notes + transcript)

- 계약 서명 후 정규 수업에만 Smart Notes/transcript 활성화하는 조건 분기 추가
  (계약 상태 조회 필요 — `contracts.status`/`contract_versions` 서명 완료 여부).
- `lib/google-workspace-events.ts`의 `parseWorkspaceEventPayload()`에
  transcript 이벤트 분기(`ceType.includes("transcript")`) 신규 추가,
  `ParsedWorkspaceEvent` 유니온 타입에 `ParsedTranscriptEvent` 추가.
- `app/api/webhooks/workspace-events/route.ts`에 transcript 이벤트 처리
  분기 추가 — Drive 파일 ID 해석 후 `session_transcripts`(2단계에서 만든 테이블)에
  upsert.
- **sandbox Workspace에서 transcript 기능이 API로 실제 켜지는지 먼저 검증**
  — 안 되면 이 단계는 "수동 설정 필요" 경고 UI로 축소해야 한다(PRD §9-4,
  §10 — 실증 전 완료 보고 금지).
- 보존 배치(retention job)에 transcript 행/Drive 파일 삭제 추가.

### 6단계 — UI 정리 + 7단계 — 보존 배치 확장

PRD §7 그대로. 3~5단계 완료 후 마지막에 진행.

## 2. 배포 전 반드시 결정해야 할 것 (PRD §9, 코드 조사로 일부 이미 확정됨)

1. **계약 envelope 단위: 자녀당 1개로 이미 고정되어 있음** (코드 조사로 확인 —
   선택의 여지 없이 기존 모델을 그대로 따름). outbox 유니크 키도 동일하게
   `(child_id, trigger_type)`.
2. 전사 전문을 학생·학부모에게 그대로 줄지 — **아직 미정, 착수 전 결정 필요**.
3. "9–12학년" 판정 시점 — **아직 미정**.
4. Google Meet transcript API 실제 제어 가능 여부 — **아직 미검증**, 5단계
   착수 직전 sandbox에서 먼저 확인.
5. **(신규) 기존 13세 미만 보호자 동의 시스템 처리** — non-prod/운영 DB에
   현재 13세 미만으로 `active`인 학생이 실제로 있는지 먼저 확인. 0명이면
   `ConsentTab`/`ConsentGapPanel` 등 UI를 바로 제거해도 안전하고, 1명이라도
   있으면 그 가구를 어떻게 처리할지(계속 서비스 제공? 개별 안내 후 종료?)
   제품·법률 결정이 먼저 필요하다 — 착수 시 가장 먼저 할 조사(2단계-A-3 참고).

## 3. 테스트 계획 (PRD §8 요약, 실행 시 그대로 따름)

- 자동 테스트: 연령 경계값(만 12세 364일/13세/9학년), 상담·체험 무동의
  발급, 체험 완료 1회만 계약 발송(중복 이벤트/재시도 포함), 취소·노쇼 미발송,
  직접 생성 자동 발송, 계약 미서명 정규 수업 AI 기록 없음, 서명 후 정규
  수업 Smart Notes+transcript 각 1건.
- non-prod UAT: PRD §8 6개 시나리오 그대로 — 실행 ID 붙여서 진행,
  종료 후 정리.

## 4. 하지 않을 것 (PRD §10, 재확인)

- DB 트리거에서 DocuSign/이메일/Google API 직접 호출 금지.
- 체험/상담 AI 기록을 만들고 UI만 숨기는 방식 금지.
- 기존 동의·감사 데이터 삭제 금지.
- 클라이언트 전용 연령 검증 금지.
- 계약 문구가 transcript를 허용하기 전 transcript 기능 on 금지.
- **이번 세션에서는 이 문서만 작성 — 마이그레이션 작성, 코드 수정, 배포
  전부 하지 않았음.**
