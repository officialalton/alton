-- session_doc_links 쓰기 정책이 "선생님/관리자 쓰기"라는 이름과 달리
-- is_session_participant()로 학생도 포함해서 허용하고 있었다 (homework_items와
-- 동일한 종류의 버그, 20260828080000에서 이미 한 번 고친 패턴).
-- 016(연습장) 구현으로 실제 쓰기 경로가 생기므로 지금 조인다.
drop policy "선생님/관리자 쓰기" on session_doc_links;
create policy "선생님/관리자 쓰기" on session_doc_links for all
  using (session_teacher_id(session_id) = auth.uid() or is_admin())
  with check (session_teacher_id(session_id) = auth.uid() or is_admin());
