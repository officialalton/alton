-- 2026-09-23 — SECURITY DEFINER·anon 권한 감사(1차) 후속. 20261900000001에서
-- hold_entitlement를 고쳤다고 생각했으나, p_lesson_type_id 인자를 나중에 추가하며
-- 남은 구버전 4-인자 오버로드가 별도 함수 객체로 남아 PUBLIC(=X, 즉 anon 포함
-- 누구나) EXECUTE 권한을 그대로 갖고 있었다 — 실측으로 재확인(anon 역할로
-- 직접 호출해 실제로 실행됨, 인자 없어 "사용 가능한 수업권이 없습니다" 비즈니스
-- 예외까지 도달함 = 함수 본문이 그대로 실행됐다는 뜻).
--
-- 앱 코드는 항상 5개 인자(p_lesson_type_id 포함, null 허용)로만 호출하므로
-- (app/admin/entitlement-actions.ts) 이 4-인자 구버전은 죽은 오버로드다.

revoke execute on function public.hold_entitlement(uuid, uuid, timestamptz, integer) from public, anon, authenticated;
