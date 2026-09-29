-- 자동 채점 결과(정오)는 교사 채점 뒤에만 학생·학부모에게 (2026-09-29 포털 점검 후속)
--
-- 문제: session_problem_work.auto_correct 는 제출 즉시 서버가 계산해 두는 정오다. 행 정책이 본인 학생·보호자에게
-- 열려 있어 REST 로 채점 전에 정답 여부를 알아낼 수 있었다(앱 payload 에서만 가리던 규칙).
-- mock_exam_attempt_modules.raw_correct_count 도 모듈 제출 시 채워져 학생·보호자가 채점 전에 읽을 수 있었다.
--
-- 수정(additive, 데이터 변경 없음):
--  (1) 두 컬럼의 직접 SELECT 권한을 anon/authenticated 에서 회수(나머지 컬럼은 그대로 다시 부여).
--      service_role·definer 함수(grade_problem_attempt 등)·problem_response_stats(관리자 service 조회)는 영향 없다.
--  (2) session_problem_auto_correct(): 수업 교사·관리자는 항상, 본인 학생·보호자는 그 풀이가 채점된(graded_at) 뒤에만.
--  (3) problem_response_stats 뷰는 auto_correct 를 집계하므로 anon/authenticated 직접 조회를 닫는다(관리자 화면은 service 클라이언트).
-- 주의: 이 테이블에 새 컬럼을 추가하면 authenticated 에 컬럼 SELECT 를 따로 grant 해야 한다.
-- 되돌리기: grant select on public.session_problem_work, public.mock_exam_attempt_modules to anon, authenticated;
--          grant select on public.problem_response_stats to anon, authenticated;

do $$
declare
  t record;
  cols text;
begin
  for t in select * from (values
    ('session_problem_work', 'auto_correct'),
    ('mock_exam_attempt_modules', 'raw_correct_count')
  ) as v(tbl, hidden) loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
      from information_schema.columns
      where table_schema = 'public' and table_name = t.tbl and column_name <> t.hidden;
    execute format('revoke select on public.%I from anon, authenticated', t.tbl);
    execute format('grant select (%s) on public.%I to anon, authenticated', cols, t.tbl);
  end loop;
end $$;

revoke select on public.problem_response_stats from anon, authenticated;

create or replace function public.session_problem_auto_correct(p_work_ids uuid[])
returns table (work_id uuid, auto_correct boolean)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.auto_correct
    from session_problem_work w
   where w.id = any (p_work_ids)
     and (
       public._is_service_role()
       or public.is_admin()
       or public.is_session_teacher_v3(w.session_id)
       or (
         w.graded_at is not null
         and (w.student_id = auth.uid() or public.is_session_guardian_v3(w.session_id))
       )
     );
$$;

revoke all on function public.session_problem_auto_correct(uuid[]) from public, anon;
grant execute on function public.session_problem_auto_correct(uuid[]) to authenticated;

comment on function public.session_problem_auto_correct(uuid[]) is
  '2026-09-29: 풀이판의 자동 채점 정오. 관리자·수업 교사는 항상, 본인 학생·보호자는 채점(graded_at) 뒤에만. 호출자(auth.uid) 기준.';

-- 필기 이벤트의 풀이판 일관성 트리거는 호출자 권한으로 돌며 `select *` 로 행 전체를 읽었다 — 컬럼 권한 회수 뒤에는
-- 권한 오류가 난다. 필요한 세 컬럼만 읽도록 바꾼다(호출자 권한·RLS 동작과 오류 문구는 그대로).
create or replace function public.check_annotation_problem_work_consistency()
returns trigger
language plpgsql
as $$
declare
  v_session_id uuid;
  v_student_id uuid;
  v_problem_id uuid;
begin
  if new.problem_work_id is null then
    return new;
  end if;
  select w.session_id, w.student_id, w.problem_id into v_session_id, v_student_id, v_problem_id
    from session_problem_work w where w.id = new.problem_work_id;
  if not found then
    raise exception '존재하지 않는 풀이판입니다.';
  end if;
  if v_session_id <> new.session_id then
    raise exception '풀이판의 수업(%)과 필기의 수업(%)이 다릅니다.', v_session_id, new.session_id;
  end if;
  if v_student_id <> new.owner_student_id then
    raise exception '풀이판의 학생과 필기의 소유 학생이 다릅니다.';
  end if;
  if v_problem_id <> new.problem_id then
    raise exception '풀이판의 문제와 필기의 문제가 다릅니다.';
  end if;
  return new;
end;
$$;
