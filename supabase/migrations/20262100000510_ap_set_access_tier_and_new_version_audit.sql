-- 2026-10-12 — AP 세트 공개 범위(무료/튜터링) 관리 + AB/AP 새 버전 화면 감사 이력(additive, 재실행 안전).
-- 1) mock_exam_sets.planned_access_tier: 초안은 DB 가드(mock_exam_sets_guard_access_tier) 때문에 'free' 로 저장할 수 없으므로 "공개 때 적용할 범위"를 따로 적어 둔다.
--    mock_exam_publish_set 은 (이전 공개본 범위 → 계획 범위 → 초안 값) 순으로 정한다. 이전 동작(이전 공개본 승계)은 그대로.
-- 2) ap_admin_set_access_tier: AP 세트의 공개 범위만 바꾸는 가드된 RPC(내용·문항·응시·답안·결과는 건드리지 않는다). 공개 중인 세트는 access_tier 를 바꾸고(무료 가드 트리거 적용),
--    초안은 planned_access_tier 만 바꾼다. 보관 세트는 거부.
-- 3) ap_stock_admin_runs.action 허용 값에 새 버전·범위 변경 작업을 추가한다(체크 제약 교체: 값 추가만).
alter table mock_exam_sets add column if not exists planned_access_tier text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mock_exam_sets_planned_access_tier_check') then
    alter table mock_exam_sets add constraint mock_exam_sets_planned_access_tier_check check (planned_access_tier is null or planned_access_tier in ('free', 'tutoring'));
  end if;
end $$;
comment on column mock_exam_sets.planned_access_tier is '초안의 공개 시 적용 범위(free|tutoring). 공개 RPC 가 이전 공개본 범위가 없을 때 사용. 초안은 free 로 저장할 수 없어 별도 컬럼.';

create or replace function public.mock_exam_publish_set(p_set_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_t mock_exam_sets%rowtype; v_archived uuid[]; v_tier text;
begin
  if p_actor_id is null or not exists (select 1 from profiles where id = p_actor_id and role = 'admin') then
    raise exception 'Only an admin can publish an exam set.';
  end if;
  select * into v_t from mock_exam_sets where id = p_set_id for update;
  if v_t.id is null then raise exception 'Exam set not found.'; end if;
  if v_t.status <> 'draft' then raise exception 'Only a draft set can be published.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mock_exam_new_version:' || v_t.set_group_id::text, 0));
  if exists (select 1 from mock_exam_sets where set_group_id = v_t.set_group_id and status = 'published' and version_no > v_t.version_no) then
    raise exception 'A newer version of this exam is already published.';
  end if;
  -- 공개 범위: 이전 공개본 → 초안에 적어 둔 계획 범위 → 초안 값.
  select access_tier into v_tier from mock_exam_sets where set_group_id = v_t.set_group_id and status = 'published' order by version_no desc limit 1;
  v_tier := coalesce(v_tier, v_t.planned_access_tier, v_t.access_tier);
  with a as (
    update mock_exam_sets set status = 'archived', archived_at = now()
     where set_group_id = v_t.set_group_id and status = 'published' returning id)
  select coalesce(array_agg(id), '{}') into v_archived from a;
  update mock_exam_sets set status = 'published', published_at = now(), published_by = p_actor_id, access_tier = v_tier where id = p_set_id;
  return jsonb_build_object('publishedSetId', p_set_id, 'archivedSetIds', to_jsonb(v_archived));
end $$;
revoke all on function public.mock_exam_publish_set(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mock_exam_publish_set(uuid, uuid) to service_role;

create or replace function public.ap_admin_set_access_tier(p_set_id uuid, p_tier text, p_actor_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_t mock_exam_sets%rowtype; v_prev text;
begin
  if p_actor_id is null or not exists (select 1 from profiles where id = p_actor_id and role = 'admin') then
    raise exception 'Only an admin can change an exam set access tier.';
  end if;
  if p_tier is null or p_tier not in ('free', 'tutoring') then raise exception 'Invalid access tier.'; end if;
  select * into v_t from mock_exam_sets where id = p_set_id for update;
  if v_t.id is null then raise exception 'Exam set not found.'; end if;
  if v_t.exam_program <> 'ap' then raise exception 'Only AP exam sets are supported.'; end if;
  if v_t.status = 'published' then
    v_prev := v_t.access_tier;
    -- 무료 지정 가드(트리거)가 공개·보관 아님 조건을 다시 검사한다. 이 UPDATE 는 access_tier 한 컬럼만 바꾼다.
    update mock_exam_sets set access_tier = p_tier where id = p_set_id;
  elsif v_t.status = 'draft' then
    v_prev := coalesce(v_t.planned_access_tier, v_t.access_tier);
    update mock_exam_sets set planned_access_tier = p_tier where id = p_set_id;
  else
    raise exception 'Archived sets cannot change access tier.';
  end if;
  return jsonb_build_object('setId', p_set_id, 'status', v_t.status, 'previousTier', v_prev, 'tier', p_tier);
end $$;
revoke all on function public.ap_admin_set_access_tier(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.ap_admin_set_access_tier(uuid, text, uuid) to service_role;

alter table ap_stock_admin_runs drop constraint if exists ap_stock_admin_runs_action_check;
alter table ap_stock_admin_runs add constraint ap_stock_admin_runs_action_check
  check (action in ('load_check', 'import', 'render_verify', 'screen_verify', 'convert', 'assemble_draft', 'new_version_preview', 'new_version_draft', 'new_version_publish', 'set_access_tier'));
