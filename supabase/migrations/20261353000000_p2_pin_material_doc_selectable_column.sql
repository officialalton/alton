-- P2 13차 정정 — 수업 시작이 "column d.id does not exist"로 막혔다.
--
-- 2026-09-14 Preview: 준비안에 교재 전체(material_doc — PDF 자료가 그렇다)가 담긴 수업을 시작하면
-- pin_session_selection 이 curriculum_docs_selectable 을 d.id 로 조회했는데, 그 뷰의 열 이름은
-- curriculum_doc_id 다(20261336000000 의 잠복 결함 — 그동안 시작된 수업은 섹션 단위였다).
-- 조회 열 이름만 고쳐 20261336000000 판본을 다시 정의한다. 규칙은 그대로다.

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
        select 1 from curriculum_docs_selectable d where d.curriculum_doc_id = v_item.content_id
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
