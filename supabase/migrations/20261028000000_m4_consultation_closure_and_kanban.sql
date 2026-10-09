-- M4 UAT 라운드 #3.1/#5/#6 — 상담 현황 화면을 5단계 칸반으로 재편하고 "상담 종료"
-- 흐름(리뷰 팝업 → 종료유형 확정 → 지난 상담 탭)을 추가한다.
--
-- 설계 메모(2026-09-05):
-- - 기존 admin_reject_consultation()의 주석대로 v3_consultation_status의 'closed'
--   값은 실질적으로 어디서도 세팅되지 않는 예약값이었고, admin_record_consultation_outcome()의
--   outcome='closed'는 "상담 자체가 트리거인 종료 사유 메모"일 뿐 이번 4종 종료유형
--   분류(체험 없이 종료/체험 후 종료/정규 진행 중 종료/정규 계약 날인)와 다른 개념이다.
--   기존 status/outcome 의미를 바꾸지 않기 위해 status 컬럼은 건드리지 않고,
--   완전히 새로운 closure_type/closed_at/closure_review_text 컬럼으로 "지난 상담"
--   소속 여부와 종료유형을 판정한다(closure_type is not null == 지난 상담).
-- - "체험 없이 종료"/"체험 후 종료"/"정규 진행 중 종료"/"정규 계약 날인"은 상담
--   시점에 아직 트리거되지 않은 이후 단계(체험 진행 여부, 정규 계약 서명 여부)에
--   따라 달라지므로 서버가 자동 판정하지 않고 관리자가 팝업에서 직접 선택한다
--   (자동판정을 시도하면 트라이얼/계약 데이터가 아직 비어있는 이른 종료 케이스를
--   놓친다 — 예: 체험 전 종료인데 outcome이 아직 null인 경우).

create type consultation_closure_type as enum (
  'no_trial',            -- 체험 없이 종료
  'trial_no_convert',     -- 체험 후 종료(정규 미전환)
  'regular_in_progress',  -- 정규 진행 중 종료(상담 파이프라인 관점에서는 종료, 실제 수업은 계속)
  'contract_signed'       -- 정규 계약 날인
);

alter table consultations
  add column closure_type consultation_closure_type,
  add column closed_at timestamptz,
  add column closure_review_text text;

comment on column consultations.closure_type is
  '4가지 종료유형(M4 UAT #5). null이면 아직 진행 중(칸반 대상), not null이면 지난 상담 탭 대상.';
comment on column consultations.closure_review_text is
  'AI 미팅록 재요약 + 관리자 확인/수정 결과. 상담 종료 팝업에서 확정한 최종 텍스트.';

-- 지난 상담 목록/통계 조회를 위한 인덱스.
create index consultations_closure_type_idx on consultations (closure_type) where closure_type is not null;

create or replace function public.admin_close_consultation(
  p_consultation_id uuid,
  p_closure_type consultation_closure_type,
  p_review_text text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row consultations;
begin
  if not is_admin() then
    raise exception '관리자만 상담을 종료할 수 있습니다.';
  end if;

  if p_review_text is null or btrim(p_review_text) = '' then
    raise exception '상담 종료 시 리뷰 내용을 비워둘 수 없습니다.';
  end if;

  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담을 찾을 수 없습니다: %', p_consultation_id;
  end if;

  if v_row.closure_type is not null then
    raise exception '이미 종료된 상담입니다.';
  end if;

  update consultations set
    closure_type = p_closure_type,
    closed_at = now(),
    closure_review_text = p_review_text,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, v_row.status, v_row.status, auth.uid(), '상담 종료: ' || p_closure_type::text);

  return v_row;
end;
$$;

revoke all on function public.admin_close_consultation(uuid, consultation_closure_type, text) from public;
grant execute on function public.admin_close_consultation(uuid, consultation_closure_type, text) to authenticated;
revoke execute on function public.admin_close_consultation(uuid, consultation_closure_type, text) from anon;
