-- 2026-09-21(사용자 지시) — 모의고사 문항에도 "문제 저장" 버튼. 학생 포털 Practice
-- 탭(옛 문제 기록)에 단어장의 "내 단어장"처럼 원할 때만 추가하는 구조 — 수업/과제
-- 문제처럼 전부 자동으로 들어가는 게 아니라, 학생이 저장 버튼을 누른 문항만 보인다.
-- mock_exam_toggle_flag(20261429000000)와 같은 패턴의 별도 컬럼·RPC.

alter table public.mock_exam_answers
  add column if not exists saved_to_practice boolean not null default false;

create or replace function public.mock_exam_toggle_saved_to_practice(p_attempt_id uuid, p_set_item_id uuid, p_saved boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 저장할 수 있습니다.'; end if;
  if not exists (select 1 from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id) then
    raise exception '문항을 찾을 수 없습니다.';
  end if;
  insert into mock_exam_answers (attempt_id, set_item_id, saved_to_practice, updated_at)
  values (p_attempt_id, p_set_item_id, p_saved, now())
  on conflict (attempt_id, set_item_id) do update set saved_to_practice = excluded.saved_to_practice, updated_at = now();
end $$;
