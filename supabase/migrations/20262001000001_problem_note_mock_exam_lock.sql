-- 2026-10-02(오너 확정) — 모의고사 화이트보드는 "풀 때 쓰는 풀이용"이다. 응시 중 문항별로 필기하고,
-- 시험(고정형) 또는 그 문항의 모듈(MST)을 제출하면 필기는 스냅샷으로 고정(읽기 전용)되어야 한다.
-- 이전 save_problem_note_strokes(20261434000000)는 본인 응시이기만 하면 제출·채점 뒤에도 덮어쓸 수 있었다
-- (결과 화면에서 화이트보드를 다시 열어 새로 기록 가능). mock_exam 문맥에만
-- mock_exam_toggle_flag(20261918000001)와 같은 잠금 가드를 더한다. homework·problem 문맥은 그대로.
-- 재실행 안전: create or replace.

create or replace function public.save_problem_note_strokes(
  p_context text, p_target_id uuid, p_item_id uuid, p_strokes jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_m mock_exam_attempt_modules%rowtype;
begin
  if p_context not in ('mock_exam', 'homework', 'problem') then
    raise exception '알 수 없는 문맥입니다: %', p_context;
  end if;
  v_student := _problem_note_target_student(p_context, p_target_id);
  if v_student is null or v_student <> auth.uid() then
    raise exception '본인 응시·과제의 필기만 저장할 수 있습니다.';
  end if;

  if p_context = 'mock_exam' then
    -- item_id 는 mock_exam_set_items.id(응시 화면이 setItemId 를 넘긴다).
    if _mock_exam_is_mst(p_target_id) then perform _mock_exam_settle(p_target_id); end if;
    select * into v_a from mock_exam_attempts where id = p_target_id;
    if v_a.status in ('submitted', 'graded') then raise exception '이미 제출한 시험의 필기는 바꿀 수 없습니다.'; end if;
    select * into v_i from mock_exam_set_items where id = p_item_id and exam_set_id = v_a.exam_set_id;
    if v_i.id is null then raise exception '문항을 찾을 수 없습니다.'; end if;
    if v_i.module_key is not null then
      select * into v_m from mock_exam_attempt_modules where attempt_id = p_target_id and module_key = v_i.module_key;
      if v_i.module_key is distinct from v_a.current_module or coalesce(v_m.locked, true) then
        raise exception '이미 제출된 모듈의 필기는 바꿀 수 없습니다.';
      end if;
    end if;
  end if;

  insert into problem_note_strokes (context, target_id, item_id, author_id, strokes, updated_at)
  values (p_context, p_target_id, p_item_id, auth.uid(), coalesce(p_strokes, '[]'::jsonb), now())
  on conflict (context, target_id, item_id, author_id)
  do update set strokes = excluded.strokes, updated_at = now();
end $$;
revoke execute on function public.save_problem_note_strokes(text, uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_problem_note_strokes(text, uuid, uuid, jsonb) to authenticated;
