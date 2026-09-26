-- 2026-09-09(UAT 지적, 제품 오너 승인) — curriculum_docs/curriculum_doc_sections
-- 열람 RLS가 레거시 enrollments만 확인해, v3(subject_enrollments +
-- teacher_assignments) 전용 계정은 공개된 교재가 있어도 구조적으로 열람할 수
-- 없었다. 레거시 읽기 호환은 유지하되(신규 v3 흐름의 권한 원본은 v3
-- 테이블이다), 두 모델을 함께 확인하도록 조건을 확장한다.
--
-- v3 쪽도 레거시와 동일하게 "지금 활성 상태인지"가 아니라 "그 과목으로
-- subject_enrollment/teacher_assignment가 존재한 적 있는지"만 확인한다 —
-- 수강·배정이 끝난 뒤에도 과거 세션 교재를 계속 열람할 수 있어야 하므로
-- status 조건을 걸지 않는다(레거시 정책과 동일한 설계 원칙 유지).

drop policy "배포된 문서는 관련자, 초안은 작성자/관리자만" on curriculum_docs;
create policy "배포된 문서는 관련자, 초안은 작성자/관리자만" on curriculum_docs for select
  using (
    is_admin()
    or owner_teacher_id = auth.uid()
    or (
      status = 'published'
      and (
        exists (
          select 1 from enrollments e
          where e.subject_id = curriculum_docs.subject_id
            and (
              e.student_id = auth.uid()
              or e.teacher_id = auth.uid()
              or is_guardian_of(e.student_id)
            )
        )
        or exists (
          select 1 from subject_enrollments se
          where se.subject_id = curriculum_docs.subject_id
            and (
              se.child_id = auth.uid()
              or is_guardian_of(se.child_id)
              or exists (
                select 1 from teacher_assignments ta
                where ta.subject_enrollment_id = se.id and ta.teacher_id = auth.uid()
              )
            )
        )
      )
    )
  );

drop policy "상위 문서 규칙 상속" on curriculum_doc_sections;
create policy "상위 문서 규칙 상속" on curriculum_doc_sections for select
  using (
    exists (
      select 1 from curriculum_docs d
      where d.id = curriculum_doc_id
        and (
          is_admin()
          or d.owner_teacher_id = auth.uid()
          or (
            d.status = 'published'
            and (
              exists (
                select 1 from enrollments e
                where e.subject_id = d.subject_id
                  and (
                    e.student_id = auth.uid()
                    or e.teacher_id = auth.uid()
                    or is_guardian_of(e.student_id)
                  )
              )
              or exists (
                select 1 from subject_enrollments se
                where se.subject_id = d.subject_id
                  and (
                    se.child_id = auth.uid()
                    or is_guardian_of(se.child_id)
                    or exists (
                      select 1 from teacher_assignments ta
                      where ta.subject_enrollment_id = se.id and ta.teacher_id = auth.uid()
                    )
                  )
              )
            )
          )
        )
    )
  );
