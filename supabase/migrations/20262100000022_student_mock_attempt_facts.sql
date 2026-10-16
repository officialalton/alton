-- 2026-10-06 Free Accounts 3/7 — 점수 원자료 RPC. 점수 계산은 TS(lib/mock-exam/score-aggregate.ts)만 한다.
-- 정답/문항은 mock_exam_attempt_detail(조정 채점·경로 문항 규칙 포함)에서 그대로 읽어 학생·관리자 화면 숫자가 어긋나지 않게 한다.
-- AP 시험 트랙은 아직 없으므로 exam_track 은 'sat' 상수(20262100000027 이후 확장).
-- 관리자(supervisor 는 학생관리 capability)만. 컨설턴트·교사·학부모·학생은 거절.
create or replace function public.admin_student_mock_attempt_facts(p_student_id uuid) returns table (
  attempt_id uuid, exam_set_id uuid, exam_set_group_id uuid, exam_name text,
  exam_track text, ap_subject text, difficulty_tier text, format text,
  status text, started_at timestamptz, submitted_at timestamptz, graded_at timestamptz,
  attempt_seq int, score_adjusted boolean,
  rw_total int, rw_correct int, rw_complete boolean, rw_route text,
  math_total int, math_correct int, math_complete boolean, math_route text
) language plpgsql stable security definer set search_path = public as $$
begin
  if not _free_accounts_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
  select a.id, a.exam_set_id, a.exam_set_group_id, s.name,
         'sat'::text, null::text, s.difficulty_tier, coalesce(s.format, 'fixed')::text,
         a.status, a.started_at, a.submitted_at, a.graded_at,
         (row_number() over (partition by a.exam_set_group_id order by a.created_at, a.id))::int,
         coalesce((f.d->>'scoreAdjusted')::boolean, false),
         coalesce(sec.rw_total, 0)::int, case when a.status = 'graded' then coalesce(sec.rw_correct, 0)::int end,
         (a.status = 'graded' and coalesce(sec.rw_total, 0) > 0), a.rw_m2_route::text,
         coalesce(sec.math_total, 0)::int, case when a.status = 'graded' then coalesce(sec.math_correct, 0)::int end,
         (a.status = 'graded' and coalesce(sec.math_total, 0) > 0), a.math_m2_route::text
  from mock_exam_attempts a
  join mock_exam_sets s on s.id = a.exam_set_id
  left join lateral (select case when a.status = 'graded' then mock_exam_attempt_detail(a.id) end as d) f on true
  left join lateral (
    select count(*) filter (where it->>'section' = 'rw') rw_total,
           count(*) filter (where it->>'section' = 'rw' and (it->>'correct')::boolean) rw_correct,
           count(*) filter (where it->>'section' = 'math') math_total,
           count(*) filter (where it->>'section' = 'math' and (it->>'correct')::boolean) math_correct
    from jsonb_array_elements(coalesce(f.d->'items', '[]'::jsonb)) it
  ) sec on true
  where a.student_id = p_student_id
  order by a.created_at desc;
end $$;
revoke execute on function public.admin_student_mock_attempt_facts(uuid) from public, anon;
grant execute on function public.admin_student_mock_attempt_facts(uuid) to authenticated;
comment on function public.admin_student_mock_attempt_facts(uuid) is
  '2026-10-06 Free Accounts — 한 학생의 응시 원자료(정답·문항·경로). 점수 환산은 TS 공유 모듈. 학생당 응시 수만큼만 반환(전체 집계 용도 아님).';
