-- 2026-10-14 FRQ 손글씨 배경 프리셋: 저장값은 프리셋 id 하나뿐(픽셀 없음). 추가형 — 기존 행은 'blank'. (작성만, 적용은 총괄)
-- 결과 화면은 id 로 같은 배경을 다시 그린다(lib/ap-exam/frq-background.ts). 기존 6인자 save·미리보기 SVG 검증은 그대로.
alter table public.mock_exam_frq_handwriting
  add column if not exists background text not null default 'blank'
  check (background in ('blank', 'grid', 'axes', 'axes_grid', 'axes_two', 'number_line'));

-- 7인자 오버로드: 기존 함수(권한·잠금·상한 가드 전부)를 호출한 뒤 배경만 적는다. 획이 없고 배경만 고른 경우에도 행을 남긴다(획 0 행).
create or replace function public.save_mock_exam_frq_handwriting(p_attempt_id uuid, p_set_item_id uuid, p_part_label text, p_strokes jsonb, p_preview_svg text, p_board_height integer, p_background text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_bg text := coalesce(p_background, 'blank');
begin
  if v_bg not in ('blank', 'grid', 'axes', 'axes_grid', 'axes_two', 'number_line') then raise exception 'Invalid drawing.'; end if;
  perform public.save_mock_exam_frq_handwriting(p_attempt_id, p_set_item_id, p_part_label, p_strokes, p_preview_svg, p_board_height);
  if v_bg = 'blank' then
    update mock_exam_frq_handwriting set background = 'blank' where attempt_id = p_attempt_id and set_item_id = p_set_item_id and part_label = p_part_label;
  else
    insert into mock_exam_frq_handwriting (attempt_id, set_item_id, part_label, student_id, strokes, preview_svg, stroke_count, board_height, background, updated_at)
    values (p_attempt_id, p_set_item_id, p_part_label, auth.uid(), '[]'::jsonb, '', 0, coalesce(p_board_height, 500), v_bg, now())
    on conflict (attempt_id, set_item_id, part_label) do update set background = v_bg;
  end if;
end $$;
revoke execute on function public.save_mock_exam_frq_handwriting(uuid, uuid, text, jsonb, text, integer, text) from public, anon;
grant execute on function public.save_mock_exam_frq_handwriting(uuid, uuid, text, jsonb, text, integer, text) to authenticated, service_role;

create or replace function public.load_mock_exam_frq_handwriting(p_attempt_id uuid, p_with_strokes boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_student uuid;
begin
  select student_id into v_student from mock_exam_attempts where id = p_attempt_id;
  if v_student is null then raise exception 'Attempt not found.'; end if;
  if v_student <> auth.uid() and not (is_admin() or teaches_student(v_student) or is_guardian_of(v_student)) then
    raise exception 'You do not have permission to view this.';
  end if;
  return coalesce((
    select jsonb_agg(
             jsonb_build_object('setItemId', set_item_id, 'partLabel', part_label, 'strokeCount', stroke_count, 'previewSvg', preview_svg, 'boardHeight', board_height, 'background', background)
             || case when p_with_strokes then jsonb_build_object('strokes', strokes) else '{}'::jsonb end
             order by set_item_id, part_label)
      from mock_exam_frq_handwriting where attempt_id = p_attempt_id), '[]'::jsonb);
end $$;
revoke execute on function public.load_mock_exam_frq_handwriting(uuid, boolean) from public, anon;
grant execute on function public.load_mock_exam_frq_handwriting(uuid, boolean) to authenticated, service_role;
