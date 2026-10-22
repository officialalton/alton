-- 테스트22(test account) 응시 정리 2차 (2026-10-22): 오너가 허락한 "검증이 끝난 테스트 계정 응시" 삭제. 실제 학생 응시는 어떤 경우에도 포함하지 않는다.
-- 대상: 오늘 새로 공개한 세트(CH4·CS4·CS5·PS5·PH5·LT5)에 대한 테스트 계정의 미제출 응시만. 답안은 0건이다.
begin;
do $$
declare v_bad int; v_n int;
begin
  select count(*) into v_bad from mock_exam_attempts a join students st on st.id = a.student_id
   where a.exam_set_id in ('856cfaad-6c1a-468e-9b16-c6c097a680a0','b25f8cae-c334-496d-a1e9-7971d1c369e3','7c42225c-50ee-43d0-9657-18dafbd9c48d','a2e38fff-c4c3-4bf7-95e6-0f655c5579a3','6935d468-6e99-4374-8fdf-4b6685134854','4cf9f1f2-3547-4b7f-b7fd-033becfa3ab7')
     and st.is_test_account is not true and a.status not in ('graded');
  select count(*) into v_n from mock_exam_attempts a join students st on st.id = a.student_id
   where st.is_test_account and a.exam_set_id in ('856cfaad-6c1a-468e-9b16-c6c097a680a0','b25f8cae-c334-496d-a1e9-7971d1c369e3','7c42225c-50ee-43d0-9657-18dafbd9c48d','a2e38fff-c4c3-4bf7-95e6-0f655c5579a3','6935d468-6e99-4374-8fdf-4b6685134854','4cf9f1f2-3547-4b7f-b7fd-033becfa3ab7') and a.status <> 'graded';
  raise notice 'non-test open attempts on these sets: %, test open attempts to delete: %', v_bad, v_n;
  if v_n > 8 then raise exception 'abort: too many targets %', v_n; end if;
end $$;
delete from mock_exam_attempts a using students st
 where st.id = a.student_id and st.is_test_account and a.status <> 'graded'
   and a.exam_set_id in ('856cfaad-6c1a-468e-9b16-c6c097a680a0','b25f8cae-c334-496d-a1e9-7971d1c369e3','7c42225c-50ee-43d0-9657-18dafbd9c48d','a2e38fff-c4c3-4bf7-95e6-0f655c5579a3','6935d468-6e99-4374-8fdf-4b6685134854','4cf9f1f2-3547-4b7f-b7fd-033becfa3ab7');
select 'remaining test attempts on these sets' k, count(*) from mock_exam_attempts a join students st on st.id=a.student_id where st.is_test_account and a.exam_set_id in ('856cfaad-6c1a-468e-9b16-c6c097a680a0','b25f8cae-c334-496d-a1e9-7971d1c369e3','7c42225c-50ee-43d0-9657-18dafbd9c48d','a2e38fff-c4c3-4bf7-95e6-0f655c5579a3','6935d468-6e99-4374-8fdf-4b6685134854','4cf9f1f2-3547-4b7f-b7fd-033becfa3ab7')
union all select 'real-student attempts (unchanged)', count(*) from mock_exam_attempts a join students st on st.id=a.student_id where st.is_test_account is not true;
commit;
