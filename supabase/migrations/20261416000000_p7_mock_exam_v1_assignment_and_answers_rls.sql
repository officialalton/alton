-- P7 — 고정형 SAT 모의고사 V1: 교사 배정 · 학생 응시 쓰기 권한 (2026-09-18)
--
-- 사양: docs/2026-09-17-fixed-mock-exam-v1-spec.md 3·5절.
-- 20261415000000_p7_mock_exam_v1_foundation.sql 은 관리자 전체 권한과 조회 권한만 만들었다
-- (mock_exam_attempts/mock_exam_answers 는 select만, insert/update 는 admin 전용). 이 마이그레이션은
-- 그 위에 "교사가 담당 학생에게 배정", "학생이 자기 응시를 진행·제출"에 필요한 쓰기 권한을 더한다.
--
-- mock_exam_answers 의 기존 "답안 본인 학생" 정책(for all)과 대칭으로, 학생이 자기 응시 기록의
-- 상태·시간을 직접 바꿀 수 있게 허용한다 — 이 테이블을 만지는 유일한 경로는 서버 액션
-- (lib/mock-exam/attempt-actions.ts)이므로 컬럼 단위 제한 없이 행 단위(본인 것만)로 충분하다
-- (homework_batches/문제 답안 정책과 같은 관례).

drop policy if exists "응시 기록 담당 교사 배정" on mock_exam_attempts;
create policy "응시 기록 담당 교사 배정" on mock_exam_attempts for insert to authenticated
  with check (
    exists (
      select 1 from enrollments e
      where e.student_id = mock_exam_attempts.student_id and e.teacher_id = auth.uid()
    )
  );

drop policy if exists "응시 기록 담당 교사 배정 갱신" on mock_exam_attempts;
create policy "응시 기록 담당 교사 배정 갱신" on mock_exam_attempts for update to authenticated
  using (
    exists (
      select 1 from enrollments e
      where e.student_id = mock_exam_attempts.student_id and e.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from enrollments e
      where e.student_id = mock_exam_attempts.student_id and e.teacher_id = auth.uid()
    )
  );

drop policy if exists "응시 기록 본인 학생 진행" on mock_exam_attempts;
create policy "응시 기록 본인 학생 진행" on mock_exam_attempts for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
