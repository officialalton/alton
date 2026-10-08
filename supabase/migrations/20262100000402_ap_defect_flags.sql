-- 402: 생성기 결함 플래그. "렌더링이 되는가"(render_verified)와 "자료가 정확한가"를 분리한다.
-- defect_flags 가 비어 있지 않으면(중괄호 미닫힘 문자열 stimulus, 표 본문 누락·모순, [object Object] 보기 등) 이전에 auto_passed 였더라도
-- review_env_ready 가 false 가 되어 문제 변환·게시·launch 경로(400 의 가드)가 모두 막힌다. 플래그는 lib/ap-generation/generator-defects.ts 가 계산한다.
-- 추가형: 컬럼 추가 + 생성 컬럼 식 교체(PG17 SET EXPRESSION). 기존 행·뷰는 그대로 유지된다.
alter table ap_candidate_items add column if not exists defect_flags text[] not null default '{}';
alter table ap_candidate_items add column if not exists defect_scanned_at timestamptz;
comment on column ap_candidate_items.defect_flags is '생성기 결함 코드 목록(unbalanced_braces, table_body_missing, table_empty_cell, object_object_option …). 비어 있어야 review_env_ready 가능.';
alter table ap_candidate_items alter column review_env_ready set expression as (review_state = 'auto_passed' and render_verified and screen_verified and cardinality(defect_flags) = 0);
comment on column ap_candidate_items.review_env_ready is '최신 자동 게이트 통과 AND 그림 렌더 검증 AND 학생 화면 검증 AND 생성기 결함 없음(defect_flags 비어 있음).';

create or replace view ap_item_review_status_v as
select i.candidate_key, i.ap_subject_code as subject, i.kind, i.gate_version, i.review_state, i.release_tier, i.expert_status,
       i.render_verified, i.screen_verified, i.review_env_ready, i.problem_id, i.problem_version_id,
       coalesce((select count(*) from problem_error_reports r where r.problem_id = i.problem_id and r.problem_version_id = i.problem_version_id and r.resolved_verdict_id is null), 0)::int as open_reports,
       coalesce((select count(*) from problem_error_reports r where r.problem_id = i.problem_id and r.problem_version_id = i.problem_version_id and r.resolved_verdict_id is null and r.report_type in ('wrong_key', 'flawed_problem')), 0)::int as open_defect_reports,
       coalesce((select count(*) from ap_launch_blockers b where b.candidate_key = i.candidate_key and b.resolved_at is null), 0)::int as open_blockers,
       i.defect_flags
from ap_candidate_items i where i.is_current;
-- 보조 적재(supplement) 배치 허용: 배치 표에 현재 배치 외 보조 배치를 둘 수 있도록 note 로 구분한다(is_current 의 의미는 행 단위 유지).
comment on table ap_load_batches is '적재 배치. is_current=true 는 기본 현재 배치 하나. 보조(supplement) 배치는 is_current=false 로 두되 그 행의 ap_candidate_items.is_current 는 true 로 적재해 현재 재고 뷰에 포함한다(note 에 supplement 표기).';
