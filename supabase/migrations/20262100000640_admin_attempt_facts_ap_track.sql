-- 관리자 응시 이력 RPC가 exam_track 을 'sat' 상수로 반환해 AP 응시가 SAT 결과 화면으로 열리던 버그 정정(2026-10-21).
-- exam_track/ap_subject 를 세트의 exam_program/ap_subject 에서 읽고, AP 요약용 객관식 문항 수(mc_total/mc_correct)를 추가한다. 이미 적용된 409 는 고치지 않고 새 번호로 올린다.
drop function if exists public.admin_student_mock_attempt_facts(uuid);
create or replace function public.admin_student_mock_attempt_facts(p_student_id uuid) returns table (
  attempt_id uuid, exam_set_id uuid, exam_set_group_id uuid, exam_name text,
  exam_track text, ap_subject text, difficulty_tier text, format text,
  status text, started_at timestamptz, submitted_at timestamptz, graded_at timestamptz,
  attempt_seq int, score_adjusted boolean,
  rw_total int, rw_correct int, rw_complete boolean, rw_route text,
  math_total int, math_correct int, math_complete boolean, math_route text,
  rw_answered int, math_answered int,
  mc_total int, mc_correct int
) language plpgsql stable security definer set search_path = public as $$
begin
  if not _free_accounts_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
  select a.id, a.exam_set_id, a.exam_set_group_id, s.name,
         case when s.exam_program = 'ap' then 'ap' else 'sat' end::text, case when s.exam_program = 'ap' then s.ap_subject end::text, s.difficulty_tier, coalesce(s.format, 'fixed')::text,
         a.status, a.started_at, a.submitted_at, a.graded_at,
         (row_number() over (partition by a.exam_set_group_id order by a.created_at, a.id))::int,
         coalesce((f.d->>'scoreAdjusted')::boolean, false),
         coalesce(sec.rw_total, 0)::int, case when a.status = 'graded' then coalesce(sec.rw_correct, 0)::int end,
         (a.status = 'graded' and coalesce(sec.rw_total, 0) > 0), a.rw_m2_route::text,
         coalesce(sec.math_total, 0)::int, case when a.status = 'graded' then coalesce(sec.math_correct, 0)::int end,
         (a.status = 'graded' and coalesce(sec.math_total, 0) > 0), a.math_m2_route::text,
         coalesce((select x.answered from _mock_exam_section_answered(a.id) x where x.section = 'rw'), 0)::int,
         coalesce((select x.answered from _mock_exam_section_answered(a.id) x where x.section = 'math'), 0)::int,
         coalesce(sec.mc_total, 0)::int, case when a.status = 'graded' then coalesce(sec.mc_correct, 0)::int end
  from mock_exam_attempts a
  join mock_exam_sets s on s.id = a.exam_set_id
  left join lateral (select case when a.status = 'graded' then mock_exam_attempt_detail(a.id) end as d) f on true
  left join lateral (
    select count(*) filter (where it->>'section' = 'rw') rw_total,
           count(*) filter (where it->>'section' = 'rw' and (it->>'correct')::boolean) rw_correct,
           count(*) filter (where it->>'section' = 'math') math_total,
           count(*) filter (where it->>'section' = 'math' and (it->>'correct')::boolean) math_correct,
           count(*) filter (where it->>'format' = 'mc') mc_total,
           count(*) filter (where it->>'format' = 'mc' and (it->>'correct')::boolean) mc_correct
    from jsonb_array_elements(coalesce(f.d->'items', '[]'::jsonb)) it
  ) sec on true
  where a.student_id = p_student_id
  order by a.created_at desc;
end $$;
revoke execute on function public.admin_student_mock_attempt_facts(uuid) from public, anon;
grant execute on function public.admin_student_mock_attempt_facts(uuid) to authenticated;

