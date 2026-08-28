-- 021에서 추가한 "수강 학생 조회" 정책이 e.student_id = auth.uid()만 확인해서
-- 학생 본인만 커버했다. 031(학부모 레슨 기록 열람)에서 학부모도 자녀의
-- 커리큘럼 진도를 봐야 하는데 처음 실제로 이 경로를 타면서 드러남 — 조인다.
drop policy "수강 학생 조회" on teacher_curriculum_templates;
create policy "수강 학생/보호자 조회" on teacher_curriculum_templates for select
  using (
    exists (
      select 1 from enrollments e
      where e.teacher_id = teacher_curriculum_templates.teacher_id
        and e.subject_id = teacher_curriculum_templates.subject_id
        and e.status = 'active'
        and (e.student_id = auth.uid() or is_guardian_of(e.student_id))
    )
  );

drop policy "수강 학생 조회" on teacher_curriculum_template_units;
create policy "수강 학생/보호자 조회" on teacher_curriculum_template_units for select
  using (
    exists (
      select 1 from teacher_curriculum_templates t
      join enrollments e
        on e.teacher_id = t.teacher_id and e.subject_id = t.subject_id
      where t.id = template_id
        and e.status = 'active'
        and (e.student_id = auth.uid() or is_guardian_of(e.student_id))
    )
  );
