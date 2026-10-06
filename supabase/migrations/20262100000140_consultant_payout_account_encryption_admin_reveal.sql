-- 컨설턴트 수취 계좌 — 교사와 같은 정책(2026-10-06 오너): 최초 1회 본인 등록 → 이후 정산권한·마스터만 수정,
-- 암호화 저장, 감사되는 '전체 번호 보기', 변경 이력(끝 4자리만) + 본인 인앱 알림.
-- 키·권한 함수는 교사용과 공유한다(payout_account_key, payout_account_staff_allowed — 20262100000112).
-- 알림은 기존 payout_teacher_notices 테이블을 재사용한다(teacher_id 컬럼은 profiles FK라 컨설턴트 id도 담을 수 있다).

alter table public.consultant_payout_accounts
  add column if not exists account_number_enc bytea,
  add column if not exists swift_or_routing_enc bytea,
  add column if not exists swift_or_routing_last4 text,
  add column if not exists entered_by_admin boolean not null default false;
alter table public.consultant_payout_accounts alter column account_number drop not null;

update public.consultant_payout_accounts
set account_number_enc = extensions.pgp_sym_encrypt(account_number, public.payout_account_key()),
    swift_or_routing_enc = case when swift_or_routing is null or swift_or_routing = '' then null
                                else extensions.pgp_sym_encrypt(swift_or_routing, public.payout_account_key()) end,
    swift_or_routing_last4 = case when swift_or_routing is null or swift_or_routing = '' then null else right(swift_or_routing, 4) end
where account_number is not null and account_number_enc is null;
update public.consultant_payout_accounts set account_number = null, swift_or_routing = null where account_number_enc is not null;

comment on table public.consultant_payout_accounts is
  '컨설턴트 수취 계좌. 번호는 암호화 저장(Vault 키). 컨설턴트는 최초 1회만 등록하고 이후 수정은 정산권한·마스터 관리자만 한다. '
  '전체 번호는 reveal_consultant_payout_account()로만 볼 수 있고 호출마다 감사 행이 남는다.';

revoke select on public.consultant_payout_accounts from anon, authenticated;
grant select (id, consultant_id, account_holder_name, bank_name, account_number_last4, currency, country,
              swift_or_routing_last4, entered_by_admin, updated_at, updated_by, created_at)
  on public.consultant_payout_accounts to authenticated;

alter table public.consultant_payout_account_events add column if not exists entered_by_admin boolean not null default false;

create table if not exists public.consultant_payout_account_reveals (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references profiles (id) on delete cascade,
  actor_id uuid not null references profiles (id),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists consultant_payout_account_reveals_idx on public.consultant_payout_account_reveals (consultant_id, created_at desc);
create trigger consultant_payout_account_reveals_no_update
  before update or delete on public.consultant_payout_account_reveals
  for each row execute function public.reject_consultant_payout_account_event_mutation();
alter table public.consultant_payout_account_reveals enable row level security;
create policy "정산권한·마스터 조회" on public.consultant_payout_account_reveals for select
  using (is_admin() or current_user_has_capability('정산권한'));
revoke insert, update, delete on public.consultant_payout_account_reveals from anon, authenticated;

create or replace function public.save_consultant_payout_account(
  p_consultant_id uuid, p_actor_id uuid, p_by_admin boolean,
  p_holder text, p_bank text, p_number text, p_currency text, p_country text, p_swift text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_existing consultant_payout_accounts%rowtype;
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
  elsif p_actor_id is distinct from p_consultant_id then
    raise exception '본인 계좌만 등록할 수 있습니다.';
  end if;
  if not exists (select 1 from profiles where id = p_consultant_id and role = 'consultant') then
    raise exception '컨설턴트 계정이 아닙니다.';
  end if;
  if v_last4 = '' then v_last4 := right(p_number, 4); end if;

  select * into v_existing from consultant_payout_accounts where consultant_id = p_consultant_id for update;
  v_found := found;
  if v_found and not p_by_admin then
    raise exception 'LOCKED: 계좌 정보는 최초 등록 이후 본인이 변경할 수 없습니다. 담당 직원에게 문의하세요.';
  end if;

  if v_found then
    v_old_number := extensions.pgp_sym_decrypt(v_existing.account_number_enc, v_key);
    if v_existing.swift_or_routing_enc is not null then v_old_swift := extensions.pgp_sym_decrypt(v_existing.swift_or_routing_enc, v_key); end if;
    if v_existing.account_holder_name is distinct from btrim(p_holder) then v_changed := array_append(v_changed, 'account_holder_name'::text); end if;
    if v_existing.bank_name is distinct from btrim(p_bank) then v_changed := array_append(v_changed, 'bank_name'::text); end if;
    if v_old_number is distinct from btrim(p_number) then v_changed := array_append(v_changed, 'account_number'::text); end if;
    if v_existing.currency is distinct from p_currency then v_changed := array_append(v_changed, 'currency'::text); end if;
    if v_existing.country is distinct from nullif(btrim(coalesce(p_country, '')), '') then v_changed := array_append(v_changed, 'country'::text); end if;
    if v_old_swift is distinct from v_swift then v_changed := array_append(v_changed, 'swift_or_routing'::text); end if;
  else
    v_changed := array['account_holder_name', 'bank_name', 'account_number', 'currency'];
  end if;

  insert into consultant_payout_accounts (consultant_id, account_holder_name, bank_name, account_number, account_number_enc, account_number_last4,
                                          currency, country, swift_or_routing, swift_or_routing_enc, swift_or_routing_last4,
                                          entered_by_admin, updated_at, updated_by)
  values (p_consultant_id, btrim(p_holder), btrim(p_bank), null, extensions.pgp_sym_encrypt(btrim(p_number), v_key), v_last4,
          p_currency, nullif(btrim(coalesce(p_country, '')), ''), null,
          case when v_swift is null then null else extensions.pgp_sym_encrypt(v_swift, v_key) end,
          case when v_swift is null then null else right(v_swift, 4) end,
          p_by_admin, now(), p_actor_id)
  on conflict (consultant_id) do update set
    account_holder_name = excluded.account_holder_name, bank_name = excluded.bank_name, account_number = null,
    account_number_enc = excluded.account_number_enc, account_number_last4 = excluded.account_number_last4,
    currency = excluded.currency, country = excluded.country, swift_or_routing = null,
    swift_or_routing_enc = excluded.swift_or_routing_enc, swift_or_routing_last4 = excluded.swift_or_routing_last4,
    entered_by_admin = excluded.entered_by_admin, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  insert into consultant_payout_account_events (consultant_id, action, actor_id, changed_fields, previous_last4, new_last4, entered_by_admin)
  values (p_consultant_id, case when v_found then 'updated' else 'created' end, p_actor_id, v_changed,
          case when v_found then v_existing.account_number_last4 end, v_last4, p_by_admin);

  if p_by_admin then
    insert into payout_teacher_notices (teacher_id, batch_id, kind, message)
    values (p_consultant_id, null, 'payout_account_updated',
            'Your payout account details were updated by ALTON staff. If this was not expected, contact us.');
  end if;

  return jsonb_build_object('created', not v_found, 'changed_fields', to_jsonb(v_changed), 'last4', v_last4);
end;
$$;
revoke execute on function public.save_consultant_payout_account(uuid, uuid, boolean, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_consultant_payout_account(uuid, uuid, boolean, text, text, text, text, text, text) to service_role;

create or replace function public.reveal_consultant_payout_account(p_consultant_id uuid, p_actor_id uuid, p_reason text default null)
returns table (account_holder_name text, bank_name text, account_number text, swift_or_routing text, currency text, country text)
language plpgsql security definer set search_path = public, extensions as $$
declare v consultant_payout_accounts%rowtype; v_key text := public.payout_account_key();
begin
  if not public.payout_account_staff_allowed(p_actor_id) then
    raise exception '전체 계좌번호를 볼 권한이 없습니다(정산권한 또는 마스터 관리자 필요).';
  end if;
  select * into v from consultant_payout_accounts where consultant_id = p_consultant_id;
  if not found then raise exception '등록된 수취 계좌가 없습니다.'; end if;
  insert into consultant_payout_account_reveals (consultant_id, actor_id, reason) values (p_consultant_id, p_actor_id, nullif(btrim(coalesce(p_reason, '')), ''));
  return query select v.account_holder_name, v.bank_name,
    extensions.pgp_sym_decrypt(v.account_number_enc, v_key),
    case when v.swift_or_routing_enc is null then null else extensions.pgp_sym_decrypt(v.swift_or_routing_enc, v_key) end,
    v.currency, v.country;
end;
$$;
revoke execute on function public.reveal_consultant_payout_account(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reveal_consultant_payout_account(uuid, uuid, text) to service_role;
