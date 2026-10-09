-- 새 운영 프로젝트 `db push` 직후 1회 실행. 신규 DB 에서 마이그레이션 기본값이 "열림"인 스위치를 닫는다.
-- 근거: 20262100000040(계약 자동 발송 기본 ON), 20261288000000(정산 자동 송금 enabled=true 시드).
-- 여는 시점은 오너 승인 후 관리자 화면 또는 별도 SQL. 이 스크립트는 멱등이다.
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/prod-launch/sql/01-post-migration-hardening.sql
begin;
update public.contract_dispatch_settings set auto_dispatch_enabled = false where auto_dispatch_enabled;
update public.payout_auto_dispatch_settings set enabled = false where enabled;
-- 아래 둘은 이미 닫힘이 기본이지만 명시적으로 확인·고정한다.
update public.payout_disbursement_gate set real_disbursement_enabled = false where real_disbursement_enabled;
update public.consultant_assignment_settings set auto_assign_enabled = false where auto_assign_enabled;
commit;
\i scripts/prod-launch/sql/03-verify-closed.sql
