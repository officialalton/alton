-- Mock Exam MST Phase 3 (3/3) — 경로 비노출(학생·보호자가 REST 로도 경로·변형·정책을 알 수 없게).
-- 20261909000000 패턴(컬럼 SELECT 회수 + 나머지 컬럼 재부여). 회수 전에 이 컬럼을 읽는 비-definer 함수·트리거·뷰·정책을 전수 점검했다:
--   - mock_exam_attempts 를 참조하는 plpgsql 은 모두 SECURITY DEFINER 이고(owner 권한), 예외 2개는 아래에서 처리:
--       _mock_exam_attempts_assign_gate (invoker, 교사 배정 insert 때 `select * from mock_exam_sets`) -> 필요한 컬럼만 읽도록 교체
--       mock_exam_attempts_fill_set_group (invoker) -> set_group_id 컬럼만 읽음, 영향 없음
--   - 뷰/정책이 attempts 의 회수 대상 컬럼을 참조하는 곳 없음(정책은 id·student_id·status 만 사용).
--   - 앱은 mock_exam_attempts/mock_exam_sets 를 컬럼을 명시해 읽는다(select * 없음). 관리자 화면은 service_role.
-- 직원(교사·컨설턴트)은 definer RPC(mock_exam_attempt_detail 의 routing 키)로만 경로를 본다.
-- 회수 대상:
--   mock_exam_attempts: rw_m2_route, math_m2_route, rw_m2_route_policy_version, math_m2_route_policy_version
--   mock_exam_sets: assembly_rules(routing 플래그), readiness_report(모듈별 route 변형 목록)
-- 주의: 이 테이블에 새 컬럼을 추가하면 authenticated 에 컬럼 SELECT 를 따로 grant 해야 한다.
-- 되돌리기: grant select on public.mock_exam_attempts, public.mock_exam_sets to anon, authenticated;

-- 배정 게이트: `select *` 대신 필요한 컬럼만(컬럼 권한 회수 뒤 교사 배정이 깨지지 않게).
create or replace function public._mock_exam_attempts_assign_gate() returns trigger
language plpgsql as $$
declare v_format text; v_ready text;
begin
  if tg_op = 'UPDATE' and new.exam_set_id = old.exam_set_id then return new; end if;
  select format, readiness_status into v_format, v_ready from mock_exam_sets where id = new.exam_set_id;
  if v_format = 'mst' and v_ready <> 'ready' then
    raise exception '문항 구성이 완료되지 않은 4모듈 시험은 배정할 수 없습니다(관리자에게 문의).';
  end if;
  return new;
end $$;

-- 공개 게이트: 관리자 JWT 로 직접 공개해도 검증 함수를 호출할 수 있게 definer 로(검증 함수는 service_role/owner 전용으로 좁힌다).
create or replace function public._mock_exam_sets_publish_gate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.format = 'mst' and new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if new.readiness_status <> 'ready' then
      raise exception '문항 구성이 완료되지 않은 4모듈 시험은 공개할 수 없습니다(readiness=%). 부족한 모듈을 먼저 채우세요.', new.readiness_status;
    end if;
    if not (mock_exam_validate_mst_set(new.id)->>'ready')::boolean then
      raise exception '4모듈 시험의 문항 구성이 청사진을 채우지 못해 공개할 수 없습니다.';
    end if;
  end if;
  return new;
end $$;

-- 청사진 검증은 세트 구성(변형 존재·정책 유무)을 드러내므로 관리자 화면(service_role)·definer 전용.
revoke execute on function public.mock_exam_validate_mst_set(uuid) from public, anon, authenticated;
grant execute on function public.mock_exam_validate_mst_set(uuid) to service_role;

do $$
declare
  t record;
  cols text;
begin
  for t in select * from (values
    ('mock_exam_attempts', array['rw_m2_route', 'math_m2_route', 'rw_m2_route_policy_version', 'math_m2_route_policy_version']),
    ('mock_exam_sets', array['assembly_rules', 'readiness_report'])
  ) as v(tbl, hidden) loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
      from information_schema.columns
      where table_schema = 'public' and table_name = t.tbl and column_name <> all (t.hidden);
    execute format('revoke select on public.%I from anon, authenticated', t.tbl);
    execute format('grant select (%s) on public.%I to anon, authenticated', cols, t.tbl);
  end loop;
end $$;
