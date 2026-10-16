-- 2026-09-06 — 실제 버그 수정: matchbox512@snu.ac.kr 상담건 실측 재현(psql로
-- 직접 확인). 계정 병합(app/admin/merge-actions.ts anonymizeMergedAccount())이
-- 30일 뒤 auth.admin.deleteUser()로 원본 Auth 계정을 지우면, auth.users는
-- GoTrue가 이메일을 "deleted+<uuid>@removed.invalid"로 스크럽해두지만(소프트
-- 삭제류 동작), auth.identities는 정리하지 않고 예전 이메일 그대로 남는다.
-- find_auth_user_id_by_email()은 auth.users만 보므로 "기존 계정 없음"으로
-- 판단해 신규 보호자 계정 생성을 시도하지만, GoTrue의 admin.auth.admin.
-- createUser()는 auth.identities의 (provider, email) 유니크 제약에 걸려
-- 항상 실패한다 — 그 결과가 온보딩 화면의 "보호자 계정 생성에 실패했습니다"다.
-- 링크를 몇 번을 재발급해도 이 이메일로는 영원히 실패한다(재발급/재발송으로
-- 해결 안 됨 — 근본 원인은 DB에 남은 좀비 identities 행).
--
-- 재현: auth.identities에서 identity_data->>'email' = 'matchbox512@snu.ac.kr',
-- user_id = 9d31a021-b0e1-4fdc-b585-569bd25a7710 확인(해당 auth.users 행은
-- 이미 이메일이 스크럽된 상태) — 실제 non-prod DB 조회로 확정.
create or replace function public.cleanup_orphaned_auth_identities(p_email text)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  delete from auth.identities i
  where lower(i.identity_data ->> 'email') = lower(btrim(p_email))
    and not exists (
      select 1 from auth.users u
      where u.id = i.user_id and lower(u.email) = lower(btrim(p_email))
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.cleanup_orphaned_auth_identities(text) from public, anon, authenticated;
grant execute on function public.cleanup_orphaned_auth_identities(text) to service_role;
