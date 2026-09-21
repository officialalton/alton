-- 고정형 SAT 모의고사 V1 — 제출 즉시 자동 채점 확정 (2026-09-21 제품 오너 지시, UAT 지적)
--
-- 기존 정책: 학생이 제출(submitted)해도 담당 교사가 mock_exam_finalize_grading()을 눌러 확정해야만
-- 정답·해설이 열렸다(homework_batches와 같은 "교사 확인" 모델을 그대로 가져온 것). 실제 UAT에서
-- "제출하면 자동 채점되고 해설도 바로 볼 수 있어야 한다"는 지적을 받아, mc/spr처럼 서버가 이미
-- 자동 채점 가능한 문항으로만 구성되는 모의고사는 교사 확인 단계 없이 제출 즉시 채점 확정한다.
-- (자동 채점이 불가능한 서술형은 애초에 모의고사 V1 조립 대상이 아니다 — assemble.ts는 문제은행의
-- 공개 mc/spr 문항만 후보로 쓴다.)
--
-- mock_exam_finalize_grading() RPC 자체는 지우지 않는다(과거 이 라운드 전에 이미 submitted로
-- 멈춰 있던 응시가 있을 수 있어 안전망으로 남긴다) — 다만 정상 흐름에서는 더 이상 이 함수가
-- 호출될 필요가 없다(mock_exam_submit이 곧바로 graded로 전이시킨다).

create or replace function public.mock_exam_submit(p_attempt_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 제출할 수 있습니다.'; end if;
  if v_a.status not in ('assigned', 'in_progress') then raise exception '이미 제출한 시험입니다.'; end if;
  update mock_exam_attempts
    set status = 'graded', submitted_at = now(), graded_at = now(), attempt_count = 1
    where id = p_attempt_id;
end $$;

-- 이 정책 전환 이전에 이미 submitted 상태로 멈춰 교사 확정을 기다리던 응시가 있으면(비프로덕션
-- UAT 데이터) 같이 넘겨서 학생이 계속 대기 화면에 갇히지 않게 한다. 실제 채점 확정 로직(성적 계산)은
-- 이미 각 답안 저장 시점(mock_exam_save_answer)에 correct 컬럼으로 끝나 있으므로 상태만 옮기면 된다.
update mock_exam_attempts set status = 'graded', graded_at = coalesce(graded_at, now())
where status = 'submitted';
