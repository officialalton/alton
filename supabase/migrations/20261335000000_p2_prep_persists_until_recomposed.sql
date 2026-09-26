-- P2 9차 — 준비안은 '다시 구성'을 누르기 전까지 그대로 있는다.
--
-- 2026-09-13 제품 오너 확정(A안):
--   "키워드·조건 변경도 자동 재계산하지 않음. 화면에 '구성에 반영되지 않은 변경
--    있음'을 표시하고, '다시 구성'에서 변경분·부족분을 확인한 뒤 적용한다. 취소하면
--    기존 구성을 유지한다. 단, 신규 생성·최초 상속은 자동."
--
-- 지금까지는 키워드를 하나 붙이거나 교재를 하나 공개하기만 해도 트리거가 곧바로
-- 구성을 다시 맞췄다. 선생님이 맞춰 둔 구성이 본인도 모르는 사이에 달라졌고,
-- "내가 준비한 것"과 "화면에 있는 것"이 어긋났다.
--
-- 바꾸는 것은 **언제 다시 맞추는가** 하나다. 무엇을 어떻게 맞추는지(수동 선택·제외·
-- 순서 보존)는 기존 sync_* 함수를 그대로 쓴다 — 규칙이 두 벌로 갈라지지 않게 한다.

-- =========================================================================
-- 1. 회차가 '구성된 적이 있는가'와 '반영되지 않은 변경이 있는가'
-- =========================================================================
alter table subject_template_units
  add column composed_at timestamptz,
  add column composition_dirty boolean not null default false;
alter table teacher_curriculum_template_units
  add column composed_at timestamptz,
  add column composition_dirty boolean not null default false;
alter table curriculum_overlay_units
  add column composed_at timestamptz,
  add column composition_dirty boolean not null default false;

comment on column subject_template_units.composed_at is
  'P2 9차: 이 회차의 구성이 만들어진 시각. null 이면 아직 한 번도 구성되지 않았다 — '
  '그때는 키워드가 처음 붙는 순간 자동으로 구성한다(신규 생성·최초 상속). 값이 있으면 '
  '이후의 키워드·조건·교재 변경은 자동으로 반영하지 않고 composition_dirty 만 올린다.';

comment on column subject_template_units.composition_dirty is
  'P2 9차: 구성에 반영되지 않은 변경이 있는가. 화면이 "구성에 반영되지 않은 변경 있음"을 '
  '띄우는 근거이고, recompose_unit() 이 내린다.';

-- 이미 구성이 있는 회차는 '구성된 적 있음'으로 본다. 그래야 이 마이그레이션 직후
-- 키워드를 건드렸을 때 기존 구성이 조용히 다시 맞춰지지 않는다.
--
-- 구성이 비어 있는 회차는 null 로 둔다 — 아직 한 번도 구성하지 않은 것과 같으므로,
-- 다음에 키워드가 붙으면 최초 구성이 돈다. **기존 구성 내용은 건드리지 않는다.**
update subject_template_units u set composed_at = now()
where exists (select 1 from subject_template_unit_materials m where m.unit_id = u.id)
   or exists (select 1 from subject_template_unit_problems p where p.unit_id = u.id);

update teacher_curriculum_template_units u set composed_at = now()
where exists (select 1 from teacher_curriculum_template_unit_materials m where m.unit_id = u.id)
   or exists (select 1 from teacher_curriculum_template_unit_problems p where p.unit_id = u.id);

update curriculum_overlay_units u set composed_at = now()
where exists (select 1 from curriculum_overlay_unit_materials m where m.overlay_unit_id = u.id);

-- =========================================================================
-- 2. 자동 재계산을 끊는다 — 최초 구성만 남긴다
-- =========================================================================
-- 키워드 테이블마다 교재용·문제용 트리거가 따로 달려 있었다. 하나로 합친다 —
-- 두 번 도는 이유가 없고, 최초 구성 여부 판단도 한 곳에 있어야 한다.
drop trigger if exists subject_template_unit_keywords_sync on subject_template_unit_keywords;
drop trigger if exists subject_template_unit_keywords_sync_problems on subject_template_unit_keywords;
drop trigger if exists subject_template_unit_problem_criteria_sync on subject_template_unit_problem_criteria;
drop trigger if exists teacher_curriculum_template_unit_keywords_sync on teacher_curriculum_template_unit_keywords;
drop trigger if exists teacher_curriculum_template_unit_keywords_sync_problems on teacher_curriculum_template_unit_keywords;
drop trigger if exists teacher_curriculum_template_unit_problem_criteria_sync on teacher_curriculum_template_unit_problem_criteria;
drop trigger if exists curriculum_overlay_unit_keywords_sync on curriculum_overlay_unit_keywords;

-- 층별로 "한 번도 구성되지 않았으면 지금 구성하고, 아니면 표시만 한다".
create or replace function public.catalog_unit_inputs_changed()
returns trigger language plpgsql as $$
declare
  v_unit uuid := coalesce(new.unit_id, old.unit_id);
  v_composed timestamptz;
begin
  select composed_at into v_composed from subject_template_units where id = v_unit;
  if not found then
    return null;
  end if;

  if v_composed is null then
    perform sync_catalog_unit_auto_materials(v_unit);
    perform sync_catalog_unit_auto_problems(v_unit);
    update subject_template_units
      set composed_at = now(), composition_dirty = false where id = v_unit;
  else
    update subject_template_units set composition_dirty = true where id = v_unit;
  end if;
  return null;
end;
$$;

create trigger subject_template_unit_keywords_compose
  after insert or delete on subject_template_unit_keywords
  for each row execute function public.catalog_unit_inputs_changed();
create trigger subject_template_unit_criteria_compose
  after insert or update on subject_template_unit_problem_criteria
  for each row execute function public.catalog_unit_inputs_changed();

create or replace function public.teacher_unit_inputs_changed()
returns trigger language plpgsql as $$
declare
  v_unit uuid := coalesce(new.unit_id, old.unit_id);
  v_composed timestamptz;
begin
  select composed_at into v_composed from teacher_curriculum_template_units where id = v_unit;
  if not found then
    return null;
  end if;

  if v_composed is null then
    perform sync_teacher_unit_auto_materials(v_unit);
    perform sync_teacher_unit_auto_problems(v_unit);
    update teacher_curriculum_template_units
      set composed_at = now(), composition_dirty = false where id = v_unit;
  else
    update teacher_curriculum_template_units set composition_dirty = true where id = v_unit;
  end if;
  return null;
end;
$$;

create trigger teacher_curriculum_template_unit_keywords_compose
  after insert or delete on teacher_curriculum_template_unit_keywords
  for each row execute function public.teacher_unit_inputs_changed();
create trigger teacher_curriculum_template_unit_criteria_compose
  after insert or update on teacher_curriculum_template_unit_problem_criteria
  for each row execute function public.teacher_unit_inputs_changed();

create or replace function public.overlay_unit_inputs_changed()
returns trigger language plpgsql as $$
declare
  v_unit uuid := coalesce(new.overlay_unit_id, old.overlay_unit_id);
  v_composed timestamptz;
begin
  select composed_at into v_composed from curriculum_overlay_units where id = v_unit;
  if not found then
    return null;
  end if;

  if v_composed is null then
    perform sync_unit_auto_materials(v_unit);
    update curriculum_overlay_units
      set composed_at = now(), composition_dirty = false where id = v_unit;
  else
    update curriculum_overlay_units set composition_dirty = true where id = v_unit;
  end if;
  return null;
end;
$$;

create trigger curriculum_overlay_unit_keywords_compose
  after insert or delete on curriculum_overlay_unit_keywords
  for each row execute function public.overlay_unit_inputs_changed();

-- =========================================================================
-- 3. 교재가 공개·회수돼도 구성을 조용히 바꾸지 않는다
-- =========================================================================
-- 20261310000000 은 교재의 상태·대표 키워드가 바뀌면 그 키워드를 쓰는 회차를 전부
-- 다시 맞췄다. 새 교재가 공개되는 것만으로 선생님의 준비안이 달라졌다는 뜻이다.
-- 표시만 한다 — 무엇이 늘고 줄었는지는 '다시 구성'에서 보여준다.
create or replace function public.curriculum_docs_resync_unit_materials()
returns trigger language plpgsql as $$
begin
  update curriculum_overlay_units set composition_dirty = true
  where composed_at is not null
    and id in (
      select uk.overlay_unit_id from curriculum_overlay_unit_keywords uk
      where uk.keyword_id is not distinct from old.primary_keyword_id
         or uk.keyword_id is not distinct from new.primary_keyword_id
    );

  update teacher_curriculum_template_units set composition_dirty = true
  where composed_at is not null
    and id in (
      select uk.unit_id from teacher_curriculum_template_unit_keywords uk
      where uk.keyword_id is not distinct from old.primary_keyword_id
         or uk.keyword_id is not distinct from new.primary_keyword_id
    );

  update subject_template_units set composition_dirty = true
  where composed_at is not null
    and id in (
      select uk.unit_id from subject_template_unit_keywords uk
      where uk.keyword_id is not distinct from old.primary_keyword_id
         or uk.keyword_id is not distinct from new.primary_keyword_id
    );
  return null;
end;
$$;

comment on function public.curriculum_docs_resync_unit_materials() is
  'P2 9차: 교재의 공개 상태·대표 키워드가 바뀌면 그 키워드를 쓰는 회차에 "반영되지 않은 '
  '변경 있음"만 표시한다. **구성을 자동으로 바꾸지 않는다** — 바꾸는 것은 사람이 '
  '다시 구성을 눌렀을 때다.';

create or replace function public.curriculum_docs_resync_on_insert()
returns trigger language plpgsql as $$
begin
  if new.primary_keyword_id is null or new.status <> 'published' then
    return null;
  end if;

  update curriculum_overlay_units set composition_dirty = true
  where composed_at is not null
    and id in (select overlay_unit_id from curriculum_overlay_unit_keywords
               where keyword_id = new.primary_keyword_id);
  update teacher_curriculum_template_units set composition_dirty = true
  where composed_at is not null
    and id in (select unit_id from teacher_curriculum_template_unit_keywords
               where keyword_id = new.primary_keyword_id);
  update subject_template_units set composition_dirty = true
  where composed_at is not null
    and id in (select unit_id from subject_template_unit_keywords
               where keyword_id = new.primary_keyword_id);
  return null;
end;
$$;

-- =========================================================================
-- 4. 최초 상속은 자동으로 끝난다
-- =========================================================================
-- 상속은 키워드·교재·문제를 한 번에 복사한다. 그 과정에서 위 트리거가 최초 구성을
-- 돌리고 composed_at 을 세우지만, 뒤이어 들어오는 조건(criteria) 삽입이 그 회차를
-- 곧바로 '변경 있음'으로 만든다. 상속이 끝난 회차는 깨끗한 상태여야 한다.
create or replace function teacher_template_units_inherit_defaults()
returns trigger language plpgsql as $$
declare
  v_goal text;
begin
  if new.source_unit_id is null then
    return null;
  end if;

  insert into teacher_curriculum_template_unit_problems
    (unit_id, problem_id, position, source, created_by, problem_version_id)
  select new.id, sp.problem_id, sp.position, sp.source, auth.uid(), sp.problem_version_id
  from subject_template_unit_problems sp
  where sp.unit_id = new.source_unit_id
  on conflict do nothing;

  insert into teacher_curriculum_template_unit_problem_exclusions
    (unit_id, problem_id, created_by)
  select new.id, x.problem_id, auth.uid()
  from subject_template_unit_problem_exclusions x
  where x.unit_id = new.source_unit_id
  on conflict do nothing;

  insert into teacher_curriculum_template_unit_keywords (unit_id, keyword_id, created_by)
  select new.id, tuk.keyword_id, auth.uid()
  from subject_template_unit_keywords tuk
  where tuk.unit_id = new.source_unit_id
  on conflict do nothing;

  insert into teacher_curriculum_template_unit_materials
    (unit_id, curriculum_doc_id, position, source, created_by, doc_version_at_pick, curriculum_doc_version_id)
  select new.id, tum.curriculum_doc_id,
         row_number() over (order by tum.position, tum.curriculum_doc_id),
         'manual', auth.uid(), tum.doc_version_at_pick, tum.curriculum_doc_version_id
  from subject_template_unit_materials tum
  join curriculum_docs d on d.id = tum.curriculum_doc_id
  where tum.unit_id = new.source_unit_id and d.status = 'published'
  on conflict do nothing;

  insert into teacher_curriculum_template_unit_problem_criteria
    (unit_id, formats, difficulties, target_count, updated_by)
  select new.id, c.formats, c.difficulties, c.target_count, auth.uid()
  from subject_template_unit_problem_criteria c
  where c.unit_id = new.source_unit_id
  on conflict (unit_id) do nothing;

  if new.goal is null then
    select u.goal into v_goal from subject_template_units u where u.id = new.source_unit_id;
    if v_goal is not null then
      update teacher_curriculum_template_units set goal = v_goal where id = new.id;
    end if;
  end if;

  -- 상속이 곧 최초 구성이다. 여기서 끝났음을 못 박아, 위 삽입들이 서로를
  -- '변경 있음'으로 표시한 것을 정리한다.
  update teacher_curriculum_template_units
    set composed_at = now(), composition_dirty = false where id = new.id;

  return null;
end;
$$;

create or replace function curriculum_overlay_units_inherit_defaults()
returns trigger language plpgsql as $$
declare
  v_teacher_unit_id uuid;
  v_goal text;
begin
  if new.source_unit_id is null then
    return null;
  end if;

  select tu.id into v_teacher_unit_id
  from student_curriculum_overlays o
  join subject_enrollments se on se.id = o.subject_enrollment_id
  join teacher_assignments ta
    on ta.subject_enrollment_id = o.subject_enrollment_id and ta.status = 'active'
  join teacher_curriculum_templates t
    on t.teacher_id = ta.teacher_id and t.subject_id = se.subject_id
  join teacher_curriculum_template_units tu
    on tu.template_id = t.id and tu.source_unit_id = new.source_unit_id
  where o.id = new.overlay_id
  order by ta.effective_from desc
  limit 1;

  if v_teacher_unit_id is not null then
    insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id, created_by)
    select new.id, tuk.keyword_id, auth.uid()
    from teacher_curriculum_template_unit_keywords tuk
    where tuk.unit_id = v_teacher_unit_id
    on conflict do nothing;

    insert into curriculum_overlay_unit_materials
      (overlay_unit_id, curriculum_doc_id, position, source, created_by,
       doc_version_at_pick, curriculum_doc_version_id)
    select new.id, tum.curriculum_doc_id,
           row_number() over (order by tum.position, tum.curriculum_doc_id),
           'manual', auth.uid(), tum.doc_version_at_pick, tum.curriculum_doc_version_id
    from teacher_curriculum_template_unit_materials tum
    join curriculum_docs d on d.id = tum.curriculum_doc_id
    where tum.unit_id = v_teacher_unit_id
      and tum.source = 'manual'
      and d.status = 'published'
    on conflict do nothing;

    -- 학생 층의 문제 상속(선생님 층이 고른 문제와 그 버전을 준비안으로 내리는 것)은
    -- 이 단계에서 하지 않는다. 준비안 행을 회차 생성 시점에 만들면 지금 준비안을
    -- 직접 만드는 경로들과 충돌한다 — 그 경로를 정리한 뒤 별도로 붙인다.
    select tu.goal into v_goal
    from teacher_curriculum_template_units tu where tu.id = v_teacher_unit_id;
  else
    insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id, created_by)
    select new.id, tuk.keyword_id, auth.uid()
    from subject_template_unit_keywords tuk
    where tuk.unit_id = new.source_unit_id
    on conflict do nothing;

    insert into curriculum_overlay_unit_materials
      (overlay_unit_id, curriculum_doc_id, position, source, created_by,
       doc_version_at_pick, curriculum_doc_version_id)
    select new.id, tum.curriculum_doc_id,
           row_number() over (order by tum.position, tum.curriculum_doc_id),
           'manual', auth.uid(), tum.doc_version_at_pick, tum.curriculum_doc_version_id
    from subject_template_unit_materials tum
    join curriculum_docs d on d.id = tum.curriculum_doc_id
    where tum.unit_id = new.source_unit_id and d.status = 'published'
    on conflict do nothing;

    select u.goal into v_goal
    from subject_template_units u where u.id = new.source_unit_id;
  end if;

  -- 목표가 있으면 이 회차의 준비를 만들어 담는다(20261322000000 과 같다).
  if v_goal is not null then
    insert into curriculum_unit_preps (overlay_unit_id, goal, created_by)
    values (new.id, v_goal, auth.uid())
    on conflict (overlay_unit_id) do nothing;
  end if;

  update curriculum_overlay_units
    set composed_at = now(), composition_dirty = false where id = new.id;

  return null;
end;
$$;

-- =========================================================================
-- 5. 준비안이 쓰는 버전이 낡았는지
-- =========================================================================
-- "공개 문제 v1을 준비안에 담은 뒤 v2를 공개해도 기존 준비안이 v1을 유지한다."
-- 유지하는 것은 위에서 끝났다. 남은 것은 **그 사실을 화면이 알 수 있게** 하는 것이다.
-- 새 버전이 나왔다는 이유로 dirty 를 올리지 않고(공개 트리거를 더 늘리지 않는다),
-- 읽을 때 지금 값과 대조한다.
create or replace view public.unit_composition_drift
with (security_invoker = true) as
select 'catalog'::text as layer, p.unit_id as unit_id, 'problem'::text as kind,
       p.problem_id as content_id, p.problem_version_id as pinned_version_id,
       pr.published_version_id as current_version_id
from subject_template_unit_problems p
join problems pr on pr.id = p.problem_id
where pr.published_version_id is not null
  and p.problem_version_id is distinct from pr.published_version_id
union all
select 'teacher', p.unit_id, 'problem', p.problem_id, p.problem_version_id, pr.published_version_id
from teacher_curriculum_template_unit_problems p
join problems pr on pr.id = p.problem_id
where pr.published_version_id is not null
  and p.problem_version_id is distinct from pr.published_version_id
union all
select 'student', pp.overlay_unit_id, 'problem', i.content_id, i.problem_version_id, pr.published_version_id
from curriculum_unit_prep_items i
join curriculum_unit_preps pp on pp.id = i.prep_id
join problems pr on pr.id = i.content_id
where i.content_type = 'problem'
  and pr.published_version_id is not null
  and i.problem_version_id is distinct from pr.published_version_id
union all
select 'catalog', m.unit_id, 'material', m.curriculum_doc_id, m.curriculum_doc_version_id,
       public.current_curriculum_doc_version_id(m.curriculum_doc_id)
from subject_template_unit_materials m
where public.current_curriculum_doc_version_id(m.curriculum_doc_id) is not null
  and m.curriculum_doc_version_id is distinct from public.current_curriculum_doc_version_id(m.curriculum_doc_id)
union all
select 'teacher', m.unit_id, 'material', m.curriculum_doc_id, m.curriculum_doc_version_id,
       public.current_curriculum_doc_version_id(m.curriculum_doc_id)
from teacher_curriculum_template_unit_materials m
where public.current_curriculum_doc_version_id(m.curriculum_doc_id) is not null
  and m.curriculum_doc_version_id is distinct from public.current_curriculum_doc_version_id(m.curriculum_doc_id)
union all
select 'student', m.overlay_unit_id, 'material', m.curriculum_doc_id, m.curriculum_doc_version_id,
       public.current_curriculum_doc_version_id(m.curriculum_doc_id)
from curriculum_overlay_unit_materials m
where public.current_curriculum_doc_version_id(m.curriculum_doc_id) is not null
  and m.curriculum_doc_version_id is distinct from public.current_curriculum_doc_version_id(m.curriculum_doc_id);

comment on view public.unit_composition_drift is
  'P2 9차: 구성에 담긴 교재·문제가 **담을 때의 버전**과 **지금 공개된 버전**이 다른 것. '
  '준비안은 담을 때의 버전을 그대로 쓴다 — 여기 나온다고 준비안이 바뀐 것이 아니라, '
  '다시 구성하면 바꿀 수 있다는 뜻이다.';

-- =========================================================================
-- 6. 다시 구성 — 사람이 눌렀을 때만
-- =========================================================================
-- 적용은 기존 sync_* 을 그대로 부른다(수동 선택·제외·순서 보존은 거기 있다).
-- 더하는 것은 **버전 갱신**이다: 담긴 것은 그대로 두고 가리키는 버전만 지금
-- 공개본으로 올린다.
create or replace function public.recompose_unit(p_layer text, p_unit_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_added int := 0;
  v_removed int := 0;
  v_available int := 0;
  v_versions int := 0;
  v_m_added int := 0;
  v_m_removed int := 0;
  v_n int;
begin
  if p_layer = 'catalog' then
    select added, removed into v_m_added, v_m_removed
    from sync_catalog_unit_auto_materials(p_unit_id);
    select added, removed, available into v_added, v_removed, v_available
    from sync_catalog_unit_auto_problems(p_unit_id);

    with bumped as (
      update subject_template_unit_problems t
      set problem_version_id = pr.published_version_id
      from problems pr
      where pr.id = t.problem_id and t.unit_id = p_unit_id
        and pr.published_version_id is not null
        and t.problem_version_id is distinct from pr.published_version_id
      returning 1
    ) select count(*) into v_n from bumped;
    v_versions := v_versions + v_n;

    with bumped as (
      update subject_template_unit_materials t
      set curriculum_doc_version_id = public.current_curriculum_doc_version_id(t.curriculum_doc_id),
          doc_version_at_pick = d.updated_at
      from curriculum_docs d
      where d.id = t.curriculum_doc_id and t.unit_id = p_unit_id
        and public.current_curriculum_doc_version_id(t.curriculum_doc_id) is not null
        and t.curriculum_doc_version_id
            is distinct from public.current_curriculum_doc_version_id(t.curriculum_doc_id)
      returning 1
    ) select count(*) into v_n from bumped;
    v_versions := v_versions + v_n;

    update subject_template_units set composed_at = now(), composition_dirty = false
    where id = p_unit_id;

  elsif p_layer = 'teacher' then
    select added, removed into v_m_added, v_m_removed
    from sync_teacher_unit_auto_materials(p_unit_id);
    select added, removed, available into v_added, v_removed, v_available
    from sync_teacher_unit_auto_problems(p_unit_id);

    with bumped as (
      update teacher_curriculum_template_unit_problems t
      set problem_version_id = pr.published_version_id
      from problems pr
      where pr.id = t.problem_id and t.unit_id = p_unit_id
        and pr.published_version_id is not null
        and t.problem_version_id is distinct from pr.published_version_id
      returning 1
    ) select count(*) into v_n from bumped;
    v_versions := v_versions + v_n;

    with bumped as (
      update teacher_curriculum_template_unit_materials t
      set curriculum_doc_version_id = public.current_curriculum_doc_version_id(t.curriculum_doc_id),
          doc_version_at_pick = d.updated_at
      from curriculum_docs d
      where d.id = t.curriculum_doc_id and t.unit_id = p_unit_id
        and public.current_curriculum_doc_version_id(t.curriculum_doc_id) is not null
        and t.curriculum_doc_version_id
            is distinct from public.current_curriculum_doc_version_id(t.curriculum_doc_id)
      returning 1
    ) select count(*) into v_n from bumped;
    v_versions := v_versions + v_n;

    update teacher_curriculum_template_units set composed_at = now(), composition_dirty = false
    where id = p_unit_id;

  elsif p_layer = 'student' then
    select added, removed into v_m_added, v_m_removed
    from sync_unit_auto_materials(p_unit_id);

    with bumped as (
      update curriculum_unit_prep_items t
      set problem_version_id = pr.published_version_id
      from problems pr, curriculum_unit_preps pp
      where pp.id = t.prep_id and pp.overlay_unit_id = p_unit_id
        and t.content_type = 'problem' and pr.id = t.content_id
        and pr.published_version_id is not null
        and t.problem_version_id is distinct from pr.published_version_id
      returning 1
    ) select count(*) into v_n from bumped;
    v_versions := v_versions + v_n;

    with bumped as (
      update curriculum_overlay_unit_materials t
      set curriculum_doc_version_id = public.current_curriculum_doc_version_id(t.curriculum_doc_id),
          doc_version_at_pick = d.updated_at
      from curriculum_docs d
      where d.id = t.curriculum_doc_id and t.overlay_unit_id = p_unit_id
        and public.current_curriculum_doc_version_id(t.curriculum_doc_id) is not null
        and t.curriculum_doc_version_id
            is distinct from public.current_curriculum_doc_version_id(t.curriculum_doc_id)
      returning 1
    ) select count(*) into v_n from bumped;
    v_versions := v_versions + v_n;

    update curriculum_overlay_units set composed_at = now(), composition_dirty = false
    where id = p_unit_id;

  else
    raise exception '알 수 없는 계층입니다: %', p_layer;
  end if;

  return jsonb_build_object(
    'layer', p_layer,
    'materialsAdded', v_m_added,
    'materialsRemoved', v_m_removed,
    'problemsAdded', v_added,
    'problemsRemoved', v_removed,
    'problemsAvailable', v_available,
    'versionsUpdated', v_versions
  );
end;
$$;

comment on function public.recompose_unit(text, uuid) is
  'P2 9차: 회차 구성을 지금의 키워드·조건으로 다시 맞추고, 담긴 것이 가리키는 버전을 '
  '지금 공개본으로 올린다. 수동 선택·제외·순서는 그대로다. **사람이 다시 구성을 눌렀을 '
  '때만 실행된다** — 어떤 트리거도 이 함수를 부르지 않는다. 문제가 모자라도 채우지 않는다.';

-- 미리보기 — 실제로 적용해 보고 되돌린다.
--
-- 규칙을 두 벌로 쓰지 않기 위해서다. "이렇게 될 것"을 따로 계산하면 계산식이
-- 갈라지고, 미리 본 것과 적용한 것이 언젠가 달라진다. 여기서는 recompose_unit 을
-- 그대로 실행한 뒤 예외를 던져 블록 전체를 되돌린다 — PL/pgSQL 의 예외 블록은
-- 암묵 savepoint 라 이 안에서 바뀐 것만 취소되고, 결과를 담은 변수는 남는다.
create or replace function public.preview_unit_recomposition(p_layer text, p_unit_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
begin
  begin
    v_result := public.recompose_unit(p_layer, p_unit_id);
    -- 여기까지의 변경을 되돌린다. 미리보기는 아무것도 바꾸지 않는다.
    raise exception 'PREVIEW_ROLLBACK' using errcode = 'ALT01';
  exception
    when sqlstate 'ALT01' then
      null;
  end;

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object('preview', true);
end;
$$;

comment on function public.preview_unit_recomposition(text, uuid) is
  'P2 9차: 다시 구성하면 무엇이 달라지는지. 실제로 적용해 본 뒤 되돌리므로 미리 본 것과 '
  '적용 결과가 어긋나지 않는다. **아무것도 바꾸지 않는다** — 취소하면 기존 구성이 그대로 '
  '남는다는 뜻이 이것이다.';

grant execute on function public.recompose_unit(text, uuid) to authenticated, service_role;
grant execute on function public.preview_unit_recomposition(text, uuid) to authenticated, service_role;
