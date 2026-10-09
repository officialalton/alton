-- 테스트 계정(students.is_test_account: 이메일 패턴 example.com·uat-/e2e- 등 자동 표식 + 관리자 지정 admin_set_test_account)의 모의고사 응시를
-- 교차 학생 집계(문항 노출 횟수·난이도 변경 영향)에서 뺀다. 비프로덕션에서 사람이 눌러 본 AP 응시가 학습·전환 통계와 섞이지 않게 한다.
-- 개별 응시 조회·관리자 응시 내역 목록은 그대로 보이고(테스트 표시만 붙는다), 학생 본인 통계(student_stats_aggregate 등)는 학생 단위라 영향 없다.
-- Free Accounts 목록·분석은 20262100000023/025 부터 이미 p_include_test=false 기본 제외.
-- 되돌리기: 20261904... 이전 정의로 create or replace(join students 제거).
create or replace function public.mock_exam_problem_exposure_counts()
returns table(problem_id uuid, set_count integer, attempt_count integer)
language sql stable security definer set search_path = public as $$
  select i.problem_id,
         count(distinct i.exam_set_id)::int,
         count(distinct a.attempt_id) filter (where a.response is not null and st.id is not null)::int
  from mock_exam_set_items i
  join mock_exam_sets s on s.id = i.exam_set_id and s.archived_at is null
  left join mock_exam_answers a on a.set_item_id = i.id
  left join mock_exam_attempts att on att.id = a.attempt_id
  left join students st on st.id = att.student_id and not st.is_test_account
  group by i.problem_id;
$$;

create or replace function public.problem_difficulty_set_impact(p_problem_ids uuid[])
returns table(problem_id uuid, exam_set_id uuid, set_name text, set_status text, module_key text, route text, snapshot_difficulty text, live_difficulty text, violates boolean, started_attempts bigint)
language sql stable security definer set search_path = public as $$
  with live as (
    select p.id, coalesce(v.difficulty, p.difficulty::text) as d
    from problems p left join problem_versions v on v.id = p.published_version_id
    where p.id = any(p_problem_ids)
  )
  select i.problem_id, s.id, s.name, s.status, i.module_key::text, i.route::text, i.difficulty, l.d,
         case when i.module_key is null then false
              when i.module_key::text in ('rw_m1', 'math_m1') then l.d not in ('easy', 'medium')
              when i.route::text = 'higher' then l.d not in ('medium', 'hard')
              when i.route::text = 'lower' then l.d not in ('easy', 'medium')
              else false end,
         (select count(*) from mock_exam_attempts a join students st on st.id = a.student_id and not st.is_test_account where a.exam_set_id = s.id)
  from mock_exam_set_items i
  join mock_exam_sets s on s.id = i.exam_set_id and s.archived_at is null and s.status in ('draft', 'published')
  join live l on l.id = i.problem_id
  where i.problem_id = any(p_problem_ids)
$$;
