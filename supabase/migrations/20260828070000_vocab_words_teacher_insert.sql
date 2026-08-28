-- 013-session-vocab 실제 테스트 중 발견: vocab_words의 "본인 학생 쓰기" 정책이
-- insert/update/delete를 전부 student_id = auth.uid()로 묶어놨었다. 그런데
-- 세션뷰에서는 선생님도 교재의 단어를 클릭해 학생 단어장에 추가할 수 있게
-- 설계했는데(수업 중 선생님이 어려운 단어를 짚어주는 경우), RLS가 이를 막고
-- 있었다 — insert는 명시적 에러로 드러났고, 선생님이 "삭제"를 눌렀을 때는
-- 0행이 매칭돼 조용히 무시되는(에러 없이 아무 일도 안 일어나는) 형태로
-- 드러나서 더 위험했다.
--
-- 추가(insert)는 학생 본인 또는 담당 선생님 모두 허용하고, 수정/삭제는
-- 학생 본인(또는 관리자)만 가능하도록 분리한다 — 단어장은 학생 개인 소유물이라
-- 삭제까지 선생님에게 열어줄 이유는 없다고 판단.

drop policy if exists "본인 학생 쓰기" on vocab_words;

create policy "학생 본인 또는 담당 선생님 추가" on vocab_words for insert
  with check (
    student_id = auth.uid()
    or teaches_student(student_id)
    or is_admin()
  );

create policy "본인 학생만 수정" on vocab_words for update
  using (student_id = auth.uid() or is_admin())
  with check (student_id = auth.uid() or is_admin());

create policy "본인 학생만 삭제" on vocab_words for delete
  using (student_id = auth.uid() or is_admin());
