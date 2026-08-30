# Gate B — 마이그레이션 매핑·권한 설계

- 상태: **승인 완료(2026-08-29, v5)** — 대상: 마이그레이션 매핑·RLS·서버 capability·검증·롤백 설계(6절 전체). 대화방 정책은 `product-architecture-v3.md` §4.11 유지로 확정: 이전 선생님은 자신이 담당했던 archived 대화방을 읽기 전용으로 계속 조회 가능하나, 이전·신규 선생님은 서로의 대화방을 조회할 수 없다.
- 기준 문서: `product-architecture-v3.md`, `r0-approval-and-technical-validation-package.md`(6절), `developer-handoff-v3.md`
- 작성 범위: 코드 변경 없음. 설계·DDL 초안·검증 계획만 제출.
- 이 문서가 다루지 않는 것: 화면 구현, R1 이후 실제 마이그레이션 실행
- 개정 이력 v2: opening entitlement 미이관, 시급 이력 소급 미적용, session_files 최종 보관처 정정, entitlement 이벤트 중복방지 단위 변경, 예약↔세션 순환 FK 제거, 보충시간 원장 분리, `subject_threads` 서버 전용 생성, 시급 이력 컬럼 명시, 결제/환불/가격버전/Drive artifact 연결 보강, review-actions 보안 결론 확정, "프로덕션"→"원격 개발 DB" 통일
- 개정 이력 v3: 결제·환불 상태값을 R0 §4.11과 정확히 통일(§3.12), 상품 구조를 `lesson_types`/`entitlement_types`/`entitlement_products`/`price_versions`/`purchases`/`payment_attempts`/`refund_requests` 7개로 분리하고 구매 스냅샷·구매당 다중 결제시도 반영(§3.12), entitlement ledger에 `refund`/`transfer` 이벤트 추가 + `hold_entitlement()` 등 행잠금 기반 동시성 제어 함수 명시(§3.6), 보충시간 `expired` 이벤트 제거·발생사유를 지각/부분중단/회사·Meet 중단으로 수정·적용을 잠금 함수로 명시(§3.7), 세션 재개방이 동일 session_id를 유지하고 `session_status_events`로 기록하도록 수정(§3.5), `teacher_assignments`에 기간 겹침 exclusion constraint 추가(§3.3), 과목 대화방 정체성을 subject_enrollment 기준 자동 생성으로 변경(§5.3, §9-5에 Gate A 정합성 확인 필요 표기)
- 개정 이력 v4: **과목 대화방 설계를 teacher_assignment 기준으로 원복**(v2 제안 철회, `product-architecture-v3.md` §4.11 변경 없이 유지, §3.14/§5.3/§9-5), entitlement 잔액 계산에서 `original_quantity + sum(ledger.amount)`의 이중 계산 버그 수정 — 잔액은 `sum(ledger.amount)`만으로 계산(§3.6), `hold_entitlement()`가 `now()`가 아니라 예약의 수업 시작 시각과 만료일을 비교하도록 수정(§3.6), `external_event_receipts`에 `status`/`attempt_count`/처리 lease를 추가해 실패·정체 이벤트 재처리를 지원(§3.13), 모든 SECURITY DEFINER 함수에 PUBLIC/anon revoke 규칙 명시(§5.1), `drive_artifacts`에 `subject_enrollment_id`(6택1) 추가로 과목·연도 폴더도 DB 관계로 추적(§3.10), `payment_attempts`에 purchase당 `succeeded` 최대 1건 부분 unique index 추가(§3.12)
- 개정 이력 v5(이번, 승인 처리): `manual_review`는 자동 재처리 대상이 아니고 관리자 명시 승인 후에만 재처리하도록 §3.13 문구 정정, §7.4 외부 이벤트 중복방지 테스트를 "succeeded 재수신(즉시 종료)"과 "retryable_failed/lease 만료 processing 재수신(정상 재처리)" 2건으로 분리. **문서 상태를 승인 완료로 변경.**

---

## 0. 실제 데이터 규모 확인

원격 개발 DB 실측(2026-08-29): `enrollments` 1건, `sessions` 0건, `students` 1명, `teachers` 2명, `credit_balance` 합계 2, `credit_transactions` 1건(`adjustment`), `makeup_credits`/`teacher_payouts` 0건 — 전부 이번 세션의 수동 테스트로 생긴 데이터다. 즉 실질적으로 **마이그레이션할 실사용 데이터가 없다.** 아직 서비스 오픈 전이라 이 환경은 "프로덕션"이 아니라 원격 개발 DB로 지칭한다. §9에서 이 데이터를 이관 대상에서 제외하기로 확정했다.

## 1. 현재 구조 인벤토리

### 1.1 현재 테이블·enum (전체, `supabase/migrations/`)

**enum**: `profile_role`, `intake_type`, `student_status`, `teacher_status`, `guardian_relation`, `consult_category`, `consult_status`, `contract_status`, `enrollment_status`, `session_status`, `problem_format`, `problem_difficulty`, `problem_status`, `review_category`, `doc_owner_type`, `doc_status`, `teacher_student_role`, `author_role`, `teacher_pick_reason`(배열로 변경됨), `parent_request_status`, `credit_tx_type`, `payout_status`, `company_doc_category`

**테이블 (30개, 그룹별)**

| 그룹 | 테이블 |
|---|---|
| 사용자 | `profiles`, `students`, `parents`, `guardian_students`, `teachers` |
| 상담 | `consult_requests`, `consult_attachments` |
| 계약 | `contracts`, `teacher_contracts` |
| 커리큘럼 | `subjects`, `subject_template_units`, `teacher_curriculum_templates`, `teacher_curriculum_template_units` |
| 매칭 | `enrollments` |
| 교재 | `curriculum_docs`, `curriculum_doc_sections`, `curriculum_doc_adoptions`, `curriculum_doc_versions`, `subject_template_unit_materials`, `teacher_curriculum_template_unit_materials` |
| 세션 | `sessions`, `session_memos`, `makeup_credits`, `teacher_qc_warnings` |
| 세션뷰 | `problems`, `homework_items`, `session_problem_attempts`, `teacher_problem_tags`, `vocab_words`, `session_doc_links`, `session_files`, `canvas_annotations` |
| 리뷰 | `session_reviews`, `session_review_categories`, `session_review_revisions`, `session_student_feedback` |
| 메시지/알림 | `chat_threads`, `chat_messages`, `parent_requests`, `notifications` |
| 결제 | `credit_packages`, `credit_purchases`, `credit_transactions`, `payment_methods` |
| 정산 | `teacher_payouts` |
| 관리자 | `company_documents` |

핵심 제약: `enrollments_active_unique`(student, teacher, subject 조합당 활성 1개), `sessions`의 `(enrollment_id, session_number)` unique, `session_reviews`/`session_student_feedback`의 `session_id` unique(리뷰·피드백 1세션 1개).

### 1.2 현재 RLS 요약

- 헬퍼 함수: `is_admin()`, `is_guardian_of()`, `teaches_student()`, `is_session_participant/related()`, `is_enrollment_participant/related()` — 전부 `enrollments.teacher_id`(현재 관계)를 직접 참조한다.
- 패턴: `학생 본인 or 담당 선생님(teaches_student) or 보호자(is_guardian_of) or 관리자(is_admin)`.
- 서버 액션은 대부분 요청자 세션의 Supabase 클라이언트로 RLS를 통과시키지만, **12개 파일이 `createAdminClient()`(service-role)를 사용**한다(§1.4).

### 1.3 서버 액션 인벤토리 (26개 파일, `"use server"`)

| 파일 | 액션 | 비고 |
|---|---|---|
| `admin/contracts-actions.ts` | `sendFamilyContract` | DocuSign 발송, service-role |
| `admin/curriculum-doc-actions.ts` | `createCurriculumDoc`~`deleteCurriculumDoc`(12개) | 교재 CRUD, AI 문제 생성 |
| `admin/matching-actions.ts` | `confirmMatch` | enrollment insert |
| `admin/payouts-actions.ts`, `payouts-cron.ts` | `generatePayouts`, `markPayoutPaid(Bulk)`, `revertPayoutToPending`, `runGeneratePayouts`, `generatePayoutsAsCron` | service-role, cron 별도 |
| `admin/subject-actions.ts` | 과목/단원 CRUD(7개) | |
| `admin/teacher-subjects-actions.ts` | `assignTeacherSubject`, `unassignTeacherSubject` | |
| `admin/users-actions.ts` | 초대·상태변경·크레딧조정(8개) | service-role(Auth invite) |
| `consult-actions.ts` | `submitConsultRequest` | 익명 접근 |
| `login/actions.ts`, `reset-password/actions.ts` | 인증 | |
| `parent/credits-actions.ts` | `createCreditCheckoutSession` | Stripe |
| `session/[id]/actions.ts` | MC/서술형/수학 제출(3개) | |
| `session/[id]/aigen-actions.ts` | `generateProblems`, `finalizeProblemsToHomework` | |
| `session/[id]/canvas-actions.ts` | `saveCanvasStrokes` | **전체 jsonb 덮어쓰기** |
| `session/[id]/homework-actions.ts` | 과제 저장/추가 | |
| `session/[id]/problemlog-actions.ts` | 저장토글·재시도·픽(6개) | |
| `session/[id]/scratchpad-actions.ts` | 문서링크·화이트보드(3개) | **화이트보드도 전체 jsonb 덮어쓰기** |
| `session/[id]/vocab-actions.ts` | 단어 추가/삭제 | |
| `student/chat-actions.ts`, `credits-actions.ts`, `memo-actions.ts`, `review-actions.ts` | | |
| `teacher/mysubjects-actions.ts` | 내 과목 템플릿 CRUD(5개) | |
| `teacher/onboarding-actions.ts` | `submitCalendlyOnboarding` | v3에서 폐기 대상 |
| `teacher/review/[sessionId]/review-actions.ts` | `generateReviewDraft`, `submitReview` | AI 초안, 현재는 자유 생성(Gemini 아님) |
| `api/webhooks/{calendly,docusign,stripe}/route.ts` | 웹훅 | Calendly는 폐기 대상 |

### 1.4 service-role(`createAdminClient`) 사용처와 우회 여부

| 파일 | 우회 내용 | v3 위반 여부 |
|---|---|---|
| `admin/contracts-actions.ts` | DocuSign 발송 시 계약 insert | 호출부에 `requireAdmin()` 있음 — 안전 |
| `admin/payouts-actions.ts`/`payouts-cron.ts` | 정산 계산/승인 | UI 경로는 `requireAdmin()`, cron 경로는 `CRON_SECRET` 검사(082 세션에서 이미 발견·수정한 이력) — 안전 |
| `admin/users-actions.ts` | Auth invite, 상태변경 | `requireAdmin()` 있음 — 안전 |
| `app/api/webhooks/*` | 웹훅 본문으로 직접 DB 갱신 | **서명 검증 실패 시에도 로컬 개발에서 signingKey 미설정이면 통과되는 구조**(Calendly) — v3에서는 웹훅 자체를 재설계하며 해소 |
| `app/consult-actions.ts` | 익명 상담 신청 insert | 익명 접근이 설계 의도 — 안전, 단 rate limiting 없음(§9에 후속 배치) |
| `app/teacher/review/[sessionId]/review-actions.ts` | 보호자 이메일 발송 시 `guardian_students` 조회 + Auth 사용자 조회(`notifyGuardiansOfReview`) | 점검 완료(이번 개정) — `generateReviewDraft`/`submitReview` 모두 진입부에서 `requireSessionTeacher(sessionId)`를 호출하고, 이 함수는 관리자이거나 `enrollments.teacher_id === auth.uid()`인 경우만 통과시킨다. `notifyGuardiansOfReview`의 `createAdminClient()` 호출은 `submitReview` 내부에서 그 가드를 통과한 뒤에만 실행되므로 우회 경로 없음 — **안전** |

결론: 코드 인벤토리에 있는 6개 service-role 호출부 전부 확인 완료, **심각한 서비스키 우회 취약점 없음**. 이전 초안에서 "확인 필요"로 남겨뒀던 `review-actions.ts`도 이번 개정에서 실제 코드를 읽어 안전함을 확인했다. R2~R7에서 신규 service-role 호출부가 추가될 때도 동일하게 진입부 `requireX()` 가드 여부를 확인하고 이 표에 추가한다.

---

## 2. 필드 매핑표 — 현재 테이블 → v3 개체

| 현재 | v3 | 매핑 방식 |
|---|---|---|
| `students` + `guardian_students` + `parents` | `households`, `guardians`, `children`(student 개명) | `parents`→`guardians`, `students`→`children`, `guardian_students`→`household_members`. `parents.id`를 household의 첫 guardian으로 백필, household 1개당 기존 `guardian_students` 그룹 재구성 |
| `contracts` | `contracts`(child별, evergreen) | 컬럼 확장(§3.1). `parent_id`는 `household_id`로 대체(다수 guardian 지원) |
| `enrollments` | `subject_enrollments` + `teacher_assignments` | **분리**. `enrollments.id`→`subject_enrollments.id`(신규 uuid), `(student_id, subject_id, status)`→`subject_enrollments`, `(teacher_id, created_at~cancelled_at)`→`teacher_assignments` 첫 행(effective_from=created_at, effective_until=cancelled_at, source='migration') |
| `sessions` | `reservations` + `sessions`(분리) | `scheduled_at`→`reservations.starts_at`, `duration_minutes`→`reservations`가 아니라 `sessions.scheduled_duration_minutes`(스냅샷). `status`(upcoming/completed/cancelled/no_show)→`reservations.status`(홀딩~취소)와 `sessions.final_status`(scheduled/live/completed/예외 6종)로 분해 — 기존 `cancelled`/`no_show`는 사유 불명확이라 **수동 검토 대상**(§9) |
| `sessions.enrollment_id`(선생님 역조회 경로) | `sessions.teacher_id`, `sessions.hourly_rate_snapshot` 직접 컬럼 | 백필 시 현재 `enrollments.teacher_id`와 당시 `teachers.hourly_rate_krw`를 스냅샷 (단, 시급 이력이 없어 "당시" 값을 알 수 없음 — §9) |
| `students.credit_balance` | `entitlement_grants` + `entitlement_ledger` | **(개정, §9-2)** 이관하지 않음 — 테스트 데이터로 확정, 백업 후 폐기. 신규 테이블은 빈 상태로 시작 |
| `credit_purchases`, `credit_transactions` | `entitlement_grants`(구매 기원), `entitlement_ledger`(전체 이력) | **(개정, §9-2)** 이관하지 않음 — 실제 존재하는 `adjustment` 1건도 테스트 데이터라 백업 후 폐기, 변환 로직 자체가 불필요해짐 |
| `teacher_payouts` | `payout_items` + `payout_batches` | **(개정, §9-3)** 원격 개발 DB에 0건이므로 백필 없이 빈 테이블로 시작 |
| `makeup_credits`(count 정수) | `makeup_obligations` + `makeup_events`(§3.7, 분 단위) | **(개정, §9-3)** 원격 개발 DB에 0건이므로 환산 로직 없이 빈 테이블로 시작 |
| `canvas_annotations.strokes`(jsonb 전체), `sessions.whiteboard_strokes`(jsonb 전체) | `annotation_events`(append) + 주기적 snapshot | 기존 최종 상태를 1개의 초기 snapshot으로 변환, 이벤트 이력은 유실(레거시 데이터 특성상 허용) |
| `session_reviews` + `session_review_categories` | `session_reviews`(status 필드 확장) | `submitted_at` 유무로 `published`/`teacher_reviewing` 역산. `ai_draft_text`가 있으면 `source='manual_draft'`로 표시(현재는 Gemini 없음) |
| `session_doc_links`(external_url) | `session_docs`(provider, provider_file_id) | 기존 링크는 `provider='external_legacy'`로 표시, 신규는 `provider='google_docs'` |
| `company_documents`(storage_path) | `company_documents`(drive_file_id 추가, storage_path는 legacy) | `storage_provider` 컬럼 추가, 기존 행은 `'supabase'`로 표시 |
| `teachers.calendly_scheduling_url` | (삭제 대상, 호환 컬럼으로 유지 후 제거) | v3에서 예약은 Calendar 기반이라 미사용 |
| `session_files` | `session_files`(임시 업로드·캐시 전용, Supabase Storage) + `drive_artifacts`(확정본, Google Drive) | **수정(개정)**: CLAUDE.md 기술 스택 정책상 확정 수업자료는 회사 소유 Google Shared Drive에만 최종 보관하고 Supabase는 실시간·임시 Storage 역할만 한다. `session_files`는 세션 중 업로드 직후~확정 전까지의 캐시로 유지(TTL 예: 확정 후 7일 또는 즉시 삭제), 선생님이 "과제로 확정"하거나 세션이 `completed`로 전이되는 시점에 서버가 파일을 Drive로 업로드해 `drive_artifacts(session_id=...)` 행을 생성한다. 확정 후 `session_files` 원본은 삭제하거나 캐시로만 남기고 조회는 `drive_artifacts` 경유로 전환 |
| `chat_threads`(student_id, teacher_id 1:1) | `subject_threads`(**개정 v4: `subject_enrollment_id` + `teacher_assignment_id` 기준, product-architecture-v3.md §4.11과 동일 정책으로 원복**) | **구조 변경**: 현재는 학생-선생님 DM 모델, v3는 과목 대화방(보호자 포함) — 신규 테이블, 기존 스레드는 읽기 전용 아카이브로 이관. 스레드는 `teacher_assignment`당 1개이며, 선생님 배정이 `active`가 될 때 시스템이 자동 생성하고 배정이 `ended`가 되면 즉시 `archived`(읽기 전용)로 전환, 새 배정에 새 스레드가 자동 생성된다(§5.3) |

---

## 3. FK·불변 규칙 (v3 신규 테이블)

### 3.1 계약(`contracts`)

- FK: `household_id → households`, `child_id → children`
- 불변: 한 child에 동시에 `active` 계약은 1개(부분 unique index, `superseded`/`terminated`/`void` 제외)
- 가격·정책 스냅샷은 `contract_versions`(계약 1:N)에 보존, `contracts` 자체는 현재 상태만

### 3.2 과목 수강(`subject_enrollments`)

- FK: `child_id → children`, `subject_id → subjects`, `contract_id → contracts`
- 불변: `(child_id, subject_id)`에 동시 `active`/`paused` 1개(부분 unique index) — 기존 `enrollments_active_unique`와 동일 사상이나 teacher 제외

### 3.3 선생님 배정(`teacher_assignments`)

- FK: `subject_enrollment_id → subject_enrollments`, `teacher_id → teachers`
- 컬럼: `status`(`planned`/`active`/`ended`), `effective_from`, `effective_until`(nullable = 무기한)
- **수정(개정)**: "`subject_enrollment_id`당 동시 `active` 1개"라는 부분 unique index만으로는 부족하다 — `planned`으로 미리 등록해둔 미래 배정끼리, 또는 `planned`과 `active`가 기간상 겹치는 경우를 막지 못한다. 대신 **exclusion constraint**로 기간 자체의 겹침을 막는다.
  ```sql
  alter table teacher_assignments add constraint teacher_assignments_no_overlap
    exclude using gist (
      subject_enrollment_id with =,
      tstzrange(effective_from, coalesce(effective_until, 'infinity'::timestamptz)) with &&
    ) where (status in ('planned', 'active'));
  ```
  이 제약 하나로 "동시 active 1개"와 "planned끼리 겹침 금지"가 동시에 보장된다(겹치는 범위는 상태 무관하게 insert 자체가 거부됨). `ended`는 제외 대상이라 과거 이력은 자유롭게 남는다.
- 변경 시: 기존 행 `status='ended'`, `effective_until=now()` + 새 행 insert(같은 트랜잭션), 과거 행 update 금지(트리거로 차단 검토)

### 3.4 예약(`reservations`)

- FK: `kind = 'consult'`일 때만 `consult_request_id` 필수(check constraint), `kind = 'lesson'`일 때는 `subject_enrollment_id` + `teacher_id`만 필수. **`reservations`는 `sessions`를 참조하지 않는다**(순환 FK 제거, §3.5 참고) — 예약이 먼저 만들어지고, 예약이 `confirmed`로 전이된 뒤에야 `sessions` 행이 생성되어 `reservation_id`로 역참조하는 단방향 구조
- 불변: `owner_profile_id`(선생님/상담담당)별 `starts_at`~`ends_at` 겹침 금지 — **exclusion constraint**(`EXCLUDE USING gist`, `tstzrange` + `owner_profile_id`, `status IN ('holding','confirmed')`만 대상)
- `google_event_id` unique, `idempotency_key` unique

### 3.5 수업(`sessions`, 재정의)

- FK: `reservation_id → reservations`(1:1, **단방향** — `reservations`에는 `session_id` 컬럼을 두지 않는다), `subject_enrollment_id`, `teacher_id`, `material_version_id`
- **수정(개정)**: 재개방 시 **동일 `session_id`를 그대로 유지**하고 새 `sessions` 행을 만들지 않는다(v1 초안의 `reopened_from_session_id`는 "새 세션을 만들어 원본을 가리킨다"는 오해를 부를 수 있어 폐기). 대신:
  - `final_status`가 `completed`/예외 6종 중 하나로 확정된 뒤의 모든 상태 변경은 `session_status_events`(§3.5.1, 신규)에 감사 행을 추가하는 방식으로만 이뤄진다 — 트리거가 `sessions` 테이블에 대한 직접 UPDATE를 막고, 관리자 전용 함수 `reopen_session()`/`recomplete_session()`만 예외적으로 `sessions.final_status`를 갱신할 수 있게 허용(둘 다 같은 트랜잭션에서 `session_status_events` insert 필수)
  - 재개방 중 발생하는 정산·수업권 정정은 기존 `payout_items`/`entitlement_ledger`의 `adjustment`/`refund`/`adjust` 이벤트로 처리하고, 원본 `payout_item`/`ledger` 행은 그대로 둔다(원본 UPDATE 금지 원칙과 일관)

#### 3.5.1 세션 상태 이력(`session_status_events`, 신규)

- 컬럼: `id`, `session_id → sessions`, `event_type`(`completed`/`reopened`/`recompleted`/예외 6종과 동일한 값), `previous_final_status`, `new_final_status`, `actor_profile_id`, `reason`, `occurred_at`
- 불변: INSERT-only(트리거로 UPDATE/DELETE 차단). `reopened` 이벤트는 관리자만 생성 가능(RLS insert 정책이 `is_admin()`만 허용)
- `reopen_session(session_id, reason)`: 관리자 전용, `sessions.final_status`를 재검토 가능한 상태로 되돌리고 `event_type='reopened'` 행을 같은 트랜잭션에 insert
- `recomplete_session(session_id, new_final_status, reason)`: 재검토 후 다시 확정, `event_type='recompleted'` 행 insert + 필요한 `entitlement_ledger`/`payout_items` 보정 이벤트를 같은 트랜잭션에서 처리

### 3.6 수업권(`entitlement_grants`/`holds`/`ledger`)

- FK: `grant_id → entitlement_grants`, `hold_id`는 정확히 1개 `reservation_id` 참조(unique). `entitlement_grants.purchase_id → purchases`(§3.12, nullable — 관리자 수동 지급·프로모션은 null)로 "이 grant가 어느 구매에서 나왔는지" 추적, 구매 시점 가격은 `purchases`의 스냅샷 컬럼을 그대로 참조하고 `entitlement_grants`에 별도 가격 컬럼을 두지 않는다
- **수정(개정 v4, 이중 계산 버그 수정)**: `entitlement_grants.original_quantity`(최초 부여 수량)는 **감사·표시용 스냅샷일 뿐 잔액 계산에 다시 더하지 않는다.** grant 생성 시 반드시 같은 트랜잭션에서 `entitlement_ledger`에 `event_type='grant', amount=+original_quantity` 행을 함께 insert하고, **잔액은 오직 `sum(entitlement_ledger.amount)`만으로 계산**한다(`quantity + sum(amount)`처럼 원본 컬럼을 다시 더하면 최초 수량이 두 번 반영되는 버그가 생긴다 — v3 초안에 있던 실수였다).
- **수정(개정)**: 20회권처럼 한 `grant`에서 여러 예약이 각각 hold→consume/refund 이벤트를 반복 발생시키므로, "grant당 event_type 최대 1건" 제약은 삭제한다. 대신 이벤트가 어떤 업무 단위에 귀속되는지로 중복만 방지한다.
  - `hold`/`consume`/`release` 이벤트: `reservation_id`가 필수(not null) — 부분 unique index `(reservation_id, event_type)` (한 예약이 같은 이벤트 타입을 두 번 만들 수 없음, 예: 같은 예약을 두 번 `consume`할 수 없음)
  - `grant`/`adjust`/`expire`/`refund`/`transfer` 이벤트(예약과 무관, 예: 관리자 수동 조정, 미사용분 환불, 자녀 간 이전): `reservation_id`는 null, 대신 `business_event_id`(text, 호출측이 생성하는 idempotency 키) 필수 — 부분 unique index `(grant_id, event_type, business_event_id)`
  - `ledger` 행은 INSERT-only(트리거로 UPDATE/DELETE 차단), 잔액은 항상 `ledger` 합산으로 파생(§3.7과 동일 원칙)
- **event_type 목록 수정(개정, R0 §4.8과 정확히 일치)**: `grant`/`hold`/`release`/`consume`/`expire`/`refund`/`transfer`/`adjust` — v1 초안에서 `refund`/`transfer`가 누락돼 있었다.
  - **부호 있는 델타(`amount`) 규약(개정 v4)**: 잔여량은 오직 `sum(entitlement_ledger.amount)`(부호 있는 정수)로만 계산한다 — `grant = +N`(최초 부여 시 `original_quantity`만큼 1회, 이후 top-up 시 추가로), `hold = -N`(가용량 차감), `release = +N`(hold 취소, 가용량 복원), **`consume = 0`(잔여량에 추가로 영향 없음 — 이미 그 예약의 `hold`가 차감을 반영했으므로 소진은 감사·상태 표시 목적일 뿐)**, `expire = -N`(잔여 미사용분 소진), `refund = -N`, `transfer = -N`(출발) / `+N`(도착, 별도 grant), `adjust = ±N`. `entitlement_grants.original_quantity`는 이 식에 다시 더하지 않는다.
  - `refund`: 환불 승인(§3.12 `refund_requests` `succeeded` 전이)으로 미사용 잔량을 소진. `amount`(음수)와 `refund_request_id`를 함께 기록
  - `transfer`: 한 `grant`의 잔량 일부/전부를 다른 `grant`(다른 자녀 또는 새 grant)로 이전. 출발 grant에 `transfer`(음수 `amount`) 행, 도착 grant에 `transfer`(양수 `amount`) 행을 **같은 트랜잭션**에서 한 쌍으로 생성하고 `transfer_group_id`(uuid)로 묶어 짝을 추적한다
- **동시성 제어(개정, 핵심)**: unique index는 "같은 이벤트를 두 번 기록하는 것"만 막을 뿐, "잔여 수량을 초과해서 서로 다른 예약이 각각 hold를 잡는 것"은 막지 못한다(경합 조건에서 두 트랜잭션이 서로의 커밋 전 상태를 보고 둘 다 "잔여 있음"으로 통과할 수 있음). 그래서 모든 hold/consume은 **행 잠금 + 잔여량 확인 + insert를 하나의 SECURITY DEFINER 함수·트랜잭션**으로만 수행한다.
  ```sql
  create or replace function hold_entitlement(p_child_id uuid, p_reservation_id uuid, p_lesson_start_at timestamptz, p_needed integer default 1)
  returns uuid  -- 선택된 grant_id
  language plpgsql security definer set search_path = public as $$
  declare
    v_grant record;
    v_remaining integer;
  begin
    -- (개정 v4) "지금" 만료 안 된 grant가 아니라, "이 예약의 수업 시작 시각"이 만료일 이내인 grant만 대상으로 한다.
    -- R0 §4.8/product-architecture-v3 §4.9: "예약하려는 수업의 시작 시각이 수업권 만료 시각 이내여야 한다."
    -- expires_at > now()로 비교하면 만료 임박 grant로 몇 주 뒤 수업을 예약하는 것을 막지 못한다.
    for v_grant in
      select id, expires_at from entitlement_grants
      where child_id = p_child_id and expires_at > p_lesson_start_at
      order by expires_at asc, created_at asc
      for update  -- 여기서 잠긴 grant는 동시 호출이 이 행을 다시 잠그려 할 때 대기(skip locked 사용 안 함 — 정확히 1건만 성공해야 하므로 대기 후 재평가 필요)
    loop
      -- (개정 v4) 잔여량은 original_quantity를 더하지 않고 ledger 합산만으로 계산(이중 계산 버그 수정, 위 event_type 규약 참고)
      select coalesce(sum(amount), 0)
      into v_remaining
      from entitlement_ledger where grant_id = v_grant.id;

      if v_remaining >= p_needed then
        insert into entitlement_ledger (grant_id, event_type, amount, reservation_id)
        values (v_grant.id, 'hold', -p_needed, p_reservation_id);
        return v_grant.id;
      end if;
      -- 부족하면 잠금을 유지한 채(트랜잭션 종료 시 자동 해제) 다음 grant로 이동
    end loop;
    raise exception '사용 가능한 수업권이 없습니다.';
  end;
  $$;
  ```
  같은 원리로 `consume_entitlement(hold_id)`/`release_entitlement(hold_id)`도 대상 `grant` 행을 `for update`로 잠근 뒤 이벤트를 insert하는 함수로만 노출한다. **잔여 1장에 서로 다른 예약 2건이 동시에 `hold_entitlement()`를 호출하면**, 먼저 잠근 트랜잭션이 커밋될 때까지 두 번째 호출이 `for update`에서 대기하고, 재평가 시 잔여가 0이 되어 정확히 1건만 성공하고 나머지는 예외로 실패한다. 애플리케이션·RLS insert 정책에서 `entitlement_ledger`에 직접 insert를 허용하지 않고 이 함수들만 호출 가능하게 한다(§5.3에 반영).

### 3.7 보충시간(`makeup_obligations` + `makeup_events`, 분리)

**수정(개정)**: 기존 초안의 단일 `makeup_time_ledger`(컬럼으로 `remaining_minutes` 저장 + check 제약)를 "발생 의무"와 "적용/조정 이력"으로 분리한다. `remaining_minutes`를 컬럼으로 저장하지 않고 원장 합산으로 파생시켜, 동시성 문제나 계산 누락으로 원장과 잔액이 어긋나는 상황 자체를 없앤다.

- `makeup_obligations`(의무 발생 1건당 1행)
  - 컬럼: `id`, `triggering_session_id → sessions`, `child_id → children`, `teacher_id → teachers`, `owed_minutes`(정수, 발생 시점에 고정), `reason`, `created_at`
  - **수정(개정)**: `reason`은 "선생님 사정 취소"처럼 전체 취소를 뜻하는 값을 쓰지 않는다(전체 취소는 예약이 `release`되는 별개 흐름이라 보충시간 대상이 아님, product-architecture-v3 §4.5). 발생 사유는 다음 3가지로 한정한다.
    - `teacher_late`: 선생님 10분 이상 지각으로 제공하지 못한 분
    - `teacher_partial_interruption`: 선생님 사유로 수업 도중 조기 종료·중단
    - `company_meet_interruption`: 회사·Meet 장애로 수업 도중 중단
  - 불변: `owed_minutes > 0`. 이 테이블은 발생 후 UPDATE 금지(트리거) — 의무량 정정이 필요하면 `makeup_events`에 `event_type='adjust'`(음수 가능) 행을 추가
- `makeup_events`(적용·조정 이력, INSERT-only)
  - 컬럼: `id`, `obligation_id → makeup_obligations`, `event_type`(`applied`/`adjust` — **개정: `expired` 제거**, 아래 참고), `applied_minutes`(정수, 부호 있음), `applied_session_id`(nullable, `applied`일 때만 채움), `created_at`
  - **수정(개정)**: 보충시간 만료 정책이 아직 합의되지 않았으므로 `expired` 이벤트 타입 자체를 이번 설계에서 제거한다. 만료 정책이 확정되면 별도 Gate 승인 후 이벤트 타입을 추가한다 — 그 전까지 보충시간은 명시적으로 적용(`applied`)되기 전까지 만료되지 않는다.
  - 불변: `applied_session_id`는 `event_type = 'applied'`일 때만 not null(check 제약), UPDATE/DELETE 금지(트리거)
- **잔여 시간(`remaining_minutes`)은 저장 컬럼이 아니라 뷰로 파생**: `obligation.owed_minutes + sum(makeup_events.applied_minutes) as remaining_minutes`
- **동시성 제어(개정, §3.6과 동일 원리)**: 적용은 반드시 `apply_makeup_time(obligation_id, applied_session_id, minutes)` SECURITY DEFINER 함수로만 수행한다.
  ```sql
  create or replace function apply_makeup_time(p_obligation_id uuid, p_applied_session_id uuid, p_minutes integer)
  returns void
  language plpgsql security definer set search_path = public as $$
  declare
    v_owed integer;
    v_remaining integer;
  begin
    select owed_minutes into v_owed from makeup_obligations where id = p_obligation_id for update;
    if v_owed is null then
      raise exception '유효하지 않은 보충시간 의무입니다.';
    end if;

    if exists (select 1 from makeup_events where obligation_id = p_obligation_id
               and applied_session_id = p_applied_session_id and event_type = 'applied') then
      raise exception '이미 이 수업에 적용된 보충시간입니다.'; -- 중복 적용 방지
    end if;

    select v_owed + coalesce(sum(applied_minutes), 0) into v_remaining
      from makeup_events where obligation_id = p_obligation_id;

    if v_remaining < p_minutes then
      raise exception '잔여 보충시간(%)이 요청 시간(%)보다 적습니다.', v_remaining, p_minutes; -- 초과 적용 방지
    end if;

    insert into makeup_events (obligation_id, event_type, applied_minutes, applied_session_id)
    values (p_obligation_id, 'applied', -p_minutes, p_applied_session_id);
  end;
  $$;
  ```
  `for update`로 `makeup_obligations` 행을 잠그므로, 같은 의무에 대해 서로 다른 미래 수업 2건이 동시에 보충시간을 적용하려 해도 하나가 커밋될 때까지 다른 하나가 대기하고, 재평가 시 잔여 부족이면 예외로 실패한다 — 초과 적용과 중복 적용 모두 이 함수 하나로 차단된다.

### 3.8 리뷰(`session_reviews`)

- FK: `session_id → sessions`(1:1 unique 유지)
- 불변: `published` 이후 수정 시 `session_review_revisions`에 새 행만 추가, `session_reviews.status` 역행 금지(트리거)

### 3.9 정산(`payout_items`/`payout_batches`)

- FK: `payout_item.session_id`, `payout_batch_id`
- 불변: `payout_batch`는 단일 `currency`(체크 제약), `paid` 이후 금액 수정은 `adjustment`/`reversal` item 추가만(원본 UPDATE 트리거 차단)

### 3.10 Drive artifact(`drive_artifacts`)

- FK: `child_id` 또는 `session_id` 또는 `company_document_id` 또는 `contract_id` 또는 `teacher_contract_id` 또는 `subject_enrollment_id` 중 정확히 하나(check constraint, **개정 v4: `subject_enrollment_id` 추가, 6택1로 확장**) — 계약서(구글 e시그니처 확정본)와 선생님 계약서도 동일한 Drive artifact 구조로 추적해 provisioning/권한회수/보존기간 로직을 재사용한다
- **(개정 v4)** `subject_enrollment_id → subject_enrollments`: Gate C `10_Students/STU_.../ENR_..._<subject>/<연도>` 구조의 **과목 폴더·연도 하위 폴더**(`artifact_kind = 'subject_folder'`/`'subject_year_folder'`)가 이 FK를 사용한다. v3 초안은 학생 폴더(`child_id`)까지만 DB 관계로 추적하고 그 아래 과목·연도 폴더는 Drive 폴더 경로 문자열에만 의존했는데, 이 컬럼으로 과목·연도 폴더도 명시적 DB 관계가 된다
- 불변: `drive_file_id` unique, `idempotency_key` unique(provisioning job당)
- `artifact_kind`(text: `student_folder`/`session_material`/`smart_note`/`company_doc`/`family_contract`/`teacher_contract` 등)로 §1.2 폴더 구조·보존기간(§Gate C 5절 12개월 vs 3년) 분기 처리

### 3.11 선생님 시급 이력(`teacher_rate_history`)

**신규(개정)**: 시급 변경을 추적 가능하게 하고, 정산 스냅샷(§2 `sessions.hourly_rate_snapshot`)이 어느 시점 값을 참조했는지 명시한다.

- 컬럼: `id`, `teacher_id → teachers`, `amount_minor`(정수, 최소 통화 단위 — KRW는 원 단위라 사실상 `amount_minor = amount`), `currency`(text, 기본 `'KRW'`), `effective_from`(timestamptz), `effective_until`(timestamptz, nullable = 현재까지 유효), `rate_version_id`(uuid, 변경 배치 1건을 식별 — 한 번의 관리자 조정으로 여러 선생님 시급이 동시에 바뀌어도 같은 `rate_version_id`로 묶임), `created_by`, `created_at`
- 불변: `teacher_id`별 `[effective_from, effective_until)` 겹침 금지(**exclusion constraint**, `tstzrange`), 최신 행(`effective_until is null`)은 `teacher_id`당 정확히 1개(부분 unique index)
- **마이그레이션 결정(§9-1)**: 과거 시급 이력이 없으므로 소급 생성하지 않는다. v3 전환일을 `effective_from`으로 하는 최초 1행만 현재 `teachers.hourly_rate_krw` 값으로 생성한다.

### 3.12 상품·결제·환불 구조 (전면 재설계, 개정)

v1 초안은 `price_versions`/`payment_attempts`/`refund_requests` 3개 테이블에 상품·구매·결제를 뭉쳐놨고, 상태값도 R0 §4.11에서 승인된 값과 어긋났다. 이번 개정에서 **7개 테이블로 분리**하고 상태값을 R0 §4.11과 정확히 통일한다.

#### 3.12.1 상품 정의 (판매 전 마스터 데이터)

- `lesson_types`: `id`, `code`(text, 예: `'regular'`/`'trial'`), `duration_minutes`(예: 정규 120, 체험 60), `label`
- `entitlement_types`: `id`, `code`(text, 예: `'regular_lesson_use'`), `lesson_type_id → lesson_types` — "이 수업권 1장이 어떤 수업 1회 이용권인지" 정의
- `entitlement_products`: `id`, `code`(text, 예: `'lesson_pack_20'`), `entitlement_type_id → entitlement_types`, `quantity`(정수, 예: 20) — 판매 단위(패키지) 정의. 단건 상품은 `quantity = 1`
- `price_versions`: `id`, `entitlement_product_id → entitlement_products`, `currency`, `package_amount_minor`(그 수량 전체의 실결제가), `unit_amount_minor`(패키지 할인 재정산·회수 계산 기준이 되는 단건 정상가), `refund_policy_version`(text, 그 시점 환불정책 문서 버전), `effective_from`, `effective_until`(nullable) — 불변: `(entitlement_product_id, currency)`별 유효기간 겹침 금지(exclusion constraint)

#### 3.12.2 구매·결제·환불 (거래 기록)

- `purchases`: `id`, `child_id → children`, `contract_id → contracts`, `entitlement_product_id`, `price_version_id`, `package_amount_minor_snapshot`, `unit_amount_minor_snapshot`, `refund_policy_version_snapshot`, `currency`, `created_at` — **구매 시점의 자녀·계약·상품·패키지가·단건 정상가·환불정책 버전을 전부 스냅샷으로 고정**한다(이후 `price_versions`가 바뀌어도 이 구매 건의 정산·환불 계산은 영향받지 않음)
- `payment_attempts`: `id`, `purchase_id → purchases`, `provider`(text: `'stripe'` 등), `provider_intent_id`, `status`, `amount_minor`, `currency`, `failure_reason`(nullable), `created_at`, `updated_at` — **한 `purchase`에 여러 `payment_attempts`가 있을 수 있다**(카드 실패 후 재시도 등). `succeeded`인 시도가 정확히 1건 확정되면 그 시점에 `entitlement_grants` 생성 트리거
  - **상태값(개정, R0 §4.11과 통일)**: `created → processing → succeeded/failed/cancelled/reconciliation_needed` — v1의 `canceled`(단일 l)와 `pending`/`completed`는 사용하지 않는다. Stripe 응답이 불명확하면 실패/성공으로 추정하지 않고 `reconciliation_needed`로 두고 재조회
  - **불변(개정 v4)**: 부분 unique index `(purchase_id) where status = 'succeeded'` — 한 `purchase`에 `succeeded` 시도가 최대 1건만 존재하도록 강제해, 재시도 로직 버그로 같은 구매가 두 번 결제 확정되는 것을 DB 레벨에서 차단한다(실패한 시도는 몇 건이든 계속 쌓일 수 있음)
- `refund_requests`: `id`, `purchase_id → purchases`, `requested_by`, `status`, `amount_minor`, `reason`, `resolved_by`(nullable), `resolved_at`(nullable), `provider_refund_id`(nullable) — `succeeded` 전이 시 `entitlement_ledger`에 `refund` 이벤트 insert(§3.6)
  - **상태값(개정, R0 §4.11과 통일)**: `requested → reviewing → approved/rejected → processing → succeeded/failed` — v1의 `pending`/`completed`는 사용하지 않는다. 실패한 환불을 `succeeded`로 표시하지 않고 재시도·관리자 조정 이력을 보존

#### 3.12.3 구매 상태는 저장하지 않고 파생

- **개정**: `purchases`에는 `status` 컬럼을 두지 않는다. R0 §4.11 "구매 상태는 결제·환불 원장에서 파생한다"에 따라, `pending`/`paid`/`partially_refunded`/`refunded`/`disputed`는 `payment_attempts`/`refund_requests`를 조회하는 뷰(`purchase_status`)로 계산한다.
  ```sql
  -- 개념적 정의(실제 구현 시 뷰 또는 함수로 R1에서 작성)
  -- succeeded payment_attempt 없음        → pending
  -- succeeded 있고 succeeded refund 없음   → paid
  -- succeeded 있고 일부만 환불            → partially_refunded
  -- succeeded 있고 환불액 = 결제액 전체   → refunded
  -- Stripe dispute 연동 시                → disputed (연동 방식은 R4에서 확정)
  ```

### 3.13 외부 이벤트 중복 방지 원장(`external_event_receipts`)

**신규(개정)**: 기존 §9-4 "웹훅 이벤트 ID 유일성"을 Stripe 한정이 아니라 Stripe·Google Calendar·Google Drive·Workspace Events API 등 모든 외부 이벤트에 공통 적용되는 원장으로 일반화한다.

- 컬럼: `id`, `provider`(text: `'stripe'`/`'google_calendar'`/`'google_drive'`/`'google_workspace_events'` 등), `event_id`(text, provider가 부여한 고유 이벤트 ID), `received_at`, `payload_hash`(nullable, 원문 저장이 필요 없는 경우 무결성 확인용)
- **수정(개정 v4)**: v3 초안은 unique 충돌이면 무조건 "이미 처리됨"으로 간주해 종료했다 — 이러면 첫 시도가 처리 도중 실패하거나 워커가 죽어도 재시도할 방법이 없다(영구 유실). 처리 상태를 명시적으로 추적하도록 컬럼을 추가한다.
  - `status`(`received`/`processing`/`succeeded`/`retryable_failed`/`manual_review`, 기본값 `received`)
  - `attempt_count`(정수, 기본 0), `last_attempt_at`(nullable), `last_error`(text, nullable)
  - `lease_owner`(text, nullable, 처리 중인 워커/인스턴스 식별자), `lease_expires_at`(nullable) — 처리 lease. 워커가 죽어 lease가 만료되면(`lease_expires_at < now()`) 다른 워커가 같은 이벤트를 다시 집어갈 수 있다
- 불변: **`(provider, event_id)` unique**는 유지하되, **처리 로직은 unique 충돌 자체가 아니라 `status`로 분기**한다.
  - insert 시도가 unique 충돌 → 기존 행을 조회해 `status = 'succeeded'`면 즉시 종료(진짜 중복)
  - **자동 재처리 대상(개정)**: `status = 'retryable_failed'` 또는 (`status = 'processing'` and `lease_expires_at < now()`, 즉 정체된 이벤트)이면 **자동 재처리 허용** — `for update`로 잠그고 `status='processing'`, `lease_owner`/`lease_expires_at` 갱신 후 `attempt_count` 증가
  - **`manual_review`는 자동 재처리 대상이 아니다.** 재시도 한도를 초과해 `manual_review`로 전환된 이벤트는 워커가 자동으로 다시 집어가지 않는다 — 관리자가 원인을 확인하고 명시적으로 재처리를 승인(예: 관리자 전용 함수/화면에서 `status`를 `received`로 되돌리고 `attempt_count`를 초기화)한 경우에만 다시 처리 대상이 된다
  - `status = 'processing'`이고 lease가 아직 유효하면 다른 워커가 처리 중이므로 대기/스킵
  - 처리 성공 시 `status='succeeded'`, 실패 시 재시도 가능하면 `status='retryable_failed'` + `last_error` 기록, 재시도 한도 초과 시 `status='manual_review'`
- 적용 대상: Stripe 웹훅, Google Calendar push notification, Google Drive/Workspace Events API 구독 이벤트(Gate C GW-04 idempotency 검증과 동일한 메커니즘을 공유)

### 3.14 과목 대화방(`subject_threads`/`subject_thread_participants`/`subject_thread_messages`)

**(개정 v4)** product-architecture-v3.md §4.11 정책을 그대로 구현한다 — §5.3에서 철회한 v2의 subject_enrollment 단일 스레드 설계 대신, 배정(`teacher_assignment`) 단위로 스레드가 생성·보관된다.

- `subject_threads`: `id`, `subject_enrollment_id → subject_enrollments`, `teacher_assignment_id → teacher_assignments`(unique — 배정 1개당 스레드 정확히 1개), `status`(`active`/`archived`), `archived_at`(nullable), `created_at`
- `subject_thread_participants`: `id`, `thread_id → subject_threads`, `profile_id`, `role`(`child`/`guardian`/`teacher`), `added_at` — 배정 기간 동안 고정 멤버(학생 본인·해당 household의 guardian 전원·그 배정의 담당 선생님)이며, 스레드가 `archived`로 바뀌어도 참가자 행은 삭제하지 않는다(종료된 선생님 본인이 자기 스레드를 계속 열람할 수 있어야 하므로)
- `subject_thread_messages`: `id`, `thread_id → subject_threads`, `sender_profile_id`, `body`, `created_at`, `edited_at`(nullable), `deleted_at`(nullable) — 수정·삭제는 소프트 삭제로 이력을 남기고(관리자 조회 대상), `thread.status = 'active'`일 때만 insert 허용(§5.3)
- 불변: `teacher_assignment_id` unique(배정당 스레드 1개), `archived` 스레드는 `subject_thread_messages` insert 불가(RLS with check, §5.3), 참가자 삭제(DELETE) 정책 없음 — 배정 종료로 인한 접근 변화는 스레드 자체의 `status` 전환으로 표현하고 참가자 행은 보존

---

## 4. 상태 전이별 허용 명령·주체·트랜잭션 경계

| 엔티티 | 전이 | 허용 주체 | 트랜잭션 경계 |
|---|---|---|---|
| 예약 | `holding→confirmed` | 서버(예약 API) | DB 슬롯 잠금 + entitlement hold + (성공 시)Calendar/Meet 생성 요청은 **커밋 후 비동기**(§6.4) |
| 예약 | `confirmed→cancelled` | 학생 본인(정상), 관리자(예외) | hold release/consume 판정 + Calendar 취소 요청을 한 서버 액션에서 순차 실행, Google 실패는 `reconciliation_needed`로 별도 기록(예약 자체는 cancelled 유지) |
| 수업 | `scheduled→live→completed` | 시스템(스케줄 도래)/선생님(수업 종료 버튼) | `completed` 확정 시: entitlement consume + payout_item 생성 + 진도 갱신을 **단일 DB 트랜잭션** |
| 수업 | `completed`→예외 재개방 | 관리자만 | **(개정)** 동일 `session_id` 유지, `reopen_session()` 함수로 `session_status_events`에 `reopened` 행 insert(§3.5.1), 재확정은 `recomplete_session()`으로 별도 트랜잭션 |
| 수업권 | `grant→hold` | 서버(예약 시) | 예약 트랜잭션에 포함 |
| 수업권 | `hold→consume` | 서버(수업 완료 트랜잭션 내) | §수업 완료 트랜잭션에 포함 |
| 수업권 | `hold→release` | 서버(취소 처리 트랜잭션 내) | 취소 트랜잭션에 포함 |
| 선생님 배정 | `active→ended`+신규`active` | 관리자만 | 종료+신규 생성을 단일 트랜잭션(둘 다 성공 또는 둘 다 롤백) |
| 정산 | `pending→approved→batched→paid` | 관리자(승인/지급), 시스템(batched) | 각 전이는 독립 트랜잭션, `paid` 이후 원본 불변 |
| Drive 작업 | `queued→processing→succeeded/retryable_failed/manual_review` | 시스템(자동화 계정) | job 자체는 앱 트랜잭션과 분리(비동기 큐), 상태만 DB에 기록 |
| 결제 시도(§3.12) | `created→processing→succeeded/failed/cancelled/reconciliation_needed` | 시스템(Stripe 웹훅) | 웹훅 처리 전 `external_event_receipts`(§3.13) insert로 중복 실행 방지, `succeeded` 확정 시 `entitlement_grants` 생성 + `entitlement_ledger` `grant` 이벤트를 단일 트랜잭션. 응답 불명확 시 추정하지 않고 `reconciliation_needed`로 두고 재조회 |
| 환불 요청(§3.12) | `requested→reviewing→approved/rejected→processing→succeeded/failed` | 관리자(결제권한) | `succeeded` 전이 시 `entitlement_ledger` `refund` 이벤트 insert를 같은 트랜잭션에 포함, `failed`는 완료로 표시하지 않고 재시도·조정 이력 보존 |

---

## 5. RLS·서버 capability 설계

### 5.1 원칙

- 모든 신규 테이블에 RLS 활성화. service-role 호출은 서버 액션 진입부의 `requireX()` 가드(역할 또는 capability 검사)를 통과한 뒤에만 실행 — RLS는 방어선, 서버 가드가 1차 관문(R0 §5.1 원칙 1 반영).
- Supervisor는 별도 `admin` 역할 부여가 아니라 `supervisor_capabilities(profile_id, capability)` 테이블로 조합. `requireCapability(capability)` 헬퍼가 `is_admin() OR has_capability(auth.uid(), capability)`로 통일.
- **(신규, 개정 v4) SECURITY DEFINER 함수 실행 권한 규칙**: `SECURITY DEFINER`는 함수 소유자(보통 관리자급 role) 권한으로 실행되므로, 기본 상태로 두면 `PUBLIC`(및 `anon`)도 호출할 수 있어 RLS를 우회하는 뒷문이 될 수 있다. 이 문서의 모든 `SECURITY DEFINER` 함수는 생성 직후 **반드시** 다음 패턴을 따른다.
  ```sql
  revoke execute on function <fn>(...) from public;
  revoke execute on function <fn>(...) from anon;
  grant execute on function <fn>(...) to authenticated;   -- 클라이언트가 직접 호출하는 함수(예: 없음 — 아래 전부 서버 전용)
  -- 또는 서버 액션에서만 호출하는 함수는 authenticated에도 주지 않고 서버가 사용하는 전용 role에만 grant
  ```
  이 문서에 등장하는 `SECURITY DEFINER` 함수: `hold_entitlement`/`consume_entitlement`/`release_entitlement`(§3.6), `apply_makeup_time`(§3.7), `reopen_session`/`recomplete_session`(§3.5.1), `sync_subject_thread_for_assignment`(§5.3, 트리거 전용이라 EXECUTE 권한 자체가 필요 없고 트리거로만 호출됨). 트리거 전용 함수는 `authenticated`/`anon`/`public` 어디에도 EXECUTE를 주지 않는다(트리거는 함수 소유자 권한으로 자동 실행되며 별도 EXECUTE grant가 필요 없음). 나머지(`hold_entitlement` 등)는 서버 액션(Next.js 서버 코드가 사용하는 Supabase 클라이언트 role)에만 grant하고 `authenticated`에는 주지 않아, 클라이언트가 RPC를 직접 호출해 서버 측 검증(예: 예약 생성 트랜잭션의 나머지 절차)을 건너뛰지 못하게 한다.

### 5.2 capability 목록(R0 §5 표 기준)

`사용자권한`, `학생관리`, `계약권한`, `결제권한`, `수업권조정권한`, `예약관리권한`, `선생님관리권한`, `매칭권한`, `QC권한`, `교육관리권한`, `메시지감사권한`, `정산권한`(승인/지급 분리 시 `정산승인`, `정산지급`), `문서관리권한`, `감사권한`

### 5.3 신규 RLS 정책 초안 (대표 예시, 전체는 R1 구현 시 마이그레이션 파일에 포함)

```sql
-- 선생님 배정: 관리자 또는 매칭권한 supervisor만 쓰기, 조회는 당사자/보호자
create policy "배정 조회" on teacher_assignments for select
  using (
    exists (select 1 from subject_enrollments se where se.id = subject_enrollment_id
      and (se.child_id = auth.uid() or is_guardian_of(se.child_id)))
    or teacher_id = auth.uid()
    or is_admin() or has_capability(auth.uid(), '매칭권한')
  );
create policy "배정 쓰기" on teacher_assignments for all
  using (is_admin() or has_capability(auth.uid(), '매칭권한'))
  with check (is_admin() or has_capability(auth.uid(), '매칭권한'));

-- entitlement_ledger: INSERT만 허용, UPDATE/DELETE 정책 자체를 만들지 않음(트리거로도 이중 차단)
create policy "원장 조회" on entitlement_ledger for select
  using (child_id = auth.uid() or is_guardian_of(child_id) or is_admin() or has_capability(auth.uid(), '결제권한'));
create policy "원장 생성" on entitlement_ledger for insert
  with check (is_admin() or has_capability(auth.uid(), '수업권조정권한'));

-- 과목 대화방(수정, 개정 v4 — v2의 subject_enrollment 단일 스레드 설계는 철회하고
-- product-architecture-v3.md §4.11 정책 그대로 구현한다):
-- - subject_thread는 subject_enrollment_id + teacher_assignment_id에 귀속(1스레드 = 1배정)
-- - teacher_assignment가 active가 될 때 시스템이 자동 생성
-- - teacher_assignment가 ended가 되면 그 스레드는 즉시 archived(읽기 전용)로 전환되고
--   새 teacher_assignment에 새 스레드가 자동 생성됨(§3.3의 종료+신규 insert 단일 트랜잭션과 동일 트랜잭션)
-- - 학생·보호자는 같은 subject_enrollment 아래 active+archived 스레드를 전부 조회 가능
-- - 선생님은 본인이 teacher_id인 배정의 스레드만 조회 — 종료된 이전 선생님과 새 선생님은
--   서로의 스레드를 볼 수 없음(각자 자신의 teacher_assignment.teacher_id로만 매칭되므로 자동 보장)
-- - 관리자는 전체 조회
-- authenticated 역할에는 insert/update/delete 정책을 두지 않는다(기본 거부) —
-- 쓰기(스레드/참가자 생성, archived 전환)는 아래 트리거 함수(및 관리자 service-role)만 가능.

create table subject_threads (
  id uuid primary key default gen_random_uuid(),
  subject_enrollment_id uuid not null references subject_enrollments(id),
  teacher_assignment_id uuid not null unique references teacher_assignments(id),
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function sync_subject_thread_for_assignment()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_thread_id uuid;
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    -- 새 배정이 active가 됨 → 그 배정 전용 스레드를 새로 생성(과거 스레드는 건드리지 않음)
    insert into subject_threads (subject_enrollment_id, teacher_assignment_id, status)
    values (new.subject_enrollment_id, new.id, 'active')
    returning id into v_thread_id;

    insert into subject_thread_participants (thread_id, profile_id, role)
    select v_thread_id, gs.parent_id, 'guardian'
    from guardian_students gs
    join subject_enrollments se on se.id = new.subject_enrollment_id
    where gs.student_id = se.child_id
    union all
    select v_thread_id, se.child_id, 'child'
    from subject_enrollments se where se.id = new.subject_enrollment_id
    union all
    select v_thread_id, new.teacher_id, 'teacher';

  elsif new.status = 'ended' then
    -- 이 배정의 스레드를 즉시 archived로 전환(읽기 전용, 참가자 행은 그대로 보존해
    -- 종료된 선생님 본인은 자기 스레드를 계속 열람할 수 있게 한다)
    update subject_threads set status = 'archived', archived_at = now()
      where teacher_assignment_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

create trigger teacher_assignments_sync_thread
  after insert or update of status on teacher_assignments
  for each row execute function sync_subject_thread_for_assignment();

revoke execute on function sync_subject_thread_for_assignment() from public, anon, authenticated;
-- 트리거 전용 함수라 EXECUTE grant 자체가 불필요(§5.1 SECURITY DEFINER 규칙)

-- 조회 정책: 학생·보호자는 subject_enrollment 관계로 active+archived 전부,
-- 선생님은 본인이 담당한 배정의 스레드만(archived 포함), 관리자는 전체
create policy "대화방 조회 - 학생·보호자" on subject_threads for select
  using (
    exists (select 1 from subject_enrollments se where se.id = subject_enrollment_id
      and (se.child_id = auth.uid() or is_guardian_of(se.child_id)))
  );
create policy "대화방 조회 - 선생님" on subject_threads for select
  using (
    exists (select 1 from teacher_assignments ta where ta.id = teacher_assignment_id and ta.teacher_id = auth.uid())
  );
create policy "대화방 조회 - 관리자" on subject_threads for select
  using (is_admin() or has_capability(auth.uid(), '메시지감사권한'));
-- insert/update/delete 정책은 만들지 않는다 = RLS 기본 거부. 쓰기는 위 트리거(및 관리자 service-role)만 가능.

-- 메시지 쓰기는 스레드가 active일 때만 허용 — archived 스레드는 조회 정책은 통과해도
-- 쓰기 정책에서 status 검사로 막혀 "읽기 전용"이 실제로 강제된다.
create policy "대화방 메시지 작성" on subject_thread_messages for insert
  with check (
    exists (select 1 from subject_threads t where t.id = thread_id and t.status = 'active')
    and exists (select 1 from subject_thread_participants p where p.thread_id = thread_id and p.profile_id = auth.uid())
  );
```

**UI 표시 방침**: 화면에서는 `subject_thread`를 그대로 나열하지 않고, `subject_enrollment_id`로 그룹핑한 뒤 그 안에서 배정 기간별(선생님 A 재직 기간 스레드 → 선생님 B 재직 기간 스레드 순) 하위 스레드로 묶어 보여준다. 학생·보호자 화면은 "같은 과목의 대화 이력"으로 인지되고, 선생님 화면은 본인 담당 기간의 스레드만 보인다.

**관리자 조회 범위(product-architecture-v3.md §4.11 그대로)**: 관리자는 모든 active·archived 스레드의 메시지·첨부파일·수정/삭제 이력·신고 내용을 조회할 수 있다. 이 조회 행위 자체도 감사 로그로 남기고(§5.2 `감사권한`), 사용자에게 관리자 조회 가능성을 고지하는 것은 화면/약관 영역이라 이 문서 범위 밖이다.

### 5.4 권한 우회 방지 체크리스트(구현 시 각 서버 액션에 적용)

1. 학생 역할 액션은 세션 행 전체 UPDATE 금지 — 허용된 컬럼만 patch하는 RPC/컬럼 화이트리스트 사용(R0 불변 2)
2. 선생님 역할 액션은 `subject_enrollments`/`teacher_assignments` 직접 UPDATE 금지 — 변경 요청은 관리자 승인 큐로만(R0 §5 표 "요청")
3. 관리자 액션도 `paid` 정산·`consumed` 수업권·`completed` 수업을 직접 덮어쓰지 않고 보정 이벤트 생성 함수만 호출(R0 불변 4)
4. Supervisor 판단은 역할 문자열이 아니라 capability 조합 검사(R0 불변 5)
5. 보호자 AI 회의록 거부 플래그는 학생/선생님 액션에서 수정 불가 컬럼(R0 불변 6) — RLS `update` 정책에서 해당 컬럼 변경 시도를 별도 트리거로 거부
6. **(개정 v4)** `subject_threads` 생성·archived 전환·참가자 등록은 클라이언트 insert/RPC 호출을 허용하지 않는다 — `teacher_assignments` 상태 변경 트리거(§5.3 `sync_subject_thread_for_assignment()`) 하나로만 수행하며, SECURITY DEFINER로 실행돼 애플리케이션 코드가 스레드 생성·전환을 직접 조작할 수 없다. 배정 종료(`ended`)와 신규 배정 생성이 §3.3처럼 단일 트랜잭션이므로, 스레드의 archived 전환과 새 스레드 생성도 항상 같은 트랜잭션에서 원자적으로 일어난다
7. **(신규)** `entitlement_ledger`/`makeup_events`에 대한 직접 insert 권한을 authenticated 역할에 부여하지 않는다 — 반드시 `hold_entitlement()`/`consume_entitlement()`/`release_entitlement()`(§3.6), `apply_makeup_time()`(§3.7) SECURITY DEFINER 함수만 통해 기록해 잔여량 잠금·검증을 우회할 수 없게 한다

---

## 6. 실행 순서·검증·롤백

### 6.1 백필 대상과 유지할 테스트 계정

- `supabase/seed.sql`의 8개 계정(관리자 1, 학부모 1, 학생 2, 선생님 2, 승인대기 선생님 1, 매칭대기 학생 1)은 **로그인 계정(Auth + profiles)만 유지**하고 ID를 그대로 새 스키마에 백필한다.
- **(개정, §9-2 결정)** 현재 `credit_balance` 합계 2와 `credit_transactions` `adjustment` 1건은 테스트 데이터이므로 opening entitlement로 이관하지 않는다. 이 업무 데이터(수업권/결제/세션 관련 행)는 마이그레이션 직전 `pg_dump`로 백업만 해두고(6.2 1단계), 새 스키마의 `entitlement_grants`/`entitlement_ledger`는 **비운 상태로 시작**한 뒤 `supabase/seed.sql`을 v3 스키마에 맞게 다시 작성해 필요한 시연용 데이터만 새로 심는다.
- 원격 개발 DB에 남아있는 수동 테스트 데이터(이 세션에서 발견한 `jiman@bulqot.co`/`테스트1` 등)도 동일 원칙 — 로그인 계정은 유지, 업무 데이터는 백업 후 폐기하고 v3 seed로 재생성한다.

### 6.2 실행 순서 (R0 §6.2를 이 코드베이스에 구체화)

1. 현재 Supabase 프로젝트 전체 `pg_dump` 백업 + 현재 배포 커밋 SHA 기록
2. 위 8개 시드 계정 ID·이메일·역할 표로 고정 문서화
3. v3 신규 테이블·enum·제약 마이그레이션 추가(기존 테이블은 그대로 둠, DROP 없음)
4. `parents`+`guardian_students`→`households`+`guardians`+`household_members` 백필
5. `enrollments`→`subject_enrollments`+`teacher_assignments` 분리 백필(§2 매핑)
6. `sessions`에 `teacher_id`/`hourly_rate_snapshot`/`material_version_id` 컬럼 추가(현재 `sessions` 0건이라 실제 백필 대상 없음). `teacher_rate_history`(§3.11)는 v3 전환일을 `effective_from`으로 현재 `teachers.hourly_rate_krw` 값의 최초 1행만 생성 — 과거 세션에 대한 소급 스냅샷·과거 `payout_items`는 만들지 않는다(§9-1)
7. **(개정)** `students.credit_balance`/`credit_transactions`는 opening entitlement로 변환하지 않는다 — 백업 후 폐기하고 `entitlement_grants`/`entitlement_ledger`/`price_versions`/`payment_attempts`/`refund_requests`/`external_event_receipts`는 전부 빈 테이블로 시작(§9-2)
8. `makeup_obligations`/`makeup_events`(§3.7), `payout_items`/`payout_batches`는 현재 `makeup_credits`/`teacher_payouts`가 0건이므로 변환 로직 없이 빈 테이블로 시작(§9-3)
9. 신규 RLS·server capability에 대해 8개 시드 계정으로 권한 시나리오 테스트
10. 기존 테스트(현재 vitest 스위트)를 v3 데이터 모양에 맞춰 재작성 — 특히 `enrollments` 목 데이터를 참조하는 테스트 전부 영향
11. E2E(§8) 통과 후 앱의 읽기/쓰기 경로를 신규 테이블로 전환(feature flag 없이 한 번에 — 미오픈 서비스라 flag 불필요, R0 §6.2 결론과 일치)
12. 기존 테이블(`enrollments`, `students.credit_balance`, `makeup_credits`, `teacher_payouts` 등)은 R1~R10 검증 기간 동안 **읽기 전용으로 보존**, 전체 게이트(R13) 통과 후 제거 여부 결정

### 6.3 검증 쿼리(예시, 실행 전/후 수치 비교)

```sql
-- 사용자 계정 수/역할별
select role, count(*) from profiles group by role;
-- 보호자-자녀 관계 수
select count(*) from guardian_students;
-- 활성 과목 수강 수 (이관 전/후 비교)
select count(*) from enrollments where status = 'active'; -- 이관 전
select count(*) from subject_enrollments where status = 'active'; -- 이관 후, 위와 일치해야 함
-- 현재 선생님 배정 수
select count(*) from teacher_assignments where status = 'active'; -- subject_enrollments 활성 수와 1:1이어야 함
-- 과거/미래 세션 수, 최종 상태별
select status, count(*) from sessions group by status; -- 이관 전
select final_status, count(*) from sessions group by final_status; -- 이관 후 총 건수 일치
-- (개정) opening entitlement는 이관하지 않으므로 신규 entitlement_grants/ledger는 빈 상태로 시작해야 한다
select count(*) from entitlement_grants; -- 이관 직후 기대값 0
select count(*) from entitlement_ledger; -- 이관 직후 기대값 0
-- 백업된 구 데이터는 pg_dump 스냅샷에만 존재함을 확인(운영 테이블에서는 조회 안 됨)
select sum(credit_balance) from students; -- 백업 스냅샷 쪽 참고용, 신규 스키마 검증 대상 아님
```

모든 차이는 원인과 승인자를 백필 로그(`docs/superpowers/specs/` 하위 신규 문서)에 기록한다.

### 6.4 롤백

- 마이그레이션 실행 직전 `pg_dump` 스냅샷 + git 커밋 SHA 기록(6.2 1단계)
- 실패 시: 앱 배포를 이전 커밋으로 되돌리고, DB는 스냅샷으로 복원(`supabase db reset` 대신 실제 백업 restore — 로컬 개발 DB 한정, 원격은 Supabase 대시보드의 point-in-time recovery 사용)
- `git reset --hard`나 운영 데이터 삭제 명령은 롤백 절차에 사용하지 않음(R0 §6.4 그대로)

---

## 7. 테스트 계획

### 7.1 단위

- entitlement 계산: grant→hold→consume/release 시나리오별 잔액
- payable_minutes 계산: 정상/늦은취소/노쇼/지각/보충시간 조합
- 예약 exclusion constraint: 겹치는 시간대 insert 시도가 거부되는지
- idempotency: 같은 `idempotency_key`로 예약 API 재호출 시 중복 생성 없음

### 7.2 통합

- 선생님 배정 변경 트랜잭션: 종료+신규 생성이 원자적인지(중간 실패 시 둘 다 롤백)
- 수업 완료 트랜잭션: entitlement consume + payout_item + 진도 갱신이 원자적인지
- RLS: 8개 시드 계정 각각으로 신규 테이블 select/insert/update 시도, 허용/거부 매트릭스 확인

### 7.3 E2E(R13 이전에도 조기 검증)

- 두 세션이 동시에 같은 선생님의 마지막 슬롯을 예약 → 하나만 성공
- 학생 정상취소→새 예약, 늦은취소, 노쇼 각각 entitlement/payout 결과 확인
- 선생님 변경 후 과거 세션·정산이 이전 선생님으로 유지되는지

### 7.4 동시성·idempotency

- 예약 API에 동일 요청 100ms 간격 2회 전송 → exclusion constraint 또는 idempotency_key로 정확히 1건만 확정
- **(개정, 2건으로 분리)** Stripe/Google 웹훅·이벤트 동일 건 재수신 시나리오를 `status`별로 나눠 검증한다(§3.13).
  - 이미 `status = 'succeeded'`인 이벤트가 동일 `(provider, event_id)`로 재수신 → 처리 로직이 즉시 종료되고, entitlement 등에 중복 처리가 발생하지 않는지 확인
  - `status = 'retryable_failed'`이거나 `status = 'processing'`이면서 `lease_expires_at`이 만료된 이벤트가 재수신 → 자동 재처리 대상으로 정상적으로 다시 처리되는지(`attempt_count` 증가, 최종 성공 또는 재실패 시 재시도 한도에 따라 `retryable_failed`/`manual_review`로 전이) 확인. `manual_review` 이벤트는 이 재수신 흐름으로 자동 재처리되지 않아야 함을 함께 확인
- 같은 `grant`에 대해 서로 다른 예약 2건이 거의 동시에 `consume` 이벤트를 시도 → §3.6의 `(reservation_id, event_type)` 부분 unique index로 각 예약당 정확히 1건만 기록되는지, grant 잔액이 두 번 차감되지 않는지 확인
- **(신규)** 잔여 수업권 1장에 서로 다른 예약 2건이 동시에 `hold_entitlement()`를 호출 → 정확히 1건만 성공하고 나머지는 예외로 실패하는지(§3.6 행잠금 함수) 확인
- **(신규)** 잔여 보충시간 10분에 서로 다른 미래 수업 2건이 동시에 `apply_makeup_time(minutes=10)`을 호출 → 정확히 1건만 성공하는지, 같은 `applied_session_id`로 두 번 호출 시 중복 적용이 거부되는지(§3.7 `apply_makeup_time()`) 확인

---

## 8. 현재 코드의 v3 위반 목록과 후속 배치

| 위반 | 현재 위치 | 배치 |
|---|---|---|
| 과목수강+선생님배정 결합 | `enrollments` | R1 |
| 크레딧 직접 수정 가능 | `students.credit_balance`, `adjustStudentCredit` | R1, R4 |
| duration_minutes 기본 30(정책 120/60과 불일치) | `sessions.duration_minutes` | R1 |
| 선생님 역조회 기반 정산 | `payouts-data.ts`의 enrollment 조인 | R1(스냅샷 컬럼), R7 |
| session_status가 취소/노쇼 사유 구분 못함 | `session_status` enum | R1, R7 |
| makeup_credits가 분 단위 아님 | `makeup_credits.count` | R1, R7 |
| 화이트보드 전체 jsonb 덮어쓰기 | `canvas-actions.ts`, `scratchpad-actions.ts` | R8 |
| 학생-선생님 DM 모델(과목 대화방 아님) | `chat_threads` | R11 |
| Calendly 웹훅·URL 잔존 | `CalendlyWidget.tsx`, `booking-data.ts`, `api/webhooks/calendly/*`, `teachers.calendly_scheduling_url` | R6(신규 예약 구현 후), 전환 완료 시 제거 |
| 학부모 레슨 화면에 예약 버튼 노출 | `LessonsTab.tsx`(학부모 재사용) | R6과 함께 재작성되며 자연 해소 |
| 예약 시점에 진도 자동 증가 | Calendly webhook의 `current_session` update | R1(스냅샷 모델로 대체), R7(완료 트랜잭션으로 이전) |
| 계약서 발송이 계정 생성 트리거 | `contracts-actions.ts` | R3(체험 우선 흐름으로 순서 변경) |

---

## 9. Gate B 정책 결정 사항(기획자 확정, 2026-08-29)

아래 4가지는 v1 초안에서 질문으로 남겨뒀던 항목이며, 기획자가 이번 개정에서 확정했다.

1. **시급 이력 부재 → 소급 적용하지 않음(확정)**: 현재 세션이 0건이므로 과거 세션의 "당시 시급"을 복원할 필요 자체가 없다. v1의 (a)/(b) 선택지 중 어느 쪽도 아니고, v3 전환일을 `effective_from`으로 하는 `teacher_rate_history`(§3.11) 최초 1행만 현재 시급으로 생성한다. 과거 `payout_items`는 생성하지 않는다.
2. **크레딧 원장 → 이관하지 않음(확정)**: `credit_balance` 합계 2, `adjustment` 1건은 테스트 데이터로 확정 분류한다. opening entitlement로 변환하지 않고, 마이그레이션 전 `pg_dump` 백업에만 보존한 뒤 폐기한다. 로그인 계정(Auth/profiles)은 유지하되 업무 데이터는 v3 seed로 재생성한다(§6.1, §6.2).
3. **makeup_credits/teacher_payouts → 빈 상태로 시작(확정)**: 원격 개발 DB 조회 결과 각각 0건이므로 환산 로직 없이 `makeup_obligations`/`makeup_events`(§3.7), `payout_items`/`payout_batches`를 빈 테이블로 시작한다.
4. **외부 이벤트 중복 방지 → `external_event_receipts`로 일반화(확정)**: Stripe 웹훅에 국한하지 않고 Google Calendar/Drive/Workspace Events API를 포함한 모든 외부 이벤트에 `(provider, event_id)` unique 원장(§3.13)을 적용한다. 기존 `credit_purchases`에 이력 데이터가 없으므로(§9-2에서 이관하지 않기로 확정) 중복 스캔 자체가 불필요해졌다.
5. **과목 대화방 정체성 → teacher_assignment 기준 유지(v2 제안 철회, 확정)**: v2에서 제안했던 "subject_enrollment 기준 단일 스레드" 설계는 기획자가 철회했다. `product-architecture-v3.md` §4.11을 그대로 유지하고 Gate B 설계도 §4.11에 맞춰 원복했다 — `subject_threads`는 `teacher_assignment` 1건당 1개, 배정이 `active`가 될 때 자동 생성, `ended`가 되면 즉시 `archived`(읽기 전용)로 전환하고 새 배정에 새 스레드를 자동 생성한다(§3.14, §5.3). 학생·보호자는 같은 `subject_enrollment`의 active+archived 스레드를 전부 조회 가능, 선생님은 본인이 담당한 배정의 스레드만 조회(종료된 선생님과 새 선생님은 서로의 스레드를 볼 수 없음), 관리자는 전체 조회. `product-architecture-v3.md`는 변경하지 않는다 — 두 문서 간 모순이 이번 개정으로 해소됐다.

1~5 전부 확정된 결정이며 현재 스키마에서 v3로의 매핑 경로가 막히는 지점은 없다.
