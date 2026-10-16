-- R15-A(2/3) — 신규 칸반 분리: 관리자·컨설턴트가 같은 카드 데이터·단계 판정을
-- 보되 행동만 역할별로 나눈다. 이 마이그레이션은 "컨설턴트가 본인 배정 건에서
-- 할 수 있는 행동"(첫 상담 수락/거절, 상담 결과 기록)의 서버 권한을 연다 —
-- 화면에서 버튼을 숨기는 것만으로는 안 되므로 RPC 자체가 검사한다.
--
-- 명시적으로 컨설턴트에게 열지 않는 것(그대로 관리자 전용): 계약 발송/재발송/
-- 새 버전 생성/수동 완료(sendRegularContractOneClickAction 등은 requireAdmin/
-- requireAdminOrCapability('manage_consultations')를 그대로 쓰고, 어떤 consultant
-- 계정도 manage_consultations capability를 보유하지 않는다 — 20261450000000
-- 이후 부여 이력 없음, 이번에도 부여하지 않음), 상담 시간 변경/취소
-- (admin_reschedule_consultation/admin_cancel_consultation, 그대로 관리자만),
-- 상담 종료 확정(closeConsultationAction, 그대로 관리자만), 온보딩 안내 발송·
-- 체험수업권 재처리(그대로 관리자만 — 실제 이메일 발송 지점은 계정 생성 탭과
-- 동일하게 관리자 확인 게이트 유지), 과목·선생님 직접 배정(SubjectTeacherAssignForm
-- — 컨설턴트는 이번 마이그레이션의 짝인 teacher_assignment_requests 흐름으로
-- 대체된다, 관리자는 기존 직접 배정 그대로 유지).

create or replace function public.admin_accept_consultation(
  p_consultation_id uuid,
  p_consent_version_id uuid
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
    raise exception '관리자 또는 담당 컨설턴트만 상담을 수락할 수 있습니다.';
  end if;
  if v_row.status not in ('requested') then
    raise exception '이미 처리된 상담입니다(현재 상태: %).', v_row.status;
  end if;

  update consultations set
    status = 'scheduled',
    scheduled_at = starts_at,
    hold_expires_at = null,
    consent_version_id = coalesce(p_consent_version_id, v_row.consent_version_id),
    created_by = coalesce(created_by, auth.uid()),
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, 'requested', 'scheduled', auth.uid(), case when is_admin() then '관리자 수락' else '담당 컨설턴트 수락' end);

  return v_row;
end;
$$;

create or replace function public.admin_reject_consultation(
  p_consultation_id uuid,
  p_reason text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row consultations;
  v_prev v3_consultation_status;
begin
  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if not (is_admin() or v_row.admissions_consultant_id = auth.uid()) then
    raise exception '관리자 또는 담당 컨설턴트만 상담을 거절할 수 있습니다.';
  end if;
  v_prev := v_row.status;

  update consultations set
    status = 'cancelled',
    hold_expires_at = null,
    outcome_notes = coalesce(p_reason, outcome_notes),
    cancelled_at = now(),
    cancellation_reason = p_reason,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, v_prev, 'cancelled', auth.uid(), coalesce(p_reason, case when is_admin() then '관리자 거절' else '담당 컨설턴트 거절' end));

  return v_row;
end;
$$;

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

  if v_row.consent_version_id is null or v_row.consent_confirmed_at is null then
    raise exception '동의 확인이 완료되지 않아 상담 결과를 기록할 수 없습니다(consent_confirmed_at 없음).';
  end if;
  if v_row.smart_notes_config_status is distinct from 'applied' then
    raise exception 'Smart Notes 활성화가 확인되지 않아 상담 결과를 기록할 수 없습니다(smart_notes_config_status: %).', v_row.smart_notes_config_status;
  end if;
  if v_row.smart_notes_drive_file_id is null then
    raise exception 'Smart Notes 원본이 아직 이 상담에 자동 연결되지 않아 상담 결과를 기록할 수 없습니다(smart_notes_drive_file_id 없음 — 관리자 재처리 대상).';
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

comment on function public.admin_accept_consultation(uuid, uuid) is
  '2026-09-23(R15-A) — 관리자 또는 이 상담의 담당 컨설턴트(admissions_consultant_id)만
  수락할 수 있다. 그 외 컨설턴트·다른 역할은 거부.';
comment on function public.admin_reject_consultation(uuid, text) is
  '2026-09-23(R15-A) — 관리자 또는 담당 컨설턴트만. 위와 동일 원칙.';
comment on function public.admin_record_consultation_outcome(uuid, consult_outcome, text, text) is
  '2026-09-23(R15-A) — 관리자 또는 담당 컨설턴트만. 위와 동일 원칙. 계약 발송/재발송/
  수동 완료/상담 종료 확정/온보딩 안내 발송은 이 함수 범위 밖 — 여전히 관리자 전용
  RPC(admin_reschedule_consultation/admin_cancel_consultation/close_consultation 계열,
  sendRegularContractOneClickAction 등)로만 처리된다.';
