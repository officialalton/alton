-- 2026-10-13(오너 요청) — 시험 스크래치 화이트보드를 키울 수 있게 한다(FRQ 손글씨 패드와 같은 방식).
-- 보드 크기는 기기 간에 따라와야 하므로(학생이 태블릿에서 키운 보드를 폰·PC에서도 같은 크기로) 브라우저 저장이 아니라
-- 기존 problem_note_strokes 행(응시×문항×작성자 하나)에 board_height 컬럼 하나만 더한다. additive: 기존 행은 기본값 480(=기존 고정 크기).
-- 선분 저장 형식(x0,y0,x1,y1,color,w=640 기준)은 그대로 — 높이만 가변이라 기존 필기는 좌표가 변하지 않는다.
-- 기존 4인자 save_problem_note_strokes(잠금 가드 포함)는 그대로 두고, 5인자 오버로드가 그것을 호출한 뒤 높이를 적는다(잠금 규칙 한 곳).
-- 이 오버로드에만 크기 상한(선분 20,000개·JSON 2MB·높이 480..1600)을 둔다. 홈워크 등 기존 호출 경로는 바뀌지 않는다.
-- 재실행 안전: add column if not exists / create or replace.

alter table problem_note_strokes add column if not exists board_height integer not null default 480;
alter table problem_note_strokes drop constraint if exists problem_note_strokes_board_height_check;
alter table problem_note_strokes add constraint problem_note_strokes_board_height_check check (board_height between 480 and 1600);

create or replace function public.save_problem_note_strokes(
  p_context text, p_target_id uuid, p_item_id uuid, p_strokes jsonb, p_board_height integer
) returns void
language plpgsql security definer set search_path = public as $$
declare v_strokes jsonb := coalesce(p_strokes, '[]'::jsonb);
begin
  if p_board_height is null or p_board_height < 480 or p_board_height > 1600 then
    raise exception 'Invalid board size.';
  end if;
  if jsonb_typeof(v_strokes) <> 'array' then
    raise exception 'Invalid drawing.';
  end if;
  if jsonb_array_length(v_strokes) > 20000 or octet_length(v_strokes::text) > 2000000 then
    raise exception 'This drawing is too large to save. Erase or clear some strokes.';
  end if;
  -- 본인·잠금(제출·모듈 잠금) 검사는 4인자 함수가 한다.
  perform public.save_problem_note_strokes(p_context, p_target_id, p_item_id, v_strokes);
  update problem_note_strokes set board_height = p_board_height
   where context = p_context and target_id = p_target_id and item_id = p_item_id and author_id = auth.uid();
end $$;

/** 필기 + 보드 높이를 한 번에 읽는다. 권한은 load_problem_note_strokes 와 같다(본인·담당 교사·관리자·보호자). */
create or replace function public.load_problem_note_board(
  p_context text, p_target_id uuid, p_item_id uuid, p_author_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_author uuid := coalesce(p_author_id, auth.uid());
begin
  return jsonb_build_object(
    'strokes', public.load_problem_note_strokes(p_context, p_target_id, p_item_id, p_author_id),
    'boardHeight', coalesce((select board_height from problem_note_strokes
      where context = p_context and target_id = p_target_id and item_id = p_item_id and author_id = v_author), 480)
  );
end $$;

revoke execute on function public.save_problem_note_strokes(text, uuid, uuid, jsonb, integer) from public, anon;
revoke execute on function public.load_problem_note_board(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.save_problem_note_strokes(text, uuid, uuid, jsonb, integer) to authenticated;
grant execute on function public.load_problem_note_board(text, uuid, uuid, uuid) to authenticated;
