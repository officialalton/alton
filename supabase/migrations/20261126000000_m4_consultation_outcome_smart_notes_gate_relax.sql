-- M4 후속(2026-09-06, UAT 중 발견·제품 오너 확정) — 상담 결과 기록(admin_record_consultation_outcome)이
-- Smart Notes 원본이 이 상담에 실제로 자동 연결(smart_notes_drive_file_id)됐는지까지
-- 요구하고 있었다. 실제 운영 흐름에서는 관리자가 상담이 끝나자마자(원본 연결은
-- 비동기 Workspace 이벤트 처리라 시간이 걸림) 바로 리뷰를 작성하고 결과를 기록하려는
-- 경우가 대부분이라, 이 조건이 정상 업무 흐름을 막고 있었다.
--
-- 확정 정책: 동의 확인(consent_confirmed_at)과 Smart Notes 활성화(smart_notes_config_status
-- ='applied')는 "녹음이 허용된 상태였는가"를 보장하는 사전 요건이라 그대로 유지한다.
-- 원본 파일이 실제로 이 상담 행에 연결됐는지(smart_notes_drive_file_id)는 사후
-- 산출물 도착 여부일 뿐이므로 결과 기록을 막지 않는다 — 원본은 나중에 도착하면
-- 자동 연결(또는 관리자 수동 재처리)되고, 상담 상세에서 그 링크로 들어가 확인만
-- 가능하면 된다(이미 존재하는 smart_notes_drive_file_id 노출 그대로 유지).

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
  if v_row.smart_notes_config_status is distinct from 'applied' then
    raise exception 'Smart Notes 활성화가 확인되지 않아 상담 결과를 기록할 수 없습니다(smart_notes_config_status: %).', v_row.smart_notes_config_status;
  end if;
  -- 2026-09-06 제거: smart_notes_drive_file_id(원본 실제 연결)는 더 이상 결과 기록을
  -- 막지 않는다 — 비동기 도착 산출물이라 관리자의 즉시 리뷰 작성 흐름과 맞지 않았다.
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
  '2026-09-06 완화: 상담 결과 기록은 동의 확인 + Smart Notes 활성화(applied) + 관리자
  검토 요약만 요구한다. Smart Notes 원본이 이 상담에 실제로 연결됐는지(smart_notes_drive_file_id)는
  비동기 도착 산출물이라 더 이상 막지 않는다 — 원본은 나중에 도착하면 그대로
  연결되고 상담 상세에서 확인 가능하다.';
