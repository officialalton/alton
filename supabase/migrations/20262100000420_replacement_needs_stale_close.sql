-- 대체 문항 필요 큐 정리(2026-10-08): 활성 세트에 없는 오래된 항목 자동 종료 + 요약은 활성 세트 칸만 경보로 센다.
--  - 세트가 보관(archived)되거나 문항이 더는 어떤 초안·공개 세트에도 없으면 열린 need 는 status 'cancelled'
--    (resolution 'set_replaced' = 세트가 새 버전으로 교체·보관됨 / 'not_in_active_set' = 활성 세트에 그 문항 없음)로 닫는다. 삭제 없음(이력 보존).
--  - 세트 보관 시점(트리거)과 problem_replacement_retry_open 호출 시 모두 닫는다(자기 치유).
--  - 일반 문항 need(in_mock_set=false, 세트 없음)는 세트 소속이 아니라는 이유만으로 닫지 않는다. 경보 건수에서 분리해 bankLevel 로 보이고,
--    같은 과목(프로그램)·영역·기술·난이도·용도의 사용 가능한 공개 문항 재고(stock)를 함께 보여준다.
--  - 일회성 정리: 진단된 두 행(id 접두 e0dc92eb·a7619b63)만, 조건을 다시 확인한 뒤 이력을 남기고 닫는다.
-- 되돌리기: 트리거·함수 삭제, 요약/재시도 RPC 를 20261940000001 정의로 복원. 닫힌 행은 status='open' 으로 되돌리면 된다(resolution 값 확인).

alter table public.problem_replacement_needs drop constraint if exists problem_replacement_needs_resolution_check;
alter table public.problem_replacement_needs add constraint problem_replacement_needs_resolution_check
  check (resolution in ('auto_replaced', 'verdict_reverted', 'set_replaced', 'not_in_active_set', 'bank_stock_satisfied'));

-- 활성(초안·공개, 미보관) 세트 칸에 그 문항이 아직 있는가.
create or replace function public._problem_replacement_need_active(n public.problem_replacement_needs) returns boolean
language sql stable security definer set search_path = public as $$
  select n.in_mock_set and exists (
    select 1 from mock_exam_set_items x join mock_exam_sets s on s.id = x.exam_set_id
     where x.problem_id = n.problem_id and s.archived_at is null and s.status in ('draft', 'published')
       and (n.exam_set_id is null or s.id = n.exam_set_id));
$$;
revoke execute on function public._problem_replacement_need_active(public.problem_replacement_needs) from public, anon, authenticated;

-- 세트 칸 need 중 활성 세트에 없는 열린 행을 닫는다(p_set_id 가 있으면 그 세트의 행만). 닫은 건수 반환. 멱등.
create or replace function public._problem_replacement_close_stale(p_set_id uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with stale as (
    select n.id,
           case when s.id is null or s.archived_at is not null or s.status = 'archived' then 'set_replaced' else 'not_in_active_set' end as why
      from problem_replacement_needs n
      left join mock_exam_sets s on s.id = n.exam_set_id
     where n.status = 'open' and n.in_mock_set
       and (p_set_id is null or n.exam_set_id = p_set_id)
       and not public._problem_replacement_need_active(n)
     for update of n)
  update problem_replacement_needs n
     set status = 'cancelled', resolution = stale.why, open_reason = null, linked_at = now()
    from stale where n.id = stale.id;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public._problem_replacement_close_stale(uuid) from public, anon, authenticated;

create or replace function public._mock_exam_set_archived_close_needs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.archived_at is not null or new.status = 'archived' then
    perform public._problem_replacement_close_stale(new.id);
  end if;
  return new;
end $$;
revoke execute on function public._mock_exam_set_archived_close_needs() from public, anon, authenticated;
drop trigger if exists mock_exam_sets_archived_close_needs on public.mock_exam_sets;
create trigger mock_exam_sets_archived_close_needs after update of status, archived_at on public.mock_exam_sets
  for each row when (new.archived_at is not null or new.status = 'archived')
  execute function public._mock_exam_set_archived_close_needs();

-- 일반 문항 need 의 재고: 같은 프로그램(exam_system)·영역·기술·난이도·용도에서 확정·미보관·공개 버전이 있고 어떤 활성(초안·공개) 세트에도 배정되지 않은 문항 수.
create or replace function public._problem_replacement_bank_stock(n public.problem_replacement_needs) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
    from problems p
    join problem_versions v on v.id = p.published_version_id and v.status = 'published'
   where p.archived_at is null and p.status = 'confirmed' and not p.error_review_needed
     and p.exam_system is not distinct from (select exam_system from problems where id = n.problem_id)
     and p.sat_domain is not distinct from n.sat_domain and p.skill_code is not distinct from n.skill_code
     and v.difficulty is not distinct from n.difficulty
     and (case n.usage_scope when 'mock_exam' then p.usage_scope in ('mock_exam', 'both')
                             when 'general' then p.usage_scope in ('general', 'both')
                             else p.usage_scope = n.usage_scope end)
     and p.id <> n.problem_id
     and not exists (select 1 from mock_exam_set_items x join mock_exam_sets s on s.id = x.exam_set_id
                      where x.problem_id = p.id and s.archived_at is null and s.status in ('draft', 'published'));
$$;
revoke execute on function public._problem_replacement_bank_stock(public.problem_replacement_needs) from public, anon, authenticated;

-- 요약: 경보(openTotal·openInMockSet·cells·sets·items)는 활성 세트 칸만. 일반 문항(세트 없음)은 bankLevel 로 분리.
create or replace function public.problem_replacement_need_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  return (
    with open_needs as (
      select n.*, public._problem_replacement_need_active(n) as active, case when not n.in_mock_set then public._problem_replacement_bank_stock(n) end as bank_stock from problem_replacement_needs n where n.status = 'open'
    ), act as (select * from open_needs where active), bank as (select * from open_needs where not in_mock_set)
    select jsonb_build_object(
      'openTotal', (select count(*) from act),
      'openInMockSet', (select count(*) from act),
      'openBankLevel', (select count(*) from bank),
      'staleOpen', (select count(*) from open_needs where in_mock_set and not active),
      'autoReplacedTotal', (select count(*) from mock_exam_item_replacements),
      'cells', coalesce((
        select jsonb_agg(jsonb_build_object('satDomain', c.sat_domain, 'skillCode', c.skill_code, 'difficulty', c.difficulty,
          'moduleKey', c.module_key, 'usageScope', c.usage_scope, 'inMockSet', true, 'openCount', c.n)
          order by c.n desc, c.sat_domain, c.skill_code)
        from (select sat_domain, skill_code, difficulty, module_key, usage_scope, count(*) n from act group by 1, 2, 3, 4, 5) c), '[]'::jsonb),
      'bankCells', coalesce((
        select jsonb_agg(jsonb_build_object('satDomain', c.sat_domain, 'skillCode', c.skill_code, 'difficulty', c.difficulty,
          'usageScope', c.usage_scope, 'openCount', c.n, 'stock', c.stock) order by c.n desc, c.sat_domain, c.skill_code)
        from (select sat_domain, skill_code, difficulty, usage_scope, count(*) n, max(bank_stock) stock from bank group by 1, 2, 3, 4) c), '[]'::jsonb),
      'sets', coalesce((
        select jsonb_agg(jsonb_build_object('examSetId', x.exam_set_id, 'name', s.name, 'versionNo', s.version_no, 'status', s.status,
          'openCount', x.n, 'startedCount', x.n_started, 'noSpareCount', x.n_nospare) order by x.n desc, s.name)
        from (select exam_set_id, count(*) n, count(*) filter (where open_reason = 'set_started') n_started, count(*) filter (where open_reason = 'no_spare') n_nospare
                from act where exam_set_id is not null group by exam_set_id) x
        join mock_exam_sets s on s.id = x.exam_set_id), '[]'::jsonb),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object('id', n.id, 'problemId', n.problem_id, 'moduleKey', n.module_key, 'route', n.route, 'difficulty', n.difficulty,
          'satDomain', n.sat_domain, 'skillCode', n.skill_code, 'usageScope', n.usage_scope, 'inMockSet', n.in_mock_set,
          'openReason', n.open_reason, 'createdAt', n.created_at, 'examSetId', n.exam_set_id, 'setName', s.name, 'setVersionNo', s.version_no,
          'setStatus', s.status) order by n.created_at)
        from (select * from act order by created_at limit 100) n left join mock_exam_sets s on s.id = n.exam_set_id), '[]'::jsonb),
      'replacements', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.id, 'examSetId', r.exam_set_id, 'examSetName', s.name, 'oldProblemId', r.old_problem_id,
          'newProblemId', r.new_problem_id, 'moduleKey', r.module_key, 'route', r.route, 'difficulty', r.difficulty, 'satDomain', r.sat_domain,
          'skillCode', r.skill_code, 'createdAt', r.created_at) order by r.created_at desc)
        from (select * from mock_exam_item_replacements order by created_at desc limit 50) r
        left join mock_exam_sets s on s.id = r.exam_set_id), '[]'::jsonb)));
end $$;
revoke execute on function public.problem_replacement_need_summary() from public, anon;
grant execute on function public.problem_replacement_need_summary() to authenticated;

-- 재시도: 먼저 오래된 항목을 닫고(자기 치유) 나머지를 자동 교체한다. 반환에 closedStale 추가(기존 키 유지).
create or replace function public.problem_replacement_retry_open() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_need uuid; v_res text; v_replaced int := 0; v_noSpare int := 0; v_started int := 0; v_closed int;
begin
  if not is_admin() then raise exception '관리자만 실행할 수 있습니다.'; end if;
  v_closed := public._problem_replacement_close_stale(null);
  for v_need in select id from problem_replacement_needs where status = 'open' and in_mock_set order by created_at, id loop
    v_res := _problem_error_try_replace_need(v_need);
    if v_res = 'replaced' then v_replaced := v_replaced + 1;
    elsif v_res = 'no_spare' then v_noSpare := v_noSpare + 1;
    elsif v_res = 'set_started' then v_started := v_started + 1; end if;
  end loop;
  return jsonb_build_object('replaced', v_replaced, 'noSpare', v_noSpare, 'setStarted', v_started, 'closedStale', v_closed);
end $$;
revoke execute on function public.problem_replacement_retry_open() from public, anon;
grant execute on function public.problem_replacement_retry_open() to authenticated;

-- 일회성 데이터 정정(진단된 두 행만, id 접두로 지정 — 삭제 없이 resolution·시각을 남긴다).
--  e0dc92eb: 보관(교체)된 세트의 set_started need → set_replaced (세트가 보관 상태일 때만).
--  a7619b63: 세트에 없는 일반 문항 need → 같은 과목·영역·기술·난이도·용도의 사용 가능 재고가 필요 건수 이상일 때만 bank_stock_satisfied.
update public.problem_replacement_needs n
   set status = 'cancelled', resolution = 'set_replaced', open_reason = null, linked_at = now()
 where n.status = 'open' and n.in_mock_set and n.id::text like 'e0dc92eb%'
   and exists (select 1 from mock_exam_sets s where s.id = n.exam_set_id and (s.archived_at is not null or s.status = 'archived'));
update public.problem_replacement_needs n
   set status = 'cancelled', resolution = 'bank_stock_satisfied', open_reason = null, linked_at = now()
 where n.status = 'open' and not n.in_mock_set and n.id::text like 'a7619b63%'
   and public._problem_replacement_bank_stock(n) >= 1;
