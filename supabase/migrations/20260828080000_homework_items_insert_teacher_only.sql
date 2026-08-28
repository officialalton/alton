-- 014-session-homework 구현 중 발견: homework_items의 insert 정책 이름은
-- "선생님/관리자 생성"인데 실제 using/check는 is_session_participant(양쪽 다
-- 포함)라서 학생도 새 과제 행을 만들 수 있었다. 목업에서 "+ 과제 추가" 버튼은
-- 선생님에게만 보이므로, 실제 정책도 그렇게 좁힌다. 학생은 기존 행의
-- student_answer만 수정(update 정책은 그대로 유지).

drop policy if exists "선생님/관리자 생성" on homework_items;

create policy "선생님/관리자만 생성" on homework_items for insert
  with check (session_teacher_id(session_id) = auth.uid() or is_admin());
