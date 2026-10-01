-- P2/P3 5단계 — 회차 목표는 수업 화면의 머리말이다.
--
-- curriculum_unit_preps는 "교사의 준비 작업 공간"이라 담당 교사·관리자만 볼 수
-- 있게 만들었다. 그런데 그 안의 goal(이 회차의 목표)은 수업 화면 맨 위에 학생과
-- 보호자에게도 보여야 하는 문장이다 — 지금은 학생 화면에서 "목표가 아직
-- 적히지 않았습니다"로만 보인다(실제로는 적혀 있는데 읽지 못하는 것이다).
--
-- 준비에 담은 교재·문제 목록(curriculum_unit_prep_items)은 계속 교사 전용이다.
-- 학생이 보는 것은 수업 시작 시 고정된 목록이지, 준비 중인 후보가 아니다.
create policy "수업 당사자는 회차 목표를 읽는다" on curriculum_unit_preps for select
  using (
    exists (
      select 1
      from session_curriculum_units scu
      where scu.overlay_unit_id = curriculum_unit_preps.overlay_unit_id
        and (
          public.is_session_student_v3(scu.session_id)
          or public.is_session_guardian_v3(scu.session_id)
          or public.is_session_teacher_v3(scu.session_id)
        )
    )
  );

comment on policy "수업 당사자는 회차 목표를 읽는다" on curriculum_unit_preps is
  'P3: 실제 수업에 연결된 회차에 한해, 그 수업의 학생·보호자·담당 교사가 준비 행을 읽을 수 있다 '
  '(화면에 쓰는 것은 goal뿐이다). 연결되지 않은 회차의 준비는 여전히 담당 교사·관리자만 본다.';
