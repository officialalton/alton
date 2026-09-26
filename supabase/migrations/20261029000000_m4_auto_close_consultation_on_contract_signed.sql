-- M4(사용자 지시, 2026-09-05, 4번) — 계약이 실제로 서명 완료(active 전환)되는
-- 순간 관리자가 수동으로 "상담 종료"를 누르지 않아도 자동으로 closure_type=
-- 'contract_signed'로 종료 처리해 "지난 상담"으로 옮긴다. 이 전환은
-- app/api/webhooks/docusign/route.ts의 envelopeStatus==='completed' 분기,
-- contracts.status를 'active'로 UPDATE하는 바로 그 지점에서 트리거된다.
--
-- admin_close_consultation()은 지금까지 is_admin()(auth.uid() 기준 profiles.role
-- 조회)만 허용했다 — DocuSign 웹훅은 관리자 세션이 없는 service_role 컨텍스트라
-- auth.uid()가 없다(is_admin() 자체가 false). service_role 호출도 허용하도록
-- "is_admin() 이거나 auth.uid()가 없음(service_role)"으로 완화한다. 기존 관리자
-- 수동 종료 경로(앱의 requireAdminOrCapability가 이미 authenticated 세션에서만
-- 이 RPC를 호출하도록 게이트하므로, 여기서 auth.uid() is null을 추가로 허용해도
-- 일반 로그인 사용자가 이 함수를 우회 호출할 신규 경로가 생기지 않는다 — anon도
-- 여전히 execute 권한이 없다).

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
  if not (is_admin() or auth.uid() is null) then
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

comment on function public.admin_close_consultation(uuid, consultation_closure_type, text) is
  '관리자 수동 종료(authenticated, is_admin()) + DocuSign 웹훅의 계약 서명 완료 자동 종료
   (service_role, auth.uid() is null) 양쪽에서 호출된다(M4, 2026-09-05).';
