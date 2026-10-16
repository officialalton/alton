-- C-1(2026-09-10, 제품 오너 승인) — 학생별 커리큘럼 표시·진입 경로·교사
-- 운영본 필수화.
--
-- 요구사항 4·5: 체험→정규 전환 배정 폼은 "해당 과목 운영본이 존재하는
-- 교사만" 선택하게 하고, UI 필터만이 아니라 공통 매칭 서버/RPC 경로에서도
-- 검증해 우회 호출을 막는다. 지금까지 app/admin/matching-data.ts의
-- loadTeacherCandidatesBySubject()가 UI 후보를 이미 teacher_curriculum_templates
-- 존재 여부로 걸러왔지만(자유 입력 아님), 그 필터는 화면단일 뿐 RPC를 직접
-- 호출하면 운영본이 없는 교사도 배정될 수 있었다 — confirm_student_teacher_
-- subject_match()에 서버측 가드를 추가한다.
--
-- "운영본이 존재한다"는 teacher_curriculum_templates 행 존재만으로는
-- 부족하다고 판단한다(단원 0개인 빈 템플릿은 실제로 가르칠 커리큘럼이
-- 없는 것과 같다) — teacher_curriculum_template_units가 최소 1개 있어야
-- 통과한다. app/admin/matching-data.ts::loadTeacherCandidatesBySubject()도
-- 같은 기준으로 함께 좁혀 UI 후보와 서버 검증이 항상 일치하게 한다(별도
-- 코드 수정).
--
-- 요구사항 6: 신규 매칭은 공통 원본(subject_template_units) 폴백을 쓰지
-- 않는다. 이 가드가 배정 자체를 막으므로, seed_curriculum_overlay_for_match()의
-- 기존 폴백 분기(교사 운영본이 없으면 ensure_active_curriculum_overlay()로
-- 관리자 공통 원본을 복제)는 이 RPC를 통한 신규 매칭에서는 더 이상 도달하지
-- 않는다 — 그 함수 자체는 다른 경로(레거시 admin/matching-actions.ts)의
-- 기존 동작을 보존하기 위해 수정하지 않는다. 기존에 이미 만들어진 매칭·
-- 오버레이는 이 migration으로 전혀 건드리지 않는다(강제 전환 없음).
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

  -- C-1: 이 선생님이 이 과목의 운영 커리큘럼(단원 1개 이상)을 갖고 있어야만
  -- 배정을 허용한다 — UI 필터 우회(직접 RPC 호출) 방어.
  if not exists (
    select 1
    from teacher_curriculum_templates t
    join teacher_curriculum_template_units u on u.template_id = t.id
    where t.teacher_id = p_teacher_id and t.subject_id = p_subject_id
  ) then
    raise exception '선택한 선생님은 이 과목의 운영 커리큘럼이 없어 배정할 수 없습니다.';
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
      v_activation_warning := '선생님 배정은 완료됐지만, 학생 계정을 활성 상태로 전환하지 못했습니다(' || sqlerrm || '). 관리자가 직접 확인·재처리해야 합니다.';
    end;
  end if;

  -- 4) 커리큘럼 시딩(best-effort — 실패해도 배정 자체는 되돌리지 않는다).
  -- C-1 가드 덕분에 teacher_curriculum_templates가 항상 존재하므로
  -- seed_curriculum_overlay_for_match() 내부의 공통 원본 폴백 분기는 이
  -- 경로에서 더 이상 실행되지 않는다.
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

comment on function public.confirm_student_teacher_subject_match(uuid, uuid, uuid) is
  'C-1(2026-09-10): 선생님이 해당 과목의 운영 커리큘럼(단원 1개 이상)을 가지고 있어야만 배정을 허용한다 — UI 후보 필터(loadTeacherCandidatesBySubject)와 동일 기준을 서버에서도 강제해 직접 RPC 호출로 우회할 수 없다.';
