-- 2026-10-08 — AP 후보 적재 배치 표식 + 게시 후 검수 모델(additive, 재실행 안전, 삭제 없음).
-- (A) 현재 재고 = is_current = true 인 행. 이전 적재(구 형식)는 삭제하지 않고 is_current=false 로 표시해 현재 재고·부족분·기본 조회에서 제외한다. 이력 보존.
-- (B) 게시·검수 모델(오너 확정): 전문가 검수는 **게시 후** 상태다(기존 모의고사 검수와 같은 방식: 검수 환경의 게시 문항 + 기존 오류 신고 흐름).
--     release_tier: candidate(후보 단계) → review_env(검수 환경에 게시) → launch(프로덕션 공개). 학생 화면 노출 전 그래프 렌더링·학생 화면 검증(render_verified, screen_verified)은 필수.
--     expert_status: unreviewed / in_review / approved / issues_reported — 검수 환경 게시를 막지 않는 게시 후 추적 상태. launch 는 별도 게이트(승인 서명 또는 검수 기간 종료 + 미해결 신고 0).
--     오류 신고는 병렬 시스템을 만들지 않고 기존 problem_error_reports(+verdicts, 20262100000360 확인 흐름)를 그대로 쓴다: AP 문항이 problems 로 게시되면 problem_id 로 연결.
-- 표식은 키 접두어가 아니라 적재 배치(load_batch_id)와 created_at 구간으로 한다(ap_mark_load_batches 또는 scripts/ap-generation/mark-batches.ts).
-- 이 파일은 아직 어떤 DB 에도 적용되지 않은 상태에서 작성·갱신됐다(393 까지만 적용됨).
create table if not exists ap_load_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  is_current boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
alter table ap_load_batches enable row level security;
drop policy if exists "관리자만 조회·쓰기" on ap_load_batches;
create policy "관리자만 조회·쓰기" on ap_load_batches for all using (is_admin()) with check (is_admin());
-- 현재 배치는 하나만
create unique index if not exists ap_load_batches_one_current on ap_load_batches ((true)) where is_current;

alter table ap_candidate_items add column if not exists load_batch_id uuid references ap_load_batches(id);
alter table ap_candidate_items add column if not exists is_current boolean not null default true;
create index if not exists ap_candidate_items_current_idx on ap_candidate_items (is_current, ap_subject_code, kind);
comment on column ap_candidate_items.is_current is '현재 재고 배치 여부. false = 이전 적재(삭제하지 않음): 현재 재고·부족분·기본 조회에서 제외.';


-- (B) 게시 후 검수 모델 컬럼(393 의 expert_status/publishable 정의를 대체)
alter table ap_candidate_items add column if not exists release_tier text not null default 'candidate';
alter table ap_candidate_items add column if not exists render_verified boolean not null default false;
alter table ap_candidate_items add column if not exists screen_verified boolean not null default false;
alter table ap_candidate_items add column if not exists problem_id uuid references problems(id);
alter table ap_candidate_items add column if not exists problem_version_id uuid references problem_versions(id);
alter table ap_candidate_items add column if not exists review_period_ends_at timestamptz;
alter table ap_candidate_items add column if not exists signoff_by uuid references profiles(id);
alter table ap_candidate_items add column if not exists signoff_at timestamptz;
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'ap_candidate_items'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%expert_status%' loop
    execute format('alter table ap_candidate_items drop constraint %I', c);
  end loop;
end $$;
update ap_candidate_items set expert_status = case expert_status when 'none' then 'unreviewed' when 'pending' then 'unreviewed' when 'waived' then 'unreviewed' when 'rejected' then 'issues_reported' else expert_status end
  where expert_status in ('none', 'pending', 'waived', 'rejected');
alter table ap_candidate_items alter column expert_status set default 'unreviewed';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ap_candidate_items_expert_status_v2') then
    alter table ap_candidate_items add constraint ap_candidate_items_expert_status_v2 check (expert_status in ('unreviewed', 'in_review', 'approved', 'issues_reported'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ap_candidate_items_release_tier_check') then
    alter table ap_candidate_items add constraint ap_candidate_items_release_tier_check check (release_tier in ('candidate', 'review_env', 'launch'));
  end if;
end $$;
-- 옛 정의(publishable = auto_passed AND expert approved)를 제거하고 새 정의로 교체
drop view if exists ap_stock_summary_v; drop view if exists ap_stock_by_batch_v; drop view if exists ap_stock_current_v;
alter table ap_candidate_items drop column if exists publishable;
-- 검수 환경 게시 가능 = 최신 게이트 통과 + 그래프 렌더링 + 학생 화면 검증 (전문가 승인은 요구하지 않는다)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'ap_candidate_items' and column_name = 'review_env_ready') then
    alter table ap_candidate_items add column review_env_ready boolean generated always as (review_state = 'auto_passed' and render_verified and screen_verified) stored;
  end if;
end $$;
comment on column ap_candidate_items.expert_status is '게시 후 검수 상태: unreviewed / in_review / approved / issues_reported. 검수 환경 게시를 막지 않는다.';
comment on column ap_candidate_items.release_tier is 'candidate → review_env(검수 환경 게시) → launch(프로덕션). launch 는 별도 게이트(ap_launch_ready_v).';
comment on column ap_candidate_items.review_env_ready is '최신 자동 게이트 통과 AND 그래프 렌더링 AND 학생 화면 검증. true 이어야 problems 로 게시(review tier) 가능.';

-- 게시 후 상태: 기존 오류 신고 흐름에서 파생(미해결 신고 = 현재 게시 버전에 대한 신고 중 판정·수정 전)
create or replace view ap_item_review_status_v as
select i.candidate_key, i.ap_subject_code as subject, i.kind, i.release_tier, i.expert_status, i.render_verified, i.screen_verified, i.review_env_ready, i.problem_id, i.problem_version_id,
       coalesce((select count(*) from problem_error_reports r where r.problem_id = i.problem_id and r.problem_version_id = i.problem_version_id and r.resolved_verdict_id is null), 0)::int as open_reports,
       coalesce((select count(*) from problem_error_reports r where r.problem_id = i.problem_id and r.resolved_verdict_id is null and r.problem_version_id <> i.problem_version_id), 0)::int as reports_on_older_versions,
       i.review_period_ends_at, i.signoff_at
from ap_candidate_items i where i.is_current;
-- launch 후보: 검수 환경에 게시됨 AND (승인 서명 OR (검수 기간 종료 AND 신고 없음/해결)) AND 현재 게시 버전에 미해결 신고 0
create or replace view ap_launch_ready_v as
select * from ap_item_review_status_v
where release_tier = 'review_env' and open_reports = 0 and expert_status <> 'issues_reported'
  and (expert_status = 'approved' or (review_period_ends_at is not null and review_period_ends_at <= now()));

-- 표식 함수: cutoff 이전에 만들어진 행 = 이전 적재, 이후 = 현재 적재. 기대 건수와 다르면 예외(적용 안 함). p_apply=false 면 건수만 돌려준다(dry-run 기본).
create or replace function ap_mark_load_batches(p_cutoff timestamptz, p_expect_previous int, p_expect_current int, p_apply boolean default false,
  p_previous_label text default 'previous-load-2026-10-08', p_current_label text default 'current-stock-2026-10-08')
returns table (previous_rows int, current_rows int, applied boolean, note text)
language plpgsql as $$
declare v_prev int; v_cur int; v_prev_id uuid; v_cur_id uuid;
begin
  select count(*) filter (where created_at < p_cutoff), count(*) filter (where created_at >= p_cutoff) into v_prev, v_cur from ap_candidate_items;
  if v_prev <> p_expect_previous or v_cur <> p_expect_current then
    previous_rows := v_prev; current_rows := v_cur; applied := false; note := format('expected %s previous / %s current but found %s / %s — nothing changed', p_expect_previous, p_expect_current, v_prev, v_cur);
    return next; return;
  end if;
  if p_apply then
    insert into ap_load_batches (label, is_current, note) values (p_previous_label, false, 'previous load (old format rows kept for history)') on conflict (label) do nothing;
    update ap_load_batches set is_current = false where is_current;
    insert into ap_load_batches (label, is_current, note) values (p_current_label, true, 'current stock load (validation/expert/selection separated)') on conflict (label) do update set is_current = true;
    select id into v_prev_id from ap_load_batches where label = p_previous_label; select id into v_cur_id from ap_load_batches where label = p_current_label;
    update ap_candidate_items set load_batch_id = v_prev_id, is_current = false where created_at < p_cutoff;
    update ap_candidate_items set load_batch_id = v_cur_id, is_current = true where created_at >= p_cutoff;
  end if;
  previous_rows := v_prev; current_rows := v_cur; applied := p_apply; note := case when p_apply then 'marked' else 'dry-run (no change)' end;
  return next;
end $$;

-- created_at 군집 히스토그램(경계 찾기용): 5분 단위 적재 건수
create or replace view ap_candidate_load_histogram_v as
select date_trunc('minute', created_at) - (extract(minute from created_at)::int % 5) * interval '1 minute' as bucket, count(*) as rows, min(created_at) as first_at, max(created_at) as last_at
from ap_candidate_items group by 1 order by 1;

-- 현재 재고 단일 출처(source of truth): 현재 배치 행만, 상태·문항군·칸을 DB에서 집계
create or replace view ap_stock_current_v as select * from ap_candidate_items where is_current;
create or replace view ap_stock_summary_v as
select ap_subject_code as subject, kind,
       count(*)::int as total_rows,
       count(*) filter (where review_state = 'rejected')::int as rejected,
       count(*) filter (where review_state = 'exact_duplicate')::int as exact_duplicates,
       count(*) filter (where review_state = 'needs_revalidation')::int as needs_revalidation,
       count(*) filter (where review_state = 'auto_passed')::int as auto_passed,
       count(*) filter (where review_state in ('auto_passed', 'needs_revalidation'))::int as unique_items,
       count(distinct item_family_id) filter (where review_state in ('auto_passed', 'needs_revalidation'))::int as item_families,
       count(*) filter (where review_env_ready)::int as review_env_ready,
       count(*) filter (where release_tier = 'review_env')::int as in_review_env,
       count(*) filter (where release_tier = 'launch')::int as launched,
       count(*) filter (where expert_status = 'approved')::int as expert_approved,
       count(*) filter (where expert_status = 'issues_reported')::int as issues_reported,
       count(*) filter (where used_in_sample)::int as selected_for_sample,
       count(*) filter (where legacy_reserve)::int as legacy_reserve
from ap_stock_current_v group by 1, 2;
-- 현재 vs 이전 적재 대조
create or replace view ap_stock_by_batch_v as
select coalesce(b.label, '(unmarked)') as batch, i.is_current, i.ap_subject_code as subject, i.kind, count(*)::int as rows,
       count(*) filter (where i.review_state = 'auto_passed')::int as auto_passed, count(*) filter (where i.review_state = 'needs_revalidation')::int as needs_revalidation,
       count(*) filter (where i.review_state = 'rejected')::int as rejected, count(*) filter (where i.review_state = 'exact_duplicate')::int as exact_duplicates,
       count(*) filter (where i.review_state not in ('rejected', 'exact_duplicate'))::int as unique_items, count(distinct i.item_family_id) filter (where i.review_state not in ('rejected', 'exact_duplicate'))::int as item_families
from ap_candidate_items i left join ap_load_batches b on b.id = i.load_batch_id group by 1, 2, 3, 4;

-- 칸 갱신·부족분은 현재 배치만 본다(이전 적재 행은 제외)
create or replace function ap_refresh_stock_cells(p_subject uuid default null) returns int
language plpgsql as $$
declare n int;
begin
  with fam as (
    select subject_id, keyword_code, skill_primary as skill_code, structure, calculator, coalesce(item_family_id, candidate_key) as fam, count(*) filter (where review_state = 'auto_passed') as n_auto
    from ap_candidate_items where is_current and review_state in ('auto_passed', 'needs_revalidation') and (p_subject is null or subject_id = p_subject) group by 1, 2, 3, 4, 5, 6
  ), agg as (
    select subject_id, keyword_code, skill_code, structure, calculator, sum(n_auto)::int as adopted, count(*) filter (where n_auto > 0)::int as families, sum(least(n_auto, 2))::int as effective, count(*) filter (where n_auto = 0)::int as stale
    from fam group by 1, 2, 3, 4, 5
  )
  insert into ap_stock_cells (subject_id, edition, keyword_code, skill_code, structure, calculator, target, adopted, pending, families, effective, needs_revalidation)
  select subject_id, 'ced-2027', keyword_code, skill_code, structure, calculator, 0, adopted, 0, families, effective, stale from agg
  on conflict (subject_id, edition, keyword_code, skill_code, structure, calculator) do update
    set adopted = excluded.adopted, families = excluded.families, effective = excluded.effective, needs_revalidation = excluded.needs_revalidation, pending = 0;
  -- 현재 배치에 더는 없는 칸은 0 으로(행은 삭제하지 않는다)
  update ap_stock_cells c set adopted = 0, families = 0, effective = 0, needs_revalidation = 0
   where (p_subject is null or c.subject_id = p_subject)
     and not exists (select 1 from ap_candidate_items i where i.is_current and i.subject_id = c.subject_id and i.keyword_code = c.keyword_code and i.skill_primary = c.skill_code and i.structure = c.structure and i.calculator = c.calculator and i.review_state in ('auto_passed', 'needs_revalidation'));
  get diagnostics n = row_count;
  return n;
end $$;
