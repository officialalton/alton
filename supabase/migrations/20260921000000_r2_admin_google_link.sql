-- 관리자 전용 Google 로그인 — 버그 수정: 관리자가 Google로 인증하면
-- 랜딩 페이지로 떨어지던 문제. 원인은 관리자 전용 Google OAuth 진입점/
-- 콜백 자체가 없었던 것 — teacher-callback과는 완전히 분리된 별도 경로를
-- 새로 만든다(선생님 흐름은 건드리지 않는다).
--
-- 관리자는 teacher_workspace_provisioning 같은 사전 프로비저닝 테이블이
-- 없다(HR성 발급 절차가 없다) — 대신 "이미 이메일/비밀번호로 로그인한
-- 관리자가 로그인 상태에서 자기 자신의 Google 계정을 명시적으로 연결"하는
-- self-service 흐름으로 최초 연결을 검증한다. 이 연결 레코드가 있어야만
-- 이후 Google 로그인이 성공한다 — 이메일/hd 클레임만으로는 절대 신뢰하지
-- 않는다.

create table admin_google_identities (
  profile_id uuid primary key references profiles (id) on delete cascade,
  google_user_id text not null,
  google_email text not null,
  linked_at timestamptz not null default now(),
  linked_by uuid not null references profiles (id)
);
create unique index admin_google_identities_google_user_id_key
  on admin_google_identities (google_user_id);

alter table admin_google_identities enable row level security;
create policy "본인/관리자 조회" on admin_google_identities for select
  using (profile_id = auth.uid() or is_admin());
-- 직접 INSERT/UPDATE/DELETE 정책은 두지 않는다 — 아래 SECURITY DEFINER
-- 함수를 통해서만 쓴다(teacher_workspace_provisioning과 동일 패턴).

-- 최초 연결(및 재연결). 호출자 본인(auth.uid())이 role='admin'인 프로필일
-- 때만 자기 자신의 profile_id에 연결한다 — 타인의 계정을 연결할 방법이
-- 없다(confused-deputy 방지). google_user_id unique 인덱스가 "이미 다른
-- 관리자 계정에 연결된 Google 계정" 재사용을 DB 레벨에서 막는다.
create or replace function public.link_admin_google_identity(
  p_google_user_id text,
  p_google_email text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role profile_role;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select role into v_role from profiles where id = auth.uid();
  if v_role is distinct from 'admin' then
    raise exception '관리자만 Google 계정을 연결할 수 있습니다.';
  end if;

  if p_google_user_id is null or trim(p_google_user_id) = '' then
    raise exception 'google_user_id가 필요합니다.';
  end if;
  if p_google_email is null or trim(p_google_email) = '' then
    raise exception 'google_email이 필요합니다.';
  end if;

  begin
    insert into admin_google_identities (profile_id, google_user_id, google_email, linked_by)
    values (auth.uid(), p_google_user_id, p_google_email, auth.uid())
    on conflict (profile_id) do update
      set google_user_id = excluded.google_user_id,
          google_email = excluded.google_email,
          linked_at = now(),
          linked_by = excluded.linked_by;
  exception
    when unique_violation then
      raise exception '이 Google 계정은 이미 다른 관리자 계정에 연결되어 있습니다.';
  end;
end;
$$;
revoke execute on function public.link_admin_google_identity(text, text) from public;
grant execute on function public.link_admin_google_identity(text, text) to authenticated;

-- 로그인 콜백에서 쓰는 self-only 조회 — "지금 이 세션(auth.uid())이 방금
-- Google에서 받은 google_user_id로 관리자 연결이 이미 돼 있는가"만 확인한다.
-- 타인의 연결 여부를 조회할 방법은 없다.
create or replace function public.current_user_admin_google_identity_linked(
  p_google_user_id text
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_google_identities agi
    join profiles p on p.id = agi.profile_id
    where agi.profile_id = auth.uid()
      and agi.google_user_id = p_google_user_id
      and p.role = 'admin'
  );
$$;
revoke execute on function public.current_user_admin_google_identity_linked(text) from public;
grant execute on function public.current_user_admin_google_identity_linked(text) to authenticated;

-- TODO(admin 상태 개념): profiles/admin에는 teacher/student/parent와 달리
-- suspended/inactive 같은 상태 컬럼이 아직 없다(role='admin'이 전부).
-- 도입되면 이 함수와 콜백 라우트 양쪽에 "활성 관리자만 통과" 조건을
-- 추가해야 한다.
