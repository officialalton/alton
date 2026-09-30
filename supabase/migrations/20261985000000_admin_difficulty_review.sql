-- 관리자 hard 난이도 점검 (2026-10-01, feat/admin-difficulty-review)
--
-- 배경(제품 오너): hard 는 AI 판정(College Board 공식 난이도와 교정 불가)이라 '잠정'이다. 관리자가 점검·변경하고,
-- 출시 후에는 실제 정답률로 재보정한다.
--
-- 구조:
--   * problems.difficulty_status('provisional'|'confirmed', 기본 confirmed) + 확인 시각·확인자.
--     잠정 = AI 생성(created_via='ai_generated') hard. 기존 비AI 문항은 기본값 그대로(건드리지 않음).
--   * problem_difficulty_changes: 변경·확인 이력(append-only — 수정·삭제 트리거 차단, service_role select/insert 만).
--   * review_problem_difficulty(): 정의자 RPC, service_role 만 execute, 내부에서 admin 재검사. 공개·초안·검토 버전의
--     difficulty 와 problems.difficulty 를 한 트랜잭션에서 맞춘다. 본문·정답·해설·버전 번호·공개 시각은 그대로(난이도는
--     분류 메타데이터). mock_exam_set_items.difficulty(조립 스냅샷)·응시·수업 매니페스트는 건드리지 않는다.
--   * problem_difficulty_review_list/_detail: 서버 페이지네이션 목록(요약 포함 1회)·상세.
--   * problems.difficulty 직접 UPDATE 는 트리거로 막는다(이력 우회 차단). 기존 경로 중 이 컬럼을 UPDATE 하는 곳은 없다.
--
-- 영향: problems 컬럼 3개(기본값), 테이블 1개, 함수·트리거 추가(additive). 기존 세트·응시·과제는 변하지 않는다.
-- 되돌리기: drop function review_problem_difficulty / problem_difficulty_review_list / problem_difficulty_review_detail /
--           problem_difficulty_set_impact; drop trigger problems_difficulty_guard, problems_difficulty_status_auto;
--           drop table problem_difficulty_changes; alter table problems drop column difficulty_status,
--           difficulty_confirmed_at, difficulty_confirmed_by.

-- ── 1. 컬럼 ────────────────────────────────────────────────────────────
alter table public.problems
  add column if not exists difficulty_status text not null default 'confirmed'
    check (difficulty_status in ('provisional', 'confirmed')),
  add column if not exists difficulty_confirmed_at timestamptz,
  add column if not exists difficulty_confirmed_by uuid;
comment on column public.problems.difficulty_status is
  '난이도 확정 상태(2026-10-01): provisional=AI 판정 잠정(관리자 점검 전), confirmed=확정. 기본 confirmed 이고 difficulty_confirmed_at 이 null 이면 "기존 확정(점검 대상 아님)".';
comment on column public.problems.difficulty_confirmed_at is '관리자가 난이도를 확인·변경한 시각.';

create index if not exists problems_difficulty_provisional_idx on public.problems (id) where difficulty_status = 'provisional';

-- 백필: 기존 AI 생성 hard 만 잠정. 비AI 문항은 건드리지 않는다. 멱등.
update public.problems p
   set difficulty_status = 'provisional'
 where p.created_via = 'ai_generated'
   and p.difficulty_status <> 'provisional'
   and p.difficulty_confirmed_at is null
   and (p.difficulty = 'hard'
        or exists (select 1 from public.problem_versions v where v.id = p.published_version_id and v.difficulty = 'hard'));

-- ── 2. 이후 생성되는 AI hard 도 자동 잠정 ─────────────────────────────────
-- 생성 임포트는 문제를 만든 뒤 created_via 를 ai_generated 로 바꾼다 → 전환 시점(또는 INSERT)에 판정한다.
create or replace function public.problems_difficulty_status_auto()
returns trigger language plpgsql as $$
begin
  if new.created_via = 'ai_generated' and new.difficulty = 'hard'
     and (tg_op = 'INSERT' or old.created_via is distinct from new.created_via) then
    new.difficulty_status := 'provisional';
  end if;
  return new;
end $$;
drop trigger if exists problems_difficulty_status_auto on public.problems;
create trigger problems_difficulty_status_auto before insert or update of created_via on public.problems
  for each row execute function public.problems_difficulty_status_auto();

-- ── 3. 난이도·상태 직접 변경 차단(RPC 만 통과) ─────────────────────────────
create or replace function public.problems_difficulty_guard()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('alton.difficulty_rpc', true), '') <> 'on' then
    if new.difficulty is distinct from old.difficulty
       or new.difficulty_status is distinct from old.difficulty_status
       or new.difficulty_confirmed_at is distinct from old.difficulty_confirmed_at
       or new.difficulty_confirmed_by is distinct from old.difficulty_confirmed_by then
      raise exception '문항 난이도는 난이도 점검 기능으로만 바꿀 수 있습니다.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists problems_difficulty_guard on public.problems;
create trigger problems_difficulty_guard before update of difficulty, difficulty_status, difficulty_confirmed_at, difficulty_confirmed_by on public.problems
  for each row execute function public.problems_difficulty_guard();
-- 자동 잠정 트리거는 created_via 갱신에서만 돌고(difficulty_status 는 SET 절에 없다) 가드는 자기 컬럼이 SET 절에 있을 때만 돌므로
-- 생성 임포트(create → created_via 변경)는 충돌 없이 통과한다.

-- ── 4. 이력(append-only) ───────────────────────────────────────────────
create table if not exists public.problem_difficulty_changes (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id),
  problem_version_id uuid,
  action text not null check (action in ('confirm', 'change')),
  from_difficulty text not null,
  to_difficulty text not null,
  from_status text not null,
  to_status text not null,
  changed_by uuid not null,
  changed_at timestamptz not null default now(),
  reason text,
  batch_id uuid not null
);
create index if not exists problem_difficulty_changes_problem_idx on public.problem_difficulty_changes (problem_id, changed_at desc);
create index if not exists problem_difficulty_changes_hard_idx on public.problem_difficulty_changes (problem_id) where from_difficulty = 'hard' and action = 'change';
alter table public.problem_difficulty_changes enable row level security;
revoke all on public.problem_difficulty_changes from public, anon, authenticated;
grant select, insert on public.problem_difficulty_changes to service_role;

create or replace function public.problem_difficulty_changes_immutable()
returns trigger language plpgsql as $$
begin
  raise exception '난이도 변경 기록은 수정하거나 삭제할 수 없습니다.';
end $$;
drop trigger if exists problem_difficulty_changes_immutable on public.problem_difficulty_changes;
create trigger problem_difficulty_changes_immutable before update or delete on public.problem_difficulty_changes
  for each row execute function public.problem_difficulty_changes_immutable();
drop trigger if exists problem_difficulty_changes_no_truncate on public.problem_difficulty_changes;
create trigger problem_difficulty_changes_no_truncate before truncate on public.problem_difficulty_changes
  for each statement execute function public.problem_difficulty_changes_immutable();

-- ── 5. 세트 영향(파생) — 저장·자동 변경 없음 ────────────────────────────────
-- MST 세트(보관 제외 draft/published)에서 문항의 live 난이도가 그 칸 규칙에 어긋나는지.
-- M1(rw_m1/math_m1): easy|medium, M2 higher: medium|hard, M2 lower: easy|medium. 고정형(module_key null)은 규칙 없음.
create or replace function public.problem_difficulty_set_impact(p_problem_ids uuid[])
returns table(problem_id uuid, exam_set_id uuid, set_name text, set_status text, module_key text, route text,
              snapshot_difficulty text, live_difficulty text, violates boolean, started_attempts bigint)
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
         (select count(*) from mock_exam_attempts a where a.exam_set_id = s.id)
  from mock_exam_set_items i
  join mock_exam_sets s on s.id = i.exam_set_id and s.archived_at is null and s.status in ('draft', 'published')
  join live l on l.id = i.problem_id
  where i.problem_id = any(p_problem_ids)
$$;
revoke all on function public.problem_difficulty_set_impact(uuid[]) from public, anon, authenticated;
grant execute on function public.problem_difficulty_set_impact(uuid[]) to service_role;

-- ── 6. 변경·확인 RPC ────────────────────────────────────────────────────
-- p_to = 'hard'|'medium'|'easy'. 현재 난이도와 같으면 '확인'(잠정 → 확인됨), 다르면 '변경'.
-- 멱등: 이미 확인된 문항을 같은 난이도로 다시 확인하면 건너뛴다(이력 없음). 한 호출 = 한 트랜잭션, 잠금 순서 고정.
create or replace function public.review_problem_difficulty(
  p_problem_ids uuid[], p_to text, p_actor_id uuid, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_batch uuid := gen_random_uuid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  r record;
  v_cur text;
  v_confirmed int := 0; v_changed int := 0; v_skipped int := 0;
  v_ids uuid[];
  v_replace uuid[];
begin
  if p_actor_id is null or not exists (select 1 from profiles where id = p_actor_id and role = 'admin') then
    raise exception '관리자만 문항 난이도를 바꿀 수 있습니다.';
  end if;
  if p_to is null or p_to not in ('easy', 'medium', 'hard') then
    raise exception '난이도는 쉬움·보통·어려움 중에서 골라야 합니다.';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_problem_ids, '{}')) x;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return jsonb_build_object('confirmed', 0, 'changed', 0, 'skipped', 0, 'needsSetReplacement', '[]'::jsonb);
  end if;
  if array_length(v_ids, 1) > 500 then
    raise exception '한 번에 500개까지만 처리할 수 있습니다.';
  end if;
  perform set_config('alton.difficulty_rpc', 'on', true);

  for r in
    select p.id, p.difficulty_status, p.archived_at, p.published_version_id, p.difficulty::text as pdiff, v.difficulty as vdiff, v.status as vstatus
    from problems p left join problem_versions v on v.id = p.published_version_id
    where p.id = any(v_ids)
    order by p.id
    for update of p
  loop
    if r.archived_at is not null or r.published_version_id is null or r.vstatus is distinct from 'published' then
      raise exception '공개된 문항만 난이도를 점검할 수 있습니다. (%)', r.id;
    end if;
    v_cur := coalesce(r.vdiff, r.pdiff);
    if v_cur is null then
      raise exception '현재 난이도가 없는 문항입니다. (%)', r.id;
    end if;

    if v_cur = p_to then
      -- 확인(hard 유지 등). 이미 확인된 상태면 건너뛴다.
      if r.difficulty_status = 'confirmed' and exists (
           select 1 from problem_difficulty_changes c where c.problem_id = r.id and c.to_status = 'confirmed' limit 1) then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      update problems set difficulty_status = 'confirmed', difficulty_confirmed_at = now(), difficulty_confirmed_by = p_actor_id,
             difficulty = p_to::problem_difficulty
       where id = r.id;
      update problem_versions set difficulty = p_to where id = r.published_version_id and difficulty is distinct from p_to;
      insert into problem_difficulty_changes (problem_id, problem_version_id, action, from_difficulty, to_difficulty, from_status, to_status, changed_by, reason, batch_id)
      values (r.id, r.published_version_id, 'confirm', v_cur, p_to, r.difficulty_status, 'confirmed', p_actor_id, v_reason, v_batch);
      v_confirmed := v_confirmed + 1;
    else
      if v_reason is null then
        raise exception '난이도를 바꿀 때는 사유 메모가 필요합니다.';
      end if;
      update problems set difficulty = p_to::problem_difficulty, difficulty_status = 'confirmed',
             difficulty_confirmed_at = now(), difficulty_confirmed_by = p_actor_id
       where id = r.id;
      -- 공개·검토 중·초안 버전을 함께 맞춘다(보관 버전은 이력). 다음 공개가 옛 난이도로 되돌리지 않게 한다.
      update problem_versions set difficulty = p_to
       where problem_id = r.id and status in ('published', 'in_review', 'draft') and difficulty is distinct from p_to;
      insert into problem_difficulty_changes (problem_id, problem_version_id, action, from_difficulty, to_difficulty, from_status, to_status, changed_by, reason, batch_id)
      values (r.id, r.published_version_id, 'change', v_cur, p_to, r.difficulty_status, 'confirmed', p_actor_id, v_reason, v_batch);
      v_changed := v_changed + 1;
    end if;
  end loop;

  select coalesce(array_agg(distinct i.problem_id), '{}') into v_replace
  from problem_difficulty_set_impact(v_ids) i where i.violates;

  return jsonb_build_object('confirmed', v_confirmed, 'changed', v_changed, 'skipped', v_skipped,
                            'needsSetReplacement', to_jsonb(v_replace), 'batchId', v_batch);
end $$;
revoke all on function public.review_problem_difficulty(uuid[], text, uuid, text) from public, anon, authenticated;
grant execute on function public.review_problem_difficulty(uuid[], text, uuid, text) to service_role;

-- ── 7. 목록(요약 + 페이지 1회) ───────────────────────────────────────────
-- 점검 대상 = 공개된 문항 중 잠정이거나, 관리자가 확인·변경한 적이 있는 문항(기존 비AI 확정 문항 제외).
-- 상태: provisional(잠정) / confirmed(현재 hard + 확인됨) / changed(hard 에서 바뀜 + 현재 non-hard).
create or replace function public.problem_difficulty_review_list(
  p_status text default 'all', p_domain text default null, p_skill text default null, p_q text default null,
  p_limit int default 20, p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_summary jsonb; v_total bigint; v_rows jsonb;
begin
  if p_status is not null and p_status not in ('all', 'provisional', 'confirmed', 'changed') then
    raise exception '알 수 없는 상태 필터입니다.';
  end if;
  return (
  with scope as (
    select p.id, p.sat_domain, p.skill_code, p.format, p.created_via, p.difficulty_status, p.difficulty_confirmed_at,
           v.id as vid, v.difficulty as diff, v.published_at, v.passage, v.question,
           (exists (select 1 from problem_difficulty_changes c where c.problem_id = p.id and c.from_difficulty = 'hard' and c.action = 'change')) as was_hard_changed
    from problems p
    join problem_versions v on v.id = p.published_version_id and v.status = 'published'
    where p.archived_at is null and p.status = 'confirmed'
      and (p.difficulty_status = 'provisional' or p.difficulty_confirmed_at is not null)
  ), classified as (
    select s.*,
           case when s.difficulty_status = 'provisional' then 'provisional'
                when s.diff = 'hard' then 'confirmed'
                when s.was_hard_changed then 'changed'
                else null end as state
    from scope s
  ), filtered as (
    select c.* from classified c
    where c.state is not null
      and (coalesce(p_status, 'all') = 'all' or c.state = p_status)
      and (p_domain is null or c.sat_domain = p_domain)
      and (p_skill is null or c.skill_code = p_skill)
      and (v_q is null or c.passage ilike '%' || v_q || '%' or c.question ilike '%' || v_q || '%' or c.id::text like v_q || '%')
  ), page as (
    select f.* from filtered f order by (f.state = 'provisional') desc, f.published_at desc nulls last, f.id limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'summary', (select jsonb_build_object(
        'provisional', count(*) filter (where state = 'provisional'),
        'confirmed', count(*) filter (where state = 'confirmed'),
        'changed', count(*) filter (where state = 'changed')) from classified where state is not null),
    'total', (select count(*) from filtered),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'problemId', g.id, 'versionId', g.vid, 'satDomain', g.sat_domain, 'skillCode', g.skill_code, 'format', g.format,
        'createdVia', g.created_via, 'difficulty', g.diff, 'state', g.state, 'publishedAt', g.published_at,
        'confirmedAt', g.difficulty_confirmed_at,
        'snippet', left(regexp_replace(coalesce(nullif(g.question, ''), g.passage, ''), '\s+', ' ', 'g'), 160),
        'responses', coalesce(st.responses, 0), 'correctPct', st.correct_pct,
        'setsNeedReplacement', (select count(distinct i.exam_set_id) from problem_difficulty_set_impact(array[g.id]) i where i.violates)
      ) order by (g.state = 'provisional') desc, g.published_at desc nulls last, g.id)
      from page g
      left join lateral (
        select count(*) filter (where w.submitted_at is not null) as responses,
               case when count(*) filter (where w.submitted_at is not null and w.auto_correct is not null) > 0
                    then round(100.0 * count(*) filter (where w.auto_correct is true) / count(*) filter (where w.submitted_at is not null and w.auto_correct is not null))
                    else null end as correct_pct
        from session_problem_work w where w.problem_id = g.id and w.problem_version_id = g.vid
      ) st on true), '[]'::jsonb)
  ));
end $$;
revoke all on function public.problem_difficulty_review_list(text, text, text, text, int, int) from public, anon, authenticated;
grant execute on function public.problem_difficulty_review_list(text, text, text, text, int, int) to service_role;

-- ── 8. 상세 ─────────────────────────────────────────────────────────────
create or replace function public.problem_difficulty_review_detail(p_problem_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb;
begin
  select jsonb_build_object(
    'problemId', p.id, 'versionId', v.id, 'format', p.format, 'satDomain', p.sat_domain, 'skillCode', p.skill_code,
    'createdVia', p.created_via, 'difficulty', v.difficulty, 'difficultyStatus', p.difficulty_status,
    'passage', v.passage, 'question', v.question, 'options', v.options, 'correctIndex', v.correct_index,
    'answers', v.answers, 'explanation', v.explanation, 'hasFigure', v.figure is not null,
    'judge', jsonb_build_object(
      'hardJudge', v.quality->'hardJudge', 'advisory', v.quality->'advisory',
      'recipeId', v.quality#>'{mockExamGeneration,recipeId}', 'recipeCheck', v.quality#>'{mockExamGeneration,recipeCheck}',
      'hardBasis', v.quality#>'{mockExamGeneration,hardBasis}', 'generationStatus', v.quality#>'{mockExamGeneration,difficultyStatus}',
      'generatedBy', v.quality->'generatedBy', 'estimatedDifficulty', v.quality->'estimatedDifficulty',
      'difficultyReasons', v.quality->'difficultyReasons'),
    'stats', (select jsonb_build_object(
        'responses', count(*) filter (where w.submitted_at is not null),
        'correct', count(*) filter (where w.auto_correct is true),
        'correctPct', case when count(*) filter (where w.submitted_at is not null and w.auto_correct is not null) > 0
             then round(100.0 * count(*) filter (where w.auto_correct is true) / count(*) filter (where w.submitted_at is not null and w.auto_correct is not null)) end)
      from session_problem_work w where w.problem_id = p.id and w.problem_version_id = v.id),
    'history', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'action', c.action, 'from', c.from_difficulty, 'to', c.to_difficulty, 'fromStatus', c.from_status, 'toStatus', c.to_status,
        'at', c.changed_at, 'by', pr.name, 'reason', c.reason) order by c.changed_at desc)
      from (select * from problem_difficulty_changes where problem_id = p.id order by changed_at desc limit 50) c
      left join profiles pr on pr.id = c.changed_by), '[]'::jsonb),
    'sets', coalesce((select jsonb_agg(jsonb_build_object(
        'setId', i.exam_set_id, 'name', i.set_name, 'status', i.set_status, 'moduleKey', i.module_key, 'route', i.route,
        'snapshotDifficulty', i.snapshot_difficulty, 'liveDifficulty', i.live_difficulty, 'violates', i.violates, 'startedAttempts', i.started_attempts)
        order by i.violates desc, i.set_name)
      from problem_difficulty_set_impact(array[p.id]) i), '[]'::jsonb)
  ) into v_out
  from problems p
  join problem_versions v on v.id = p.published_version_id
  where p.id = p_problem_id;
  return v_out;
end $$;
revoke all on function public.problem_difficulty_review_detail(uuid) from public, anon, authenticated;
grant execute on function public.problem_difficulty_review_detail(uuid) to service_role;
