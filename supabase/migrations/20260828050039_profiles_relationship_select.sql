-- 010-session-shell 작업 중 발견: profiles 조회 정책이 "본인/관리자"로만 좁혀져 있어서
-- 선생님이 자기 학생 이름을, 학부모가 자녀 이름을(또는 그 반대) 볼 수 없었다.
-- 세션뷰 상단바에 "과목 · 학생명 · N회차"를 보여주려면 최소한 이 관계들은 서로 이름을
-- 조회할 수 있어야 한다.

drop policy if exists "본인 프로필 조회" on profiles;

create policy "본인/관계자/관리자 조회" on profiles for select
  using (
    id = auth.uid()
    or is_admin()
    or exists (
      select 1 from enrollments e
      where (e.student_id = profiles.id and e.teacher_id = auth.uid())
         or (e.teacher_id = profiles.id and e.student_id = auth.uid())
    )
    or exists (
      select 1 from guardian_students gs
      where (gs.student_id = profiles.id and gs.parent_id = auth.uid())
         or (gs.parent_id = profiles.id and gs.student_id = auth.uid())
    )
  );
