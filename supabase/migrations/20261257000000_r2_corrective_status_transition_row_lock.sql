-- 배치 2-1 corrective 후속 수정 — transition_account_status()의 TOCTOU
-- (time-of-check-to-time-of-use) 레이스 컨디션을 막는다.
--
-- 문제: transition_account_status()는 대상 행(students/teachers/parents)을
-- 잠그지 않은 채 get_account_status()로 현재 상태를 읽고, 그 값으로 전이
-- 유효성을 검증한 뒤 토큰을 INSERT하고 UPDATE한다. 같은 행에 대해 동일한
-- 전이(예: pending → active)를 요청하는 두 동시 호출이 모두 잠금 없이
-- 'pending'을 읽고 둘 다 검증을 통과할 수 있다 — "행당 정확히 1번만
-- 전이된다"는 불변식이 깨지고 account_status_events에 중복 이벤트가 남는다.
--
-- 수정: 역할이 확정된 직후, 검증 로직보다 먼저 대상 역할 테이블의 행을
-- `select ... for update`로 잠근다. 잠금 확보 후 get_account_status()로
-- 현재 상태를 다시 읽어(잠그기 전에 읽은 값은 절대 재사용하지 않음) 그
-- 값으로 전이 유효성을 검증한다. 대기 중이던 트랜잭션이 잠금을 얻었을 때
-- 이미 다른 트랜잭션이 전이를 커밋했다면, 다시 읽은 상태 기준으로 요청된
-- 전이가 더 이상 유효하지 않으므로 기존과 동일한 "허용되지 않는 상태
-- 전이입니다" 오류로 자연스럽게 거부된다 — 별도 오류 경로를 새로 만들지
-- 않는다. 토큰 INSERT와 UPDATE는 잠금+재검증 이후에만 실행되므로 서로 다른
-- 행에 대한 동시 호출은 계속 독립적으로 병렬 처리된다(다른 행의 잠금과
-- 무관).
--
-- merge_accounts()는 이미 병합 대상 상태를 읽기 전에 profiles 행을
-- v_first/v_second 정렬 순서로 `for update` 잠그고, 그 잠금 확보 후에
-- get_account_status()로 상태를 읽는다(20261256000000:176-198) — 동일한
-- TOCTOU 레이스가 이미 없으므로 이 마이그레이션에서 변경하지 않는다.
--
-- 배치 1/2-1 corrective와 동일한 두 규칙 유지: (a)
-- public.status_transition_tokens 완전 스키마 한정, (b) search_path =
-- public, pg_temp 고정.

create or replace function public.transition_account_status(p_profile_id uuid, p_new_status text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
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

  -- (corrective) 검증보다 먼저 대상 역할 테이블의 행을 잠근다 — 동시
  -- 호출이 잠그지 않은 채 같은 current status를 읽고 둘 다 검증을 통과하는
  -- TOCTOU 레이스를 막는다.
  if v_role = 'student' then
    perform 1 from students where id = p_profile_id for update;
  elsif v_role = 'teacher' then
    perform 1 from teachers where id = p_profile_id for update;
  elsif v_role = 'parent' then
    perform 1 from parents where id = p_profile_id for update;
  end if;

  -- 잠금 확보 후 재조회 — 잠그기 전에 읽었을 수도 있는 값은 쓰지 않는다.
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

  if v_role = 'student' then
    insert into public.status_transition_tokens (table_name, row_id, action) values ('students', p_profile_id, 'status_transition');
    update students set status = p_new_status::student_status where id = p_profile_id;
  elsif v_role = 'teacher' then
    insert into public.status_transition_tokens (table_name, row_id, action) values ('teachers', p_profile_id, 'status_transition');
    update teachers set status = p_new_status::teacher_status where id = p_profile_id;
  elsif v_role = 'parent' then
    insert into public.status_transition_tokens (table_name, row_id, action) values ('parents', p_profile_id, 'status_transition');
    update parents set status = p_new_status::parent_status where id = p_profile_id;
  end if;

  insert into account_status_events (profile_id, previous_status, new_status, changed_by, reason)
  values (p_profile_id, v_current, p_new_status, auth.uid(), p_reason);
end;
$$;

comment on function public.transition_account_status(uuid, text, text) is
  '계정 상태 전환의 유일한 정상 경로. (corrective, 행 잠금) 역할 확정 직후
  대상 역할 테이블 행을 select ... for update로 잠그고, 잠금 확보 후 상태를
  재조회해 그 값으로 전이 유효성을 검증한다 — 동시에 같은 행에 대해 같은
  전이를 요청하는 두 호출이 잠그지 않은 채 같은 current status를 읽고 둘 다
  검증을 통과하는 TOCTOU 레이스를 막는다(이전엔 정확히 이 문제가 있었다).
  대기 중이던 호출이 잠금을 얻었을 때 이미 상태가 바뀌어 있으면 기존과
  동일한 "허용되지 않는 상태 전이입니다" 오류로 거부된다. 서로 다른 행에
  대한 동시 호출은 계속 독립적으로 처리된다. status_transition_tokens
  참조는 public.status_transition_tokens로 완전히 스키마 한정하고
  search_path는 public, pg_temp로 고정한다.';
