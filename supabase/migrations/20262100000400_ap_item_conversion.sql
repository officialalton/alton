-- AP 후보(ap_candidate_items) → 문제은행(problems/problem_versions) 변환 경로 + 용도(purpose) 분리 (2026-10-09)
--
-- 오너 확정: (1) 게시 조건 = 최신 자동 게이트 통과 + 그림 렌더 검증 + 학생 화면 검증(review_env_ready). 전문가 검수는 게시 후.
--            (2) 모든 AP 문항은 용도가 정확히 하나다: 'mock_exam'(모의고사 층) 또는 'lesson'(수업·과제). 변환 시점에 정해지고 바뀌지 않으며 공유되지 않는다.
--
-- 추가만 한다(기존 SAT 데이터·동작 변화 0). 이미 공개된 문항을 소급해 내리지 않는다.
--   · problems: ap_candidate_key / ap_item_index (후보 연결), AP 용도 제약(general|mock_exam만), 용도·연결 불변 트리거
--   · AP 문제는 반드시 ap_create_bank_problem 으로만 만들 수 있다(후보 review_env_ready 검사). create_bank_problem 우회 차단.
--   · AP 문제 버전은 후보가 여전히 review_env_ready 일 때만 공개된다.
--   · ap_candidate_items: purpose / 검증 증거 / 변환 기록, ap_candidate_problems(후보↔문제 1:N: 세트형 MC 는 문항마다 문제)
--   · RPC(service_role 전용): ap_set_verification, ap_create_bank_problem, ap_finalize_conversion, ap_attach_new_version
--   · 용도별 재고 목표·집계 뷰
-- 용도 값 ↔ problems.usage_scope: mock_exam → 'mock_exam', lesson → 'general'(기존 수업·과제 용도). 기존 세트·과제 게이트가 그대로 적용된다.
-- 되돌리기: 트리거 problems_ap_conversion_guard / problems_ap_immutable / problem_versions_ap_publish_guard / ap_candidate_purpose_immutable 삭제,
--           RPC·뷰·테이블 ap_candidate_problems·ap_stock_purpose_targets 삭제, 컬럼 drop.

-- ── 1. 컬럼 ────────────────────────────────────────────────────────────
alter table public.problems add column if not exists ap_candidate_key text;
alter table public.problems add column if not exists ap_item_index int not null default 0;
create unique index if not exists problems_ap_candidate_item_uq on public.problems (ap_candidate_key, ap_item_index) where ap_candidate_key is not null;
comment on column public.problems.ap_candidate_key is 'AP 후보 연결(ap_candidate_items.candidate_key). exam_system=ap 문제는 반드시 값이 있다.';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'problems_ap_purpose_check') then
    -- AP 문항의 용도는 둘 중 하나뿐(NOT VALID: 새로 쓰이거나 바뀌는 행에만 강제).
    alter table public.problems add constraint problems_ap_purpose_check
      check (exam_system is distinct from 'ap' or usage_scope in ('general', 'mock_exam')) not valid;
  end if;
end $$;

alter table public.ap_candidate_items add column if not exists purpose text;
alter table public.ap_candidate_items add column if not exists render_evidence jsonb;
alter table public.ap_candidate_items add column if not exists screen_evidence jsonb;
alter table public.ap_candidate_items add column if not exists converted_at timestamptz;
alter table public.ap_candidate_items add column if not exists converted_by uuid references public.profiles(id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ap_candidate_items_purpose_check') then
    alter table public.ap_candidate_items add constraint ap_candidate_items_purpose_check check (purpose is null or purpose in ('mock_exam', 'lesson'));
  end if;
end $$;
comment on column public.ap_candidate_items.purpose is '용도(mock_exam|lesson). 변환 때 정해지고 바뀌지 않는다. 후보는 한 용도로만 쓰인다.';

create table if not exists public.ap_candidate_problems (
  candidate_key text not null references public.ap_candidate_items(candidate_key) on delete cascade,
  item_index int not null check (item_index >= 0),
  problem_id uuid not null references public.problems(id),
  problem_version_id uuid not null references public.problem_versions(id),
  created_at timestamptz not null default now(),
  primary key (candidate_key, item_index),
  unique (problem_id)
);
alter table public.ap_candidate_problems enable row level security;
drop policy if exists "관리자만 조회·쓰기" on public.ap_candidate_problems;
create policy "관리자만 조회·쓰기" on public.ap_candidate_problems for all using (is_admin()) with check (is_admin());

-- ── 2. 가드 ────────────────────────────────────────────────────────────
create or replace function public.ap_candidate_purpose_immutable() returns trigger
language plpgsql as $$
begin
  if old.purpose is not null and new.purpose is distinct from old.purpose then
    raise exception 'The purpose of an AP item is fixed at conversion and cannot be changed or shared.';
  end if;
  return new;
end $$;
drop trigger if exists ap_candidate_purpose_immutable on public.ap_candidate_items;
create trigger ap_candidate_purpose_immutable before update of purpose on public.ap_candidate_items
  for each row execute function public.ap_candidate_purpose_immutable();

-- AP 문제는 review_env_ready 후보에서만 만들 수 있다(어떤 경로로 INSERT 해도).
create or replace function public.problems_ap_conversion_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare c ap_candidate_items%rowtype;
begin
  if new.exam_system is distinct from 'ap' then
    if new.ap_candidate_key is not null then raise exception 'Only AP problems can reference an AP candidate.'; end if;
    return new;
  end if;
  if new.ap_candidate_key is null then
    raise exception 'AP problems can only be created from a review-ready AP candidate (use ap_create_bank_problem).';
  end if;
  select * into c from ap_candidate_items where candidate_key = new.ap_candidate_key;
  if c.id is null then raise exception 'Unknown AP candidate.'; end if;
  if not c.is_current or not c.review_env_ready then
    raise exception 'AP candidate % is not review-env ready (auto gate passed + render verified + screen verified required).', c.candidate_key;
  end if;
  if new.ap_subject is distinct from c.ap_subject_code then raise exception 'AP subject does not match the candidate.'; end if;
  if c.purpose is not null and new.usage_scope is distinct from (case c.purpose when 'mock_exam' then 'mock_exam' else 'general' end) then
    raise exception 'The purpose of this AP candidate is already fixed as %.', c.purpose;
  end if;
  return new;
end $$;
drop trigger if exists problems_ap_conversion_guard on public.problems;
create trigger problems_ap_conversion_guard before insert on public.problems
  for each row execute function public.problems_ap_conversion_guard();

create or replace function public.problems_ap_immutable() returns trigger
language plpgsql as $$
begin
  if old.exam_system = 'ap' and (new.usage_scope is distinct from old.usage_scope or new.exam_system is distinct from old.exam_system
      or new.ap_candidate_key is distinct from old.ap_candidate_key or new.ap_subject is distinct from old.ap_subject) then
    raise exception 'The purpose, subject and candidate link of an AP problem are fixed at conversion.';
  end if;
  return new;
end $$;
drop trigger if exists problems_ap_immutable on public.problems;
create trigger problems_ap_immutable before update on public.problems
  for each row execute function public.problems_ap_immutable();

-- 공개 시점에도 후보가 여전히 게시 가능해야 한다(재검증 필요·반려로 돌아간 후보는 공개 불가).
create or replace function public.problem_versions_ap_publish_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; c ap_candidate_items%rowtype;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select ap_candidate_key into k from problems where id = new.problem_id and exam_system = 'ap';
    if k is not null then
      select * into c from ap_candidate_items where candidate_key = k;
      if c.id is null or not c.review_env_ready then
        raise exception 'AP candidate % is no longer review-env ready, so this version cannot be published.', k;
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists problem_versions_ap_publish_guard on public.problem_versions;
create trigger problem_versions_ap_publish_guard before insert or update of status on public.problem_versions
  for each row execute function public.problem_versions_ap_publish_guard();

-- ── 3. RPC (service_role) ──────────────────────────────────────────────
-- 렌더·화면 검증 기록. 자동 게이트 통과(auto_passed) 후보만. 화면 검증은 렌더 검증이 끝난 뒤.
create or replace function public.ap_set_verification(p_candidate_key text, p_render boolean, p_screen boolean, p_evidence jsonb, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c ap_candidate_items%rowtype;
begin
  select * into c from ap_candidate_items where candidate_key = p_candidate_key for update;
  if c.id is null then raise exception 'Unknown AP candidate.'; end if;
  if c.review_state <> 'auto_passed' then raise exception 'Only candidates that passed the latest automatic gate can be verified (state: %).', c.review_state; end if;
  if p_screen and not (coalesce(p_render, c.render_verified)) then raise exception 'Screen verification requires render verification first.'; end if;
  if c.problem_id is not null then raise exception 'Verification of a converted candidate cannot be changed.'; end if;
  update ap_candidate_items
     set render_verified = coalesce(p_render, render_verified),
         screen_verified = coalesce(p_screen, screen_verified),
         render_evidence = case when p_render is true then coalesce(p_evidence, render_evidence) else render_evidence end,
         screen_evidence = case when p_screen is true then coalesce(p_evidence, screen_evidence) else screen_evidence end
   where id = c.id;
end $$;

create or replace function public.ap_create_bank_problem(
  p_candidate_key text, p_item_index int, p_purpose text, p_format text, p_actor_id uuid,
  p_difficulty text default null, p_topic text default null, p_skill_code text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare c ap_candidate_items%rowtype; v_id uuid; v_scope text;
begin
  if p_purpose is null or p_purpose not in ('mock_exam', 'lesson') then raise exception 'Choose exactly one purpose: mock_exam or lesson.'; end if;
  select * into c from ap_candidate_items where candidate_key = p_candidate_key for update;
  if c.id is null then raise exception 'Unknown AP candidate.'; end if;
  if not c.is_current or not c.review_env_ready then
    raise exception 'AP candidate % is not review-env ready (auto gate passed + render verified + screen verified required).', c.candidate_key;
  end if;
  if c.purpose is not null and c.purpose <> p_purpose then raise exception 'The purpose of this AP candidate is already fixed as %.', c.purpose; end if;
  if c.subject_id is null then raise exception 'The candidate has no subject row.'; end if;
  if p_format not in ('mc', 'essay') then raise exception 'AP items are converted as mc or essay (free response).'; end if;
  v_scope := case p_purpose when 'mock_exam' then 'mock_exam' else 'general' end;
  insert into problems (format, subject_id, status, created_by, topic, difficulty, skill_code, exam_system, ap_subject, usage_scope, created_via, ap_candidate_key, ap_item_index)
  values (p_format::problem_format, c.subject_id, 'draft', p_actor_id, nullif(p_topic, ''), nullif(p_difficulty, '')::problem_difficulty,
          nullif(p_skill_code, ''), 'ap', c.ap_subject_code, v_scope, 'ai_generated', c.candidate_key, p_item_index)
  returning id into v_id;
  update ap_candidate_items set purpose = p_purpose where id = c.id and purpose is null;
  return v_id;
end $$;

drop function if exists public.ap_finalize_conversion(text, uuid, int);
create or replace function public.ap_finalize_conversion(p_candidate_key text, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c ap_candidate_items%rowtype; n_expected int; n_found int; r record; v_first uuid; v_first_v uuid; v_kw uuid;
begin
  select * into c from ap_candidate_items where candidate_key = p_candidate_key for update;
  if c.id is null then raise exception 'Unknown AP candidate.'; end if;
  if c.purpose is null then raise exception 'The candidate has no purpose yet; create its problems first.'; end if;
  n_expected := case when jsonb_typeof(c.payload->'items') = 'array' then jsonb_array_length(c.payload->'items') else 1 end;
  select count(*) into n_found from problems p join problem_versions v on v.id = p.published_version_id and v.status = 'published'
   where p.ap_candidate_key = c.candidate_key and p.status = 'confirmed' and p.archived_at is null;
  if n_found <> n_expected then raise exception 'All % item(s) must be published before finalizing (published: %).', n_expected, n_found; end if;
  for r in select p.id as pid, p.ap_item_index as idx, p.published_version_id as vid from problems p
            where p.ap_candidate_key = c.candidate_key order by p.ap_item_index loop
    insert into ap_candidate_problems (candidate_key, item_index, problem_id, problem_version_id) values (c.candidate_key, r.idx, r.pid, r.vid)
    on conflict (candidate_key, item_index) do update set problem_version_id = excluded.problem_version_id;
    if v_first is null then v_first := r.pid; v_first_v := r.vid; end if;
    select id into v_kw from subject_keywords where subject_id = c.subject_id and content_code = c.keyword_code order by level desc limit 1;
    if v_kw is not null then insert into problem_keywords (problem_id, keyword_id, created_by) values (r.pid, v_kw, p_actor_id) on conflict do nothing; end if;
  end loop;
  update ap_candidate_items
     set release_tier = case when release_tier = 'candidate' then 'review_env' else release_tier end,
         problem_id = v_first, problem_version_id = v_first_v,
         converted_at = coalesce(converted_at, now()), converted_by = coalesce(converted_by, p_actor_id)
   where id = c.id;
  return jsonb_build_object('candidateKey', c.candidate_key, 'purpose', c.purpose, 'items', n_found, 'releaseTier', 'review_env');
end $$;

-- 오류 신고 후 수정: 새 공개 버전을 후보에 연결한다(공개 버전 불변 규칙 유지). 이미 세트에 조립된 스냅샷은 바뀌지 않는다.
create or replace function public.ap_attach_new_version(p_candidate_key text, p_item_index int, p_version_id uuid, p_actor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c ap_candidate_items%rowtype; p_id uuid; v problem_versions%rowtype;
begin
  select * into c from ap_candidate_items where candidate_key = p_candidate_key for update;
  if c.id is null or c.release_tier = 'candidate' then raise exception 'The candidate has not been converted.'; end if;
  select id into p_id from problems where ap_candidate_key = p_candidate_key and ap_item_index = p_item_index;
  select * into v from problem_versions where id = p_version_id;
  if p_id is null or v.id is null or v.problem_id <> p_id or v.status <> 'published' then raise exception 'The version must be a published version of this candidate item.'; end if;
  update ap_candidate_problems set problem_version_id = p_version_id where candidate_key = p_candidate_key and item_index = p_item_index;
  update ap_candidate_items
     set problem_version_id = case when p_item_index = 0 then p_version_id else problem_version_id end,
         expert_status = case when expert_status = 'issues_reported' then 'in_review' else expert_status end
   where id = c.id;
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'ap_set_verification(text, boolean, boolean, jsonb, uuid)',
    'ap_create_bank_problem(text, int, text, text, uuid, text, text, text)',
    'ap_finalize_conversion(text, uuid)',
    'ap_attach_new_version(text, int, uuid, uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ── 4. 용도별 재고 ─────────────────────────────────────────────────────
-- 목표는 용도마다 따로 둔다(공유 없음). 후보는 변환 전에는 어느 용도에도 속하지 않는 "미배정 풀"이다.
create table if not exists public.ap_stock_purpose_targets (
  subject_id uuid not null references public.subjects(id) on delete cascade,
  kind text not null check (kind in ('mc', 'frq_bundle')),
  purpose text not null check (purpose in ('mock_exam', 'lesson')),
  target int not null check (target >= 0),
  primary key (subject_id, kind, purpose)
);
alter table public.ap_stock_purpose_targets enable row level security;
drop policy if exists "관리자만 조회·쓰기" on public.ap_stock_purpose_targets;
create policy "관리자만 조회·쓰기" on public.ap_stock_purpose_targets for all using (is_admin()) with check (is_admin());

create or replace view public.ap_stock_by_purpose_v with (security_invoker = true) as
with ready as (
  select ap_subject_code, subject_id, kind, count(*) filter (where review_env_ready and purpose is null and problem_id is null)::int as unallocated_ready
    from ap_candidate_items where is_current group by 1, 2, 3
), used as (
  select ap_subject_code, subject_id, kind, purpose,
         count(*) filter (where release_tier in ('review_env', 'launch'))::int as converted,
         count(*) filter (where release_tier = 'review_env')::int as in_review_env,
         count(*) filter (where release_tier = 'launch')::int as launched
    from ap_candidate_items where is_current and purpose is not null group by 1, 2, 3, 4
), tg as (
  select t.subject_id, t.kind, t.purpose, t.target from ap_stock_purpose_targets t
)
select coalesce(u.ap_subject_code, s.ap_subject_code) as subject, coalesce(u.kind, tg.kind) as kind, coalesce(u.purpose, tg.purpose) as purpose,
       coalesce(tg.target, 0) as target, coalesce(u.converted, 0) as converted, coalesce(u.in_review_env, 0) as in_review_env, coalesce(u.launched, 0) as launched,
       greatest(coalesce(tg.target, 0) - coalesce(u.converted, 0), 0) as shortfall,
       coalesce(r.unallocated_ready, 0) as unallocated_ready
  from used u
  full join tg on tg.subject_id = u.subject_id and tg.kind = u.kind and tg.purpose = u.purpose
  left join subjects s on s.id = coalesce(u.subject_id, tg.subject_id)
  left join ready r on r.subject_id = coalesce(u.subject_id, tg.subject_id) and r.kind = coalesce(u.kind, tg.kind);

-- 용도별 부족분의 합이 미배정 풀로 채워지는지(풀은 한 번만 쓸 수 있다).
create or replace view public.ap_stock_pool_v with (security_invoker = true) as
select subject, kind, sum(shortfall)::int as purpose_shortfall_total, max(unallocated_ready)::int as unallocated_ready,
       greatest(sum(shortfall) - max(unallocated_ready), 0)::int as net_shortfall
  from ap_stock_by_purpose_v group by subject, kind;

-- 관리자 목록용: 후보별 변환 상태
drop view if exists public.ap_item_conversion_v;
create view public.ap_item_conversion_v with (security_invoker = true) as
select i.candidate_key, i.ap_subject_code as subject, i.kind, i.review_state, i.render_verified, i.screen_verified, i.review_env_ready,
       i.purpose, i.release_tier, i.expert_status, i.problem_id, i.converted_at, i.is_current
  from ap_candidate_items i;
