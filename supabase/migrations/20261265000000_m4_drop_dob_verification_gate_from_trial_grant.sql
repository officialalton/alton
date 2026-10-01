-- 2026-09-09(UAT 지적, 제품 오너 정책 변경) — 체험수업권 지급 게이트에서
-- "관리자 생년월일 확인 완료" 요건을 제거한다.
--
-- 배경: M4 UAT #2 후속(20261102000000)에서 "체험수업 시작 전 관리자 확인"
-- 정책으로 추가됐던 게이트인데, 이번 Preview UAT에서 제품 오너가 이 게이트
-- 자체가 불필요하다고 판단해 폐기를 지시했다. profiles.date_of_birth_verified_at
-- 컬럼과 관리자 "생년월일 확인 완료" 버튼(verify_student_date_of_birth())은
-- 그대로 남긴다(다른 용도로 쓰일 수 있는 신원 확인 기록 자체는 유지, 체험수업권
-- 지급을 막는 역할만 제거). Smart Notes 동의 게이트는 그대로 유지한다.

create or replace function public.grant_trial_entitlement_for_consultation(
  p_consultation_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_child_id uuid;
  v_existing_grant_id uuid;
  v_new_grant_id uuid;
  v_trial_product_id uuid;
  v_expires_at timestamptz;
begin
  select child_id into v_child_id from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_child_id is null then
    raise exception '연결된 학생 계정이 없어 체험수업권을 지급할 수 없습니다(잠재고객 단계 — 정식 학생 계정 연결 후 재시도 필요).';
  end if;

  -- M4: 학생별 체험 Smart Notes 동의가 없으면 지급 자체를 막는다(요구사항 4·5).
  if not exists (select 1 from trial_smart_notes_consents where child_id = v_child_id) then
    raise exception '체험 Smart Notes 동의가 없어 체험수업권을 지급할 수 없습니다(학생 id: %).', v_child_id;
  end if;

  select id into v_existing_grant_id from entitlement_grants where source_consultation_id = p_consultation_id;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  -- M4: 상담 재처리/중복 상담으로 같은 학생에게 반복 지급되지 않도록 학생 기준으로도
  -- 방어(요구사항 5). 이미 이 학생 앞으로 활성 grant가 있으면 그 grant를 반환한다.
  select eg.id into v_existing_grant_id
  from entitlement_grants eg
  join entitlement_products ep on ep.id = eg.entitlement_product_id
  where eg.child_id = v_child_id and ep.code = 'trial_lesson_grant'
  limit 1;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  select id into v_trial_product_id from entitlement_products where code = 'trial_lesson_grant';
  if v_trial_product_id is null then
    raise exception '체험수업권 상품(trial_lesson_grant)이 존재하지 않습니다 — 마이그레이션 순서 문제.';
  end if;

  v_expires_at := now() + interval '90 days';

  begin
    insert into entitlement_grants (
      child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at,
      is_paid, source_consultation_id
    ) values (
      v_child_id, v_trial_product_id, null, 1, v_expires_at, false, p_consultation_id
    )
    returning id into v_new_grant_id;
  exception when unique_violation then
    select id into v_new_grant_id from entitlement_grants where source_consultation_id = p_consultation_id;
    if v_new_grant_id is not null then
      return v_new_grant_id;
    end if;
    raise;
  end;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (v_new_grant_id, 'grant', 1, 'trial_grant:' || p_consultation_id::text)
  on conflict do nothing;

  return v_new_grant_id;
end;
$$;
comment on function public.grant_trial_entitlement_for_consultation(uuid) is
  'M2 요구사항 2·4 + M4 동의 게이트: 학생별 체험 Smart Notes 동의가 있어야만, 그리고 '
  '학생당 정확히 1개만 지급. is_paid=false로 생성되므로 환불·이전 대상에서 자동 제외. '
  '2026-09-09: 관리자 생년월일 확인 게이트는 정책 변경으로 제거됨.';
revoke execute on function public.grant_trial_entitlement_for_consultation(uuid) from public, anon, authenticated;

create or replace function public.grant_trial_entitlement_for_student(
  p_child_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_existing_grant_id uuid;
  v_new_grant_id uuid;
  v_trial_product_id uuid;
  v_expires_at timestamptz;
begin
  if not exists (select 1 from profiles where id = p_child_id and role = 'student') then
    raise exception '학생 계정을 찾을 수 없습니다: %', p_child_id;
  end if;

  if not exists (select 1 from trial_smart_notes_consents where child_id = p_child_id) then
    raise exception '체험 Smart Notes 동의가 없어 체험수업권을 지급할 수 없습니다(학생 id: %).', p_child_id;
  end if;

  select eg.id into v_existing_grant_id
  from entitlement_grants eg
  join entitlement_products ep on ep.id = eg.entitlement_product_id
  where eg.child_id = p_child_id and ep.code = 'trial_lesson_grant'
  limit 1;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  select id into v_trial_product_id from entitlement_products where code = 'trial_lesson_grant';
  if v_trial_product_id is null then
    raise exception '체험수업권 상품(trial_lesson_grant)이 존재하지 않습니다 — 마이그레이션 순서 문제.';
  end if;

  v_expires_at := now() + interval '90 days';

  insert into entitlement_grants (
    child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at,
    is_paid, source_consultation_id
  ) values (
    p_child_id, v_trial_product_id, null, 1, v_expires_at, false, null
  )
  returning id into v_new_grant_id;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (v_new_grant_id, 'grant', 1, 'trial_grant_direct:' || p_child_id::text)
  on conflict do nothing;

  return v_new_grant_id;
end;
$$;
revoke execute on function public.grant_trial_entitlement_for_student(uuid) from public, anon, authenticated;
grant execute on function public.grant_trial_entitlement_for_student(uuid) to service_role;

comment on function public.grant_trial_entitlement_for_student(uuid) is
  'grant_trial_entitlement_for_consultation()의 지인/추천 직접생성 경로용 — consultation 없이 '
  '학생 id만으로 동일한 동의 게이트를 적용해 체험수업권 1장을 지급한다. '
  '2026-09-09: 관리자 생년월일 확인 게이트는 정책 변경으로 제거됨.';
