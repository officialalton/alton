-- 2026-10-02(오너 요청) — 모의고사 응시 중 하이라이트 + 한 줄 메모 + 답 소거(Bluebook 식 도구).
-- 문항(응시×문항)당 한 행: highlights = [{id,start,end,text,note?}] — start/end 는 지문+질문 렌더 텍스트의
-- 글자 오프셋. eliminated = 소거한 선택지 인덱스 배열. 화이트보드 필기는 기존 problem_note_strokes('mock_exam')를 그대로 재사용한다(별도 저장소 없음).
-- 접근은 problem_note_strokes 와 같은 방식: RLS 켜고 정책 없음 → SECURITY DEFINER RPC 로만 접근.
--   저장: 본인 응시 · MST 만료 정산 · 제출/채점 후 차단 · 경로 밖 문항 차단 · 현재 모듈 아니거나 잠긴 모듈 차단
--         (mock_exam_toggle_guessed 와 같은 가드).
--   읽기: 본인은 항상, 남은 담당 교사·관리자·보호자만(제출 후 결과 화면 읽기 전용).
-- 재실행 안전: if not exists / create or replace.

create table if not exists public.mock_exam_annotations (
  attempt_id uuid not null references public.mock_exam_attempts (id) on delete cascade,
  set_item_id uuid not null references public.mock_exam_set_items (id) on delete cascade,
  student_id uuid not null references public.profiles (id),
  highlights jsonb not null default '[]'::jsonb,
  eliminated jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, set_item_id)
);
alter table public.mock_exam_annotations enable row level security;

create or replace function public.save_mock_exam_annotations(p_attempt_id uuid, p_set_item_id uuid, p_highlights jsonb, p_eliminated jsonb default '[]'::jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_m mock_exam_attempt_modules%rowtype; v_h jsonb; v_hl jsonb := coalesce(p_highlights, '[]'::jsonb); v_el jsonb := coalesce(p_eliminated, '[]'::jsonb); v_e jsonb;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 진행할 수 있습니다.'; end if;
  if jsonb_typeof(v_hl) <> 'array' or jsonb_array_length(v_hl) > 60 then raise exception '하이라이트 형식이 올바르지 않습니다.'; end if;
  for v_h in select * from jsonb_array_elements(v_hl) loop
    if jsonb_typeof(v_h) <> 'object'
       or jsonb_typeof(v_h->'start') <> 'number' or jsonb_typeof(v_h->'end') <> 'number'
       or (v_h->>'start')::numeric < 0 or (v_h->>'end')::numeric <= (v_h->>'start')::numeric
       or (v_h ? 'note' and (jsonb_typeof(v_h->'note') <> 'string' or char_length(v_h->>'note') > 120))
       or char_length(coalesce(v_h->>'text', '')) > 2000 then
      raise exception '하이라이트 형식이 올바르지 않습니다.';
    end if;
  end loop;
  if jsonb_typeof(v_el) <> 'array' or jsonb_array_length(v_el) > 8 then raise exception '소거 형식이 올바르지 않습니다.'; end if;
  for v_e in select * from jsonb_array_elements(v_el) loop
    if jsonb_typeof(v_e) <> 'number' or (v_e#>>'{}')::numeric not between 0 and 7 then raise exception '소거 형식이 올바르지 않습니다.'; end if;
  end loop;
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
  insert into mock_exam_annotations (attempt_id, set_item_id, student_id, highlights, eliminated, updated_at)
  values (p_attempt_id, p_set_item_id, auth.uid(), v_hl, v_el, now())
  on conflict (attempt_id, set_item_id) do update set highlights = excluded.highlights, eliminated = excluded.eliminated, updated_at = now();
end $$;
revoke execute on function public.save_mock_exam_annotations(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_mock_exam_annotations(uuid, uuid, jsonb, jsonb) to authenticated, service_role;

create or replace function public.load_mock_exam_annotations(p_attempt_id uuid, p_set_item_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_student uuid;
begin
  select student_id into v_student from mock_exam_attempts where id = p_attempt_id;
  if v_student is null then raise exception '응시를 찾을 수 없습니다.'; end if;
  if v_student <> auth.uid() and not (is_admin() or teaches_student(v_student) or is_guardian_of(v_student)) then
    raise exception '이 표시를 볼 권한이 없습니다.';
  end if;
  return coalesce(
    (select jsonb_build_object('highlights', highlights, 'eliminated', eliminated)
       from mock_exam_annotations where attempt_id = p_attempt_id and set_item_id = p_set_item_id),
    '{"highlights":[],"eliminated":[]}'::jsonb);
end $$;
revoke execute on function public.load_mock_exam_annotations(uuid, uuid) from public, anon;
grant execute on function public.load_mock_exam_annotations(uuid, uuid) to authenticated, service_role;
