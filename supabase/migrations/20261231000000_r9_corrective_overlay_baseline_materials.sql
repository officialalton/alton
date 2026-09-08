-- R9 corrective 1(추가분) — 오버레이 최초 베이스라인 시딩에 단원별 참고 교재도 포함
--
-- 배경: 20261230000000_r9_corrective_overlay_baseline_seed.sql이
-- ensure_active_curriculum_overlay()에서 과목 기본 단원(subject_template_units)과
-- 단원별 기본 키워드(subject_template_unit_keywords)는 스냅샷 시딩했지만, 단원별
-- 참고 교재(subject_template_unit_materials → curriculum_overlay_unit_materials)는
-- 빠뜨렸다 — 그 결과 선생님이 막 만들어진 오버레이를 열어보면 단원마다 구성된
-- 참고 교재가 하나도 없이 비어 보인다(기본 단원 구성이 이미 붙여둔 교재가 있는데도).
--
-- 이 교정은 별도의 새 마이그레이션으로 기존 ensure_active_curriculum_overlay()
-- 함수 본문을 create or replace function으로 다시 정의해 확장한다(기존
-- 20261230000000 파일은 건드리지 않는다 — 마이그레이션은 추가만 한다).
-- 확장되는 부분은 "같은 트랜잭션 안에서, 각 베이스라인 단원의 원본
-- (source_unit_id)이 subject_template_unit_materials로 연결한 교재 중
-- curriculum_docs.status = 'published'인 것만" curriculum_overlay_unit_materials로
-- 복사하는 한 단계뿐이다. 그 외 함수의 동작(잠금, 활성 오버레이 재사용, 단원/키워드
-- 시딩)은 그대로다.
--
-- 게이트 존중(corrective 2, 20261230010000): curriculum_overlay_unit_materials에는
-- Task 3부터 이미 있던 check_overlay_unit_material_published 트리거가 걸려 있고,
-- 이는 corrective 2가 건드리지 않은 "쓰기 시점 published 게이트"다(§corrective 2
-- 커밋 메시지 "curriculum_overlay_unit_materials' own published-doc trigger
-- (Task 3) was already a correct read/write-time gate and is untouched"). 이
-- 시딩 INSERT는 그 트리거를 우회하지 않고 그대로 통과하며, 아래 SELECT의
-- "and d.status = 'published'" 조건은 그 트리거와 같은 판정을 시딩 시점에
-- 한 번 더(방어적으로) 앞당겨 확인할 뿐이다 — draft 교재는 애초에 INSERT
-- 대상에 오르지 않는다.
--
-- 스냅샷 불변성: 이 INSERT는 오버레이 "생성 시점"의 1회성 스냅샷이다. 이후
-- subject_template_unit_materials가 바뀌거나 교재가 published에서 벗어나도,
-- 이미 만들어진 학생 오버레이의 curriculum_overlay_unit_materials 행은 어떤
-- 지속적 동기화 트리거로도 다시 쓰이지 않는다(변경 시 이 함수가 재호출되지
-- 않기 때문 — 이미 활성 오버레이가 있으면 조기 반환한다).

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

  -- (corrective 1 추가분) 각 베이스라인 단원의 시딩 시점 참고 교재 스냅샷
  -- (subject_template_unit_materials)을 curriculum_overlay_unit_materials로
  -- 복사한다 — 단, 그 교재가 시딩 시점에 published인 것만(draft 교재는 절대
  -- 복사하지 않는다). "ou.source_unit_id = tum.unit_id" 조인으로 각 오버레이
  -- 단원 인스턴스는 자기 자신의 원본 단원이 연결한 교재만 받는다(단원 간
  -- 교재가 섞이지 않는다).
  insert into curriculum_overlay_unit_materials (overlay_unit_id, curriculum_doc_id, created_by)
  select ou.id, tum.curriculum_doc_id, auth.uid()
  from curriculum_overlay_units ou
  join subject_template_unit_materials tum on tum.unit_id = ou.source_unit_id
  join curriculum_docs d on d.id = tum.curriculum_doc_id
  where ou.overlay_id = v_overlay_id
    and d.status = 'published';

  return v_overlay_id;
end;
$$;

comment on function public.ensure_active_curriculum_overlay(uuid) is
  'R9 corrective 1(+추가분): 학생 subject_enrollment당 활성 오버레이를 원자적으로 보장하고, 처음 만들어질 때만 과목 기본 단원 + 단원별 기본 키워드 스냅샷 + 단원별 공개된 참고 교재 스냅샷으로 베이스라인을 시딩한다. RLS는 이 함수를 호출하는 세션의 권한으로 그대로 적용된다(SECURITY DEFINER 아님) — 담당 선생님/관리자가 아니면 삽입 단계에서 기존 정책이 그대로 막는다.';
