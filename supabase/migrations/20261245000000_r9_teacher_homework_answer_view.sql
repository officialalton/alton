-- R9 Gap 2 (2026-09-08, 제품 오너 리뷰) — 담당 선생님/관리자가 자신이(또는
-- 동료가) 이 세션에서 발급한 과제의 실제 문제 내용을 다시 읽을 수 있게 한다.
--
-- 배경: session_homework_items/session_homework_attempts 자체의 SELECT는 이미
-- 담당 선생님/관리자에게 열려 있다(20261235000000, 20261240000000). 하지만 그
-- 문제(problems)의 실제 지문/보기를 읽으려면 별도로 problems 테이블의 SELECT
-- RLS(20260828060000 "문제 조회")를 통과해야 하는데, 그 정책은 created_by 본인,
-- 관리자, 또는 "confirmed + published 교재 section 소속"만 커버한다. 과제로
-- 발급된 문제가 꼭 그 세 경로 중 하나에 해당한다는 보장이 없다 — 예를 들어 다른
-- 선생님이 만든 confirmed 문제를 키워드로 골라 발급했다면, 그 문제의 section이
-- published 교재에 속하지 않는 한 발급한 선생님 자신도 나중에 다시 읽지
-- 못한다. 학생 쪽에서 이미 겪은 것과 정확히 같은 종류의 공백이라(corrective,
-- 20261240000000의 "본인에게 과제로 배정된 문제는 학생도 조회" 정책과 동일한
-- 이유) 같은 패턴을 교사/관리자 쪽에도 대칭적으로 추가한다.
--
-- 주의: 이 정책은 SELECT만 추가한다 — 학생 답안에 대한 쓰기 경로는 이 라운드
-- 전체에서 어디에도 추가하지 않는다(제품 오너의 명시적 지시).
create policy "담당 선생님/관리자는 배정한 과제 문제 조회" on problems for select
  using (
    exists (
      select 1 from session_homework_items shi
      where shi.problem_id = problems.id
        and (is_session_teacher_v3(shi.session_id) or is_admin())
    )
  );
