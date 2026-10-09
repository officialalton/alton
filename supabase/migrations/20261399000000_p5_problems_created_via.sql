-- 2026-09-17(제품 오너 지시) — "관리자는 AI 생성 문항의 오류를 수정하거나 완성하지
-- 않는다." 이 원칙을 화면에서 지키려면, 어느 문항이 자동 생성(AI/계산형 컴파일러)
-- 완성 후보이고 어느 문항이 관리자가 직접 쓴 초안인지 구분할 수 있어야 한다.
-- 자동 생성 문항은 검수 화면에서 내용 편집 자체를 막고(읽기 전용 + 공개/보관만),
-- 관리자가 처음부터 쓰는 문항은 기존 편집기를 그대로 쓴다.
alter table public.problems
  add column if not exists created_via text not null default 'manual'
    check (created_via in ('manual', 'ai_generated', 'compiler'));

comment on column public.problems.created_via is
  '문항이 어떻게 만들어졌는가 — manual(관리자 직접 작성, 편집 가능) / ai_generated(AI 생성, 검수 화면에서 편집 불가) / compiler(계산형 컴파일러 생성, 검수 화면에서 편집 불가).';
