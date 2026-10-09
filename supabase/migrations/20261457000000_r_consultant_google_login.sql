-- 2026-09-22(사용자 지적) — jiman@alton.education은 실제 Google Workspace
-- 계정(Calendar 접근이 필요해 비밀번호 로그인이 아니라 Google 로그인이어야
-- 함)이다. teacher-callback(20260905000000_r2_workspace_provisioning.sql)과
-- 동일한 원칙 — "사전 등록된 이메일만 최초 로그인 시 profiles를 자동
-- 생성한다, hd 클레임이나 이메일만으로 신뢰하지 않는다(첫 연결 이후에는
-- 그때 확인한 google_user_id까지 일치해야 함)" — 을 컨설턴트용으로
-- 가볍게 재사용한다. teacher_workspace_provisioning처럼 personal_contact_email 등
-- Workspace 발급 절차 전체를 요구하지 않는다 — 컨설턴트는 이미 발급된
-- 실제 계정을 등록만 하면 된다.

create table consultant_workspace_provisioning (
  id uuid primary key default gen_random_uuid(),
  workspace_email text not null,
  workspace_email_normalized text generated always as (lower(trim(workspace_email))) stored,
  workspace_google_user_id text,
  name text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  linked_profile_id uuid references profiles (id),
  linked_at timestamptz
);
create unique index consultant_workspace_provisioning_email_key
  on consultant_workspace_provisioning (workspace_email_normalized);
create unique index consultant_workspace_provisioning_linked_profile_key
  on consultant_workspace_provisioning (linked_profile_id)
  where linked_profile_id is not null;

comment on table consultant_workspace_provisioning is
  '관리자가 사전 등록한 컨설턴트 Google 계정 이메일. 최초 Google 로그인 시 이 표와 이메일이 '
  '일치해야만 profiles(role=consultant)를 자동 생성한다 — 이후 로그인은 그때 기록된 '
  'workspace_google_user_id까지 일치해야 한다(이메일만으로는 재사용 불가, 계정 탈취 방지).';

alter table consultant_workspace_provisioning enable row level security;
create policy "관리자 조회·쓰기" on consultant_workspace_provisioning for all
  using (is_admin()) with check (is_admin());

create or replace function public.find_consultant_provisioning_for_identity(
  p_workspace_email text
) returns table (id uuid, workspace_google_user_id text)
language sql stable security definer set search_path = public as $$
  select cwp.id, cwp.workspace_google_user_id
  from consultant_workspace_provisioning cwp
  where cwp.workspace_email_normalized = lower(trim(p_workspace_email));
$$;
revoke execute on function public.find_consultant_provisioning_for_identity(text) from public;
grant execute on function public.find_consultant_provisioning_for_identity(text) to authenticated;

create or replace function public.link_consultant_workspace_identity(
  p_auth_user_id uuid,
  p_provisioning_id uuid,
  p_google_user_id text,
  p_workspace_email text,
  p_name text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prov consultant_workspace_provisioning%rowtype;
begin
  if auth.uid() is distinct from p_auth_user_id then
    raise exception '본인 인증 세션에서만 호출할 수 있습니다.';
  end if;

  select * into v_prov from consultant_workspace_provisioning where id = p_provisioning_id for update;
  if not found then
    raise exception '프로비저닝 레코드를 찾을 수 없습니다.';
  end if;
  if v_prov.workspace_email_normalized is distinct from lower(trim(p_workspace_email)) then
    raise exception 'Google 계정 이메일이 프로비저닝 레코드와 일치하지 않습니다.';
  end if;
  if v_prov.workspace_google_user_id is not null and v_prov.workspace_google_user_id is distinct from p_google_user_id then
    raise exception '이 계정은 이미 다른 Google 신원에 연결되어 있습니다.';
  end if;

  if v_prov.linked_profile_id is not null then
    if v_prov.linked_profile_id = p_auth_user_id then
      return; -- 이미 연결된 계정의 재로그인 — 정상
    end if;
    raise exception '이미 다른 계정에 연결된 프로비저닝 레코드입니다.';
  end if;

  if exists (select 1 from profiles where id = p_auth_user_id) then
    raise exception '이미 다른 ALTON 프로필에 연결된 인증 사용자입니다.';
  end if;

  insert into profiles (id, role, name) values (p_auth_user_id, 'consultant', coalesce(v_prov.name, p_name, p_workspace_email));

  insert into supervisor_capabilities (profile_id, capability, granted_by)
  values
    (p_auth_user_id, 'manage_consultation_intake', p_auth_user_id),
    (p_auth_user_id, 'manage_admissions_students', p_auth_user_id)
  on conflict (profile_id, capability) do nothing;

  update consultant_workspace_provisioning
  set workspace_google_user_id = p_google_user_id, linked_profile_id = p_auth_user_id, linked_at = now()
  where id = p_provisioning_id;
end;
$$;
revoke execute on function public.link_consultant_workspace_identity(uuid, uuid, text, text, text) from public;
grant execute on function public.link_consultant_workspace_identity(uuid, uuid, text, text, text) to authenticated;

-- 사용자 요청 — jiman@alton.education을 사전 등록한다(실제 계정, 첫 Google
-- 로그인 시 이 레코드와 매칭되어 컨설턴트로 자동 연결된다).
insert into consultant_workspace_provisioning (workspace_email, name)
values ('jiman@alton.education', '지만')
on conflict (workspace_email_normalized) do nothing;
