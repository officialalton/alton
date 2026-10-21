-- 과거 행 비용 이벤트 backfill (작성만 — 실행하지 않음, 총괄 승인 후 1회).
-- 마이그레이션 20262100000650 이후, 이벤트가 없고 cost_usd>0 인 기존 행을 'legacy' 이벤트로 옮긴다(발생 시각은 마지막 갱신 시각으로 근사 — 실제 호출 시각은 기록된 적 없음).
-- 멱등: 이미 이벤트가 있는 행은 건너뛴다. 뷰는 이벤트 없는 행을 같은 값으로 이미 집계하므로 실행 전후 월 지출 합계는 같다.
insert into public.essay_ai_cost_events (essay_score_id, student_id, state, model, input_tokens, output_tokens, cost_usd, occurred_at)
select s.id, s.student_id, 'legacy', s.model, s.input_tokens, s.output_tokens, s.cost_usd, s.updated_at
  from public.mock_exam_essay_scores s
 where s.cost_usd > 0 and not exists (select 1 from public.essay_ai_cost_events e where e.essay_score_id = s.id and e.state in ('settled', 'legacy'));
