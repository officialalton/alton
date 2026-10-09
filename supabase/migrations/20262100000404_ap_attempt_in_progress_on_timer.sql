-- AP 응시는 화면을 여는 순간 섹션 타이머가 돌기 시작한다(일시정지 없음, 15초마다 mock_exam_save_section_time 저장).
-- 그런데 응시 상태는 첫 답을 저장해야 'in_progress' 가 돼서, 답 없이 시간이 흐르는 응시가 목록에 "Not started" 로 보였다.
-- AP 섹션(ap_*)의 시간 저장이 'assigned' 응시를 'in_progress' 로 올린다. SAT 섹션(rw·math)의 동작은 그대로다.
-- 되돌리기: 20262100000401 의 mock_exam_save_section_time 정의로 create or replace.
create or replace function public.mock_exam_save_section_time(p_attempt_id uuid, p_section text, p_remaining_seconds int)
returns void language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype;
begin
  if p_section not in ('rw', 'math') and p_section !~ '^ap_[a-z0-9_]{1,30}$' then raise exception 'Invalid section.'; end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only take your own exam.'; end if;
  if v_a.status in ('submitted', 'graded') then return; end if;
  update mock_exam_attempts
    set time_remaining_seconds = coalesce(time_remaining_seconds, '{}'::jsonb) || jsonb_build_object(p_section, greatest(0, p_remaining_seconds)),
        status = case when p_section ~ '^ap_' and status = 'assigned' then 'in_progress' else status end,
        started_at = case when p_section ~ '^ap_' and status = 'assigned' then coalesce(started_at, now()) else started_at end
    where id = p_attempt_id;
end $$;
