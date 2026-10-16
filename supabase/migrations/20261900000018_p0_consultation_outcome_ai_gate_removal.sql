-- 2026-09-28 — 초기 고객 절차 단순화 3/3 (docs/2026-09-26-consent-contract-
-- simplification-implementation-plan.md 3단계)
--
-- admin_record_consultation_outcome()이 상담 결과 기록을 막던 3개 AI 기록
-- 조건(동의 확인, Smart Notes 활성화, Smart Notes 원본 자동 연결)을 제거한다.
-- 첫 상담에는 AI 기록을 아예 안 쓰므로 이 조건들 자체가 무의미해졌다(앱
-- 레이어의 computeConsultReadiness/computeCompletionReadiness는 이미 같은
-- 방향으로 수정됨 — app/admin/consultation-scheduling-actions.ts). 관리자
-- 검토 요약 작성 조건만 남긴다.

create or replace function public.admin_record_consultation_outcome(
  p_consultation_id uuid,
  p_outcome consult_outcome,
  p_notes text,
  p_admin_review_summary text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row consultations;
begin
  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if not (is_admin() or v_row.admissions_consultant_id = auth.uid()) then
    raise exception '관리자 또는 담당 컨설턴트만 상담 결과를 기록할 수 있습니다.';
  end if;

  if p_admin_review_summary is null or btrim(p_admin_review_summary) = '' then
    raise exception '검토 요약을 작성해야 상담 결과를 기록할 수 있습니다(공백 불가).';
  end if;

  update consultations set
    status = case when status = 'scheduled' then 'completed' else status end,
    completed_at = coalesce(completed_at, now()),
    outcome = p_outcome,
    outcome_notes = coalesce(p_notes, outcome_notes),
    admin_review_summary = p_admin_review_summary,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, v_row.status, v_row.status, auth.uid(), '상담 결과 기록: ' || p_outcome::text);

  return v_row;
end;
$$;

comment on function public.admin_record_consultation_outcome(uuid, consult_outcome, text, text) is
  '2026-09-28: 첫 상담에는 AI 기록(동의·Smart Notes)을 쓰지 않으므로 관련 게이트를 전부 제거 — '
  '관리자 검토 요약 작성만 필수. 관리자 또는 담당 컨설턴트만 호출 가능(2026-09-23 R15-A 유지).';
