-- 문제 용도(usage_scope) 분류 + 유사문항 그룹 자동 부여 (2026-09-29, 제품 오너 결정 A·B)
--
-- (A) 같은 문제가 수업·과제와 모의고사 양쪽에 나오면 안 된다 → problems.usage_scope
--     'general'(수업·과제) | 'mock_exam'(모의고사) | 'both'(기존 문제 전용 — 새 문제·재분류 대상으로는 고를 수 없다).
--     기존 행은 전부 'both' (동작 변화 0). 새 문제는 create_bank_problem 이 general|mock_exam 을 필수로 받는다.
-- (B) similarity_group 을 만들 때 자동 부여: 컴파일러는 (skill_code, subpattern), 그 밖은 문항 본문 정규화 지문(md5).
--     관리자가 손으로 정한 값은 similarity_group_manual=true 로 잠가 자동 계산이 덮지 않는다. 기존 문제 백필 포함(멱등).
--
-- 영향: problems 컬럼 2개 추가(기존 행 default), 감사 테이블 1개, 함수·트리거·뷰 재정의(additive 게이트).
--       이미 고정된 세션 매니페스트·수업 구성 항목·모의고사 세트/응시는 건드리지 않는다.
-- 되돌리기: 트리거 problems_usage_scope_guard/_audit, problems_similarity_auto, problem_versions_similarity_auto,
--           mock_exam_set_items_usage_scope 삭제 → 함수 본문을 이 파일 이전 정의로 되돌림(게이트 줄만 제거)
--           → create_bank_problem 을 20261369 정의로 복원 → 뷰를 20261372 정의로 복원 → 컬럼 usage_scope·similarity_group_manual drop.

-- ── 1. 컬럼 ──────────────────────────────────────────────────────────────
alter table public.problems
  add column if not exists usage_scope text not null default 'both'
    check (usage_scope in ('general', 'mock_exam', 'both'));
comment on column public.problems.usage_scope is
  '용도(2026-09-29): general=수업·과제, mock_exam=모의고사, both=기존 문제(재분류 전 레거시). 새 문제는 both 가 될 수 없다(RPC·트리거).';

alter table public.problems
  add column if not exists similarity_group_manual boolean not null default false;
comment on column public.problems.similarity_group_manual is
  '관리자가 similarity_group 을 직접 정했으면 true — 자동 계산(트리거·백필)이 덮지 않는다.';

-- 이미 값이 있던 그룹은 사람이 정한 것으로 본다(백필이 덮지 않게).
update public.problems set similarity_group_manual = true where similarity_group is not null and not similarity_group_manual;

-- problems 는 컬럼 단위 SELECT 권한(20261904). 새 컬럼은 명시적으로 연다. usage_scope 는 무해한 메타데이터.
grant select (usage_scope) on public.problems to anon, authenticated;

-- ── 2. 'both' 는 레거시 전용: 다른 값에서 'both' 로 되돌릴 수 없다 ────────────
create or replace function public.problems_usage_scope_guard()
returns trigger language plpgsql as $$
begin
  if new.usage_scope = 'both' and old.usage_scope <> 'both' then
    raise exception '양쪽 용도(both)는 기존 문제 전용입니다. 일반용 또는 모의고사용으로만 분류할 수 있습니다.';
  end if;
  return new;
end $$;
drop trigger if exists problems_usage_scope_guard on public.problems;
create trigger problems_usage_scope_guard before update of usage_scope on public.problems
  for each row execute function public.problems_usage_scope_guard();

-- ── 3. 변경 감사(append-only) ────────────────────────────────────────────
create table if not exists public.problem_usage_scope_changes (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  from_scope text not null,
  to_scope text not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  reason text,
  batch_id uuid
);
create index if not exists problem_usage_scope_changes_problem_idx on public.problem_usage_scope_changes (problem_id, changed_at desc);
alter table public.problem_usage_scope_changes enable row level security;
revoke all on public.problem_usage_scope_changes from anon, authenticated;
grant select, insert on public.problem_usage_scope_changes to service_role;

create or replace function public.problem_usage_scope_changes_immutable()
returns trigger language plpgsql as $$
begin
  raise exception '용도 변경 기록은 수정할 수 없습니다.';
end $$;
drop trigger if exists problem_usage_scope_changes_immutable on public.problem_usage_scope_changes;
create trigger problem_usage_scope_changes_immutable before update on public.problem_usage_scope_changes
  for each row execute function public.problem_usage_scope_changes_immutable();

-- 어떤 경로로 바뀌든 기록한다. 행위자·사유·배치는 RPC 가 트랜잭션 설정으로 넘긴다.
create or replace function public.problems_usage_scope_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.usage_scope is distinct from old.usage_scope then
    insert into problem_usage_scope_changes (problem_id, from_scope, to_scope, changed_by, reason, batch_id)
    values (new.id, old.usage_scope, new.usage_scope,
            nullif(current_setting('alton.scope_actor', true), '')::uuid,
            nullif(current_setting('alton.scope_reason', true), ''),
            nullif(current_setting('alton.scope_batch', true), '')::uuid);
  end if;
  return new;
end $$;
drop trigger if exists problems_usage_scope_audit on public.problems;
create trigger problems_usage_scope_audit after update of usage_scope on public.problems
  for each row execute function public.problems_usage_scope_audit();

-- 재분류 RPC(일괄·단건 공용). 서버 액션(service_role)만 호출한다.
create or replace function public.retag_problem_usage_scope(
  p_problem_ids uuid[], p_scope text, p_actor_id uuid, p_reason text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  if p_scope not in ('general', 'mock_exam') then
    raise exception '용도는 일반용 또는 모의고사용 중에서 골라야 합니다.';
  end if;
  if coalesce(array_length(p_problem_ids, 1), 0) = 0 then return 0; end if;
  if array_length(p_problem_ids, 1) > 5000 then
    raise exception '한 번에 5000개까지만 바꿀 수 있습니다.';
  end if;
  perform set_config('alton.scope_actor', coalesce(p_actor_id::text, ''), true);
  perform set_config('alton.scope_reason', coalesce(p_reason, ''), true);
  perform set_config('alton.scope_batch', gen_random_uuid()::text, true);
  update problems set usage_scope = p_scope
  where id = any(p_problem_ids) and usage_scope <> p_scope;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.retag_problem_usage_scope(uuid[], text, uuid, text) from public, anon, authenticated;
grant execute on function public.retag_problem_usage_scope(uuid[], text, uuid, text) to service_role;

-- ── 4. 문제 만들기 RPC: 용도 필수 ────────────────────────────────────────
drop function if exists public.create_bank_problem(uuid, text, text, text, text, uuid, text, text, text);
-- 옛 5인수 오버로드(20261313)는 용도 없이 문제를 만들 수 있는 우회로다 — 내린다.
drop function if exists public.create_bank_problem(uuid, text, text, text, uuid);
create or replace function public.create_bank_problem(
  p_subject_id uuid,
  p_format text,
  p_skill_type text,
  p_topic text,
  p_difficulty text,
  p_actor_id uuid,
  p_skill_code text default null,
  p_exam_system text default null,
  p_ap_subject text default null,
  p_usage_scope text default null
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_usage_scope is null or p_usage_scope not in ('general', 'mock_exam') then
    raise exception '용도(일반용 또는 모의고사용)를 반드시 골라야 합니다.';
  end if;
  if not exists (select 1 from subjects where id = p_subject_id and archived_at is null) then
    raise exception '보관되지 않은 과목을 골라야 합니다.';
  end if;
  if nullif(p_skill_code, '') is not null and not exists (select 1 from problem_skill_codes where code = p_skill_code) then
    raise exception '알 수 없는 기술 코드입니다: %', p_skill_code;
  end if;
  if nullif(p_exam_system, '') is not null and p_exam_system not in ('sat_rw', 'sat_math', 'ap') then
    raise exception '알 수 없는 문항 체계입니다: %', p_exam_system;
  end if;
  insert into problems (format, subject_id, status, created_by, skill_type, topic, difficulty, skill_code, exam_system, ap_subject, usage_scope)
  values (p_format::problem_format, p_subject_id, 'draft', p_actor_id, nullif(p_skill_type, ''), nullif(p_topic, ''),
          nullif(p_difficulty, '')::problem_difficulty, nullif(p_skill_code, ''), nullif(p_exam_system, ''), nullif(p_ap_subject, ''), p_usage_scope)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_bank_problem(uuid, text, text, text, text, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_bank_problem(uuid, text, text, text, text, uuid, text, text, text, text) to service_role;

-- ── 5. 유사문항 그룹 자동 계산 (한 곳) ───────────────────────────────────
-- 키 규칙(보수적):
--   컴파일러  : 'c:<skill_code>:<subpattern>'  (같은 세부 패턴이면 숫자가 달라도 같은 틀)
--   그 밖      : 't:<skill_code>:<md5(정규화 본문) 앞 16자>'
--               정규화 = 질문+지문을 소문자로, 숫자열→#, 한글·영문·# 외 전부 제거. 지문이 통째로 같은(숫자·문장부호만 다른)
--               문항만 한 그룹이 된다 — R&W 는 질문 문장이 상투적이라 지문까지 포함해야 지나치게 뭉치지 않는다.
create or replace function public.problem_similarity_key(
  p_skill_code text, p_created_via text, p_subpattern text, p_passage text, p_question text
) returns text
language sql immutable as $$
  select case
    when p_created_via = 'compiler' and nullif(btrim(coalesce(p_subpattern, '')), '') is not null
      then 'c:' || coalesce(nullif(p_skill_code, ''), 'nosk') || ':' || btrim(p_subpattern)
    when nullif(btrim(coalesce(p_question, '') || coalesce(p_passage, '')), '') is not null
      then 't:' || coalesce(nullif(p_skill_code, ''), 'nosk') || ':' || left(md5(
        regexp_replace(
          regexp_replace(lower(coalesce(p_question, '') || ' ' || coalesce(p_passage, '')), '[0-9]+([.,][0-9]+)*', '#', 'g'),
          '[^a-z#가-힣]+', '', 'g')), 16)
    else null
  end
$$;

-- 지금 이 문제의 자동 그룹: 공개본이 있으면 공개본, 없으면 가장 최근 버전의 본문.
create or replace function public.problem_auto_similarity_group(
  p_problem_id uuid, p_skill_code text, p_created_via text, p_subpattern text
) returns text
language sql stable as $$
  select public.problem_similarity_key(p_skill_code, p_created_via, p_subpattern, v.passage, v.question)
  from (select 1) one
  left join lateral (
    select passage, question from problem_versions
    where problem_id = p_problem_id
    order by (status = 'published') desc, version_no desc
    limit 1
  ) v on true
$$;

-- 문제 행이 바뀔 때(컴파일러의 subpattern 기록, skill_code 수정, 수동 잠금 해제) 자동 값을 다시 맞춘다.
create or replace function public.problems_similarity_auto()
returns trigger language plpgsql as $$
begin
  -- 만들 때 그룹을 직접 넣었다면 사람이 정한 값이다(잠근다).
  if tg_op = 'INSERT' and new.similarity_group is not null then
    new.similarity_group_manual := true;
  end if;
  if not new.similarity_group_manual then
    new.similarity_group := public.problem_auto_similarity_group(new.id, new.skill_code, new.created_via, new.subpattern);
  end if;
  return new;
end $$;
drop trigger if exists problems_similarity_auto on public.problems;
create trigger problems_similarity_auto before insert or update of skill_code, subpattern, created_via, similarity_group_manual on public.problems
  for each row execute function public.problems_similarity_auto();

-- 버전 본문이 생기거나 바뀔 때(AI·수동 문제는 여기서 처음 계산된다).
create or replace function public.problem_versions_similarity_auto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update problems p
     set similarity_group = public.problem_auto_similarity_group(p.id, p.skill_code, p.created_via, p.subpattern)
   where p.id = new.problem_id and not p.similarity_group_manual
     and p.similarity_group is distinct from public.problem_auto_similarity_group(p.id, p.skill_code, p.created_via, p.subpattern);
  return null;
end $$;
drop trigger if exists problem_versions_similarity_auto on public.problem_versions;
create trigger problem_versions_similarity_auto after insert or update of passage, question, status on public.problem_versions
  for each row execute function public.problem_versions_similarity_auto();

-- 백필(멱등): 수동 값은 건드리지 않고, 계산 가능한 것만, 값이 다를 때만.
update public.problems p
   set similarity_group = k.key
  from (
    select id, public.problem_auto_similarity_group(id, skill_code, created_via, subpattern) as key
    from public.problems where not similarity_group_manual
  ) k
 where p.id = k.id and k.key is not null and p.similarity_group is distinct from k.key;

-- ── 6. 서버 측 게이트 ────────────────────────────────────────────────────
-- 6-1 모의고사 세트 문항: 모의고사용·기존(both)만.
create or replace function public.mock_exam_set_items_usage_scope()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_scope text;
begin
  if tg_op = 'UPDATE' and new.problem_id = old.problem_id then return new; end if;
  select usage_scope into v_scope from problems where id = new.problem_id;
  if v_scope is null then raise exception '존재하지 않는 문제입니다.'; end if;
  if v_scope not in ('mock_exam', 'both') then
    raise exception '일반용 문제는 모의고사에 넣을 수 없습니다.';
  end if;
  return new;
end $$;
drop trigger if exists mock_exam_set_items_usage_scope on public.mock_exam_set_items;
create trigger mock_exam_set_items_usage_scope before insert or update of problem_id on public.mock_exam_set_items
  for each row execute function public.mock_exam_set_items_usage_scope();

-- 6-2 수업·과제 후보(키워드 자동 구성·과제 자동 발급·직접 발급의 공통 원천): 일반용·기존(both)만.
-- problem_keywords_selectable 자체는 건드리지 않는다 — 고정(pin) 경로가 그것을 다시 읽으므로 나중에 재분류해도
-- 이미 담은 항목의 수업 시작이 막히지 않게 한다.
create or replace view public.problem_auto_composition_candidates
with (security_invoker = true) as
select pk.problem_id, pk.keyword_id, p.format, p.difficulty, p.created_at, p.sat_domain, p.skill_code, p.exam_system
from problem_keywords_selectable pk
join problems p on p.id = pk.problem_id
where p.usage_scope in ('general', 'both')
  and exists (
    select 1 from problem_versions v
    where v.problem_id = pk.problem_id and v.status = 'published' and v.repair_status = 'none'
      and problem_version_has_question(v.passage, v.question)
  );

-- 6-3 새로 담는 순간 검사하는 트리거·함수(이미 담긴 행의 무관한 UPDATE 는 통과 — 기존 조기 반환 규칙 유지).
CREATE OR REPLACE FUNCTION public.check_prep_item_usable()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_status problem_status;
  v_archived timestamptz;
  v_scope text;
begin
  if new.content_type <> 'problem' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.content_id = old.content_id then
    return new;
  end if;

  select status, archived_at, usage_scope into v_status, v_archived, v_scope
  from problems where id = new.content_id;

  if v_status is null then
    raise exception '존재하지 않는 문제입니다.';
  end if;
  if v_status <> 'confirmed' then
    raise exception '확정되지 않은 문제는 회차 준비에 담을 수 없습니다.';
  end if;
  if v_archived is not null then
    raise exception '보관된 문제는 새로 담을 수 없습니다.';
  end if;
  if v_scope not in ('general', 'both') then
    raise exception '모의고사용 문제는 수업·과제 준비에 담을 수 없습니다.';
  end if;
  if not exists (
    select 1 from problem_versions v
    where v.problem_id = new.content_id and v.status = 'published'
  ) then
    raise exception '공개된 버전이 없는 문제는 회차 준비에 담을 수 없습니다.';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_unit_problem_usable()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_status problem_status;
  v_archived timestamptz;
  v_scope text;
begin
  if tg_op = 'UPDATE' and new.problem_id = old.problem_id then
    return new;
  end if;

  select status, archived_at, usage_scope into v_status, v_archived, v_scope
  from problems where id = new.problem_id;

  if v_status is null then
    raise exception '존재하지 않는 문제입니다.';
  end if;
  if v_status <> 'confirmed' then
    raise exception '확정되지 않은 문제는 회차 구성에 담을 수 없습니다.';
  end if;
  if v_archived is not null then
    raise exception '보관된 문제는 새로 담을 수 없습니다.';
  end if;
  if v_scope not in ('general', 'both') then
    raise exception '모의고사용 문제는 회차 구성에 담을 수 없습니다.';
  end if;
  if not exists (
    select 1 from problem_versions v
    where v.problem_id = new.problem_id and v.status = 'published'
  ) then
    raise exception '공개된 버전이 없는 문제는 회차 구성에 담을 수 없습니다.';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_homework_item_problem_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_status problem_status;
  v_scope text;
begin
  select status, usage_scope into v_status, v_scope from problems where id = new.problem_id;
  if v_status is null then
    raise exception '존재하지 않는 문제입니다: %', new.problem_id;
  end if;
  if v_status <> 'confirmed' then
    raise exception 'confirmed 상태가 아닌 문제는 과제로 발급할 수 없습니다: %', new.problem_id;
  end if;
  if v_scope not in ('general', 'both') then
    raise exception '모의고사용 문제는 과제로 발급할 수 없습니다: %', new.problem_id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_prepared_content_item_selectable()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_unit_selection_id uuid;
  v_ok boolean;
  v_reason text;
  v_problem_id uuid;
  v_problem_archived_at timestamptz;
  v_problem_status text;
  v_problem_scope text;
begin
  perform public.check_prepared_selection_not_pinned(new.prepared_selection_id);

  select prepared_selection_id into v_unit_selection_id
  from session_prepared_selection_units
  where id = new.prepared_selection_unit_id;

  if v_unit_selection_id is null then
    raise exception '존재하지 않는 준비된 선택 단원입니다: %', new.prepared_selection_unit_id;
  end if;

  if v_unit_selection_id <> new.prepared_selection_id then
    raise exception '이 단원은 다른 준비된 선택에 속해 있어 출처로 지목할 수 없습니다: %', new.prepared_selection_unit_id;
  end if;

  if new.content_type = 'material_doc' then
    select exists (
      select 1 from curriculum_docs d
      where d.id = new.content_id and d.status = 'published' and d.archived_at is null
    ) into v_ok;
    if not v_ok then v_reason := '교재가 공개돼 있지 않거나 보관됐습니다'; end if;

  elsif new.content_type = 'material_section' then
    select exists (
      select 1
      from session_prepared_selection_unit_keywords k
      join curriculum_doc_section_keywords_selectable sel
        on sel.section_id = new.content_id and sel.keyword_id = k.keyword_id
      where k.prepared_selection_unit_id = new.prepared_selection_unit_id
    ) into v_ok;
    if not v_ok then v_reason := '교재가 공개돼 있지 않거나 이 회차의 키워드 범위 밖입니다'; end if;

  elsif new.content_type = 'problem' then
    select id, archived_at, status::text, usage_scope into v_problem_id, v_problem_archived_at, v_problem_status, v_problem_scope
      from problems where id = new.content_id;

    select exists (
      select 1
      from session_prepared_selection_unit_keywords k
      join problem_keywords_selectable sel
        on sel.problem_id = new.content_id and sel.keyword_id = k.keyword_id
      where k.prepared_selection_unit_id = new.prepared_selection_unit_id
    ) into v_ok;
    if v_ok and v_problem_scope not in ('general', 'both') then v_ok := false; end if;

    if not v_ok then
      v_reason := case
        when v_problem_id is null then '문제를 찾을 수 없습니다'
        when v_problem_archived_at is not null then '보관된 문제입니다'
        when v_problem_status <> 'confirmed' then '아직 공개되지 않은 문제입니다'
        when v_problem_scope not in ('general', 'both') then '모의고사용 문제입니다'
        else '이 회차의 키워드 범위 밖입니다'
      end;
    end if;

  else
    raise exception '알 수 없는 콘텐츠 유형입니다: %', new.content_type;
  end if;

  if not v_ok then
    raise exception '선택 가능(published/confirmed)하지 않거나 이 단원의 키워드 범위 밖인 콘텐츠는 담을 수 없습니다: % % (%)',
      new.content_type, new.content_id, v_reason;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.compose_homework_from_session(p_session_id uuid, p_keyword_ids uuid[], p_count integer, p_include_used_in_lesson boolean, p_include_already_attempted boolean)
 RETURNS TABLE(issued_problem_ids uuid[], requested_count integer, issued_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    join problems sp on sp.id = pks.problem_id and sp.usage_scope in ('general', 'both')
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
$function$
;

CREATE OR REPLACE FUNCTION public.issue_homework_items(p_session_id uuid, p_problem_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    if v_problem.usage_scope not in ('general', 'both') then
      raise exception '모의고사용 문제는 과제로 낼 수 없습니다.';
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
$function$
;

-- 관리자: 영역·기술 코드별 용도 풀 크기(모의고사 풀 충분성 확인용).
create or replace function public.problem_pool_by_scope()
returns table(sat_domain text, skill_code text, usage_scope text, total bigint, published bigint)
language sql stable security definer set search_path = public as $$
  select p.sat_domain, p.skill_code, p.usage_scope, count(*),
         count(*) filter (where p.status = 'confirmed'
                            and exists (select 1 from problem_versions v where v.problem_id = p.id and v.status = 'published'))
  from problems p
  where p.archived_at is null and p.sat_domain is not null
  group by 1, 2, 3
$$;
revoke all on function public.problem_pool_by_scope() from public, anon, authenticated;
grant execute on function public.problem_pool_by_scope() to service_role;
