-- 2026-09-16 제품 오너 정정 — "배치를 만들고 나중에 세션에 불러오기"라는 2단계는 필요 없다.
-- 교사 포털 "과제 생성"에서 학생·수업(세션)·키워드를 한 번에 골라 즉시 발급한다(그 순간부터
-- 학생 포털·세션뷰의 기존 과제 UI(ProblemsPanel, 목차·슬라이드·즉시 채점)에 그대로 뜬다 —
-- 새 UI를 만들지 않는다). "과제 내역"에서는 이미 있는 학생별 회차 묶음(loadStudentHomeworkSets와
-- 같은 모양)을 교사도 볼 수 있게 한다. docs/2026-09-16-homework-direct-issue-plan.md 개정.
drop function if exists public.load_homework_batch_into_session(uuid, uuid);
drop function if exists public.create_homework_draft_batch(uuid, jsonb);

alter table session_homework_items add column if not exists batch_id uuid references homework_draft_batches (id);
comment on column homework_draft_batches.loaded_at is '항상 발급 즉시 채워진다(2026-09-16부터 배치=발급, 별도 "불러오기" 단계 없음).';

create or replace function public.issue_homework_batch(
  p_student_id uuid, p_session_id uuid, p_requests jsonb
)
returns int
language plpgsql
security definer set search_path = public as $$
declare
  v_enrollment uuid;
  v_session_student uuid;
  v_req jsonb;
  v_keyword uuid;
  v_count int;
  v_ids uuid[] := array[]::uuid[];
  v_picked uuid[];
  v_pos int;
  v_pid uuid;
  v_problem problems%rowtype;
  v_issued int := 0;
  v_batch_id uuid;
begin
  if not (teaches_student(p_student_id) or is_admin()) then
    raise exception '담당하는 학생에게만 과제를 낼 수 있습니다.';
  end if;
  select subject_enrollment_id into v_enrollment from sessions where id = p_session_id;
  if v_enrollment is null then
    raise exception '수업을 찾을 수 없습니다.';
  end if;
  select child_id into v_session_student from subject_enrollments where id = v_enrollment;
  if v_session_student is null or v_session_student <> p_student_id then
    raise exception '이 수업의 학생과 다릅니다.';
  end if;
  if p_requests is null or jsonb_typeof(p_requests) <> 'array' then
    raise exception '키워드별 개수 목록이 필요합니다.';
  end if;

  for v_req in select * from jsonb_array_elements(p_requests) loop
    v_keyword := (v_req->>'keyword_id')::uuid;
    v_count := coalesce((v_req->>'count')::int, 0);
    if v_count <= 0 then
      continue;
    end if;
    select coalesce(array_agg(problem_id), array[]::uuid[]) into v_picked
    from (
      select c.problem_id
      from problem_auto_composition_candidates c
      where c.keyword_id = v_keyword
        and c.problem_id <> all (v_ids)
        and not exists (select 1 from session_homework_items h where h.student_id = p_student_id and h.problem_id = c.problem_id)
      group by c.problem_id
      order by random()
      limit v_count
    ) s;
    v_ids := v_ids || v_picked;
  end loop;

  if cardinality(v_ids) = 0 then
    raise exception '고를 수 있는 문제가 없습니다.';
  end if;

  insert into homework_draft_batches (student_id, created_by, source, problem_ids, loaded_at, loaded_session_id)
  values (p_student_id, auth.uid(), p_requests, v_ids, now(), p_session_id)
  returning id into v_batch_id;

  perform pg_advisory_xact_lock(hashtext(p_session_id::text));
  select coalesce(max(position), 0) into v_pos from session_homework_items where session_id = p_session_id;

  foreach v_pid in array v_ids loop
    select * into v_problem from problems where id = v_pid;
    if v_problem.id is null or v_problem.archived_at is not null or v_problem.status::text <> 'confirmed' or v_problem.published_version_id is null then
      continue;
    end if;
    v_pos := v_pos + 1;
    insert into session_homework_items
      (session_id, problem_id, student_id, position, was_used_in_lesson, was_already_attempted, composed_by, problem_version_id, batch_id)
    values (
      p_session_id, v_pid, p_student_id, v_pos,
      exists (select 1 from session_content_manifest m where m.session_id = p_session_id and m.content_type = 'problem' and m.content_id = v_pid),
      exists (select 1 from session_problem_work w where w.student_id = p_student_id and w.problem_id = v_pid and w.submitted_at is not null),
      auth.uid(), v_problem.published_version_id, v_batch_id
    );
    v_issued := v_issued + 1;
  end loop;

  return v_issued;
end;
$$;
revoke all on function public.issue_homework_batch(uuid, uuid, jsonb) from public, anon;
grant execute on function public.issue_homework_batch(uuid, uuid, jsonb) to authenticated;
