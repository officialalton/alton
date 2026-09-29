-- 2026-09-28 — 같은 이름의 함수 오버로드가 남아 호출이 모호해진 결함 정리.
--
-- (1) finalize_trial_onboarding_students
--   20261280000000이 5-인자 버전을 drop하고 6-인자(p_claim_id default null)로
--   바꿨는데, 이후 20261473000000/20261481000000이 5-인자 시그니처로
--   `create or replace`를 해서 5-인자 오버로드가 새로 생겼다. 앱
--   (lib/trial-onboarding-finalize.ts)은 p_claim_id를 넘기므로 6-인자 버전을
--   탔고, 그 결과 R15-A 컨설턴트 배정 이어붙이기와 체험수업권 즉시 지급
--   (20261900000017 주석에서 "최신 정의"로 확인한 동작)이 실제 경로에서
--   빠진 채 옛 'awaiting_consent' 상태로 멈추고 있었다. 5개 인자로 호출하면
--   "is not unique" 오류.
--   → 6-인자 버전 하나로 합친다: claim 소유권 검사·cancelled 건너뛰기(6-인자) +
--     컨설턴트 배정·즉시 지급(5-인자). 5-인자 오버로드는 제거.
--
-- (2) hold_entitlement(uuid, uuid, timestamptz, integer)
--   p_lesson_type_id 추가 전 구버전. 20261900000002에서 권한만 회수한 죽은
--   오버로드 — 인자 3~4개 호출이 모호해진다. 제거.
--
-- (3) is_within_booking_window(timestamptz)
--   p_admin_override(default false) 추가 전 구버전 — 인자 1개 호출이 모호.
--   현재 DB 함수 본문 중 1-인자로 호출하는 곳 없음(확인). 제거.
--
-- cascade 없이 drop하므로 의존 객체가 있으면 실패해 멈춘다.

drop function if exists public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION public.finalize_trial_onboarding_students(p_link_id uuid, p_new_guardian boolean, p_guardian_auth_user_id uuid, p_guardian_name text, p_students jsonb, p_claim_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(household_id uuid, guardian_id uuid, created_count integer, failed_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row trial_onboarding_links%rowtype;
  v_household_id uuid;
  v_item jsonb;
  v_link_student_id uuid;
  v_child_auth_user_id uuid;
  v_student trial_onboarding_link_students%rowtype;
  v_created int := 0;
  v_failed int := 0;
  v_grant_id uuid;
begin
  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception '존재하지 않는 온보딩 링크입니다.';
  end if;
  if v_row.status not in ('pending', 'redeemed') then
    raise exception 'pending 또는 redeemed 상태의 온보딩 링크만 처리할 수 있습니다(현재: %).', v_row.status;
  end if;

  if p_new_guardian and v_row.status = 'pending' then
    if v_row.finalize_claim_id is distinct from p_claim_id then
      raise exception 'stale_claim: 이 온보딩 링크는 다른 요청이 이미 처리 중이거나 완료했습니다.';
    end if;
  end if;
  if p_new_guardian and v_row.status = 'redeemed' and v_row.redeemed_claim_id is not null
     and v_row.redeemed_claim_id is distinct from p_claim_id then
    raise exception 'stale_claim: 이 온보딩 링크는 이미 다른 요청이 완료했습니다.';
  end if;

  if p_new_guardian then
    insert into profiles (id, role, name) values (p_guardian_auth_user_id, 'parent', p_guardian_name)
      on conflict (id) do nothing;
    insert into parents (id) values (p_guardian_auth_user_id) on conflict (id) do nothing;

    select id into v_household_id from households where primary_guardian_id = p_guardian_auth_user_id
      order by created_at asc limit 1;
    if v_household_id is null then
      insert into households (primary_guardian_id) values (p_guardian_auth_user_id) returning id into v_household_id;
      insert into household_members (household_id, profile_id, role, is_primary)
        values (v_household_id, p_guardian_auth_user_id, 'guardian', true)
        on conflict on constraint household_members_household_id_profile_id_key do nothing;
    end if;
  else
    if not exists (select 1 from profiles where id = p_guardian_auth_user_id and role = 'parent') then
      raise exception '보호자 계정이 아닙니다.';
    end if;
    select id into v_household_id from households where primary_guardian_id = p_guardian_auth_user_id
      order by created_at asc limit 1;
    if v_household_id is null then
      raise exception '이 보호자 계정에 연결된 household를 찾을 수 없습니다 — 관리자에게 문의하세요.';
    end if;
  end if;

  update trial_onboarding_links
  set status = 'redeemed', redeemed_at = coalesce(redeemed_at, now()), redeemed_auth_user_id = p_guardian_auth_user_id,
      redeemed_claim_id = case when p_new_guardian then coalesce(redeemed_claim_id, p_claim_id) else redeemed_claim_id end
  where id = p_link_id;

  if v_row.prospect_contact_id is not null then
    update prospect_contacts
    set converted_guardian_id = p_guardian_auth_user_id, converted_at = coalesce(converted_at, now()),
        converted_by = p_guardian_auth_user_id,
        conversion_note = coalesce(conversion_note, '복수자녀 온보딩(link_id=' || p_link_id::text || ')')
    where id = v_row.prospect_contact_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_students)
  loop
    v_link_student_id := (v_item->>'link_student_id')::uuid;
    v_child_auth_user_id := (v_item->>'child_auth_user_id')::uuid;

    select * into v_student from trial_onboarding_link_students where id = v_link_student_id and link_id = p_link_id for update;
    if not found then
      continue;
    end if;
    if v_student.status = 'created' then
      v_created := v_created + 1;
      if v_row.consultation_id is null and v_student.consultant_id is not null and v_student.child_auth_user_id is not null
         and not exists (select 1 from consultant_assignments where student_id = v_student.child_auth_user_id) then
        insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
        values (v_student.consultant_id, v_student.child_auth_user_id, v_student.consultant_assigned_by, now())
        on conflict (student_id) do nothing;
        insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
        values (v_student.child_auth_user_id, null, v_student.consultant_id, v_student.consultant_assigned_by, '가입 대기 단계 담당자 이어받음(계정 이미 생성됨 — 결함 수정 백필)');
      end if;
      continue;
    end if;
    if v_student.status = 'cancelled' then
      continue;
    end if;

    begin
      insert into profiles (id, role, name) values (v_child_auth_user_id, 'student', v_student.student_name)
        on conflict (id) do nothing;
      insert into students (id, grade, status) values (v_child_auth_user_id, v_student.student_grade, 'pending')
        on conflict (id) do nothing;
      insert into household_members (household_id, profile_id, role, is_primary)
        values (v_household_id, v_child_auth_user_id, 'child', false)
        on conflict on constraint household_members_household_id_profile_id_key do nothing;

      update trial_onboarding_link_students
      set status = 'created', child_auth_user_id = v_child_auth_user_id, error = null, updated_at = now()
      where id = v_link_student_id;

      if v_row.consultation_id is not null then
        perform public._create_student_kanban_card(v_row.consultation_id, v_link_student_id, v_child_auth_user_id, v_household_id);
      else
        -- 지인/추천 직접생성 경로 — 담당 컨설턴트를 그대로 이어 붙인다(R15-A).
        if v_student.consultant_id is not null then
          insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
          values (v_student.consultant_id, v_child_auth_user_id, v_student.consultant_assigned_by, now())
          on conflict (student_id) do nothing;
          insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
          values (v_child_auth_user_id, null, v_student.consultant_id, v_student.consultant_assigned_by, '가입 대기 단계 담당자 이어받음(계정 생성)');
        end if;

        update trial_onboarding_link_students set trial_entitlement_grant_status = 'pending' where id = v_link_student_id;
        begin
          v_grant_id := grant_trial_entitlement_for_student(v_child_auth_user_id);
          update trial_onboarding_link_students set
            trial_entitlement_grant_id = v_grant_id,
            trial_entitlement_grant_status = 'granted',
            trial_entitlement_grant_error = null
          where id = v_link_student_id;
        exception when others then
          update trial_onboarding_link_students set
            trial_entitlement_grant_status = 'failed',
            trial_entitlement_grant_error = sqlerrm
          where id = v_link_student_id;
        end;
      end if;

      insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
      values (p_link_id, 'finalized', p_guardian_auth_user_id,
        jsonb_build_object('household_id', v_household_id, 'child_id', v_child_auth_user_id, 'link_student_id', v_link_student_id));

      v_created := v_created + 1;
    exception when others then
      update trial_onboarding_link_students
      set status = 'failed', error = sqlerrm, updated_at = now()
      where id = v_link_student_id;
      v_failed := v_failed + 1;
    end;
  end loop;

  return query select v_household_id, p_guardian_auth_user_id, v_created, v_failed;
end;
$function$;

revoke execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb, uuid) to service_role;

comment on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb, uuid) is
  '2026-09-28 — 5/6-인자 오버로드 통합. claim 소유권 검사 + R15-A 컨설턴트 배정 + 체험수업권 즉시 지급.';

drop function if exists public.hold_entitlement(uuid, uuid, timestamptz, integer);
drop function if exists public.is_within_booking_window(timestamptz);
