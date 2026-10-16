-- 2026-09-29 — 학생 열람 통합: 선생님(현재 활성 배정 학생)도 열람 감사 이력에 기록한다.
-- 학부모 열람은 기록하지 않는다(else 분기에서 거절). create or replace라 어느 시점 버전이
-- 적용돼 있어도 같은 결과.
create or replace function public.record_staff_student_view(p_student_id uuid, p_view_kind text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_tier text;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  if p_view_kind not in ('overview', 'board', 'stats') then raise exception '알 수 없는 화면 종류입니다.'; end if;
  select role, admin_tier into v_role, v_tier from profiles where id = v_uid;
  if v_role = 'admin' then
    if v_tier = 'supervisor' and not coalesce(current_user_has_capability('학생관리'), false) then
      raise exception '이 학생을 열람할 권한이 없습니다.';
    end if;
  elsif v_role = 'consultant' then
    if not is_assigned_consultant_of(p_student_id) then raise exception '담당 학생만 열람할 수 있습니다.'; end if;
  elsif v_role = 'teacher' then
    if not teaches_student(p_student_id) then raise exception '현재 담당 중인 학생만 열람할 수 있습니다.'; end if;
  else
    raise exception '이 학생을 열람할 권한이 없습니다.';
  end if;

  -- 같은 열람자·학생 조합은 직렬화해 동시 호출에도 중복 기록이 생기지 않게 한다.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_student_id::text || p_view_kind, 0));
  if exists (
    select 1 from staff_student_view_log
    where viewer_id = v_uid and student_id = p_student_id and view_kind = p_view_kind
      and viewed_at > now() - interval '10 minutes'
  ) then
    return false;
  end if;
  insert into staff_student_view_log (viewer_id, student_id, view_kind) values (v_uid, p_student_id, p_view_kind);
  return true;
end $$;
revoke execute on function public.record_staff_student_view(uuid, text) from public, anon;
grant execute on function public.record_staff_student_view(uuid, text) to authenticated;
