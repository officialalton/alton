-- 전체 번호 보기(reveal)는 사유 필수(5자 이상) — 감사 행에 사유가 반드시 남는다. 시그니처는 그대로(create or replace).
create or replace function public.reveal_teacher_payout_account(p_teacher_id uuid, p_actor_id uuid, p_reason text default null)
returns table (account_holder_name text, bank_name text, account_number text, swift_or_routing text, currency text, country text)
language plpgsql security definer set search_path = public, extensions as $$
declare v teacher_payout_accounts%rowtype; v_key text := public.payout_account_key();
begin
  if not public.payout_account_staff_allowed(p_actor_id) then
    raise exception '전체 계좌번호를 볼 권한이 없습니다(정산권한 또는 마스터 관리자 필요).';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception '전체 번호를 보는 사유를 5자 이상 입력해주세요.';
  end if;
  select * into v from teacher_payout_accounts where teacher_id = p_teacher_id;
  if not found then raise exception '등록된 수취 계좌가 없습니다.'; end if;
  insert into teacher_payout_account_reveals (teacher_id, actor_id, reason) values (p_teacher_id, p_actor_id, btrim(p_reason));
  return query select v.account_holder_name, v.bank_name,
    extensions.pgp_sym_decrypt(v.account_number_enc, v_key),
    case when v.swift_or_routing_enc is null then null else extensions.pgp_sym_decrypt(v.swift_or_routing_enc, v_key) end,
    v.currency, v.country;
end;
$$;
revoke execute on function public.reveal_teacher_payout_account(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reveal_teacher_payout_account(uuid, uuid, text) to service_role;

create or replace function public.reveal_consultant_payout_account(p_consultant_id uuid, p_actor_id uuid, p_reason text default null)
returns table (account_holder_name text, bank_name text, account_number text, swift_or_routing text, currency text, country text)
language plpgsql security definer set search_path = public, extensions as $$
declare v consultant_payout_accounts%rowtype; v_key text := public.payout_account_key();
begin
  if not public.payout_account_staff_allowed(p_actor_id) then
    raise exception '전체 계좌번호를 볼 권한이 없습니다(정산권한 또는 마스터 관리자 필요).';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception '전체 번호를 보는 사유를 5자 이상 입력해주세요.';
  end if;
  select * into v from consultant_payout_accounts where consultant_id = p_consultant_id;
  if not found then raise exception '등록된 수취 계좌가 없습니다.'; end if;
  insert into consultant_payout_account_reveals (consultant_id, actor_id, reason) values (p_consultant_id, p_actor_id, btrim(p_reason));
  return query select v.account_holder_name, v.bank_name,
    extensions.pgp_sym_decrypt(v.account_number_enc, v_key),
    case when v.swift_or_routing_enc is null then null else extensions.pgp_sym_decrypt(v.swift_or_routing_enc, v_key) end,
    v.currency, v.country;
end;
$$;
revoke execute on function public.reveal_consultant_payout_account(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reveal_consultant_payout_account(uuid, uuid, text) to service_role;
