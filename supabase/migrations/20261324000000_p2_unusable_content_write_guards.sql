-- P2 5차 — 사용할 수 없는 교재·문제는 **쓰기 시점에** 거부한다.
--
-- 2026-09-13 제품 오너 지적: "이번 세 경로 제한이 후보 목록 조회에만 적용됐는지,
-- 직접 추가·교체·상속·자동 구성 저장에서도 검증되는지 확인해주세요. 문제 ID를
-- 직접 전달해도 서버에서 사용 불가 문제를 거부해야 합니다."
--
-- 확인 결과 지적이 맞다. 앞선 커밋은 **후보 목록 조회만** 좁혔다. 직접 추가·상속·
-- 자동 구성은 id 를 그대로 넣으므로, 화면을 거치지 않으면 비공개 문제도 들어간다.
-- 학생 교재 테이블에만 published 가드가 있었고(20261229000000), 이번에 만든 관리자·
-- 선생님 층과 **문제 테이블 전부**에는 가드가 없었다.
--
-- 경로마다 막으면 새 경로가 생길 때 또 빠진다. 테이블에 걸어 어느 경로로 들어와도
-- 같게 막는다.
--
-- 막는 것은 **새로 담는 것**뿐이다:
--   - 이미 담겨 있던 행은 건드리지 않는다(insert/update 에서만 돈다).
--   - 이미 수업에 고정된 내용은 이 표들과 무관하다 — 보관됐다고 과거 수업에서
--     사라지면 안 된다.

-- =========================================================================
-- 1. 교재는 여기서 막지 않는다 — 왜인지 남긴다
-- =========================================================================
-- 처음에는 교재에도 같은 가드를 걸었는데, 기존 설계를 깬다.
--
-- 관리자 기준본·선생님 기본 템플릿은 **계획하는 자리**다. 아직 공개되지 않은 교재를
-- 미리 붙여 두고 나중에 공개하는 흐름이 이미 있고, 하위로 내려갈 때 published 인
-- 것만 걸러진다(inherit 트리거들이 `d.status = 'published'` 를 본다). 실제로
-- "draft 상태인 참고 교재는 절대 시딩되지 않는다"가 회귀 테스트로 고정돼 있다.
--
-- 학생에게 실제로 가는 경계(curriculum_overlay_unit_materials)에는 이미
-- published 가드가 있다(20261229000000). 거기서 막는 것으로 충분하다.
--
-- 문제는 다르다. 공개 버전이 없는 문제는 problem_versions 조회 정책상 **내용을
-- 읽을 수조차 없어서**, 계획 단계에 담아 두어도 빈 자리가 될 뿐이다. 그래서
-- 문제만 모든 층에서 막는다.

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
