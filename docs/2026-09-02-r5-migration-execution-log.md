# R5 실행 로그 — 과목 수강·선생님 배정 (2026-09-02)

이 문서는 R5(과목 수강/선생님 배정) 구현 세션의 실측 작업 기록이다. 요약은
`docs/CURRENT.md`와 `docs/2026-08-29-master-roadmap-v3.md`의 R5 섹션에 있다.

## 0. 발견 — R1에서 이미 구현된 부분

세션 시작 시 `subject_enrollments`/`teacher_assignments` 테이블이 이미 R1
(`supabase/migrations/20260830020000_r1_enrollment_assignment.sql`)에서 만들어져
있었고, 다음이 이미 완료 상태였다:

- 테이블 자체(`status`, `progress`, `effective_from/until`, `reason`, `changed_by` 컬럼).
- `subject_enrollments_one_live_per_subject` unique index(과목당 동시 active/paused 1개).
- `teacher_assignments_no_overlap` exclusion constraint(gist, planned/active 기간 겹침 차단).
- `20260830080000_r1_rls_policies.sql`의 RLS(아이/보호자/배정 선생님/관리자·매칭권한).
- `20260830100000_r1_teacher_rate_integrity.sql`의 시급 무결성 강제(`has_valid_current_teacher_rate()`,
  `set_teacher_rate()`, `teacher_assignments_enforce_rate` 트리거 등) — teacher_assignments INSERT
  시점에 이미 시급 검증이 DB 레벨로 강제되고 있었다.

그러나 `app`/`lib` 어디에도 이 두 테이블을 참조하는 코드가 전혀 없었다(grep 확인) — 즉
스키마·제약·RLS만 준비돼 있고 앱 레이어(활성화 판단, 승계 판단, 선생님 변경 원자성, 채팅
스레드 연동, 문서 권한, 관리자/역할 화면)는 이번 세션에서 처음 만들었다.

## 1. 신규 마이그레이션

- `supabase/migrations/20260925000000_r5_subject_enrollment_teacher_assignment.sql`
  - `subject_enrollment_activation_ready(uuid)` — 계약 active + 결제완료(purchases.status='succeeded')
    entitlement_grants 존재를 둘 다 실측 조회(fail closed).
  - `subject_enrollments_enforce_activation` 트리거 — planned/paused→active UPDATE 시 위 함수로 강제.
  - `trial_teacher_succession_eligibility(teacher_id, subject_id)` — is_active/has_subject_qualification
    (`teacher_curriculum_templates` 행 존재)/has_curriculum(그 템플릿에 unit 1개 이상)/has_valid_rate를
    독립 컬럼으로 반환, eligible은 이 중 커리큘럼을 제외한 3개.
  - `change_teacher_assignment(subject_enrollment_id, new_teacher_id, effective_from, reason, changed_by)`
    — 기존 활성 배정 종료(UPDATE) + 신규 배정 생성(INSERT) + 스레드 archive + 문서권한 재처리
    큐 등록을 단일 PL/pgSQL 함수(=단일 트랜잭션)로 원자적 처리. 행 잠금(`for update`)으로 동시
    변경 직렬화(시급 변경의 `set_teacher_rate()`와 동일 패턴).
  - `subject_threads`/`subject_thread_messages` 신규 테이블 + RLS(archived 스레드는 새 메시지 작성 불가).
  - `teacher_assignments.curriculum_handoff_status` placeholder 컬럼(not_applicable/pending/done,
    done 전이는 R9에서 구현).
  - `document_permission_retries` 신규 테이블(R3 `contract_activation_retries`와 동일한 재처리
    work-item 패턴) + RLS(관리자만 조회/갱신, INSERT는 `change_teacher_assignment()`만).
- `supabase/migrations/20260925010000_r5_subject_thread_auto_create.sql`
  - `ensure_subject_thread_for_assignment()` 트리거(AFTER INSERT ON teacher_assignments) — 최초
    배정(관리자가 `change_teacher_assignment()`를 거치지 않고 직접 INSERT하는 경로,
    `assignTeacherToSubjectEnrollment()`)에도 스레드가 항상 생기도록 보장.
  - **버그 발견·수정**: 원래 `change_teacher_assignment()` 안에서 "새 teacher_assignments INSERT
    → 스레드 archive UPDATE" 순서였는데, 이 트리거를 추가하면 INSERT 시점에 새 스레드가 먼저
    생겨 그 다음 archive UPDATE(`where status='active'`)가 방금 만든 새 스레드까지 archived로
    잘못 바꿔버리는 순서 문제가 있었다. `20260925000000` 파일 안에서 순서를 "archive UPDATE
    먼저 → INSERT 나중"으로 고쳐 해결(Playwright 테스트로 검증, 아래 §3).

두 마이그레이션 모두 `npx supabase db reset --local`과 `npx supabase db push --linked`로
로컬·원격(`worpsqwqgnspddnrtnvq.supabase.co`) 둘 다 적용 확인.

## 2. 앱 레이어

- `lib/enrollment/subject-enrollment-decision.ts` — DB를 읽지도 쓰지도 않는 순수 판단 함수
  (`decideSubjectEnrollmentActivation`, `decideReturningSubjectEnrollment`,
  `decideTrialTeacherSuccessionProposal`). `lib/contracts/returning-member-decision.ts`와 동일한
  설계 원칙(판단과 조회를 분리, 테스트하기 쉽게).
  - `decideReturningSubjectEnrollment`는 "오래 쉬었다 돌아온 회원은 과거 종료된
    subject_enrollments 행을 절대 재사용하지 않고 항상 새 행을 만든다"는 spec 정책을 그대로
    담았다 — 살아있는(planned/active/paused) 행이 있으면 그걸 재사용, 없으면 과거 이력 유무와
    무관하게 항상 신규 생성.
- `app/admin/subject-enrollment-actions.ts` — 관리자 서버 액션. 목록 조회, 신규 수강 계획
  (`planSubjectEnrollment`, 복귀 회원 판단 함수 재사용), 활성화 사전확인/실행, 승계 자격 확인,
  최초 배정, 미래 예약 영향 조회(읽기 전용, 실제 취소/이전 안 함 — R6 범위 명시), 선생님 변경
  (`change_teacher_assignment` RPC 호출), 배정 이력, 문서 권한 재처리 큐 조회.
- `lib/documents/permission-retry-worker.ts` — R8 경계를 `applyDrivePermissionChange()` 함수
  하나로 좁힌 stub. 현재는 항상 실패를 반환(실제 Drive 미구현 명시), claim→처리→상태 전이
  (queued→succeeded/failed/manual_review, 5회 한도)는 `lib/drive-artifacts.ts`(R3)와 동일한
  패턴으로 구현. R8에서 `applyDrivePermissionChange`의 본문만 실제 Drive Admin SDK 호출로
  교체하면 된다.

## 3. 관리자 UI

`app/admin/SubjectEnrollmentPanel.tsx`를 기존 `MatchingTab.tsx`(NAV `matching` 탭) 안에
추가 섹션으로 통합했다(spec: 큰 신규 최상위 화면을 만들지 않는다). 학생 선택 → 과목 수강
목록(상태·현재 선생님) → 신규 수강 계획 생성 → 활성화(사전조건 미충족 시 안내 메시지,
raw DB 에러 노출 안 함) → 최초 배정(승계 자격 사전확인 후 배정) → 선생님 변경(새 선생님·
효과일·사유 입력, 변경 후 "확정된 미래 예약은 자동 이전되지 않는다" 안내) → 배정 이력·
미래 예약 영향 펼쳐보기 → 문서 권한 재처리 큐 조회.

## 4. 테스트

- `lib/enrollment/subject-enrollment-decision.test.ts` — 10건, 순수 판단 로직(활성화 가능/불가
  사유 3종, 복귀 회원 결정 3종, 승계 제안 가능/차단 3종).
- `app/admin/SubjectEnrollmentPanel.test.tsx` — 2건(목록 로드·표시, 활성화 차단 시 raw 에러
  대신 안내 메시지 노출 확인).
- `app/admin/MatchingTab.test.tsx` — 기존 5건 유지, `SubjectEnrollmentPanel`을 mock 처리해
  (해당 테스트는 "매칭 대기 학생만 보인다"는 별개 관심사를 검증하므로 충돌 회피).
- `e2e/r5-subject-enrollment-teacher-assignment.spec.ts` — Playwright 기반이지만 브라우저를
  쓰지 않고 `psql`로 DB 함수/제약을 직접 실행 검증(`e2e/r4-admin-entitlement-ledger.spec.ts`와
  동일한 패턴), `test.describe.configure({ mode: "serial" })`로 순서 보장(이 레포의 알려진
  fullyParallel 레이스 이슈 회피). 8건 전부 통과:
  1. 계약 미active+수업권無 → 활성화 차단(활성화 RPC false, UPDATE 자체가 트리거로 거부).
  2. 계약 active + 결제완료 entitlement_grants 생성 → 활성화 성공.
  3. `teacher_assignments`가 시급 없는 선생님(status=pending) 배정을 차단.
  4. 유효 시급 있는 active 선생님 최초 배정 성공.
  5. 같은 수강에 두 번째 active 배정 시도 → exclusion constraint로 차단.
  6. `trial_teacher_succession_eligibility` — 자격+커리큘럼 모두 있는 경우와, 자격 자체가
     없는 다른 과목의 경우를 독립 컬럼으로 정확히 구분해 반환.
  7. `change_teacher_assignment` 원자성 — 기존 배정 ended+effective_until 기록, 신규 배정
     active+curriculum_handoff_status='pending', 기존 스레드 archived 1건+신규 active 스레드
     1건, `document_permission_retries`에 revoke(구 선생님)+grant(신규 선생님) 둘 다 큐잉.
  8. 변경 후에도 해당 수강에 active 배정은 정확히 1건(불변 확인).

## 5. 회귀 테스트(R5 종료 시)

- `npx tsc --noEmit` — 에러 0.
- `npx vitest run` — 113개 파일 / 655건 전부 통과(R5 신규 12건 포함, 기존 643건 그대로 유지 —
  R4까지의 111파일/644건에서 R5로 2파일/11건 순증가, MatchingTab.test.tsx는 SubjectEnrollmentPanel
  mock 추가로 파일 수 불변이지만 테스트 건수는 그대로 5건).
- `npx supabase db reset --local` — 전체 마이그레이션(R5 2건 포함) 재적용 성공, 에러 없음.
- `npx playwright test --workers=1 --reporter=list` — 46건 전부 통과(R4까지 38건 + R5 신규 8건).
  기존 R1~R4 스펙 전부 그대로 통과 — R5 변경으로 인한 회귀 없음.

## 6. 외부 변경

- Supabase 원격 개발 프로젝트(`worpsqwqgnspddnrtnvq.supabase.co`)에 `npx supabase db push --linked`로
  R5 마이그레이션 2건 적용(additive — DROP/컬럼 삭제 없음). `npx supabase migration list --linked`로
  로컬=원격 일치 확인.
- Vercel/Google Workspace/Stripe/DocuSign 등 다른 외부 서비스는 이 세션에서 전혀 호출하지 않음.
- Production 배포 없음. 모든 기존 feature flag(`WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`,
  `WORKSPACE_PREFLIGHT_ALLOW_REAL_READS`)는 건드리지 않음(기본값 `false` 그대로).
- **Vercel Preview 배포+브라우저 검증은 이번 세션에서 수행하지 않았다** — R5 스펙이 허용한
  "1회 최종 Preview 배포·검증"을 아직 쓰지 않은 상태. 다음 세션에서 역할별 화면을 마저 만든
  뒤 함께 검증하는 편이 낫다고 판단(현재는 관리자 화면만 있고 학생/보호자/선생님 화면이 없어
  Preview에서 볼 수 있는 것이 관리자 매칭 탭뿐).

## 7. 남은 작업

`docs/2026-08-29-master-roadmap-v3.md`의 R5 섹션 "R5 미완료(다음 세션)" 참고 — 요약하면
역할별(학생/보호자/선생님) 화면, R2 선생님 온보딩 화면의 시급 사전확인 로직 재사용,
전용 role E2E, 동시성 전용 테스트, Vercel Preview 검증이 남았다.
