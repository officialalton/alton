-- P2/P3 2차 잔여 — 교재 쪽이 바뀔 때도 자동 구성을 다시 맞춘다.
--
-- 지금까지 동기화는 "회차에 키워드가 붙거나 떨어질 때"만 돌았다. 그래서 키워드를
-- 이미 붙여 둔 회차는, 나중에 교재가 새로 배포되거나 대표 키워드가 바뀌어도
-- 그 교재를 못 받았다. 키워드는 그대로인데 후보가 늘어난 경우를 놓친 것이다.
--
-- 반대 방향도 같다: 배포를 내리면 자동분에서 빠져야 한다. 학생에게 갈 수 없는
-- 교재가 구성에 남아 있으면 안 된다.
--
-- 선생님이 직접 담은 것(manual)·뺀 것(exclusions)·맞춰 둔 순서는 건드리지 않는다
-- — sync_unit_auto_materials가 이미 그 셋을 지킨다.
--
-- 과거 수업은 영향을 받지 않는다. 수업에 고정되는 것은 시작 시점의
-- session_content_manifest 스냅샷이고, 회차 구성은 그 스냅샷의 재료일 뿐이다.

create or replace function curriculum_docs_resync_unit_materials()
returns trigger language plpgsql as $$
declare
  v_unit_id uuid;
begin
  -- 바뀌기 전 키워드와 바뀐 뒤 키워드 양쪽에 걸린 회차를 모두 다시 맞춘다.
  -- 한쪽만 보면 "A에서 B로 옮겼다"에서 A 쪽 회차가 옛 교재를 계속 들고 있는다.
  for v_unit_id in
    select distinct uk.overlay_unit_id
    from curriculum_overlay_unit_keywords uk
    where uk.keyword_id is not distinct from old.primary_keyword_id
       or uk.keyword_id is not distinct from new.primary_keyword_id
  loop
    perform sync_unit_auto_materials(v_unit_id);
  end loop;
  return null;
end;
$$;

comment on function curriculum_docs_resync_unit_materials() is
  'P2 2차: 교재의 배포 상태나 대표 키워드가 바뀌면, 그 키워드를 쓰는 회차들의 '
  '자동 구성을 다시 맞춘다. 수동 구성·제외·순서는 보존된다.';

-- 제목 수정 같은 무관한 변경으로는 돌지 않는다.
create trigger curriculum_docs_resync
  after update of status, primary_keyword_id, primary_keyword_position on curriculum_docs
  for each row
  when (
    old.status is distinct from new.status
    or old.primary_keyword_id is distinct from new.primary_keyword_id
    or old.primary_keyword_position is distinct from new.primary_keyword_position
  )
  execute function curriculum_docs_resync_unit_materials();

-- 새로 만들어진 교재가 처음부터 배포+대표 키워드를 갖고 들어오는 경우도 있다.
create or replace function curriculum_docs_resync_on_insert()
returns trigger language plpgsql as $$
declare
  v_unit_id uuid;
begin
  if new.primary_keyword_id is null or new.status <> 'published' then
    return null;
  end if;
  for v_unit_id in
    select distinct uk.overlay_unit_id
    from curriculum_overlay_unit_keywords uk
    where uk.keyword_id = new.primary_keyword_id
  loop
    perform sync_unit_auto_materials(v_unit_id);
  end loop;
  return null;
end;
$$;

create trigger curriculum_docs_resync_insert
  after insert on curriculum_docs
  for each row execute function curriculum_docs_resync_on_insert();

-- 상속 트리거가 관리자가 정한 교재 순서를 잃어버리고 있었다. position을 주지
-- 않으면 "맨 뒤에 붙이기" 트리거가 행마다 max+1을 매기는데, insert ... select의
-- 행 순서는 보장되지 않아 실행마다 순서가 뒤집혔다. 명시적으로 넘긴다.
create or replace function curriculum_overlay_units_inherit_defaults()
returns trigger language plpgsql as $$
begin
  if new.source_unit_id is null then
    return null;
  end if;

  insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id, created_by)
  select new.id, tuk.keyword_id, auth.uid()
  from subject_template_unit_keywords tuk
  where tuk.unit_id = new.source_unit_id
  on conflict do nothing;

  insert into curriculum_overlay_unit_materials
    (overlay_unit_id, curriculum_doc_id, position, source, created_by)
  select new.id, tum.curriculum_doc_id,
         coalesce(
           (select max(position) from curriculum_overlay_unit_materials where overlay_unit_id = new.id),
           0
         ) + row_number() over (order by tum.position, tum.curriculum_doc_id),
         'manual', auth.uid()
  from subject_template_unit_materials tum
  join curriculum_docs d on d.id = tum.curriculum_doc_id
  where tum.unit_id = new.source_unit_id and d.status = 'published'
  on conflict do nothing;

  return null;
end;
$$;
