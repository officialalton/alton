-- curriculum_docs의 select 정책이 "status='published'"만 확인해서, 로그인만 하면
-- 수강 여부와 무관하게 아무 학생/선생님이나 모든 과목의 모든 교재를 열람할 수
-- 있었다. 023(교재 라이브러리)에서 처음으로 "내가 수강 중인 과목의 교재만"이라는
-- 화면이 실제로 이 경로를 쓰게 되므로 지금 조인다.
--
-- 활성 여부가 아니라 "그 과목으로 enrollment가 존재한 적 있는지"만 확인한다
-- (status 조건을 걸지 않음) — 그래야 수강이 끝나거나 취소된 뒤에도 과거 세션의
-- 교재(세션뷰)를 계속 열람할 수 있다. "지금 수강 중인 과목만" 좁히는 건
-- 애플리케이션 쿼리(023의 라이브러리 목록)에서 처리한다.
drop policy "배포된 문서는 전체, 초안은 작성자/관리자만" on curriculum_docs;
create policy "배포된 문서는 관련자, 초안은 작성자/관리자만" on curriculum_docs for select
  using (
    is_admin()
    or owner_teacher_id = auth.uid()
    or (
      status = 'published'
      and exists (
        select 1 from enrollments e
        where e.subject_id = curriculum_docs.subject_id
          and (
            e.student_id = auth.uid()
            or e.teacher_id = auth.uid()
            or is_guardian_of(e.student_id)
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
            and exists (
              select 1 from enrollments e
              where e.subject_id = d.subject_id
                and (
                  e.student_id = auth.uid()
                  or e.teacher_id = auth.uid()
                  or is_guardian_of(e.student_id)
                )
            )
          )
        )
    )
  );
