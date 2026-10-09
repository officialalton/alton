-- 2026-09-28 — 초기 고객 절차 단순화, 빠진 연결고리 보강
-- (docs/2026-09-26-consent-contract-simplification-implementation-plan.md 3단계)
--
-- 배경: 상담 경로(consultations.child_id 기준)의 체험수업권 지급
-- (grant_trial_entitlement_for_consultation)은 지금까지 보호자가 "체험 Smart
-- Notes 동의" 화면에서 동의 버튼을 눌러야만(record_trial_smart_notes_consent
-- 안에서 호출) 트리거됐다. 그 동의 화면·버튼을 이번 라운드에서 제거했으므로
-- (app/consult/trial-onboarding/page.tsx, TrialConsentButton.tsx 삭제), 이
-- 경로의 자동 지급 트리거가 사라진 채로 방치될 뻔했다 — 관리자가 매번
-- "재처리" 버튼(admin_retry_trial_entitlement_grant)을 수동으로 눌러야만
-- 지급되는 상태가 될 뻔한 것을 이번 마이그레이션으로 막는다.
--
-- 직접생성 경로(finalize_trial_onboarding_students, 20261481000000)가 이미
-- 하고 있는 것과 동일하게, 관리자가 admin_record_consultation_outcome()으로
-- outcome='trial_recommended'를 기록하는 바로 그 시점에 자동으로
-- grant_trial_entitlement_for_consultation()을 pending→granted/failed
-- 패턴으로 즉시 시도한다(admin_retry_trial_entitlement_grant()가 쓰던 것과
-- 같은 패턴 재사용). 실패해도(예: child_id 아직 없음) 상담 결과 기록 자체는
-- 성공시키고, 관리자 재처리 버튼은 그대로 fallback으로 남는다.

create or replace function public.admin_record_consultation_outcome(
  p_consultation_id uuid,
  p_outcome consult_outcome,
  p_notes text,
  p_admin_review_summary text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row consultations;
  v_grant_id uuid;
begin
  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if not (is_admin() or v_row.admissions_consultant_id = auth.uid()) then
    raise exception '관리자 또는 담당 컨설턴트만 상담 결과를 기록할 수 있습니다.';
  end if;

  if p_admin_review_summary is null or btrim(p_admin_review_summary) = '' then
    raise exception '검토 요약을 작성해야 상담 결과를 기록할 수 있습니다(공백 불가).';
  end if;

  update consultations set
    status = case when status = 'scheduled' then 'completed' else status end,
    completed_at = coalesce(completed_at, now()),
    outcome = p_outcome,
    outcome_notes = coalesce(p_notes, outcome_notes),
    admin_review_summary = p_admin_review_summary,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, v_row.status, v_row.status, auth.uid(), '상담 결과 기록: ' || p_outcome::text);

  -- 2026-09-28: 체험 Smart Notes 동의 화면 제거로 사라진 지급 트리거를
  -- 대체 — outcome이 방금 'trial_recommended'로 기록됐고 아직 지급 전이면
  -- 바로 시도한다. 동의 게이트 자체가 없어졌으므로(2단계-B/C) 이 시도는
  -- child_id가 이미 연결돼 있는 한 항상 성공한다.
  if p_outcome = 'trial_recommended'
     and coalesce(v_row.trial_entitlement_grant_status, 'not_applicable') != 'granted' then
    update consultations set trial_entitlement_grant_status = 'pending' where id = p_consultation_id;
    begin
      v_grant_id := grant_trial_entitlement_for_consultation(p_consultation_id);
      update consultations set
        trial_entitlement_grant_id = v_grant_id,
        trial_entitlement_grant_status = 'granted',
        trial_entitlement_grant_error = null
      where id = p_consultation_id
      returning * into v_row;
    exception when others then
      update consultations set
        trial_entitlement_grant_status = 'failed',
        trial_entitlement_grant_error = sqlerrm
      where id = p_consultation_id
      returning * into v_row;
    end;
  end if;

  return v_row;
end;
$$;

comment on function public.admin_record_consultation_outcome(uuid, consult_outcome, text, text) is
  '2026-09-28: 관리자 검토 요약 작성만 필수(동의·Smart Notes 게이트 전부 제거). '
  'outcome=''trial_recommended''로 기록되는 즉시 체험수업권 지급을 자동 시도한다 '
  '(옛 체험 Smart Notes 동의 화면이 하던 트리거를 대체 — 초기 고객 절차 단순화). '
  '관리자 또는 담당 컨설턴트만 호출 가능(2026-09-23 R15-A 유지).';
