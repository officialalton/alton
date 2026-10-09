-- C-2(2026-09-11, 제품 오너 승인) — 매칭 종료·재매칭: 재배정에도 신규 매칭과
-- 동일한 "선생님 운영 커리큘럼 보유" 서버 가드를 적용한다.
--
-- 배경: C-1(20261274000000)이 confirm_student_teacher_subject_match()(신규
-- 매칭)에 "선택한 선생님이 이 과목의 운영 커리큘럼(teacher_curriculum_templates
-- + teacher_curriculum_template_units 1개 이상)을 갖고 있어야 배정 가능" 서버
-- 가드를 추가했지만, 재배정 경로인 change_teacher_assignment()(R5,
-- 20260925000000)에는 이 가드가 없었다. UI 후보 목록(app/admin/matching-data.ts
-- ::loadTeacherCandidatesBySubject(), C-1 때 이미 커리큘럼 보유자로 좁혀짐)이라
-- 화면상으로는 안 보이지만, RPC를 직접 호출하면 커리큘럼 없는 선생님도
-- 재배정될 수 있었다 — C-1이 신규 매칭에서 막은 것과 동일한 우회 구멍이
-- 재배정 경로(관리자 수동 "선생님 변경" + M3 배정 종료의 "재배정" resolution
-- 둘 다 이 RPC 하나를 공유)에 그대로 남아 있었다.
--
-- 제품 오너 확정(2026-09-11): 신규 매칭·재배정 모두 동일 기준, 직접 호출 우회
-- 불가. 조건 미충족 시 기존 배정·예약·학생 커리큘럼은 전혀 바뀌지 않아야
-- 한다 — 아래 가드를 함수의 다른 모든 검증·잠금·변경보다 먼저 둬서, 실패
-- 시 이 트랜잭션이 어떤 행도 건드리기 전에 예외로 종료되게 한다. 이 검사는
-- 새 교사의 "배정 자격" 확인일 뿐이다 — 기존 학생 커리큘럼 오버레이나 지난
-- 수업 기록을 새 교사 운영본으로 자동 덮어쓰는 근거로 쓰지 않는다(그런 로직
-- 자체를 추가하지 않았다). student_curriculum_overlays는 애초에
-- subject_enrollment_id 단위(교사 단위가 아님)라 재배정 후에도 같은 오버레이가
-- 그대로 유지되고, RLS(is_active_teacher_for_enrollment)가 활성 배정을 따라가
-- 새 교사가 자동으로 접근 권한을 얻는다 — 별도 데이터 이관이 필요 없다.
create or replace function public.change_teacher_assignment(
  p_subject_enrollment_id uuid,
  p_new_teacher_id uuid,
  p_effective_from timestamptz,
  p_reason text,
  p_changed_by uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_current record;
  v_new_id uuid;
  v_subject_id uuid;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'p_reason은 비어 있을 수 없습니다.';
  end if;
  if not has_valid_current_teacher_rate(p_new_teacher_id) then
    raise exception '선생님(%)에게 유효한 현재 시급 이력이 없어 배정할 수 없습니다.', p_new_teacher_id;
  end if;

  select subject_id into v_subject_id from subject_enrollments where id = p_subject_enrollment_id;
  if v_subject_id is null then
    raise exception '존재하지 않는 수강(subject_enrollment)입니다.';
  end if;

  -- C-2: confirm_student_teacher_subject_match()(C-1)와 동일한 가드 — 재배정도
  -- 예외 없이 이 기준을 통과해야 한다.
  if not exists (
    select 1
    from teacher_curriculum_templates t
    join teacher_curriculum_template_units u on u.template_id = t.id
    where t.teacher_id = p_new_teacher_id and t.subject_id = v_subject_id
  ) then
    raise exception '선택한 선생님은 이 과목의 운영 커리큘럼이 없어 배정할 수 없습니다.';
  end if;

  -- 같은 수강의 기존 활성 배정을 잠가 동시 변경을 직렬화한다(시급 변경과 동일 패턴).
  perform 1 from teacher_assignments
    where subject_enrollment_id = p_subject_enrollment_id and status in ('planned', 'active')
    for update;

  select * into v_current from teacher_assignments
    where subject_enrollment_id = p_subject_enrollment_id and status = 'active'
    order by effective_from desc limit 1;

  if v_current.id is not null then
    if p_effective_from <= v_current.effective_from then
      raise exception '새 effective_from(%)은 기존 활성 배정의 effective_from(%)보다 이후여야 합니다.', p_effective_from, v_current.effective_from;
    end if;
    update teacher_assignments
      set status = 'ended', effective_until = p_effective_from
      where id = v_current.id;
  end if;

  -- 채팅 스레드 archive를 새 teacher_assignments 행 생성보다 먼저 실행한다 — 순서를
  -- 반대로 하면(2026-09-02 발견, 후속 마이그레이션 20260925010000의 AFTER INSERT
  -- 트리거가 새 스레드를 이미 만든 뒤에 이 UPDATE가 "이 수강의 active 스레드 전부"를
  -- archive해버려 방금 만든 새 스레드까지 archived로 잘못 바뀌는 버그가 있었다).
  update subject_threads
    set status = 'archived', archived_at = now()
    where subject_enrollment_id = p_subject_enrollment_id and status = 'active';

  insert into teacher_assignments (
    subject_enrollment_id, teacher_id, status, effective_from, reason, changed_by, source
  ) values (
    p_subject_enrollment_id, p_new_teacher_id, 'active', p_effective_from, p_reason, p_changed_by, 'app'
  )
  returning id into v_new_id;
  -- 새 스레드는 teacher_assignments_ensure_subject_thread 트리거(20260925010000)가
  -- 위 INSERT 시점에 자동으로 만든다 — 여기서 다시 만들 필요 없음(중복 방지를 위해
  -- 명시적 insert를 두지 않는다).

  -- 문서 권한 재처리 큐: 이전 선생님 회수 + 새 선생님 부여, 둘 다 재시도 가능한 work-item.
  if v_current.id is not null then
    insert into document_permission_retries (subject_enrollment_id, teacher_id, action, reason)
    values (p_subject_enrollment_id, v_current.teacher_id, 'revoke', 'teacher_change:' || p_reason);
  end if;
  insert into document_permission_retries (subject_enrollment_id, teacher_id, action, reason)
  values (p_subject_enrollment_id, p_new_teacher_id, 'grant', 'teacher_change:' || p_reason);

  return v_new_id;
end;
$$;
revoke execute on function public.change_teacher_assignment(uuid, uuid, timestamptz, text, uuid) from public, anon, authenticated;
grant execute on function public.change_teacher_assignment(uuid, uuid, timestamptz, text, uuid) to service_role;
comment on function public.change_teacher_assignment(uuid, uuid, timestamptz, text, uuid) is
  'R5/C-2: 선생님 변경의 유일한 정상 경로(M3 배정 종료의 "재배정" resolution도 이 함수를 공유).
   C-2(2026-09-11): 새 선생님이 이 과목의 운영 커리큘럼(단원 1개 이상)을 갖고 있어야만 통과하며,
   이 검사가 다른 모든 잠금·변경보다 먼저 실행되어 실패 시 기존 배정·예약·학생 커리큘럼을 전혀
   건드리지 않는다. 기존 활성 배정 종료 + 신규 배정 생성 + 채팅 스레드 archive/신규 생성 + 문서
   권한 재처리 큐 등록을 하나의 트랜잭션으로 수행. 서버 액션(service_role)만 호출.';
