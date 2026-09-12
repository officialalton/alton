-- 온보딩(체험) 확인 링크 재사용 시 혼란스러운 오류 수정 — 2026-09-11.
-- 실측 재현(공유 non-prod, matchbox512+alton-uat-p8@gmail.com): 온보딩
-- 확인 링크를 열어 보호자·학생 Auth 계정 생성 + finalize까지 실제로는
-- 전부 성공했는데(trial_onboarding_links.status='redeemed'), 같은 링크를
-- 다시 열자(이메일 클라이언트의 링크 프리스캔, 또는 사용자의 재클릭)
-- redeem_trial_onboarding_link()가 "이미 사용된 온보딩 링크입니다" 예외를
-- 던지고, 이를 호출부가 "유효하지 않거나 만료된 온보딩 링크입니다"로
-- 뭉뚱그려 /login으로 보내버렸다 — 계정은 이미 정상 생성됐는데 사용자는
-- 원인을 알 수 없는 실패만 본다.
--
-- 근본 원인은 단순 메시지 문제가 아니다: admin.auth.admin.createUser()는
-- SQL 트랜잭션 밖(GoTrue API 호출)에서 일어나므로, redeem_trial_onboarding_link()
-- 호출과 finalize_trial_onboarding_students()가 status='redeemed'로 커밋하는
-- 시점 사이(보호자+학생 Auth 계정 생성 + 이메일 발송, 수 초 소요) 같은 링크를
-- 두 번째로 여는 요청이 끼어들 수 있다 — 그 요청이 이 창 앞부분에서 실행되면
-- 중복 계정 생성 시도, 뒷부분에서 실행되면 "이미 사용됨" 예외를 만난다.
--
-- 짧은 리스(lease)로 "지금 이 링크를 finalize 중"임을 표시해 동시 호출을
-- 직렬화하고, 부분 실패로 만든 보호자 Auth 계정 id를 기록해 재시도가 중복
-- 생성하지 않도록 한다. 이미 redeemed로 끝난 링크를 다시 열면(정확히 이번에
-- 재현한 그 케이스) "유효하지 않음"이 아니라 이미 만들어진 계정으로
-- 안내한다(호출부 lib/trial-onboarding-finalize.ts에서 이메일 일치를 재확인).

alter table trial_onboarding_links add column finalize_claimed_at timestamptz;
alter table trial_onboarding_links add column pending_guardian_auth_user_id uuid;
comment on column trial_onboarding_links.finalize_claimed_at is
  '계정 생성(앱 레이어의 createGuardianAndStudentThenRedirect) 진행 중임을 나타내는 짧은 리스 타임스탬프. claim_trial_onboarding_link_finalize()가 설정/검사하며, 일정 시간(기본 120초) 지나면 만료된 것으로 간주해 재시도를 허용한다.';
comment on column trial_onboarding_links.pending_guardian_auth_user_id is
  '보호자 Supabase Auth 계정은 만들었지만(finalize_trial_onboarding_students 호출 전) 학생 계정 생성이나 finalize가 실패해 아직 redeemed로 전이하지 못한 경우의 계정 id. 재시도 시 이 id를 재사용해 중복 계정 생성을 막는다.';

-- =========================================================================
-- claim_trial_onboarding_link_finalize — 온보딩 링크(신규 보호자 경로: prospect
-- 이메일 그대로 유지든, 로그인 이메일 변경 확인 후든, 기존 보호자 재상담이든
-- 전부 공통)에 대해 실제 계정 생성/연결을 시작해도 되는지 원자적으로
-- 판정한다. 행 잠금(for update)으로 동시 호출을 직렬화하고, 이미 redeemed면
-- 그 결과를 그대로 돌려주며(단, 반환된 redeemed_auth_user_id가 실제로 이
-- 요청의 대상 이메일 계정인지는 호출한 앱 레이어가 auth.admin.getUserById로
-- 재확인해야 한다 — 이 함수는 "링크가 redeemed 상태"라는 사실만 보증하고
-- 이메일 일치까지 보증하지 않는다), 다른 요청이 리스를 쥐고 진행 중이면
-- 'busy'를 돌려줘 앱 레이어가 계정을 새로 만들지 않도록 막는다. revoked/
-- expired 링크는 절대 진행시키지 않고 즉시 예외로 막는다.
-- =========================================================================
create or replace function public.claim_trial_onboarding_link_finalize(
  p_link_id uuid,
  p_lease_seconds int default 120
) returns table (action text, redeemed_auth_user_id uuid, pending_guardian_auth_user_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_onboarding_links%rowtype;
begin
  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception 'invalid_link';
  end if;

  if v_row.status = 'redeemed' then
    return query select 'already_redeemed', v_row.redeemed_auth_user_id, v_row.pending_guardian_auth_user_id;
    return;
  end if;
  if v_row.status = 'revoked' then
    raise exception 'revoked_link';
  end if;
  if v_row.status = 'expired' then
    raise exception 'expired_link';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'invalid_link_status:%', v_row.status;
  end if;

  if v_row.finalize_claimed_at is not null
     and v_row.finalize_claimed_at > now() - (p_lease_seconds || ' seconds')::interval then
    return query select 'busy', null::uuid, v_row.pending_guardian_auth_user_id;
    return;
  end if;

  update trial_onboarding_links set finalize_claimed_at = now() where id = p_link_id;

  return query select 'proceed', null::uuid, v_row.pending_guardian_auth_user_id;
end;
$$;
revoke execute on function public.claim_trial_onboarding_link_finalize(uuid, int) from public;
grant execute on function public.claim_trial_onboarding_link_finalize(uuid, int) to anon, authenticated, service_role;

-- =========================================================================
-- record_pending_guardian_account — 보호자 Auth 계정을 실제로 만든 직후(아직
-- finalize 전) 그 id를 링크에 기록해 둔다. 이후 같은 링크에 대한 재시도(예:
-- 학생 계정 생성 실패 후 재시도)가 보호자 계정을 중복 생성하지 않고 이 id를
-- 재사용하도록 한다. status가 이미 pending이 아니면(레이스로 다른 호출이
-- 먼저 redeemed까지 끝냈으면) 아무것도 하지 않는다.
-- =========================================================================
create or replace function public.record_pending_guardian_account(
  p_link_id uuid,
  p_auth_user_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update trial_onboarding_links
  set pending_guardian_auth_user_id = coalesce(pending_guardian_auth_user_id, p_auth_user_id)
  where id = p_link_id and status = 'pending';
end;
$$;
revoke execute on function public.record_pending_guardian_account(uuid, uuid) from public;
grant execute on function public.record_pending_guardian_account(uuid, uuid) to anon, authenticated, service_role;

-- =========================================================================
-- release_trial_onboarding_link_finalize_claim — 계정 생성 시도가 실패로
-- 끝났을 때 리스를 즉시 풀어줘, 사용자가 리스 만료(최대 120초)를 기다리지
-- 않고 바로 다시 시도할 수 있게 한다.
-- =========================================================================
create or replace function public.release_trial_onboarding_link_finalize_claim(
  p_link_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update trial_onboarding_links set finalize_claimed_at = null
  where id = p_link_id and status = 'pending';
end;
$$;
revoke execute on function public.release_trial_onboarding_link_finalize_claim(uuid) from public;
grant execute on function public.release_trial_onboarding_link_finalize_claim(uuid) to anon, authenticated, service_role;
