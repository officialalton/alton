-- parent_requests의 insert 정책이 "본인 학부모 작성"이라 학부모만 쓸 수 있었는데,
-- 024(수업권 탭)의 "부모님께 결제 요청" 버튼은 반대 방향(학생 → 자기 보호자)이다.
-- 자기 보호자 앞으로 남기는 요청만 허용하도록 학생 케이스를 추가한다.
drop policy "본인 학부모 작성" on parent_requests;
create policy "본인 학부모/자녀→보호자 작성" on parent_requests for insert
  with check (
    parent_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from guardian_students gs
      where gs.parent_id = parent_requests.parent_id
        and gs.student_id = auth.uid()
    )
  );
