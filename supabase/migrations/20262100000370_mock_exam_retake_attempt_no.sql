-- 모의고사 재응시 허용(오너 결정 2026-10-08): 이미 응시한 시험도 모든 학생이 다시 볼 수 있고, 매 응시는 별도 attempt(회차 번호)로 기록한다.
-- 1) mock_exam_attempts.attempt_no 추가 + 기존 행 백필(학생·시험 계열별 created_at 순). 삽입 시 트리거가 max+1 을 부여한다.
-- 2) 학생×시험 단일 응시 유니크 인덱스 폐기 → (학생, 시험, 회차) 유니크 + "진행 중(graded 아님) 응시는 하나만" 부분 유니크.
-- 3) mock_exam_open_start: 진행 중 응시가 있으면 이어서(멱등), 없으면(전부 graded) 새 회차 생성. 동시 시작은 부분 유니크가 방어.
-- 4) catalog/summaries/detail/weakness 에 회차 정보(attemptNo, attemptTotal)를 싣는다. 약점 통계는 시험별 최신 채점 응시만 센다.
-- max_attempts·attempt_count 컬럼은 응시 제한으로 쓰인 적이 없다(attempt_count 는 제출 시 1 로 찍히는 플래그) — 그대로 두고 재응시 제한 근거로 쓰지 않는다.
-- 마이그레이션은 한 번 적용되면 파일을 고쳐도 반영되지 않으므로 전부 create or replace / if (not) exists.

alter table mock_exam_attempts add column if not exists attempt_no int;
update mock_exam_attempts a set attempt_no = r.n
  from (select id, row_number() over (partition by student_id, exam_set_group_id order by created_at, id)::int as n from mock_exam_attempts) r
 where a.id = r.id and a.attempt_no is null;
alter table mock_exam_attempts alter column attempt_no set not null;
alter table mock_exam_attempts alter column attempt_no set default 1;

-- security definer: 삽입자(학생 등)에게 테이블 SELECT 권한이 없어도 번호 부여가 막히지 않게(차단은 RLS 가 기존과 같은 오류로 한다).
create or replace function public.mock_exam_attempts_assign_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- 같은 학생·시험의 동시 삽입이 같은 번호를 받지 않게 직렬화한다.
  perform pg_advisory_xact_lock(hashtextextended(new.student_id::text || ':' || new.exam_set_group_id::text, 0));
  select coalesce(max(attempt_no), 0) + 1 into new.attempt_no
    from mock_exam_attempts where student_id = new.student_id and exam_set_group_id = new.exam_set_group_id;
  return new;
end $$;
-- 트리거 이름은 알파벳순으로 fill_set_group(exam_set_group_id 채움) 뒤에 실행돼야 한다.
drop trigger if exists mock_exam_attempts_zassign_no on mock_exam_attempts;
create trigger mock_exam_attempts_zassign_no before insert on mock_exam_attempts
  for each row execute function public.mock_exam_attempts_assign_no();

drop index if exists mock_exam_attempts_one_per_student_per_exam;
create unique index if not exists mock_exam_attempts_student_exam_attempt_no
  on mock_exam_attempts (student_id, exam_set_group_id, attempt_no);
create unique index if not exists mock_exam_attempts_one_open_per_student_per_exam
  on mock_exam_attempts (student_id, exam_set_group_id) where status <> 'graded';
comment on table mock_exam_attempts is '학생×시험(세트 계열) 응시 기록 — 재응시 시 attempt_no 로 구분(회차 1,2,..). 진행 중(graded 아님) 응시는 시험당 하나.';

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

  -- 이어하기(멱등): 채점 전(assigned/in_progress/submitted) 응시가 있으면 그대로 돌려준다. 전부 graded 면 아래에서 새 회차를 만든다.
  select id into v_id from mock_exam_attempts
   where student_id = v_uid and exam_set_group_id = v_s.set_group_id and status <> 'graded';
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
  on conflict (student_id, exam_set_group_id) where status <> 'graded' do nothing
  returning id into v_id;
  if v_id is null then
    -- 동시 시작 경쟁에서 진 쪽: 먼저 들어간 진행 중 응시를 돌려준다.
    select id into v_id from mock_exam_attempts
     where student_id = v_uid and exam_set_group_id = v_s.set_group_id and status <> 'graded';
  end if;
  return v_id;
end $function$;

revoke execute on function public.mock_exam_open_start(uuid) from public, anon;
grant execute on function public.mock_exam_open_start(uuid) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mock_exam_open_catalog(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_free boolean;
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception 'You do not have permission to view this student''s mock exam information.';
  end if;
  v_free := is_free_member(p_student_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'examSetId', s.id, 'setGroupId', s.set_group_id, 'name', s.name, 'description', s.description,
      'difficultyTier', s.difficulty_tier, 'format', s.format, 'publishedAt', s.published_at,
      'accessTier', s.access_tier,
      'attemptId', a.id, 'attemptStatus', a.status,
      'attemptNo', a.attempt_no, 'attemptTotal', coalesce(ac.n, 0)
    ) order by s.published_at desc nulls last, s.name)
    from mock_exam_sets s
    -- 최신 회차(= 진행 중 응시가 있으면 그것) 한 행 + 전체 회차 수.
    left join lateral (
      select x.id, x.status, x.attempt_no from mock_exam_attempts x
       where x.exam_set_group_id = s.set_group_id and x.student_id = p_student_id
       order by x.attempt_no desc limit 1
    ) a on true
    left join lateral (
      select count(*)::int as n from mock_exam_attempts y
       where y.exam_set_group_id = s.set_group_id and y.student_id = p_student_id
    ) ac on true
    where s.status = 'published' and s.archived_at is null
      and (s.format <> 'mst' or s.readiness_status = 'ready')
      -- 2026-10-05 무료 회원은 무료 공개 세트만(이미 응시한 세트는 티어와 무관하게 계속 보인다).
      and (not v_free or s.access_tier = 'free' or a.id is not null)
  ), '[]'::jsonb);
end $function$;

revoke execute on function public.mock_exam_open_catalog(uuid) from public, anon;
grant execute on function public.mock_exam_open_catalog(uuid) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mock_exam_attempt_summaries(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception 'You do not have permission to view this student''s mock exam records.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'examSetId', a.exam_set_id, 'examSetName', s.name, 'difficultyTier', s.difficulty_tier,
      'studentId', a.student_id, 'studentName', pr.name, 'status', a.status,
      'assignedByName', ap.name,
      'dueAt', a.due_at, 'startBy', a.start_by, 'startedAt', a.started_at, 'submittedAt', a.submitted_at, 'gradedAt', a.graded_at,
      'entryCount', a.entry_count,
      'attemptNo', a.attempt_no, 'setGroupId', a.exam_set_group_id,
      'attemptTotal', (select count(*) from mock_exam_attempts z where z.student_id = a.student_id and z.exam_set_group_id = a.exam_set_group_id),
      'totalCount', _mock_exam_expected_item_count(a.exam_set_id),
      'correctCount', case
        when _mock_exam_results_visible(a.student_id, a.status) and a.status = 'graded'
          then (select count(*) from mock_exam_answers ans
                 where ans.attempt_id = a.id and ans.correct = true
                   and not exists (select 1 from mock_exam_answer_adjustments x where x.attempt_id = a.id and x.set_item_id = ans.set_item_id and x.superseded_at is null))
             + (select count(*) from mock_exam_answer_adjustments x where x.attempt_id = a.id and x.superseded_at is null and x.adjusted_correct)
        else null end,
      'scoreAdjusted', case
        when _mock_exam_results_visible(a.student_id, a.status) and a.status = 'graded'
          then exists (select 1 from mock_exam_answer_adjustments x where x.attempt_id = a.id and x.superseded_at is null)
        else false end
    ) order by a.created_at desc)
    from mock_exam_attempts a
    join mock_exam_sets s on s.id = a.exam_set_id
    left join profiles pr on pr.id = a.student_id
    left join profiles ap on ap.id = a.assigned_by
    where a.student_id = p_student_id
  ), '[]'::jsonb);
end $function$;

revoke execute on function public.mock_exam_attempt_summaries(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_summaries(uuid) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mock_exam_attempt_detail(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_d jsonb; v_items jsonb;
begin
  v_d := _mock_exam_attempt_detail_v4(p_attempt_id);
  if v_d is null then return null; end if;
  select coalesce(jsonb_agg(
           t.it || jsonb_build_object(
             'guessed', coalesce(ans.guessed, false),
             'explanationEn', case when t.it->>'explanation' is null then null else nullif(btrim(v.explanation_en), '') end)
           order by t.ord), '[]'::jsonb)
    into v_items
  from jsonb_array_elements(coalesce(v_d->'items', '[]'::jsonb)) with ordinality as t(it, ord)
  left join mock_exam_set_items i on i.id = (t.it->>'setItemId')::uuid
  left join problem_versions v on v.id = i.problem_version_id
  left join mock_exam_answers ans on ans.attempt_id = p_attempt_id and ans.set_item_id = i.id;
  return v_d || jsonb_build_object('items', v_items) || (
    select jsonb_build_object('attemptNo', a.attempt_no, 'setGroupId', a.exam_set_group_id,
             'attemptTotal', (select count(*) from mock_exam_attempts z where z.student_id = a.student_id and z.exam_set_group_id = a.exam_set_group_id))
      from mock_exam_attempts a where a.id = p_attempt_id);
end $function$;

revoke execute on function public.mock_exam_attempt_detail(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_detail(uuid) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mock_exam_weakness_summary(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_attempts integer;
  v_graded integer;
  v_domain jsonb;
  v_skill jsonb;
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception 'You do not have permission to view this student''s mock exam records.';
  end if;
  select count(*), count(*) filter (where status = 'graded') into v_attempts, v_graded
    from mock_exam_attempts where student_id = p_student_id;

  with graded as (
    select ans.set_item_id, i.section, i.sat_domain, i.skill_code,
           coalesce(adj.adjusted_correct, ans.correct) as correct
    from mock_exam_attempts a
    join mock_exam_answers ans on ans.attempt_id = a.id
    join mock_exam_set_items i on i.id = ans.set_item_id
    left join mock_exam_answer_adjustments adj
      on adj.attempt_id = a.id and adj.set_item_id = ans.set_item_id and adj.superseded_at is null
    where a.student_id = p_student_id and a.status = 'graded' and ans.correct is not null
      -- 재응시: 같은 시험을 여러 번 봐도 시험당 최신 채점 응시 하나만 약점 통계에 반영한다(외운 문항 중복 집계 방지).
      and a.attempt_no = (select max(a2.attempt_no) from mock_exam_attempts a2
                           where a2.student_id = a.student_id and a2.exam_set_group_id = a.exam_set_group_id and a2.status = 'graded')
  ),
  dom as (
    select sat_domain as key, min(section) as section, count(*) as total, count(*) filter (where correct) as correct
    from graded where sat_domain is not null group by sat_domain
  ),
  skl as (
    select skill_code as key, min(section) as section, count(*) as total, count(*) filter (where correct) as correct
    from graded where skill_code is not null group by skill_code
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('key', key, 'section', section, 'total', total, 'correct', correct) order by key) from dom), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('key', key, 'section', section, 'total', total, 'correct', correct) order by key) from skl), '[]'::jsonb)
    into v_domain, v_skill;

  return jsonb_build_object(
    'attemptCount', v_attempts,
    'gradedAttemptCount', v_graded,
    'byDomain', v_domain,
    'bySkill', v_skill
  );
end $function$;

revoke execute on function public.mock_exam_weakness_summary(uuid) from public, anon;
grant execute on function public.mock_exam_weakness_summary(uuid) to authenticated, service_role;
