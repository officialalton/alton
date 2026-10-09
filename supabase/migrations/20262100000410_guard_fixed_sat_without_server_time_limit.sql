-- 활성화 차단(activation blocker) 가드 — 비 AP 고정형(format='fixed') SAT 모의고사는 서버가 시간 제한을 강제하지 않는다
-- (mock_exam_save_answer·mock_exam_submit 에 고정형 만료 검사가 없고 타이머는 클라이언트뿐). 서버 강제가 구현되기 전에는 공개·시작할 수 없게 막는다.
-- MST(서버 기준 모듈 시계)와 AP(406 서버 시계)는 영향 없음. 비프로덕션 점검 시점(2026-10-09) 공개된 고정형 SAT 세트는 0개라 현재 동작 변화 없음.
-- 제거 방법(서버 강제를 구현한 뒤): 되돌리기 절차 하면 된다(아래 되돌리기). 가드는 세션 설정 alton.allow_fixed_sat_without_time_limit='on' 일 때만 통과 —
-- 레거시 테스트 픽스처 전용(vitest 통합 설정이 켠다). 운영·앱 코드에서는 켜지 않는다.
-- 되돌리기: drop trigger mock_exam_sets_fixed_sat_publish_guard on public.mock_exam_sets; drop function public.mock_exam_open_start(uuid); alter function public._mock_exam_open_start_v1(uuid) rename to mock_exam_open_start; (+ grant execute … to authenticated, service_role); drop function public._mock_exam_fixed_sat_publish_guard();
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

-- 시작 가드: 응시 INSERT 트리거는 RLS 오류 메시지를 가리므로 mock_exam_open_start(학생 시작 유일 경로)를 감싸는 방식으로 둔다. 원본은 _mock_exam_open_start_v1 로 이름만 바뀐다.
do $$ begin
  if not exists (select 1 from pg_proc where proname = '_mock_exam_open_start_v1') then
    alter function public.mock_exam_open_start(uuid) rename to _mock_exam_open_start_v1;
    revoke execute on function public._mock_exam_open_start_v1(uuid) from public, anon, authenticated;
  end if;
end $$;
create or replace function public.mock_exam_open_start(p_exam_set_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_fmt text; v_prog text; v_status text;
begin
  select format, coalesce(exam_program, 'sat'), status into v_fmt, v_prog, v_status from mock_exam_sets where id = p_exam_set_id;
  -- 이어하기(이미 진행 중인 응시)는 v1 이 먼저 돌려주므로, 새 응시를 만들 때만 막는다: 진행 중 응시가 없을 때.
  if v_fmt = 'fixed' and v_prog <> 'ap' and coalesce(current_setting('alton.allow_fixed_sat_without_time_limit', true), '') <> 'on'
     and not exists (select 1 from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id
                     where a.student_id = auth.uid() and s.set_group_id = (select set_group_id from mock_exam_sets where id = p_exam_set_id) and a.status <> 'graded') then
    raise exception 'Fixed-format SAT mock exams cannot be started yet: the server does not enforce their time limit (activation blocker).';
  end if;
  return _mock_exam_open_start_v1(p_exam_set_id);
end $$;
revoke execute on function public.mock_exam_open_start(uuid) from public, anon;
grant execute on function public.mock_exam_open_start(uuid) to authenticated, service_role;
