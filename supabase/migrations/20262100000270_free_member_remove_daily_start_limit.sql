-- 무료 회원 하루 2회 응시 시작 상한 폐기(오너 결정 2026-10-08). 나머지 규칙(무료 공개 세트만, 세트 계열당 1회·멱등)은 그대로.
-- 마이그레이션은 버전으로만 추적되므로 새 번호로 올리고 create or replace 로 어느 시점 버전이든 같은 결과가 되게 한다.

CREATE OR REPLACE FUNCTION public.mock_exam_open_start(p_exam_set_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_s mock_exam_sets%rowtype;
  v_id uuid;
  v_free boolean;
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  if not exists (select 1 from students where id = v_uid and status = 'active') then
    raise exception 'Only active students can start a mock exam.';
  end if;
  select * into v_s from mock_exam_sets where id = p_exam_set_id;
  if v_s.id is null then raise exception 'Exam not found.'; end if;

  -- 멱등: 이 시험(세트 계열)의 응시가 이미 있으면(기존 배정분 포함) 그대로 돌려준다.
  select id into v_id from mock_exam_attempts where student_id = v_uid and exam_set_group_id = v_s.set_group_id;
  if v_id is not null then return v_id; end if;

  if v_s.status <> 'published' or v_s.archived_at is not null then
    raise exception 'Only published exams can be started.';
  end if;
  if v_s.format = 'mst' and v_s.readiness_status <> 'ready' then
    raise exception 'This exam is not fully assembled yet, so it cannot be started. Please contact support.';
  end if;

  -- 무료 회원: 무료 공개 세트만 시작한다. 하루 응시 횟수 상한은 없다(2026-10-08 오너 결정으로 폐기).
  v_free := is_free_member(v_uid);
  if v_free then
    if v_s.access_tier <> 'free' then
      raise exception 'This exam is available to tutoring members only.';
    end if;
  end if;

  insert into mock_exam_attempts (student_id, exam_set_id, exam_set_group_id)
  values (v_uid, v_s.id, v_s.set_group_id)
  on conflict (student_id, exam_set_group_id) do nothing
  returning id into v_id;
  if v_id is null then
    -- 동시 시작 경쟁에서 진 쪽: 먼저 들어간 응시를 돌려준다.
    select id into v_id from mock_exam_attempts where student_id = v_uid and exam_set_group_id = v_s.set_group_id;
  end if;
  return v_id;
end $function$;

revoke execute on function public.mock_exam_open_start(uuid) from public, anon;
grant execute on function public.mock_exam_open_start(uuid) to authenticated, service_role;
