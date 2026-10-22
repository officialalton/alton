-- 2026-10-22 SAT R&W Module 1 · Module 2 쉬운 경로(lower)에도 hard 문항을 둘 수 있게 배정 가능 플래그를 완화한다(오너 지시: R&W Hard 보강 C안, 모듈당 약 3개).
-- 20262100000630 이 수학에만 풀었던 규칙을 R&W 에도 푼다. 새 규칙: 모든 section 에서 hard 도 m1_eligible · m2_lower_eligible 로 인정(= easy·medium·hard).
--   m2_higher_eligible 는 변하지 않는다(medium·hard).
-- mock_exam_validate_mst_set(마지막 정의 20262100000260)은 이 세 생성 열만 읽으므로 함수 본문은 바꾸지 않는다. 라우팅 임계값(mock_exam_routing_policies)·점수 앵커는 건드리지 않는다.
--   주의: M1 에 hard 가 들어가면 M1 정답 수가 낮아져 라우팅 임계값 기준으로 쉬운 경로로 가는 학생이 늘 수 있다 — 임계값 보정은 학생 응시 데이터가 쌓인 뒤(정책 2026-10-15)로 둔다.
-- 자동 조립기(lib/mock-exam/assemble.ts moduleEligibility)는 종전대로 M1/lower 에 hard 를 고르지 않는다(R&W hard 는 세트 새 버전 SQL 이 교체 칸으로만 넣는다).
-- 생성 열 식 변경은 PG 17 `ALTER COLUMN ... SET EXPRESSION`(저장 열 재계산). 열 순서·타입·이름·의존 함수 시그니처 불변, 멱등.
-- 롤백: 20262100000630 의 식으로 복귀(`difficulty in ('easy','medium') or (section = 'math' and difficulty = 'hard')`). 그 전에 M1/lower 에 R&W hard 가 있는 세트 버전을 먼저 없애야 한다.

alter table public.mock_exam_set_items
  alter column m1_eligible set expression as (difficulty in ('easy', 'medium', 'hard'));
alter table public.mock_exam_set_items
  alter column m2_lower_eligible set expression as (difficulty in ('easy', 'medium', 'hard'));
-- m2_higher_eligible: 변경 없음(medium, hard).

comment on column public.mock_exam_set_items.m1_eligible is 'Module 1 배정 가능: easy·medium·hard (수학 2026-10-20, R&W 2026-10-22 오너 확정).';
comment on column public.mock_exam_set_items.m2_lower_eligible is 'M2 쉬운 경로(lower) 배정 가능: easy·medium·hard (수학 2026-10-20, R&W 2026-10-22 오너 확정).';
