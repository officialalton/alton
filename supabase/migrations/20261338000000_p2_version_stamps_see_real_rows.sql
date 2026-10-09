-- P2 9차 — 버전을 찍는 트리거가 실제 행을 볼 수 있게 한다.
--
-- 상속에서 교재 버전을 함께 내리자 선생님 경로가 '이 교재의 버전이 아닙니다.' 로
-- 막혔다. 원인은 권한이다:
--
--   curriculum_doc_versions 의 조회 정책은 "작성자 또는 관리자"다. 관리자가 만든
--   교재의 버전 행은 **선생님에게 보이지 않는다.**
--
-- 그런데 버전을 채우고(fill_*) 소속을 확인하는(check_*_belongs) 트리거 함수들이
-- 호출자 권한으로 돈다. 그래서 선생님이 구성에 교재를 담으면
--
--   - current_curriculum_doc_version_id() 가 null 을 돌려주고 → 버전이 기록되지 않았고
--   - 상위에서 내려온 버전 id 를 그대로 넣으면 → 확인 함수가 그 행을 못 찾아 거부했다
--
-- 즉 지금까지 **선생님 층·학생 층의 교재 구성에는 버전이 거의 남지 않았다**
-- (prep_version_coverage 가 'no_reference' 로 세던 것이 이것이다).
--
-- 조회 정책은 넓히지 않는다 — 스냅샷에는 teaching_tip 처럼 학생에게 보이면 안 되는
-- 것이 들어 있다. 대신 **가드와 스탬프만** 실제 행을 보게 한다. 둘 다 판단 근거일 뿐
-- 내용을 돌려주지 않는다.

create or replace function public.current_curriculum_doc_version_id(p_doc_id uuid)
returns uuid
language sql stable
security definer set search_path = public as $$
  select id from curriculum_doc_versions
  where curriculum_doc_id = p_doc_id
  order by version_number desc
  limit 1;
$$;

create or replace function public.fill_unit_material_version()
returns trigger
language plpgsql
security definer set search_path = public as $$
begin
  if new.doc_version_at_pick is null then
    select d.updated_at into new.doc_version_at_pick
    from curriculum_docs d where d.id = new.curriculum_doc_id;
  end if;
  if new.curriculum_doc_version_id is null then
    new.curriculum_doc_version_id := public.current_curriculum_doc_version_id(new.curriculum_doc_id);
  end if;
  return new;
end;
$$;

create or replace function public.check_unit_material_version_belongs()
returns trigger
language plpgsql
security definer set search_path = public as $$
declare
  v_doc uuid;
begin
  if new.curriculum_doc_version_id is null then
    return new;
  end if;
  select curriculum_doc_id into v_doc
  from curriculum_doc_versions where id = new.curriculum_doc_version_id;
  if v_doc is null or v_doc <> new.curriculum_doc_id then
    raise exception '이 교재의 버전이 아닙니다.';
  end if;
  return new;
end;
$$;

create or replace function public.check_unit_problem_version_belongs()
returns trigger
language plpgsql
security definer set search_path = public as $$
declare
  v_problem uuid;
begin
  if new.problem_version_id is null then
    return new;
  end if;
  select problem_id into v_problem
  from problem_versions where id = new.problem_version_id;
  if v_problem is null or v_problem <> new.problem_id then
    raise exception '이 문제의 버전이 아닙니다.';
  end if;
  return new;
end;
$$;

create or replace function public.fill_unit_problem_version()
returns trigger
language plpgsql
security definer set search_path = public as $$
begin
  if new.problem_version_id is null then
    select p.published_version_id into new.problem_version_id
    from problems p where p.id = new.problem_id;
  end if;
  return new;
end;
$$;

create or replace function public.fill_prep_item_problem_version()
returns trigger
language plpgsql
security definer set search_path = public as $$
begin
  if new.content_type = 'problem' and new.problem_version_id is null then
    select p.published_version_id into new.problem_version_id
    from problems p where p.id = new.content_id;
  end if;
  return new;
end;
$$;

comment on function public.check_unit_material_version_belongs() is
  'P2 9차: 구성 행이 가리키는 교재 버전이 정말 그 교재의 것인지. 호출자 권한으로 돌면 '
  '선생님에게 보이지 않는 버전 행을 "없다"로 읽어 정상 저장을 막는다 — 그래서 security '
  'definer 다. 내용은 돌려주지 않고 소속만 판단한다.';

-- =========================================================================
-- 선생님이 문제은행의 공개된 문제를 볼 수 있게 한다
-- =========================================================================
-- 2026-09-13 제품 오너: "문제는 공개되어 있고 키워드도 셋업 되어 있는데, 선생님 수업
-- 준비 쪽 문제 리스트에 안 나온다. 관리자 쪽에는 들어와 있다."
--
-- problems 의 조회 정책은 문제가 **교재 섹션에 매달려 있거나**(section_id) **어떤
-- 수업에서 생성됐을 때**(origin_session_id)만 남에게 열린다. 문제은행에서 만든 문제는
-- 둘 다 null 이라 어느 분기에도 걸리지 않는다 — 작성자(관리자)와 관리자만 보였다.
--
-- 그래서 선생님 수업 준비의 '문제 후보'가 언제나 비어 있었다. 관리자 화면은 is_admin()
-- 으로 통과해 정상으로 보였다.
--
-- 선생님에게 **문제은행의 공개된 문제**를 연다. 범위를 좁게 잡는다:
--
--   origin_session_id is null  — 남의 수업에서 만들어진 문제는 그대로 닫아 둔다.
--                                그 문제는 그 학생의 맥락에 속하고, 담당이 아닌
--                                선생님에게 보이면 안 된다.
--   status='confirmed' + 미보관 — 어차피 구성 후보가 되는 것만 보면 된다.
--
-- 학생·보호자에게는 열지 않는다 — 학생이 보는 것은 수업에 고정됐거나 과제로 배정된
-- 문제뿐이라는 기존 경계를 그대로 둔다.
-- 역할 판정은 헬퍼로 뺀다. 정책 안에 profiles 하위질의를 그대로 두면 행마다
-- profiles 의 정책까지 함께 평가돼 학생 조회가 눈에 띄게 느려진다(테스트가 5초를
-- 넘겼다). stable + security definer 로 한 번만 판정한다.
create or replace function public.is_teaching_staff()
returns boolean
language sql stable
security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = auth.uid() and p.role in ('teacher', 'admin')
  );
$$;
revoke execute on function public.is_teaching_staff() from public, anon;
grant execute on function public.is_teaching_staff() to authenticated, service_role;

create policy "선생님·관리자는 공개된 문제은행 문제 조회" on problems for select
  using (
    status = 'confirmed'
    and archived_at is null
    and origin_session_id is null
    and public.is_teaching_staff()
  );
