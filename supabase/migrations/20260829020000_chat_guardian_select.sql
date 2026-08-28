-- 목업의 메신저 화면 문구("이 대화는 학부모님과 관리자가 항상 열람할 수
-- 있습니다")와 달리, chat_threads/chat_messages의 select 정책엔 학부모
-- 접근권이 아예 빠져있었다. 022(선생님 탭/메시지)에서 처음 실제로 이
-- 테이블들을 쓰게 되므로 지금 조인다.
drop policy "당사자/관리자 조회" on chat_threads;
create policy "당사자/보호자/관리자 조회" on chat_threads for select
  using (
    student_id = auth.uid()
    or teacher_id = auth.uid()
    or is_guardian_of(student_id)
    or is_admin()
  );

drop policy "스레드 당사자/관리자 조회" on chat_messages;
create policy "스레드 당사자/보호자/관리자 조회" on chat_messages for select
  using (
    exists (
      select 1 from chat_threads t where t.id = thread_id
        and (
          t.student_id = auth.uid()
          or t.teacher_id = auth.uid()
          or is_guardian_of(t.student_id)
          or is_admin()
        )
    )
  );
