-- 2026-10-12 — 관리자 'AP 재고 관리' 화면의 초안 세트 저장을 한 트랜잭션으로(additive: 새 함수만, 기존 데이터 변경 없음).
-- scripts/ap-generation/assemble-ap-set.ts --draft --execute 와 같은 INSERT(세트 1행 + 문항 N행, status='draft', 공개 안 함)를 원자적으로 수행하고
-- 중복·겹침을 DB 에서 한 번 더 거부한다: 같은 이름의 비보관 AP 세트, 풀 구성(full_practice) 세트끼리 같은 문항(게시된 AB#1 포함).
-- 기존 행은 읽기만 하고 UPDATE/DELETE 하지 않는다. service_role 만 실행할 수 있다.
create or replace function ap_admin_create_draft_set(p_name text, p_subject text, p_label text, p_layout jsonb, p_items jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_set uuid;
  v_dup int;
  v_n int;
begin
  if p_label not in ('full_practice', 'mc_practice', 'frq_practice') then raise exception 'invalid ap_label %', p_label; end if;
  v_n := coalesce(jsonb_array_length(p_items), 0);
  if v_n = 0 then raise exception 'no items'; end if;
  if exists (select 1 from mock_exam_sets where exam_program = 'ap' and name = p_name and status <> 'archived') then
    raise exception 'duplicate set name: %', p_name;
  end if;
  if p_label = 'full_practice' then
    select count(*) into v_dup
      from mock_exam_set_items i
      join mock_exam_sets s on s.id = i.exam_set_id
     where s.exam_program = 'ap' and s.ap_label = 'full_practice' and s.status <> 'archived'
       and i.problem_id in (select (e ->> 'problem_id')::uuid from jsonb_array_elements(p_items) e);
    if v_dup > 0 then raise exception 'items already used in another full practice set: %', v_dup; end if;
  end if;
  insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, exam_program, ap_subject, ap_label, section_layout)
  values (p_name, 'standard', 'draft', 'ap_fixed', 'not_applicable', 'ap', p_subject, p_label, p_layout)
  returning id into v_set;
  insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty)
  select v_set, e ->> 'section', (e ->> 'position')::int, (e ->> 'problem_id')::uuid, (e ->> 'problem_version_id')::uuid, e ->> 'sat_domain', e ->> 'difficulty'
    from jsonb_array_elements(p_items) e;
  return v_set;
end;
$$;
revoke all on function ap_admin_create_draft_set(text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function ap_admin_create_draft_set(text, text, text, jsonb, jsonb) to service_role;
comment on function ap_admin_create_draft_set(text, text, text, jsonb, jsonb) is 'AP 재고 관리 화면: 초안 세트 원자적 저장(기존 행 변경 없음). docs/ap/admin-stock-screen.md';
