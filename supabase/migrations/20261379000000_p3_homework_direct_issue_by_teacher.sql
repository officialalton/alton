-- 2026-09-16 제품 오너 지시 — 과제를 "그 수업(회차) 키워드 풀"에 묶지 않는다. 교사 포털에서
-- 학생별로 키워드를 직접 골라 배치(아직 어느 수업에도 안 실린 상태)를 만들고, 세션뷰에서는 그
-- 배치 목록 중 원하는 것을 그 수업에 "불러오기"만 한다(단어장 즉석 시험 발급과 같은 구조).
-- docs/2026-09-16-homework-direct-issue-plan.md 참고. 기존 issue_homework_items/
-- issue_homework_by_keywords(회차 키워드 범위 안에서 직접 발급하는 옛 경로)는 그대로 둔다 —
-- 실제로 수업에 실리는 순간부터는 지금 흐름(session_homework_items/session_problem_work)을
-- 그대로 쓰고, session_problem_work.session_id not null 제약도 건드리지 않는다.

create table homework_draft_batches (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  created_by uuid not null references profiles (id),
  source jsonb not null,
  problem_ids uuid[] not null,
  created_at timestamptz not null default now(),
  loaded_at timestamptz,
  loaded_session_id uuid references sessions (id)
);
create index on homework_draft_batches (student_id, created_at desc);
comment on table homework_draft_batches is
  '교사가 학생별로 키워드를 골라 미리 만들어 둔 과제 문제 묶음. 아직 어떤 수업에도 실리지 않은
  상태 — 세션뷰에서 load_homework_batch_into_session()으로 실제 발급되기 전까지는 학생·보호자에게
  보이지 않는다(그때부터는 session_homework_items가 진짜 원본).';
comment on column homework_draft_batches.source is '{requests: [{keyword_id, count}]} — 어느 키워드에서 몇 개를 요청했는지.';

alter table homework_draft_batches enable row level security;
create policy "담당 선생님/관리자" on homework_draft_batches for all
  using (teaches_student(student_id) or is_admin())
  with check (created_by = auth.uid() and (teaches_student(student_id) or is_admin()));

-- 키워드별 개수를 받아 문제은행 전체(회차 제한 없음)에서 무작위로 뽑아 배치로 저장한다.
-- 이 학생에게 이미 발급된 적 있는 문제(session_homework_items)는 다시 뽑지 않는다.
create or replace function public.create_homework_draft_batch(
  p_student_id uuid, p_requests jsonb
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_req jsonb;
  v_keyword uuid;
  v_count int;
  v_ids uuid[] := array[]::uuid[];
  v_picked uuid[];
  v_id uuid;
begin
  if not (teaches_student(p_student_id) or is_admin()) then
    raise exception '담당하는 학생에게만 과제를 만들 수 있습니다.';
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
        and not exists (
          select 1 from session_homework_items h where h.student_id = p_student_id and h.problem_id = c.problem_id
        )
      group by c.problem_id
      order by random()
      limit v_count
    ) s;
    v_ids := v_ids || v_picked;
  end loop;

  if cardinality(v_ids) = 0 then
    raise exception '고를 수 있는 문제가 없습니다.';
  end if;

  insert into homework_draft_batches (student_id, created_by, source, problem_ids)
  values (p_student_id, auth.uid(), p_requests, v_ids)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_homework_draft_batch(uuid, jsonb) from public, anon;
grant execute on function public.create_homework_draft_batch(uuid, jsonb) to authenticated;

-- 배치를 실제 수업에 불러와 발급한다 — 그 순간부터는 기존 issue_homework_items와 같은 검증
-- (확정·공개 버전·중복)을 쓰되, "회차 키워드 범위" 검사만 뺀다(배치 자체가 이미 교사가 고른 것).
create or replace function public.load_homework_batch_into_session(
  p_batch_id uuid, p_session_id uuid
)
returns int
language plpgsql
security definer set search_path = public as $$
declare
  v_batch homework_draft_batches%rowtype;
  v_enrollment uuid;
  v_session_student uuid;
  v_pos int;
  v_pid uuid;
  v_problem problems%rowtype;
  v_issued int := 0;
begin
  select * into v_batch from homework_draft_batches where id = p_batch_id;
  if not found then
    raise exception '과제 배치를 찾을 수 없습니다.';
  end if;
  if not (teaches_student(v_batch.student_id) or is_admin()) then
    raise exception '담당하는 학생의 과제만 불러올 수 있습니다.';
  end if;
  select subject_enrollment_id into v_enrollment from sessions where id = p_session_id;
  if v_enrollment is null then
    raise exception '수업을 찾을 수 없습니다.';
  end if;
  select child_id into v_session_student from subject_enrollments where id = v_enrollment;
  if v_session_student is null or v_session_student <> v_batch.student_id then
    raise exception '이 수업의 학생과 과제 배치의 학생이 다릅니다.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_session_id::text));
  select coalesce(max(position), 0) into v_pos from session_homework_items where session_id = p_session_id;

  foreach v_pid in array v_batch.problem_ids loop
    if exists (select 1 from session_homework_items where session_id = p_session_id and problem_id = v_pid) then
      continue;
    end if;
    select * into v_problem from problems where id = v_pid;
    if v_problem.id is null then
      continue;
    end if;
    if v_problem.archived_at is not null or v_problem.status::text <> 'confirmed' or v_problem.published_version_id is null then
      continue;
    end if;
    v_pos := v_pos + 1;
    insert into session_homework_items
      (session_id, problem_id, student_id, position, was_used_in_lesson, was_already_attempted, composed_by, problem_version_id)
    values (
      p_session_id, v_pid, v_batch.student_id, v_pos,
      exists (select 1 from session_content_manifest m where m.session_id = p_session_id and m.content_type = 'problem' and m.content_id = v_pid),
      exists (select 1 from session_problem_work w where w.student_id = v_batch.student_id and w.problem_id = v_pid and w.submitted_at is not null),
      auth.uid(), v_problem.published_version_id
    );
    v_issued := v_issued + 1;
  end loop;

  update homework_draft_batches set loaded_at = now(), loaded_session_id = p_session_id where id = p_batch_id;
  return v_issued;
end;
$$;
revoke all on function public.load_homework_batch_into_session(uuid, uuid) from public, anon;
grant execute on function public.load_homework_batch_into_session(uuid, uuid) to authenticated;
