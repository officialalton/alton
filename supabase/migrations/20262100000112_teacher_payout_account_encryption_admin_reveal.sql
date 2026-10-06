-- 교사 수취 계좌 — 정책 변경(2026-10-06 오너): 종전 "관리자도 마스킹만, 조회 전용" 정책(20261284000000 주석)을 대체한다.
--  * 교사는 첫 로그인 뒤 **한 번만** 등록한다. 저장 후에는 교사가 수정할 수 없다(서버·DB에서 차단).
--  * 이후 수정은 정산권한 보유자 또는 마스터 관리자만 한다(교사를 대신해 입력). 변경마다 이력(끝 4자리만) + 교사 인앱 알림.
--  * 전체 계좌번호·SWIFT/라우팅은 목록 응답에 절대 포함하지 않고, 정산권한/마스터가 명시적으로 '전체 번호 보기'(reveal)를 누를 때만
--    DB 함수가 복호화해서 돌려주며 **호출마다 감사 행**(처리자·교사·시각·사유, 번호 자체는 남기지 않음)을 남긴다.
--  * 저장 시 암호화(pgcrypto pgp_sym_encrypt, 키는 Supabase Vault 비밀). 평문 컬럼은 비운다(끝 4자리만 남김).

create extension if not exists pgcrypto;
create extension if not exists supabase_vault;

-- 키: Vault 비밀(없으면 생성). 환경마다 별도 키다 — DB를 다른 프로젝트로 복원하면 Vault 키 이전이 필요하다.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'payout_account_encryption_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'payout_account_encryption_key', '교사 수취 계좌 암호화 키');
  end if;
end $$;

create or replace function public.payout_account_key()
returns text language plpgsql security definer set search_path = public, vault, extensions as $$
declare k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'payout_account_encryption_key';
  if k is null then raise exception '수취 계좌 암호화 키가 없습니다.'; end if;
  return k;
end;
$$;
revoke execute on function public.payout_account_key() from public, anon, authenticated, service_role;

alter table public.teacher_payout_accounts
  add column if not exists account_number_enc bytea,
  add column if not exists swift_or_routing_enc bytea,
  add column if not exists swift_or_routing_last4 text,
  add column if not exists entered_by_admin boolean not null default false;
alter table public.teacher_payout_accounts alter column account_number drop not null;

-- 기존 행 백필: 암호화 후 평문 제거(끝 4자리 유지).
update public.teacher_payout_accounts
set account_number_enc = extensions.pgp_sym_encrypt(account_number, public.payout_account_key()),
    swift_or_routing_enc = case when swift_or_routing is null or swift_or_routing = '' then null
                                else extensions.pgp_sym_encrypt(swift_or_routing, public.payout_account_key()) end,
    swift_or_routing_last4 = case when swift_or_routing is null or swift_or_routing = '' then null else right(swift_or_routing, 4) end
where account_number is not null and account_number_enc is null;
update public.teacher_payout_accounts set account_number = null, swift_or_routing = null where account_number_enc is not null;

comment on table public.teacher_payout_accounts is
  '교사 수취 계좌. 번호는 암호화 저장(account_number_enc, swift_or_routing_enc; 키=Vault). 목록/교사 화면은 끝 4자리만 본다. '
  '전체 번호는 정산권한·마스터 관리자가 reveal_teacher_payout_account()로만 볼 수 있고 호출마다 감사 행이 남는다. '
  '교사는 첫 저장 이후 수정할 수 없다(save_teacher_payout_account가 차단).';

-- 직접 select로 암호문·평문 컬럼이 새지 않게 컬럼 단위 권한을 좁힌다(앱은 service_role로 읽는다).
revoke select on public.teacher_payout_accounts from anon, authenticated;
grant select (id, teacher_id, account_holder_name, bank_name, account_number_last4, currency, country,
              swift_or_routing_last4, entered_by_admin, updated_at, updated_by, created_at)
  on public.teacher_payout_accounts to authenticated;

-- 이력: 관리자 입력 표시 추가.
alter table public.teacher_payout_account_events add column if not exists entered_by_admin boolean not null default false;

-- reveal 감사(INSERT-only) — 번호 자체는 절대 남기지 않는다.
create table if not exists public.teacher_payout_account_reveals (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id) on delete cascade,
  actor_id uuid not null references profiles (id),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists teacher_payout_account_reveals_teacher_idx on public.teacher_payout_account_reveals (teacher_id, created_at desc);
create trigger teacher_payout_account_reveals_no_update
  before update or delete on public.teacher_payout_account_reveals
  for each row execute function public.reject_teacher_payout_account_event_mutation();
alter table public.teacher_payout_account_reveals enable row level security;
create policy "정산권한·마스터 조회" on public.teacher_payout_account_reveals for select
  using (is_admin() or current_user_has_capability('정산권한'));
revoke insert, update, delete on public.teacher_payout_account_reveals from anon, authenticated;

-- 권한: 관리자 계정 중 마스터이거나 정산권한 보유자.
create or replace function public.payout_account_staff_allowed(p_actor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = p_actor and p.role = 'admin'
      and (p.admin_tier = 'master' or public.has_capability(p.id, '정산권한'))
  )
$$;
revoke execute on function public.payout_account_staff_allowed(uuid) from public, anon, authenticated;
grant execute on function public.payout_account_staff_allowed(uuid) to service_role;

-- 저장: 교사는 최초 1회만, 이후는 권한 있는 직원만. 암호화·이력·알림을 한 트랜잭션에서.
create or replace function public.save_teacher_payout_account(
  p_teacher_id uuid, p_actor_id uuid, p_by_admin boolean,
  p_holder text, p_bank text, p_number text, p_currency text, p_country text, p_swift text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing teacher_payout_accounts%rowtype;
  v_found boolean;
  v_changed text[] := '{}';
  v_old_number text;
  v_old_swift text;
  v_last4 text := right(regexp_replace(p_number, '\D', '', 'g'), 4);
  v_key text := public.payout_account_key();
  v_swift text := nullif(btrim(coalesce(p_swift, '')), '');
begin
  if p_by_admin then
    if not public.payout_account_staff_allowed(p_actor_id) then
      raise exception '수취 계좌를 입력·수정할 권한이 없습니다(정산권한 또는 마스터 관리자 필요).';
    end if;
  elsif p_actor_id is distinct from p_teacher_id then
    raise exception '본인 계좌만 등록할 수 있습니다.';
  end if;
  if v_last4 = '' then v_last4 := right(p_number, 4); end if;

  select * into v_existing from teacher_payout_accounts where teacher_id = p_teacher_id for update;
  v_found := found;
  if v_found and not p_by_admin then
    raise exception 'LOCKED: 계좌 정보는 최초 등록 이후 교사가 변경할 수 없습니다. 담당 직원에게 문의하세요.';
  end if;

  if v_found then
    v_old_number := extensions.pgp_sym_decrypt(v_existing.account_number_enc, v_key);
    if v_existing.swift_or_routing_enc is not null then v_old_swift := extensions.pgp_sym_decrypt(v_existing.swift_or_routing_enc, v_key); end if;
    if v_existing.account_holder_name is distinct from btrim(p_holder) then v_changed := v_changed || 'account_holder_name'; end if;
    if v_existing.bank_name is distinct from btrim(p_bank) then v_changed := v_changed || 'bank_name'; end if;
    if v_old_number is distinct from btrim(p_number) then v_changed := v_changed || 'account_number'; end if;
    if v_existing.currency is distinct from p_currency then v_changed := v_changed || 'currency'; end if;
    if v_existing.country is distinct from nullif(btrim(coalesce(p_country, '')), '') then v_changed := v_changed || 'country'; end if;
    if v_old_swift is distinct from v_swift then v_changed := v_changed || 'swift_or_routing'; end if;
  else
    v_changed := array['account_holder_name', 'bank_name', 'account_number', 'currency'];
  end if;

  insert into teacher_payout_accounts (teacher_id, account_holder_name, bank_name, account_number, account_number_enc, account_number_last4,
                                       currency, country, swift_or_routing, swift_or_routing_enc, swift_or_routing_last4,
                                       entered_by_admin, updated_at, updated_by)
  values (p_teacher_id, btrim(p_holder), btrim(p_bank), null, extensions.pgp_sym_encrypt(btrim(p_number), v_key), v_last4,
          p_currency, nullif(btrim(coalesce(p_country, '')), ''), null,
          case when v_swift is null then null else extensions.pgp_sym_encrypt(v_swift, v_key) end,
          case when v_swift is null then null else right(v_swift, 4) end,
          p_by_admin, now(), p_actor_id)
  on conflict (teacher_id) do update set
    account_holder_name = excluded.account_holder_name, bank_name = excluded.bank_name, account_number = null,
    account_number_enc = excluded.account_number_enc, account_number_last4 = excluded.account_number_last4,
    currency = excluded.currency, country = excluded.country, swift_or_routing = null,
    swift_or_routing_enc = excluded.swift_or_routing_enc, swift_or_routing_last4 = excluded.swift_or_routing_last4,
    entered_by_admin = excluded.entered_by_admin, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  insert into teacher_payout_account_events (teacher_id, action, actor_id, changed_fields, previous_last4, new_last4, entered_by_admin)
  values (p_teacher_id, case when v_found then 'updated' else 'created' end, p_actor_id, v_changed,
          case when v_found then v_existing.account_number_last4 end, v_last4, p_by_admin);

  if p_by_admin then
    insert into payout_teacher_notices (teacher_id, batch_id, kind, message)
    values (p_teacher_id, null, 'payout_account_updated',
            'Your payout account details were updated by ALTON staff. If this was not expected, contact us.');
  end if;

  return jsonb_build_object('created', not v_found, 'changed_fields', to_jsonb(v_changed), 'last4', v_last4);
end;
$$;
revoke execute on function public.save_teacher_payout_account(uuid, uuid, boolean, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_teacher_payout_account(uuid, uuid, boolean, text, text, text, text, text, text) to service_role;

-- 전체 번호 보기: 권한 확인 + 감사 행 + 복호화를 한 함수에서. 감사 없이는 복호화 경로가 없다.
create or replace function public.reveal_teacher_payout_account(p_teacher_id uuid, p_actor_id uuid, p_reason text default null)
returns table (account_holder_name text, bank_name text, account_number text, swift_or_routing text, currency text, country text)
language plpgsql security definer set search_path = public, extensions as $$
declare v teacher_payout_accounts%rowtype; v_key text := public.payout_account_key();
begin
  if not public.payout_account_staff_allowed(p_actor_id) then
    raise exception '전체 계좌번호를 볼 권한이 없습니다(정산권한 또는 마스터 관리자 필요).';
  end if;
  select * into v from teacher_payout_accounts where teacher_id = p_teacher_id;
  if not found then raise exception '등록된 수취 계좌가 없습니다.'; end if;
  insert into teacher_payout_account_reveals (teacher_id, actor_id, reason) values (p_teacher_id, p_actor_id, nullif(btrim(coalesce(p_reason, '')), ''));
  return query select v.account_holder_name, v.bank_name,
    extensions.pgp_sym_decrypt(v.account_number_enc, v_key),
    case when v.swift_or_routing_enc is null then null else extensions.pgp_sym_decrypt(v.swift_or_routing_enc, v_key) end,
    v.currency, v.country;
end;
$$;
revoke execute on function public.reveal_teacher_payout_account(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reveal_teacher_payout_account(uuid, uuid, text) to service_role;
