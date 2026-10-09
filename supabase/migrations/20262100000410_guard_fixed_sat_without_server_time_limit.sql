-- 활성화 차단(activation blocker) 가드 — 비 AP 고정형(format='fixed') SAT 모의고사는 서버가 시간 제한을 강제하지 않는다
-- (mock_exam_save_answer·mock_exam_submit 에 고정형 만료 검사가 없고 타이머는 클라이언트뿐). 서버 강제가 구현되기 전에는 공개·시작할 수 없게 막는다.
-- MST(서버 기준 모듈 시계)와 AP(406 서버 시계)는 영향 없음. 비프로덕션 점검 시점(2026-10-09) 공개된 고정형 SAT 세트는 0개라 현재 동작 변화 없음.
-- 제거 방법(서버 강제를 구현한 뒤): 트리거 2개와 함수 2개를 drop 하면 된다(아래 되돌리기). 가드는 세션 설정 alton.allow_fixed_sat_without_time_limit='on' 일 때만 통과 —
-- 레거시 테스트 픽스처 전용(vitest 통합 설정이 켠다). 운영·앱 코드에서는 켜지 않는다.
-- 되돌리기: drop trigger mock_exam_sets_fixed_sat_publish_guard on public.mock_exam_sets; drop trigger mock_exam_attempts_fixed_sat_start_guard on public.mock_exam_attempts; drop function public._mock_exam_fixed_sat_publish_guard(); drop function public._mock_exam_fixed_sat_start_guard();
create or replace function public._mock_exam_fixed_sat_publish_guard() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and coalesce(new.exam_program, 'sat') <> 'ap' and new.format = 'fixed'
     and coalesce(current_setting('alton.allow_fixed_sat_without_time_limit', true), '') <> 'on' then
    raise exception 'Fixed-format SAT mock exams cannot be published yet: the server does not enforce their time limit (activation blocker). 고정형 SAT 모의고사는 서버 시간 제한이 구현될 때까지 공개할 수 없습니다.';
  end if;
  return new;
end $$;
drop trigger if exists mock_exam_sets_fixed_sat_publish_guard on public.mock_exam_sets;
create trigger mock_exam_sets_fixed_sat_publish_guard before insert or update of status, format on public.mock_exam_sets
  for each row execute function public._mock_exam_fixed_sat_publish_guard();

create or replace function public._mock_exam_fixed_sat_start_guard() returns trigger language plpgsql as $$
declare v_fmt text; v_prog text;
begin
  select format, coalesce(exam_program, 'sat') into v_fmt, v_prog from mock_exam_sets where id = new.exam_set_id;
  if v_fmt = 'fixed' and v_prog <> 'ap' and coalesce(current_setting('alton.allow_fixed_sat_without_time_limit', true), '') <> 'on' then
    raise exception 'Fixed-format SAT mock exams cannot be started yet: the server does not enforce their time limit (activation blocker).';
  end if;
  return new;
end $$;
drop trigger if exists mock_exam_attempts_fixed_sat_start_guard on public.mock_exam_attempts;
create trigger mock_exam_attempts_fixed_sat_start_guard before insert on public.mock_exam_attempts
  for each row execute function public._mock_exam_fixed_sat_start_guard();
