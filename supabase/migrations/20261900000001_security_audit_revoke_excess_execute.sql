-- 2026-09-23 — SECURITY DEFINER·anon 권한 감사(1차)에서 발견한 실제 결함 수정.
-- 세 함수 모두 앱 코드의 유일한 실제 호출부가 requireAdmin() + createAdminClient()
-- (service_role) 조합만 쓰고 있어, anon/authenticated에 준 EXECUTE 권한은 순수한
-- 과잉 권한이었다 — PostgREST RPC(/rest/v1/rpc/<fn>)로 누구나(또는 로그인만 한
-- 사용자) 직접 호출해 관리자 검사를 완전히 우회할 수 있었다.
--
-- 1) find_possible_duplicate_consultations(p_email, p_phone, p_exclude_id)
--    anon이 임의의 이메일/전화번호로 호출하면 consultations 테이블 전체 컬럼
--    (연락처·상담 내용 등 PII)을 그대로 돌려받을 수 있었다 — 실제 데이터 유출.
--    유일한 호출부: app/admin/consultation-actions.ts의 findDuplicateConsultationCandidates
--    (requireAdmin() 이후 service_role로 호출) — anon/authenticated 권한 불필요.
--
-- 2) hold_entitlement(p_child_id, p_reservation_id, ...)
--    내부에 호출자 권한 검사가 전혀 없어, child_id/reservation_id만 알면(또는
--    맞히면) 누구나 다른 가족의 수업권을 소모(hold)시킬 수 있었다.
--    유일한 호출부: app/admin/entitlement-actions.ts의 holdEntitlementForReservation
--    (requireAdmin() 이후 service_role로 호출) — anon/authenticated 권한 불필요.
--
-- 3) mark_expired_invites()
--    내부적으로 is_admin() 검사가 있어 anon이 호출해도 예외로 막히긴 하지만,
--    아직 앱 코드 어디서도 호출하지 않는(cron 미연결) 함수에 불필요하게
--    anon/authenticated EXECUTE가 남아있었다 — 방어 심층화 원칙 위반. 추후
--    cron이 이 함수를 호출할 때는 service_role을 쓸 것이므로 그 권한만 남긴다.

revoke execute on function public.find_possible_duplicate_consultations(text, text, uuid) from public, anon, authenticated;
revoke execute on function public.hold_entitlement(uuid, uuid, timestamptz, integer, uuid) from public, anon, authenticated;
revoke execute on function public.mark_expired_invites() from public, anon, authenticated;
