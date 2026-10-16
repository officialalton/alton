-- 2026-10-08 — AP 문항 은행 상태 재정의(additive·재실행 안전; 적용된 마이그레이션은 수정하지 않는다).
-- 원칙: 검증 상태(review_state) / 전문가 상태(expert_status) / 선택(used_in_sample) 은 서로 다른 속성. 과거 선택·reserve 행을 자동으로 "통과 재고"로 승격하지 않는다.
--   review_state: candidate | rejected | needs_revalidation(최신 게이트 이전) | auto_passed(최신 게이트 통과) | exact_duplicate(완전 중복)
--   publishable = auto_passed AND expert_status in (approved, waived)
-- 롤백(참고): 신규 컬럼·테이블 drop, review_state 체크를 이전 값으로 복원(pending_expert_review 는 needs_revalidation 으로 이관됐으므로 되돌릴 때 매핑 필요).

alter table ap_candidate_items add column if not exists gate_version text;
alter table ap_candidate_items add column if not exists expert_status text not null default 'none';
alter table ap_candidate_items add column if not exists used_in_sample boolean not null default false;
alter table ap_candidate_items add column if not exists legacy_reserve boolean not null default false;
alter table ap_candidate_items add column if not exists item_family_id text;
alter table ap_candidate_items add column if not exists duplicate_of text;
alter table ap_candidate_items add column if not exists duplicate_reason text;
alter table ap_candidate_items add column if not exists content_key text;
alter table ap_candidate_items add column if not exists shared_with text[] not null default '{}';
alter table ap_candidate_items add column if not exists calculator text not null default 'na';
alter table ap_candidate_items add column if not exists stock_cell text;

-- review_state 체크 교체(이름이 환경마다 달라도 동적으로 찾아 제거)
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'ap_candidate_items'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%review_state%' loop
    execute format('alter table ap_candidate_items drop constraint %I', c);
  end loop;
end $$;
-- 기존 행 이관: pending_expert_review → needs_revalidation(자동 승격 금지). reserve 표기는 legacy 플래그로 보존.
update ap_candidate_items set
  legacy_reserve = coalesce((payload ->> 'reserve')::boolean, false),
  used_in_sample = not coalesce((payload ->> 'reserve')::boolean, false),
  review_state = 'needs_revalidation'
where review_state = 'pending_expert_review';
update ap_candidate_items set review_state = 'rejected' where review_state in ('expert_rejected');
update ap_candidate_items set review_state = 'needs_revalidation' where review_state in ('auto_verified', 'expert_approved');
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ap_candidate_items_review_state_v2') then
    alter table ap_candidate_items add constraint ap_candidate_items_review_state_v2 check (review_state in ('candidate', 'rejected', 'needs_revalidation', 'auto_passed', 'exact_duplicate'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ap_candidate_items_expert_status_check') then
    alter table ap_candidate_items add constraint ap_candidate_items_expert_status_check check (expert_status in ('none', 'pending', 'approved', 'rejected', 'waived'));
  end if;
end $$;
-- 공개 가능 여부는 파생 컬럼(저장 생성)으로 둔다.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'ap_candidate_items' and column_name = 'publishable') then
    alter table ap_candidate_items add column publishable boolean generated always as (review_state = 'auto_passed' and expert_status in ('approved', 'waived')) stored;
  end if;
end $$;
create index if not exists ap_candidate_items_family_idx on ap_candidate_items (item_family_id) where item_family_id is not null;
create index if not exists ap_candidate_items_cell_idx on ap_candidate_items (stock_cell) where stock_cell is not null;
comment on column ap_candidate_items.review_state is 'candidate | rejected | needs_revalidation | auto_passed | exact_duplicate. 선택(used_in_sample)·전문가 상태와 별개.';
comment on column ap_candidate_items.item_family_id is '문항군: 같은 원형·토픽의 숫자/표현 변형 묶음. 변형은 반려하지 않는다. 완전 중복만 exact_duplicate.';

-- 검증·검수 이력(항목별 게이트 버전과 결과를 남긴다)
create table if not exists ap_candidate_review_history (
  id uuid primary key default gen_random_uuid(),
  candidate_key text not null,
  run_label text not null,
  gate_version text not null,
  outcome text not null check (outcome in ('passed', 'rejected')),
  reasons text,
  recorded_at timestamptz not null default now(),
  unique (candidate_key, run_label, gate_version)
);
create index if not exists ap_candidate_review_history_key_idx on ap_candidate_review_history (candidate_key);
alter table ap_candidate_review_history enable row level security;
drop policy if exists "관리자만 조회·쓰기" on ap_candidate_review_history;
create policy "관리자만 조회·쓰기" on ap_candidate_review_history for all using (is_admin()) with check (is_admin());

-- 칸(ap_stock_cells) = 토픽 × 주 스킬 × 구조 × 계산기. 기존 유일 제약을 계산기 포함으로 교체.
alter table ap_stock_cells add column if not exists calculator text not null default 'na';
alter table ap_stock_cells add column if not exists families int not null default 0;
alter table ap_stock_cells add column if not exists effective int not null default 0;
alter table ap_stock_cells add column if not exists needs_revalidation int not null default 0;
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'ap_stock_cells'::regclass and contype = 'u' and pg_get_constraintdef(oid) not ilike '%calculator%' loop
    execute format('alter table ap_stock_cells drop constraint %I', c);
  end loop;
end $$;
create unique index if not exists ap_stock_cells_cell_key on ap_stock_cells (subject_id, edition, keyword_code, skill_code, structure, calculator);
comment on column ap_stock_cells.adopted is '재정의: 최신 게이트 통과(auto_passed) 고유 문항 수. 채움(effective)은 문항군별 min(문항 수, 2) 합. 부족 = target - effective.';

-- 토픽 단위 목표
create table if not exists ap_stock_targets (
  subject_id uuid not null references subjects(id) on delete cascade,
  edition text not null default 'ced-2027',
  keyword_code text not null,
  kind text not null check (kind in ('mc', 'frq_bundle')),
  target int not null check (target >= 0),
  primary key (subject_id, edition, keyword_code, kind)
);
alter table ap_stock_targets enable row level security;
drop policy if exists "관리자만 조회·쓰기" on ap_stock_targets;
create policy "관리자만 조회·쓰기" on ap_stock_targets for all using (is_admin()) with check (is_admin());

-- 칸 집계 갱신: 최신 게이트 통과(auto_passed)만 adopted/families/effective 에 반영한다(낡은 통과는 needs_revalidation 칸에만).
create or replace function ap_refresh_stock_cells(p_subject uuid default null) returns int
language plpgsql as $$
declare n int;
begin
  with fam as (
    select subject_id, keyword_code, skill_primary as skill_code, structure, calculator, coalesce(item_family_id, candidate_key) as fam, count(*) filter (where review_state = 'auto_passed') as n_auto
    from ap_candidate_items where review_state in ('auto_passed', 'needs_revalidation') and (p_subject is null or subject_id = p_subject) group by 1, 2, 3, 4, 5, 6
  ), agg as (
    select subject_id, keyword_code, skill_code, structure, calculator, sum(n_auto)::int as adopted, count(*) filter (where n_auto > 0)::int as families, sum(least(n_auto, 2))::int as effective,
           count(*) filter (where n_auto = 0)::int as stale
    from fam group by 1, 2, 3, 4, 5
  )
  insert into ap_stock_cells (subject_id, edition, keyword_code, skill_code, structure, calculator, target, adopted, pending, families, effective, needs_revalidation)
  select subject_id, 'ced-2027', keyword_code, skill_code, structure, calculator, 0, adopted, 0, families, effective, stale from agg
  on conflict (subject_id, edition, keyword_code, skill_code, structure, calculator) do update
    set adopted = excluded.adopted, families = excluded.families, effective = excluded.effective, needs_revalidation = excluded.needs_revalidation, pending = 0;
  get diagnostics n = row_count;
  return n;
end $$;

-- 토픽 단위 부족분 뷰: target - effective(= 칸 effective 합). 최신 게이트 + 문항군 다양성 기준.
create or replace view ap_stock_shortfall_v as
select t.subject_id, t.edition, t.keyword_code, t.kind, t.target,
       coalesce((select sum(c.effective) from ap_stock_cells c where c.subject_id = t.subject_id and c.edition = t.edition and c.keyword_code = t.keyword_code and (t.kind = 'mc') = (c.structure <> 'frq_multipart')), 0)::int as effective,
       greatest(t.target - coalesce((select sum(c.effective) from ap_stock_cells c where c.subject_id = t.subject_id and c.edition = t.edition and c.keyword_code = t.keyword_code and (t.kind = 'mc') = (c.structure <> 'frq_multipart')), 0), 0)::int as shortfall
from ap_stock_targets t;
