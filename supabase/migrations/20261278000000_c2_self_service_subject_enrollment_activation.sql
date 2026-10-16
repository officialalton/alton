-- C-2(2026-09-11, 3차 보완, 제품 오너 지시) — "계약·수업권 등 기존 활성화
-- 조건을 모두 충족한 재매칭 건이 activation_pending에 계속 머물러서는
-- 안 된다. '과목 선택 → 선생님 선택 → 매칭 확인' 흐름에서 필요한 활성화
-- 까지 처리돼야 한다"는 지시에 따라, 별도 관리자 버튼이나 대기 안내만
-- 추가하는 대신 실제로 활성화를 진행하는 자가서비스 RPC를 추가한다.
--
-- 정책 근거: M4(20261023000000_m4_activation_contract_only_gate.sql)가
-- 이미 "활성화(planned→active) 조건은 기본계약 active 하나뿐"으로
-- 단순화했다("결제 없이는 예약 자체가 불가능해 이중 게이트가 불필요"). 즉
-- 계약이 active라는 사실 자체가 이미 충분한 승인 근거이고, 이 활성화는
-- 관리자의 별도 판단이 필요한 재량 행위가 아니다 — 그래서 관리자
-- capability 없이도 본인 학생/보호자가 직접 호출할 수 있는 자가서비스
-- RPC로 만든다(fail-closed: 조건 미충족이면 아무것도 바꾸지 않고 false만
-- 반환, 새 승인 로직을 만들지 않는다).
create or replace function public.activate_subject_enrollment_if_ready(p_subject_enrollment_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_child_id uuid;
begin
  select child_id into v_child_id from subject_enrollments where id = p_subject_enrollment_id;
  if v_child_id is null then
    raise exception '존재하지 않는 수강(subject_enrollment)입니다: %', p_subject_enrollment_id;
  end if;

  if not (
    v_child_id = auth.uid()
    or is_guardian_of(v_child_id)
    or is_household_guardian_of(v_child_id)
    or is_admin()
    or current_user_has_capability('매칭권한')
  ) then
    raise exception '이 수강에 접근할 권한이 없습니다.';
  end if;

  -- 기존 활성화 판정 경로(R5/M4)를 그대로 재사용한다 — 새 조건을 만들지 않는다.
  if not subject_enrollment_activation_ready(p_subject_enrollment_id) then
    return false;
  end if;

  update subject_enrollments
    set status = 'active', updated_at = now()
    where id = p_subject_enrollment_id and status = 'planned';

  return found;
end;
$$;
revoke execute on function public.activate_subject_enrollment_if_ready(uuid) from public, anon;
grant execute on function public.activate_subject_enrollment_if_ready(uuid) to authenticated, service_role;
comment on function public.activate_subject_enrollment_if_ready(uuid) is
  'C-2(2026-09-11): 기본계약이 이미 active인 planned 수강 건을 즉시 active로
   전환하는 자가서비스 RPC(본인 학생/보호자/관리자 호출 가능). M4가 활성화
   조건을 "기본계약 active"만으로 단순화했으므로 별도 관리자 승인이 필요
   없다 — 조건 미충족이면 아무것도 바꾸지 않고 false만 반환(멱등, 안전하게
   반복 호출 가능).';

-- confirm_student_teacher_subject_match()에도 같은 시도를 추가한다 — 매칭
-- 확정 시점에 계약이 이미 active라면("과목 선택 → 선생님 선택 → 매칭
-- 확인" 흐름 그 자체에서) 바로 활성화까지 끝나도록. 계약이 아직 draft인
-- 일반적인 경우(체험 단계)에는 subject_enrollment_activation_ready()가
-- false를 반환해 아무 것도 바뀌지 않는다 — 기존 동작과 동일.
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

  -- 3.5) 과목 수강 활성화(best-effort) — C-2(2026-09-11): 계약이 이미
  -- active라면 매칭 확인 시점에 바로 planned→active까지 끝낸다. 계약이
  -- 아직 draft(체험 단계 등)면 activate_subject_enrollment_if_ready()가
  -- 조용히 false를 반환할 뿐이다 — 예외를 던지지 않으므로 이 블록은
  -- 실패할 일이 없지만, 배정 자체를 절대 되돌리지 않는다는 원칙은
  -- 다른 best-effort 블록과 동일하게 지킨다.
  begin
    perform activate_subject_enrollment_if_ready(v_enrollment_id);
  exception when others then
    null;
  end;

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
  'C-1/C-2(2026-09-11): 선생님이 해당 과목의 운영 커리큘럼(단원 1개 이상)을 가지고 있어야만 배정을 허용한다.
   매칭 확인 시점에 기본계약이 이미 active면 과목 수강도 바로 활성화까지 끝낸다(activate_subject_enrollment_if_ready,
   best-effort) — UI 후보 필터(loadTeacherCandidatesBySubject)와 동일 기준을 서버에서도 강제해 직접 RPC 호출로
   우회할 수 없다.';
