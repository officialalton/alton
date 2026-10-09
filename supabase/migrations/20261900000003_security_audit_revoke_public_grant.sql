-- 2026-09-23 — SECURITY DEFINER·anon 권한 감사 후속 정정. 20261900000001에서
-- hold_entitlement(5-인자 현재 버전)의 anon/authenticated만 revoke했는데, 원래
-- ACL에 PUBLIC(=X) 권한도 별도로 있어 anon이 PUBLIC을 통해 여전히 실행 가능했다
-- (has_function_privilege('anon', ...)로 실측 재확인). 이미 적용된
-- 20261900000001 파일 자체를 고쳐도 반영되지 않으므로(버전 번호 추적) 새 번호로
-- 마저 제거한다.
revoke execute on function public.hold_entitlement(uuid, uuid, timestamptz, integer, uuid) from public;
