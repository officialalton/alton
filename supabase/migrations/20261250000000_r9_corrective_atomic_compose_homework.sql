-- R9 corrective — Task 4의 composeHomeworkFromSession()을 겨냥한 두 가지 진짜
-- 공백을 고친다(제품 오너 재검토로 확인):
--
-- Gap 1) "이미 풀어본 문제" 토글(includeAlreadyAttempted)이 legacy
--   session_problem_attempts만 보고 v3 session_homework_attempts(제출 완료분)를
--   보지 않는다. student가 v3 과제로 제출(submitted=true)한 문제는 draft와
--   달리 "이미 풀어봄"으로 쳐야 한다.
--   제약: 지금 과제를 구성하는 선생님/관리자가 "이 학생이 어떤 problem_id를
--   제출했는가"만 판별할 수 있어야 하고, 다른 세션(다른 담당 선생님)의
--   session_homework_attempts.response(실제 답안 원문)를 열람할 권한까지
--   넓혀선 안 된다 — session_homework_attempts의 기존 RLS(20261240000000)는
--   "그 항목이 속한 세션의 담당 선생님"만 조회를 허용하므로, 다른 세션에서
--   제출된 attempt는 지금 이 세션 담당 선생님에게는 애초에 보이지 않는다.
--   그래서 "problem_id만" 돌려주는 이 판별을 SECURITY DEFINER로 두되(진짜
--   방어선은 여전히 is_active_teacher_for_enrollment()/is_admin() 재사용 —
--   check_homework_item_problem_confirmed()와 같은 성격의, 새 인가 메커니즘을
--   만들지 않는 재사용), 반환 컬럼을 problem_id 하나로 제한해 원문 노출을
--   막는다.
--
-- Gap 2) 같은 세션에 대한 재구성(re-compose)이 이미 발급된 problem_id를 다시
--   후보에 넣어 (session_id, problem_id) 유니크 제약을 건드리면 요청 전체가
--   실패한다. 게다가 "후보 조회 → 삽입"이 앱 레이어의 여러 왕복 요청으로
--   나뉘어 있어(homework-composition-actions.ts) 동시 호출 사이에 원자성이
--   없다 — 두 요청이 같은 문제를 동시에 골라 유니크 제약으로 한쪽만 부분
--   실패하거나, position이 겹칠 수 있다.
--
-- 해결: 후보 조회부터 삽입까지 전부를 단일 SECURITY DEFINER SQL 함수
-- (compose_homework_from_session)로 묶는다 — 하나의 함수 호출은 하나의
-- 트랜잭션이므로 그 자체로 원자적이다(전부 성공하거나 전부 롤백). 동시
-- 호출간 경쟁은 pg_advisory_xact_lock(hashtext(session_id))로 그 세션에
-- 대해서만 직렬화한다(다른 세션의 동시 구성은 서로 막지 않음) — SELECT 이후
-- INSERT 사이의 gap에 다른 트랜잭션이 끼어들 수 없다. 후보 수가 요청한 count에
-- 못 미치면 조용히 전체 요청을 성공한 것처럼 보이지 않고 실제 발급된 개수
-- (issued_count)와 요청한 개수(requested_count)를 둘 다 정직하게 반환한다.

-- =========================================================================
-- 1. compose_homework_from_session — 유일한 원자적 쓰기 경로.
-- =========================================================================

create or replace function public.compose_homework_from_session(
  p_session_id uuid,
  p_keyword_ids uuid[],
  p_count int,
  p_include_used_in_lesson boolean,
  p_include_already_attempted boolean
)
returns table (issued_problem_ids uuid[], requested_count int, issued_count int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subject_enrollment_id uuid;
  v_student_id uuid;
  v_start_position int;
begin
  if p_count is null or p_count <= 0 then
    return query select array[]::uuid[], coalesce(p_count, 0), 0;
    return;
  end if;

  select subject_enrollment_id into v_subject_enrollment_id
  from sessions where id = p_session_id;
  if v_subject_enrollment_id is null then
    raise exception '세션을 찾을 수 없습니다: %', p_session_id;
  end if;

  select child_id into v_student_id
  from subject_enrollments where id = v_subject_enrollment_id;
  if v_student_id is null then
    raise exception '수강 정보를 찾을 수 없습니다.';
  end if;

  -- 인가: student-curriculum-actions.ts의 requireAssignedTeacherOrAdmin과
  -- 정확히 같은 판정을 재사용한다(is_active_teacher_for_enrollment/is_admin,
  -- 20261229000000). 새 인가 프리미티브를 만들지 않는다. 이 함수가 SECURITY
  -- DEFINER라서 이 검사가 유일한 방어선이다 — 통과 못 하면 여기서 즉시 거부.
  if not (public.is_admin() or public.is_active_teacher_for_enrollment(v_subject_enrollment_id)) then
    raise exception '담당 학생의 세션에만 과제를 구성할 수 있습니다.';
  end if;

  if p_keyword_ids is null or array_length(p_keyword_ids, 1) is null then
    return query select array[]::uuid[], p_count, 0;
    return;
  end if;

  -- 이 세션에 대한 동시 호출을 직렬화한다 — 트랜잭션 종료까지 유지되는
  -- advisory lock이라 "후보 조회 → 삽입" 사이에 다른 호출이 끼어들 수 없다.
  -- 다른 세션에 대한 동시 호출은 서로 다른 락 키라 막지 않는다.
  perform pg_advisory_xact_lock(hashtext(p_session_id::text));

  select coalesce(max(position), 0) into v_start_position
  from session_homework_items where session_id = p_session_id;

  return query
  with candidates as (
    select distinct pks.problem_id
    from problem_keywords_selectable pks
    where pks.keyword_id = any(p_keyword_ids)
  ),
  used as (
    select content_id as problem_id
    from session_content_use_events
    where session_id = p_session_id and content_type = 'problem'
  ),
  attempted_legacy as (
    select problem_id from session_problem_attempts where student_id = v_student_id
  ),
  -- Gap 1: v3 과제로 "제출 완료"된 문제만 이미 풀어본 것으로 친다 — draft
  -- (submitted=false)는 여전히 후보 풀에 남아야 한다. problem_id만 뽑는다
  -- (response 원문은 어디에도 select하지 않는다 — 최소 노출).
  attempted_v3 as (
    select shi.problem_id
    from session_homework_items shi
    join session_homework_attempts sha on sha.homework_item_id = shi.id
    where shi.student_id = v_student_id and sha.submitted = true
  ),
  -- Gap 2: 이 세션에 이미 발급된 problem_id는 누가 언제 구성했든 후보에서
  -- 제외한다(유니크 제약 위반을 애초에 만들지 않는다).
  already_issued as (
    select problem_id from session_homework_items where session_id = p_session_id
  ),
  pool as (
    select c.problem_id
    from candidates c
    where c.problem_id not in (select problem_id from already_issued)
      and (p_include_used_in_lesson or c.problem_id not in (select problem_id from used))
      and (
        p_include_already_attempted
        or (
          c.problem_id not in (select problem_id from attempted_legacy)
          and c.problem_id not in (select problem_id from attempted_v3)
        )
      )
  ),
  picked as (
    select problem_id, row_number() over (order by problem_id) as rn
    from pool
    order by problem_id
    limit p_count
  ),
  inserted as (
    insert into session_homework_items (
      session_id, problem_id, student_id, position,
      was_used_in_lesson, was_already_attempted, composed_by
    )
    select
      p_session_id,
      picked.problem_id,
      v_student_id,
      v_start_position + picked.rn,
      exists (select 1 from used u where u.problem_id = picked.problem_id),
      exists (select 1 from attempted_legacy a where a.problem_id = picked.problem_id)
        or exists (select 1 from attempted_v3 a2 where a2.problem_id = picked.problem_id),
      auth.uid()
    from picked
    returning problem_id
  )
  select
    coalesce(array_agg(problem_id), array[]::uuid[]),
    p_count,
    count(*)::int
  from inserted;
end;
$$;

comment on function public.compose_homework_from_session(uuid, uuid[], int, boolean, boolean) is
  'R9 corrective: composeHomeworkFromSession()의 유일한 쓰기 경로 — 후보 조회부터
  삽입까지 단일 트랜잭션(원자적)이며, 세션 단위 advisory lock으로 동시 호출을
  직렬화한다. v3 session_homework_attempts(submitted=true)까지 "이미 풀어봄"
  판정에 포함하되 problem_id 외 컬럼은 어디서도 select하지 않는다(최소 노출).
  이미 이 세션에 발급된 problem_id는 후보에서 제외한다. issued_count <
  requested_count면 후보 부족을 뜻하며 호출자가 사용자에게 정직하게 알릴 수 있다.';

revoke execute on function public.compose_homework_from_session(uuid, uuid[], int, boolean, boolean)
  from public, anon;
grant execute on function public.compose_homework_from_session(uuid, uuid[], int, boolean, boolean)
  to authenticated;
