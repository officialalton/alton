-- =========================================================================
-- 2026-10-05 무료 학습 회원 S4 — 학생 시작 전환 데이터층
-- docs/briefs/2026-10-05-free-member-tutoring-design.md §3.3·§3.4·§4.1·§5.1(…0003→번호 이동 …0004)·§7·§8
--
-- 추가만 한다(기존 행·동작 변화 0):
--   1) student_consult_interests — 학생 관심 등록(상담 예약 아님). 학생당 열린 행 1개(partial unique)
--   2) guardian_link_invites(+_events) — 보호자 연결 초대(토큰 해시, 7일, 세대, 재발송 쿨다운 10분/일 3회,
--      학생당 열린 초대 3개). (student, email) pending 1개(partial unique). RLS: 학생 본인/관리자 select만
--   3) learning_summary_grants — 보호자 수락 시 동의(§3.5 (a)). 테이블은 accept RPC가 쓰므로 여기서 만들고,
--      열람 감사·요약 RPC는 …0005
--   4) _auto_assign_consultation(uuid) — submit_homepage_consult_request의 자동배정 블록을 공용 함수로 추출
--      (랜딩 RPC는 동작 동일하게 create or replace — app/consult 통합 테스트가 회귀 고정)
--   5) RPC: register_consult_interest / create_guardian_link_invite / resend_guardian_link_invite /
--      revoke_guardian_link_invite / claim_guardian_link_invite / accept_guardian_link_invite /
--      reissue_consult_scheduling_link_for_parent / family_free_member_consult_status /
--      provision_guardian_from_link_invite(service_role)
--   6) has_tutoring_access — 오너 결정(2026-10-05): account_invites로 수락·생성된 학생(온보딩 진행 중)은
--      체험/수강 전까지 과외 키를 유지한다(분기 추가)
--
-- 하지 않는 것(§3.4-9, 통합 테스트로 고정): consultant_assignments·체험권·계약·크레딧·subject_enrollments·
-- teacher_assignments·칸반 카드 생성, member_type 변경, consultations.outcome 설정.
-- =========================================================================

-- 1) 관심 등록 --------------------------------------------------------------
create table if not exists student_consult_interests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  status text not null default 'registered'
    check (status in ('registered', 'invite_sent', 'parent_linked', 'consultation_requested', 'booked', 'cancelled', 'expired')),
  entry_point text,
  guardian_id uuid references profiles (id),
  consultation_id uuid references consultations (id),
  linked_notice_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_consult_interests_student_idx on student_consult_interests (student_id, created_at desc);
-- 학생당 "열린" 관심 1개(booked도 열린 것으로 본다 — 이미 상담이 잡힌 학생이 다시 등록하지 않게).
create unique index if not exists student_consult_interests_one_open
  on student_consult_interests (student_id) where status not in ('cancelled', 'expired');
alter table student_consult_interests enable row level security;
drop policy if exists "관심 등록은 본인/관리자 조회" on student_consult_interests;
create policy "관심 등록은 본인/관리자 조회" on student_consult_interests for select
  using (student_id = auth.uid() or is_admin());
comment on table student_consult_interests is
  '2026-10-05 무료 회원 "선생님과 이야기하기" 관심 등록. 상담 예약이 아니다. 쓰기는 RPC만(INSERT/UPDATE 정책 없음).';

-- 2) 보호자 연결 초대 --------------------------------------------------------
create table if not exists guardian_link_invites (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  interest_id uuid references student_consult_interests (id),
  email_normalized text not null,
  email_original text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked', 'superseded', 'manual_review')),
  manual_review_reason text,
  token_hash text not null unique,
  token_generation int not null default 1,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references profiles (id),
  revoked_at timestamptz,
  superseded_by_id uuid references guardian_link_invites (id),
  consultation_id uuid references consultations (id),
  scheduling_link_id uuid references consultation_scheduling_links (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guardian_link_invites_student_idx on guardian_link_invites (student_id, created_at desc);
create index if not exists guardian_link_invites_email_idx on guardian_link_invites (email_normalized);
create unique index if not exists guardian_link_invites_pending_unique
  on guardian_link_invites (student_id, email_normalized) where status = 'pending';

create table if not exists guardian_link_invite_events (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references guardian_link_invites (id) on delete cascade,
  event_type text not null
    check (event_type in ('sent', 'resent', 'accepted', 'revoked', 'expired', 'superseded', 'manual_review', 'reminder_sent', 'claimed_mismatch')),
  actor_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists guardian_link_invite_events_invite_idx on guardian_link_invite_events (invite_id, created_at desc);

alter table guardian_link_invites enable row level security;
alter table guardian_link_invite_events enable row level security;
drop policy if exists "초대는 학생 본인/관리자 조회" on guardian_link_invites;
create policy "초대는 학생 본인/관리자 조회" on guardian_link_invites for select
  using (student_id = auth.uid() or is_admin());
drop policy if exists "초대 이벤트는 학생 본인/관리자 조회" on guardian_link_invite_events;
create policy "초대 이벤트는 학생 본인/관리자 조회" on guardian_link_invite_events for select
  using (is_admin() or exists (select 1 from guardian_link_invites i where i.id = guardian_link_invite_events.invite_id and i.student_id = auth.uid()));
comment on table guardian_link_invites is
  '2026-10-05 무료 회원 → 보호자 연결 초대. 토큰은 해시만 저장, 보호자는 claim/accept RPC로만 접근(수락 전 학생 상세 비공개). 쓰기는 RPC만.';

-- 3) 학습 요약 동의 ------------------------------------------------------------
create table if not exists learning_summary_grants (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  guardian_id uuid not null references profiles (id),
  household_id uuid references households (id),
  scope text not null default 'summary_v1',
  consent_version text not null default 'summary_v1',
  source_invite_id uuid references guardian_link_invites (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references profiles (id)
);
create unique index if not exists learning_summary_grants_one_active on learning_summary_grants (student_id) where revoked_at is null;
alter table learning_summary_grants enable row level security;
drop policy if exists "학습 요약 동의는 학생·보호자·관리자 조회" on learning_summary_grants;
create policy "학습 요약 동의는 학생·보호자·관리자 조회" on learning_summary_grants for select
  using (student_id = auth.uid() or guardian_id = auth.uid() or is_admin());
comment on table learning_summary_grants is
  '2026-10-05 §3.5 (a) — 보호자가 연결 수락 시 동의한 학습 요약(summary_v1) 공유. 컨설턴트는 free_member_learning_summary RPC로만 열람(…0005).';

-- 4) 자동배정 공용 함수 + 랜딩 RPC 재정의(동작 동일) ---------------------------------
create or replace function public._auto_assign_consultation(p_consultation_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_auto_assign_enabled boolean;
  v_candidate_id uuid;
begin
  select auto_assign_enabled into v_auto_assign_enabled from consultant_assignment_settings where id = true;
  if not coalesce(v_auto_assign_enabled, false) then
    return null;
  end if;

  select p.id into v_candidate_id
  from profiles p
  where p.role = 'consultant'
    and has_capability(p.id, 'manage_consultation_intake')
    and get_account_status(p.id) = 'active'
    and coalesce((select cs.accepting_new_work from consultant_settings cs where cs.consultant_id = p.id), true)
  order by random()
  limit 1;

  if v_candidate_id is null then
    -- 대상이 없으면 조용히 미배정으로 남는다 — 관리자 큐에서 그대로 보인다.
    return null;
  end if;

  update consultations
  set intake_owner_id = v_candidate_id, admissions_consultant_id = v_candidate_id, assigned_at = now()
  where id = p_consultation_id;

  insert into consultation_assignment_history (consultation_id, field, prior_owner_id, new_owner_id, actor_id, reason)
  values
    (p_consultation_id, 'intake_owner', null, v_candidate_id, null, '자동배정'),
    (p_consultation_id, 'admissions_consultant', null, v_candidate_id, null, '자동배정');

  return v_candidate_id;
end;
$$;
revoke execute on function public._auto_assign_consultation(uuid) from public, anon, authenticated;
comment on function public._auto_assign_consultation(uuid) is
  '2026-10-05 S4 — submit_homepage_consult_request(20261910000000)의 자동배정 블록을 그대로 추출. 설정 꺼짐/후보 없음이면 null(미배정).';

create or replace function public.submit_homepage_consult_request(p_full_name text, p_email text, p_phone text, p_starts_at timestamp with time zone, p_student_grade text, p_concerns text, p_idempotency_key text)
 returns consultations
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_prospect prospect_contacts;
  v_consultation consultations;
  v_existing consultations;
begin
  if p_starts_at is not null then
    raise exception '상담 시간은 신청 시 정할 수 없습니다. 담당 컨설턴트가 배정된 뒤 안내되는 링크에서 선택해 주세요.' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from consultations where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  if exists (
    select 1 from consultations c
    where c.status = 'requested'
      and lower(trim(c.contact_email)) = lower(trim(p_email))
  ) then
    raise exception '이미 처리 대기 중인 상담 신청이 있습니다. 관리자가 확인할 때까지 기다려 주세요.';
  end if;

  insert into prospect_contacts (full_name, primary_email, primary_phone)
  values (p_full_name, p_email, p_phone)
  returning * into v_prospect;

  insert into consultations (
    prospect_contact_id, source, contact_name, contact_email, contact_phone,
    student_grade, category, concerns, status, requested_at, idempotency_key
  ) values (
    v_prospect.id, 'homepage', p_full_name, p_email, p_phone,
    p_student_grade, 'family', p_concerns, 'requested', now(), p_idempotency_key
  )
  returning * into v_consultation;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_consultation.id, null, 'requested', '홈페이지 상담 신청');

  if _auto_assign_consultation(v_consultation.id) is not null then
    select * into v_consultation from consultations where id = v_consultation.id;
  end if;

  return v_consultation;
end;
$function$;

-- 6) has_tutoring_access — 초대(account_invites)로 생성된 학생은 온보딩 진행 중으로 본다 -------------
create or replace function public.has_tutoring_access(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s
    where s.id = p_student_id
      and s.member_type = 'tutoring'
      and (
        s.status = 'pending'
        or exists (select 1 from subject_enrollments se where se.child_id = s.id and se.status in ('planned', 'active', 'paused'))
        or exists (select 1 from entitlement_grants g where g.child_id = s.id and g.expires_at > now())
        or exists (select 1 from household_members hm where hm.profile_id = s.id and hm.role = 'child')
        or exists (select 1 from enrollments e where e.student_id = s.id and e.status = 'active')
        or exists (select 1 from trial_onboarding_link_students t where t.child_auth_user_id = s.id and t.status = 'created')
        -- 2026-10-05 오너 결정: 계정 초대(account_invites)로 수락·생성된 학생은 체험/수강 전까지 과외 키 유지.
        or exists (select 1 from account_invites ai where ai.target_profile_id = s.id and ai.role = 'student' and ai.status = 'accepted')
      )
  );
$$;

-- 내부 헬퍼 --------------------------------------------------------------------
create or replace function public._require_free_student()
returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'login_required';
  end if;
  if not exists (select 1 from students s where s.id = v_uid and s.member_type = 'free' and s.status = 'active') then
    raise exception 'free_member_only';
  end if;
  return v_uid;
end;
$$;
revoke execute on function public._require_free_student() from public, anon, authenticated;

-- 5a) register_consult_interest ----------------------------------------------------
create or replace function public.register_consult_interest(p_entry_point text default null)
returns student_consult_interests
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := _require_free_student();
  v_row student_consult_interests;
begin
  perform 1 from students where id = v_uid for update;
  select * into v_row from student_consult_interests
  where student_id = v_uid and status not in ('cancelled', 'expired')
  order by created_at desc limit 1;
  if found then
    return v_row;
  end if;
  insert into student_consult_interests (student_id, status, entry_point)
  values (v_uid, 'registered', nullif(left(coalesce(p_entry_point, ''), 40), ''))
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.register_consult_interest(text) from public, anon;
grant execute on function public.register_consult_interest(text) to authenticated;

-- 5b) cancel_consult_interest(학생이 관심 자체를 접음 — pending 초대도 전부 revoked) ------------
create or replace function public.cancel_consult_interest()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := _require_free_student();
  v_row student_consult_interests;
begin
  select * into v_row from student_consult_interests
  where student_id = v_uid and status in ('registered', 'invite_sent')
  order by created_at desc limit 1 for update;
  if not found then
    raise exception 'no_open_interest';
  end if;
  update guardian_link_invites set status = 'revoked', revoked_at = now(), updated_at = now()
  where student_id = v_uid and status in ('pending', 'manual_review');
  insert into guardian_link_invite_events (invite_id, event_type, actor_id)
  select id, 'revoked', v_uid from guardian_link_invites where student_id = v_uid and status = 'revoked' and revoked_at = now();
  update student_consult_interests set status = 'cancelled', updated_at = now() where id = v_row.id;
end;
$$;
revoke execute on function public.cancel_consult_interest() from public, anon;
grant execute on function public.cancel_consult_interest() to authenticated;

-- 5c) create_guardian_link_invite --------------------------------------------------
-- outcome: 'invite_sent'(raw_token 반환) | 'already_linked'(초대 없음; should_notify=true면 연결된 보호자에게 1회 안내 메일)
create or replace function public.create_guardian_link_invite(p_email text)
returns table (outcome text, invite_id uuid, raw_token text, guardian_email text, guardian_name text, should_notify boolean, student_name text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := _require_free_student();
  v_email_normalized text := lower(trim(coalesce(p_email, '')));
  v_student_email text;
  v_student_name text;
  v_interest student_consult_interests;
  v_household_id uuid;
  v_guardian_id uuid;
  v_guardian_email text;
  v_guardian_name text;
  v_should_notify boolean := false;
  v_existing guardian_link_invites;
  v_open_count int;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_id uuid;
begin
  if v_email_normalized !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  select lower(u.email), p.name into v_student_email, v_student_name
  from auth.users u join profiles p on p.id = u.id where u.id = v_uid;
  if v_student_email = v_email_normalized then
    raise exception 'own_email';  -- 오너 결정 7-15
  end if;

  perform 1 from students where id = v_uid for update;

  -- 관심 등록이 없으면 자동 등록(초대 자체가 관심 표현).
  select * into v_interest from student_consult_interests
  where student_id = v_uid and status not in ('cancelled', 'expired') order by created_at desc limit 1 for update;
  if not found then
    insert into student_consult_interests (student_id, status, entry_point) values (v_uid, 'registered', 'guardian_invite')
    returning * into v_interest;
  end if;
  -- 이미 보호자가 연결된 학생 → 초대 없이 연결된 보호자에게 안내(1회). 상담이 이미 잡힌 경우도 같은 안내.
  select hm.household_id into v_household_id from household_members hm where hm.profile_id = v_uid and hm.role = 'child' limit 1;
  if v_household_id is not null then
    select g.profile_id into v_guardian_id from household_members g
    where g.household_id = v_household_id and g.role = 'guardian' order by g.is_primary desc, g.created_at limit 1;
    select lower(u.email), p.name into v_guardian_email, v_guardian_name
    from auth.users u join profiles p on p.id = u.id where u.id = v_guardian_id;
    if v_interest.linked_notice_sent_at is null then
      v_should_notify := true;
    end if;
    update student_consult_interests
    set status = case when status in ('consultation_requested', 'booked') then status else 'parent_linked' end, guardian_id = coalesce(guardian_id, v_guardian_id),
        linked_notice_sent_at = coalesce(linked_notice_sent_at, now()), updated_at = now()
    where id = v_interest.id;
    return query select 'already_linked'::text, null::uuid, null::text, v_guardian_email, v_guardian_name, v_should_notify, v_student_name;
    return;
  end if;

  -- 같은 이메일로 pending이 있으면 재발송과 동일(세대 상승, 이전 토큰 superseded).
  select * into v_existing from guardian_link_invites
  where student_id = v_uid and email_normalized = v_email_normalized and status = 'pending' for update;
  if found then
    return query
      select 'invite_sent'::text, r.invite_id, r.raw_token, null::text, null::text, false, v_student_name
      from resend_guardian_link_invite(v_existing.id) r;
    return;
  end if;

  select count(*) into v_open_count from guardian_link_invites
  where student_id = v_uid and status = 'pending' and expires_at > now();
  if v_open_count >= 3 then
    raise exception 'too_many_open_invites';  -- 오너 결정 7-16
  end if;

  insert into guardian_link_invites (student_id, interest_id, email_normalized, email_original, token_hash, expires_at, last_sent_at)
  values (v_uid, v_interest.id, v_email_normalized, trim(p_email), v_token_hash, now() + interval '7 days', now())
  returning id into v_id;
  insert into guardian_link_invite_events (invite_id, event_type, actor_id) values (v_id, 'sent', v_uid);
  update student_consult_interests set status = 'invite_sent', updated_at = now() where id = v_interest.id and status = 'registered';

  return query select 'invite_sent'::text, v_id, v_raw_token, null::text, null::text, false, v_student_name;
end;
$$;
revoke execute on function public.create_guardian_link_invite(text) from public, anon;
grant execute on function public.create_guardian_link_invite(text) to authenticated;

-- 5d) resend_guardian_link_invite --------------------------------------------------
create or replace function public.resend_guardian_link_invite(p_invite_id uuid)
returns table (invite_id uuid, raw_token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_row guardian_link_invites;
  v_daily int;
  v_new_id uuid;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
begin
  select * into v_row from guardian_link_invites where id = p_invite_id for update;
  if not found or not (v_row.student_id = v_uid or is_admin()) then
    raise exception 'not_found';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'not_pending';
  end if;
  if v_row.expires_at <= now() then
    raise exception 'expired';
  end if;
  if v_row.last_sent_at > now() - interval '10 minutes' then
    raise exception 'resend_cooldown';
  end if;
  select count(*) into v_daily
  from guardian_link_invite_events e join guardian_link_invites i on i.id = e.invite_id
  where e.event_type = 'resent' and e.created_at > now() - interval '24 hours'
    and i.student_id = v_row.student_id and i.email_normalized = v_row.email_normalized;
  if v_daily >= 3 then
    raise exception 'resend_daily_limit';
  end if;

  update guardian_link_invites set status = 'superseded', updated_at = now() where id = v_row.id;
  insert into guardian_link_invites (student_id, interest_id, email_normalized, email_original, token_hash, token_generation, expires_at, last_sent_at)
  values (v_row.student_id, v_row.interest_id, v_row.email_normalized, v_row.email_original, v_token_hash, v_row.token_generation + 1, now() + interval '7 days', now())
  returning id into v_new_id;
  update guardian_link_invites set superseded_by_id = v_new_id where id = v_row.id;
  insert into guardian_link_invite_events (invite_id, event_type, actor_id) values (v_row.id, 'superseded', v_uid);
  insert into guardian_link_invite_events (invite_id, event_type, actor_id) values (v_new_id, 'resent', v_uid);

  return query select v_new_id, v_raw_token;
end;
$$;
revoke execute on function public.resend_guardian_link_invite(uuid) from public, anon;
grant execute on function public.resend_guardian_link_invite(uuid) to authenticated;

-- 5e) revoke_guardian_link_invite ---------------------------------------------------
create or replace function public.revoke_guardian_link_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row guardian_link_invites;
begin
  select * into v_row from guardian_link_invites where id = p_invite_id for update;
  if not found or not (v_row.student_id = v_uid or is_admin()) then
    raise exception 'not_found';
  end if;
  if v_row.status not in ('pending', 'manual_review') then
    raise exception 'not_pending';
  end if;
  update guardian_link_invites set status = 'revoked', revoked_at = now(), updated_at = now() where id = v_row.id;
  insert into guardian_link_invite_events (invite_id, event_type, actor_id) values (v_row.id, 'revoked', v_uid);
  -- 남은 열린 초대가 없으면 관심 상태를 registered로 되돌린다.
  if v_row.interest_id is not null and not exists (
    select 1 from guardian_link_invites where interest_id = v_row.interest_id and status = 'pending'
  ) then
    update student_consult_interests set status = 'registered', updated_at = now()
    where id = v_row.interest_id and status = 'invite_sent';
  end if;
end;
$$;
revoke execute on function public.revoke_guardian_link_invite(uuid) from public, anon;
grant execute on function public.revoke_guardian_link_invite(uuid) to authenticated;

-- 5f) claim_guardian_link_invite — 읽기 전용 상태 조회(부작용 없음, anon 가능). 학생 상세는 이름·학년만. ------
create or replace function public.claim_guardian_link_invite(p_token text)
returns table (
  status text, invite_id uuid, student_first_name text, student_grade text, email_normalized text,
  account_exists boolean, viewer_email_matches boolean, viewer_is_parent boolean,
  consultation_id uuid, scheduling_token text
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_row guardian_link_invites;
  v_status text;
  v_name text;
  v_grade text;
  v_exists boolean;
  v_viewer_email text;
  v_viewer_is_parent boolean := false;
  v_sched text;
begin
  select * into v_row from guardian_link_invites where token_hash = v_hash;
  if not found then
    return query select 'invalid'::text, null::uuid, null::text, null::text, null::text, false, false, false, null::uuid, null::text;
    return;
  end if;
  v_status := v_row.status;
  if v_status = 'pending' and v_row.expires_at <= now() then
    v_status := 'expired';
  end if;
  select p.name, s.grade into v_name, v_grade from profiles p join students s on s.id = p.id where p.id = v_row.student_id;
  select exists (select 1 from auth.users u where lower(u.email) = v_row.email_normalized) into v_exists;
  if auth.uid() is not null then
    select lower(u.email) into v_viewer_email from auth.users u where u.id = auth.uid();
    select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'parent') into v_viewer_is_parent;
  end if;
  if v_status = 'accepted' and auth.uid() is not null and v_row.accepted_by = auth.uid() then
    select l.token into v_sched from consultation_scheduling_links l
    where l.consultation_id = v_row.consultation_id and l.used_at is null and l.expires_at > now()
    order by l.created_at desc limit 1;
  end if;
  return query select v_status, v_row.id, split_part(coalesce(v_name, ''), ' ', 1), v_grade, v_row.email_normalized,
    v_exists, coalesce(v_viewer_email = v_row.email_normalized, false), v_viewer_is_parent, v_row.consultation_id, v_sched;
end;
$$;
revoke execute on function public.claim_guardian_link_invite(text) from public;
grant execute on function public.claim_guardian_link_invite(text) to anon, authenticated;

-- 5g) provision_guardian_from_link_invite — service_role 전용. 계정 없는 보호자가 토큰으로 메일 소유를 입증한 뒤
--     서버가 Auth 계정을 만든 직후 profiles(parent)+parents를 멱등 생성한다. household/연결은 만들지 않는다(수락 단계).
create or replace function public.provision_guardian_from_link_invite(p_token text, p_auth_user_id uuid, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_row guardian_link_invites;
  v_email text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_only';
  end if;
  select * into v_row from guardian_link_invites where token_hash = v_hash;
  if not found or v_row.status <> 'pending' or v_row.expires_at <= now() then
    raise exception 'invalid_token';
  end if;
  select lower(email) into v_email from auth.users where id = p_auth_user_id;
  if v_email is distinct from v_row.email_normalized then
    raise exception 'email_mismatch';
  end if;
  if exists (select 1 from profiles where id = p_auth_user_id) then
    return;
  end if;
  insert into profiles (id, role, name) values (p_auth_user_id, 'parent', coalesce(nullif(trim(p_name), ''), split_part(v_email, '@', 1)));
  insert into parents (id) values (p_auth_user_id) on conflict do nothing;
end;
$$;
revoke execute on function public.provision_guardian_from_link_invite(text, uuid, text) from public, anon, authenticated;
grant execute on function public.provision_guardian_from_link_invite(text, uuid, text) to service_role;

-- 내부: 상담에 유효한 예약 링크가 있으면 그 토큰, 없으면 새로 발급(배정·requested·시간 없음일 때만). ----------
create or replace function public._ensure_free_member_scheduling_link(p_consultation_id uuid, p_actor uuid)
returns table (link_id uuid, token text)
language plpgsql security definer set search_path = public as $$
declare
  v_c consultations;
  v_link consultation_scheduling_links;
begin
  select * into v_c from consultations where id = p_consultation_id;
  if v_c.admissions_consultant_id is null or v_c.status <> 'requested' or v_c.starts_at is not null then
    return;
  end if;
  select * into v_link from consultation_scheduling_links
  where consultation_id = p_consultation_id and consultant_id = v_c.admissions_consultant_id
    and used_at is null and expires_at > now()
  order by created_at desc limit 1;
  if found then
    return query select v_link.id, v_link.token;
    return;
  end if;
  insert into consultation_scheduling_links (consultation_id, consultant_id, token, expires_at, created_by)
  values (p_consultation_id, v_c.admissions_consultant_id, encode(extensions.gen_random_bytes(24), 'hex'), now() + interval '7 days', p_actor)
  returning * into v_link;
  return query select v_link.id, v_link.token;
end;
$$;
revoke execute on function public._ensure_free_member_scheduling_link(uuid, uuid) from public, anon, authenticated;

-- 5h) accept_guardian_link_invite — §3.4 1~9. 보호자 로그인 세션, 단일 트랜잭션.
-- outcome: 'accepted' | 'manual_review'. booked=true면 이미 확정된 상담 재사용(예약 화면 생략).
create or replace function public.accept_guardian_link_invite(p_token text, p_consent_version text default 'summary_v1')
returns table (outcome text, invite_id uuid, student_id uuid, household_id uuid, consultation_id uuid, scheduling_token text, booked boolean, manual_review_reason text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_inv guardian_link_invites;
  v_guardian_email text;
  v_guardian_name text;
  v_guardian_phone text;
  v_student_name text;
  v_student_dob date;
  v_student_grade text;
  v_child_hh uuid;
  v_hh uuid;
  v_prospect_id uuid;
  v_c consultations;
  v_sched text;
  v_link_id uuid;
  v_reason text;
  v_booked boolean := false;
begin
  if v_uid is null then
    raise exception 'login_required';
  end if;

  -- 1) 잠금·토큰·만료·멱등
  select * into v_inv from guardian_link_invites where token_hash = v_hash for update;
  if not found then
    raise exception 'invalid_token';
  end if;
  if v_inv.status = 'accepted' then
    if v_inv.accepted_by is distinct from v_uid then
      raise exception 'accepted_by_other';
    end if;
    select l.token into v_sched from consultation_scheduling_links l
    where l.consultation_id = v_inv.consultation_id and l.used_at is null and l.expires_at > now() order by l.created_at desc limit 1;
    select (c.status <> 'requested' or c.starts_at is not null) into v_booked from consultations c where c.id = v_inv.consultation_id;
    select hm.household_id into v_hh from household_members hm where hm.profile_id = v_inv.student_id and hm.role = 'child' limit 1;
    return query select 'accepted'::text, v_inv.id, v_inv.student_id, v_hh, v_inv.consultation_id, v_sched, coalesce(v_booked, false), null::text;
    return;
  end if;
  if v_inv.status = 'manual_review' then
    return query select 'manual_review'::text, v_inv.id, v_inv.student_id, null::uuid, null::uuid, null::text, false, v_inv.manual_review_reason;
    return;
  end if;
  if v_inv.status <> 'pending' then
    raise exception '%', v_inv.status;
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'expired';
  end if;

  -- 2) 보호자 계정·이메일 일치
  select lower(u.email), p.name, p.phone into v_guardian_email, v_guardian_name, v_guardian_phone
  from auth.users u join profiles p on p.id = u.id where u.id = v_uid and p.role = 'parent';
  if not found then
    raise exception 'parent_account_required';
  end if;
  if not exists (select 1 from parents where id = v_uid) then
    insert into parents (id) values (v_uid);
  end if;
  if get_account_status(v_uid) not in ('active') then
    raise exception 'parent_account_inactive';
  end if;
  if v_guardian_email is distinct from v_inv.email_normalized then
    insert into guardian_link_invite_events (invite_id, event_type, actor_id) values (v_inv.id, 'claimed_mismatch', v_uid);
    raise exception 'email_mismatch';
  end if;

  -- 3) 학생 잠금·기존 household
  perform 1 from students where id = v_inv.student_id for update;
  select p.name, p.date_of_birth, s.grade into v_student_name, v_student_dob, v_student_grade
  from profiles p join students s on s.id = p.id where p.id = v_inv.student_id;
  select hm.household_id into v_child_hh from household_members hm where hm.profile_id = v_inv.student_id and hm.role = 'child' limit 1;

  select h.id into v_hh from households h where h.primary_guardian_id = v_uid and h.archived_at is null order by h.created_at limit 1;

  if v_child_hh is not null and (v_hh is null or v_child_hh <> v_hh) then
    v_reason := 'student_in_other_household';  -- §3.4-3 다른 household / §7-8 두 번째 보호자
  elsif v_hh is not null and exists (
    -- §3.4-4 같은 이름·생년월일 자녀가 이미 보호자 household에 있음(상담 경로로 먼저 만든 학생) → 자동 병합 금지
    select 1 from household_members hm join profiles p on p.id = hm.profile_id
    where hm.household_id = v_hh and hm.role = 'child' and hm.profile_id <> v_inv.student_id
      and v_student_dob is not null and p.date_of_birth = v_student_dob
      and lower(regexp_replace(coalesce(p.name, ''), '\s', '', 'g')) = lower(regexp_replace(coalesce(v_student_name, ''), '\s', '', 'g'))
  ) then
    v_reason := 'possible_duplicate_child';
  end if;

  if v_reason is not null then
    update guardian_link_invites set status = 'manual_review', manual_review_reason = v_reason, updated_at = now() where id = v_inv.id;
    insert into guardian_link_invite_events (invite_id, event_type, actor_id, detail)
    values (v_inv.id, 'manual_review', v_uid, jsonb_build_object('reason', v_reason, 'guardian_id', v_uid));
    return query select 'manual_review'::text, v_inv.id, v_inv.student_id, null::uuid, null::uuid, null::text, false, v_reason;
    return;
  end if;

  if v_hh is null then
    insert into households (primary_guardian_id) values (v_uid) returning id into v_hh;
    insert into household_members (household_id, profile_id, role, is_primary) values (v_hh, v_uid, 'guardian', true);
  elsif not exists (select 1 from household_members where household_id = v_hh and profile_id = v_uid and role = 'guardian') then
    insert into household_members (household_id, profile_id, role, is_primary) values (v_hh, v_uid, 'guardian', true);
  end if;
  if v_child_hh is null then
    insert into household_members (household_id, profile_id, role, is_primary)
    values (v_hh, v_inv.student_id, 'child', not exists (select 1 from household_members where household_id = v_hh and role = 'child'));
  end if;

  -- 5) prospect: 이 경로에서만 이메일로 재사용, converted_guardian_id는 명시 설정
  select pc.id into v_prospect_id from prospect_contacts pc
  where pc.primary_email_normalized = v_inv.email_normalized and (pc.converted_guardian_id is null or pc.converted_guardian_id = v_uid)
  order by pc.created_at desc limit 1;
  if v_prospect_id is null then
    insert into prospect_contacts (full_name, primary_email, primary_phone) values (coalesce(v_guardian_name, v_inv.email_normalized), v_inv.email_normalized, v_guardian_phone)
    returning id into v_prospect_id;
  end if;
  update prospect_contacts set converted_guardian_id = v_uid, converted_at = coalesce(converted_at, now()), converted_by = v_uid,
    conversion_note = coalesce(conversion_note, 'free_member guardian link')
  where id = v_prospect_id and converted_guardian_id is null;

  -- 6) 상담 재사용 또는 생성
  select * into v_c from consultations c
  where c.status in ('requested', 'scheduled')
    and (c.child_id = v_inv.student_id or (c.child_id is null and c.contact_email_normalized = v_inv.email_normalized))
  order by (c.child_id = v_inv.student_id) desc, c.created_at desc limit 1 for update;
  if found then
    update consultations set child_id = coalesce(child_id, v_inv.student_id), household_id = coalesce(household_id, v_hh),
      prospect_contact_id = coalesce(prospect_contact_id, v_prospect_id), updated_at = now()
    where id = v_c.id returning * into v_c;
  else
    insert into consultations (prospect_contact_id, source, contact_name, contact_email, contact_phone, student_grade, category, concerns,
      status, requested_at, child_id, household_id, created_by)
    values (v_prospect_id, 'free_member', coalesce(v_guardian_name, v_inv.email_normalized), v_inv.email_normalized, v_guardian_phone, v_student_grade, 'family',
      'Free member conversion: guardian accepted link invite', 'requested', now(), v_inv.student_id, v_hh, v_uid)
    returning * into v_c;
    insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
    values (v_c.id, null, 'requested', v_uid, '무료 회원 보호자 연결 수락');
  end if;

  -- 7) 자동 배정 + 예약 링크(free_member 소스 한정 예외, 오너 결정 7-5)
  if v_c.admissions_consultant_id is null and v_c.status = 'requested' then
    if _auto_assign_consultation(v_c.id) is not null then
      select * into v_c from consultations where id = v_c.id;
    end if;
  end if;
  select l.link_id, l.token into v_link_id, v_sched from _ensure_free_member_scheduling_link(v_c.id, v_uid) l;
  v_booked := (v_c.status <> 'requested' or v_c.starts_at is not null);

  -- 8) 학습 요약 동의
  insert into learning_summary_grants (student_id, guardian_id, household_id, scope, consent_version, source_invite_id)
  values (v_inv.student_id, v_uid, v_hh, 'summary_v1', coalesce(p_consent_version, 'summary_v1'), v_inv.id)
  on conflict do nothing;

  -- 9) 초대·관심 상태. 같은 학생의 다른 pending 초대는 superseded.
  update guardian_link_invites set status = 'accepted', accepted_at = now(), accepted_by = v_uid,
    consultation_id = v_c.id, scheduling_link_id = v_link_id, updated_at = now() where id = v_inv.id;
  insert into guardian_link_invite_events (invite_id, event_type, actor_id, detail)
  values (v_inv.id, 'accepted', v_uid, jsonb_build_object('consultation_id', v_c.id, 'household_id', v_hh));
  update guardian_link_invites set status = 'superseded', updated_at = now()
  where student_id = v_inv.student_id and status = 'pending' and id <> v_inv.id;
  insert into guardian_link_invite_events (invite_id, event_type, actor_id, detail)
  select id, 'superseded', v_uid, jsonb_build_object('reason', 'another_invite_accepted') from guardian_link_invites
  where student_id = v_inv.student_id and status = 'superseded' and superseded_by_id is null and id <> v_inv.id and updated_at = now();
  update student_consult_interests set status = case when v_booked then 'booked' else 'consultation_requested' end,
    guardian_id = v_uid, consultation_id = v_c.id, updated_at = now()
  where id = v_inv.interest_id or (v_inv.interest_id is null and student_id = v_inv.student_id and status not in ('cancelled', 'expired'));

  return query select 'accepted'::text, v_inv.id, v_inv.student_id, v_hh, v_c.id, v_sched, v_booked, null::text;
end;
$$;
revoke execute on function public.accept_guardian_link_invite(text, text) from public, anon;
grant execute on function public.accept_guardian_link_invite(text, text) to authenticated;
comment on function public.accept_guardian_link_invite(text, text) is
  '2026-10-05 §3.4 — household 연결 + 상담 재사용/생성(source=free_member) + 자동배정 + 예약 링크 + 학습 요약 동의. consultant_assignments·체험권·계약·칸반·수강·member_type은 건드리지 않는다.';

-- 5i) reissue_consult_scheduling_link_for_parent — 수락 후 예약 이탈 복귀(보호자) ----------------------
create or replace function public.reissue_consult_scheduling_link_for_parent(p_consultation_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_c consultations;
  v_token text;
begin
  select * into v_c from consultations where id = p_consultation_id for update;
  if not found or v_c.source <> 'free_member' or v_c.household_id is null then
    raise exception 'not_found';
  end if;
  if not exists (select 1 from household_members hm where hm.household_id = v_c.household_id and hm.profile_id = v_uid and hm.role = 'guardian') then
    raise exception 'not_found';
  end if;
  if v_c.status <> 'requested' or v_c.starts_at is not null then
    raise exception 'already_scheduled';
  end if;
  if v_c.admissions_consultant_id is null then
    raise exception 'not_assigned';
  end if;
  select l.token into v_token from _ensure_free_member_scheduling_link(v_c.id, v_uid) l;
  return v_token;
end;
$$;
revoke execute on function public.reissue_consult_scheduling_link_for_parent(uuid) from public, anon;
grant execute on function public.reissue_consult_scheduling_link_for_parent(uuid) to authenticated;

-- 5j) family_free_member_consult_status — 보호자 포털 배너·자녀 배지용(가족은 consultations 직접 조회 불가) ------
create or replace function public.family_free_member_consult_status()
returns table (consultation_id uuid, child_id uuid, child_name text, status text, assigned boolean, starts_at timestamptz, has_valid_link boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.child_id, p.name, c.status::text, c.admissions_consultant_id is not null, c.starts_at,
    exists (select 1 from consultation_scheduling_links l where l.consultation_id = c.id and l.used_at is null and l.expires_at > now())
  from consultations c
  join household_members g on g.household_id = c.household_id and g.profile_id = auth.uid() and g.role = 'guardian'
  left join profiles p on p.id = c.child_id
  where c.source = 'free_member' and c.status in ('requested', 'scheduled')
  order by c.created_at desc;
$$;
revoke execute on function public.family_free_member_consult_status() from public, anon;
grant execute on function public.family_free_member_consult_status() to authenticated;

-- 5k) 일일 크론용: 만료 처리 + 리마인더 후보(service_role/관리자) ------------------------------
-- 초대 후 3일 미수락 1회, 수락 후 2일 미예약 1회(최대 2회, 오너 결정 7-14). 발송은 앱(sendEmail)이 하고 여기서는 후보만 돌려준다.
create or replace function public.mark_expired_guardian_link_invites()
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not (is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'admin_only';
  end if;
  with expired as (
    update guardian_link_invites set status = 'expired', updated_at = now()
    where status = 'pending' and expires_at <= now() returning id
  ), ev as (
    insert into guardian_link_invite_events (invite_id, event_type) select id, 'expired' from expired returning invite_id
  )
  select count(*) into v_count from ev;
  -- 초대가 전부 만료된 관심은 expired로(열린 초대가 하나라도 남아 있으면 유지).
  update student_consult_interests i set status = 'expired', updated_at = now()
  where i.status = 'invite_sent'
    and exists (select 1 from guardian_link_invites g where g.interest_id = i.id and g.status = 'expired')
    and not exists (select 1 from guardian_link_invites g where g.interest_id = i.id and g.status = 'pending');
  return v_count;
end;
$$;
revoke execute on function public.mark_expired_guardian_link_invites() from public, anon;
grant execute on function public.mark_expired_guardian_link_invites() to authenticated, service_role;

create or replace function public.list_guardian_link_reminder_candidates()
returns table (invite_id uuid, kind text, email text, student_first_name text, consultation_id uuid, scheduling_token text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not (is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'admin_only';
  end if;
  return query
  -- (1) 초대 후 3일 미수락
  select i.id, 'unaccepted'::text, i.email_normalized, split_part(coalesce(p.name, ''), ' ', 1), null::uuid, null::text
  from guardian_link_invites i join profiles p on p.id = i.student_id
  where i.status = 'pending' and i.expires_at > now() and i.last_sent_at <= now() - interval '3 days'
    and not exists (select 1 from guardian_link_invite_events e where e.invite_id = i.id and e.event_type = 'reminder_sent')
  union all
  -- (2) 수락 후 2일 미예약(배정·유효 링크 있을 때만)
  select i.id, 'unbooked'::text, i.email_normalized, split_part(coalesce(p.name, ''), ' ', 1), c.id, l.token
  from guardian_link_invites i
  join profiles p on p.id = i.student_id
  join consultations c on c.id = i.consultation_id and c.status = 'requested' and c.starts_at is null and c.admissions_consultant_id is not null
  join lateral (select token from consultation_scheduling_links s where s.consultation_id = c.id and s.used_at is null and s.expires_at > now() order by s.created_at desc limit 1) l on true
  where i.status = 'accepted' and i.accepted_at <= now() - interval '2 days'
    and not exists (select 1 from guardian_link_invite_events e where e.invite_id = i.id and e.event_type = 'reminder_sent' and e.detail->>'kind' = 'unbooked');
end;
$$;
revoke execute on function public.list_guardian_link_reminder_candidates() from public, anon;
grant execute on function public.list_guardian_link_reminder_candidates() to authenticated, service_role;

create or replace function public.mark_guardian_link_reminder_sent(p_invite_id uuid, p_kind text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'admin_only';
  end if;
  insert into guardian_link_invite_events (invite_id, event_type, detail) values (p_invite_id, 'reminder_sent', jsonb_build_object('kind', p_kind));
end;
$$;
revoke execute on function public.mark_guardian_link_reminder_sent(uuid, text) from public, anon;
grant execute on function public.mark_guardian_link_reminder_sent(uuid, text) to authenticated, service_role;

-- 6b) 예약 확정(기존 redeem_consultation_scheduling_link, 상태 scheduled) → 관심 상태 booked. 공용 RPC는 건드리지 않는다.
create or replace function public.consult_interest_mark_booked()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'scheduled' and old.status is distinct from 'scheduled' and new.child_id is not null then
    update student_consult_interests set status = 'booked', updated_at = now()
    where student_id = new.child_id and status in ('parent_linked', 'consultation_requested', 'invite_sent', 'registered');
  end if;
  return new;
end;
$$;
drop trigger if exists consultations_consult_interest_mark_booked on consultations;
create trigger consultations_consult_interest_mark_booked
  after update of status on consultations
  for each row execute function public.consult_interest_mark_booked();

-- 5l) 미수락 리마인더용 토큰 회전(service_role). 원시 토큰은 저장하지 않으므로 리마인더 메일에는 새 세대 토큰을
--     담는다. 만료 시각·last_sent_at은 그대로(학생 재발송 쿨다운/일 3회 쿼터를 소비하지 않음), 이벤트는 reminder_sent.
create or replace function public.issue_guardian_link_reminder_token(p_invite_id uuid)
returns table (invite_id uuid, raw_token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_row guardian_link_invites;
  v_new_id uuid;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
begin
  if not (is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'admin_only';
  end if;
  select * into v_row from guardian_link_invites where id = p_invite_id for update;
  if not found or v_row.status <> 'pending' or v_row.expires_at <= now() then
    raise exception 'not_pending';
  end if;
  update guardian_link_invites set status = 'superseded', updated_at = now() where id = v_row.id;
  insert into guardian_link_invites (student_id, interest_id, email_normalized, email_original, token_hash, token_generation, expires_at, last_sent_at, created_at)
  values (v_row.student_id, v_row.interest_id, v_row.email_normalized, v_row.email_original, v_token_hash, v_row.token_generation + 1, v_row.expires_at, v_row.last_sent_at, v_row.created_at)
  returning id into v_new_id;
  update guardian_link_invites set superseded_by_id = v_new_id where id = v_row.id;
  insert into guardian_link_invite_events (invite_id, event_type, detail) values (v_row.id, 'superseded', jsonb_build_object('reason', 'reminder_token_rotation'));
  insert into guardian_link_invite_events (invite_id, event_type, detail) values (v_new_id, 'reminder_sent', jsonb_build_object('kind', 'unaccepted'));
  return query select v_new_id, v_raw_token;
end;
$$;
revoke execute on function public.issue_guardian_link_reminder_token(uuid) from public, anon;
grant execute on function public.issue_guardian_link_reminder_token(uuid) to authenticated, service_role;
