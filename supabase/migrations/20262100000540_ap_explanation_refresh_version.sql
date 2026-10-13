-- 2026-10-12 AP 해설 수식 교정 — 공개 세트에 "같은 문항의 교정된 새 문제 버전"을 반영하는 새 세트 버전 초안 RPC. additive(새 함수 + 감사 행 허용 값 추가만). 원격 미적용.
-- 배경: 공개된 문제 버전과 조립된 세트 스냅샷(content_snapshot)은 불변이다. 해설의 원문 TeX 를 고치려면 (1) 문제에 새 버전을 만들어 공개(기존 RPC) → (2) 이 RPC 로 세트의 version_no+1 초안을 만든다.
--  · mock_exam_refresh_explanations(source, actor): 공개 중인 AP 고정형 세트의 같은 set_group_id 에 version_no+1 초안을 만들고, 모든 문항을 복사하되 문제의 "현재 공개 버전"이 세트의 버전과 다르면 그 새 버전으로 바꾼다.
--    안전 조건: 새 버전은 같은 문제의 공개 버전이어야 하고, 본문·선지·정답·그림·진술이 옛 버전과 완전히 같아야 한다(해설·참고 답안만 달라질 수 있다). 하나도 바뀌는 문항이 없으면 거부.
--    응시·답안·결과·공개본은 읽기만 한다. 스냅샷은 INSERT 트리거가 새 버전 내용으로 다시 만든다(옛 스냅샷은 복사하지 않는다).
--  · 감사 행 허용 값 추가: explanation_fix_preview / explanation_fix / set_refresh_draft.

create or replace function public.mock_exam_refresh_explanations(p_source_set_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_src mock_exam_sets%rowtype; v_new_id uuid; v_cols text; v_cols_i text; v_refreshed int; v_bad text;
begin
  if p_actor_id is null or not exists (select 1 from profiles where id = p_actor_id and role = 'admin') then
    raise exception 'Only an admin can create a corrected exam version.';
  end if;
  select * into v_src from mock_exam_sets where id = p_source_set_id for update;
  if v_src.id is null then raise exception 'Source exam set not found.'; end if;
  if v_src.exam_program <> 'ap' or v_src.format <> 'ap_fixed' then raise exception 'Only fixed-form AP sets can be refreshed.'; end if;
  if v_src.status <> 'published' or v_src.archived_at is not null then raise exception 'A corrected version can only be created from the currently published version.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mock_exam_new_version:' || v_src.set_group_id::text, 0));
  if exists (select 1 from mock_exam_sets where set_group_id = v_src.set_group_id and status = 'draft') then
    raise exception 'A draft version already exists for this exam. Publish or archive it first.';
  end if;

  -- 바뀔 문항 수와 안전 조건(내용 동일성)을 먼저 확인한다.
  select count(*) into v_refreshed
    from mock_exam_set_items i join problems p on p.id = i.problem_id
   where i.exam_set_id = v_src.id and p.published_version_id is not null and p.published_version_id <> i.problem_version_id;
  if v_refreshed = 0 then raise exception 'No item has a newer published problem version; nothing to refresh.'; end if;
  select string_agg(x.pid::text, ', ') into v_bad from (
    select p.id pid
      from mock_exam_set_items i
      join problems p on p.id = i.problem_id
      join problem_versions o on o.id = i.problem_version_id
      join problem_versions n on n.id = p.published_version_id
     where i.exam_set_id = v_src.id and n.id <> o.id
       and (n.problem_id <> p.id or n.status <> 'published' or p.status::text <> 'confirmed' or p.archived_at is not null
            or n.passage is distinct from o.passage or n.question is distinct from o.question or n.options is distinct from o.options
            or n.correct_index is distinct from o.correct_index or n.answers is distinct from o.answers
            or n.figure is distinct from o.figure or n.statements is distinct from o.statements)
     limit 5) x;
  if v_bad is not null then raise exception 'A refreshed version must keep the passage, question, options, answer key, figure and parts unchanged (problem: %).', v_bad; end if;

  v_new_id := gen_random_uuid();
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns where table_schema = 'public' and table_name = 'mock_exam_sets' and is_generated = 'NEVER'
     and column_name not in ('id', 'version_no', 'status', 'created_by', 'created_at', 'published_at', 'published_by', 'archived_at', 'access_tier');
  execute format('insert into mock_exam_sets (id, version_no, status, created_by, access_tier, %s) select $1, $2, ''draft'', $3, ''tutoring'', %s from mock_exam_sets where id = $4', v_cols, v_cols)
    using v_new_id, (select max(version_no) + 1 from mock_exam_sets where set_group_id = v_src.set_group_id), p_actor_id, v_src.id;

  -- 문항 복사: problem_version_id 는 문제의 현재 공개 버전으로, content_snapshot 은 복사하지 않는다(INSERT 트리거가 새 버전 내용으로 만든다).
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position),
         string_agg(case column_name when 'problem_version_id' then 'coalesce(p.published_version_id, i.problem_version_id)' else 'i.' || quote_ident(column_name) end, ', ' order by ordinal_position)
    into v_cols, v_cols_i
    from information_schema.columns where table_schema = 'public' and table_name = 'mock_exam_set_items' and is_generated = 'NEVER'
     and column_name not in ('id', 'exam_set_id', 'created_at', 'content_snapshot');
  execute format('insert into mock_exam_set_items (exam_set_id, %s) select $1, %s from mock_exam_set_items i join problems p on p.id = i.problem_id where i.exam_set_id = $2', v_cols, v_cols_i)
    using v_new_id, v_src.id;

  return jsonb_build_object('newSetId', v_new_id, 'versionNo', (select version_no from mock_exam_sets where id = v_new_id), 'setGroupId', v_src.set_group_id, 'sourceSetId', v_src.id, 'refreshed', v_refreshed);
end $$;
revoke all on function public.mock_exam_refresh_explanations(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mock_exam_refresh_explanations(uuid, uuid) to service_role;

alter table ap_stock_admin_runs drop constraint if exists ap_stock_admin_runs_action_check;
alter table ap_stock_admin_runs add constraint ap_stock_admin_runs_action_check
  check (action in ('load_check', 'import', 'render_verify', 'screen_verify', 'convert', 'assemble_draft', 'new_version_preview', 'new_version_draft', 'new_version_publish', 'set_access_tier',
                    'explanation_fix_preview', 'explanation_fix', 'set_refresh_draft'));
