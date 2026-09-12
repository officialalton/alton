-- M4 후속 정정(2026-09-06) — "정규 진행 권장"(regular_recommended, 체험 생략)
-- 경로가 학생 계정 생성 이후 막다른 상태였던 문제를 고친다.
--
-- 문제: _create_student_kanban_card()(최신본은 20261211000000)가 새로
-- 생성하는 학생별 칸반 카드의 outcome을 항상 'trial_recommended'로
-- 하드코딩하고 있었다. 그 결과 원 카드(가족 카드)의 outcome이
-- 'regular_recommended'였어도 학생별 자녀 카드는 'trial_recommended'로
-- 만들어져, 관리자 화면(ConsultationKanbanBoard)의 "체험 온보딩" 전용 UI로
-- 잘못 분기되고 정규 계약 발송 UI 노출 조건(outcome === 'regular_recommended')을
-- 영영 충족할 수 없었다.
--
-- 수정: 하드코딩 대신 원 카드(v_root)의 outcome을 그대로 물려준다. 체험수업권
-- 자동 지급 시도(20261211000000이 추가한 로직)는 outcome이
-- 'trial_recommended'인 카드에 대해서만 그대로 유지한다 — regular_recommended
-- 경로는 체험 자체가 없으므로 체험수업권 지급 대상이 아니다(시도하지 않음,
-- trial_entitlement_grant_status는 기본값 'not_applicable' 그대로 유지되고
-- 이는 정확한 표현이다). 그 외 로직(멱등 insert, source_link_child_id 유니크
-- 제약, 지급 실패해도 카드 생성 자체는 롤백하지 않음)은 기존과 동일.
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
  v_outcome consult_outcome;
begin
  select * into v_root from consultations where id = p_root_consultation_id;
  if not found then
    return;
  end if;
  select * into v_student from trial_onboarding_link_students where id = p_link_student_id;
  if not found then
    return;
  end if;

  v_outcome := coalesce(v_root.outcome, 'trial_recommended');

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
    v_root.scheduled_at, v_root.completed_at, v_outcome, v_root.outcome_notes, v_root.prospect_contact_id,
    coalesce(v_root.trial_intent_confirmed_at, now()), p_root_consultation_id, true,
    p_link_student_id
  )
  on conflict (source_link_child_id) where source_link_child_id is not null do nothing
  returning id into v_new_card_id;

  if v_new_card_id is null then
    return; -- 이미 카드가 있었다(멱등 재호출) — 지급 시도도 중복하지 않는다.
  end if;

  if v_outcome <> 'trial_recommended' then
    return; -- regular_recommended(체험 생략) 등은 체험수업권 지급 대상이 아니다.
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
  '2026-09-06 정정: 학생별 카드의 outcome을 원 카드(v_root)에서 그대로 물려받는다(이전에는 trial_recommended로 하드코딩돼 regular_recommended 경로의 학생 카드가 체험 온보딩 UI로 잘못 분기됐다). 체험수업권 자동 지급 시도는 outcome=trial_recommended인 카드에만 그대로 적용(20261211000000 로직 유지). 그 외 동작(멱등 insert)은 동일.';
