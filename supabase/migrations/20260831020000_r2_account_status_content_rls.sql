-- R2 — Task 2 보완 (항목 4, DB 레벨): 계정 상태를 세션 콘텐츠 전반의 RLS에도
-- 강제한다.
--
-- 배경: 서버 액션 감사 결과, chat_messages 외에도 수업/과제/화이트보드/단어장/
-- 리뷰/커리큘럼 등 다수의 자기서비스 쓰기 경로가 계정 상태를 전혀 확인하지
-- 않았다. 서버 액션 레벨 가드(requireUser())는 별도로 적용하지만(앱 코드),
-- "서버와 DB 양쪽에서 차단"이라는 요구에 따라 RLS 자체도 우회 불가능하게
-- 만든다 — R1/R2에서 반복적으로 확인된 원칙(우회하기 어려운 DB 함수가
-- 유일한 진짜 방어선)을 그대로 적용한다.
--
-- 패턴: 기존 정책의 "본인" 분기(예: teacher_id = auth.uid())에만
-- `and current_account_active()`를 추가한다. `is_admin()` 분기는 그대로 둔다
-- (관리자는 이번 상태 모델의 게이트 대상이 아니다 — §5.7/정책 확정 10번).

-- ---------------------------------------------------------------------------
-- 핵심 프로필 자기 수정(본인 계정 자체의 변경도 "변경 작업"이다)
-- ---------------------------------------------------------------------------
drop policy "본인 프로필 수정" on profiles;
create policy "본인 프로필 수정" on profiles for update
  using ((id = auth.uid() and current_account_active()) or is_admin());

drop policy "학생 데이터 수정은 본인/관리자" on students;
create policy "학생 데이터 수정은 본인/관리자" on students for update
  using ((id = auth.uid() and current_account_active()) or is_admin());

drop policy "선생님 데이터 수정은 본인/관리자" on teachers;
create policy "선생님 데이터 수정은 본인/관리자" on teachers for update
  using ((id = auth.uid() and current_account_active()) or is_admin());

drop policy "학부모 데이터 수정은 본인/관리자" on parents;
create policy "학부모 데이터 수정은 본인/관리자" on parents for update
  using ((id = auth.uid() and current_account_active()) or is_admin());

-- ---------------------------------------------------------------------------
-- 선생님 커리큘럼(내 과목)
-- ---------------------------------------------------------------------------
drop policy "본인 선생님/관리자 쓰기" on teacher_curriculum_templates;
create policy "본인 선생님/관리자 쓰기" on teacher_curriculum_templates for all
  using ((teacher_id = auth.uid() and current_account_active()) or is_admin())
  with check ((teacher_id = auth.uid() and current_account_active()) or is_admin());

drop policy "본인 선생님/관리자 쓰기" on teacher_curriculum_template_units;
create policy "본인 선생님/관리자 쓰기" on teacher_curriculum_template_units for all
  using (
    is_admin()
    or (current_account_active() and exists (select 1 from teacher_curriculum_templates t where t.id = template_id and t.teacher_id = auth.uid()))
  )
  with check (
    is_admin()
    or (current_account_active() and exists (select 1 from teacher_curriculum_templates t where t.id = template_id and t.teacher_id = auth.uid()))
  );

drop policy "본인 선생님/관리자" on teacher_curriculum_template_unit_materials;
create policy "본인 선생님/관리자" on teacher_curriculum_template_unit_materials for all
  using (
    is_admin()
    or (
      current_account_active()
      and exists (
        select 1 from teacher_curriculum_template_units u
        join teacher_curriculum_templates t on t.id = u.template_id
        where u.id = unit_id and t.teacher_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 세션 콘텐츠(메모/과제/문제풀이/단어장/자료링크/화이트보드)
-- ---------------------------------------------------------------------------
drop policy "당사자/관리자 작성" on session_memos;
create policy "당사자/관리자 작성" on session_memos for insert
  with check ((is_enrollment_participant(enrollment_id) and current_account_active()) or is_admin());

-- (2026-08-30 정정) 아래부터는 처음 작성 시 base 마이그레이션 파일만 보고
-- 정책 조건을 가정했다가, 이후 여러 소규모 패치(20260828070000/080000/090000/
-- 100000/110000)가 이름·조건을 바꿔놓은 걸 놓친 채 첫 실행이 "policy ... does
-- not exist" 오류로 실패했다. 실제 DB(`pg_policy`)를 직접 조회해 현재 조건을
-- 확인한 뒤 정확히 그 조건에 `current_account_active()`만 추가하도록 다시
-- 작성했다.
drop policy "선생님/관리자만 생성" on homework_items;
create policy "선생님/관리자만 생성" on homework_items for insert
  with check ((session_teacher_id(session_id) = auth.uid() and current_account_active()) or is_admin());
drop policy "학생(답안)/선생님/관리자 수정" on homework_items;
create policy "학생(답안)/선생님/관리자 수정" on homework_items for update
  using ((is_session_participant(session_id) and current_account_active()) or is_admin());

drop policy "본인 학생 작성" on session_problem_attempts;
create policy "본인 학생 작성" on session_problem_attempts for insert
  with check ((student_id = auth.uid() and current_account_active()) or is_admin());
drop policy "본인 학생 수정(저장 토글 등)" on session_problem_attempts;
create policy "본인 학생 수정(저장 토글 등)" on session_problem_attempts for update
  using ((student_id = auth.uid() and current_account_active()) or is_admin());

-- teacher_problem_tags: "관련 선생님/관리자"는 20260828110000에서 "담당
-- 선생님/관리자 쓰기"로 이름이 바뀌고 조건도 "가르치는 학생인지" 확인이
-- 추가됐다 — 그 최신 조건을 그대로 유지하며 계정 상태만 더한다.
drop policy "담당 선생님/관리자 쓰기" on teacher_problem_tags;
create policy "담당 선생님/관리자 쓰기" on teacher_problem_tags for all
  using (
    is_admin()
    or (
      current_account_active()
      and teacher_id = auth.uid()
      and exists (select 1 from session_problem_attempts spa where spa.id = attempt_id and teaches_student(spa.student_id))
    )
  )
  with check (
    is_admin()
    or (
      current_account_active()
      and teacher_id = auth.uid()
      and exists (select 1 from session_problem_attempts spa where spa.id = attempt_id and teaches_student(spa.student_id))
    )
  );

-- vocab_words: "본인 학생 쓰기"(ALL)는 20260828070000에서 insert/update/delete
-- 3개로 분리되고 insert는 담당 선생님도 허용하도록 넓어졌다 — 그 구조를 유지.
drop policy "학생 본인 또는 담당 선생님 추가" on vocab_words;
create policy "학생 본인 또는 담당 선생님 추가" on vocab_words for insert
  with check (
    current_account_active() and (student_id = auth.uid() or teaches_student(student_id))
    or is_admin()
  );
drop policy "본인 학생만 수정" on vocab_words;
create policy "본인 학생만 수정" on vocab_words for update
  using ((student_id = auth.uid() and current_account_active()) or is_admin())
  with check ((student_id = auth.uid() and current_account_active()) or is_admin());
drop policy "본인 학생만 삭제" on vocab_words;
create policy "본인 학생만 삭제" on vocab_words for delete
  using ((student_id = auth.uid() and current_account_active()) or is_admin());

-- session_doc_links: "선생님/관리자 쓰기"는 20260828100000에서 조건이
-- is_session_participant → session_teacher_id(담당 선생님만)로 좁혀졌다.
drop policy "선생님/관리자 쓰기" on session_doc_links;
create policy "선생님/관리자 쓰기" on session_doc_links for all
  using ((session_teacher_id(session_id) = auth.uid() and current_account_active()) or is_admin())
  with check ((session_teacher_id(session_id) = auth.uid() and current_account_active()) or is_admin());

drop policy "참여자 업로드" on session_files;
create policy "참여자 업로드" on session_files for insert
  with check ((is_session_participant(session_id) and current_account_active()) or is_admin());
drop policy "본인이 올린 파일만 삭제" on session_files;
create policy "본인이 올린 파일만 삭제" on session_files for delete
  using ((uploaded_by_id = auth.uid() and current_account_active()) or is_admin());

drop policy "참여자 쓰기" on canvas_annotations;
create policy "참여자 쓰기" on canvas_annotations for all
  using ((is_session_participant(session_id) and current_account_active()) or is_admin())
  with check ((is_session_participant(session_id) and current_account_active()) or is_admin());

-- 화이트보드 저장은 scratchpad-actions.ts가 sessions 테이블(whiteboard_strokes
-- 컬럼)을 직접 UPDATE한다 — sessions의 기존 "당사자(주로 선생님)/관리자 수정"
-- 정책에도 계정 상태 검사를 추가한다.
drop policy "당사자(주로 선생님)/관리자 수정" on sessions;
create policy "당사자(주로 선생님)/관리자 수정" on sessions for update
  using ((is_session_participant(id) and current_account_active()) or is_admin());

-- ---------------------------------------------------------------------------
-- 리뷰 / 학생 피드백
-- ---------------------------------------------------------------------------
drop policy "담당 선생님/관리자 쓰기" on session_reviews;
create policy "담당 선생님/관리자 쓰기" on session_reviews for all
  using ((session_teacher_id(session_id) = auth.uid() and current_account_active()) or is_admin())
  with check ((session_teacher_id(session_id) = auth.uid() and current_account_active()) or is_admin());

drop policy "본인 학생 쓰기" on session_student_feedback;
create policy "본인 학생 쓰기" on session_student_feedback for all
  using ((student_id = auth.uid() and current_account_active()) or is_admin())
  with check ((student_id = auth.uid() and current_account_active()) or is_admin());

-- ---------------------------------------------------------------------------
-- 문제(AI 생성 포함) — aigen-actions.ts가 problems/homework_items에 쓴다.
-- homework_items는 위에서 이미 처리했다. problems의 insert 조건은
-- 20260828090000에서 "담당 선생님만"(origin_session_id 기준)으로 좁혀졌다.
-- ---------------------------------------------------------------------------
drop policy "선생님/관리자 생성" on problems;
create policy "선생님/관리자 생성" on problems for insert
  with check (
    is_admin()
    or (current_account_active() and origin_session_id is not null and session_teacher_id(origin_session_id) = auth.uid())
  );
drop policy "작성자/관리자 수정" on problems;
create policy "작성자/관리자 수정" on problems for update
  using ((created_by = auth.uid() and current_account_active()) or is_admin());
