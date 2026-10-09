-- 예상 점수 범위 정책(2026-10-09): 각 섹션에서 출제된 문항의 80% 이상에 유효 응답이 있어야 범위를 보인다. 통계 추이·관리자 점수 원자료에도 같은 기준을 쓰려면 섹션별 "유효 응답 수"가 필요하다.
-- 유효 응답 = mock_exam_answers.response 가 null·빈 문자열·공백이 아님(정답 여부 무관). 출제된 문항 = 응시자가 실제로 받은 문항(상세 RPC 의 items, 경로 반영).
-- 추가만 한다: ① admin_student_mock_attempt_facts 에 rw_answered·math_answered 열 추가(반환 타입이 바뀌므로 drop 후 재생성, 본문은 이전과 같다 + 응답 수)
--            ② student_stats_aggregate 는 기존 함수를 _student_stats_aggregate_v1 로 이름만 바꾸고, 같은 시그니처의 래퍼가 v1 결과의 mock[].sections[] 에 answered 를 덧붙인다.
-- 되돌리기: 래퍼 drop 후 _student_stats_aggregate_v1 을 원래 이름으로 rename, facts 함수는 20262100000022 정의로 재생성.
create or replace function public._mock_exam_section_answered(p_attempt_id uuid) returns table(section text, answered int)
language sql stable security definer set search_path = public as $$
  select i.section::text,
         count(*) filter (where a.response is not null and btrim(a.response #>> '{}') <> '')::int
  from mock_exam_answers a join mock_exam_set_items i on i.id = a.set_item_id
  where a.attempt_id = p_attempt_id and i.section in ('rw', 'math')
  group by i.section
$$;
revoke execute on function public._mock_exam_section_answered(uuid) from public, anon, authenticated;

drop function if exists public.admin_student_mock_attempt_facts(uuid);
create or replace function public.admin_student_mock_attempt_facts(p_student_id uuid) returns table (
  attempt_id uuid, exam_set_id uuid, exam_set_group_id uuid, exam_name text,
  exam_track text, ap_subject text, difficulty_tier text, format text,
  status text, started_at timestamptz, submitted_at timestamptz, graded_at timestamptz,
  attempt_seq int, score_adjusted boolean,
  rw_total int, rw_correct int, rw_complete boolean, rw_route text,
  math_total int, math_correct int, math_complete boolean, math_route text,
  rw_answered int, math_answered int
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
         (a.status = 'graded' and coalesce(sec.math_total, 0) > 0), a.math_m2_route::text,
         coalesce((select x.answered from _mock_exam_section_answered(a.id) x where x.section = 'rw'), 0)::int,
         coalesce((select x.answered from _mock_exam_section_answered(a.id) x where x.section = 'math'), 0)::int
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

do $$ begin
  if not exists (select 1 from pg_proc where proname = '_student_stats_aggregate_v1') then
    alter function public.student_stats_aggregate(uuid, boolean) rename to _student_stats_aggregate_v1;
    revoke execute on function public._student_stats_aggregate_v1(uuid, boolean) from public, anon, authenticated;
  end if;
end $$;
create or replace function public.student_stats_aggregate(p_student_id uuid, p_include_staff boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  v := _student_stats_aggregate_v1(p_student_id, p_include_staff);
  if v is null or jsonb_typeof(v->'mock') <> 'array' then return v; end if;
  return jsonb_set(v, '{mock}', coalesce((
    select jsonb_agg(m.row || jsonb_build_object('sections', coalesce((
        select jsonb_agg(sec || jsonb_build_object('answered', coalesce((select x.answered from _mock_exam_section_answered((m.row->>'attemptId')::uuid) x where x.section = sec->>'section'), 0)))
        from jsonb_array_elements(coalesce(m.row->'sections', '[]'::jsonb)) sec), '[]'::jsonb)) order by m.ord)
    from jsonb_array_elements(v->'mock') with ordinality as m(row, ord)), '[]'::jsonb));
end $$;
revoke execute on function public.student_stats_aggregate(uuid, boolean) from public, anon, authenticated; -- 원래 권한(service_role 전용)과 같게
grant execute on function public.student_stats_aggregate(uuid, boolean) to service_role;
