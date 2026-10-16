-- P2 5차 — 20261324000000 의 정정본을 확실히 반영한다.
--
-- 왜 별도 파일인가: 20261324000000 을 쓴 뒤 두 가지를 고쳤는데(아래), 그 사이에
-- 원격에는 고치기 **전** 내용이 적용됐다. Supabase 는 마이그레이션을 버전 번호로만
-- 추적하므로 같은 번호의 파일을 고쳐도 다시 적용되지 않는다 — "Remote database is
-- up to date" 로 조용히 지나간다. 적용된 것이 어느 시점 버전이든 같은 결과가 되도록
-- 여기서 최종 상태를 다시 선언한다. 이미 맞는 상태라면 아무것도 바뀌지 않는다.
--
-- 고친 두 가지:
--
-- (1) UPDATE 가드가 **정리까지** 막았다. 이미 담긴 콘텐츠가 나중에 비공개·보관이
--     되면 순서 변경도 제외 기록도 거부돼, 수업 시작 차단을 해소할 길이 없었다.
--     UPDATE 는 콘텐츠가 바뀔 때만 본다. 순서·source 변경은 지나가고, 다른 것으로
--     바꾸는 교체는 "새로 담기"라 여전히 검증한다.
--
-- (2) 교재도 확정 정책을 따른다. 관리자·선생님 템플릿도 공개되고 보관되지 않은
--     교재만 신규 구성에 쓴다. 초안을 문제은행·교재 편집에서 관리하는 것과 수업
--     구성에 담는 것은 다르다.

-- =========================================================================
-- 교재
-- =========================================================================
create or replace function public.check_unit_material_usable()
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
    raise exception '공개되지 않은 교재는 회차 구성에 담을 수 없습니다.';
  end if;
  if v_archived is not null then
    raise exception '보관된 교재는 새로 담을 수 없습니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists subject_template_unit_materials_check_usable
  on subject_template_unit_materials;
create trigger subject_template_unit_materials_check_usable
  before insert or update on subject_template_unit_materials
  for each row execute function public.check_unit_material_usable();

drop trigger if exists teacher_curriculum_template_unit_materials_check_usable
  on teacher_curriculum_template_unit_materials;
create trigger teacher_curriculum_template_unit_materials_check_usable
  before insert or update on teacher_curriculum_template_unit_materials
  for each row execute function public.check_unit_material_usable();

-- 학생 층 — 보관 검사와 UPDATE 예외를 더하고 created_by 채우기는 유지한다.
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
-- 문제
-- =========================================================================
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

drop trigger if exists subject_template_unit_problems_check_usable
  on subject_template_unit_problems;
create trigger subject_template_unit_problems_check_usable
  before insert or update on subject_template_unit_problems
  for each row execute function public.check_unit_problem_usable();

drop trigger if exists teacher_curriculum_template_unit_problems_check_usable
  on teacher_curriculum_template_unit_problems;
create trigger teacher_curriculum_template_unit_problems_check_usable
  before insert or update on teacher_curriculum_template_unit_problems
  for each row execute function public.check_unit_problem_usable();

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

drop trigger if exists curriculum_unit_prep_items_check_usable
  on curriculum_unit_prep_items;
create trigger curriculum_unit_prep_items_check_usable
  before insert or update on curriculum_unit_prep_items
  for each row execute function public.check_prep_item_usable();
