-- 미채점 AP 응시(assigned/in_progress/submitted)가 '0문항'으로 보이던 문제 정정(2026-10-21, 추가형).
-- 640 의 mc_total/mc_correct 는 채점 뒤에만(상세 RPC 가 graded 일 때만 호출) 채워져 미채점이면 0 이다.
-- 문항 수는 세트 구성(mock_exam_set_items, AP 섹션의 객관식)으로 항상 알 수 있으므로 mc_item_count 열을 추가한다(SAT 응시는 null).
-- 정답 수(mc_correct)는 채점 결과이므로 미채점이면 null 그대로 둔다. 이미 적용된 640 은 고치지 않는다. 640 과 같은 본문 + 열 1개, 실행 권한 동일.
drop function if exists public.admin_student_mock_attempt_facts(uuid);
create or replace function public.admin_student_mock_attempt_facts(p_student_id uuid) returns table (
  attempt_id uuid, exam_set_id uuid, exam_set_group_id uuid, exam_name text,
  exam_track text, ap_subject text, difficulty_tier text, format text,
  status text, started_at timestamptz, submitted_at timestamptz, graded_at timestamptz,
  attempt_seq int, score_adjusted boolean,
  rw_total int, rw_correct int, rw_complete boolean, rw_route text,
  math_total int, math_correct int, math_complete boolean, math_route text,
  rw_answered int, math_answered int,
  mc_total int, mc_correct int, mc_item_count int
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
         coalesce(sec.mc_total, 0)::int, case when a.status = 'graded' then coalesce(sec.mc_correct, 0)::int end,
         case when s.exam_program = 'ap' then (
           select count(*) from mock_exam_set_items i join problem_versions v on v.id = i.problem_version_id left join problems p on p.id = i.problem_id
           where i.exam_set_id = a.exam_set_id and i.section like 'ap\_%' and coalesce(p.format::text, 'mc') = 'mc')::int end
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

