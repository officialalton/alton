-- 문제은행 게이트 우회 경로 봉쇄(2026-10-06, 제품 오너 "어떤 경로로도 문제 있는 문항이 은행·세트에 들어가면 안 된다").
-- 모두 additive(create or replace / drop trigger if exists). 공개 시점·세트 공개 시점에만 적용 — 이미 공개된 문항을 소급해 내리지 않는다.
--  1. confirm_and_publish_problem_version: render_check 필수(그림 없는 버전 포함), MC 정답 인덱스 범위·선택지 중복 금지,
--     usage_scope 가 mock_exam/both 인 문항은 explanation_en 필수.
--  2. problem_versions 트리거: 공개(published) 버전의 본문·선택지·정답·자료·해설 직접 수정 금지.
--     예외: 세션 설정 alton.version_content_edit='on'(선지 순서 교정 RPC), explanation_en 이 비어 있던 곳을 채우는 것.
--  3. 세트 공개 게이트: 모든 항목이 확정·미보관·모의고사 용도·현재 공개본·한글 없음·explanation_en 있음·render_check ok.
--  4. 용도 되돌리기(→general) 차단: draft/published 세트에 들어간 문항은 일반용으로 바꿀 수 없다.
-- 되돌리기: 트리거 problem_versions_published_immutable 삭제, 게이트·가드·confirm 함수를 20261374/20261907/20261990 정의로 복원.

-- ── 1. 버전 공개 게이트 ────────────────────────────────────────────────
create or replace function public.confirm_and_publish_problem_version(
  p_version_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  v_problem_id uuid;
  v_status text;
  v_format text;
  v_scope text;
  v_version problem_versions%rowtype;
  v_issue text;
begin
  select problem_id, status into v_problem_id, v_status
  from problem_versions where id = p_version_id;
  if v_problem_id is null then
    raise exception '존재하지 않는 문제 버전입니다.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_problem_id::text, 91));
  select * into v_version from problem_versions where id = p_version_id for update;
  v_status := v_version.status;
  if v_status = 'published' then
    return;
  end if;
  if v_status = 'archived' then
    raise exception '지난 공개본은 다시 공개할 수 없습니다. 수정 초안을 만들어 공개하세요.';
  end if;

  select p.format::text, p.usage_scope into v_format, v_scope from problems p where p.id = v_problem_id;
  if v_format = 'spr' and (v_version.answers is null or jsonb_typeof(v_version.answers) <> 'array' or jsonb_array_length(v_version.answers) = 0) then
    raise exception '숫자 입력(SPR) 문제는 정답을 하나 이상 적어야 공개할 수 있습니다.';
  end if;
  if v_format = 'mc' and (v_version.options is null or jsonb_typeof(v_version.options) <> 'array' or jsonb_array_length(v_version.options) < 2 or v_version.correct_index is null) then
    raise exception '객관식은 선택지와 정답을 정해야 공개할 수 있습니다.';
  end if;
  if v_format = 'mc' then
    if v_version.correct_index < 0 or v_version.correct_index >= jsonb_array_length(v_version.options) then
      raise exception '정답 번호가 선택지 범위를 벗어났습니다.';
    end if;
    if (select count(distinct o) from jsonb_array_elements_text(v_version.options) o) <> jsonb_array_length(v_version.options) then
      raise exception '선택지에 같은 내용이 중복돼 있어 공개할 수 없습니다.';
    end if;
  end if;
  if v_scope in ('mock_exam', 'both') and coalesce(btrim(v_version.explanation_en), '') = '' then
    raise exception '모의고사용 문항은 영어 해설(explanation_en)이 있어야 공개할 수 있습니다.';
  end if;

  if v_version.figure is not null and v_version.figure->>'type' in ('geometry', 'coordinate_plane') then
    raise exception '옛 형식 그림(%)은 지원이 끝났습니다 — 재생성 필요. 표준 템플릿으로 다시 만든 뒤 공개하세요.', v_version.figure->>'type';
  end if;
  if v_version.figure is not null and v_version.figure->>'type' = 'image'
     and coalesce(trim(v_version.figure->>'alt'), '') = '' then
    raise exception '올린 그림에는 대체 설명(alt)이 필요합니다.';
  end if;
  if v_version.render_check is null then
    raise exception '표준 렌더링 검증 기록이 없습니다. 초안을 다시 저장해 검증을 거치세요.';
  end if;
  if coalesce((v_version.render_check->>'ok')::boolean, false) is not true then
    select string_agg(i->>'message', ' / ') into v_issue from jsonb_array_elements(coalesce(v_version.render_check->'issues', '[]'::jsonb)) i;
    raise exception '표준 렌더링 검증을 통과하지 못해 공개할 수 없습니다: %', coalesce(v_issue, '사유 없음');
  end if;
  if v_version.figure is not null
     and v_version.render_check->>'figure_hash' is distinct from md5(v_version.figure::text) then
    raise exception '검증 뒤 그림이 바뀌었습니다. 초안을 다시 저장해 검증을 거치세요.';
  end if;

  if v_status = 'draft' then
    update problem_versions
      set status = 'in_review', submitted_at = now(), submitted_by = p_actor_id
      where id = p_version_id;
  end if;
  perform public.publish_problem_version(p_version_id, p_actor_id);
  update problem_versions
    set review_kind = case
          when submitted_by is null or submitted_by = p_actor_id then 'self_confirmed'
          else 'separate_reviewer'
        end
    where id = p_version_id;
end;
$$;

-- ── 2. 공개 버전 불변 ──────────────────────────────────────────────────
create or replace function public.problem_versions_published_immutable()
returns trigger language plpgsql as $$
begin
  if old.status = 'published'
     and coalesce(current_setting('alton.version_content_edit', true), '') <> 'on'
     and (new.passage is distinct from old.passage
          or new.question is distinct from old.question
          or new.options is distinct from old.options
          or new.correct_index is distinct from old.correct_index
          or new.answers is distinct from old.answers
          or new.figure is distinct from old.figure
          or new.statements is distinct from old.statements
          or new.explanation is distinct from old.explanation
          -- 영어 해설은 비어 있던 곳을 채우는 것만 허용(백필). 이미 있는 값을 바꾸거나 지우는 것은 막는다.
          or (new.explanation_en is distinct from old.explanation_en and coalesce(btrim(old.explanation_en), '') <> '')) then
    raise exception '공개된 문항 버전의 내용은 직접 고칠 수 없습니다. 수정 초안을 만들어 다시 공개하세요.';
  end if;
  return new;
end $$;
drop trigger if exists problem_versions_published_immutable on public.problem_versions;
create trigger problem_versions_published_immutable before update on public.problem_versions
  for each row execute function public.problem_versions_published_immutable();

-- ── 3. 세트 항목 준비도 + 공개 게이트 ──────────────────────────────────
create or replace function public.mock_exam_set_item_issues(p_set_id uuid)
returns table (problem_id uuid, issue text)
language sql stable security definer set search_path = public as $$
  select i.problem_id,
    case
      when p.id is null or v.id is null then 'missing_problem_or_version'
      when p.status::text <> 'confirmed' then 'problem_not_confirmed'
      when p.archived_at is not null then 'problem_archived'
      when p.usage_scope not in ('mock_exam', 'both') then 'scope_general'
      when p.published_version_id is distinct from i.problem_version_id then 'version_not_current_published'
      when v.status <> 'published' then 'version_not_published'
      when coalesce(btrim(v.explanation_en), '') = '' then 'explanation_en_missing'
      when coalesce((v.render_check->>'ok')::boolean, false) is not true then 'render_check_not_ok'
      when (coalesce(v.passage, '') || ' ' || coalesce(v.question, '') || ' ' || coalesce(v.options::text, '') || ' ' || coalesce(v.statements::text, '')) ~ '[ㄱ-ㆎ가-힣]' then 'hangul_in_stem'
      when p.format::text = 'mc' and (v.options is null or v.correct_index is null or v.correct_index < 0 or v.correct_index >= jsonb_array_length(v.options)) then 'bad_answer_key'
    end as issue
  from mock_exam_set_items i
  left join problems p on p.id = i.problem_id
  left join problem_versions v on v.id = i.problem_version_id
  where i.exam_set_id = p_set_id;
$$;
revoke all on function public.mock_exam_set_item_issues(uuid) from public, anon, authenticated;
grant execute on function public.mock_exam_set_item_issues(uuid) to service_role;

create or replace function public._mock_exam_sets_publish_gate()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_bad text;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if new.format = 'mst' then
      if new.readiness_status <> 'ready' then
        raise exception '문항 구성이 완료되지 않은 4모듈 시험은 공개할 수 없습니다(readiness=%). 부족한 모듈을 먼저 채우세요.', new.readiness_status;
      end if;
      if not (mock_exam_validate_mst_set(new.id)->>'ready')::boolean then
        raise exception '4모듈 시험의 문항 구성이 청사진을 채우지 못해 공개할 수 없습니다.';
      end if;
    end if;
    -- 세션 설정 alton.skip_set_item_gate='on' 은 통합 테스트 픽스처 전용(psql PGOPTIONS) — 앱·PostgREST 경로에서는 켤 수 없다.
    if coalesce(current_setting('alton.skip_set_item_gate', true), '') <> 'on' then
      select string_agg(x.problem_id::text || ':' || x.issue, ', ') into v_bad
        from (select * from mock_exam_set_item_issues(new.id) where issue is not null limit 5) x;
    end if;
    if v_bad is not null then
      raise exception '문제가 있는 문항이 있어 세트를 공개할 수 없습니다: %', v_bad;
    end if;
  end if;
  return new;
end $$;

-- ── 4. 용도 되돌리기 차단 ──────────────────────────────────────────────
create or replace function public.problems_usage_scope_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.usage_scope = 'both' and old.usage_scope <> 'both' then
    raise exception '양쪽 용도(both)는 기존 문제 전용입니다. 일반용 또는 모의고사용으로만 분류할 수 있습니다.';
  end if;
  if new.usage_scope = 'general' and old.usage_scope <> 'general' and exists (
       select 1 from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id
        where i.problem_id = new.id and s.status in ('draft', 'published')) then
    raise exception '초안·공개 모의고사 세트에 들어 있는 문항은 일반용으로 바꿀 수 없습니다. 먼저 세트에서 빼거나 세트를 보관하세요.';
  end if;
  return new;
end $$;

-- ── 5. 선지 순서 교정 RPC(공개 버전 내용 수정의 유일한 합법 경로) ───────
create or replace function public.apply_problem_option_reorders(p_items jsonb, p_actor_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_batch uuid := gen_random_uuid();
  v_item jsonb; v_res jsonb := '[]'::jsonb;
  v_applied int := 0; v_already int := 0; v_skipped int := 0;
  v_vid uuid; v_ref text;
  cur record;
  v_exp jsonb; v_aft jsonb; v_perm int[]; v_n int; i int;
  v_status text; v_reason text;
begin
  if p_actor_id is null or not exists (select 1 from profiles where id = p_actor_id and role = 'admin') then
    raise exception '관리자만 선지 순서를 교정할 수 있습니다.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'p_items 는 배열이어야 합니다.'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception '한 번에 100건까지만 처리할 수 있습니다.'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_status := null; v_reason := null;
    begin
      v_vid := (v_item->>'version_id')::uuid;
    exception when others then
      v_res := v_res || jsonb_build_object('version_id', v_item->>'version_id', 'status', 'skipped', 'reason', 'bad_version_id');
      v_skipped := v_skipped + 1; continue;
    end;
    v_exp := v_item->'expected'; v_aft := v_item->'after';

    -- 고정 순서(version id) 가 아니라 입력 순서로 잠근다 — 한 항목씩 독립 처리, 동시 실행은 행 잠금으로 직렬화.
    select * into cur from problem_versions where id = v_vid for update;
    if not found then
      v_status := 'skipped'; v_reason := 'not_found';
    elsif v_exp is null or v_aft is null or jsonb_typeof(v_exp->'options') <> 'array' or jsonb_typeof(v_aft->'options') <> 'array' then
      v_status := 'skipped'; v_reason := 'bad_payload';
    else
      v_n := jsonb_array_length(v_exp->'options');
      begin
        select coalesce(array_agg(x::int order by ord), '{}') into v_perm from jsonb_array_elements_text(coalesce(v_item->'perm', '[]'::jsonb)) with ordinality t(x, ord);
      exception when others then v_perm := '{}'; end;

      -- (a) 이미 after 와 같으면 멱등 성공
      if cur.options is not distinct from (v_aft->'options')
         and cur.correct_index is not distinct from (v_aft->>'correct_index')::int
         and cur.explanation is not distinct from (v_aft->>'explanation')
         and cur.explanation_en is not distinct from (v_aft->>'explanation_en') then
        v_status := 'already';
      -- (b) 현재가 expected 와 다르면 stale
      elsif cur.options is distinct from (v_exp->'options')
         or cur.correct_index is distinct from (v_exp->>'correct_index')::int
         or cur.explanation is distinct from (v_exp->>'explanation')
         or cur.explanation_en is distinct from (v_exp->>'explanation_en') then
        v_status := 'skipped'; v_reason := 'stale';
      -- (c) 순열 검증: perm 은 0..n-1 의 순열, after.options[i] = expected.options[perm[i]],
      --     정답 선택지 '내용'이 같고 after.correct_index 가 그 위치
      elsif v_n < 2 or coalesce(array_length(v_perm, 1), 0) <> v_n
         or jsonb_array_length(v_aft->'options') <> v_n
         or (select count(distinct p) from unnest(v_perm) p where p between 0 and v_n - 1) <> v_n then
        v_status := 'skipped'; v_reason := 'bad_perm';
      else
        v_reason := null;
        for i in 0 .. v_n - 1 loop
          if (v_aft->'options')->i is distinct from (v_exp->'options')->v_perm[i + 1] then v_reason := 'options_not_permutation'; exit; end if;
        end loop;
        if v_reason is null then
          if (v_aft->>'correct_index') is null
             or (v_aft->'options')->((v_aft->>'correct_index')::int) is distinct from (v_exp->'options')->((v_exp->>'correct_index')::int) then
            v_reason := 'correct_content_changed';
          end if;
        end if;
        if v_reason is not null then
          v_status := 'skipped';
        else
          v_ref := public.problem_option_reorder_referenced(v_vid);
          if v_ref is not null then
            v_status := 'skipped'; v_reason := 'referenced:' || v_ref;
          else
            insert into problem_option_reorders (problem_version_id, kind, batch_id, perm, before_content, after_content, method, verification, applied_by)
            values (v_vid, 'apply', v_batch, v_perm,
                    jsonb_build_object('options', cur.options, 'correct_index', cur.correct_index, 'explanation', cur.explanation, 'explanation_en', cur.explanation_en),
                    jsonb_build_object('options', v_aft->'options', 'correct_index', (v_aft->>'correct_index')::int, 'explanation', v_aft->>'explanation', 'explanation_en', v_aft->>'explanation_en'),
                    nullif(v_item->>'method', ''), nullif(v_item->>'verification', ''), p_actor_id);
            perform set_config('alton.version_content_edit', 'on', true);
            update problem_versions
               set options = v_aft->'options',
                   correct_index = (v_aft->>'correct_index')::int,
                   explanation = v_aft->>'explanation',
                   explanation_en = v_aft->>'explanation_en',
                   quality = jsonb_set(coalesce(quality, '{}'::jsonb), '{positionFix}', jsonb_build_object('batchId', v_batch, 'appliedAt', now()), true)
             where id = v_vid;
            perform set_config('alton.version_content_edit', 'off', true);
            v_status := 'applied';
          end if;
        end if;
      end if;
    end if;

    if v_status = 'applied' then v_applied := v_applied + 1;
    elsif v_status = 'already' then v_already := v_already + 1;
    else v_skipped := v_skipped + 1; end if;
    v_res := v_res || jsonb_strip_nulls(jsonb_build_object('version_id', v_vid, 'status', v_status, 'reason', v_reason));
  end loop;

  return jsonb_build_object('batchId', v_batch, 'applied', v_applied, 'already', v_already, 'skipped', v_skipped, 'results', v_res);
end $$;
revoke all on function public.apply_problem_option_reorders(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.apply_problem_option_reorders(jsonb, uuid) to service_role;

-- ── 4. 되돌리기 ─────────────────────────────────────────────────────────
create or replace function public.revert_problem_option_reorder(p_reorder_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  rec record; cur record; v_ref text; v_batch uuid := gen_random_uuid();
begin
  if p_actor_id is null or not exists (select 1 from profiles where id = p_actor_id and role = 'admin') then
    raise exception '관리자만 선지 순서 교정을 되돌릴 수 있습니다.';
  end if;
  select * into rec from problem_option_reorders where id = p_reorder_id and kind = 'apply';
  if not found then raise exception '되돌릴 교정 기록을 찾을 수 없습니다.'; end if;
  if exists (select 1 from problem_option_reorders where reverts_id = p_reorder_id) then
    return jsonb_build_object('status', 'already');
  end if;
  select * into cur from problem_versions where id = rec.problem_version_id for update;
  if not found then raise exception '문항 버전을 찾을 수 없습니다.'; end if;
  if cur.options is distinct from rec.after_content->'options'
     or cur.correct_index is distinct from (rec.after_content->>'correct_index')::int
     or cur.explanation is distinct from rec.after_content->>'explanation'
     or cur.explanation_en is distinct from rec.after_content->>'explanation_en' then
    return jsonb_build_object('status', 'skipped', 'reason', 'changed_since');
  end if;
  v_ref := public.problem_option_reorder_referenced(rec.problem_version_id);
  if v_ref is not null then
    return jsonb_build_object('status', 'skipped', 'reason', 'referenced:' || v_ref);
  end if;
  insert into problem_option_reorders (problem_version_id, kind, reverts_id, batch_id, perm, before_content, after_content, method, applied_by)
  values (rec.problem_version_id, 'revert', p_reorder_id, v_batch, null, rec.after_content, rec.before_content, 'revert', p_actor_id);
  perform set_config('alton.version_content_edit', 'on', true);
  update problem_versions
     set options = rec.before_content->'options',
         correct_index = (rec.before_content->>'correct_index')::int,
         explanation = rec.before_content->>'explanation',
         explanation_en = rec.before_content->>'explanation_en',
         quality = coalesce(quality, '{}'::jsonb) - 'positionFix'
   where id = rec.problem_version_id;
  perform set_config('alton.version_content_edit', 'off', true);
  return jsonb_build_object('status', 'reverted');
end $$;
revoke all on function public.revert_problem_option_reorder(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revert_problem_option_reorder(uuid, uuid) to service_role;
