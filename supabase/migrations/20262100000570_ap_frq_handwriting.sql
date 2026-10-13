-- 보드 높이: 논리 좌표 800 × board_height(300..1600, 기본 500) — 키워도 기존 획은 그대로(좌표 고정). 크기만 저장하고 획이 없는 행도 허용.
-- 2026-10-13(오너 요청) — 종이 FRQ 과목(Calculus AB/BC·Physics 1·Biology·Chemistry·Micro/Macro)의 FRQ 파트별 손글씨 답안.
--  · 저장: 응시 × 문항 × 파트 한 행. strokes = [{c:0..2, p:[x0,y0,x1,y1,...]}] 정수 좌표(캔버스 800×500), preview_svg = 결과 화면용 미리보기(허용 목록 형식 SVG만).
--  · 상한(RPC 가 강제): 획 300 · 획당 점 1000 · 전체 점 20000 · strokes JSON 256KB · SVG 200KB. 좌표 0..800 × 0..board_height.
--  · 접근: problem_note_strokes·mock_exam_annotations 와 같은 방식 — RLS 켜고 정책 없음, SECURITY DEFINER RPC 로만.
--    저장: 본인 응시 · AP 세트 · 종이 FRQ 과목 · FRQ(essay) 문항 · 존재하는 파트 · 제출/채점 후 차단 · 시작 안 한/만료된 섹션 차단(mock_exam_save_answer 와 같은 서버 시계 규칙).
--    읽기: 본인 · 담당 교사 · 관리자 · 보호자(제출 후 결과 화면 읽기 전용).
--  · 종이/디지털 목록은 lib/ap-exam/frq-delivery.ts 와 같다(_ap_frq_paper_subject) — 통합 테스트가 일치를 검사한다.
-- 재실행 안전: if not exists / create or replace. 되돌리기: drop table + drop function(추가형 마이그레이션이라 기존 객체는 바뀌지 않는다).

create or replace function public._ap_frq_paper_subject(p_subject text) returns boolean
language sql immutable as $$
  select p_subject in ('ap_calculus_ab', 'ap_calculus_bc', 'ap_physics_1', 'ap_biology', 'ap_chemistry', 'ap_microeconomics', 'ap_macroeconomics')
$$;

create table if not exists public.mock_exam_frq_handwriting (
  attempt_id uuid not null references public.mock_exam_attempts (id) on delete cascade,
  set_item_id uuid not null references public.mock_exam_set_items (id) on delete cascade,
  part_label text not null check (part_label ~ '^[A-Za-z0-9]{1,6}$'),
  student_id uuid not null references public.profiles (id),
  strokes jsonb not null,
  preview_svg text not null,
  stroke_count integer not null check (stroke_count >= 0),
  board_height integer not null default 500 check (board_height between 300 and 1600),
  updated_at timestamptz not null default now(),
  primary key (attempt_id, set_item_id, part_label)
);
alter table public.mock_exam_frq_handwriting enable row level security;

create or replace function public.save_mock_exam_frq_handwriting(p_attempt_id uuid, p_set_item_id uuid, p_part_label text, p_strokes jsonb, p_preview_svg text, p_board_height integer default 500)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_s mock_exam_sets%rowtype; v_min int; v_format text; v_statements jsonb;
  v_st jsonb := coalesce(p_strokes, '[]'::jsonb); v_h int := coalesce(p_board_height, 500); v_stroke jsonb; v_p jsonb; v_len int; v_total int := 0; v_n numeric; v_k int;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only continue your own attempt.'; end if;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  if v_s.exam_program is distinct from 'ap' or not _ap_frq_paper_subject(v_s.ap_subject) then raise exception 'Handwritten answers are not available for this exam.'; end if;
  if v_a.status in ('submitted', 'graded') then raise exception 'This exam has already been submitted, so answers cannot be changed.'; end if;
  select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
  if v_i.id is null then raise exception 'Question not found.'; end if;
  select p.format::text, pv.statements into v_format, v_statements from problems p left join problem_versions pv on pv.id = v_i.problem_version_id where p.id = v_i.problem_id;
  if v_format is distinct from 'essay' then raise exception 'Handwritten answers are only for free-response questions.'; end if;
  if p_part_label is null or p_part_label !~ '^[A-Za-z0-9]{1,6}$'
     or (jsonb_typeof(v_statements) = 'array' and not exists (select 1 from jsonb_array_elements(v_statements) x where x->>'label' = p_part_label)) then
    raise exception 'Question part not found.';
  end if;
  -- 섹션 서버 시계(mock_exam_save_answer 와 같은 규칙). 첫 섹션은 응시 시작과 함께 시작된 것으로 본다.
  select (x->>'minutes')::int into v_min from jsonb_array_elements(v_s.section_layout->'sections') x where x->>'key' = v_i.section;
  if v_min is not null then
    if v_a.ap_section_entered ? v_i.section then
      if now() - (v_a.ap_section_entered->>v_i.section)::timestamptz > make_interval(secs => v_min * 60 + 5) then
        raise exception 'Time is up for this section. Answers can no longer be changed.';
      end if;
    elsif v_i.section = v_s.section_layout->'sections'->0->>'key' then
      update mock_exam_attempts set ap_section_entered = ap_section_entered || jsonb_build_object(v_i.section, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) where id = p_attempt_id;
    else
      raise exception 'This section has not started yet. Press Start section first.';
    end if;
  end if;

  if v_h not between 300 and 1600 then raise exception 'Invalid drawing.'; end if;
  -- 빈 배열 = 지우기: 기본 높이면 행 삭제, 아니면 보드 높이만 남긴다(획 0).
  if jsonb_typeof(v_st) = 'array' and jsonb_array_length(v_st) = 0 then
    if v_h <> 500 then
      insert into mock_exam_frq_handwriting (attempt_id, set_item_id, part_label, student_id, strokes, preview_svg, stroke_count, board_height, updated_at)
      values (p_attempt_id, p_set_item_id, p_part_label, auth.uid(), '[]'::jsonb, '', 0, v_h, now())
      on conflict (attempt_id, set_item_id, part_label) do update set strokes = '[]'::jsonb, preview_svg = '', stroke_count = 0, board_height = v_h, updated_at = now();
      return;
    end if;
    delete from mock_exam_frq_handwriting where attempt_id = p_attempt_id and set_item_id = p_set_item_id and part_label = p_part_label;
    return;
  end if;

  if jsonb_typeof(v_st) <> 'array' or jsonb_array_length(v_st) > 300 then raise exception 'This drawing is too large to save. Erase or clear some strokes.'; end if;
  if octet_length(v_st::text) > 262144 or octet_length(coalesce(p_preview_svg, '')) > 200000 then raise exception 'This drawing is too large to save. Erase or clear some strokes.'; end if;
  for v_stroke in select * from jsonb_array_elements(v_st) loop
    if jsonb_typeof(v_stroke) <> 'object' or jsonb_typeof(v_stroke->'c') <> 'number' or jsonb_typeof(v_stroke->'p') <> 'array'
       or (v_stroke->>'c')::numeric not in (0, 1, 2) then
      raise exception 'Invalid drawing.';
    end if;
    v_len := jsonb_array_length(v_stroke->'p');
    if v_len < 4 or v_len % 2 <> 0 or v_len > 2000 then raise exception 'Invalid drawing.'; end if;
    v_total := v_total + v_len / 2;
    if v_total > 20000 then raise exception 'This drawing is too large to save. Erase or clear some strokes.'; end if;
    v_k := 0;
    for v_p in select * from jsonb_array_elements(v_stroke->'p') loop
      if jsonb_typeof(v_p) <> 'number' then raise exception 'Invalid drawing.'; end if;
      v_n := (v_p#>>'{}')::numeric;
      if v_n < 0 or v_n > (case when v_k % 2 = 0 then 800 else v_h end) or v_n <> trunc(v_n) then raise exception 'Invalid drawing.'; end if;
      v_k := v_k + 1;
    end loop;
  end loop;
  -- 미리보기는 허용 목록 형식(path d=M/L/숫자, stroke=#hex6)만. 결과 화면은 <img> 로만 그리지만 저장 단계에서도 막는다.
  if p_preview_svg is null or p_preview_svg !~ ('^<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ' || v_h || '">(<path d="M[0-9 L]+" stroke="#[0-9a-f]{6}" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>)+</svg>$') then
    raise exception 'Invalid drawing.';
  end if;

  insert into mock_exam_frq_handwriting (attempt_id, set_item_id, part_label, student_id, strokes, preview_svg, stroke_count, board_height, updated_at)
  values (p_attempt_id, p_set_item_id, p_part_label, auth.uid(), v_st, p_preview_svg, jsonb_array_length(v_st), v_h, now())
  on conflict (attempt_id, set_item_id, part_label) do update
    set strokes = excluded.strokes, preview_svg = excluded.preview_svg, stroke_count = excluded.stroke_count, board_height = excluded.board_height, updated_at = now();
end $$;
revoke execute on function public.save_mock_exam_frq_handwriting(uuid, uuid, text, jsonb, text, integer) from public, anon;
grant execute on function public.save_mock_exam_frq_handwriting(uuid, uuid, text, jsonb, text, integer) to authenticated, service_role;

-- 응시 하나의 모든 파트 손글씨. p_with_strokes=false 면 미리보기만(결과 화면), true 면 획까지(응시 화면 복원). 쿼리 1회.
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
             jsonb_build_object('setItemId', set_item_id, 'partLabel', part_label, 'strokeCount', stroke_count, 'previewSvg', preview_svg, 'boardHeight', board_height)
             || case when p_with_strokes then jsonb_build_object('strokes', strokes) else '{}'::jsonb end
             order by set_item_id, part_label)
      from mock_exam_frq_handwriting where attempt_id = p_attempt_id), '[]'::jsonb);
end $$;
revoke execute on function public.load_mock_exam_frq_handwriting(uuid, boolean) from public, anon;
grant execute on function public.load_mock_exam_frq_handwriting(uuid, boolean) to authenticated, service_role;
