-- P2 6차 — 준비안이 "어떤 버전을 쓸 것인지"까지 저장한다.
--
-- 2026-09-13 지시: "최초 상속 시 실제 교재·문제와 사용할 버전 선택·저장", "수업 시작
-- 시 최신 버전으로 조용히 바꾸지 마세요."
--
-- 지금까지 준비안은 **무엇을** 쓸지만 저장했다(problem_id, curriculum_doc_id).
-- 어떤 버전인지는 수업 시작(pin_session_selection)에서야 정해졌고, 그때의 최신
-- 공개본을 집었다. 그래서 준비한 시점과 시작한 시점 사이에 새 버전이 공개되면
-- **선생님이 보고 준비한 것과 다른 내용이 고정**됐다.
--
-- 준비안이 버전을 들고 있게 한다. 고르는 순간의 공개본을 적어 두고, 수업 시작은
-- 그것을 그대로 쓴다(시작 시 고정은 여전히 별개의 일이다 — 여기서 하는 것은
-- "무엇을 고정할지"를 미리 정해 두는 것뿐이다).
--
-- 교재와 문제의 버전 표현이 다르다. 이 스키마에서 교재는 버전 행을 쓰지 않고
-- `curriculum_docs.updated_at` 을 버전으로 삼는다(session_content_manifest 의
-- published_doc_version_at_pin 과 같은 방식). 문제는 problem_versions 행이 있고
-- problems.published_version_id 가 현재 공개본을 가리킨다. 각자의 방식을 따른다.

-- =========================================================================
-- 1. 문제 — 고르는 순간의 공개 버전
-- =========================================================================
alter table subject_template_unit_problems
  add column problem_version_id uuid references problem_versions (id);
alter table teacher_curriculum_template_unit_problems
  add column problem_version_id uuid references problem_versions (id);
alter table curriculum_unit_prep_items
  add column problem_version_id uuid references problem_versions (id);

comment on column subject_template_unit_problems.problem_version_id is
  'P2 6차: 이 문제를 구성에 담던 시점의 공개 버전. 이후 새 버전이 공개돼도 이 준비안은 '
  '이 버전을 쓴다 — 수업 시작이 최신본으로 조용히 바꾸지 않는다.';
comment on column teacher_curriculum_template_unit_problems.problem_version_id is
  'P2 6차: 담던 시점의 공개 버전. 상속·조정 과정에서 그대로 이어진다.';
comment on column curriculum_unit_prep_items.problem_version_id is
  'P2 6차: 담던 시점의 공개 버전. 수업 시작 시 이 버전이 그대로 고정된다.';

-- 어느 경로로 들어와도 채워지도록 테이블에 건다. 이미 값이 주어졌으면
-- 존중한다 — 상속이 상위의 버전을 그대로 물려줄 때 덮어쓰면 안 된다.
create or replace function public.fill_unit_problem_version()
returns trigger
language plpgsql as $$
begin
  if new.problem_version_id is null then
    select p.published_version_id into new.problem_version_id
    from problems p where p.id = new.problem_id;
  end if;
  return new;
end;
$$;

create trigger subject_template_unit_problems_fill_version
  before insert on subject_template_unit_problems
  for each row execute function public.fill_unit_problem_version();

create trigger teacher_curriculum_template_unit_problems_fill_version
  before insert on teacher_curriculum_template_unit_problems
  for each row execute function public.fill_unit_problem_version();

create or replace function public.fill_prep_item_problem_version()
returns trigger
language plpgsql as $$
begin
  if new.content_type = 'problem' and new.problem_version_id is null then
    select p.published_version_id into new.problem_version_id
    from problems p where p.id = new.content_id;
  end if;
  return new;
end;
$$;

create trigger curriculum_unit_prep_items_fill_version
  before insert on curriculum_unit_prep_items
  for each row execute function public.fill_prep_item_problem_version();

-- =========================================================================
-- 2. 교재 — 고르는 순간의 내용 시각
-- =========================================================================
alter table subject_template_unit_materials add column doc_version_at_pick timestamptz;
alter table teacher_curriculum_template_unit_materials add column doc_version_at_pick timestamptz;
alter table curriculum_overlay_unit_materials add column doc_version_at_pick timestamptz;

comment on column subject_template_unit_materials.doc_version_at_pick is
  'P2 6차: 이 교재를 구성에 담던 시점의 curriculum_docs.updated_at. 이 스키마에서 '
  '교재의 버전은 버전 행이 아니라 이 시각이다(session_content_manifest 와 같은 방식).';

create or replace function public.fill_unit_material_version()
returns trigger
language plpgsql as $$
begin
  if new.doc_version_at_pick is null then
    select d.updated_at into new.doc_version_at_pick
    from curriculum_docs d where d.id = new.curriculum_doc_id;
  end if;
  return new;
end;
$$;

create trigger subject_template_unit_materials_fill_version
  before insert on subject_template_unit_materials
  for each row execute function public.fill_unit_material_version();

create trigger teacher_curriculum_template_unit_materials_fill_version
  before insert on teacher_curriculum_template_unit_materials
  for each row execute function public.fill_unit_material_version();

create trigger curriculum_overlay_unit_materials_fill_version
  before insert on curriculum_overlay_unit_materials
  for each row execute function public.fill_unit_material_version();

-- =========================================================================
-- 3. 기존 행은 채우지 않는다
-- =========================================================================
-- 이미 담겨 있던 행에는 버전이 없다. 지금의 최신본을 소급해 적어 넣으면 "그때
-- 고른 버전"이라는 거짓말을 남기게 된다 — 실제로는 어떤 버전을 보고 담았는지
-- 알 수 없다.
--
-- null 은 "기록되지 않음"으로 읽는다. 수업 시작 경로는 지금처럼 시작 시점의
-- 공개본을 쓰고(종전 동작), 화면은 버전이 기록되지 않았다는 것을 드러낸다.
-- 영향 범위: 이 마이그레이션 이전에 담긴 모든 구성 행.

-- =========================================================================
-- 4. 상속은 상위가 쓰던 버전을 그대로 물려준다
-- =========================================================================
-- 20261322000000 의 생성 트리거는 problem_id·curriculum_doc_id 만 복사한다. 그러면
-- 위 fill 트리거가 **지금의 공개본**을 새로 집으므로, 상위가 옛 버전을 쓰고 있어도
-- 하위는 다른 내용으로 시작한다. "실제 선택 결과·버전을 함께 이어받는다"에 어긋난다.
--
-- 복사할 때 버전을 함께 넘긴다. fill 트리거는 값이 주어지면 존중하므로 덮어쓰지
-- 않는다.
create or replace function teacher_template_units_inherit_defaults()
returns trigger language plpgsql as $$
declare
  v_goal text;
begin
  if new.source_unit_id is null then
    return null;
  end if;

  -- 문제·제외를 **키워드보다 먼저** 넣는다. 키워드 삽입이 자동 구성 트리거를 깨우는데,
  -- 그때 담기는 것은 지금의 공개본이라 상위가 쓰던 버전이 덮인다(정확히는 뒤이은
  -- 복사가 on conflict 로 건너뛴다). 물려받을 것을 먼저 자리잡게 한다.
  -- 자동분까지 **그대로** 물려준다. 조건만 내려보내고 다시 뽑으면 상위와 다른 구성이
  -- 되고, 상위에서 사람이 맞춘 순서와 출처 구분이 사라진다.
  insert into teacher_curriculum_template_unit_problems
    (unit_id, problem_id, position, source, created_by, problem_version_id)
  select new.id, sp.problem_id, sp.position, sp.source, auth.uid(), sp.problem_version_id
  from subject_template_unit_problems sp
  where sp.unit_id = new.source_unit_id
  on conflict do nothing;

  -- 상위에서 뺀 것은 하위에서도 빠진 채로 시작한다. 제외 기록을 남기지 않으면
  -- 하위의 다음 구성에서 되살아난다.
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
    (unit_id, curriculum_doc_id, position, source, created_by, doc_version_at_pick)
  select new.id, tum.curriculum_doc_id,
         row_number() over (order by tum.position, tum.curriculum_doc_id),
         'manual', auth.uid(), tum.doc_version_at_pick
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

  return null;
end;
$$;
