-- 2026-10-20 SAT 수학 Module 1 · Module 2 쉬운 경로(lower)에도 hard 문항을 둘 수 있게 배정 가능 플래그를 완화한다. (작성만, 적용은 총괄)
-- 오너 확정 구성(세트당 22문항 모듈): 수학 1 = easy 3 / medium 14 / hard 5, 수학 2 쉬운 경로 = easy 3 / medium 14 / hard 5, 어려운 경로 = medium 11 / hard 11.
--
-- 이전 규칙(20261901000002): m1_eligible = m2_lower_eligible = difficulty in (easy, medium), m2_higher_eligible = difficulty in (medium, hard).
-- 새 규칙: section = 'math' 인 문항에 한해 hard 도 m1_eligible · m2_lower_eligible 로 인정한다. R&W 는 종전 그대로(M1/lower 는 easy·medium).
--   m2_higher_eligible 는 변하지 않는다(medium·hard).
-- mock_exam_validate_mst_set(마지막 정의 20262100000260)은 이 세 생성 열만 읽으므로 함수 본문은 바꾸지 않는다 — 열이 바뀌면 M1/lower 의 eligibilityViolations ·
-- variantEligibilityViolations 판정이 수학 hard 에 대해 자동으로 풀린다. 라우팅 임계값(mock_exam_routing_policies)·점수 앵커(lib/mock-exam/score-estimate.ts)는 건드리지 않는다.
-- 자동 조립기(lib/mock-exam/assemble.ts moduleEligibility)는 종전대로 M1/lower 에 hard 를 고르지 않는다(수학 hard 는 세트 새 버전 SQL 이 교체 칸으로만 넣는다).
--
-- 생성 열 식 변경은 PG 17 `ALTER COLUMN ... SET EXPRESSION`(저장 열 재계산, 기존 행은 새 식으로 다시 채워진다). 열 순서·타입·이름·의존 함수 시그니처 불변, 멱등(같은 식을 다시 걸어도 결과 동일).
-- 롤백: data/prod-open/sat-expand-sql/99_rollback_math_hard_eligibility.sql (원래 식으로 복귀; 그 전에 M1/lower 에 수학 hard 가 있는 세트 버전을 먼저 없애야 한다).

alter table public.mock_exam_set_items
  alter column m1_eligible set expression as (difficulty in ('easy', 'medium') or (section = 'math' and difficulty = 'hard'));
alter table public.mock_exam_set_items
  alter column m2_lower_eligible set expression as (difficulty in ('easy', 'medium') or (section = 'math' and difficulty = 'hard'));
-- m2_higher_eligible: 변경 없음(medium, hard).

comment on column public.mock_exam_set_items.m1_eligible is 'Module 1 배정 가능: easy·medium, 그리고 수학(section=math)의 hard (2026-10-20 오너 확정: 수학 1 hard 5). R&W 는 easy·medium 만.';
comment on column public.mock_exam_set_items.m2_lower_eligible is 'M2 쉬운 경로(lower) 배정 가능: easy·medium, 그리고 수학의 hard (2026-10-20 오너 확정: 쉬운 경로 hard 5). R&W 는 easy·medium 만.';
