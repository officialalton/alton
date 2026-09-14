-- 2026-09-10(P1 성능 배치) — 관리자 "사용자" 탭(학부모/학생/선생님)이 이메일을
-- 읽으려고 auth.admin.listUsers()를 페이지 단위로 전부 순회하던 문제(정확성
-- 수정 이후 Preview처럼 Auth 사용자 수가 누적된 환경에서 왕복이 계속 늘어남)를
-- 고친다. auth.users.email을 id 목록으로 직접 조회하는 SECURITY DEFINER
-- 함수를 추가해, 대상이 몇 명이든 왕복 1회로 끝나게 한다 — 이 프로젝트는
-- 이미 다른 곳(로그인 이메일 변경 중복 확인)에서 auth.users를 SECURITY
-- DEFINER 함수로 직접 조회하는 선례가 있다.
--
-- 정확성은 그대로 유지한다: 페이지 제한 없이 전달된 id 전체에 대해
-- auth.users의 실제 email 컬럼을 조회한다. 권한은 service_role에만 부여하고
-- PUBLIC/anon/authenticated의 기본 실행 권한은 명시적으로 제거한다.

create or replace function get_emails_by_user_ids(p_user_ids uuid[])
returns table(user_id uuid, email text)
language sql
security definer
set search_path = public
stable
as $$
  select u.id as user_id, u.email
  from auth.users u
  where u.id = any(p_user_ids);
$$;

revoke all on function get_emails_by_user_ids(uuid[]) from public;
revoke all on function get_emails_by_user_ids(uuid[]) from anon;
revoke all on function get_emails_by_user_ids(uuid[]) from authenticated;
grant execute on function get_emails_by_user_ids(uuid[]) to service_role;
