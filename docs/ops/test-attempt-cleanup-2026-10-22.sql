-- 테스트 계정 응시 정리 스크립트 (2026-10-22, 작성만 — 아직 실행하지 않음. 실행은 오너 go 이후).
-- 대상: students.is_test_account = true 인 계정의 응시만. 실제 학생 응시는 어떤 경우에도 포함하지 않는다(모든 DELETE 에 is_test_account 보호).
-- 기본값은 ROLLBACK 이다. 실행 결과(사전 집계·삭제 행 수)를 확인한 뒤에만 마지막 줄을 COMMIT 으로 바꾼다.
-- 보존: 비용 이력(essay_ai_cost_events)은 essay_score_id ON DELETE SET NULL 이라 남고, 이번 대상에는 essay 채점 행·비용 행이 모두 0건이다.
--       검증 결과 스냅샷은 data/uat/test-attempts-snapshot-2026-10-22.json (테스트 응시 106건: 세트·상태·정답 수·모듈 수) 에 남겼다.
-- FK(삭제 규칙): mock_exam_answers / annotations / answer_adjustments / attempt_modules / essay_scores / frq_handwriting = CASCADE,
--                mock_exam_item_exposures.first/last_attempt_id · problem_error_reports.mock_attempt_id = SET NULL.
-- 응시를 삭제하는 앱 기능(관리자·학생 포기/종료)은 없다. 삭제 트리거도 없다(INSERT/UPDATE 트리거만 있음).
-- attempt_no 는 (student_id, exam_set_group_id) 유일이라, 삭제 뒤 같은 테스트 학생의 다음 응시는 1번부터 다시 시작한다(테스트 계정 한정 영향).

-- ===== 0. 사전 집계(읽기 전용) =====
-- A층: 테스트22 (matchbox512+alton-uat-p22-1, student 9ea2f05c…) 응시 9건 — 미제출 8 + EL4 graded 1
select a.id, s.name, a.status, a.created_at::date, (select count(*) from mock_exam_answers x where x.attempt_id = a.id) answers
from mock_exam_attempts a join students st on st.id = a.student_id join mock_exam_sets s on s.id = a.exam_set_id
where st.is_test_account and a.id in (
  '99e0ade2-3218-4d95-8dfe-0f3ffba6b9bd','6bb70e61-8594-4b71-8b27-627ed702efde','f04ab5ca-862e-48a8-a02f-5c87fef77606',
  '0e9a8029-e40f-47a0-ad78-7b1528a96e57','8dac94cf-f5f4-4a63-9a2b-c7c02d2b16d0','28ddc49c-67a9-4009-9701-f05974191237',
  '5d0a2fa5-2edb-4a24-b7a1-f67e20ba6fc5','57081367-5e50-489b-a92b-0ecf13ad6706','06fa608a-7c0e-4cf6-bbbe-80821df54df0');
-- B층(별도 go): p20 계정(matchbox512+alton-uat-p20-1, student 0c95c52b…) 응시 97건(graded 96, assigned 1), 답안 5,544행, 모듈 140행.
--   saved_to_practice 답안 3건(8aa6fe6c AP Calc AB Non-Calc 2건, 157cd6c7 SAT Practice Test 12 1건)이 함께 사라진다.
select count(*) attempts, count(*) filter (where status = 'graded') graded from mock_exam_attempts where student_id = '0c95c52b-8dd7-4a98-bbbc-53536d47197f';

begin;

-- ===== 1. 보호 검사: 대상이 전부 테스트 계정 응시인지, 건수가 맞는지 =====
do $$
declare v_bad int; v_n int;
begin
  select count(*) into v_bad from mock_exam_attempts a join students st on st.id = a.student_id
   where a.id in (
     '99e0ade2-3218-4d95-8dfe-0f3ffba6b9bd','6bb70e61-8594-4b71-8b27-627ed702efde','f04ab5ca-862e-48a8-a02f-5c87fef77606',
     '0e9a8029-e40f-47a0-ad78-7b1528a96e57','8dac94cf-f5f4-4a63-9a2b-c7c02d2b16d0','28ddc49c-67a9-4009-9701-f05974191237',
     '5d0a2fa5-2edb-4a24-b7a1-f67e20ba6fc5','57081367-5e50-489b-a92b-0ecf13ad6706','06fa608a-7c0e-4cf6-bbbe-80821df54df0')
     and st.is_test_account is not true;
  if v_bad > 0 then raise exception 'abort: % target attempt(s) belong to non-test students', v_bad; end if;
  select count(*) into v_n from mock_exam_attempts where id in (
     '99e0ade2-3218-4d95-8dfe-0f3ffba6b9bd','6bb70e61-8594-4b71-8b27-627ed702efde','f04ab5ca-862e-48a8-a02f-5c87fef77606',
     '0e9a8029-e40f-47a0-ad78-7b1528a96e57','8dac94cf-f5f4-4a63-9a2b-c7c02d2b16d0','28ddc49c-67a9-4009-9701-f05974191237',
     '5d0a2fa5-2edb-4a24-b7a1-f67e20ba6fc5','57081367-5e50-489b-a92b-0ecf13ad6706','06fa608a-7c0e-4cf6-bbbe-80821df54df0');
  if v_n <> 9 then raise exception 'abort: expected 9 attempts, found %', v_n; end if;
end $$;

-- ===== 2. A층 삭제(테스트22 응시 9건). 답안·모듈은 CASCADE =====
delete from mock_exam_attempts a using students st
 where st.id = a.student_id and st.is_test_account
   and a.id in (
     '99e0ade2-3218-4d95-8dfe-0f3ffba6b9bd','6bb70e61-8594-4b71-8b27-627ed702efde','f04ab5ca-862e-48a8-a02f-5c87fef77606',
     '0e9a8029-e40f-47a0-ad78-7b1528a96e57','8dac94cf-f5f4-4a63-9a2b-c7c02d2b16d0','28ddc49c-67a9-4009-9701-f05974191237',
     '5d0a2fa5-2edb-4a24-b7a1-f67e20ba6fc5','57081367-5e50-489b-a92b-0ecf13ad6706','06fa608a-7c0e-4cf6-bbbe-80821df54df0');

-- 노출 기록(문항을 이미 본 것으로 표시하는 학생별 행)도 이 테스트 학생 것만 지운다 — 남기면 이후 테스트 응시가 "본 문항" 가중치를 받는다.
delete from mock_exam_item_exposures e using students st
 where st.id = e.student_id and st.is_test_account and e.student_id = '9ea2f05c-8e77-43b9-9ddc-1f73e61a99ab';

-- ===== 3. B층(p20 97건) — 오너가 별도로 go 한 경우에만 아래 주석을 해제 =====
-- delete from mock_exam_attempts a using students st
--  where st.id = a.student_id and st.is_test_account and a.student_id = '0c95c52b-8dd7-4a98-bbbc-53536d47197f';
-- delete from mock_exam_item_exposures e using students st
--  where st.id = e.student_id and st.is_test_account and e.student_id = '0c95c52b-8dd7-4a98-bbbc-53536d47197f';

-- ===== 4. 삭제 뒤 확인 =====
select 'p22 attempts left' k, count(*) from mock_exam_attempts where student_id = '9ea2f05c-8e77-43b9-9ddc-1f73e61a99ab'
union all select 'real-student attempts (must equal pre-count 22)', count(*) from mock_exam_attempts a join students st on st.id = a.student_id where st.is_test_account is not true
union all select 'cost events (must be unchanged, now 0 for test)', count(*) from essay_ai_cost_events;

rollback;  -- 결과 확인 후에만 commit; 으로 바꾼다.
-- 롤백 메모: 커밋 전에는 rollback; 으로 전부 되돌아간다. 커밋 후 복구는 불가능하다 — 필요하면 data/uat/test-attempts-snapshot-2026-10-22.json 으로 응시 요약만 복원 가능(답안 본문은 스냅샷에 없음).
