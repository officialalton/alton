-- 격리 스택 리허설 전용(공유 DB 에 적용 금지!). 실행 ID: refunduat-20261021
-- 공유 DB 에 이미 있는 3개 테스트 가족(endasg…)과 같은 id 로 같은 모양의 행을 격리 DB 에 만들어,
-- 시드/정리 SQL 을 공유 DB 와 동일한 전제에서 리허설한다.
-- 적용: psql "$ISOLATED_DB_URL" -v ON_ERROR_STOP=1 -f 이 파일 → 시드 → 처리 RPC → 정리.
begin;

create temp table _fam (label text, child uuid, guardian uuid, hh uuid, contract uuid, enr uuid, teacher uuid) on commit drop;
insert into _fam values
 ('X','458c121e-423f-4cf3-a1db-e8b2ba25ea65','8a43dc09-1cdc-4302-963e-697a2b55b7b8','04a0f226-84e5-4a85-b42f-72ab567f4ec6','dd80f175-ba28-4b29-989e-45bb990a36de','34377f9b-5a83-4cb8-b4fa-2f7158e7990d','fe34020a-c555-4399-884d-ed62e61067d8'),
 ('Y','851e4c76-a4f7-43b2-a64d-ac24849fbe29','dbe01eaa-94bb-44ef-a277-08479cde3457','b57e6983-e0d8-41d5-9e83-07a2156a7324','2529b513-5222-4915-874e-34b9f0ecd4bf','70fcee30-5714-48ec-ac0c-6b67fd313c00','bc456195-a6d5-42a4-ab3c-b1436e5b7ae6'),
 ('Z','e0ca6b26-d2b3-4d1e-bb56-4a63cd7c1ff8','2bf94411-5ded-488a-a2ed-a68bd0d7f65c','e0ea0cf6-3e2a-4bbc-8d60-f9bbcd126b11','8cd8783f-b693-488b-878a-e05fdb60986f','0e6bec49-4321-4434-be9a-15a9cc6fd703','9b4b4d49-6437-47b4-8741-222cb3589423');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'rehearsal-' || u || '@example.com', 'x', now(), '{}', '{}', now(), now()
from (select child u from _fam union select guardian from _fam union select teacher from _fam) s;

insert into profiles (id, role, name, date_of_birth) select child, 'student', 'endasg-standin ' || label || ' 학생', (now() - interval '17 years')::date from _fam;
insert into profiles (id, role, name) select guardian, 'parent', 'endasg-standin ' || label || ' 보호자' from _fam;
insert into profiles (id, role, name) select teacher, 'teacher', 'endasg-standin ' || label || ' 선생님 a' from _fam;
insert into students (id, grade, status) select child, '10학년', 'active' from _fam;
select set_teacher_rate(teacher, 3000000, 'KRW', now() - interval '1 day') from _fam;
insert into teachers (id, status) select teacher, 'active' from _fam;
insert into households (id, primary_guardian_id) select hh, null from _fam;
insert into household_members (household_id, profile_id, role, is_primary) select hh, child, 'child', true from _fam;
insert into contracts (id, household_id, child_id, status) select contract, hh, child, 'active' from _fam;
insert into subject_enrollments (id, child_id, subject_id, contract_id, status)
  select enr, child, 'eeeeeeee-0000-0000-0000-000000000001', contract, 'active' from _fam;
-- 공유 DB 와 같은 상태: 선생님 배정은 종료(ended).
insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, effective_until, source)
  select enr, teacher, 'ended', now() - interval '3 days', now() - interval '2 days', 'app' from _fam;
commit;
