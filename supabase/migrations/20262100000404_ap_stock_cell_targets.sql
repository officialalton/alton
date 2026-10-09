-- 404: AP 재고 칸 단위 목표(ap_stock_cell_targets)와 부족 뷰. 총합이 아니라 단원·계산기 사용·표현·스킬 범주·문항군·FRQ 유형 칸별로 달성도를 본다.
-- 파일 계산(lib/ap-generation/targets.ts)과 같은 정의: 현재 배치(is_current) + review_state='auto_passed' + defect_flags 비어 있음. 유효 수 = 문항군당 min(개수, 2) 합(family_floor 는 서로 다른 문항군 수).
-- MC 계산기: 'required'(실제로 필요) / 'not_allowed' / 'allowed'(candidate.calculator='na'; 허용만). 표현: stimulus.kind → table|graph|diagram|text|none(payoff_matrix 는 table).
-- 목표 숫자는 초기 목표(AB 부분 연습·풀 세트 1개 칸)이며 10세트 최종 목표가 아니다. 기존 ap_stock_targets(토픽 단위)는 그대로 둔다. 되돌리기: drop view/table.
create table if not exists public.ap_stock_cell_targets (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  edition text not null default 'ced-2027',
  dimension text not null check (dimension in ('cell', 'skill_category', 'representation', 'family_floor', 'frq_type')),
  kind text not null check (kind in ('mc', 'frq_bundle')),
  unit_code text, skill_category text, keyword_code text,
  calculator_use text check (calculator_use in ('required', 'not_allowed', 'allowed')),
  representation text check (representation in ('none', 'table', 'graph', 'text', 'diagram')),
  target int not null check (target >= 0),
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists ap_stock_cell_targets_uq on public.ap_stock_cell_targets (subject_id, edition, dimension, kind, coalesce(unit_code, ''), coalesce(skill_category, ''), coalesce(keyword_code, ''), coalesce(calculator_use, ''), coalesce(representation, ''));
alter table public.ap_stock_cell_targets enable row level security;
drop policy if exists "관리자만 조회·쓰기" on public.ap_stock_cell_targets;
create policy "관리자만 조회·쓰기" on public.ap_stock_cell_targets for all using (public.is_admin()) with check (public.is_admin());

create or replace view public.ap_stock_cell_shortfall_v as
select t.id, t.subject_id, t.edition, t.dimension, t.kind, t.unit_code, t.skill_category, t.keyword_code, t.calculator_use, t.representation, t.target, t.note,
       coalesce(s.effective, 0)::int as effective, coalesce(s.families, 0)::int as families,
       (case when t.dimension = 'family_floor' then coalesce(s.families, 0) else coalesce(s.effective, 0) end)::int as achieved,
       greatest(t.target - (case when t.dimension = 'family_floor' then coalesce(s.families, 0) else coalesce(s.effective, 0) end), 0)::int as shortfall
from public.ap_stock_cell_targets t
left join lateral (
  select sum(least(n, 2))::int as effective, count(*)::int as families
  from (
    select count(*) as n from public.ap_candidate_items i
    where i.is_current and i.review_state = 'auto_passed' and cardinality(i.defect_flags) = 0 and i.subject_id = t.subject_id and i.kind = t.kind
      and (t.unit_code is null or split_part(i.keyword_code, '.', 1) = t.unit_code)
      and (t.skill_category is null or left(i.skill_primary, 2) = t.skill_category || '.')
      and (t.keyword_code is null or i.keyword_code = t.keyword_code)
      and (t.calculator_use is null or (case i.calculator when 'required' then 'required' when 'not_allowed' then 'not_allowed' else 'allowed' end) = t.calculator_use)
      and (t.representation is null or (case coalesce(jsonb_typeof(i.payload -> 'stimulus'), 'null')
             when 'string' then 'text'
             when 'object' then (case i.payload -> 'stimulus' ->> 'kind' when 'table' then 'table' when 'payoff_matrix' then 'table' when 'graph' then 'graph' when 'diagram' then 'diagram' when 'text' then 'text' else 'none' end)
             else 'none' end) = t.representation)
    group by coalesce(i.item_family_id, i.candidate_key)
  ) f
) s on true;

-- 합계(총 auto_passed)는 칸 부족과 따로 본다: 합계가 목표를 넘어도 구조별로 모자랄 수 있다.
create or replace view public.ap_stock_total_v as
select i.ap_subject_code as subject, i.kind, count(*)::int as total_auto_passed, count(distinct coalesce(i.item_family_id, i.candidate_key))::int as families
from public.ap_candidate_items i where i.is_current and i.review_state = 'auto_passed' and cardinality(i.defect_flags) = 0 group by 1, 2;
