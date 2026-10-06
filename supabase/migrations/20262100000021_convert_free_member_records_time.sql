-- 2026-10-06 Free Accounts 2/7 — 전환 시각 기록(converted_at, 최초 1회·멱등). 20262100000006 본문 + converted_at.
create or replace function public.convert_free_member_to_tutoring(p_student_id uuid, p_consultation_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_c consultations%rowtype;
  v_type text;
begin
  select * into v_c from consultations where id = p_consultation_id;
  if not found or v_c.child_id is distinct from p_student_id or v_c.source <> 'free_member' then
    raise exception 'convert_free_member_to_tutoring: 이 상담은 해당 학생의 무료 회원 연결 상담이 아닙니다.';
  end if;
  select member_type into v_type from students where id = p_student_id for update;
  if not found then
    raise exception 'convert_free_member_to_tutoring: 학생을 찾을 수 없습니다.';
  end if;
  if v_type = 'tutoring' then
    return false; -- 이미 전환됨(멱등)
  end if;
  perform set_config('app.allow_member_type_change', 'true', true);
  update students set member_type = 'tutoring', converted_at = coalesce(converted_at, now()) where id = p_student_id and member_type = 'free';
  perform set_config('app.allow_member_type_change', 'false', true);
  return true;
end;
$$;
revoke execute on function public.convert_free_member_to_tutoring(uuid, uuid) from public, anon, authenticated;
grant execute on function public.convert_free_member_to_tutoring(uuid, uuid) to service_role;
