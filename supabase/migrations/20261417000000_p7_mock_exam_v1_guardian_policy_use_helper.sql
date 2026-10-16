-- P7 — 모의고사 학부모 RLS를 동결된 guardian_students 직접 조회 대신 is_guardian_of() 헬퍼로 고친다.
--
-- 20261415000000_p7_mock_exam_v1_foundation.sql 이 만든 "응시 기록 보호자 읽기 전용"/"답안 보호자 조회"
-- 정책은 guardian_students 테이블을 직접 join 했다. 하지만 20260901000000_r2_household_backfill_and_guardian_freeze.sql
-- 이후 가족 관계 원본은 households/household_members 로 옮겨갔고(guardian_students 는 과거 이력 읽기 전용,
-- 새 관계는 그 테이블에 생기지 않는다) — 이 마이그레이션 없이는 R2 이후 새로 맺어진 가족(household_members에만
-- 있는 관계)의 학부모가 자녀 모의고사 결과를 못 본다. is_guardian_of()는 이미 두 원본을 OR로 함께 본다
-- (구 guardian_students 이력 + 신규 household_members) — 그 헬퍼로 교체한다.

drop policy if exists "응시 기록 보호자 읽기 전용" on mock_exam_attempts;
create policy "응시 기록 보호자 읽기 전용" on mock_exam_attempts for select to authenticated
  using (public.is_guardian_of(mock_exam_attempts.student_id));

drop policy if exists "답안 보호자 조회" on mock_exam_answers;
create policy "답안 보호자 조회" on mock_exam_answers for select to authenticated
  using (
    exists (
      select 1 from mock_exam_attempts a
      where a.id = mock_exam_answers.attempt_id and public.is_guardian_of(a.student_id)
    )
  );
