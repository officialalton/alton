-- 정리 대상 집계에서 보존 계정을 식별하기 위한 이메일 조회.
--
-- 2026-09-13에 드러난 것: /api/admin/cleanup-preview 가 보존 2계정을 못 찾은 이유는
-- 계정이 없어서가 아니라 **auth 사용자 목록을 한 명도 읽지 못해서**였다
-- (authUsersScanned: 0, staffAccounts 의 email 이 전부 null). 집계 경로는
-- auth.admin.listUsers() 의 오류를 `if (error) break;` 로 삼키고 그 결과를
-- "found:false" 로 보고하고 있었다 — 조회 실패와 계정 없음을 구분하지 못한 것이다.
--
-- 이메일은 profiles 에 없고 auth.users 에만 있다. PostgREST 로는 auth 스키마를
-- 읽을 수 없으므로, 필요한 것만 돌려주는 함수를 둔다. Admin REST API 의 동작에
-- 기대지 않고 DB 에서 직접 답을 얻는다.
--
-- 노출 범위를 좁게 잡는다:
--   - 돌려주는 것은 (user_id, email) 뿐이다. 비밀번호 해시·토큰·메타데이터는 없다.
--   - service_role 에게만 실행 권한을 준다. anon·authenticated 는 부른다 해도 거부된다.
--   - 이 함수를 쓰는 앱 경로는 requireAdmin() 뒤에 있다(2중 게이트).

create or replace function public.lookup_auth_user_ids_by_email(p_emails text[])
returns table (user_id uuid, email text)
language sql
security definer
set search_path = auth, public
as $$
  select u.id, u.email::text
  from auth.users u
  where lower(trim(u.email::text)) = any (
    select lower(trim(e)) from unnest(p_emails) as e
  );
$$;

comment on function public.lookup_auth_user_ids_by_email(text[]) is
  '보존 계정 식별용. 주어진 이메일에 해당하는 auth 사용자 id 만 돌려준다. '
  '대소문자·앞뒤 공백을 무시하고 맞춘다 — 이메일을 눈으로 옮겨 적는 과정에서 '
  '생기는 차이 때문에 "계정 없음"으로 단정하면 안 된다.';

revoke execute on function public.lookup_auth_user_ids_by_email(text[]) from public, anon, authenticated;
grant execute on function public.lookup_auth_user_ids_by_email(text[]) to service_role;

-- 집계 화면에서 "이 계정이 누구인가"를 보려면 관리자·교사 계정의 이메일이 필요하다.
-- 보존 계정을 못 찾았을 때 무엇이 있는지 보여줘야 다음 단계가 추측이 되지 않는다.
create or replace function public.lookup_auth_emails_for_users(p_user_ids uuid[])
returns table (user_id uuid, email text)
language sql
security definer
set search_path = auth, public
as $$
  select u.id, u.email::text
  from auth.users u
  where u.id = any (p_user_ids);
$$;

comment on function public.lookup_auth_emails_for_users(uuid[]) is
  '주어진 사용자 id 의 이메일만 돌려준다. 정리 대상 집계에서 관리자·교사 계정을 '
  '눈으로 식별하기 위한 것이다 — 학생·보호자 이메일을 훑는 용도가 아니다.';

revoke execute on function public.lookup_auth_emails_for_users(uuid[]) from public, anon, authenticated;
grant execute on function public.lookup_auth_emails_for_users(uuid[]) to service_role;
