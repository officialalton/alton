-- 2026-09-15 제품 오너 — 유형별 문제 품질 계약·난이도·오답 품질.
--   * problem_versions.quality: 생성 시 기록하는 품질 정보(관리자에게 전부 노출하지 않는다).
--       { contract: {ok, issues[]},                       — 질문 대상/자료 근거/표시/정답/답안 형식 다섯 연결 검사
--         estimatedDifficulty: 'easy'|'medium'|'hard', difficultyReasons: string[],   — 추정 난이도(학생 응답이 쌓이면 보정)
--         distractors: [{index, plausibleBecause, matches, whyWrong, kind}],          — 오답 근거(학생에게 보이지 않음)
--         independentReview: {pickedIndex, agrees, confidence, obviousDistractors[], notes},  — 생성 모델과 별도의 독립 검사
--         needsReview: boolean, needsReviewReasons: string[], calibrated: false }
--   * problem_response_stats: 문제 버전별 응답 수·정답률·선택지별 선택 비율(보정 난이도의 재료). 학생 개인정보 없음.

alter table problem_versions add column if not exists quality jsonb;
comment on column problem_versions.quality is '유형별 품질 계약·추정 난이도·오답 근거·독립 검사 결과(2026-09-15). 앱이 생성·저장 시 기록. 관리자에게는 난이도 추정 근거와 검토 필요만 보인다.';

create or replace function public.set_problem_quality(p_version_id uuid, p_quality jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update problem_versions set quality = p_quality where id = p_version_id;
  if not found then raise exception '존재하지 않는 문제 버전입니다.'; end if;
end; $$;
revoke execute on function public.set_problem_quality(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_problem_quality(uuid, jsonb) to service_role;

-- 응답 통계 — 학생 식별자 없이 버전별 집계만. 관리자(service role) 화면에서 읽는다.
create or replace view public.problem_response_stats
with (security_invoker = true) as
select
  w.problem_id,
  w.problem_version_id,
  count(*) filter (where w.submitted_at is not null) as responses,
  count(*) filter (where w.auto_correct is true) as correct,
  case when count(*) filter (where w.submitted_at is not null and w.auto_correct is not null) > 0
       then round(100.0 * count(*) filter (where w.auto_correct is true) / count(*) filter (where w.submitted_at is not null and w.auto_correct is not null))
       else null end as correct_pct,
  (select jsonb_object_agg(k, v) from (
     select coalesce(x.submitted_choice_index::text, 'none') as k, count(*) as v
     from session_problem_work x
     where x.problem_version_id = w.problem_version_id and x.submitted_at is not null
     group by 1) t) as choice_counts
from session_problem_work w
where w.problem_version_id is not null
group by w.problem_id, w.problem_version_id;
comment on view public.problem_response_stats is '문제 버전별 응답 수·정답 수·정답률·선택지별 선택 수(2026-09-15). 추정 난이도를 보정할 재료. 개인 식별 없음.';
