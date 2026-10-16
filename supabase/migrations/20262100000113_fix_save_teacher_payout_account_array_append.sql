-- 112의 save_teacher_payout_account 정정: text[] || 문자열 리터럴이 배열 리터럴로 해석돼 실패하던 문제(array_append 사용).

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
    if v_existing.account_holder_name is distinct from btrim(p_holder) then v_changed := array_append(v_changed, 'account_holder_name'::text); end if;
    if v_existing.bank_name is distinct from btrim(p_bank) then v_changed := array_append(v_changed, 'bank_name'::text); end if;
    if v_old_number is distinct from btrim(p_number) then v_changed := array_append(v_changed, 'account_number'::text); end if;
    if v_existing.currency is distinct from p_currency then v_changed := array_append(v_changed, 'currency'::text); end if;
    if v_existing.country is distinct from nullif(btrim(coalesce(p_country, '')), '') then v_changed := array_append(v_changed, 'country'::text); end if;
    if v_old_swift is distinct from v_swift then v_changed := array_append(v_changed, 'swift_or_routing'::text); end if;
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
