-- R2 Task 7 — transition_account_status() 정책 보정 (2026-09-01 실제 쓰기
-- 검증 중 발견).
--
-- 문제 1: 선생님 활성화 7개 선행조건 게이트가 pending→active 전이에만
-- 걸려 있었다. inactive→active(Workspace 탭의 "복귀") 전이는 게이트 없이
-- 곧바로 teachers.status를 active로 바꿨다 — 한 번 활성화됐던 선생님이
-- 중단 후 복귀할 때 계약·시급·온보딩 조건이 여전히 유효한지 재검증하지
-- 않는 정책 공백이었다(사용자 확인: 두 전이 모두 게이트 적용이 맞음).
-- 이제 teacher 역할이 active로 가는 모든 전이에서 게이트를 적용한다.
--
-- 문제 2: pending→inactive가 유효 전이 목록에 없었다. 한 번도
-- active된 적 없는 선생님(예: 프로비저닝만 되고 실제 근무를 시작하지
-- 않은 경우)의 Workspace 계정을 관리자가 중단하려 하면
-- suspend_teacher_workspace()(선행조건 검사 없음)는 성공하지만 뒤이은
-- transition_account_status(pending→inactive) 호출이 "허용되지 않는
-- 상태 전이"로 실패해, 실제 Google 계정=suspended, provisioning=
-- suspended, teachers.status=pending으로 세 시스템이 어긋나는 상태가
-- 만들어졌다(사용자 확인: pending→inactive를 유효 전이로 추가하는 것이
-- 맞음).

create or replace function public.transition_account_status(p_profile_id uuid, p_new_status text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role profile_role;
  v_current text;
  v_valid boolean;
  v_checklist record;
  v_missing text[] := array[]::text[];
begin
  if not is_admin() then
    raise exception '계정 상태 전환은 관리자만 할 수 있습니다.';
  end if;

  select role into v_role from profiles where id = p_profile_id;
  if v_role is null then
    raise exception '해당 프로필(%)을 찾을 수 없습니다.', p_profile_id;
  end if;
  if v_role = 'admin' then
    raise exception '관리자 계정은 이 함수의 대상이 아닙니다.';
  end if;
  if v_role not in ('student', 'teacher', 'parent') then
    raise exception '지원하지 않는 역할입니다: %', v_role;
  end if;

  v_current := get_account_status(p_profile_id);

  v_valid := (v_current, p_new_status) in (
    ('pending', 'active'),
    ('pending', 'inactive'),
    ('active', 'suspended'),
    ('suspended', 'active'),
    ('active', 'closure_pending'),
    ('suspended', 'closure_pending'),
    ('closure_pending', 'closed'),
    ('active', 'inactive'),
    ('suspended', 'inactive'),
    ('inactive', 'active')
  );

  if not v_valid then
    raise exception '허용되지 않는 상태 전이입니다: % → %', v_current, p_new_status;
  end if;

  if v_role = 'student' and p_new_status = 'active' and is_under_13(p_profile_id) and not has_valid_guardian_consent(p_profile_id) then
    raise exception '13세 미만 학생은 유효한 보호자 동의 없이 active로 전환할 수 없습니다.';
  end if;

  -- 이전에는 v_current = 'pending'일 때만 검사했다 — inactive→active
  -- (Workspace 탭 "복귀")도 동일하게 7개 선행조건을 매번 재검증한다.
  if v_role = 'teacher' and p_new_status = 'active' then
    for v_checklist in select * from get_teacher_activation_checklist(p_profile_id) loop
      if not v_checklist.satisfied then
        v_missing := array_append(v_missing, v_checklist.condition);
      end if;
    end loop;
    if array_length(v_missing, 1) > 0 then
      raise exception '선생님 활성화 선행조건이 충족되지 않았습니다: %', array_to_string(v_missing, ', ');
    end if;
  end if;

  perform set_config('app.bypass_status_protect', 'true', true);
  if v_role = 'student' then
    update students set status = p_new_status::student_status where id = p_profile_id;
  elsif v_role = 'teacher' then
    update teachers set status = p_new_status::teacher_status where id = p_profile_id;
  elsif v_role = 'parent' then
    update parents set status = p_new_status::parent_status where id = p_profile_id;
  end if;
  perform set_config('app.bypass_status_protect', 'false', true);

  insert into account_status_events (profile_id, previous_status, new_status, changed_by, reason)
  values (p_profile_id, v_current, p_new_status, auth.uid(), p_reason);
end;
$$;
