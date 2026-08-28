-- 017(문제 기록) 구현에 필요한 스키마 보완

-- 단원 필터를 지원하려면 문제마다 단원명이 있어야 하는데, section_id로
-- 교재에 귀속된 문제만 curriculum_docs 조인으로 단원을 알 수 있고
-- AI 생성 문제(section_id 없음, origin_session_id만 있음)는 단원을 알 방법이
-- 없었다. skill_type처럼 생성 시점에 알고 있는 값을 그대로 비정규화해서 저장한다.
alter table problems add column unit_title text;

-- 목업의 "선생님 픽"은 사유를 여러 개(단어+로직 등) 동시에 선택해 하나의
-- 픽으로 저장하는데, 스키마는 사유 1개짜리 단일 enum이었다. 픽 1개(attempt당
-- 유일) 안에 사유를 여러 개 담을 수 있도록 배열로 바꾼다.
alter table teacher_problem_tags alter column reason drop not null;
alter table teacher_problem_tags
  alter column reason type teacher_pick_reason[]
  using case when reason is null then '{}'::teacher_pick_reason[] else array[reason]::teacher_pick_reason[] end;
alter table teacher_problem_tags alter column reason set default '{}';
alter table teacher_problem_tags alter column reason set not null;

-- teacher_problem_tags의 select 정책이 "관련 선생님/관리자"라는 이름과 달리
-- 태깅한 그 선생님(teacher_id = auth.uid())만 조회 가능해서, 정작 문제 기록의
-- 주인인 학생 본인은 자기 문제에 "선생님 픽" 배지가 붙었는지조차 볼 수 없었다.
-- 해당 시도의 학생 본인도 조회할 수 있도록 select 정책을 추가한다(선생님/관리자
-- 쓰기 권한은 기존 정책 그대로 유지).
create policy "해당 학생 조회" on teacher_problem_tags for select
  using (
    exists (
      select 1 from session_problem_attempts spa
      where spa.id = attempt_id and spa.student_id = auth.uid()
    )
  );

-- "관련 선생님/관리자" 정책도 라벨과 달리 teacher_id만 자기 자신으로 맞추면
-- 아무 선생님이나 태깅할 수 있었다(가르치는 학생인지 확인 없음). 이 테이블이
-- 017에서 처음 실제로 쓰이므로 지금 조인다.
drop policy "관련 선생님/관리자" on teacher_problem_tags;
create policy "담당 선생님/관리자 쓰기" on teacher_problem_tags for all
  using (
    is_admin()
    or (
      teacher_id = auth.uid()
      and exists (
        select 1 from session_problem_attempts spa
        where spa.id = attempt_id and teaches_student(spa.student_id)
      )
    )
  )
  with check (
    is_admin()
    or (
      teacher_id = auth.uid()
      and exists (
        select 1 from session_problem_attempts spa
        where spa.id = attempt_id and teaches_student(spa.student_id)
      )
    )
  );
