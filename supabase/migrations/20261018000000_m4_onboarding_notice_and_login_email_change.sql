-- M4 (6/N) — 1) 체험 온보딩 안내 이메일 발송 상태 추적, 2) prospect 이메일과
-- 보호자가 실제로 쓰고 싶은 로그인 이메일을 분리 처리(변경 시 별도 소유 확인).

-- =========================================================================
-- 1. 온보딩 안내 이메일 발송 추적 — trial_onboarding_links에 컬럼만 추가.
--    실제 이메일 발송은 여전히 앱 레이어(lib/email.ts의 sendEmail, 기존 SMTP
--    경로)가 담당한다. 이 컬럼들은 "무엇을, 언제, 어떤 내용으로, 성공했는지"
--    만 기록해 중복 발송 방지·재처리 판단에 쓴다.
-- =========================================================================
alter table trial_onboarding_links add column notice_sent_at timestamptz;
alter table trial_onboarding_links add column notice_delivery_status text not null default 'pending'
  check (notice_delivery_status in ('pending', 'sent', 'failed'));
alter table trial_onboarding_links add column notice_send_error text;
alter table trial_onboarding_links add column notice_content_hash text;
comment on column trial_onboarding_links.notice_delivery_status is
  'M4: pending=아직 발송 시도 안 함(또는 이전 링크가 만료돼 재발급된 새 링크), sent=SMTP 발송 성공, failed=발송 실패(관리자 재처리 대상 — 계정이 생성된 것으로 착각하면 안 됨, 이 상태는 계정 생성과 완전히 무관).';

-- 감사 이력에 남길 이벤트 종류를 넓힌다(이메일 발송/실패, 로그인 이메일 변경
-- 요청/확인/충돌).
alter table trial_onboarding_link_events drop constraint trial_onboarding_link_events_event_type_check;
alter table trial_onboarding_link_events add constraint trial_onboarding_link_events_event_type_check
  check (event_type in (
    'created', 'redeemed', 'finalized', 'linked_existing_guardian', 'expired', 'revoked', 'conflict_manual_review',
    'notice_sent', 'notice_failed', 'login_email_change_requested', 'login_email_change_confirmed'
  ));

-- =========================================================================
-- 2. trial_login_email_change_requests — 보호자가 온보딩 중 로그인 이메일을
--    prospect 이메일과 다른 주소로 바꾸고 싶을 때만 쓰는 별도 소유 확인 절차.
--    prospect 이메일(trial_onboarding_links.guardian_email)은 상담 당시
--    연락처 스냅샷으로 그대로 두고 절대 덮어쓰지 않는다 — 실제 계정 생성에
--    쓸 이메일은 이 테이블의 확인 완료(status='confirmed') 결과로만 정해진다.
-- =========================================================================
create table trial_login_email_change_requests (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references trial_onboarding_links (id),
  requested_email text not null,
  requested_email_normalized text generated always as (lower(trim(requested_email))) stored,
  token_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'conflict', 'expired')),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on trial_login_email_change_requests (link_id);
create index on trial_login_email_change_requests (token_hash);
-- 링크당 미해결(pending) 이메일 변경 요청은 최대 1개 — 여러 번 입력해도 이전
-- pending 요청이 먼저 소진(confirmed/expired)돼야 새로 만들 수 있다.
create unique index trial_login_email_change_requests_pending_unique
  on trial_login_email_change_requests (link_id) where status = 'pending';

alter table trial_login_email_change_requests enable row level security;
create policy "관리자 조회" on trial_login_email_change_requests for select using (is_admin());
-- 쓰기는 전부 아래 함수로만.

-- =========================================================================
-- request_trial_login_email_change — 보호자가 다른 로그인 이메일을 입력했을
-- 때 호출(비로그인, 링크만 소유한 상태 — 로그인 전이라 anon 실행 가능해야
-- 함). 이미 다른 계정이 그 이메일을 쓰고 있으면 토큰을 발급하지 않고
-- conflict로 즉시 기록한다 — 이메일 문자열이 같다는 이유만으로 자동 연결·
-- 병합하지 않는다는 원칙을 여기서도 지킨다.
-- =========================================================================
create or replace function public.request_trial_login_email_change(
  p_link_id uuid,
  p_new_email text
) returns table (request_id uuid, raw_token text, conflict boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_link trial_onboarding_links%rowtype;
  v_normalized text := lower(trim(p_new_email));
  v_existing_user_id uuid;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_id uuid;
begin
  select * into v_link from trial_onboarding_links where id = p_link_id;
  if not found then
    raise exception '존재하지 않는 온보딩 링크입니다.';
  end if;
  if v_link.status <> 'pending' then
    raise exception '이미 사용됐거나 만료된 온보딩 링크입니다.';
  end if;

  select id into v_existing_user_id from auth.users where lower(email) = v_normalized limit 1;

  if v_existing_user_id is not null then
    insert into trial_login_email_change_requests (link_id, requested_email, token_hash, status, expires_at)
    values (p_link_id, p_new_email, v_token_hash, 'conflict', now() + interval '24 hours')
    returning id into v_id;

    insert into trial_onboarding_link_events (link_id, event_type, detail)
    values (p_link_id, 'conflict_manual_review', jsonb_build_object('requested_email', p_new_email, 'reason', 'login_email_already_in_use'));

    return query select v_id, null::text, true;
    return;
  end if;

  insert into trial_login_email_change_requests (link_id, requested_email, token_hash, expires_at)
  values (p_link_id, p_new_email, v_token_hash, now() + interval '24 hours')
  returning id into v_id;

  insert into trial_onboarding_link_events (link_id, event_type, detail)
  values (p_link_id, 'login_email_change_requested', jsonb_build_object('requested_email', p_new_email));

  return query select v_id, v_raw_token, false;
end;
$$;
revoke execute on function public.request_trial_login_email_change(uuid, text) from public;
grant execute on function public.request_trial_login_email_change(uuid, text) to anon, authenticated, service_role;

-- =========================================================================
-- confirm_trial_login_email_change — 새 이메일로 받은 확인 메일의 링크를
-- 클릭했을 때 호출(anon). 성공하면 이 요청이 confirmed로 바뀌고, 앱 레이어가
-- 그제서야 이 이메일로 실제 Supabase Auth 계정을 만든다(이 함수 자체는
-- 계정을 만들지 않는다 — "검증 끝나기 전에는 계정에 연결하지 않는다"는
-- 원칙대로 계정 생성은 항상 검증 다음 단계).
-- =========================================================================
create or replace function public.confirm_trial_login_email_change(p_token text)
returns table (link_id uuid, requested_email text)
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_login_email_change_requests%rowtype;
  v_token_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  select * into v_row from trial_login_email_change_requests where token_hash = v_token_hash for update;
  if not found then
    raise exception '유효하지 않은 확인 링크입니다.';
  end if;
  if v_row.status = 'confirmed' then
    return query select v_row.link_id, v_row.requested_email;
    return;
  end if;
  if v_row.status <> 'pending' then
    raise exception '이미 처리됐거나 만료된 확인 링크입니다.';
  end if;
  if v_row.expires_at <= now() then
    update trial_login_email_change_requests set status = 'expired' where id = v_row.id;
    raise exception '만료된 확인 링크입니다.';
  end if;

  update trial_login_email_change_requests set status = 'confirmed', confirmed_at = now() where id = v_row.id;

  insert into trial_onboarding_link_events (link_id, event_type, detail)
  values (v_row.link_id, 'login_email_change_confirmed', jsonb_build_object('requested_email', v_row.requested_email));

  return query select v_row.link_id, v_row.requested_email;
end;
$$;
revoke execute on function public.confirm_trial_login_email_change(text) from public;
grant execute on function public.confirm_trial_login_email_change(text) to anon, authenticated, service_role;
