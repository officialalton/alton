-- 2026-09-18(제품 오너 지시) — Math 계산형 컴파일러 문항의 "세부 패턴"(kind/sub-pattern,
-- 예: nonlinear_equations_systems의 parameter_discriminant)을 문제별로 영구히 태깅한다.
-- 관리자가 forceKind로 특정 패턴을 지정했든, 컴파일러가 내부에서 무작위로 골랐든 — 실제로
-- 쓰인 값을 항상 기록한다(나중에 "이 학생이 특정 세부 패턴에서 틀린 문제만 모아 보기" 같은
-- 필터의 데이터 기반이 된다). R&W 세부 기술은 이 개념이 없어 항상 null로 남는다.
--
-- skill_code와 같은 목적(문항 분류 태그)이라 같은 problems 테이블에 둔다 — 문항 하나당
-- 값 하나면 충분하고(버전이 바뀌어도 같은 계산 패턴), problem_versions에 둘 이유가 없다.
alter table public.problems
  add column if not exists subpattern text;

comment on column public.problems.subpattern is
  'Math 계산형 컴파일러의 세부 패턴(questionKind/kind) 태그 — lib/problem-generation/math-compilers/kind-catalog.ts 참고. R&W·직접 작성 문항은 null.';
