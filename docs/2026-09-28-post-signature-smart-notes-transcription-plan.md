# 정규 수업 AI 기록(Smart Notes + 대화 전사) — 계약 서명 후 적용 구현 계획

작성일: 2026-09-28
근거: `docs/2026-09-26-consent-contract-simplification-implementation-plan.md`(완료),
`docs/2026-09-26-consent-contract-ai-records-simplification-prd.md`
상태: **계획만 확정, 구현 착수 전**

## 0. 정책 (확정)

- 첫 상담·체험 수업·**계약 미서명 상태의 정규 수업**에는 Smart Notes/AI 요약/
  전사를 생성하지 않는다.
- 정규 수업(regular lesson)에 대해서만, 그리고 그 학생의 **가족계약이
  `active`(현재 버전 서명 완료) 상태일 때만** AI 기록을 생성한다.
- 별도의 "정규 AI 기록 동의" 절차는 만들지 않는다 — 가족계약 서명 자체가
  Smart Notes 조항(제12조)에 대한 사전 동의이며, 이는 이미
  `20261008000000_r6_smart_notes_contract_clause_simplification.sql`에서
  확정된 정책이다(재확인만 하고 뒤집지 않는다).
- 기존 R6 opt-out 게이트(`ai_notes_consent_events`/`has_ai_notes_consent`,
  보호자가 개별적으로 끌 수 있는 기능)는 계약 서명 여부와 **별개의 축**으로
  계속 유지한다 — 이번 작업은 "언제부터 적용 대상이 되는가"만 다루고,
  "적용 대상이어도 보호자가 끌 수 있는가"는 건드리지 않는다.
- 체험 예약의 `smart_notes_status='not_applicable'` 처리
  (`20261900000017_p0_trial_consent_removal_and_smart_notes_scope.sql`)는
  그대로 둔다.

## 1. 현재 코드 상태 조사 (2026-09-28 기준, 이 문서 작성 시점 확인)

1. `confirm_lesson_booking()` 최신 정의
   (`supabase/migrations/20261900000017_p0_trial_consent_removal_and_smart_notes_scope.sql:178-250`)
   는 예약 시점에 다음 한 줄로 `smart_notes_status`를 결정한다:
   ```sql
   v_smart_notes_status := case when v_is_trial then 'not_applicable' else 'pending' end;
   ```
   즉 **체험이 아니기만 하면 계약 서명 여부와 무관하게 무조건 'pending'이다.**
   이것이 이번 작업에서 고쳐야 할 지점이다.

2. `subject_enrollment_activation_ready()`
   (`supabase/migrations/20260925000000_r5_subject_enrollment_teacher_assignment.sql:17-32`)
   는 `subject_enrollments.status`를 `planned → active`로 전이할 때
   `contracts.status = 'active'`(+ 결제완료 수업권)를 요구하고, 트리거
   (`enforce_subject_enrollment_activation_preconditions`, 같은 파일 41-55)로
   우회를 막는다. **다만 이것은 "과목 수강을 활성화할 수 있는가"를 막을 뿐,
   `confirm_lesson_booking()`이 `subject_enrollment_id`의 현재 `status`를
   직접 조회해서 예약 자체를 막는지는 이번 조사에서 확인하지 못했다** —
   `20261900000017` 파일 안에서는 `subject_enrollments` 테이블을 전혀
   참조하지 않는다. **다음 세션 착수 시 반드시 먼저 확인**: 계약 미서명
   상태의(`planned` 상태) `subject_enrollment_id`로 `confirm_lesson_booking`을
   호출하면 지금 실제로 막히는지(다른 검증 — `is_teacher_slot_open`,
   `teacher_assignments` 존재 여부 등 — 이 간접적으로 막고 있을 수도 있음),
   아니면 통과되는지. 통과된다면 이 문서의 2단계-A가 유일한 방어선이 되므로
   우선순위가 올라간다.

3. R6 AI 기록 opt-out 게이트
   (`supabase/migrations/20261001000000_r6_ai_notes_consent_gate.sql`) —
   `has_ai_notes_consent(student_id)`가 `ai_notes_consent_events`의 가장 최근
   미철회 레코드를 보고, 이력이 없으면 기본 `true`(opt-out 모델). 이 판정은
   현재도 정규 수업 예약 시 어딘가에서 `smart_notes_status`를
   `pending`/`disabled_by_guardian`로 가르는 데 쓰이고 있었다(R6 4/N,
   `20261001000000`에서 재확인 필요 — 이번 조사에서 전체를 다 읽지 않음).
   **이번 변경은 이 축을 대체하는 것이 아니라, 그 앞에 "계약 서명"이라는
   더 이른 게이트를 추가하는 것**이다. 최종 판정은
   `not_signed → not_applicable`, `signed + opt-out → disabled_by_guardian`,
   `signed + opt-in(기본) → pending` 세 갈래가 되어야 한다.

4. 세션 생성 후 실제 Smart Notes/전사 처리(Workspace 웹훅,
   `smart_notes_generation_events`)는 `sessions.smart_notes_status`를 보고
   동작 여부를 정하는 것으로 보인다(`20261008000000` 파일 주석 참고). 즉
   **`confirm_lesson_booking()` 시점의 스냅샷 값만 정확히 고치면, 그 이후
   파이프라인은 코드 변경 없이 정책을 따라가야 한다** — 이 가정을 2단계-B
   테스트에서 검증한다.

## 2. 구현 순서

### 2단계-A — DB: `confirm_lesson_booking()`에 계약 서명 게이트 추가 (additive migration)

새 마이그레이션(다음 세션 착수 시 `ls supabase/migrations | tail -10`으로
번호 재확인 후 진행 — 이 문서 작성 시점 최신 파일은
`20261900000030_p0_contract_dispatch_outbox.sql`):

```sql
create or replace function public.confirm_lesson_booking(
  ... (기존 시그니처 그대로)
) returns table (reservation_id uuid, session_id uuid)
  language plpgsql security definer set search_path = public as $$
declare
  ...
  v_contract_signed boolean;
begin
  ...
  -- v_is_trial 판정 다음에 추가:
  if not v_is_trial then
    select exists (
      select 1 from subject_enrollments se
      join contracts c on c.id = se.contract_id
      where se.id = p_subject_enrollment_id and c.status = 'active'
    ) into v_contract_signed;
  end if;

  v_smart_notes_status := case
    when v_is_trial then 'not_applicable'
    when not v_contract_signed then 'not_applicable'
    when has_ai_notes_consent(p_child_id) then 'pending'
    else 'disabled_by_guardian'
  end;
  ...
$$;
```

- `has_ai_notes_consent` 호출을 여기서 추가할지, 아니면 이미 다른 어딘가에서
  하고 있어서 중복이 되는지 — **1번 조사 항목의 결과에 따라 조정**. 이미
  R6 4/N 어딘가에서 이 조합을 하고 있다면 이번 변경은 `v_contract_signed`
  분기만 추가하면 된다.
- `comment on function`에 변경 이력 한 줄 추가(이 저장소 컨벤션).
- `contracts` 테이블에 이미 있는 `status` 컬럼/enum을 그대로 쓴다 — 새
  상태를 추가하지 않는다(R3 정책, `20260913000000` 주석 참고).

### 2단계-B — 테스트

- 통합 테스트(신규 또는 기존 `confirm_lesson_booking` 관련 테스트 파일에 추가):
  - 계약 미서명(`contracts.status != 'active'`) + 정규 수업 예약 →
    `sessions.smart_notes_status = 'not_applicable'`.
  - 계약 서명 완료 + 정규 수업 예약 + 보호자 opt-in(기본) →
    `sessions.smart_notes_status = 'pending'`.
  - 계약 서명 완료 + 정규 수업 예약 + 보호자 opt-out →
    `sessions.smart_notes_status = 'disabled_by_guardian'`.
  - 체험 예약 → 계약 서명 여부와 무관하게 항상 `'not_applicable'`(회귀 방지 —
    기존 20261900000017 동작 유지 확인).
- E2E: 기존 골든패스 E2E(`e2e/m4-trial-to-regular-golden-path.spec.ts` 등)에
  회귀가 없는지 — 특히 "정규 진행" 이후 세션 예약 스텝이 있다면 그 지점에서
  계약 서명 순서가 스펙과 맞는지 확인.

### 2단계-C — 문서

- `docs/CURRENT.md`에 완료 반영.
- 이 문서 상단 "상태" 줄을 완료로 갱신.

## 3. 이번 범위에서 제외하는 것 (명시적으로 하지 않음)

- 이미 생성된 세션의 `smart_notes_status`를 소급 변경하지 않는다(과거
  데이터는 그대로).
- `ai_notes_consent_events`/opt-out UI(`app/parent/ConsentTab.tsx` 등) 변경
  없음 — 그대로 유지.
- 실시간 Meet 녹화/전사 기능 자체의 신규 개발 없음(R6 정책 그대로:
  "별도 녹화 기능을 만들지 않음").
- 계약 `status` state machine에 새 상태 추가 없음.

## 4. 롤백

- Additive migration이므로 `confirm_lesson_booking()`을 이전 정의로
  `create or replace`하면 즉시 롤백 가능. 데이터 손실 없음(신규 세션의
  `smart_notes_status` 판정 로직만 바뀜).
