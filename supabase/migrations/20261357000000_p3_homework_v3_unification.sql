-- 2026-09-14 — 과제 v3 한 갈래 통일. docs/2026-09-14-homework-v3-unification.md
--   발급 원본은 session_homework_items(+ 발급 시 문제 버전 고정), 답·채점 원본은 수업 문제와 같은
--   session_problem_work. 교사가 회차 키워드 풀에서 직접 골라 발급한다.

alter table session_homework_items
  add column if not exists problem_version_id uuid references problem_versions (id);
comment on column session_homework_items.problem_version_id is
  '발급 시점의 공개 버전. 이후 문제를 고쳐도 학생이 받은 과제는 그대로다.';

-- 교사가 고른 문제를 이 수업의 과제로 발급한다. 이미 발급된 문제는 건너뛴다. 발급된 수를 돌려준다.
create or replace function public.issue_homework_items(p_session_id uuid, p_problem_ids uuid[])
returns int
language plpgsql
security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_enrollment uuid;
  v_student uuid;
  v_unit uuid;
  v_pos int;
  v_pid uuid;
  v_problem problems%rowtype;
  v_issued int := 0;
begin
  if v_caller is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;
  select subject_enrollment_id into v_enrollment from sessions where id = p_session_id;
  if v_enrollment is null then
    raise exception '수업을 찾을 수 없습니다.';
  end if;
  if not (public.is_admin() or public.is_active_teacher_for_enrollment(v_enrollment)) then
    raise exception '담당 학생의 수업에만 과제를 발급할 수 있습니다.';
  end if;
  select child_id into v_student from subject_enrollments where id = v_enrollment;
  select overlay_unit_id into v_unit
  from session_curriculum_units where session_id = p_session_id and role = 'primary' limit 1;
  if v_unit is null then
    raise exception '이 수업에 연결된 회차가 없어 과제 풀을 정할 수 없습니다.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_session_id::text));
  select coalesce(max(position), 0) into v_pos from session_homework_items where session_id = p_session_id;

  foreach v_pid in array coalesce(p_problem_ids, array[]::uuid[]) loop
    if exists (select 1 from session_homework_items where session_id = p_session_id and problem_id = v_pid) then
      continue;
    end if;
    select * into v_problem from problems where id = v_pid;
    if v_problem.id is null then
      raise exception '문제를 찾을 수 없습니다.';
    end if;
    if v_problem.archived_at is not null or v_problem.status::text <> 'confirmed' then
      raise exception '확정되지 않았거나 보관된 문제는 과제로 낼 수 없습니다.';
    end if;
    if v_problem.published_version_id is null then
      raise exception '공개된 버전이 없는 문제는 과제로 낼 수 없습니다.';
    end if;
    if not exists (
      select 1
      from curriculum_overlay_unit_keywords k
      join problem_keywords_selectable sel on sel.keyword_id = k.keyword_id and sel.problem_id = v_pid
      where k.overlay_unit_id = v_unit
    ) then
      raise exception '이 회차의 키워드 범위 밖 문제는 과제로 낼 수 없습니다.';
    end if;
    v_pos := v_pos + 1;
    insert into session_homework_items
      (session_id, problem_id, student_id, position, was_used_in_lesson, was_already_attempted, composed_by, problem_version_id)
    values (
      p_session_id, v_pid, v_student, v_pos,
      exists (select 1 from session_content_manifest m where m.session_id = p_session_id and m.content_type = 'problem' and m.content_id = v_pid),
      exists (select 1 from session_problem_work w where w.student_id = v_student and w.problem_id = v_pid and w.submitted_at is not null),
      v_caller, v_problem.published_version_id
    );
    v_issued := v_issued + 1;
  end loop;
  return v_issued;
end;
$$;
revoke all on function public.issue_homework_items(uuid, uuid[]) from public, anon;
grant execute on function public.issue_homework_items(uuid, uuid[]) to authenticated;

-- 회수 — 학생이 아직 풀이판을 열지 않은 항목만.
create or replace function public.withdraw_homework_item(p_item_id uuid)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  v_item session_homework_items%rowtype;
  v_enrollment uuid;
begin
  if auth.uid() is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;
  select * into v_item from session_homework_items where id = p_item_id;
  if not found then
    raise exception '과제 항목을 찾을 수 없습니다.';
  end if;
  select subject_enrollment_id into v_enrollment from sessions where id = v_item.session_id;
  if not (public.is_admin() or public.is_active_teacher_for_enrollment(v_enrollment)) then
    raise exception '담당 선생님만 과제를 회수할 수 있습니다.';
  end if;
  if exists (
    select 1 from session_problem_work w
    where w.session_id = v_item.session_id and w.student_id = v_item.student_id and w.problem_id = v_item.problem_id
  ) then
    raise exception '학생이 이미 풀기 시작한 과제는 회수할 수 없습니다.';
  end if;
  delete from session_homework_items where id = p_item_id;
end;
$$;
revoke all on function public.withdraw_homework_item(uuid) from public, anon;
grant execute on function public.withdraw_homework_item(uuid) to authenticated;

-- 유형 조회: 수업 문제 + 과제 문제.
create or replace function public.session_problem_formats(p_session_id uuid)
returns table (problem_id uuid, format text)
language sql stable security definer set search_path = public as $$
  select distinct p.id, p.format::text
  from problems p
  where (public.is_session_related_v3(p_session_id) or is_admin())
    and (
      p.id in (select cm.content_id from session_content_manifest cm where cm.session_id = p_session_id and cm.content_type = 'problem')
      or p.id in (select h.problem_id from session_homework_items h where h.session_id = p_session_id)
    );
$$;

-- 풀이판의 문제 버전: 수업 고정본 → 과제 발급본 → 현재 공개본.
create or replace function public.start_problem_work(
  p_session_id uuid,
  p_student_id uuid,
  p_problem_id uuid,
  p_new_attempt boolean default false
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_existing session_problem_work%rowtype;
  v_next int;
  v_version_id uuid;
  v_id uuid;
begin
  if not exists (select 1 from sessions where id = p_session_id) then
    raise exception '존재하지 않는 수업입니다.';
  end if;
  select * into v_existing from session_problem_work
    where session_id = p_session_id and student_id = p_student_id and problem_id = p_problem_id
    order by attempt_no desc limit 1;
  if found and not p_new_attempt then
    return v_existing.id;
  end if;
  v_next := coalesce(v_existing.attempt_no, 0) + 1;
  select coalesce(
    (select m.problem_version_id from session_content_manifest m
      where m.session_id = p_session_id and m.content_id = p_problem_id and m.problem_version_id is not null
      limit 1),
    (select h.problem_version_id from session_homework_items h
      where h.session_id = p_session_id and h.problem_id = p_problem_id and h.problem_version_id is not null
      limit 1),
    (select p.published_version_id from problems p where p.id = p_problem_id)
  ) into v_version_id;
  insert into session_problem_work (session_id, student_id, problem_id, problem_version_id, attempt_no)
  values (p_session_id, p_student_id, p_problem_id, v_version_id, v_next)
  returning id into v_id;
  return v_id;
end;
$$;
