-- R2 Task 6 — 26개 자기서비스 쓰기 정책의 current_account_active()를
-- current_account_access_allowed()로 교체한다(13세 미만 미동의 학생의
-- 이용 자격 차단을 반영). 정확한 현재 조건은 이 마이그레이션 작성 시점에
-- pg_policy를 직접 조회해 확인했다(R2에서 반복된 "파일만 보고 가정하면
-- 실제 조건과 어긋난다"는 교훈 재적용).
--
-- current_account_active() 자체의 의미는 바꾸지 않는다 — 계정 lifecycle만
-- 그대로 판정한다. 이 정책들의 "OR is_admin()" 분기는 그대로 둬서 관리자
-- 경로는 이번 교체와 무관하게 차단되지 않는다.

drop policy if exists "참여자 쓰기" on canvas_annotations;
create policy "참여자 쓰기" on canvas_annotations for all
  using ((is_session_participant(session_id) and current_account_access_allowed()) or is_admin())
  with check ((is_session_participant(session_id) and current_account_access_allowed()) or is_admin());

drop policy if exists "스레드 당사자 전송" on chat_messages;
create policy "스레드 당사자 전송" on chat_messages for insert
  with check (
    (exists (
      select 1 from chat_threads t
      where t.id = chat_messages.thread_id and (t.student_id = auth.uid() or t.teacher_id = auth.uid())
    )) and current_account_access_allowed()
  );

drop policy if exists "선생님/관리자만 생성" on homework_items;
create policy "선생님/관리자만 생성" on homework_items for insert
  with check (((session_teacher_id(session_id) = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "학생(답안)/선생님/관리자 수정" on homework_items;
create policy "학생(답안)/선생님/관리자 수정" on homework_items for update
  using ((is_session_participant(session_id) and current_account_access_allowed()) or is_admin())
  with check ((is_session_participant(session_id) and current_account_access_allowed()) or is_admin());

drop policy if exists "학부모 데이터 수정은 본인/관리자" on parents;
create policy "학부모 데이터 수정은 본인/관리자" on parents for update
  using (((id = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "선생님/관리자 생성" on problems;
create policy "선생님/관리자 생성" on problems for insert
  with check (is_admin() or (current_account_access_allowed() and (origin_session_id is not null) and (session_teacher_id(origin_session_id) = auth.uid())));

drop policy if exists "작성자/관리자 수정" on problems;
create policy "작성자/관리자 수정" on problems for update
  using (((created_by = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "본인 프로필 수정" on profiles;
create policy "본인 프로필 수정" on profiles for update
  using (((id = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "선생님/관리자 쓰기" on session_doc_links;
create policy "선생님/관리자 쓰기" on session_doc_links for all
  using (((session_teacher_id(session_id) = auth.uid()) and current_account_access_allowed()) or is_admin())
  with check (((session_teacher_id(session_id) = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "본인이 올린 파일만 삭제" on session_files;
create policy "본인이 올린 파일만 삭제" on session_files for delete
  using (((uploaded_by_id = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "참여자 업로드" on session_files;
create policy "참여자 업로드" on session_files for insert
  with check ((is_session_participant(session_id) and current_account_access_allowed()) or is_admin());

drop policy if exists "당사자/관리자 작성" on session_memos;
create policy "당사자/관리자 작성" on session_memos for insert
  with check ((is_enrollment_participant(enrollment_id) and current_account_access_allowed()) or is_admin());

drop policy if exists "본인 학생 수정(저장 토글 등)" on session_problem_attempts;
create policy "본인 학생 수정(저장 토글 등)" on session_problem_attempts for update
  using (((student_id = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "본인 학생 작성" on session_problem_attempts;
create policy "본인 학생 작성" on session_problem_attempts for insert
  with check (((student_id = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "담당 선생님/관리자 쓰기" on session_reviews;
create policy "담당 선생님/관리자 쓰기" on session_reviews for all
  using (((session_teacher_id(session_id) = auth.uid()) and current_account_access_allowed()) or is_admin())
  with check (((session_teacher_id(session_id) = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "본인 학생 쓰기" on session_student_feedback;
create policy "본인 학생 쓰기" on session_student_feedback for all
  using (((student_id = auth.uid()) and current_account_access_allowed()) or is_admin())
  with check (((student_id = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "당사자(주로 선생님)/관리자 수정" on sessions;
create policy "당사자(주로 선생님)/관리자 수정" on sessions for update
  using ((is_session_participant(id) and current_account_access_allowed()) or is_admin());

drop policy if exists "학생 데이터 수정은 본인/관리자" on students;
create policy "학생 데이터 수정은 본인/관리자" on students for update
  using (((id = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "본인 선생님/관리자" on teacher_curriculum_template_unit_materials;
create policy "본인 선생님/관리자" on teacher_curriculum_template_unit_materials for all
  using (is_admin() or (current_account_access_allowed() and (exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_materials.unit_id and t.teacher_id = auth.uid()
  ))))
  with check (is_admin() or (current_account_access_allowed() and (exists (
    select 1 from teacher_curriculum_template_units u
    join teacher_curriculum_templates t on t.id = u.template_id
    where u.id = teacher_curriculum_template_unit_materials.unit_id and t.teacher_id = auth.uid()
  ))));

drop policy if exists "본인 선생님/관리자 쓰기" on teacher_curriculum_template_units;
create policy "본인 선생님/관리자 쓰기" on teacher_curriculum_template_units for all
  using (is_admin() or (current_account_access_allowed() and (exists (
    select 1 from teacher_curriculum_templates t
    where t.id = teacher_curriculum_template_units.template_id and t.teacher_id = auth.uid()
  ))))
  with check (is_admin() or (current_account_access_allowed() and (exists (
    select 1 from teacher_curriculum_templates t
    where t.id = teacher_curriculum_template_units.template_id and t.teacher_id = auth.uid()
  ))));

drop policy if exists "본인 선생님/관리자 쓰기" on teacher_curriculum_templates;
create policy "본인 선생님/관리자 쓰기" on teacher_curriculum_templates for all
  using (((teacher_id = auth.uid()) and current_account_access_allowed()) or is_admin())
  with check (((teacher_id = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "담당 선생님/관리자 쓰기" on teacher_problem_tags;
create policy "담당 선생님/관리자 쓰기" on teacher_problem_tags for all
  using (is_admin() or (current_account_access_allowed() and (teacher_id = auth.uid()) and (exists (
    select 1 from session_problem_attempts spa
    where spa.id = teacher_problem_tags.attempt_id and teaches_student(spa.student_id)
  ))))
  with check (is_admin() or (current_account_access_allowed() and (teacher_id = auth.uid()) and (exists (
    select 1 from session_problem_attempts spa
    where spa.id = teacher_problem_tags.attempt_id and teaches_student(spa.student_id)
  ))));

drop policy if exists "선생님 데이터 수정은 본인/관리자" on teachers;
create policy "선생님 데이터 수정은 본인/관리자" on teachers for update
  using (((id = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "본인 학생만 삭제" on vocab_words;
create policy "본인 학생만 삭제" on vocab_words for delete
  using (((student_id = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "본인 학생만 수정" on vocab_words;
create policy "본인 학생만 수정" on vocab_words for update
  using (((student_id = auth.uid()) and current_account_access_allowed()) or is_admin());

drop policy if exists "학생 본인 또는 담당 선생님 추가" on vocab_words;
create policy "학생 본인 또는 담당 선생님 추가" on vocab_words for insert
  with check ((current_account_access_allowed() and ((student_id = auth.uid()) or teaches_student(student_id))) or is_admin());
