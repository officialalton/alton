-- 2026-10-12 — 새 버전 교체 문항의 겹침 검사는 '다른 풀 모의고사(ap_label=full_practice)'끼리만 본다.
-- 부분 연습 세트와의 겹침은 별도 정책(부분 연습 재구성)이고, 초안 5세트 저장 규칙과 같은 기준이다. 추가형(create or replace).
create or replace function public.mock_exam_create_new_version(p_source_set_id uuid, p_swaps jsonb, p_actor_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_src mock_exam_sets%rowtype;
  v_new mock_exam_sets%rowtype;
  v_sw jsonb; v_section text; v_pos int; v_pid uuid;
  v_old mock_exam_set_items%rowtype;
  v_cols text;
  v_p problems%rowtype; v_pv problem_versions%rowtype; v_op problems%rowtype;
  v_c ap_candidate_items%rowtype; v_oc ap_candidate_items%rowtype;
  v_spec jsonb; v_calc text; v_ok boolean;
  v_map jsonb := '{}'::jsonb; v_swapped int := 0; v_bad text; v_new_id uuid;
begin
  if p_actor_id is null or not exists (select 1 from profiles where id = p_actor_id and role = 'admin') then
    raise exception 'Only an admin can create a new exam version.';
  end if;
  if p_swaps is null or jsonb_typeof(p_swaps) <> 'array' or jsonb_array_length(p_swaps) = 0 then
    raise exception 'At least one item swap is required.';
  end if;
  if jsonb_array_length(p_swaps) > 100 then raise exception 'At most 100 swaps per new version.'; end if;

  select * into v_src from mock_exam_sets where id = p_source_set_id for update;
  if v_src.id is null then raise exception 'Source exam set not found.'; end if;
  if v_src.status <> 'published' or v_src.archived_at is not null then raise exception 'A new version can only be created from the currently published version.'; end if;
  if v_src.format not in ('fixed', 'ap_fixed') then raise exception 'New versions are supported for fixed-form sets only (not 4-module sets).'; end if;
  -- 같은 계열의 동시 새 버전 생성 직렬화 + 초안은 계열당 하나.
  perform pg_advisory_xact_lock(hashtextextended('mock_exam_new_version:' || v_src.set_group_id::text, 0));
  if exists (select 1 from mock_exam_sets where set_group_id = v_src.set_group_id and status = 'draft') then
    raise exception 'A draft version already exists for this exam. Publish or archive it first.';
  end if;

  v_new_id := gen_random_uuid();
  -- 컬럼 목록을 카탈로그에서 구해 복사한다(이후 추가되는 컬럼도 자동 포함, 생성 컬럼은 제외).
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns where table_schema = 'public' and table_name = 'mock_exam_sets' and is_generated = 'NEVER'
     and column_name not in ('id', 'version_no', 'status', 'created_by', 'created_at', 'published_at', 'published_by', 'archived_at', 'access_tier');
  -- 무료 공개 지정은 공개와 같은 UPDATE 에서만 가능(guard_access_tier) → 초안은 tutoring, 공개 때 이전 공개본의 티어를 물려받는다.
  execute format('insert into mock_exam_sets (id, version_no, status, created_by, access_tier, %s) select $1, $2, ''draft'', $3, ''tutoring'', %s from mock_exam_sets where id = $4', v_cols, v_cols)
    using v_new_id, (select max(version_no) + 1 from mock_exam_sets where set_group_id = v_src.set_group_id), p_actor_id, v_src.id;
  select * into v_new from mock_exam_sets where id = v_new_id;

  -- 문항 스냅샷 복사(교체 대상이 아닌 문항은 기존 공개 문항 버전 그대로).
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns where table_schema = 'public' and table_name = 'mock_exam_set_items' and is_generated = 'NEVER'
     and column_name not in ('id', 'exam_set_id', 'created_at');
  -- 교체 슬롯은 건너뛴다(조립된 문항의 스냅샷 변경을 막는 트리거 때문에 UPDATE 가 아니라 새 행 INSERT 로 교체한다).
  execute format('insert into mock_exam_set_items (exam_set_id, %s) select $1, %s from mock_exam_set_items i where i.exam_set_id = $2
                  and not exists (select 1 from jsonb_to_recordset($3) as x(section text, position int) where x.section = i.section and x.position = i.position)', v_cols, v_cols)
    using v_new_id, v_src.id, p_swaps;

  for v_sw in select * from jsonb_array_elements(p_swaps) loop
    v_section := v_sw->>'section'; v_pos := (v_sw->>'position')::int; v_pid := (v_sw->>'problem_id')::uuid;
    if v_section is null or v_pos is null or v_pid is null then raise exception 'Each swap needs section, position and problem_id.'; end if;
    if v_map ? (v_section || ':' || v_pos) then raise exception 'Slot %/% is swapped twice.', v_section, v_pos; end if;
    v_map := v_map || jsonb_build_object(v_section || ':' || v_pos, v_pid);

    select * into v_old from mock_exam_set_items where exam_set_id = v_src.id and section = v_section and position = v_pos;
    if v_old.id is null then raise exception 'Slot %/% does not exist in this exam.', v_section, v_pos; end if;
    select * into v_op from problems where id = v_old.problem_id;
    select * into v_p from problems where id = v_pid;
    if v_p.id is null then raise exception 'Replacement problem % not found.', v_pid; end if;
    if v_pid = v_old.problem_id then raise exception 'Slot %/% already holds that problem.', v_section, v_pos; end if;
    if exists (select 1 from mock_exam_set_items where exam_set_id in (v_src.id, v_new_id) and problem_id = v_pid) then
      raise exception 'Problem % is already in this exam.', v_pid;
    end if;
    -- 공개·확정된 현재 공개 버전만(공개 버전 불변).
    select * into v_pv from problem_versions where id = v_p.published_version_id;
    if v_p.status::text <> 'confirmed' or v_p.archived_at is not null or v_pv.id is null or v_pv.status <> 'published' then
      raise exception 'Replacement problem % is not confirmed and published.', v_pid;
    end if;
    if v_p.usage_scope not in ('mock_exam', 'both') then raise exception 'Replacement problem % is not a mock-exam item.', v_pid; end if;
    if v_sw ? 'problem_version_id' and (v_sw->>'problem_version_id')::uuid is distinct from v_p.published_version_id then
      raise exception 'Replacement problem % must use its current published version.', v_pid;
    end if;
    -- 같은 슬롯 유형: 문항 형식 일치.
    if v_p.format is distinct from v_op.format then
      raise exception 'Slot %/% needs a % problem, not %.', v_section, v_pos, v_op.format, v_p.format;
    end if;

    if v_src.exam_program = 'ap' then
      select * into v_c from ap_candidate_items where candidate_key = v_p.ap_candidate_key;
      select * into v_oc from ap_candidate_items where candidate_key = v_op.ap_candidate_key;
      if v_c.id is null or v_c.release_tier not in ('review_env', 'launch') or v_c.purpose is distinct from 'mock_exam' or v_c.review_env_ready is not true then
        raise exception 'Replacement problem % is not a review_env_ready mock-exam AP item.', v_pid;
      end if;
      if v_c.ap_subject_code is distinct from v_src.ap_subject and not public._ap_shared_scope_ok(v_c.candidate_key, v_src.ap_subject) then raise exception 'Replacement problem % is a different AP subject.', v_pid; end if;
      if v_c.kind is distinct from v_oc.kind then raise exception 'Slot %/% needs a % item, not %.', v_section, v_pos, v_oc.kind, v_c.kind; end if;
      select x into v_spec from jsonb_array_elements(v_src.section_layout->'sections') x where x->>'key' = v_section;
      v_calc := coalesce(v_spec->>'calculator', 'na');
      v_ok := case v_calc when 'required' then v_c.calculator = 'required' when 'not_allowed' then v_c.calculator = 'not_allowed'
                          when 'allowed' then v_c.calculator <> 'not_allowed' else true end;
      if not v_ok then raise exception 'Slot %/% calculator rule (%) does not match the replacement item (%).', v_section, v_pos, v_calc, v_c.calculator; end if;
      insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty)
      values (v_new_id, v_section, v_pos, v_pid, v_p.published_version_id, 'ap:' || v_c.keyword_code,
              case v_c.difficulty_provisional when 'basic_learning' then 'easy' when 'advanced_supplement' then 'hard' else 'medium' end);
      -- 풀 모의고사: 다른 세트 계열과 문항 공유 0.
      if v_src.ap_label = 'full_practice' and exists (
           select 1 from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id
            where i.problem_id = v_pid and s.set_group_id <> v_src.set_group_id and s.status in ('draft', 'published') and s.ap_label = 'full_practice') then
        raise exception 'Replacement problem % is already used by another exam; full practice exams share no items.', v_pid;
      end if;
    else
      insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, skill_code, difficulty)
      values (v_new_id, v_section, v_pos, v_pid, v_p.published_version_id, coalesce(v_p.sat_domain, v_old.sat_domain),
              coalesce(v_p.skill_code, v_old.skill_code), coalesce(v_p.difficulty::text, v_old.difficulty));
    end if;
    v_swapped := v_swapped + 1;
  end loop;

  -- AP 묶음 무결성: 세트에 들어 있는 후보는 모든 하위 문항이 함께 있어야 하고 하위 문항 순서(item_index)가 위치 순서와 같아야 한다.
  if v_src.exam_program = 'ap' then
    select string_agg(x.k, ', ') into v_bad from (
      select p.ap_candidate_key k
        from mock_exam_set_items i join problems p on p.id = i.problem_id
       where i.exam_set_id = v_new_id and p.ap_candidate_key is not null
       group by p.ap_candidate_key
      having count(*) <> (select count(*) from problems q where q.ap_candidate_key = p.ap_candidate_key and q.exam_system = 'ap')
      limit 5) x;
    if v_bad is not null then raise exception 'Partial bundle replacement is not allowed (candidate: %). Swap every part of a bundle together.', v_bad; end if;
    select string_agg(x.k, ', ') into v_bad from (
      select p.ap_candidate_key k from mock_exam_set_items i join problems p on p.id = i.problem_id
       where i.exam_set_id = v_new_id and p.ap_candidate_key is not null
       group by p.ap_candidate_key
      having array_agg(p.ap_item_index order by i.section, i.position) <> array_agg(p.ap_item_index order by p.ap_item_index) limit 5) x;
    if v_bad is not null then raise exception 'Bundle part order does not match slot order (candidate: %).', v_bad; end if;
  end if;

  return jsonb_build_object('newSetId', v_new_id, 'versionNo', v_new.version_no, 'setGroupId', v_new.set_group_id, 'sourceSetId', v_src.id, 'swapped', v_swapped);
end $$;
revoke all on function public.mock_exam_create_new_version(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.mock_exam_create_new_version(uuid, jsonb, uuid) to service_role;
