-- R9 corrective 1/2 — 학생 운영 커리큘럼 오버레이 최초 베이스라인 시딩
--
-- 배경: Task 3(20261229000000_r9_student_curriculum_overlay.sql)의
-- app/teacher/student-curriculum-actions.ts ensureActiveOverlay()는 빈 오버레이
-- 껍데기만 만들었다 — 이는 스펙(§4 "학생별 운영 커리큘럼은 기본 원본의 사본이
-- 아니라 추가·제외·재정렬·진도 상태를 담는 레이어")의 취지와 어긋난다: 오버레이가
-- 처음 만들어지는 순간에는 과목의 기본(canonical) 단원 구성을 그대로 반영한
-- 초기 베이스라인이 있어야, 그 위에서만 선생님의 추가/제외/재정렬이 의미를 갖는다.
--
-- 이 교정은 오버레이 "생성 시점"에만 관여한다 — 이후의 모든 변경은 여전히
-- Task 3가 이미 제공하는 addCanonicalUnit/excludeUnit/moveUnit/setUnitStatus를
-- 통해서만 이뤄진다(새로운 지속적 동기화 메커니즘이 아니다).
--
-- 원자성·멱등성: "오버레이 생성 + 베이스라인 시딩"을 하나의 plpgsql 함수(=하나의
-- 트랜잭션)로 묶고, 이 프로젝트의 기존 "ensure singleton row" 패턴(R5
-- 20260925010000_r5_subject_thread_auto_create.sql의 unique index + on conflict
-- do nothing)을 그대로 따른다. 여기에 더해 subject_enrollment_id 단위 advisory
-- lock으로 동시 호출을 완전히 직렬화해, 두 요청이 동시에 들어와도 정확히 하나의
-- active 오버레이와 정확히 하나의 베이스라인 시딩 이벤트만 발생한다(부분적으로
-- 시딩된 상태가 동시 리더에게 노출되지 않는다 — 시딩 자체가 오버레이 생성과 같은
-- 트랜잭션 안에서 끝난다).

create or replace function public.ensure_active_curriculum_overlay(p_subject_enrollment_id uuid)
returns uuid
language plpgsql as $$
declare
  v_overlay_id uuid;
  v_subject_id uuid;
begin
  -- 같은 subject_enrollment_id에 대한 동시 호출을 트랜잭션 스코프 advisory
  -- lock으로 직렬화한다. 이 락은 커밋/롤백 시 자동 해제되며, 아래 unique 부분
  -- 인덱스(student_curriculum_overlays_one_active)가 두 번째 방어선이다.
  perform pg_advisory_xact_lock(hashtextextended(p_subject_enrollment_id::text, 42));

  select id into v_overlay_id
  from student_curriculum_overlays
  where subject_enrollment_id = p_subject_enrollment_id and status = 'active';

  if v_overlay_id is not null then
    return v_overlay_id;
  end if;

  insert into student_curriculum_overlays (subject_enrollment_id, created_by)
  values (p_subject_enrollment_id, auth.uid())
  on conflict (subject_enrollment_id) where (status = 'active') do nothing
  returning id into v_overlay_id;

  if v_overlay_id is null then
    -- advisory lock 때문에 이 분기는 정상 상황에서는 도달하지 않지만, 방어적으로
    -- 이미 다른 트랜잭션이 만든 활성 오버레이를 그대로 반환한다(재시딩하지 않는다).
    select id into v_overlay_id
    from student_curriculum_overlays
    where subject_enrollment_id = p_subject_enrollment_id and status = 'active';
    return v_overlay_id;
  end if;

  select subject_id into v_subject_id
  from subject_enrollments
  where id = p_subject_enrollment_id;

  if v_subject_id is null then
    raise exception '존재하지 않는 subject_enrollment 입니다.';
  end if;

  -- 베이스라인: 과목의 기본(canonical) 단원 전체를 오버레이 단원 인스턴스로
  -- 복제가 아니라 "참조"한다(source_unit_id) — subject_template_units 자체는
  -- 전혀 바뀌지 않는다.
  insert into curriculum_overlay_units
    (overlay_id, source_unit_id, position, unit_title, note, created_by)
  select v_overlay_id, u.id, u.position, u.unit_title, u.note, auth.uid()
  from subject_template_units u
  where u.subject_id = v_subject_id
  order by u.position;

  -- 각 베이스라인 단원의 시딩 시점 기본 키워드 스냅샷(subject_template_unit_keywords)을
  -- curriculum_overlay_unit_keywords에 같은 모양으로 복사한다 — Task 1/3이 이미
  -- 쓰는 관계 테이블 형태를 그대로 따른다(새 스키마를 만들지 않는다).
  insert into curriculum_overlay_unit_keywords (overlay_unit_id, keyword_id, created_by)
  select ou.id, tuk.keyword_id, auth.uid()
  from curriculum_overlay_units ou
  join subject_template_unit_keywords tuk on tuk.unit_id = ou.source_unit_id
  where ou.overlay_id = v_overlay_id;

  return v_overlay_id;
end;
$$;

revoke execute on function public.ensure_active_curriculum_overlay(uuid) from public, anon;
grant execute on function public.ensure_active_curriculum_overlay(uuid) to authenticated, service_role;

comment on function public.ensure_active_curriculum_overlay(uuid) is
  'R9 corrective 1: 학생 subject_enrollment당 활성 오버레이를 원자적으로 보장하고, 처음 만들어질 때만 과목 기본 단원 + 단원별 기본 키워드 스냅샷으로 베이스라인을 시딩한다. RLS는 이 함수를 호출하는 세션의 권한으로 그대로 적용된다(SECURITY DEFINER 아님) — 담당 선생님/관리자가 아니면 삽입 단계에서 기존 정책이 그대로 막는다.';
