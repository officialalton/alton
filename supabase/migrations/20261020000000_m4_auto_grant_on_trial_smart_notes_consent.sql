-- M4 후속(사용자 요청) — 체험 Smart Notes 동의 시점에 체험수업권을 자동
-- 지급한다. 지금까지는 상담 결과 기록(outcome='trial_recommended') 시점에
-- 딱 한 번만 지급을 시도했는데, 그 시점엔 보통 아직 child_id가 없는
-- 잠재고객 단계라 항상 실패("연결된 학생 계정이 없어...")로 남고, 관리자가
-- 화면에서 수동으로 "재시도" 버튼을 눌러야만 다음 단계로 넘어갔다(2026-09-04
-- 실사용 확인). record_trial_smart_notes_consent()는 이미 SECURITY DEFINER라
-- grant_trial_entitlement_for_consultation()(authenticated에서 직접 호출
-- 불가)을 내부에서 그대로 호출할 수 있다 — admin_retry_trial_entitlement_grant()
-- 와 동일한 pending→granted/failed 기록 패턴을 그대로 재사용한다.

create or replace function public.record_trial_smart_notes_consent(
  p_child_id uuid,
  p_policy_version text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_guardian_id uuid := auth.uid();
  v_existing_id uuid;
  v_new_id uuid;
  v_consultation_id uuid;
  v_grant_id uuid;
begin
  if v_guardian_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (
    select 1 from household_members hm
    join household_members hc on hc.household_id = hm.household_id
    where hm.profile_id = v_guardian_id and hm.role = 'guardian'
      and hc.profile_id = p_child_id and hc.role = 'child'
  ) then
    raise exception '본인 가족의 자녀에 대해서만 동의를 기록할 수 있습니다.';
  end if;

  select id into v_existing_id from trial_smart_notes_consents where child_id = p_child_id;
  if v_existing_id is not null then
    v_new_id := v_existing_id; -- 멱등: 이미 동의했으면 그대로 반환(재확인 요구 안 함).
  else
    insert into trial_smart_notes_consents (child_id, guardian_id, policy_version, confirmed_ip)
    values (
      p_child_id, v_guardian_id, p_policy_version,
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for'
    )
    returning id into v_new_id;
  end if;

  -- 이 동의로 지급 가능해진 체험수업권을 즉시 시도한다. 실패해도 동의 기록
  -- 자체는 되돌리지 않는다 — 관리자 화면의 "지급 재시도" 버튼이 여전히
  -- fallback으로 남아있다.
  select id into v_consultation_id
  from consultations
  where child_id = p_child_id and outcome = 'trial_recommended'
    and coalesce(trial_entitlement_grant_status, 'not_applicable') != 'granted'
  order by created_at desc
  limit 1;

  if v_consultation_id is not null then
    update consultations set trial_entitlement_grant_status = 'pending' where id = v_consultation_id;
    begin
      v_grant_id := grant_trial_entitlement_for_consultation(v_consultation_id);
      update consultations set
        trial_entitlement_grant_id = v_grant_id,
        trial_entitlement_grant_status = 'granted',
        trial_entitlement_grant_error = null
      where id = v_consultation_id;
    exception when others then
      update consultations set
        trial_entitlement_grant_status = 'failed',
        trial_entitlement_grant_error = sqlerrm
      where id = v_consultation_id;
    end;
  end if;

  return v_new_id;
end;
$$;
revoke execute on function public.record_trial_smart_notes_consent(uuid, text) from public, anon;
grant execute on function public.record_trial_smart_notes_consent(uuid, text) to authenticated, service_role;
