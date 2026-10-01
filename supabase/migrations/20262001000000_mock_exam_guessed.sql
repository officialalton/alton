-- 2026-10-02(오너 UAT A8·B6·B7) — 모의고사 "찍음(guessed)" 표시 + 결과 화면 영어 해설.
--
-- 1) mock_exam_answers.guessed: 학생이 답을 모르고 찍었을 때 스스로 누르는 표시(서버 추적 없음).
-- 2) mock_exam_toggle_guessed: mock_exam_toggle_flag(20261918000001)와 정확히 같은 가드
--    (본인 응시 · MST 만료 정산 · 제출/채점 후 차단 · 경로 밖 문항 차단 · 현재 모듈이 아니거나 잠긴 모듈 차단).
-- 3) mock_exam_attempt_detail / mock_exam_mst_state 래퍼: 문항마다 'guessed' 를 싣고,
--    detail 에는 'explanationEn' 을 싣는다. explanationEn 은 그 문항의 'explanation' 이 이미
--    공개된(null 이 아닌) 경우에만 채운다 — 채점 확정 전 마스킹 규칙을 그대로 따른다.
-- 재실행 안전: add column if not exists, create or replace, 이름 바꾸기는 대상이 없을 때만.

alter table public.mock_exam_answers
  add column if not exists guessed boolean not null default false;

create or replace function public.mock_exam_toggle_guessed(p_attempt_id uuid, p_set_item_id uuid, p_guessed boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_m mock_exam_attempt_modules%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 진행할 수 있습니다.'; end if;
  if _mock_exam_is_mst(p_attempt_id) then
    perform _mock_exam_settle(p_attempt_id);
    select * into v_a from mock_exam_attempts where id = p_attempt_id;
  end if;
  if v_a.status in ('submitted', 'graded') then raise exception '이미 제출한 시험은 바꿀 수 없습니다.'; end if;
  select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
  if v_i.id is null or not _mock_exam_item_in_route(v_i, v_a) then raise exception '문항을 찾을 수 없습니다.'; end if;
  if v_i.module_key is not null then
    select * into v_m from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_i.module_key;
    if v_i.module_key is distinct from v_a.current_module or coalesce(v_m.locked, true) then
      raise exception '이미 제출된 모듈에는 표시를 바꿀 수 없습니다.';
    end if;
  end if;
  insert into mock_exam_answers (attempt_id, set_item_id, guessed, updated_at)
  values (p_attempt_id, p_set_item_id, p_guessed, now())
  on conflict (attempt_id, set_item_id) do update set guessed = excluded.guessed, updated_at = now();
end $$;
revoke execute on function public.mock_exam_toggle_guessed(uuid, uuid, boolean) from public, anon;
grant execute on function public.mock_exam_toggle_guessed(uuid, uuid, boolean) to authenticated, service_role;

-- ── detail 래퍼 ─────────────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public._mock_exam_attempt_detail_v4(uuid)') is null then
    alter function public.mock_exam_attempt_detail(uuid) rename to _mock_exam_attempt_detail_v4;
  end if;
end $$;
revoke execute on function public._mock_exam_attempt_detail_v4(uuid) from public, anon, authenticated;

create or replace function public.mock_exam_attempt_detail(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_d jsonb; v_items jsonb;
begin
  v_d := _mock_exam_attempt_detail_v4(p_attempt_id);
  if v_d is null then return null; end if;
  select coalesce(jsonb_agg(
           t.it || jsonb_build_object(
             'guessed', coalesce(ans.guessed, false),
             'explanationEn', case when t.it->>'explanation' is null then null else nullif(btrim(v.explanation_en), '') end)
           order by t.ord), '[]'::jsonb)
    into v_items
  from jsonb_array_elements(coalesce(v_d->'items', '[]'::jsonb)) with ordinality as t(it, ord)
  left join mock_exam_set_items i on i.id = (t.it->>'setItemId')::uuid
  left join problem_versions v on v.id = i.problem_version_id
  left join mock_exam_answers ans on ans.attempt_id = p_attempt_id and ans.set_item_id = i.id;
  return v_d || jsonb_build_object('items', v_items);
end $$;
revoke execute on function public.mock_exam_attempt_detail(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_detail(uuid) to authenticated, service_role;

-- ── MST 응시 상태 래퍼(새로고침·재접속 시 찍음 표시 복구) ─────────────────────
do $$
begin
  if to_regprocedure('public._mock_exam_mst_state_v2(uuid)') is null then
    alter function public.mock_exam_mst_state(uuid) rename to _mock_exam_mst_state_v2;
  end if;
end $$;
revoke execute on function public._mock_exam_mst_state_v2(uuid) from public, anon, authenticated;

create or replace function public.mock_exam_mst_state(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_d jsonb; v_items jsonb;
begin
  v_d := _mock_exam_mst_state_v2(p_attempt_id);
  if v_d is null then return null; end if;
  select coalesce(jsonb_agg(t.it || jsonb_build_object('guessed', coalesce(ans.guessed, false)) order by t.ord), '[]'::jsonb)
    into v_items
  from jsonb_array_elements(coalesce(v_d->'items', '[]'::jsonb)) with ordinality as t(it, ord)
  left join mock_exam_answers ans on ans.attempt_id = p_attempt_id and ans.set_item_id = (t.it->>'setItemId')::uuid;
  return v_d || jsonb_build_object('items', v_items);
end $$;
revoke execute on function public.mock_exam_mst_state(uuid) from public, anon;
grant execute on function public.mock_exam_mst_state(uuid) to authenticated, service_role;
