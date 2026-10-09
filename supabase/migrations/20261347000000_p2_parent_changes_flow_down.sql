-- P2 12차 — 상위 변경이 아래까지 온전히 내려간다.
--
-- 2026-09-14 다음 작업 단위: "지금 '기본 구성 업데이트'는 **보충과 버전 갱신만**
-- 한다. 미구현: 상위에서 **제외된 항목**을 아래 계층에서도 빼기 / **키워드·목표·
-- 순서** 변경 반영 / 교사가 직접 담은 것·뺀 것과의 **충돌 구분**."
--
-- 20261346000000 이 각 행에 "위에서 내려온 것인가"(inherited)와 "내려올 당시 위층
-- 에서의 순서"(inherited_position), 회차에 "내려올 당시 위층의 목표"(inherited_goal)
-- 를 남겼다. 여기서 그것을 읽어 실제로 처리한다.
--
-- 규칙 — 사람이 한 일은 이긴다.
--   뺀다      inherited = true 인데 상위에 더 이상 없는 행. 직접 담은 행
--             (inherited = false)은 상위가 무엇을 하든 남는다.
--   되살리지 않는다  사람이 뺀 것은 제외 기록으로 남고, 보충이 그것을 건너뛴다.
--   순서      상위의 순서를 따라간다. 단 **사람이 순서를 바꾼 적이 없을 때만**.
--             바꿨으면 그대로 두고 숫자로만 알린다.
--   목표      지금 목표가 내려올 당시 값 그대로면 상위를 따라간다. 사람이 고쳤으면
--             건드리지 않고 숫자로만 알린다.
--
-- 자동으로 돌지 않는다. 확정 정책 1번대로 사람이 '기본 구성 업데이트'를 눌렀을
-- 때만이고, 미리보기가 이 함수를 그대로 실행해 보고 되돌린다.

-- =========================================================================
-- 1. 학생 층에도 '뺀 문제' 기록이 필요하다
-- =========================================================================
-- 지금 학생 층에서 문제를 빼면 아무 기록도 남지 않는다. 위 두 층에는 제외 기록이
-- 있어서 되살아나지 않는데, 학생 층만 다음 업데이트에서 그대로 다시 들어온다.
-- 상위 변경을 내려보내기 시작하면 이 차이가 곧바로 드러난다.
create table curriculum_overlay_unit_problem_exclusions (
  overlay_unit_id uuid not null references curriculum_overlay_units (id) on delete cascade,
  problem_id uuid not null references problems (id) on delete cascade,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  primary key (overlay_unit_id, problem_id)
);

comment on table curriculum_overlay_unit_problem_exclusions is
  'P2 12차: 이 학생 회차에서 뺀 문제. 상속·보충이 다시 넣지 않도록 기억한다. '
  '같은 문제를 직접 다시 담으면 이 기록은 지워진다. 위 두 층의 제외 기록과 같은 역할이다.';

alter table curriculum_overlay_unit_problem_exclusions enable row level security;

create policy "담당 선생님·관리자만 제외 기록" on curriculum_overlay_unit_problem_exclusions for all
  using (
    is_admin()
    or exists (
      select 1 from curriculum_overlay_units u
      join student_curriculum_overlays o on o.id = u.overlay_id
      where u.id = overlay_unit_id and is_active_teacher_for_enrollment(o.subject_enrollment_id)
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from curriculum_overlay_units u
      join student_curriculum_overlays o on o.id = u.overlay_id
      where u.id = overlay_unit_id and is_active_teacher_for_enrollment(o.subject_enrollment_id)
    )
  );

-- 보충이 그 기록을 존중한다. (20261346000000 판본에 제외 조건만 더한다.)
create or replace function public.inherit_unit_defaults_from_template(p_overlay_unit_id uuid)
returns table (keywords_added integer, materials_added integer, problems_added integer)
language plpgsql
as $$
declare
  v_teacher_unit_id uuid;
  v_catalog_unit_id uuid;
  v_prep_id uuid;
  v_kw int := 0;
  v_mat int := 0;
  v_prob int := 0;
  v_next int;
begin
  select p.teacher_unit_id, p.catalog_unit_id
    into v_teacher_unit_id, v_catalog_unit_id
  from public.overlay_unit_parent(p_overlay_unit_id) p;

  if v_teacher_unit_id is null and v_catalog_unit_id is null then
    return query select 0, 0, 0;
    return;
  end if;

  with ins as (
    insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id, inherited)
    select p_overlay_unit_id, k.keyword_id, true
    from (
      select keyword_id from teacher_curriculum_template_unit_keywords
      where unit_id = v_teacher_unit_id
      union
      select keyword_id from subject_template_unit_keywords
      where unit_id = v_catalog_unit_id
    ) k
    on conflict do nothing
    returning 1
  )
  select count(*) into v_kw from ins;

  select coalesce(max(position), 0) into v_next
  from curriculum_overlay_unit_materials where overlay_unit_id = p_overlay_unit_id;

  with src as (
    select m.curriculum_doc_id, m.position, m.source, m.doc_version_at_pick, m.curriculum_doc_version_id
    from teacher_curriculum_template_unit_materials m
    where m.unit_id = v_teacher_unit_id
    union all
    select m.curriculum_doc_id, m.position, m.source, m.doc_version_at_pick, m.curriculum_doc_version_id
    from subject_template_unit_materials m
    where m.unit_id = v_catalog_unit_id
  ), ins as (
    insert into curriculum_overlay_unit_materials
      (overlay_unit_id, curriculum_doc_id, position, source, created_by,
       doc_version_at_pick, curriculum_doc_version_id, inherited, inherited_position)
    select p_overlay_unit_id, s.curriculum_doc_id,
           v_next + row_number() over (order by s.position, s.curriculum_doc_id),
           s.source, auth.uid(), s.doc_version_at_pick, s.curriculum_doc_version_id,
           true, s.position
    from src s
    join curriculum_docs d on d.id = s.curriculum_doc_id
    where d.status = 'published' and d.archived_at is null
      and not exists (
        select 1 from curriculum_overlay_unit_materials e
        where e.overlay_unit_id = p_overlay_unit_id and e.curriculum_doc_id = s.curriculum_doc_id
      )
      and not exists (
        select 1 from curriculum_overlay_unit_material_exclusions x
        where x.overlay_unit_id = p_overlay_unit_id and x.curriculum_doc_id = s.curriculum_doc_id
      )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_mat from ins;

  insert into curriculum_unit_preps (overlay_unit_id, created_by)
  values (p_overlay_unit_id, auth.uid())
  on conflict (overlay_unit_id) do update set overlay_unit_id = excluded.overlay_unit_id
  returning id into v_prep_id;

  select coalesce(max(position), 0) into v_next
  from curriculum_unit_prep_items where prep_id = v_prep_id;

  with src as (
    select p.problem_id, p.position, p.problem_version_id
    from teacher_curriculum_template_unit_problems p
    where p.unit_id = v_teacher_unit_id
    union all
    select p.problem_id, p.position, p.problem_version_id
    from subject_template_unit_problems p
    where p.unit_id = v_catalog_unit_id
  ), ins as (
    insert into curriculum_unit_prep_items
      (prep_id, content_type, content_id, position, problem_version_id,
       inherited, inherited_position)
    select v_prep_id, 'problem', s.problem_id,
           v_next + row_number() over (order by s.position, s.problem_id),
           s.problem_version_id, true, s.position
    from src s
    join problems pr on pr.id = s.problem_id
    where pr.status = 'confirmed' and pr.archived_at is null
      and exists (select 1 from problem_versions v
                  where v.problem_id = pr.id and v.status = 'published')
      and not exists (
        select 1 from curriculum_unit_prep_items e
        where e.prep_id = v_prep_id and e.content_type = 'problem' and e.content_id = s.problem_id
      )
      and not exists (
        select 1 from curriculum_overlay_unit_problem_exclusions x
        where x.overlay_unit_id = p_overlay_unit_id and x.problem_id = s.problem_id
      )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_prob from ins;

  update curriculum_overlay_units
    set composed_at = coalesce(composed_at, now()), composition_dirty = false
  where id = p_overlay_unit_id;

  return query select v_kw, v_mat, v_prob;
end;
$$;

-- =========================================================================
-- 2. 상위에서 빠진 것을 아래에서도 뺀다
-- =========================================================================
-- inherited = true 인 행만 본다. 사람이 직접 담은 행은 상위와 무관하게 남는다.
-- 뺄 때 제외 기록을 남기지 **않는다** — 상위가 다시 담으면 다시 내려와야 한다.
create or replace function public.withdraw_parent_removals(p_layer text, p_unit_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_teacher_unit_id uuid;
  v_catalog_unit_id uuid;
  v_kw int := 0;
  v_mat int := 0;
  v_prob int := 0;
begin
  if p_layer = 'teacher' then
    select source_unit_id into v_catalog_unit_id
    from teacher_curriculum_template_units where id = p_unit_id;
    -- 기준본에서 갈라져 나오지 않은 회차(선생님이 직접 만든 것)는 상위가 없다.
    if v_catalog_unit_id is null then
      return jsonb_build_object('withdrawnKeywords', 0, 'withdrawnMaterials', 0, 'withdrawnProblems', 0);
    end if;

    with gone as (
      delete from teacher_curriculum_template_unit_keywords e
      where e.unit_id = p_unit_id and e.inherited
        and not exists (select 1 from subject_template_unit_keywords s
                        where s.unit_id = v_catalog_unit_id and s.keyword_id = e.keyword_id)
      returning 1
    ) select count(*) into v_kw from gone;

    with gone as (
      delete from teacher_curriculum_template_unit_materials e
      where e.unit_id = p_unit_id and e.inherited
        and not exists (select 1 from subject_template_unit_materials s
                        where s.unit_id = v_catalog_unit_id and s.curriculum_doc_id = e.curriculum_doc_id)
      returning 1
    ) select count(*) into v_mat from gone;

    with gone as (
      delete from teacher_curriculum_template_unit_problems e
      where e.unit_id = p_unit_id and e.inherited
        and not exists (select 1 from subject_template_unit_problems s
                        where s.unit_id = v_catalog_unit_id and s.problem_id = e.problem_id)
      returning 1
    ) select count(*) into v_prob from gone;

  elsif p_layer = 'student' then
    select p.teacher_unit_id, p.catalog_unit_id
      into v_teacher_unit_id, v_catalog_unit_id
    from public.overlay_unit_parent(p_unit_id) p;

    if v_teacher_unit_id is null and v_catalog_unit_id is null then
      return jsonb_build_object('withdrawnKeywords', 0, 'withdrawnMaterials', 0, 'withdrawnProblems', 0);
    end if;

    with gone as (
      delete from curriculum_overlay_unit_keywords e
      where e.overlay_unit_id = p_unit_id and e.inherited
        and not exists (select 1 from teacher_curriculum_template_unit_keywords s
                        where s.unit_id = v_teacher_unit_id and s.keyword_id = e.keyword_id)
        and not exists (select 1 from subject_template_unit_keywords s
                        where s.unit_id = v_catalog_unit_id and s.keyword_id = e.keyword_id)
      returning 1
    ) select count(*) into v_kw from gone;

    with gone as (
      delete from curriculum_overlay_unit_materials e
      where e.overlay_unit_id = p_unit_id and e.inherited
        and not exists (select 1 from teacher_curriculum_template_unit_materials s
                        where s.unit_id = v_teacher_unit_id and s.curriculum_doc_id = e.curriculum_doc_id)
        and not exists (select 1 from subject_template_unit_materials s
                        where s.unit_id = v_catalog_unit_id and s.curriculum_doc_id = e.curriculum_doc_id)
      returning 1
    ) select count(*) into v_mat from gone;

    with gone as (
      delete from curriculum_unit_prep_items e
      using curriculum_unit_preps pp
      where pp.id = e.prep_id and pp.overlay_unit_id = p_unit_id
        and e.content_type = 'problem' and e.inherited
        and not exists (select 1 from teacher_curriculum_template_unit_problems s
                        where s.unit_id = v_teacher_unit_id and s.problem_id = e.content_id)
        and not exists (select 1 from subject_template_unit_problems s
                        where s.unit_id = v_catalog_unit_id and s.problem_id = e.content_id)
      returning 1
    ) select count(*) into v_prob from gone;
  end if;

  return jsonb_build_object(
    'withdrawnKeywords', v_kw,
    'withdrawnMaterials', v_mat,
    'withdrawnProblems', v_prob
  );
end;
$$;

comment on function public.withdraw_parent_removals(text, uuid) is
  'P2 12차: 상위에서 없어진 항목을 이 회차에서도 뺀다. **내려온 행(inherited)만** '
  '본다 — 사람이 직접 담은 것은 상위가 무엇을 하든 남는다. 제외 기록은 남기지 '
  '않는다: 상위가 다시 담으면 다시 내려와야 한다.';

-- =========================================================================
-- 3. 상위의 순서를 따라간다 — 사람이 순서를 바꾼 적이 없을 때만
-- =========================================================================
-- 판정은 두 줄의 비교다. 내려온 행을 (a) 지금 순서대로 (b) 내려올 당시 상위
-- 순서대로 늘어놓아 같으면 아무도 손대지 않은 것이다. 다르면 사람이 바꾼 것이고,
-- 그 손길을 되돌리지 않는다.
--
-- 자리는 내려온 행들이 **이미 차지하고 있는 자리**만 쓴다. 직접 담은 행은 있던
-- 자리에 그대로 남는다 — 상위 순서 때문에 사람이 끼워 넣은 위치가 밀리지 않는다.
create or replace function public.realign_inherited_order(p_layer text, p_unit_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_teacher_unit_id uuid;
  v_catalog_unit_id uuid;
  v_moved int := 0;
  v_kept int := 0;
  v_n int;
  v_k int;
begin
  if p_layer = 'catalog' then
    return jsonb_build_object('reordered', 0, 'orderKeptByChoice', 0);
  end if;

  if p_layer = 'teacher' then
    select source_unit_id into v_catalog_unit_id
    from teacher_curriculum_template_units where id = p_unit_id;
  else
    select p.teacher_unit_id, p.catalog_unit_id
      into v_teacher_unit_id, v_catalog_unit_id
    from public.overlay_unit_parent(p_unit_id) p;
  end if;

  -- 교재
  with mine as (
    select m.curriculum_doc_id as doc_id, m.position, m.inherited_position
    from teacher_curriculum_template_unit_materials m
    where p_layer = 'teacher' and m.unit_id = p_unit_id and m.inherited
    union all
    select m.curriculum_doc_id, m.position, m.inherited_position
    from curriculum_overlay_unit_materials m
    where p_layer = 'student' and m.overlay_unit_id = p_unit_id and m.inherited
  ), parent as (
    select s.curriculum_doc_id as doc_id, s.position
    from subject_template_unit_materials s
    where p_layer = 'teacher' and s.unit_id = v_catalog_unit_id
    union all
    select s.curriculum_doc_id, s.position
    from teacher_curriculum_template_unit_materials s
    where p_layer = 'student' and s.unit_id = v_teacher_unit_id
    union all
    select s.curriculum_doc_id, s.position
    from subject_template_unit_materials s
    where p_layer = 'student' and v_teacher_unit_id is null and s.unit_id = v_catalog_unit_id
  ), touched as (
    -- 사람이 순서를 바꿨는가: 지금 순서와 내려올 당시 순서가 다른가.
    select bool_or(a.doc_id is distinct from b.doc_id) as changed
    from (select doc_id, row_number() over (order by position, doc_id) rn from mine) a
    full join (select doc_id, row_number() over (order by inherited_position nulls last, doc_id) rn from mine) b
      on a.rn = b.rn
  ), slots as (
    select position, row_number() over (order by position) rn from mine
  ), want as (
    select m.doc_id, row_number() over (order by p.position, m.doc_id) rn
    from mine m join parent p on p.doc_id = m.doc_id
  ), plan as (
    select w.doc_id, s.position as new_position
    from want w join slots s on s.rn = w.rn
    where (select coalesce(changed, false) from touched) = false
  ), t as (
    update teacher_curriculum_template_unit_materials m
    set position = pl.new_position, inherited_position = pp.position
    from plan pl
    join parent pp on pp.doc_id = pl.doc_id
    where p_layer = 'teacher' and m.unit_id = p_unit_id and m.curriculum_doc_id = pl.doc_id
      and (m.position is distinct from pl.new_position
           or m.inherited_position is distinct from pp.position)
    returning 1
  ), s2 as (
    update curriculum_overlay_unit_materials m
    set position = pl.new_position, inherited_position = pp.position
    from plan pl
    join parent pp on pp.doc_id = pl.doc_id
    where p_layer = 'student' and m.overlay_unit_id = p_unit_id and m.curriculum_doc_id = pl.doc_id
      and (m.position is distinct from pl.new_position
           or m.inherited_position is distinct from pp.position)
    returning 1
  )
  select (select count(*) from t) + (select count(*) from s2),
         case when (select coalesce(changed, false) from touched) then 1 else 0 end
  into v_n, v_k;
  v_moved := v_moved + v_n;
  v_kept := v_kept + v_k;

  -- 문제
  with mine as (
    select p.problem_id as pid, p.position, p.inherited_position
    from teacher_curriculum_template_unit_problems p
    where p_layer = 'teacher' and p.unit_id = p_unit_id and p.inherited
    union all
    select i.content_id, i.position, i.inherited_position
    from curriculum_unit_prep_items i
    join curriculum_unit_preps pp on pp.id = i.prep_id
    where p_layer = 'student' and pp.overlay_unit_id = p_unit_id
      and i.content_type = 'problem' and i.inherited
  ), parent as (
    select s.problem_id as pid, s.position
    from subject_template_unit_problems s
    where p_layer = 'teacher' and s.unit_id = v_catalog_unit_id
    union all
    select s.problem_id, s.position
    from teacher_curriculum_template_unit_problems s
    where p_layer = 'student' and s.unit_id = v_teacher_unit_id
    union all
    select s.problem_id, s.position
    from subject_template_unit_problems s
    where p_layer = 'student' and v_teacher_unit_id is null and s.unit_id = v_catalog_unit_id
  ), touched as (
    select bool_or(a.pid is distinct from b.pid) as changed
    from (select pid, row_number() over (order by position, pid) rn from mine) a
    full join (select pid, row_number() over (order by inherited_position nulls last, pid) rn from mine) b
      on a.rn = b.rn
  ), slots as (
    select position, row_number() over (order by position) rn from mine
  ), want as (
    select m.pid, row_number() over (order by p.position, m.pid) rn
    from mine m join parent p on p.pid = m.pid
  ), plan as (
    select w.pid, s.position as new_position
    from want w join slots s on s.rn = w.rn
    where (select coalesce(changed, false) from touched) = false
  ), t as (
    update teacher_curriculum_template_unit_problems q
    set position = pl.new_position, inherited_position = pp.position
    from plan pl
    join parent pp on pp.pid = pl.pid
    where p_layer = 'teacher' and q.unit_id = p_unit_id and q.problem_id = pl.pid
      and (q.position is distinct from pl.new_position
           or q.inherited_position is distinct from pp.position)
    returning 1
  ), s2 as (
    update curriculum_unit_prep_items i
    set position = pl.new_position, inherited_position = pp.position
    from plan pl
    join parent pp on pp.pid = pl.pid
    where p_layer = 'student' and i.content_type = 'problem' and i.content_id = pl.pid
      and i.prep_id in (select id from curriculum_unit_preps where overlay_unit_id = p_unit_id)
      and (i.position is distinct from pl.new_position
           or i.inherited_position is distinct from pp.position)
    returning 1
  )
  select (select count(*) from t) + (select count(*) from s2),
         case when (select coalesce(changed, false) from touched) then 1 else 0 end
  into v_n, v_k;
  v_moved := v_moved + v_n;
  v_kept := v_kept + v_k;

  return jsonb_build_object('reordered', v_moved, 'orderKeptByChoice', v_kept);
end;
$$;

comment on function public.realign_inherited_order(text, uuid) is
  'P2 12차: 내려온 항목의 순서를 지금 상위의 순서에 맞춘다. **사람이 순서를 바꾼 적이 '
  '없을 때만** 움직이고, 바꿨으면 그대로 둔다. 직접 담은 항목은 자리를 잃지 않는다 — '
  '내려온 항목들이 이미 차지한 자리 안에서만 재배치한다.';

-- =========================================================================
-- 4. 목표 — 아무도 손대지 않았으면 상위를 따라간다
-- =========================================================================
create or replace function public.adopt_parent_goal(p_layer text, p_unit_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_parent_goal text;
  v_mine text;
  v_baseline text;
  v_teacher_unit_id uuid;
  v_catalog_unit_id uuid;
  v_updated int := 0;
begin
  if p_layer = 'catalog' then
    return jsonb_build_object('goalUpdated', 0, 'goalKeptByChoice', 0);
  end if;

  if p_layer = 'teacher' then
    select u.goal, u.inherited_goal, s.goal
      into v_mine, v_baseline, v_parent_goal
    from teacher_curriculum_template_units u
    left join subject_template_units s on s.id = u.source_unit_id
    where u.id = p_unit_id;
  else
    select p.teacher_unit_id, p.catalog_unit_id
      into v_teacher_unit_id, v_catalog_unit_id
    from public.overlay_unit_parent(p_unit_id) p;

    select coalesce(tu.goal, su.goal) into v_parent_goal
    from (select 1) _
    left join teacher_curriculum_template_units tu on tu.id = v_teacher_unit_id
    left join subject_template_units su on su.id = v_catalog_unit_id;

    select pp.goal, pp.inherited_goal into v_mine, v_baseline
    from curriculum_unit_preps pp where pp.overlay_unit_id = p_unit_id;
  end if;

  -- 상위에 목표가 없으면 내려보낼 것이 없다. 아래 목표를 지우지 않는다.
  if v_parent_goal is null then
    return jsonb_build_object('goalUpdated', 0, 'goalKeptByChoice', 0);
  end if;

  if v_mine is distinct from v_parent_goal
     and v_mine is not distinct from v_baseline then
    if p_layer = 'teacher' then
      update teacher_curriculum_template_units
        set goal = v_parent_goal, inherited_goal = v_parent_goal
      where id = p_unit_id;
    else
      insert into curriculum_unit_preps (overlay_unit_id, goal, inherited_goal, created_by)
      values (p_unit_id, v_parent_goal, v_parent_goal, auth.uid())
      on conflict (overlay_unit_id) do update
        set goal = excluded.goal, inherited_goal = excluded.inherited_goal;
    end if;
    v_updated := 1;
  end if;

  return jsonb_build_object(
    'goalUpdated', v_updated,
    -- 사람이 고쳐 둔 목표가 상위와 다르다 — 그대로 둔다는 사실을 숫자로 알린다.
    'goalKeptByChoice',
      case when v_updated = 0
             and v_mine is distinct from v_parent_goal
             and v_mine is distinct from v_baseline
           then 1 else 0 end
  );
end;
$$;

comment on function public.adopt_parent_goal(text, uuid) is
  'P2 12차: 이 회차의 목표가 내려올 당시 값 그대로면 상위의 지금 목표를 따라간다. '
  '사람이 고쳤으면 건드리지 않는다. 상위에 목표가 없으면 아래 목표를 지우지 않는다.';

grant execute on function public.withdraw_parent_removals(text, uuid) to authenticated, service_role;
grant execute on function public.realign_inherited_order(text, uuid) to authenticated, service_role;
grant execute on function public.adopt_parent_goal(text, uuid) to authenticated, service_role;

-- =========================================================================
-- 5. 하나의 진입점이 다섯 가지를 순서대로 한다
-- =========================================================================
-- 순서가 규칙이다:
--   1) 뺀다      상위에 없어진 것을 먼저 치운다. 안 그러면 아래 단계가 이미 없는
--                항목의 순서를 맞추고 버전을 올린다.
--   2) 받는다    상위에 있는데 없는 것을 가져온다(제외 기록은 존중).
--   3) 순서      상위 순서를 따라간다(사람이 바꾼 적 없을 때만).
--   4) 목표      상위 목표를 따라간다(사람이 고친 적 없을 때만).
--   5) 다시 구성  키워드·조건으로 자동분을 맞추고 담긴 것의 버전을 올린다.
--                키워드 변경이 1·2에서 반영된 뒤라야 자동분이 맞는다.
create or replace function public.update_unit_composition(p_layer text, p_unit_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_withdrawn jsonb;
  v_inherit record;
  v_order jsonb;
  v_goal jsonb;
  v_recompose jsonb;
begin
  v_withdrawn := public.withdraw_parent_removals(p_layer, p_unit_id);

  if p_layer = 'teacher' then
    select * into v_inherit from public.inherit_teacher_unit_defaults_from_template(p_unit_id);
  elsif p_layer = 'student' then
    select * into v_inherit from public.inherit_unit_defaults_from_template(p_unit_id);
  end if;

  v_order := public.realign_inherited_order(p_layer, p_unit_id);
  v_goal := public.adopt_parent_goal(p_layer, p_unit_id);
  v_recompose := public.recompose_unit(p_layer, p_unit_id);

  return v_recompose || v_withdrawn || v_order || v_goal || jsonb_build_object(
    'inheritedKeywords', coalesce(v_inherit.keywords_added, 0),
    'inheritedMaterials', coalesce(v_inherit.materials_added, 0),
    'inheritedProblems', coalesce(v_inherit.problems_added, 0)
  );
end;
$$;

comment on function public.update_unit_composition(text, uuid) is
  'P2 12차: 수업 준비 화면의 **유일한** 구성 업데이트 경로. 상위에서 빠진 것을 빼고, '
  '없는 것을 받고, 순서와 목표를 상위에 맞추고(사람이 손댄 적 없을 때만), 키워드·조건으로 '
  '자동분을 맞추며 담긴 것의 버전을 올린다. 사람이 눌렀을 때만 돈다. 교사가 직접 담은 것· '
  '뺀 것·맞춰 둔 순서는 그대로 남는다.';

-- =========================================================================
-- 6. '업데이트 있음'이 빠질 것과 학생 층도 센다
-- =========================================================================
-- 지금 이 뷰는 교사 층의 **보충분만** 센다. 상위에서 빠진 것, 순서·목표 변경,
-- 학생 층은 전부 세지 않아서 화면에 아무 표시도 나지 않는다.
create or replace view public.unit_parent_pending_updates
with (security_invoker = true) as
-- ---- 교사 층: 기준본에서 아직 받지 않은 것 ----
select 'teacher'::text as layer, tu.id as unit_id, 'keyword'::text as kind,
       k.keyword_id as content_id, 'add'::text as change
from teacher_curriculum_template_units tu
join subject_template_unit_keywords k on k.unit_id = tu.source_unit_id
where not exists (
    select 1 from teacher_curriculum_template_unit_keywords e
    where e.unit_id = tu.id and e.keyword_id = k.keyword_id
  )
union all
select 'teacher', tu.id, 'material', m.curriculum_doc_id, 'add'
from teacher_curriculum_template_units tu
join subject_template_unit_materials m on m.unit_id = tu.source_unit_id
join curriculum_docs d on d.id = m.curriculum_doc_id
where d.status = 'published' and d.archived_at is null
  and not exists (
    select 1 from teacher_curriculum_template_unit_materials e
    where e.unit_id = tu.id and e.curriculum_doc_id = m.curriculum_doc_id
  )
  and not exists (
    select 1 from teacher_curriculum_template_unit_material_exclusions x
    where x.unit_id = tu.id and x.curriculum_doc_id = m.curriculum_doc_id
  )
union all
select 'teacher', tu.id, 'problem', p.problem_id, 'add'
from teacher_curriculum_template_units tu
join subject_template_unit_problems p on p.unit_id = tu.source_unit_id
where not exists (
    select 1 from teacher_curriculum_template_unit_problems e
    where e.unit_id = tu.id and e.problem_id = p.problem_id
  )
  and not exists (
    select 1 from teacher_curriculum_template_unit_problem_exclusions x
    where x.unit_id = tu.id and x.problem_id = p.problem_id
  )
-- ---- 교사 층: 기준본에서 빠져 이 회차에서도 빠질 것 ----
union all
select 'teacher', e.unit_id, 'keyword', e.keyword_id, 'remove'
from teacher_curriculum_template_unit_keywords e
join teacher_curriculum_template_units tu on tu.id = e.unit_id
where e.inherited and tu.source_unit_id is not null
  and not exists (select 1 from subject_template_unit_keywords s
                  where s.unit_id = tu.source_unit_id and s.keyword_id = e.keyword_id)
union all
select 'teacher', e.unit_id, 'material', e.curriculum_doc_id, 'remove'
from teacher_curriculum_template_unit_materials e
join teacher_curriculum_template_units tu on tu.id = e.unit_id
where e.inherited and tu.source_unit_id is not null
  and not exists (select 1 from subject_template_unit_materials s
                  where s.unit_id = tu.source_unit_id and s.curriculum_doc_id = e.curriculum_doc_id)
union all
select 'teacher', e.unit_id, 'problem', e.problem_id, 'remove'
from teacher_curriculum_template_unit_problems e
join teacher_curriculum_template_units tu on tu.id = e.unit_id
where e.inherited and tu.source_unit_id is not null
  and not exists (select 1 from subject_template_unit_problems s
                  where s.unit_id = tu.source_unit_id and s.problem_id = e.problem_id)
-- ---- 학생 층: 상위(교사 회차 우선, 없으면 기준본)에서 아직 받지 않은 것 ----
union all
select 'student', u.id, 'keyword', k.keyword_id, 'add'
from curriculum_overlay_units u
cross join lateral public.overlay_unit_parent(u.id) pr
join lateral (
  select s.keyword_id from teacher_curriculum_template_unit_keywords s where s.unit_id = pr.teacher_unit_id
  union
  select s.keyword_id from subject_template_unit_keywords s where s.unit_id = pr.catalog_unit_id
) k on true
where not exists (
    select 1 from curriculum_overlay_unit_keywords e
    where e.overlay_unit_id = u.id and e.keyword_id = k.keyword_id
  )
union all
select 'student', u.id, 'material', m.curriculum_doc_id, 'add'
from curriculum_overlay_units u
cross join lateral public.overlay_unit_parent(u.id) pr
join lateral (
  select s.curriculum_doc_id from teacher_curriculum_template_unit_materials s where s.unit_id = pr.teacher_unit_id
  union
  select s.curriculum_doc_id from subject_template_unit_materials s where s.unit_id = pr.catalog_unit_id
) m on true
join curriculum_docs d on d.id = m.curriculum_doc_id
where d.status = 'published' and d.archived_at is null
  and not exists (
    select 1 from curriculum_overlay_unit_materials e
    where e.overlay_unit_id = u.id and e.curriculum_doc_id = m.curriculum_doc_id
  )
  and not exists (
    select 1 from curriculum_overlay_unit_material_exclusions x
    where x.overlay_unit_id = u.id and x.curriculum_doc_id = m.curriculum_doc_id
  )
union all
select 'student', u.id, 'problem', p.problem_id, 'add'
from curriculum_overlay_units u
cross join lateral public.overlay_unit_parent(u.id) pr
join lateral (
  select s.problem_id from teacher_curriculum_template_unit_problems s where s.unit_id = pr.teacher_unit_id
  union
  select s.problem_id from subject_template_unit_problems s where s.unit_id = pr.catalog_unit_id
) p on true
where not exists (
    select 1 from curriculum_unit_prep_items e
    join curriculum_unit_preps pp on pp.id = e.prep_id
    where pp.overlay_unit_id = u.id and e.content_type = 'problem' and e.content_id = p.problem_id
  )
  and not exists (
    select 1 from curriculum_overlay_unit_problem_exclusions x
    where x.overlay_unit_id = u.id and x.problem_id = p.problem_id
  )
-- ---- 학생 층: 상위에서 빠져 이 회차에서도 빠질 것 ----
union all
select 'student', e.overlay_unit_id, 'keyword', e.keyword_id, 'remove'
from curriculum_overlay_unit_keywords e
cross join lateral public.overlay_unit_parent(e.overlay_unit_id) pr
where e.inherited and (pr.teacher_unit_id is not null or pr.catalog_unit_id is not null)
  and not exists (select 1 from teacher_curriculum_template_unit_keywords s
                  where s.unit_id = pr.teacher_unit_id and s.keyword_id = e.keyword_id)
  and not exists (select 1 from subject_template_unit_keywords s
                  where s.unit_id = pr.catalog_unit_id and s.keyword_id = e.keyword_id)
union all
select 'student', e.overlay_unit_id, 'material', e.curriculum_doc_id, 'remove'
from curriculum_overlay_unit_materials e
cross join lateral public.overlay_unit_parent(e.overlay_unit_id) pr
where e.inherited and (pr.teacher_unit_id is not null or pr.catalog_unit_id is not null)
  and not exists (select 1 from teacher_curriculum_template_unit_materials s
                  where s.unit_id = pr.teacher_unit_id and s.curriculum_doc_id = e.curriculum_doc_id)
  and not exists (select 1 from subject_template_unit_materials s
                  where s.unit_id = pr.catalog_unit_id and s.curriculum_doc_id = e.curriculum_doc_id)
union all
select 'student', pp.overlay_unit_id, 'problem', e.content_id, 'remove'
from curriculum_unit_prep_items e
join curriculum_unit_preps pp on pp.id = e.prep_id
cross join lateral public.overlay_unit_parent(pp.overlay_unit_id) pr
where e.content_type = 'problem' and e.inherited
  and (pr.teacher_unit_id is not null or pr.catalog_unit_id is not null)
  and not exists (select 1 from teacher_curriculum_template_unit_problems s
                  where s.unit_id = pr.teacher_unit_id and s.problem_id = e.content_id)
  and not exists (select 1 from subject_template_unit_problems s
                  where s.unit_id = pr.catalog_unit_id and s.problem_id = e.content_id);

comment on view public.unit_parent_pending_updates is
  'P2 12차: 상위와 이 회차가 어긋난 항목. change = add 는 상위에 있는데 아직 없는 것, '
  'remove 는 내려온 뒤 상위에서 없어진 것. 사람이 뺀 것(제외 기록)과 직접 담은 것'
  '(inherited = false)은 세지 않는다 — 그것까지 알리면 알림이 영원히 꺼지지 않는다.';
