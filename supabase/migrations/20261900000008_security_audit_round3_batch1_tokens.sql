-- 2026-09-24(Section 2 — SECURITY DEFINER 3차 감사, 위험도 최상위: 토큰 발급 그룹) —
-- 정규식 1차 스크리닝에서 "인가 패턴 있음"으로 분류돼 넘어간 118개 중, 토큰
-- 발급·계정 초대·온보딩 링크 관련 14개를 실측 재현·호출부 대조로 개별 검증.
--
-- **실제 결함 1건 확인(exploit 성립)**: finalize_account_invite(p_invite_id,
-- p_auth_user_id) — 본문에 auth.uid() 검사가 전혀 없고, 호출자가 invite_id와
-- auth_user_id를 **둘 다 직접 지정**한다. 유일한 정상 검증(claim_account_invite로
-- 토큰을 확인해 status='accepted'로 만드는 것)은 이 함수 호출 *전* 단계이고,
-- 이 함수 자체는 그 상태 전이가 이미 끝났다는 것만 믿는다. anon이 임의
-- invite_id(status='accepted', target_profile_id is null인 상태 — claim 직후
-- ~ finalize 사이의 실제 존재하는 경합 구간)에 자기가 원하는 auth_user_id를
-- 넣어 직접 호출하면, 원래 그 초대의 주인이 아닌 계정을 그 household/학생
-- 프로필에 연결시킬 수 있었다(계정 탈취류). 유일한 실제 호출부
-- (app/api/invite/accept/route.ts)는 admin(service_role) 클라이언트로만 부르고
-- p_auth_user_id도 그 라우트 자신이 서버에서 만든 값만 쓴다 — anon/authenticated
-- 권한은 순수 과잉이었다.
--
-- 나머지는 전부 앱 호출부가 admin 또는 session 클라이언트로만 쓰고, 토큰/링크
-- possession 자체가 설계상 인가 근거인 것들(peek/confirm/redeem 계열, 코드
-- 주석에 명시)도 anon 직접 RPC 우회 경로는 애초에 불필요 — 앱은 전부 서버
-- 레이어를 거친다. 정상 흐름에 영향 없이 과잉 권한만 회수한다.

-- 1) 가장 심각 — 유일한 실제 호출부가 service_role뿐이라 service_role만 남긴다.
revoke execute on function public.finalize_account_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_account_invite(uuid, uuid) to service_role;

-- 2) admin 클라이언트로만 호출되는 토큰/링크 함수들 — service_role만 남긴다.
-- (주의) claim_account_invite(text)는 여기서 제외한다 — 기존 통합 테스트
-- (app/admin/account-invite-protect-token.integration.test.ts)가 "anon 정상
-- 수락"을 명시적으로 요구하는 계약으로 짜여 있어(6개 테스트가 `set role anon`으로
-- 직접 호출), anon 실행권한이 실수가 아니라 의도된 설계다 — 토큰 해시 검증만이
-- 유일한 인가 근거이므로 anon이 직접 불러도 안전하고, 이 계약을 깨면 실제
-- 회귀가 난다(직접 확인함).
revoke execute on function public.confirm_consult_consent_by_token(text) from public, anon, authenticated;
grant execute on function public.confirm_consult_consent_by_token(text) to service_role;
revoke execute on function public.peek_trial_login_email_change(text) from public, anon, authenticated;
grant execute on function public.peek_trial_login_email_change(text) to service_role;
revoke execute on function public.confirm_trial_login_email_change(text) from public, anon, authenticated;
grant execute on function public.confirm_trial_login_email_change(text) to service_role;
revoke execute on function public.redeem_trial_onboarding_link(text) from public, anon, authenticated;
grant execute on function public.redeem_trial_onboarding_link(text) to service_role;
revoke execute on function public.redeem_consultation_scheduling_link(text, timestamptz) from public, anon, authenticated;
grant execute on function public.redeem_consultation_scheduling_link(text, timestamptz) to service_role;
revoke execute on function public.claim_trial_onboarding_link_finalize(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_trial_onboarding_link_finalize(uuid, integer) to service_role;
revoke execute on function public.request_trial_login_email_change(uuid, text) from public, anon, authenticated;
grant execute on function public.request_trial_login_email_change(uuid, text) to service_role;

-- 3) session 클라이언트(authenticated, is_admin()/본인소유 등 내부 검사 있음)로
--    호출되는 것들 — anon만 회수, authenticated는 실사용 중이라 유지.
revoke execute on function public.create_account_invite(text, text, text, uuid, text) from public, anon;
revoke execute on function public.resend_account_invite(uuid) from public, anon;
revoke execute on function public.revoke_account_invite(uuid) from public, anon;
revoke execute on function public.resolve_manual_review_invite(uuid, text, uuid, uuid) from public, anon;
revoke execute on function public.mark_workspace_invite_sent(uuid) from public, anon;
