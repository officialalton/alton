-- 2026-09-28 — is_within_booking_window / hold_entitlement 중복 오버로드 정리
--
-- finalize_trial_onboarding_students(20261900000019)와 동일한 패턴의 leftover
-- 오버로드. 확인된 사실:
--   - is_within_booking_window(p_starts_at timestamptz)는 20260926000000에서
--     처음 만들어졌고, 20260929000000이 p_admin_override 파라미터를 추가한
--     2-인자 버전을 새로 만들면서(시그니처가 달라 create or replace가 원래
--     함수를 갱신하지 못함) 1-인자 버전이 그대로 남았다.
--     `select is_within_booking_window(now())`처럼 1개 인자로 호출하면(기본값
--     매칭 때문에 두 오버로드 모두 후보가 되어) "function ... is not unique"
--     에러가 난다.
--   - hold_entitlement(p_child_id, p_reservation_id, p_lesson_start_at,
--     p_needed default 1)도 20260926000000에서 처음 만들어졌고,
--     20261012000000이 p_lesson_type_id를 추가한 5-인자 버전을 새로 만들면서
--     같은 이유로 4-인자 버전이 남았다.
--
-- 실제 영향 확인(2026-09-28, 로컬 db reset 직후 pg_proc.prosrc 검사): 현재
-- confirm_lesson_booking()의 최신 정의(20261900000017)는 두 함수 모두
-- 전체 인자를 명시해서 호출하므로(is_within_booking_window(p_starts_at,
-- p_admin_override), hold_entitlement(p_child_id, v_reservation_id,
-- p_starts_at, 1, p_lesson_type_id)) 지금 당장 앱 코드 경로에서 이 모호성이
-- 터지지는 않는다 — 다만 미래에 짧은 인자로 호출하는 코드(관리자 스크립트,
-- 콘솔 디버깅, 새 RPC)가 추가되면 조용히 깨질 수 있으므로 finalize와
-- 동일하게 legacy 오버로드를 제거해 예방한다.
--
-- 최신 정본(더 많은 파라미터를 받는 쪽)은 그대로 두고 legacy 오버로드만 drop한다.

drop function if exists public.is_within_booking_window(timestamptz);
drop function if exists public.hold_entitlement(uuid, uuid, timestamptz, integer);
