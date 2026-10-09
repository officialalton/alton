-- 새 운영 프로젝트: `db push` 전에 실행(읽기 전용). 마이그레이션 112(수취 계좌 암호화)가 요구하는 Vault 선행 조건 점검.
--   psql "$PROD_DB_URL" -X -f scripts/prod-launch/sql/00-preflight-vault.sql
select extname, extversion from pg_extension where extname in ('supabase_vault', 'pgcrypto', 'btree_gist', 'pg_stat_statements') order by 1;
select to_regproc('vault.create_secret') is not null as vault_create_secret_ok,
       to_regclass('vault.decrypted_secrets') is not null as vault_decrypted_secrets_ok;
-- 112 가 직접 키를 만든다(없을 때만, 32바이트 난수). 아래는 db push 이후 확인용.
select name, created_at from vault.secrets where name = 'payout_account_encryption_key';
