-- problems insert 정책이 "created_by = auth.uid()"만 확인해서, 아무 로그인 사용자나
-- 자신을 created_by로 설정하면 임의의 세션에 문제를 끼워넣을 수 있었다.
-- 선생님(해당 세션 담당)/관리자만 삽입 가능하도록 조인다.
drop policy "선생님/관리자 생성" on problems;
create policy "선생님/관리자 생성" on problems for insert
  with check (
    is_admin()
    or (origin_session_id is not null and session_teacher_id(origin_session_id) = auth.uid())
  );
