-- 2026-10-12 — 부분 연습 세트(Non-Calculator / Calculator / Free-Response) 초안을 풀·부분 세트 전체와 겹침 0 으로 원자 저장(additive: 새 함수만, 기존 데이터·함수 변경 없음).
-- 491 의 ap_admin_create_draft_set 은 풀 세트끼리만 겹침을 거부한다(부분 연습은 문항 20% 재노출 정책). 오너 2026-10-12 결정으로 재구성하는 부분 세트는
-- 비보관 AP 세트 전부(풀·부분)와 동일 문항 0 이어야 하므로 별도 함수로 DB 에서 한 번 더 거부한다. 같은 이름의 비보관 AP 세트(예: 아직 보관하지 않은 이전 부분 세트)도 거부한다.
-- 기존 행은 읽기만 하고 UPDATE/DELETE 하지 않는다. service_role 만 실행할 수 있다. 재실행 안전(create or replace).
create or replace function ap_admin_create_partial_draft_set(p_name text, p_subject text, p_label text, p_layout jsonb, p_items jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_set uuid;
  v_dup int;
  v_n int;
begin
  if p_label not in ('mc_practice', 'frq_practice') then raise exception 'invalid partial ap_label %', p_label; end if;
  v_n := coalesce(jsonb_array_length(p_items), 0);
  if v_n = 0 then raise exception 'no items'; end if;
  if exists (select 1 from mock_exam_sets where exam_program = 'ap' and name = p_name and status <> 'archived') then
    raise exception 'duplicate set name: %', p_name;
  end if;
  select count(*) into v_dup
    from mock_exam_set_items i
    join mock_exam_sets s on s.id = i.exam_set_id
   where s.exam_program = 'ap' and s.status <> 'archived'
     and i.problem_id in (select (e ->> 'problem_id')::uuid from jsonb_array_elements(p_items) e);
  if v_dup > 0 then raise exception 'items already used in another non-archived AP set: %', v_dup; end if;
  insert into mock_exam_sets (name, difficulty_tier, status, format, readiness_status, exam_program, ap_subject, ap_label, section_layout)
  values (p_name, 'standard', 'draft', 'ap_fixed', 'not_applicable', 'ap', p_subject, p_label, p_layout)
  returning id into v_set;
  insert into mock_exam_set_items (exam_set_id, section, position, problem_id, problem_version_id, sat_domain, difficulty)
  select v_set, e ->> 'section', (e ->> 'position')::int, (e ->> 'problem_id')::uuid, (e ->> 'problem_version_id')::uuid, e ->> 'sat_domain', e ->> 'difficulty'
    from jsonb_array_elements(p_items) e;
  return v_set;
end;
$$;
revoke all on function ap_admin_create_partial_draft_set(text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function ap_admin_create_partial_draft_set(text, text, text, jsonb, jsonb) to service_role;
comment on function ap_admin_create_partial_draft_set(text, text, text, jsonb, jsonb) is 'AP 재고 관리 화면: 부분 연습 세트 초안 원자적 저장(비보관 AP 세트 전부와 겹침 0). docs/ap/partial-rebuild.md';
