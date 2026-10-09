-- 2026-10-06 오너 결정: 계약서(DocuSign) 자동 발송은 기본 ON, 관리자가 켜고 끌 수 있다.
-- 환경변수 CONTRACT_AUTO_DISPATCH_ENABLED="false"는 비상 강제 정지로만 남는다(앱 코드에서 처리).
create table if not exists public.contract_dispatch_settings (
  id boolean primary key default true,
  auto_dispatch_enabled boolean not null default true,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  constraint contract_dispatch_settings_singleton check (id = true)
);
insert into public.contract_dispatch_settings (id, auto_dispatch_enabled) values (true, true)
  on conflict (id) do nothing;

alter table public.contract_dispatch_settings enable row level security;
drop policy if exists "관리자 조회" on public.contract_dispatch_settings;
create policy "관리자 조회" on public.contract_dispatch_settings for select using (is_admin());
-- 쓰기 정책 없음 — 변경은 감사 기록을 남기는 set_contract_auto_dispatch_enabled()로만.

create table if not exists public.contract_dispatch_settings_audit (
  id bigint generated always as identity primary key,
  changed_by uuid references public.profiles (id),
  old_enabled boolean not null,
  new_enabled boolean not null,
  changed_at timestamptz not null default now()
);
alter table public.contract_dispatch_settings_audit enable row level security;
drop policy if exists "관리자 조회" on public.contract_dispatch_settings_audit;
create policy "관리자 조회" on public.contract_dispatch_settings_audit for select using (is_admin());

create or replace function public.set_contract_auto_dispatch_enabled(p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old boolean;
begin
  if not is_admin() then
    raise exception '관리자만 계약서 자동 발송 설정을 바꿀 수 있습니다.';
  end if;
  select auto_dispatch_enabled into v_old from contract_dispatch_settings where id = true for update;
  if v_old is distinct from p_enabled then
    update contract_dispatch_settings
      set auto_dispatch_enabled = p_enabled, updated_by = auth.uid(), updated_at = now()
      where id = true;
    insert into contract_dispatch_settings_audit (changed_by, old_enabled, new_enabled)
      values (auth.uid(), v_old, p_enabled);
  end if;
end;
$$;
revoke all on function public.set_contract_auto_dispatch_enabled(boolean) from public, anon;
grant execute on function public.set_contract_auto_dispatch_enabled(boolean) to authenticated, service_role;
