-- M4 후속(2026-09-06) — consult_slot_source enum 값 추가만 별도 파일로 분리한다.
-- PostgreSQL은 ALTER TYPE ... ADD VALUE로 추가한 값을 같은 트랜잭션 안에서 바로
-- 사용(함수 본문의 타입 참조 등)하는 것을 막는다(SQLSTATE 55P04, db reset 중 실측
-- 확인) — 그래서 이 값을 실제로 사용하는 RPC(submit_guardian_portal_consult_request 등)는
-- 다음 파일(20261207010000)로 분리했다.
alter type consult_slot_source add value if not exists 'guardian_portal';
