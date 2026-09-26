-- 표시 시점 가시성 게이트의 교재 단위 판. 섹션용 뷰
-- (curriculum_doc_section_keywords_selectable)와 같은 역할을 교재에 대해 한다:
-- "지금도 여전히 학생에게 보여도 되는가"만 본다.
--
-- 키워드를 요구하지 않는다. 섹션 쪽 뷰가 키워드를 거치는 것은 그 뷰가 원래
-- "고를 수 있는 후보"를 위한 것이기 때문이고, 여기서 필요한 건 게이트뿐이다.
-- 키워드가 떨어졌다고 이미 수업에 고정된 교재가 사라지면 안 된다.
create view public.curriculum_docs_selectable
with (security_invoker = true) as
select d.id as curriculum_doc_id, d.subject_id, d.title
from curriculum_docs d
where d.status = 'published' and d.archived_at is null;

comment on view public.curriculum_docs_selectable is
  'P2: 지금도 보여도 되는 교재(배포됨 + 보관 아님). 매니페스트의 material_doc 행을 '
  '표시할지 판단하는 게이트다.';

-- 검증 트리거가 material_doc을 모른다("알 수 없는 콘텐츠 유형입니다").
--
-- 교재 전체는 키워드 범위로 검사하지 않는다. 회차 교재 구성은 키워드 자동
-- 구성뿐 아니라 선생님이 직접 담은 것도 포함하는데(그건 키워드와 무관하다),
-- 키워드를 요구하면 직접 담은 교재가 수업 시작에서 튕겨 나간다.
-- 대신 "배포됐고 보관되지 않았는가"를 본다 — 학생에게 갈 수 있는 상태인가가
-- 실제로 지켜야 할 조건이다.
create or replace function public.check_prepared_content_item_selectable()
returns trigger
language plpgsql as $$
declare
  v_unit_selection_id uuid;
  v_ok boolean;
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
  elsif new.content_type = 'material_section' then
    select exists (
      select 1
      from session_prepared_selection_unit_keywords k
      join curriculum_doc_section_keywords_selectable sel
        on sel.section_id = new.content_id and sel.keyword_id = k.keyword_id
      where k.prepared_selection_unit_id = new.prepared_selection_unit_id
    ) into v_ok;
  elsif new.content_type = 'problem' then
    select exists (
      select 1
      from session_prepared_selection_unit_keywords k
      join problem_keywords_selectable sel
        on sel.problem_id = new.content_id and sel.keyword_id = k.keyword_id
      where k.prepared_selection_unit_id = new.prepared_selection_unit_id
    ) into v_ok;
  else
    raise exception '알 수 없는 콘텐츠 유형입니다: %', new.content_type;
  end if;

  if not v_ok then
    -- 기존 문구를 그대로 둔다 — 이 문장을 근거로 삼는 검증이 있다.
    raise exception '선택 가능(published/confirmed)하지 않거나 이 단원의 키워드 범위 밖인 콘텐츠는 담을 수 없습니다: % %', new.content_type, new.content_id;
  end if;

  return new;
end;
$$;

-- 회차 준비에 담긴 교재 구성이 수업으로 그대로 넘어가게 한다.
-- 지금까지는 curriculum_unit_prep_items만 봤는데, 교재 구성은 그쪽이 아니라
-- curriculum_overlay_unit_materials에 있다. 둘 다 넣되 교재 구성을 앞에 둔다.
create or replace function public.refresh_staged_selection_from_unit_prep(p_selection_id uuid)
returns int
language plpgsql
security definer set search_path = public as $$
declare
  v_unit_row record;
  v_prep_id uuid;
  v_pos int := 0;
  v_item record;
begin
  select id, overlay_unit_id into v_unit_row
  from session_prepared_selection_units
  where prepared_selection_id = p_selection_id
  order by position asc
  limit 1;

  if not found then
    raise exception '연결된 회차가 없습니다 — 준비 구성을 불러오지 못했습니다.';
  end if;

  select id into v_prep_id from curriculum_unit_preps where overlay_unit_id = v_unit_row.overlay_unit_id;
  if v_prep_id is null then
    raise exception '이 회차의 준비 구성을 불러오지 못했습니다.';
  end if;

  delete from session_prepared_selection_unit_keywords where prepared_selection_unit_id = v_unit_row.id;
  insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
  select v_unit_row.id, k.keyword_id
  from curriculum_overlay_unit_keywords k
  where k.overlay_unit_id = v_unit_row.overlay_unit_id;

  delete from session_prepared_selection_content_items where prepared_selection_id = p_selection_id;

  -- (1) 회차 교재 구성 — 교재 전체 단위. 배포됐고 보관되지 않은 것만.
  for v_item in
    select m.curriculum_doc_id
    from curriculum_overlay_unit_materials m
    join curriculum_docs d on d.id = m.curriculum_doc_id
    where m.overlay_unit_id = v_unit_row.overlay_unit_id
      and d.status = 'published'
      and d.archived_at is null
    order by m.position asc
  loop
    v_pos := v_pos + 1;
    insert into session_prepared_selection_content_items
      (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
    values (p_selection_id, v_unit_row.id, 'material_doc', v_item.curriculum_doc_id, v_pos);
  end loop;

  -- (2) 준비 항목 — 문제와, 아직 남아 있는 조각 단위 선택.
  for v_item in
    select content_type, content_id from curriculum_unit_prep_items
    where prep_id = v_prep_id order by position asc
  loop
    v_pos := v_pos + 1;
    insert into session_prepared_selection_content_items
      (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position)
    values (p_selection_id, v_unit_row.id, v_item.content_type, v_item.content_id, v_pos);
  end loop;

  return v_pos;
end;
$$;

revoke execute on function public.refresh_staged_selection_from_unit_prep(uuid) from public, anon, authenticated;
grant execute on function public.refresh_staged_selection_from_unit_prep(uuid) to service_role;
