-- M4 후속(2026-09-06, 제품 오너 실사용 발견 버그#1/#2) — additive.
--
-- 증상: 복수자녀 온보딩으로 만들어진 학생 계정이 학생 포털 "수업권" 탭에
-- 0장으로 나오고, 배정된 선생님이 있어도 예약 화면에 "예약 가능한 과목이
-- 없습니다"로 표시된다.
--
-- 원인(실측, worpsqwqgnspddnrtnvq 논프로드 psql 조회로 확인):
--   1) 단일 학생 경로(record_consultation_outcome, 20261012000000)는 상담
--      결과를 outcome='trial_recommended'로 기록하는 순간
--      grant_trial_entitlement_for_consultation()을 즉시 시도하고
--      consultations.trial_entitlement_grant_status를 pending→granted/failed로
--      기록한다. 반면 다자녀 경로가 학생별 칸반 카드를 만드는
--      _create_student_kanban_card()(20261206010000)는 consultations 행을
--      outcome='trial_recommended'로 직접 insert만 하고 이 지급 시도 자체를
--      호출하지 않는다 — trial_entitlement_grant_status가 기본값
--      'not_applicable'로 영원히 남아, 관리자 화면의 "체험수업권 지급 재처리"
--      버튼(status='failed'일 때만 노출, app/admin/ConsultationKanbanBoard.tsx)도
--      뜨지 않아 관리자가 문제를 알아챌 방법이 없었다.
--   2) app/student/lesson-booking-data.ts의 예약 후보 필터가 체험 학생은
--      hasTrialGrant(entitlement_grants에 trial_lesson_grant grant 존재)를
--      요구한다 — 즉 #2(예약 불가) 증상은 #1(수업권 미지급)의 직접적 결과다.
--      이 마이그레이션이 #1을 고치면 #2도 같은 학생에 대해 함께 풀린다(수업권
--      지급 게이트인 Smart Notes 동의·생년월일 확인 자체는 정책상 유효한 별도
--      단계이므로 그대로 둔다 — 이 마이그레이션은 "시도조차 안 됨"만 고친다).
--
-- 고침: _create_student_kanban_card()가 카드를 만든 직후
-- grant_trial_entitlement_for_consultation()을 pending→granted/failed 패턴으로
-- 똑같이 시도하도록 한다(record_consultation_outcome과 동일한 패턴 재사용).
-- 이러면 (a) 동의·생년월일 확인이 이미 끝난 학생은 카드 생성 즉시 정상
-- 지급되고, (b) 아직 안 끝난 학생은 상태가 'failed'로 남아 기존 "재처리"
-- 버튼이 정상적으로 노출되어 관리자가 후속 조치를 할 수 있다.

create or replace function public._create_student_kanban_card(
  p_root_consultation_id uuid,
  p_link_student_id uuid,
  p_child_auth_user_id uuid,
  p_household_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_root consultations%rowtype;
  v_student trial_onboarding_link_students%rowtype;
  v_new_card_id uuid;
  v_grant_id uuid;
begin
  select * into v_root from consultations where id = p_root_consultation_id;
  if not found then
    return;
  end if;
  select * into v_student from trial_onboarding_link_students where id = p_link_student_id;
  if not found then
    return;
  end if;

  insert into consultations (
    household_id, child_id, contact_name, contact_email, contact_phone,
    student_grade, category, concerns, status, source, starts_at, ends_at,
    scheduled_at, completed_at, outcome, outcome_notes, prospect_contact_id,
    trial_intent_confirmed_at, family_root_consultation_id, is_child_onboarding_card,
    source_link_child_id
  )
  values (
    p_household_id, p_child_auth_user_id, v_student.student_name, v_root.contact_email, v_root.contact_phone,
    coalesce(v_student.student_grade, v_root.student_grade), v_root.category, v_root.concerns,
    'completed', v_root.source, v_root.starts_at, v_root.ends_at,
    v_root.scheduled_at, v_root.completed_at, 'trial_recommended', v_root.outcome_notes, v_root.prospect_contact_id,
    coalesce(v_root.trial_intent_confirmed_at, now()), p_root_consultation_id, true,
    p_link_student_id
  )
  on conflict (source_link_child_id) where source_link_child_id is not null do nothing
  returning id into v_new_card_id;

  if v_new_card_id is null then
    return; -- 이미 카드가 있었다(멱등 재호출) — 지급 시도도 중복하지 않는다.
  end if;

  -- record_consultation_outcome()과 동일한 패턴: 지급 실패는 카드 생성 자체를
  -- 롤백하지 않는다(카드는 이미 커밋 대상, 관리자 재처리 버튼이 fallback).
  update consultations set trial_entitlement_grant_status = 'pending' where id = v_new_card_id;
  begin
    v_grant_id := grant_trial_entitlement_for_consultation(v_new_card_id);
    update consultations set
      trial_entitlement_grant_id = v_grant_id,
      trial_entitlement_grant_status = 'granted',
      trial_entitlement_grant_error = null
    where id = v_new_card_id;
  exception when others then
    update consultations set
      trial_entitlement_grant_status = 'failed',
      trial_entitlement_grant_error = sqlerrm
    where id = v_new_card_id;
  end;
end;
$$;
revoke execute on function public._create_student_kanban_card(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public._create_student_kanban_card(uuid, uuid, uuid, uuid) to service_role;

comment on function public._create_student_kanban_card(uuid, uuid, uuid, uuid) is
  '2026-09-06(버그 수정): 학생별 카드 생성 직후 grant_trial_entitlement_for_consultation()을 즉시 시도해 trial_entitlement_grant_status를 pending→granted/failed로 실제 기록한다(이전에는 이 호출 자체가 없어 not_applicable로 영원히 방치되고 관리자 재처리 버튼도 노출되지 않았다).';

-- =========================================================================
-- 관리자 화면 재처리 버튼 노출 조건 보강 참고: app/admin/ConsultationKanbanBoard.tsx
-- 는 이미 trial_entitlement_grant_status='failed'일 때만 버튼을 보여주는데,
-- 위 수정으로 다자녀 학생 카드도 이제 실패 시 'failed'로 정확히 기록되므로
-- 코드 변경 없이 그대로 노출된다(과거처럼 'not_applicable'에 영구히 갇히지
-- 않음). 이미 카드가 생성된 기존 학생(이번 사고로 방치된 카드)은 아래
-- 백필로 한 번 더 지급을 시도해 상태를 최신화한다.
-- =========================================================================
do $$
declare
  v_row record;
  v_grant_id uuid;
begin
  for v_row in
    select id from consultations
    where is_child_onboarding_card and outcome = 'trial_recommended'
      and trial_entitlement_grant_status = 'not_applicable'
  loop
    update consultations set trial_entitlement_grant_status = 'pending' where id = v_row.id;
    begin
      v_grant_id := grant_trial_entitlement_for_consultation(v_row.id);
      update consultations set
        trial_entitlement_grant_id = v_grant_id,
        trial_entitlement_grant_status = 'granted',
        trial_entitlement_grant_error = null
      where id = v_row.id;
    exception when others then
      update consultations set
        trial_entitlement_grant_status = 'failed',
        trial_entitlement_grant_error = sqlerrm
      where id = v_row.id;
    end;
  end loop;
end;
$$;
