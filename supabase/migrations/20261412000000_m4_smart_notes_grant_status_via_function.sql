-- 2026-09-17(보안 재검토) — 20261410000000의 설계를 되돌린다. 그 마이그레이션은
-- session_smart_notes_reader_grant_status 뷰에 security_invoker=true를 명시했지만,
-- 뷰가 동작하려면 session_drive_tasks 테이블 자체에 학생·보호자용 select RLS 정책을
-- 추가해야 했다 — Postgres RLS는 행 단위라서, 이 정책이 있으면 학생·보호자가
-- 뷰가 아니라 테이블을 직접(REST API로 `select=*`) 조회해도 같은 행이 보인다.
-- 그러면 status뿐 아니라 payload(파일ID·학생 이메일)·last_error(내부 Drive API
-- 오류 원문) 같은, 화면에 노출할 의도가 없던 컬럼까지 그대로 새 나간다 —
-- "다른 컬럼은 노출하지 않는다"는 원래 주석이 실제로는 지켜지지 않는 설계였다.
--
-- 안전한 대안: 테이블에는 학생·보호자용 정책을 전혀 추가하지 않고, SECURITY
-- DEFINER 함수 안에서 소유권(자기 자신 또는 같은 household의 guardian, 또는
-- 관리자)을 직접 검사한 뒤 status 컬럼 하나만 반환한다. 함수가 반환하는 컬럼
-- 자체가 status뿐이므로 payload/last_error는 애초에 이 경로로 나갈 수 없다
-- (뷰의 컬럼 제한과 달리, 함수의 반환 타입 제한은 테이블 직접 조회로 우회할
-- 방법이 없다 — REVOKE로 테이블 select 권한 자체를 authenticated에 주지 않는다).

drop policy if exists "session_smart_notes_reader_grant 상태 조회(학생·보호자)" on session_drive_tasks;
drop view if exists session_smart_notes_reader_grant_status;

create or replace function public.get_smart_notes_reader_grant_statuses(p_session_ids uuid[])
returns table (session_id uuid, status text)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select t.session_id, t.status
    from session_drive_tasks t
    join sessions s on s.id = t.session_id
    join subject_enrollments se on se.id = s.subject_enrollment_id
    where t.task_type = 'smart_notes_reader_grant'
      and t.session_id = any(p_session_ids)
      and (
        is_admin()
        or se.child_id = auth.uid()
        or is_guardian_of(se.child_id)
        or is_household_guardian_of(se.child_id)
      );
end;
$$;
revoke execute on function public.get_smart_notes_reader_grant_statuses(uuid[]) from public, anon;
grant execute on function public.get_smart_notes_reader_grant_statuses(uuid[]) to authenticated, service_role;
