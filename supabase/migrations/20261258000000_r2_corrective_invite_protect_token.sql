-- 배치 2-2 corrective — bypass_invite_protect GUC를 status_transition_tokens
-- 1회용 토큰으로 교체 (docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md
-- "배치 2 상세 실행 계획 > 배치 2-2" 참고).
--
-- 대상(실제 호출자 5개, 계획 문서 3번 항목 정정 반영): resend_account_invite(),
-- revoke_account_invite(), claim_account_invite(), resolve_manual_review_invite(),
-- mark_expired_invites() — 전부 account_invites.status를 UPDATE한다.
-- create_account_invite()(INSERT-only)와 finalize_account_invite()(status를
-- 건드리지 않음)는 이 GUC와 무관하므로 이 마이그레이션의 대상이 아니다 —
-- 손대지 않는다.
--
-- action 값은 'invite_status_transition' 단일 값을 쓴다 — 5개 호출자 전부
-- account_invites.status라는 같은 컬럼의 전이를 다루고, row_id(초대 id)로
-- 이미 유일하게 식별되므로 세분화할 실익이 없다.
--
-- 행 잠금: resend_account_invite()/revoke_account_invite()/
-- resolve_manual_review_invite()/claim_account_invite() 4개 함수는 이미
-- 원본에서부터 대상 행을 `select ... for update`로 잠근 뒤에야 status를
-- 읽고 검증한다(TOCTOU 레이스 없음, 배치 2-1 corrective가 추가한 패턴이
-- 여기서는 이미 처음부터 지켜지고 있었다) — 별도 수정 불필요, 구조 그대로
-- 유지.
--
-- mark_expired_invites()만 예외: 조건에 매칭되는 여러 행을 한 UPDATE 문으로
-- 동시에 전환하는 배치 함수라 "행당 1개 토큰" 원칙을 지키려면 별도 설계가
-- 필요하다. `returning id`로 후보 행을 먼저 `for update`로 잠가 커서로
-- 뽑고(candidates), 각 행에 대해 개별 토큰을 INSERT한 뒤(tokens), 그 확정된
-- 후보 집합에 대해서만 배치 UPDATE를 실행한다(expired) — 하나의 CTE 체인으로
-- "후보 확정 → 토큰 일괄 발급 → 배치 UPDATE"를 원자적으로 묶는다. candidates가
-- 데이터 변경 CTE(tokens/expired)에서 참조되므로 PostgreSQL이 항상 materialize해
-- 단일 스냅샷을 보장한다. 트리거는 BEFORE UPDATE FOR EACH ROW라 배치 UPDATE에도
-- 행마다 실행되므로 트리거 로직을 바꿀 필요가 없다 — 각 행은 정확히 자기 몫의
-- 토큰만 소비한다.
--
-- 배치 1/2-1 corrective와 동일한 두 규칙을 처음부터 적용한다: (a)
-- status_transition_tokens 참조는 반드시 public.status_transition_tokens로
-- 완전히 스키마 한정한다. (b) 6개 함수(트리거 포함) 전부 search_path를
-- 'public, pg_temp'로 명시 고정한다(기존 5개는 'public'뿐, 트리거 함수는
-- 아예 SECURITY DEFINER/search_path 지정이 없었다).

-- ---------------------------------------------------------------------------
-- protect_account_invite_status(): GUC 분기를 완전히 제거하고,
-- status_transition_tokens에 일치하는 미소비 토큰이 있는지만 확인한다.
-- consume_status_transition_token() 헬퍼(배치 1에서 이미 완전 스키마 한정 +
-- search_path 고정 완료)를 그대로 재사용한다. 원본은 SECURITY DEFINER도
-- search_path도 지정하지 않았으므로 이번에 처음으로 둘 다 명시한다.
-- ---------------------------------------------------------------------------
create or replace function public.protect_account_invite_status()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status
     and not public.consume_status_transition_token('account_invites', new.id, 'invite_status_transition') then
    raise exception '초대 상태는 지정된 함수(create/resend/accept/finalize/revoke)를 통해서만 변경할 수 있습니다.';
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_account_invite_status() from public, anon, authenticated, service_role;

comment on function public.protect_account_invite_status() is
  '초대 상태(status) 보호 트리거. (corrective) GUC(app.bypass_invite_protect)
  분기를 제거하고 status_transition_tokens 1회용 토큰 확인/소비로 대체했다
  (action = ''invite_status_transition'') — consume_status_transition_token()이
  public.status_transition_tokens로 완전히 스키마 한정되어 있고 search_path가
  public, pg_temp로 고정되어 있으므로 temp table 가로채기가 통하지 않는다.';

-- ---------------------------------------------------------------------------
-- resend_account_invite(): 최신(capability 게이트) 정의
-- 20260909000000_r2_task8_capability_gates.sql 기준. capability 게이트 로직은
-- 그대로 유지, GUC set_config()만 토큰 인라인 INSERT로 교체. 대상 행은 이미
-- 함수 시작부에서 `for update`로 잠근 뒤 상태를 읽으므로 별도 잠금 변경 불필요.
-- ---------------------------------------------------------------------------
create or replace function public.resend_account_invite(p_invite_id uuid)
returns table (invite_id uuid, raw_token text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row account_invites%rowtype;
  v_resend_count int;
  v_new_id uuid;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
begin
  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception '존재하지 않는 초대입니다.';
  end if;
  if not (is_admin() or current_user_has_capability('manage_invites') or v_row.invited_by = auth.uid()) then
    raise exception '본인이 보낸 초대만 재발송할 수 있습니다.';
  end if;
  if v_row.status <> 'pending' then
    raise exception '대기 중(pending) 상태의 초대만 재발송할 수 있습니다(현재: %).', v_row.status;
  end if;
  if v_row.expires_at <= now() then
    raise exception '이미 만료된 초대입니다. 새로 초대해주세요.';
  end if;

  select count(*) into v_resend_count
  from account_invite_events e
  join account_invites ai on ai.id = e.invite_id
  where e.event_type = 'resent'
    and e.created_at > now() - interval '24 hours'
    and ai.email_normalized = v_row.email_normalized
    and ai.role = v_row.role
    and ai.household_id is not distinct from v_row.household_id;
  if v_resend_count >= 3 then
    raise exception '24시간 내 재발송은 최대 3회까지 가능합니다.';
  end if;

  insert into public.status_transition_tokens (table_name, row_id, action) values ('account_invites', v_row.id, 'invite_status_transition');
  update account_invites set status = 'superseded', updated_at = now() where id = v_row.id;

  insert into account_invites (
    email_normalized, email_original, invitee_name, invitee_grade, role, household_id, invited_by,
    token_hash, token_generation, expires_at, last_sent_at
  ) values (
    v_row.email_normalized, v_row.email_original, v_row.invitee_name, v_row.invitee_grade, v_row.role, v_row.household_id, v_row.invited_by,
    v_token_hash, v_row.token_generation + 1, now() + interval '7 days', now()
  )
  returning id into v_new_id;

  update account_invites set superseded_by_id = v_new_id where id = v_row.id;

  insert into account_invite_events (invite_id, event_type, actor_id) values (v_row.id, 'superseded', auth.uid());
  insert into account_invite_events (invite_id, event_type, actor_id) values (v_new_id, 'resent', auth.uid());

  return query select v_new_id, v_raw_token;
end;
$$;
revoke execute on function public.resend_account_invite(uuid) from public;
grant execute on function public.resend_account_invite(uuid) to authenticated;

comment on function public.resend_account_invite(uuid) is
  '초대 재발송(manage_invites capability 게이트 포함, 최신 정의). (corrective)
  기존 pending 행을 superseded로 바꾸는 UPDATE 직전
  status_transition_tokens에 1회용 토큰을 인라인 INSERT한다(action =
  ''invite_status_transition'') — GUC(app.bypass_invite_protect) set_config()
  호출 제거. 대상 행은 함수 시작부에서 이미 for update로 잠근 뒤 상태를
  읽으므로 TOCTOU 레이스가 없다.';

-- ---------------------------------------------------------------------------
-- revoke_account_invite(): 최신(capability 게이트) 정의 기준.
-- ---------------------------------------------------------------------------
create or replace function public.revoke_account_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row account_invites%rowtype;
begin
  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception '존재하지 않는 초대입니다.';
  end if;
  if not (is_admin() or current_user_has_capability('manage_invites') or v_row.invited_by = auth.uid()) then
    raise exception '본인이 보낸 초대만 철회할 수 있습니다.';
  end if;
  if v_row.status not in ('pending', 'manual_review') then
    raise exception 'pending 또는 manual_review 상태의 초대만 철회할 수 있습니다(현재: %).', v_row.status;
  end if;

  insert into public.status_transition_tokens (table_name, row_id, action) values ('account_invites', v_row.id, 'invite_status_transition');
  update account_invites set status = 'revoked', revoked_at = now(), updated_at = now() where id = v_row.id;

  insert into account_invite_events (invite_id, event_type, actor_id) values (v_row.id, 'revoked', auth.uid());
end;
$$;
revoke execute on function public.revoke_account_invite(uuid) from public;
grant execute on function public.revoke_account_invite(uuid) to authenticated;

comment on function public.revoke_account_invite(uuid) is
  '초대 철회(manage_invites capability 게이트 포함, 최신 정의). (corrective)
  status UPDATE 직전 status_transition_tokens에 1회용 토큰을 인라인
  INSERT한다(action = ''invite_status_transition'') — GUC 제거. 대상 행은
  함수 시작부에서 이미 for update로 잠근 뒤 상태를 읽는다.';

-- ---------------------------------------------------------------------------
-- claim_account_invite(): 유일 버전(20260902000000) 기준, anon/authenticated
-- grant 불변. 토큰 해시 비교/만료 검사/accepted 멱등 응답 로직은 전혀
-- 손대지 않는다 — 두 UPDATE 분기(manual_review/accepted) 직전에만 토큰을
-- 인라인 INSERT한다. 대상 행은 이미 함수 시작부에서 for update로 잠근다.
-- ---------------------------------------------------------------------------
create or replace function public.claim_account_invite(p_token text)
returns table (
  invite_id uuid, status account_invite_status, role account_invite_role,
  email_normalized text, invitee_name text, household_id uuid,
  target_profile_id uuid, auth_user_id uuid
)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_row account_invites%rowtype;
  v_existing_auth_id uuid;
begin
  select * into v_row from account_invites where token_hash = v_hash for update;
  if not found then
    raise exception 'invalid_token';
  end if;

  if v_row.expires_at <= now() then
    raise exception 'expired';
  end if;

  if v_row.status = 'accepted' then
    -- 멱등: 이미 수락된 같은 토큰 재제출은 에러 없이 같은 결과를 반환한다.
    -- 새 토큰을 발급하지 않고, UPDATE도 하지 않는다 — 재시도가 이 corrective
    -- 이후에도 그대로 안전하다.
    return query select v_row.id, v_row.status, v_row.role, v_row.email_normalized,
      v_row.invitee_name, v_row.household_id, v_row.target_profile_id, v_row.auth_user_id;
    return;
  end if;

  if v_row.status <> 'pending' then
    raise exception '%', v_row.status;
  end if;

  select id into v_existing_auth_id from auth.users where lower(email) = v_row.email_normalized limit 1;

  if v_existing_auth_id is not null then
    insert into public.status_transition_tokens (table_name, row_id, action) values ('account_invites', v_row.id, 'invite_status_transition');
    update account_invites set status = 'manual_review', updated_at = now() where id = v_row.id;
    insert into account_invite_events (invite_id, event_type, detail)
    values (v_row.id, 'manual_review', jsonb_build_object('existing_auth_user_id', v_existing_auth_id));

    return query select v_row.id, 'manual_review'::account_invite_status, v_row.role, v_row.email_normalized,
      v_row.invitee_name, v_row.household_id, v_row.target_profile_id, v_existing_auth_id;
    return;
  end if;

  insert into public.status_transition_tokens (table_name, row_id, action) values ('account_invites', v_row.id, 'invite_status_transition');
  update account_invites set status = 'accepted', accepted_at = now(), updated_at = now() where id = v_row.id;
  insert into account_invite_events (invite_id, event_type) values (v_row.id, 'accepted');

  return query select v_row.id, 'accepted'::account_invite_status, v_row.role, v_row.email_normalized,
    v_row.invitee_name, v_row.household_id, v_row.target_profile_id, v_row.auth_user_id;
end;
$$;
revoke execute on function public.claim_account_invite(text) from public;
grant execute on function public.claim_account_invite(text) to anon, authenticated;

comment on function public.claim_account_invite(text) is
  '초대 수락 1단계(토큰 검증 + 잠금 + 상태 전이). anon 포함 grant — 토큰
  해시 비교/만료 검사/1회성 검사(원본 그대로, 손대지 않음)로만 인가한다.
  (corrective) manual_review/accepted 두 UPDATE 분기 직전에만
  status_transition_tokens에 1회용 토큰을 인라인 INSERT한다(action =
  ''invite_status_transition'') — GUC 제거. accepted 멱등 재시도 분기는 UPDATE
  자체가 없으므로 토큰도 발급하지 않는다(재시도 안전, 회귀 없음). 대상 행은
  함수 시작부에서 이미 for update로 잠근다.';

-- ---------------------------------------------------------------------------
-- resolve_manual_review_invite(): 최신(capability 게이트) 정의 기준.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_manual_review_invite(
  p_invite_id uuid,
  p_action text,
  p_target_profile_id uuid,
  p_auth_user_id uuid
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row account_invites%rowtype;
begin
  if not (is_admin() or current_user_has_capability('manage_invites')) then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;

  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception '존재하지 않는 초대입니다.';
  end if;
  if v_row.status <> 'manual_review' then
    raise exception 'manual_review 상태의 초대만 처리할 수 있습니다(현재: %).', v_row.status;
  end if;

  if p_action = 'revoke' then
    insert into public.status_transition_tokens (table_name, row_id, action) values ('account_invites', v_row.id, 'invite_status_transition');
    update account_invites set status = 'revoked', revoked_at = now(), updated_at = now() where id = v_row.id;
    insert into account_invite_events (invite_id, event_type, actor_id) values (v_row.id, 'revoked', auth.uid());
    return;
  elsif p_action = 'link' then
    if p_target_profile_id is null or p_auth_user_id is null then
      raise exception 'link 처리에는 target_profile_id와 auth_user_id가 모두 필요합니다.';
    end if;

    if v_row.role = 'student' then
      insert into household_members (household_id, profile_id, role, is_primary)
      values (v_row.household_id, p_target_profile_id, 'child', true)
      on conflict (household_id, profile_id) do nothing;
    end if;

    insert into public.status_transition_tokens (table_name, row_id, action) values ('account_invites', v_row.id, 'invite_status_transition');
    update account_invites
    set status = 'accepted', accepted_at = now(), target_profile_id = p_target_profile_id,
        auth_user_id = p_auth_user_id, updated_at = now()
    where id = v_row.id;

    insert into account_invite_events (invite_id, event_type, actor_id, detail)
    values (v_row.id, 'accepted', auth.uid(), jsonb_build_object('resolved_from', 'manual_review'));
  else
    raise exception '지원하지 않는 action입니다: %(link 또는 revoke만 가능)', p_action;
  end if;
end;
$$;
revoke execute on function public.resolve_manual_review_invite(uuid, text, uuid, uuid) from public;
grant execute on function public.resolve_manual_review_invite(uuid, text, uuid, uuid) to authenticated;

comment on function public.resolve_manual_review_invite(uuid, text, uuid, uuid) is
  'manual_review 상태 초대 처리(manage_invites capability 게이트 포함, 최신
  정의). (corrective) revoke/link 두 분기 각각의 status UPDATE 직전
  status_transition_tokens에 1회용 토큰을 인라인 INSERT한다(action =
  ''invite_status_transition'') — GUC 제거. 대상 행은 함수 시작부에서 이미
  for update로 잠근다.';

-- ---------------------------------------------------------------------------
-- mark_expired_invites(): 유일 버전 기준 재작성. 배치 UPDATE라 행마다 개별
-- 토큰이 필요 — candidates를 for update로 먼저 잠가 확정하고, 그 확정된
-- 후보 각각에 토큰을 발급한 뒤, 같은 후보 집합에 대해서만 배치 UPDATE를
-- 실행한다. candidates가 데이터 변경 CTE(tokens/expired)에서 참조되므로
-- PostgreSQL이 항상 materialize해 단일 스냅샷을 보장한다 — 후보 확정 이후
-- 새로 pending+만료된 행이 끼어들어도 이번 호출에는 포함되지 않는다(다음
-- 호출에서 처리됨, 데이터 유실 아님).
-- ---------------------------------------------------------------------------
create or replace function public.mark_expired_invites()
returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count int;
begin
  if not is_admin() then
    raise exception '관리자만 실행할 수 있습니다.';
  end if;

  -- (주의) 'expired' CTE는 반드시 'tokens'의 출력(row_id)에 의존해야 한다 —
  -- 'candidates'에만 의존하면 PostgreSQL이 'tokens' INSERT보다 'expired'
  -- UPDATE를 먼저(또는 병렬로) 실행할 수 있어(둘 다 candidates에만 의존하고
  -- 서로 데이터 의존성이 없으므로 실행 순서가 보장되지 않는다) 트리거가
  -- 아직 존재하지 않는 토큰을 찾다가 거부하는 문제가 실제로 발생했다 —
  -- 'where id in (select row_id from tokens)'로 명시적 의존성을 만들어 반드시
  -- 토큰 INSERT가 먼저 끝난 뒤에만 UPDATE가 실행되도록 강제한다.
  with candidates as (
    select id from account_invites
    where status = 'pending' and expires_at <= now()
    for update
  ),
  tokens as (
    insert into public.status_transition_tokens (table_name, row_id, action)
    select 'account_invites', id, 'invite_status_transition' from candidates
    returning row_id
  ),
  expired as (
    update account_invites
    set status = 'expired', updated_at = now()
    where id in (select row_id from tokens)
    returning id
  )
  insert into account_invite_events (invite_id, event_type)
  select id, 'expired' from expired;
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;
revoke execute on function public.mark_expired_invites() from public;
grant execute on function public.mark_expired_invites() to authenticated;

comment on function public.mark_expired_invites() is
  '만료 초대 정기 정리 배치(관리자 전용). (corrective) 배치 UPDATE라
  "행당 1개 토큰" 원칙을 지키기 위해 candidates(for update로 잠근 후보 id
  커서) → tokens(후보별 개별 토큰 INSERT) → expired(확정된 후보 집합에만
  배치 UPDATE) 3단 CTE 체인으로 처리한다(action = ''invite_status_transition'').
  트리거는 BEFORE UPDATE FOR EACH ROW라 배치 UPDATE에도 행마다 실행되므로
  각 행이 정확히 자기 몫의 토큰만 소비한다 — GUC(app.bypass_invite_protect)
  set_config() 호출 제거.';
