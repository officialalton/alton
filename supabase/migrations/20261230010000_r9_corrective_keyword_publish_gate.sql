-- R9 corrective 2/2 — 키워드 태깅을 공개/확정 상태에서 분리
--
-- 배경(제품 오너 리뷰): Task 1
-- (20261228000000_r9_curriculum_content_foundation.sql)의 트리거가 두 가지를
-- 뒤섞었다 —
--   (a) draft 섹션/미확정 문제는 애초에 키워드 관계에 넣을 수조차 없게 막았다.
--       태깅은 콘텐츠 저작 편의 기능이지 공개 게이트가 아닌데, 저작 단계에서
--       미리 태깅해두는 정상적인 관리자 워크플로를 막고 있었다.
--   (b) 교재가 published에서 벗어나거나 문제가 confirmed에서 벗어나면 관계
--       행 자체를 삭제했다 — 관리자가 오탈자 수정 등으로 잠깐 draft로
--       되돌리면 태깅 작업 결과가 통째로 사라진다.
--
-- 교정: "선택 가능(teaching-selectable)" 여부는 관계 테이블의 존재로 흉내내지
-- 않고 읽기 시점에 published/confirmed를 명시적으로 검사한다 — 그 검사 지점을
-- curriculum_doc_section_keywords_selectable / problem_keywords_selectable 뷰로
-- 제공한다(향후 "선생님이 실제로 고를 수 있는 콘텐츠" 쿼리는 이 뷰를 통해야
-- 한다). 뷰는 security_invoker로 만들어 기저 테이블의 RLS를 그대로 물려받는다
-- (관리자 전용 쓰기는 그대로, 조회는 기존과 동일하게 인증된 사용자 전체).
--
-- 쓰기 트리거(check_section_keyword_published/check_problem_keyword_confirmed)는
-- "존재하지 않는 섹션/문제/키워드" 및 "과목 불일치" 검사만 남기고
-- published/confirmed 게이트는 제거한다. cleanup_*_on_unpublish/unconfirm
-- 트리거는 완전히 제거한다(관계 보존).

-- =========================================================================
-- 1. cleanup 트리거 제거 — unpublish/unconfirm 되어도 태깅 결과는 보존한다.
-- =========================================================================

drop trigger if exists curriculum_docs_cleanup_section_keywords on curriculum_docs;
drop function if exists public.cleanup_section_keywords_on_unpublish();

drop trigger if exists problems_cleanup_problem_keywords on problems;
drop function if exists public.cleanup_problem_keywords_on_unconfirm();

-- =========================================================================
-- 2. 섹션↔키워드 쓰기 트리거 완화 — published 게이트 제거, 과목 일치만 검사.
-- =========================================================================

create or replace function public.check_section_keyword_published()
returns trigger
language plpgsql as $$
declare
  v_doc_subject uuid;
  v_keyword_subject uuid;
begin
  select d.subject_id into v_doc_subject
  from curriculum_doc_sections s
  join curriculum_docs d on d.id = s.curriculum_doc_id
  where s.id = new.section_id;

  if v_doc_subject is null then
    raise exception '존재하지 않는 교재 조각입니다.';
  end if;

  select subject_id into v_keyword_subject from subject_keywords where id = new.keyword_id;
  if v_keyword_subject is null then
    raise exception '존재하지 않는 키워드입니다.';
  end if;
  if v_doc_subject <> v_keyword_subject then
    raise exception '교재와 키워드는 같은 과목이어야 합니다.';
  end if;

  new.created_by := auth.uid();
  return new;
end;
$$;

comment on function public.check_section_keyword_published() is
  'R9 corrective 2: 이름은 유지하지만 published 게이트는 제거했다(태깅은 draft 섹션에도 허용 — 저작 편의 기능이지 공개 게이트가 아니다). 과목 불일치/존재 검사만 남는다. "선택 가능" 여부는 curriculum_doc_section_keywords_selectable 뷰가 읽기 시점에 검사한다.';

-- =========================================================================
-- 3. 문제↔키워드 쓰기 트리거 완화 — confirmed 게이트 제거, 과목 일치만 검사.
-- =========================================================================

create or replace function public.check_problem_keyword_confirmed()
returns trigger
language plpgsql as $$
declare
  v_problem_subject uuid;
  v_keyword_subject uuid;
  v_problem_exists boolean;
begin
  select subject_id, true into v_problem_subject, v_problem_exists
  from problems where id = new.problem_id;

  if not found then
    raise exception '존재하지 않는 문제입니다.';
  end if;

  select subject_id into v_keyword_subject from subject_keywords where id = new.keyword_id;
  if v_keyword_subject is null then
    raise exception '존재하지 않는 키워드입니다.';
  end if;
  if v_problem_subject is not null and v_problem_subject <> v_keyword_subject then
    raise exception '문제와 키워드는 같은 과목이어야 합니다.';
  end if;

  new.created_by := auth.uid();
  return new;
end;
$$;

comment on function public.check_problem_keyword_confirmed() is
  'R9 corrective 2: 이름은 유지하지만 confirmed 게이트는 제거했다(태깅은 draft/AI초안 문제에도 허용 — 저작 편의 기능이지 확정 게이트가 아니다). 과목 불일치/존재 검사만 남는다. "선택 가능" 여부는 problem_keywords_selectable 뷰가 읽기 시점에 검사한다.';

-- =========================================================================
-- 4. 읽기 시점 "선택 가능(teaching-selectable)" 게이트 — 뷰
-- 향후 "선생님이 실제로 고를 수 있는 콘텐츠" 쿼리(레슨 준비/세션 선택/과제
-- 구성 등, 이번 교정 범위 밖)는 관계 테이블을 직접 읽지 말고 이 뷰를 통해야
-- 한다. security_invoker=true로 만들어 기저 테이블의 RLS(인증된 사용자 전체
-- 조회)를 그대로 물려받는다.
-- =========================================================================

create view public.curriculum_doc_section_keywords_selectable
with (security_invoker = true) as
select k.section_id, k.keyword_id, k.created_by, k.created_at
from curriculum_doc_section_keywords k
join curriculum_doc_sections s on s.id = k.section_id
join curriculum_docs d on d.id = s.curriculum_doc_id
where d.status = 'published';

comment on view public.curriculum_doc_section_keywords_selectable is
  'R9 corrective 2: curriculum_doc_section_keywords 중 상위 교재가 현재 published인 행만. "선생님이 고를 수 있는 콘텐츠" 쿼리는 기저 테이블이 아니라 이 뷰를 읽어야 한다(관계 존재 자체를 선택 가능 여부의 대리 지표로 쓰지 않는다).';

create view public.problem_keywords_selectable
with (security_invoker = true) as
select k.problem_id, k.keyword_id, k.created_by, k.created_at
from problem_keywords k
join problems p on p.id = k.problem_id
where p.status = 'confirmed';

comment on view public.problem_keywords_selectable is
  'R9 corrective 2: problem_keywords 중 문제가 현재 confirmed인 행만. "선생님이 고를 수 있는 콘텐츠" 쿼리는 기저 테이블이 아니라 이 뷰를 읽어야 한다.';
