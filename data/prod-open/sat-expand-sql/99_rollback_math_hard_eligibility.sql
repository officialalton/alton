-- ROLLBACK of supabase/migrations/20262100000630_mock_exam_math_hard_in_m1_and_lower.sql
-- 원래 규칙(20261901000002)으로 복귀: m1_eligible = m2_lower_eligible = difficulty in (easy, medium).
-- 먼저 수학 Module 1 / lower 에 hard 가 있는 세트 버전을 없애야 한다(남아 있으면 그 세트는 validate 가 ready=false 가 된다. 공개된 세트면 응시가 막힐 수 있다).
-- 공개 전 초안이면 99_rollback_math_hard5.sql 을 먼저 실행한다. 아래 DO 블록은 안전 확인: 공개/초안 세트에 M1·lower hard 가 남아 있으면 중단한다.
do $rb$ declare v_n int; begin
  select count(*) into v_n from public.mock_exam_set_items i join public.mock_exam_sets s on s.id = i.exam_set_id
   where s.archived_at is null and i.section = 'math' and i.difficulty = 'hard' and (i.module_key = 'math_m1' or i.route = 'lower');
  if v_n > 0 then raise exception 'math hard remains in Module 1 / lower route of % live-or-draft set items - remove those set versions first', v_n; end if;
end $rb$;
alter table public.mock_exam_set_items alter column m1_eligible set expression as (difficulty in ('easy', 'medium'));
alter table public.mock_exam_set_items alter column m2_lower_eligible set expression as (difficulty in ('easy', 'medium'));
comment on column public.mock_exam_set_items.m1_eligible is null;
comment on column public.mock_exam_set_items.m2_lower_eligible is null;
