-- 395: (1) legacy_reserve 정의 정정(완전 중복 제외) (2) launch 조건 재정의
-- 적용 순서: 394 이후. 파괴적 변경 없음(394 에서 추가한 검수기간·서명 컬럼은 로컬에만 있었고 값이 비어 있다).

-- 1) legacy_reserve = "구 예비분" 표식. 완전 중복(exact_duplicate)·반려 행에는 의미가 없다 → 데이터 정정 + 불변식.
update ap_candidate_items set legacy_reserve = false where legacy_reserve and review_state in ('exact_duplicate', 'rejected');
update ap_candidate_items set used_in_sample = false where used_in_sample and review_state in ('exact_duplicate', 'rejected');
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ap_candidate_items_reserve_not_dup') then
    alter table ap_candidate_items add constraint ap_candidate_items_reserve_not_dup
      check (not ((legacy_reserve or used_in_sample) and review_state in ('exact_duplicate', 'rejected')));
  end if;
end $$;
-- 재고·부족분(ap_refresh_stock_cells, ap_stock_shortfall_v)은 legacy_reserve/used_in_sample 을 읽지 않는다 → 영향 없음(전후 표는 publication-flow.md).

-- 2) launch 조건: 최신 자동 게이트 통과 + 필수 그래프/자료 렌더링 + 학생 화면 검증 + 미해결 launch 차단 결함 0.
--    전문가 승인·검수 기간 만료는 launch 조건이 아니다. "신고 0건"을 검수 완료 증거로 쓰지 않는다.
drop view if exists ap_launch_ready_v;
drop view if exists ap_item_review_status_v;
drop view if exists ap_stock_summary_v;
drop view if exists ap_stock_current_v;
alter table ap_candidate_items drop column if exists review_period_ends_at;
alter table ap_candidate_items drop column if exists signoff_by;
alter table ap_candidate_items drop column if exists signoff_at;

create view ap_stock_current_v as select * from ap_candidate_items where is_current;

-- launch 차단 결함 대장(관리자가 분류). 신고 흐름(problem_error_reports)은 그대로 유지.
create table if not exists ap_launch_blockers (
  id uuid primary key default gen_random_uuid(),
  candidate_key text not null references ap_candidate_items(candidate_key),
  category text not null check (category in ('wrong_key', 'multiple_correct', 'missing_condition', 'wrong_figure', 'other')),
  report_id uuid references problem_error_reports(id),
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists ap_launch_blockers_open_idx on ap_launch_blockers (candidate_key) where resolved_at is null;
alter table ap_launch_blockers enable row level security;

create or replace view ap_item_review_status_v as
select i.candidate_key, i.ap_subject_code as subject, i.kind, i.gate_version, i.review_state, i.release_tier, i.expert_status,
       i.render_verified, i.screen_verified, i.review_env_ready, i.problem_id, i.problem_version_id,
       coalesce((select count(*) from problem_error_reports r where r.problem_id = i.problem_id and r.problem_version_id = i.problem_version_id and r.resolved_verdict_id is null), 0)::int as open_reports,
       -- 현재 게시 버전의 미해결 신고 중 정답·문항 결함 유형(wrong_key, flawed_problem)은 판정 전까지 차단으로 본다
       coalesce((select count(*) from problem_error_reports r where r.problem_id = i.problem_id and r.problem_version_id = i.problem_version_id and r.resolved_verdict_id is null and r.report_type in ('wrong_key', 'flawed_problem')), 0)::int as open_defect_reports,
       coalesce((select count(*) from ap_launch_blockers b where b.candidate_key = i.candidate_key and b.resolved_at is null), 0)::int as open_blockers
from ap_candidate_items i where i.is_current;

-- 최신 게이트 통과(auto_passed 는 최신 게이트에서만 부여됨) + 렌더·화면 검증(review_env_ready) + 차단 결함 0 + 검수 환경 게시됨
create or replace view ap_launch_ready_v as
select * from ap_item_review_status_v
where release_tier = 'review_env' and review_state = 'auto_passed' and review_env_ready
  and open_defect_reports = 0 and open_blockers = 0;
comment on view ap_launch_ready_v is 'launch 후보 = 최신 자동 게이트 통과 + 렌더·학생 화면 검증 + 미해결 차단 결함 0. 전문가 승인·검수 기간은 조건 아님. 신고 0건은 검수 완료 증거가 아니다.';

-- 요약 뷰의 legacy_reserve·selected_for_sample 은 중복·반려 행을 세지 않는다(파일 집계와 같은 정의)
create view ap_stock_summary_v as
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
       count(*) filter (where used_in_sample and review_state in ('auto_passed', 'needs_revalidation'))::int as selected_for_sample,
       count(*) filter (where legacy_reserve and review_state in ('auto_passed', 'needs_revalidation'))::int as legacy_reserve
from ap_stock_current_v group by 1, 2;
