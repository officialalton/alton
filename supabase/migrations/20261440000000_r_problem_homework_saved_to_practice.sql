-- 2026-09-22(사용자 지시) — "문제"·"과제" 탭에도 모의고사처럼 "문제 저장" 기능을
-- 추가하면서, Practice 탭 정책도 함께 바꾼다: 수업/과제 문제도 이제 푼다고 전부
-- 자동으로 뜨지 않고, 학생이 저장한 것만 뜬다(모의고사와 동일한 opt-in 구조).

-- 1) 수업 "문제" 탭 — session_problem_work 기반(이미 workId가 있다).
alter table session_problem_work add column if not exists saved_to_practice boolean not null default false;

create or replace function public.toggle_problem_work_saved_to_practice(p_work_id uuid, p_saved boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_w session_problem_work%rowtype;
begin
  select * into v_w from session_problem_work where id = p_work_id;
  if v_w.id is null or v_w.student_id <> auth.uid() then raise exception '본인 풀이만 저장할 수 있습니다.'; end if;
  update session_problem_work set saved_to_practice = p_saved where id = p_work_id;
end $$;

-- 2) "과제" 탭 — homework_batches.items는 문항 스냅샷을 담은 jsonb 배열이라(개별 행이
-- 아니다) 저장 여부도 그 배열 원소 안에 savedToPractice로 함께 둔다.
create or replace function public.toggle_homework_item_saved_to_practice(p_batch_id uuid, p_problem_id uuid, p_saved boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_student_id uuid;
begin
  select student_id into v_student_id from homework_batches where id = p_batch_id;
  if v_student_id is null or v_student_id <> auth.uid() then raise exception '본인 과제만 저장할 수 있습니다.'; end if;
  update homework_batches
  set items = (
    select jsonb_agg(
      case when (item ->> 'problemId') = p_problem_id::text
        then item || jsonb_build_object('savedToPractice', p_saved)
        else item end
    )
    from jsonb_array_elements(items) as item
  )
  where id = p_batch_id;
end $$;
