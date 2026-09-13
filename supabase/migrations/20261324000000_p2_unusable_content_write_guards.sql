-- P2 5차 — 사용할 수 없는 교재·문제는 **새로 담을 때** 거부한다.
--
-- 2026-09-13 제품 오너 지적 둘을 함께 반영한다.
--
-- (1) "후보 목록 조회에만 적용됐는지, 직접 추가·교체·상속·자동 구성 저장에서도
--     검증되는지 확인해주세요. 문제 ID를 직접 전달해도 서버에서 사용 불가 문제를
--     거부해야 합니다."
--
--     앞선 작업은 후보 목록만 좁혔다. 직접 추가·상속·자동 구성은 id 를 그대로
--     넣으므로 화면을 거치지 않으면 사용 불가 콘텐츠가 들어간다. 경로마다 막으면
--     새 경로가 생길 때 또 빠지므로 테이블에 건다.
--
-- (2) "관리자·선생님 템플릿도 공개되고 보관되지 않은 교재만 신규 구성에 사용합니다.
--     미공개 교재를 먼저 붙이는 기존 구현은 확정 정책의 예외가 아닙니다."
--
--     교재를 계획 단계에서는 느슨하게 두려던 판단을 접는다. 문제은행·교재 편집에서
--     초안을 **관리하는 것**과 수업 구성에 **담는 것**은 다르다. 세 층 모두 같은
--     기준을 쓴다.
--
-- **새로 담는 것과 이미 담긴 것을 정리하는 것은 다르다.** 이미 담긴 콘텐츠가 나중에
-- 비공개·보관 상태가 됐을 때 순서를 바꾸거나 빼는 정리까지 막으면, 시작 차단을
-- 해소할 길이 없어진다. 그래서 UPDATE 는 **콘텐츠가 바뀔 때만** 본다.
--
-- 이미 수업에 고정된 내용은 이 표들과 무관하다 — 보관됐다고 과거 수업에서 사라지면
-- 안 된다.

-- =========================================================================
-- 1. 교재 — 공개됐고 보관되지 않은 것만
-- =========================================================================
create or replace function public.check_unit_material_usable()
returns trigger
language plpgsql as $$
declare
  v_status doc_status;
  v_archived timestamptz;
begin
  -- 기존 항목 정리(순서·source 변경)는 막지 않는다. 새로 담거나 다른 교재로
  -- 바꿀 때만 본다.
  if tg_op = 'UPDATE' and new.curriculum_doc_id = old.curriculum_doc_id then
    return new;
  end if;

  select status, archived_at into v_status, v_archived
  from curriculum_docs where id = new.curriculum_doc_id;

  if v_status is null then
    raise exception '존재하지 않는 교재입니다.';
  end if;
  if v_status <> 'published' then
    raise exception '공개되지 않은 교재는 회차 구성에 담을 수 없습니다.';
  end if;
  if v_archived is not null then
    raise exception '보관된 교재는 새로 담을 수 없습니다.';
  end if;
  return new;
end;
$$;

create trigger subject_template_unit_materials_check_usable
  before insert or update on subject_template_unit_materials
  for each row execute function public.check_unit_material_usable();

create trigger teacher_curriculum_template_unit_materials_check_usable
  before insert or update on teacher_curriculum_template_unit_materials
  for each row execute function public.check_unit_material_usable();

-- 학생 층의 기존 가드(20261229000000)는 published 만 봤고 UPDATE 예외도 없었다.
-- 같은 기준으로 맞추면서 created_by 채우기는 그대로 둔다.
create or replace function public.check_overlay_unit_material_published()
returns trigger
language plpgsql as $$
declare
  v_status doc_status;
  v_archived timestamptz;
begin
  if tg_op = 'UPDATE' and new.curriculum_doc_id = old.curriculum_doc_id then
    return new;
  end if;

  select status, archived_at into v_status, v_archived
  from curriculum_docs where id = new.curriculum_doc_id;

  if v_status is null then
    raise exception '존재하지 않는 교재입니다.';
  end if;
  if v_status <> 'published' then
    raise exception '공개(published)되지 않은 교재는 학생 커리큘럼에 연결할 수 없습니다.';
  end if;
  if v_archived is not null then
    raise exception '보관된 교재는 새로 담을 수 없습니다.';
  end if;
  new.created_by := auth.uid();
  return new;
end;
$$;

-- =========================================================================
-- 2. 문제 — 확정·미보관에 더해 **공개된 버전이 있어야** 한다
-- =========================================================================
-- problems.status='confirmed' 와 problem_versions.status='published' 는 다른 축이다.
-- 공개 버전이 없는 문제는 problem_versions 조회 정책상 내용을 읽을 수조차 없으므로
-- 구성에 들어가면 빈 자리가 된다.
create or replace function public.check_unit_problem_usable()
returns trigger
language plpgsql as $$
declare
  v_status problem_status;
  v_archived timestamptz;
begin
  if tg_op = 'UPDATE' and new.problem_id = old.problem_id then
    return new;
  end if;

  select status, archived_at into v_status, v_archived
  from problems where id = new.problem_id;

  if v_status is null then
    raise exception '존재하지 않는 문제입니다.';
  end if;
  if v_status <> 'confirmed' then
    raise exception '확정되지 않은 문제는 회차 구성에 담을 수 없습니다.';
  end if;
  if v_archived is not null then
    raise exception '보관된 문제는 새로 담을 수 없습니다.';
  end if;
  if not exists (
    select 1 from problem_versions v
    where v.problem_id = new.problem_id and v.status = 'published'
  ) then
    raise exception '공개된 버전이 없는 문제는 회차 구성에 담을 수 없습니다.';
  end if;
  return new;
end;
$$;

create trigger subject_template_unit_problems_check_usable
  before insert or update on subject_template_unit_problems
  for each row execute function public.check_unit_problem_usable();

create trigger teacher_curriculum_template_unit_problems_check_usable
  before insert or update on teacher_curriculum_template_unit_problems
  for each row execute function public.check_unit_problem_usable();

-- =========================================================================
-- 3. 학생 층의 준비 항목
-- =========================================================================
-- curriculum_unit_prep_items 는 교재 조각과 문제를 함께 담는다. 문제일 때만 본다.
create or replace function public.check_prep_item_usable()
returns trigger
language plpgsql as $$
declare
  v_status problem_status;
  v_archived timestamptz;
begin
  if new.content_type <> 'problem' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.content_id = old.content_id then
    return new;
  end if;

  select status, archived_at into v_status, v_archived
  from problems where id = new.content_id;

  if v_status is null then
    raise exception '존재하지 않는 문제입니다.';
  end if;
  if v_status <> 'confirmed' then
    raise exception '확정되지 않은 문제는 회차 준비에 담을 수 없습니다.';
  end if;
  if v_archived is not null then
    raise exception '보관된 문제는 새로 담을 수 없습니다.';
  end if;
  if not exists (
    select 1 from problem_versions v
    where v.problem_id = new.content_id and v.status = 'published'
  ) then
    raise exception '공개된 버전이 없는 문제는 회차 준비에 담을 수 없습니다.';
  end if;
  return new;
end;
$$;

create trigger curriculum_unit_prep_items_check_usable
  before insert or update on curriculum_unit_prep_items
  for each row execute function public.check_prep_item_usable();
