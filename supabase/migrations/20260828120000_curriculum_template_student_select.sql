-- teacher_curriculum_templates/teacher_curriculum_template_units의 select 정책이
-- 선생님 전용이라, 정작 그 커리큘럼을 배정받아 수강 중인 학생 본인은 자신의
-- 진도(021 커리큘럼 뷰)를 전혀 읽을 수 없었다. 해당 선생님×과목으로 활성
-- enrollment가 있는 학생에게 조회를 열어준다.
create policy "수강 학생 조회" on teacher_curriculum_templates for select
  using (
    exists (
      select 1 from enrollments e
      where e.teacher_id = teacher_curriculum_templates.teacher_id
        and e.subject_id = teacher_curriculum_templates.subject_id
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
  );

create policy "수강 학생 조회" on teacher_curriculum_template_units for select
  using (
    exists (
      select 1 from teacher_curriculum_templates t
      join enrollments e
        on e.teacher_id = t.teacher_id and e.subject_id = t.subject_id
      where t.id = template_id
        and e.student_id = auth.uid()
        and e.status = 'active'
    )
  );
