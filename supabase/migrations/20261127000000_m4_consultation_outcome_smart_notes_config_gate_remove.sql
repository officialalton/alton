-- M4 후속(2026-09-06, 제품 오너 확정) — 20261126000000이 Smart Notes 원본 실제 연결
-- (smart_notes_drive_file_id) 요건만 제거했는데, Smart Notes 활성화 여부
-- (smart_notes_config_status='applied') 체크도 실질적인 의미가 없다고 확정됐다
-- (기록 생성 자체는 항상 일어나므로 이 상태값이 상담 결과 기록을 막을 이유가
-- 없음). 동의 확인(consent_confirmed_at)과 관리자 검토 요약만 남긴다.

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
  if not is_admin() then
    raise exception '관리자만 상담 결과를 기록할 수 있습니다.';
  end if;

  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;

  if v_row.consent_version_id is null or v_row.consent_confirmed_at is null then
    raise exception '동의 확인이 완료되지 않아 상담 결과를 기록할 수 없습니다(consent_confirmed_at 없음).';
  end if;
  -- 2026-09-06 제거: Smart Notes 활성화 상태(smart_notes_config_status)는 더 이상
  -- 상담 결과 기록을 막지 않는다(기록 생성 자체는 항상 일어남 — 제품 오너 확정).
  if p_admin_review_summary is null or btrim(p_admin_review_summary) = '' then
    raise exception '관리자 검토 요약을 작성해야 상담 결과를 기록할 수 있습니다(공백 불가).';
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

  if p_outcome = 'trial_recommended' then
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
revoke execute on function public.admin_record_consultation_outcome(uuid, consult_outcome, text, text) from public, anon;
grant execute on function public.admin_record_consultation_outcome(uuid, consult_outcome, text, text) to authenticated;

comment on function public.admin_record_consultation_outcome(uuid, consult_outcome, text, text) is
  '2026-09-06 추가 완화: 상담 결과 기록은 동의 확인 + 관리자 검토 요약만 요구한다.
  Smart Notes 활성화 상태·원본 실제 연결 여부는 더 이상 막지 않는다(둘 다 제품
  오너 확정 — 기록 생성 자체는 항상 일어나고, 원본은 나중에 도착하면 상담
  상세에서 그대로 확인 가능).';
