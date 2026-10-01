-- P0(2026-09-10, 제품 오너 승인) — 두 가지를 한 migration으로 묶는다(서로
-- 의존적: 공통 매칭 확정 RPC가 커리큘럼 시딩 함수를 그 안에서 호출한다).
--
-- 1. curriculum_overlay_units에 출처 구분 컬럼(source_kind,
--    source_teacher_template_unit_id)을 추가한다 — 학생별 커리큘럼 단원이
--    (a) 관리자 공통 원본(subject_template_units), (b) 교사 운영본
--    (teacher_curriculum_template_units), (c) 학생별 추가/보강 중 어디서
--    왔는지 영구히 구분할 수 있어야 한다는 요구사항. source_unit_id=null로
--    교사 운영본 단원을 "학생 보강 단원"처럼 위장하는 방식은 기각됐다.
-- 2. 공통 매칭 확정 RPC(confirm_student_teacher_subject_match)를 새로
--    만든다 — 매칭 탭과 향후 "신규" 통합 보드가 모두 이 하나의 경로만
--    호출한다. 과목 수강 계획 생성 + 선생님 배정 + 학생 상태 자동 전환 +
--    커리큘럼 시딩을 하나의 plpgsql 함수(=하나의 암묵적 트랜잭션) 안에서
--    처리해, 앞 단계만 성공하고 뒷단계가 실패하는 부분 성공 상태를
--    구조적으로 차단한다. 총 회차 수 개념은 이 경로에 아예 존재하지 않는다
--    (subject_enrollments/teacher_assignments는애초에 그 컬럼이 없다).
--
-- 기존 legacy 경로(app/admin/matching-actions.ts의 enrollments insert)와
-- 기존 함수(planSubjectEnrollment/assignTeacherToSubjectEnrollment/
-- ensure_active_curriculum_overlay)는 이 migration에서 전혀 수정하지 않는다
-- — 새 함수를 추가만 한다(이 저장소의 기존 관행).

-- =========================================================================
-- 1. curriculum_overlay_units 출처 구분 컬럼
-- =========================================================================

-- NOT NULL + DEFAULT 컬럼 추가는 Postgres 11+에서 메타데이터만 갱신되고
-- 테이블 재작성이 없다 — 기존 행은 전부 일단 'student_added'로 채워진다.
alter table curriculum_overlay_units
  add column source_kind text not null default 'student_added',
  add column source_teacher_template_unit_id uuid references teacher_curriculum_template_units (id) on delete set null;

comment on column curriculum_overlay_units.source_kind is
  '이 단원의 출처: subject_template(관리자 공통 원본에서 복제) · teacher_template(교사 운영본에서 복제) · student_added(교사/학생이 추가한 보강 단원). source_unit_id/source_teacher_template_unit_id와 함께 봐야 정확하다.';
comment on column curriculum_overlay_units.source_teacher_template_unit_id is
  '이 단원이 교사 운영본(teacher_curriculum_template_units)에서 복제됐다면 그 원본 id. 이후 교사가 원본을 수정·삭제해도 이 학생의 단원(unit_title/note/position)은 바뀌지 않는다(복제 시점 스냅샷) — 이 컬럼은 출처 추적용일 뿐, 값 조회에 쓰지 않는다.';

-- 기존 행 backfill: source_unit_id가 있으면(=관리자 공통 원본에서 옴)
-- subject_template로 확정한다. 그 외(현재 source_unit_id가 null인 행은
-- 전부 교사/학생이 직접 만든 보강 단원 — 오늘까지는 teacher_template
-- 경로가 없었으므로 student_added로 남는 게 맞다)는 이미 채워진
-- 기본값('student_added')이 정확하다.
update curriculum_overlay_units
set source_kind = 'subject_template'
where source_unit_id is not null;

-- backfill 이후에 제약을 건다(기존 행이 백필 전 상태로 제약 위반하지 않도록).
alter table curriculum_overlay_units
  add constraint curriculum_overlay_units_source_kind_check
    check (source_kind in ('subject_template', 'teacher_template', 'student_added')),
  add constraint curriculum_overlay_units_source_consistency check (
    (source_kind = 'subject_template' and source_unit_id is not null and source_teacher_template_unit_id is null)
    -- teacher_template: source_teacher_template_unit_id는 원래 있어야 하지만,
    -- 교사가 나중에 원본 단원을 삭제하면 on delete set null로 null이 된다 —
    -- 그때도 source_kind='teacher_template'라는 출처 사실 자체는 남아있어야
    -- 하므로(요구사항: "교사 운영본 삭제 후에도 학생 사본의 출처 사실은
    -- 남아야 한다"), FK가 null인 것까지 허용한다. source_unit_id(공통 원본
    -- 출처)와는 항상 배타적이다.
    or (source_kind = 'teacher_template' and source_unit_id is null)
    or (source_kind = 'student_added' and source_unit_id is null and source_teacher_template_unit_id is null)
  );

create index if not exists curriculum_overlay_units_source_teacher_template_unit_id_idx
  on curriculum_overlay_units (source_teacher_template_unit_id);

-- 기존 ensure_active_curriculum_overlay()는 손대지 않는다 — 그 함수의 INSERT는
-- source_kind를 지정하지 않으므로(컬럼 자체가 없던 시절 작성됨) 아래 트리거가
-- source_unit_id 유무로 올바른 source_kind를 대신 채워, 위 제약을 그대로
-- 통과시킨다. 앞으로 추가될 다른 삽입 경로도 source_kind를 명시하지 않으면
-- 같은 규칙으로 자동 분류된다(명시하면 그 값 그대로 쓰인다 — 이 함수는
-- "명시 안 됐을 때만" 관여한다).
create or replace function public.curriculum_overlay_units_default_source_kind()
returns trigger
language plpgsql as $$
begin
  if new.source_kind is null or new.source_kind = 'student_added' then
    if new.source_unit_id is not null then
      new.source_kind := 'subject_template';
    elsif new.source_teacher_template_unit_id is not null then
      new.source_kind := 'teacher_template';
    end if;
  end if;
  return new;
end;
$$;
create trigger curriculum_overlay_units_default_source_kind
  before insert on curriculum_overlay_units
  for each row execute function public.curriculum_overlay_units_default_source_kind();

-- =========================================================================
-- 2. 커리큘럼 시딩 — 교사 운영본 우선, 없으면 관리자 공통 원본으로 폴백
--    (가산 아님 — 정책 확정: 2026-09-10)
-- =========================================================================

-- (2026-09-10) — 새 subject_enrollment에 대해 오버레이를 시딩한다. 교사
-- 운영본(teacher_curriculum_templates/teacher_curriculum_template_units)이
-- 있으면 그것만 물리 복제하고, 없을 때만 기존 ensure_active_curriculum_overlay()
-- (관리자 공통 원본, subject_template_units)로 폴백한다. 이미 활성 오버레이가
-- 있으면(둘 중 어느 경로로 만들어졌든) 그대로 반환하고 재시딩하지 않는다 —
-- "교사 운영본을 나중에 고쳐도 이미 배정된 학생 사본은 안 바뀐다"는 정책이
-- 바로 이 조기 반환 한 줄로 보장된다(이후 이 함수가 같은 enrollment로 다시
-- 호출돼도 새로 복제하지 않음).
create or replace function public.seed_curriculum_overlay_for_match(
  p_subject_enrollment_id uuid,
  p_teacher_id uuid,
  p_subject_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_overlay_id uuid;
  v_template_id uuid;
begin
  -- ensure_active_curriculum_overlay()와 동일한 락 키를 써서 두 경로가 같은
  -- subject_enrollment에 대해 동시에 실행돼도 직렬화된다.
  perform pg_advisory_xact_lock(hashtextextended(p_subject_enrollment_id::text, 42));

  select id into v_overlay_id
  from student_curriculum_overlays
  where subject_enrollment_id = p_subject_enrollment_id and status = 'active';
  if v_overlay_id is not null then
    return v_overlay_id;
  end if;

  select id into v_template_id
  from teacher_curriculum_templates
  where teacher_id = p_teacher_id and subject_id = p_subject_id;

  if v_template_id is null then
    -- 교사 운영본이 아직 없다 — 기존 관리자 공통 원본 폴백 경로를 그대로 쓴다.
    return ensure_active_curriculum_overlay(p_subject_enrollment_id);
  end if;

  insert into student_curriculum_overlays (subject_enrollment_id, created_by)
  values (p_subject_enrollment_id, auth.uid())
  on conflict (subject_enrollment_id) where (status = 'active') do nothing
  returning id into v_overlay_id;

  if v_overlay_id is null then
    -- advisory lock 때문에 정상 상황에서는 도달하지 않는 방어적 분기.
    select id into v_overlay_id
    from student_curriculum_overlays
    where subject_enrollment_id = p_subject_enrollment_id and status = 'active';
    return v_overlay_id;
  end if;

  insert into curriculum_overlay_units
    (overlay_id, source_teacher_template_unit_id, source_kind, position, unit_title, note, created_by)
  select v_overlay_id, tu.id, 'teacher_template', tu.position, tu.unit_title, tu.note, auth.uid()
  from teacher_curriculum_template_units tu
  where tu.template_id = v_template_id
  order by tu.position;

  return v_overlay_id;
end;
$$;
revoke execute on function public.seed_curriculum_overlay_for_match(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.seed_curriculum_overlay_for_match(uuid, uuid, uuid) to service_role;
-- confirm_student_teacher_subject_match()를 통해서만 호출된다(아래) — 직접
-- 호출은 service_role(내부 조합용)로만 열어둔다.

-- =========================================================================
-- 3. 공통 매칭 확정 RPC — 매칭 탭 · 신규 보드 · 상담 체험 신청이 전부 이
--    함수 하나만 호출한다. 총 회차 수 파라미터 없음.
-- =========================================================================

-- (2026-09-10) 학생-선생님-과목 배정의 유일한 v3 확정 경로. 다음을 하나의
-- 함수 호출(=하나의 트랜잭션)로 처리한다:
--   1) 과목 수강 계획(subject_enrollments) 생성 또는 재사용
--   2) 선생님 배정(teacher_assignments) 생성 또는 재사용(멱등 — 이미 같은
--      조합의 active 배정이 있으면 새로 만들지 않는다)
--   3) 학생 pending→active 자동 전환(실패해도 배정 자체는 되돌리지 않고
--      경고 문구만 남긴다 — 기존 activateStudentIfPending과 동일 정책)
--   4) 커리큘럼 시딩(교사 운영본 우선/공통 원본 폴백, 실패해도 배정 자체는
--      되돌리지 않고 경고 문구만 남긴다)
-- 1)·2)는 서로 부분 성공을 허용하지 않는다 — 2)에서 예외가 나면(예:
-- teacher_assignments_enforce_rate 트리거가 유효 시급 없음으로 거부) 함수
-- 전체가 예외로 끝나 1)에서 만든 subject_enrollments insert까지 함께
-- 롤백된다(단일 함수 호출은 단일 트랜잭션이므로 앱 코드가 별도로 보상
-- 처리를 할 필요가 없다).
--
-- 권한: is_admin() 또는 "매칭권한" capability로 표준화한다 — 상담 유입
-- 경로(app/admin/trial-onboarding-actions.ts)도 이 함수를 쓰도록 바뀌면서
-- 그동안 썼던 manage_consultations 대신 이 기준을 따른다.
create or replace function public.confirm_student_teacher_subject_match(
  p_child_id uuid,
  p_teacher_id uuid,
  p_subject_id uuid
)
returns table (
  out_subject_enrollment_id uuid,
  out_teacher_assignment_id uuid,
  out_overlay_id uuid,
  out_activation_warning text,
  out_curriculum_warning text
)
language plpgsql security definer set search_path = public as $$
declare
  v_contract_id uuid;
  v_enrollment_id uuid;
  v_assignment_id uuid;
  v_overlay_id uuid;
  v_child_status text;
  v_activation_warning text := null;
  v_curriculum_warning text := null;
begin
  if not (is_admin() or current_user_has_capability('매칭권한')) then
    raise exception '이 작업을 수행할 권한이 없습니다.';
  end if;

  -- 같은 학생+과목 조합에 대한 동시 호출을 직렬화한다(중복 클릭·경쟁 조건
  -- 방지 — 매칭 탭과 신규 보드에서 동시에 눌러도 안전).
  perform pg_advisory_xact_lock(hashtextextended(p_child_id::text || ':' || p_subject_id::text, 43));

  -- 1) 과목 수강 계획 — 살아있는 게 있으면 재사용(중복 방지), 없으면 생성.
  select id into v_enrollment_id
  from subject_enrollments
  where child_id = p_child_id and subject_id = p_subject_id
    and status in ('planned', 'active', 'paused')
  limit 1;

  if v_enrollment_id is null then
    select get_or_create_draft_contract_for_child(p_child_id) into v_contract_id;
    insert into subject_enrollments (child_id, subject_id, contract_id, status)
    values (p_child_id, p_subject_id, v_contract_id, 'planned')
    returning id into v_enrollment_id;
  end if;

  -- 2) 선생님 배정 — 이미 같은 조합의 active 배정이 있으면 그대로 재사용
  -- (멱등 — 중복 호출해도 새 배정을 만들지 않는다).
  select id into v_assignment_id
  from teacher_assignments
  where subject_enrollment_id = v_enrollment_id and teacher_id = p_teacher_id and status = 'active';

  if v_assignment_id is null then
    insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, changed_by, source)
    values (v_enrollment_id, p_teacher_id, 'active', now(), auth.uid(), 'app')
    returning id into v_assignment_id;
    -- teacher_assignments_enforce_rate 트리거가 유효 시급 이력이 없으면 여기서
    -- 예외를 던진다 — 이 함수 전체가 실패로 끝나 위 1)의 insert까지 롤백된다.
  end if;

  -- 3) 학생 pending -> active 자동 전환(best-effort — 실패해도 배정 자체는
  -- 되돌리지 않는다, 기존 activateStudentIfPending과 동일 정책).
  select status into v_child_status from students where id = p_child_id;
  if v_child_status = 'pending' then
    begin
      perform transition_account_status(p_child_id, 'active', '과목·선생님 배정 완료(자동 전환)');
    exception when others then
      -- 예: 13세 미만 학생의 보호자 동의 미완료 등, 배정과 무관한 이유로
      -- 활성화가 막힐 수 있다 — 기존 activateStudentIfPending과 동일하게
      -- 배정 자체는 되돌리지 않고 경고만 남긴다.
      v_activation_warning := '선생님 배정은 완료됐지만, 학생 계정을 활성 상태로 전환하지 못했습니다(' || sqlerrm || '). 관리자가 직접 확인·재처리해야 합니다.';
    end;
  end if;

  -- 4) 커리큘럼 시딩(best-effort — 실패해도 배정 자체는 되돌리지 않는다).
  begin
    v_overlay_id := seed_curriculum_overlay_for_match(v_enrollment_id, p_teacher_id, p_subject_id);
  exception when others then
    v_curriculum_warning := '선생님 배정은 완료됐지만, 학생별 커리큘럼을 만들지 못했습니다(' || sqlerrm || '). 관리자가 직접 확인·재처리해야 합니다.';
  end;

  return query select v_enrollment_id, v_assignment_id, v_overlay_id, v_activation_warning, v_curriculum_warning;
end;
$$;
revoke execute on function public.confirm_student_teacher_subject_match(uuid, uuid, uuid) from public, anon;
grant execute on function public.confirm_student_teacher_subject_match(uuid, uuid, uuid) to authenticated, service_role;
