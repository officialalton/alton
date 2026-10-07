-- 새 운영 프로젝트의 첫 master 관리자 지정(1회). 마이그레이션 20261446 의 master 지정 UPDATE 는 `db push` 시점에
-- 계정이 없으면 아무것도 하지 못하므로 신규 DB 에서는 master 가 존재하지 않는다.
-- 선행: official@alton.education 계정을 Auth 에 먼저 만든다(Supabase 대시보드 > Authentication > Add user(초대) 또는 Google 로그인).
--   psql "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -v admin_email="'official@alton.education'" -f scripts/prod-launch/sql/02-bootstrap-master-admin.sql
begin;
insert into public.profiles (id, role, name, admin_tier)
select id, 'admin', 'Alton Admin', 'master' from auth.users where lower(email) = lower(:admin_email)
on conflict (id) do update set role = 'admin', admin_tier = 'master';
-- 아래 결과가 정확히 1행이어야 한다. 0행이면 계정이 아직 없는 것이므로 ROLLBACK 하고 계정을 먼저 만든다.
select p.id, p.role, p.admin_tier, u.email from public.profiles p join auth.users u on u.id = p.id where p.admin_tier = 'master';
commit;
