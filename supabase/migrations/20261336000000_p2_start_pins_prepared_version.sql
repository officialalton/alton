-- P2 9차 — 수업 시작은 **준비안이 정한 버전**을 그대로 고정한다.
--
-- 2026-09-13 제품 오너:
--   "공개 문제 v1을 준비안에 담은 뒤 v2를 공개해도 기존 준비안이 v1을 유지하고 …
--    수업 시작 후에는 이후 재공개·재구성과 무관하게 당시 버전과 답안·풀이 기록을
--    유지해주세요."
--   "준비안 버전·순서가 그대로 매니페스트가 되고, 사용 불가 항목은 사유를 표시한 뒤
--    시작을 막습니다. 부분 snapshot 을 만들지 않습니다."
--
-- 20261295000000 의 pin_session_selection 은 문제 버전을 이렇게 집었다:
--
--     select p.published_version_id into v_problem_version from problems p ...
--
-- **지금 공개된 버전**이다. 준비안이 v1 을 들고 있어도 시작 시점에 v2 가 공개돼
-- 있으면 v2 가 고정됐다. 선생님이 보고 준비한 것과 다른 문제가 수업에 나간다.
--
-- 준비안 → staged 선택 → 매니페스트로 버전을 실어 나른다.

-- =========================================================================
-- 1. staged 선택이 버전을 들고 간다
-- =========================================================================
alter table session_prepared_selection_content_items
  add column problem_version_id uuid references problem_versions (id);

comment on column session_prepared_selection_content_items.problem_version_id is
  'P2 9차: 준비안이 이 문제를 담을 때의 공개 버전. 수업 시작이 이 버전을 그대로 고정한다 '
  '— 시작 시점의 최신본으로 조용히 갈아끼우지 않는다. null 은 버전 제도 이전에 담긴 것이다.';

create or replace function public.link_unit_prep_to_session(
  p_overlay_unit_id uuid,
  p_session_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_prep curriculum_unit_preps%rowtype;
  v_enrollment uuid;
  v_session_enrollment uuid;
  v_final_status v3_session_final_status;
  v_selection_id uuid;
  v_unit_row_id uuid;
  v_existing_status text;
  v_pos int := 0;
  v_item record;
begin
  select p.* into v_prep from curriculum_unit_preps p where p.overlay_unit_id = p_overlay_unit_id;
  if not found then
    raise exception '이 회차에는 아직 준비가 없습니다.';
  end if;

  select o.subject_enrollment_id into v_enrollment
  from curriculum_overlay_units u
  join student_curriculum_overlays o on o.id = u.overlay_id
  where u.id = p_overlay_unit_id;

  select s.subject_enrollment_id, s.final_status into v_session_enrollment, v_final_status
  from sessions s where s.id = p_session_id;
  if v_session_enrollment is null then
    raise exception '수업을 찾을 수 없습니다.';
  end if;
  if v_session_enrollment is distinct from v_enrollment then
    raise exception '다른 학생·과목의 회차는 이 수업에 연결할 수 없습니다.';
  end if;
  if v_final_status <> 'scheduled' then
    raise exception '이미 시작했거나 종료한 수업의 준비는 바꿀 수 없습니다.';
  end if;
  if not (
    exists (select 1 from profiles pr where pr.id = p_actor_id and pr.role = 'admin')
    or exists (select 1 from sessions s where s.id = p_session_id and s.teacher_id = p_actor_id)
  ) then
    raise exception '담당 수업에만 회차 준비를 연결할 수 있습니다.';
  end if;

  select s.id, s.status into v_selection_id, v_existing_status
  from session_prepared_selections s
  where s.session_id = p_session_id and s.status <> 'archived';
  if v_selection_id is not null then
    if v_existing_status = 'pinned' then
      raise exception '이미 고정된 수업입니다.';
    end if;
    return v_selection_id;
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);

  insert into session_prepared_selections (subject_enrollment_id, teacher_id, session_id, status)
  values (v_enrollment, p_actor_id, p_session_id, 'staged')
  returning id into v_selection_id;

  insert into session_prepared_selection_units (prepared_selection_id, overlay_unit_id, position)
  values (v_selection_id, p_overlay_unit_id, 1)
  returning id into v_unit_row_id;

  insert into session_prepared_selection_unit_keywords (prepared_selection_unit_id, keyword_id)
  select v_unit_row_id, k.keyword_id
  from curriculum_overlay_unit_keywords k
  where k.overlay_unit_id = p_overlay_unit_id;

  -- 준비안의 순서와 **버전**을 그대로 옮긴다.
  for v_item in
    select content_type, content_id, problem_version_id
    from curriculum_unit_prep_items
    where prep_id = v_prep.id order by position asc
  loop
    v_pos := v_pos + 1;
    insert into session_prepared_selection_content_items
      (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position,
       problem_version_id)
    values (v_selection_id, v_unit_row_id, v_item.content_type, v_item.content_id, v_pos,
            v_item.problem_version_id);
  end loop;

  insert into session_curriculum_units (session_id, overlay_unit_id, role)
  values (p_session_id, p_overlay_unit_id, 'primary')
  on conflict (session_id, overlay_unit_id) do nothing;

  return v_selection_id;
end;
$$;
revoke execute on function public.link_unit_prep_to_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_unit_prep_to_session(uuid, uuid, uuid) to service_role;

-- =========================================================================
-- 2. 고정 — 준비안의 버전, 사유가 붙은 차단, 전부 아니면 아무것도
-- =========================================================================
create or replace function public.pin_session_selection(p_session_id uuid)
returns setof session_content_manifest
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid;
  v_selection session_prepared_selections;
  v_session_enrollment uuid;
  v_final_status v3_session_final_status;
  v_item record;
  v_source_unit uuid;
  v_doc_version timestamptz;
  v_ok boolean;
  v_pos int := 0;
  v_unit_selection_id uuid;
  v_problem_version uuid;
  v_problem problems%rowtype;
  v_reason text;
  v_label text;
begin
  v_caller := auth.uid();
  if v_caller is null then
    raise exception '인증되지 않은 호출입니다.';
  end if;

  select s.* into v_selection
  from session_prepared_selections s
  where s.session_id = p_session_id and s.status = 'staged';

  if not found then
    raise exception '이 세션에 attach된 staged 준비된 선택을 찾을 수 없습니다.';
  end if;

  if not (
    is_admin()
    or (v_caller = v_selection.teacher_id and is_active_teacher_for_enrollment(v_selection.subject_enrollment_id))
  ) then
    raise exception '이 준비된 선택을 pin할 권한이 없습니다.';
  end if;

  select subject_enrollment_id, final_status into v_session_enrollment, v_final_status
  from sessions where id = p_session_id;

  if v_session_enrollment is distinct from v_selection.subject_enrollment_id then
    raise exception '세션과 준비된 선택의 subject_enrollment_id가 일치하지 않습니다.';
  end if;

  if v_final_status <> 'scheduled' then
    raise exception '이미 시작/종료된 세션은 pin할 수 없습니다.';
  end if;

  if not exists (
    select 1 from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
  ) then
    raise exception '포함된(included) 콘텐츠가 하나도 없는 준비된 선택은 pin할 수 없습니다.';
  end if;

  for v_item in
    select id, prepared_selection_unit_id
    from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
  loop
    select prepared_selection_id into v_unit_selection_id
    from session_prepared_selection_units
    where id = v_item.prepared_selection_unit_id;

    if v_unit_selection_id is distinct from v_selection.id then
      raise exception 'pin 시점 방어적 재확인 실패 — 콘텐츠 항목 %의 prepared_selection_unit_id(%)가 이 선택(%)에 속하지 않습니다.',
        v_item.id, v_item.prepared_selection_unit_id, v_selection.id;
    end if;
  end loop;

  -- 재검증. 하나라도 쓸 수 없으면 **사유를 붙여** 시작을 막는다. 매니페스트는 한 줄도
  -- 쓰지 않는다 — 절반만 고정된 수업을 만들지 않는다.
  for v_item in
    select id, content_type, content_id, position, prepared_selection_unit_id, problem_version_id
    from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
    order by position asc
  loop
    v_reason := null;

    if v_item.content_type = 'material_doc' then
      -- 교재 전체 단위(20261315000000). 회차 구성에 담긴 교재이므로 키워드 범위가
      -- 아니라 **지금 학생에게 보여도 되는가**로 판단한다.
      select exists (
        select 1 from curriculum_docs_selectable d where d.id = v_item.content_id
      ) into v_ok;
      if not v_ok then
        v_reason := '교재가 공개돼 있지 않거나 보관됐습니다';
      end if;

    elsif v_item.content_type = 'material_section' then
      select exists (
        select 1
        from session_prepared_selection_unit_keywords k
        join curriculum_doc_section_keywords_selectable sel
          on sel.section_id = v_item.content_id and sel.keyword_id = k.keyword_id
        where k.prepared_selection_unit_id = v_item.prepared_selection_unit_id
      ) into v_ok;
      if not v_ok then
        v_reason := '교재가 공개돼 있지 않거나 이 회차의 키워드 범위 밖입니다';
      end if;

    elsif v_item.content_type = 'problem' then
      select * into v_problem from problems where id = v_item.content_id;

      if v_problem.id is null then
        v_reason := '문제를 찾을 수 없습니다';
      elsif v_problem.archived_at is not null then
        v_reason := '보관된 문제입니다';
      elsif v_problem.status::text <> 'confirmed' then
        v_reason := '아직 공개되지 않은 문제입니다';
      elsif v_item.problem_version_id is not null
            and not exists (
              select 1 from problem_versions v
              where v.id = v_item.problem_version_id and v.problem_id = v_item.content_id
            ) then
        v_reason := '준비안이 가리키는 문제 버전을 찾을 수 없습니다';
      elsif v_item.problem_version_id is null and v_problem.published_version_id is null then
        v_reason := '사용할 수 있는 공개 버전이 없습니다';
      else
        select exists (
          select 1
          from session_prepared_selection_unit_keywords k
          join problem_keywords_selectable sel
            on sel.problem_id = v_item.content_id and sel.keyword_id = k.keyword_id
          where k.prepared_selection_unit_id = v_item.prepared_selection_unit_id
        ) into v_ok;
        if not v_ok then
          v_reason := '이 회차의 키워드 범위 밖입니다';
        end if;
      end if;

    else
      raise exception '알 수 없는 콘텐츠 유형입니다: %', v_item.content_type;
    end if;

    if v_reason is not null then
      v_label := case when v_item.content_type = 'problem' then '문제' else '교재' end;
      -- 어느 항목인지도 함께 남긴다. 사유만으로는 여러 개 중 무엇인지 알 수 없다.
      raise exception '수업을 시작할 수 없습니다 — 준비안의 % 하나를 쓸 수 없습니다(%): % %. 그 항목을 빼거나 바꾼 뒤 다시 시작하세요.',
        v_label, v_reason, v_item.content_type, v_item.content_id;
    end if;
  end loop;

  for v_item in
    select id, content_type, content_id, position, prepared_selection_unit_id, problem_version_id
    from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
    order by position asc
  loop
    v_pos := v_pos + 1;
    v_doc_version := null;
    v_problem_version := null;

    select u.overlay_unit_id into v_source_unit
    from session_prepared_selection_units u
    where u.id = v_item.prepared_selection_unit_id;

    if v_item.content_type = 'material_doc' then
      select d.updated_at into v_doc_version
      from curriculum_docs d where d.id = v_item.content_id;
    elsif v_item.content_type = 'material_section' then
      select d.updated_at into v_doc_version
      from curriculum_doc_sections s
      join curriculum_docs d on d.id = s.curriculum_doc_id
      where s.id = v_item.content_id;
    elsif v_item.content_type = 'problem' then
      -- **준비안이 정한 버전**이 먼저다. 없을 때만(버전 제도 이전에 담긴 것)
      -- 지금 공개본을 쓴다 — 그 경우도 무엇을 썼는지는 매니페스트에 남는다.
      v_problem_version := v_item.problem_version_id;
      if v_problem_version is null then
        select p.published_version_id into v_problem_version
        from problems p where p.id = v_item.content_id;
      end if;
    end if;

    insert into session_content_manifest
      (session_id, content_type, content_id, source_overlay_unit_id, display_position,
       published_doc_version_at_pin, problem_version_id)
    values
      (p_session_id, v_item.content_type, v_item.content_id, v_source_unit, v_pos,
       v_doc_version, v_problem_version);
  end loop;

  insert into session_curriculum_units (session_id, overlay_unit_id, role)
  select
    p_session_id,
    u.overlay_unit_id,
    case when row_number() over (order by u.position asc) = 1 then 'primary' else 'supplement' end
  from session_prepared_selection_units u
  where u.prepared_selection_id = v_selection.id
  on conflict (session_id, overlay_unit_id) do nothing;

  update session_prepared_selections
  set status = 'pinned', pinned_at = now()
  where id = v_selection.id;

  return query select * from session_content_manifest where session_id = p_session_id order by display_position;
end;
$$;

comment on function public.pin_session_selection(uuid) is
  'P2 9차: session_content_manifest 와 session_curriculum_units 의 유일한 쓰기 경로. '
  '**준비안이 정한 문제 버전을 그대로 고정한다** — 시작 시점의 최신 공개본으로 바꾸지 '
  '않는다. 쓸 수 없는 항목이 하나라도 있으면 사유를 붙여 시작을 막고 매니페스트를 한 줄도 '
  '쓰지 않는다(부분 고정 없음).';


-- =========================================================================
-- 3. 시작 직전의 재구성도 버전을 함께 옮긴다
-- =========================================================================
-- 20261299000000·20261315000000 은 고정 직전에 staged 선택을 회차 준비로 다시
-- 만든다("시작 시점의 최신 준비를 고정한다"). 그때 문제 버전을 빠뜨리면, 연결
-- 시점에 실어 둔 버전이 여기서 지워지고 pin 이 다시 최신본을 집게 된다.
--
-- 교재 구성은 20261315000000 의 동작을 그대로 둔다 — 회차에 담긴 교재를 그 시점에
-- 다시 읽는다. 바뀐 것은 문제 버전을 함께 옮긴다는 것뿐이다.
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

  for v_item in
    select content_type, content_id, problem_version_id from curriculum_unit_prep_items
    where prep_id = v_prep_id order by position asc
  loop
    v_pos := v_pos + 1;
    insert into session_prepared_selection_content_items
      (prepared_selection_id, prepared_selection_unit_id, content_type, content_id, position,
       problem_version_id)
    values (p_selection_id, v_unit_row.id, v_item.content_type, v_item.content_id, v_pos,
            v_item.problem_version_id);
  end loop;

  return v_pos;
end;
$$;
revoke execute on function public.refresh_staged_selection_from_unit_prep(uuid) from public, anon, authenticated;
grant execute on function public.refresh_staged_selection_from_unit_prep(uuid) to service_role;

comment on function public.refresh_staged_selection_from_unit_prep(uuid) is
  'P2 9차: 고정 직전에 staged 선택을 회차 준비로 다시 만든다. **준비안이 정한 문제 버전을 '
  '함께 옮긴다** — 옮기지 않으면 pin 이 시작 시점의 최신 공개본을 집어, 선생님이 준비한 '
  '것과 다른 내용이 고정된다.';

-- =========================================================================
-- 4. 담을 수 없는 이유를 문장에 담는다
-- =========================================================================
-- 재구성이 staged 항목을 다시 넣을 때 이 트리거가 먼저 막는다. 지금까지의 문구는
-- "선택 가능하지 않거나 키워드 범위 밖" 한 줄이라, 선생님이 무엇을 고쳐야 할지
-- 알 수 없었다. 기존 문장은 그대로 두고(그 문장을 근거로 삼는 검증이 있다) 사유를
-- 괄호로 덧붙인다.
create or replace function public.check_prepared_content_item_selectable()
returns trigger
language plpgsql as $$
declare
  v_unit_selection_id uuid;
  v_ok boolean;
  v_reason text;
  v_problem problems%rowtype;
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
    select * into v_problem from problems where id = new.content_id;

    select exists (
      select 1
      from session_prepared_selection_unit_keywords k
      join problem_keywords_selectable sel
        on sel.problem_id = new.content_id and sel.keyword_id = k.keyword_id
      where k.prepared_selection_unit_id = new.prepared_selection_unit_id
    ) into v_ok;

    if not v_ok then
      v_reason := case
        when v_problem.id is null then '문제를 찾을 수 없습니다'
        when v_problem.archived_at is not null then '보관된 문제입니다'
        when v_problem.status::text <> 'confirmed' then '아직 공개되지 않은 문제입니다'
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
$$;
