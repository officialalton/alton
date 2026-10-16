-- 문항 선지 순서 교정(정답 위치 편향 제거) — 제자리 갱신 RPC + 되돌리기 (2026-10-01)
--
-- 배경: 기존 문항의 정답 위치가 한쪽으로 쏠려 있다(RW A 53%·B 31%·C 12%·D 4%, Math 40/34/22/4%).
-- 선지 순서만 바꾸고(정답 내용·오답 내용은 그대로) 해설의 선택지 참조를 새 순서로 맞춘 결과를 반영한다.
--
-- 안전 설계:
--   * apply_problem_option_reorders(): 정의자 RPC, service_role 만 execute, 내부에서 관리자 재검사. 한 호출 최대 100건.
--   * 항목마다 (1) 현재 내용이 expected 와 같을 때만 쓴다(stale 방지·멱등: 이미 after 와 같으면 'already'),
--     (2) after 선지가 expected 선지의 순열(perm)인지, 정답 선택지의 '내용'이 같은지 DB 가 직접 검증한다,
--     (3) 이미 사용된 버전은 건드리지 않는다 — 세트 항목·수업 매니페스트·과제·풀이판·오류 신고·판정·채점 조정·단원 템플릿·
--         준비 선택·homework_batches 가 이 버전을 참조하면 'referenced' 로 건너뛴다(학생이 고른 번호와 저장된 정오가
--         어긋나는 일을 막는다).
--   * 이력: problem_option_reorders(append-only — 수정·삭제·truncate 차단). before/after 전체와 perm·실행자·배치를 남긴다.
--   * revert_problem_option_reorder(): 현재 내용이 그 적용의 after 와 같고 아직 참조가 없을 때만 before 로 되돌리고
--     'revert' 행을 추가한다(원래 행은 그대로).
--   * 본문(passage/question)·난이도·상태·버전 번호·공개 시각은 바꾸지 않는다. options·correct_index·explanation·
--     explanation_en 과 quality.positionFix 표식만 바꾼다.
--
-- 영향: 테이블 1개, 함수 3개 추가(additive). 기존 데이터는 RPC 를 실행해야만 바뀐다.
-- 되돌리기: drop function apply_problem_option_reorders / revert_problem_option_reorder / problem_option_reorder_referenced;
--           drop table problem_option_reorders.

-- ── 1. 이력(append-only) ───────────────────────────────────────────────
create table if not exists public.problem_option_reorders (
  id uuid primary key default gen_random_uuid(),
  problem_version_id uuid not null references public.problem_versions(id),
  kind text not null check (kind in ('apply', 'revert')),
  reverts_id uuid references public.problem_option_reorders(id),
  batch_id uuid not null,
  perm int[],
  before_content jsonb not null,
  after_content jsonb not null,
  method text,
  verification text,
  applied_by uuid not null,
  applied_at timestamptz not null default now()
);
create index if not exists problem_option_reorders_version_idx on public.problem_option_reorders (problem_version_id, applied_at desc);
create unique index if not exists problem_option_reorders_one_revert_idx on public.problem_option_reorders (reverts_id) where reverts_id is not null;
alter table public.problem_option_reorders enable row level security;
revoke all on public.problem_option_reorders from public, anon, authenticated;
grant select, insert on public.problem_option_reorders to service_role;

create or replace function public.problem_option_reorders_immutable()
returns trigger language plpgsql as $$
begin
  raise exception '선지 순서 교정 기록은 수정하거나 삭제할 수 없습니다.';
end $$;
drop trigger if exists problem_option_reorders_immutable on public.problem_option_reorders;
create trigger problem_option_reorders_immutable before update or delete on public.problem_option_reorders
  for each row execute function public.problem_option_reorders_immutable();
drop trigger if exists problem_option_reorders_no_truncate on public.problem_option_reorders;
create trigger problem_option_reorders_no_truncate before truncate on public.problem_option_reorders
  for each statement execute function public.problem_option_reorders_immutable();

-- ── 2. 참조 여부 ────────────────────────────────────────────────────────
-- 이 버전을 본문 복사 없이 id 로 참조하는 모든 곳(published_version_id 는 '현재 공개본' 포인터라 제외).
create or replace function public.problem_option_reorder_referenced(p_version_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_id text := p_version_id::text;
begin
  if exists (select 1 from mock_exam_set_items where problem_version_id = p_version_id) then return 'mock_exam_set_items'; end if;
  if exists (select 1 from session_content_manifest where problem_version_id = p_version_id) then return 'session_content_manifest'; end if;
  if exists (select 1 from session_homework_items where problem_version_id = p_version_id) then return 'session_homework_items'; end if;
  if exists (select 1 from session_problem_work where problem_version_id = p_version_id) then return 'session_problem_work'; end if;
  if exists (select 1 from session_prepared_selection_content_items where problem_version_id = p_version_id) then return 'session_prepared_selection_content_items'; end if;
  if exists (select 1 from problem_error_reports where problem_version_id = p_version_id) then return 'problem_error_reports'; end if;
  if exists (select 1 from problem_error_verdicts where problem_version_id = p_version_id) then return 'problem_error_verdicts'; end if;
  if exists (select 1 from mock_exam_answer_adjustments where problem_version_id = p_version_id) then return 'mock_exam_answer_adjustments'; end if;
  if exists (select 1 from curriculum_unit_prep_items where problem_version_id = p_version_id) then return 'curriculum_unit_prep_items'; end if;
  if exists (select 1 from subject_template_unit_problems where problem_version_id = p_version_id) then return 'subject_template_unit_problems'; end if;
  if exists (select 1 from teacher_curriculum_template_unit_problems where problem_version_id = p_version_id) then return 'teacher_curriculum_template_unit_problems'; end if;
  if exists (select 1 from homework_batches where items::text like '%' || v_id || '%') then return 'homework_batches'; end if;
  return null;
end $$;
revoke all on function public.problem_option_reorder_referenced(uuid) from public, anon, authenticated;
grant execute on function public.problem_option_reorder_referenced(uuid) to service_role;

-- ── 3. 적용 ─────────────────────────────────────────────────────────────
-- p_items: [{version_id, expected:{options,correct_index,explanation,explanation_en}, after:{...같은 모양}, perm:[int..], method?, verification?}]
-- perm[i] = 새 위치 i 의 선택지가 원래 몇 번째였는지(0 기반).
-- 반환: {applied, already, skipped, results:[{version_id, status, reason?}]}
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
            update problem_versions
               set options = v_aft->'options',
                   correct_index = (v_aft->>'correct_index')::int,
                   explanation = v_aft->>'explanation',
                   explanation_en = v_aft->>'explanation_en',
                   quality = jsonb_set(coalesce(quality, '{}'::jsonb), '{positionFix}', jsonb_build_object('batchId', v_batch, 'appliedAt', now()), true)
             where id = v_vid;
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
  update problem_versions
     set options = rec.before_content->'options',
         correct_index = (rec.before_content->>'correct_index')::int,
         explanation = rec.before_content->>'explanation',
         explanation_en = rec.before_content->>'explanation_en',
         quality = coalesce(quality, '{}'::jsonb) - 'positionFix'
   where id = rec.problem_version_id;
  return jsonb_build_object('status', 'reverted');
end $$;
revoke all on function public.revert_problem_option_reorder(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revert_problem_option_reorder(uuid, uuid) to service_role;
