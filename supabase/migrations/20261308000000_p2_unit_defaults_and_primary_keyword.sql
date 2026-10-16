-- P2/P3 2차 — 교재·키워드·회차 기본 구성.
--
-- 지금까지 회차는 "키워드를 직접 골라야만" 후보가 생겼다. 그래서 새로 만든
-- 회차는 전부 빈 화면이었다(로컬 기준 107개 중 57개가 키워드 0개). 해결은
-- 키워드를 자동으로 채우는 게 아니라, 관리자가 잡아 둔 기본 구성을 회차가
-- **물려받을 수 있게** 하는 것이다. 물려받기는 선생님이 눌러야 일어나고,
-- 이미 고른 것을 덮어쓰지 않는다.
--
-- 3단 구조는 그대로다:
--   관리자 기본(subject_template_unit_*) → 선생님 운영(curriculum_overlay_unit_*)
--   → 학생 개별(curriculum_unit_prep_items)
-- 위 단계가 아래 단계를 자동으로 덮어쓰지 않는다. 아래로 내려오는 것은
-- "아직 없는 것"뿐이다.

-- =========================================================================
-- 1. 교재 1개 : 대표 키워드 1개
-- =========================================================================
-- 지금 키워드는 교재 조각(section)에만 붙는다. 조각마다 키워드가 흩어져 있으면
-- "이 교재는 무엇에 관한 것인가"를 한 줄로 말할 수 없고, 회차 기본 구성을
-- 교재 단위로 잡을 수도 없다. 교재당 대표 키워드를 하나 둔다.
--
-- **기존 교재를 임의로 채우지 않는다.** nullable로 두고 백필하지 않는다 —
-- 대표 키워드는 관리자가 뜻을 담아 고르는 값이지 자동 추정할 값이 아니다.
alter table curriculum_docs
  add column primary_keyword_id uuid references subject_keywords (id) on delete set null;

create index on curriculum_docs (primary_keyword_id);

comment on column curriculum_docs.primary_keyword_id is
  'P2 2차: 이 교재의 대표 키워드(교재당 최대 1개). 조각별 키워드'
  '(curriculum_doc_section_keywords)는 그대로 두고, 교재 단위 기본 구성과 목록 표시에 쓴다. '
  'null은 "아직 정하지 않음"이며 추정으로 채우지 않는다.';

-- 대표 키워드는 그 교재와 같은 과목의 키워드여야 한다. 다른 과목 키워드가
-- 붙으면 회차 기본 구성이 과목 경계를 넘어 새어 나간다.
create or replace function check_doc_primary_keyword_same_subject()
returns trigger language plpgsql as $$
begin
  if new.primary_keyword_id is null then
    return new;
  end if;
  if not exists (
    select 1 from subject_keywords k
    where k.id = new.primary_keyword_id and k.subject_id = new.subject_id
  ) then
    raise exception '대표 키워드는 이 교재와 같은 과목의 키워드여야 합니다.';
  end if;
  return new;
end;
$$;

create trigger curriculum_docs_check_primary_keyword
  before insert or update of primary_keyword_id, subject_id on curriculum_docs
  for each row execute function check_doc_primary_keyword_same_subject();

-- =========================================================================
-- 2. 기본 구성에 순서를 준다
-- =========================================================================
-- 지금 두 표는 (unit, doc) 복합키만 있고 순서가 없다. 선생님이 정렬해도 보관할
-- 자리가 없어 매번 임의 순서로 보인다.
alter table subject_template_unit_materials add column position int;
alter table curriculum_overlay_unit_materials add column position int;

-- 기존 행에는 결정론적인 순서를 준다(교재 제목 순) — 없던 순서를 만드는 것이라
-- 콘텐츠를 바꾸지 않는다.
update subject_template_unit_materials m set position = s.rn
from (
  select mm.unit_id, mm.curriculum_doc_id,
         row_number() over (partition by mm.unit_id order by d.title, d.id) rn
  from subject_template_unit_materials mm join curriculum_docs d on d.id = mm.curriculum_doc_id
) s
where s.unit_id = m.unit_id and s.curriculum_doc_id = m.curriculum_doc_id;

update curriculum_overlay_unit_materials m set position = s.rn
from (
  select mm.overlay_unit_id, mm.curriculum_doc_id,
         row_number() over (partition by mm.overlay_unit_id order by d.title, d.id) rn
  from curriculum_overlay_unit_materials mm join curriculum_docs d on d.id = mm.curriculum_doc_id
) s
where s.overlay_unit_id = m.overlay_unit_id and s.curriculum_doc_id = m.curriculum_doc_id;

-- 기존 쓰기 경로(ensure_active_curriculum_overlay, 보강 단원 조립, 관리자 화면)는
-- position을 모른다. 그것들을 전부 고쳐 쓰게 만드는 대신, 안 주면 맨 뒤에 붙는
-- 것으로 정한다 — "순서를 지정하지 않았다"의 자연스러운 뜻이 그거다.
create or replace function assign_unit_material_position()
returns trigger language plpgsql as $$
begin
  if new.position is not null then
    return new;
  end if;
  if tg_table_name = 'subject_template_unit_materials' then
    select coalesce(max(position), 0) + 1 into new.position
    from subject_template_unit_materials where unit_id = new.unit_id;
  else
    select coalesce(max(position), 0) + 1 into new.position
    from curriculum_overlay_unit_materials where overlay_unit_id = new.overlay_unit_id;
  end if;
  return new;
end;
$$;

create trigger subject_template_unit_materials_assign_position
  before insert on subject_template_unit_materials
  for each row execute function assign_unit_material_position();

create trigger curriculum_overlay_unit_materials_assign_position
  before insert on curriculum_overlay_unit_materials
  for each row execute function assign_unit_material_position();

alter table subject_template_unit_materials alter column position set not null;
alter table curriculum_overlay_unit_materials alter column position set not null;

comment on column subject_template_unit_materials.position is
  'P2 2차: 관리자가 정한 이 회차의 교재 순서. 선생님이 물려받을 때의 초기 순서다.';
comment on column curriculum_overlay_unit_materials.position is
  'P2 2차: 선생님이 이 학생의 회차에서 정한 교재 순서. 관리자 기본이 바뀌어도 덮어쓰지 않는다.';

-- =========================================================================
-- 3. 물려받기 — 아직 없는 것만 내려온다
-- =========================================================================
-- 이 함수는 **선생님이 눌러야** 돈다. 회차 생성 트리거로 걸지 않는다: 회차는
-- 키워드 없는 초안으로 존재할 수 있어야 하고(2026-09-12 확정), 자동으로 채우면
-- "비워 둔 것"과 "아직 안 채운 것"을 구분할 수 없게 된다.
--
-- SECURITY INVOKER — 호출자의 RLS를 그대로 받는다. 담당 선생님·관리자가 아니면
-- overlay 쪽 insert에서 정책이 막는다.
create or replace function inherit_unit_defaults_from_template(p_overlay_unit_id uuid)
returns table (keywords_added int, materials_added int)
language plpgsql
as $$
declare
  v_source_unit_id uuid;
  v_kw int := 0;
  v_mat int := 0;
begin
  select source_unit_id into v_source_unit_id
  from curriculum_overlay_units where id = p_overlay_unit_id;

  -- 과목 템플릿 단원에서 갈라져 나온 회차가 아니면 물려받을 기본이 없다.
  if v_source_unit_id is null then
    return query select 0, 0;
    return;
  end if;

  -- on conflict do nothing — 이미 선생님이 고른 것은 건드리지 않는다.
  -- 선생님이 일부러 뺀 것을 다시 넣게 되지만, 그건 "빼기"를 다시 누르면 되고
  -- 반대(선생님 선택을 덮어쓰기)는 되돌릴 수 없다. 덜 나쁜 쪽을 고른다.
  with ins as (
    insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id)
    select p_overlay_unit_id, k.keyword_id
    from subject_template_unit_keywords k
    where k.unit_id = v_source_unit_id
    on conflict do nothing
    returning 1
  )
  select count(*) into v_kw from ins;

  with ins as (
    insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, position)
    select p_overlay_unit_id, m.curriculum_doc_id,
           coalesce((select max(position) from curriculum_overlay_unit_materials
                     where overlay_unit_id = p_overlay_unit_id), 0)
             + row_number() over (order by m.position)
    from subject_template_unit_materials m
    where m.unit_id = v_source_unit_id
      and not exists (
        select 1 from curriculum_overlay_unit_materials e
        where e.overlay_unit_id = p_overlay_unit_id and e.curriculum_doc_id = m.curriculum_doc_id
      )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_mat from ins;

  return query select v_kw, v_mat;
end;
$$;

comment on function inherit_unit_defaults_from_template(uuid) is
  'P2 2차: 과목 템플릿 단원의 기본 키워드·교재를 이 회차로 물려받는다. 이미 있는 것은 '
  '건드리지 않고 없는 것만 넣으며, 아무것도 지우지 않는다. 자동 실행되지 않는다 — '
  '선생님이 준비 화면에서 명시적으로 부른다.';
