-- 2026-09-11(제품 오너 지적 — GET 무변경 요구 미충족) — 기존
-- confirm_trial_login_email_change()는 status='pending'인 요청을 처음
-- 열람할 때 status를 'confirmed'로 바꾸고 confirmed_at을 채우고
-- trial_onboarding_link_events에 행을 추가한다("멱등"은 두 번째 호출부터일
-- 뿐, 첫 호출은 실제 상태 변경이다). 이 함수가 GET 라우트/미리보기 페이지
-- 양쪽에서 호출되고 있어 GET만으로 상태가 바뀌는 문제였다.
--
-- 여기서는 순수 조회 전용 함수를 새로 추가한다 — 어떤 UPDATE/INSERT도
-- 하지 않고 현재 상태만 그대로 반환한다(만료 판정도 DB에 쓰지 않고 계산만
-- 해서 돌려준다). 실제 상태 전이(confirmed 처리, 이벤트 기록)는 기존
-- confirm_trial_login_email_change()가 그대로 담당하며, 이제 이 함수는
-- 앱 코드에서 명시적 확인 버튼이 호출하는 Server Action에서만 호출된다.
create or replace function public.peek_trial_login_email_change(p_token text)
returns table(link_id uuid, requested_email text, status text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row trial_login_email_change_requests%rowtype;
  v_token_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  select * into v_row from trial_login_email_change_requests where token_hash = v_token_hash;
  if not found then
    raise exception '유효하지 않은 확인 링크입니다.';
  end if;

  if v_row.status = 'pending' and v_row.expires_at <= now() then
    return query select v_row.link_id, v_row.requested_email, 'expired'::text;
    return;
  end if;

  return query select v_row.link_id, v_row.requested_email, v_row.status::text;
end;
$function$;
