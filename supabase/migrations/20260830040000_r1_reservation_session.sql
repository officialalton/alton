-- R1 — v3 스키마 5/12: reservations / sessions_v3 / session_status_events
--
-- shadow 이름(sessions_v3): 기존 앱·서버 액션·Calendly/DocuSign 웹훅이 현재 `sessions`
-- 구조에 의존하므로(2026-08-30 확인), 이번 R1에서는 기존 `sessions`를 rename하지 않고
-- 새 스키마를 `sessions_v3`로만 만든다. 실제 rename(cutover)은 앱 코드가 함께 바뀌는
-- 별도 마이그레이션에서 원자적으로 수행한다.
--
-- reservations는 sessions_v3를 참조하지 않는다(Gate B §3.4, 순환 FK 제거 — 예약이
-- 먼저 생기고 세션이 예약을 역참조하는 단방향 구조).
--
-- (2026-08-30 정정) `cause_reservation_id`(재예약 시 원인 예약) 컬럼은 만들지 않는다 —
-- 재예약은 별도 제품 기능으로 만들지 않기로 확정됐고, 학생은 취소 후 일반 예약을
-- 새로 생성한다(Gate A §4.5 "다시 예약은 상태가 아니다"와 일치).

create table reservations (
  id uuid primary key default gen_random_uuid(),
  kind v3_reservation_kind not null,
  consult_request_id uuid references consult_requests (id),
  subject_enrollment_id uuid references subject_enrollments (id),
  owner_profile_id uuid not null references profiles (id), -- 선생님 또는 상담담당
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status v3_reservation_status not null default 'holding',
  google_event_id text unique,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (kind = 'consult' and consult_request_id is not null and subject_enrollment_id is null)
    or
    (kind = 'lesson' and subject_enrollment_id is not null and consult_request_id is null)
  )
);
create index on reservations (owner_profile_id);
create index on reservations (subject_enrollment_id);

-- 불변(Gate B §3.4): 같은 주체(owner_profile_id)의 holding/confirmed 예약은 시간 겹침 금지
alter table reservations add constraint reservations_no_overlap
  exclude using gist (
    owner_profile_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('holding', 'confirmed'));

create table sessions_v3 (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references reservations (id),
  subject_enrollment_id uuid not null references subject_enrollments (id),
  teacher_id uuid not null references profiles (id),
  lesson_type_id uuid not null references lesson_types (id),
  material_version_id uuid references curriculum_doc_versions (id),
  hourly_rate_snapshot_minor bigint,
  hourly_rate_snapshot_currency text,
  scheduled_duration_minutes int not null,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  final_status v3_session_final_status not null default 'scheduled',
  final_reason text,
  final_actor_id uuid references profiles (id),
  finalized_at timestamptz,
  payable_minutes int,
  created_at timestamptz not null default now()
);
create index on sessions_v3 (subject_enrollment_id);
create index on sessions_v3 (teacher_id);

create table session_status_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions_v3 (id),
  event_type v3_session_status_event_type not null,
  previous_final_status v3_session_final_status,
  new_final_status v3_session_final_status not null,
  actor_profile_id uuid references profiles (id),
  reason text,
  occurred_at timestamptz not null default now()
);
create index on session_status_events (session_id);

-- 완료 후 직접 UPDATE 차단(Gate B §3.5) — final_status가 'scheduled'/'live'가 아니게 된
-- 뒤에는 reopen_session()/recomplete_session()을 통해서만 상태가 바뀔 수 있다.
create or replace function public.prevent_direct_final_status_update()
returns trigger
language plpgsql as $$
begin
  -- reopen_session()/recomplete_session()는 내부 UPDATE 직전 이 설정을 켜서 자기 자신의
  -- 트리거 차단에 걸리지 않게 한다(트랜잭션 범위 로컬 설정, set_config 세 번째 인자 true).
  if coalesce(current_setting('app.bypass_session_lock', true), 'false') = 'true' then
    return new;
  end if;
  if old.final_status not in ('scheduled', 'live') and new.final_status is distinct from old.final_status then
    raise exception 'completed 세션은 reopen_session()/recomplete_session()로만 상태를 바꿀 수 있습니다.';
  end if;
  return new;
end;
$$;

create trigger sessions_prevent_direct_update
  before update of final_status on sessions_v3
  for each row execute function public.prevent_direct_final_status_update();

revoke execute on function public.prevent_direct_final_status_update() from public, anon, authenticated, service_role;
-- 트리거 전용 함수라 트리거 메커니즘으로만 호출되고 직접 SELECT/PERFORM으로는 호출할 수
-- 없다(트리거 함수는 트리거 컨텍스트 밖에서 호출 시 Postgres가 자체적으로 거부한다).
-- Gate B §7 SECURITY DEFINER/트리거 함수 전수 점검 원칙에 따라 명시적으로 revoke만 해둔다.

create or replace function public.reopen_session(p_session_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prev v3_session_final_status;
begin
  if not public.is_admin() then
    raise exception '관리자만 세션을 재개방할 수 있습니다.';
  end if;

  select final_status into v_prev from sessions_v3 where id = p_session_id for update;
  if v_prev is null then
    raise exception '세션을 찾을 수 없습니다.';
  end if;
  if v_prev in ('scheduled', 'live') then
    raise exception '아직 확정되지 않은 세션은 재개방할 필요가 없습니다.';
  end if;

  -- (2026-08-30 정정) new_final_status는 실제로 바뀌는 값('live')을 기록해야 한다.
  -- 이전에는 v_prev를 그대로 다시 넣어 "무엇으로 바뀌었는지"가 이력에 남지 않는 버그가 있었다.
  insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
  values (p_session_id, 'reopened', v_prev, 'live', auth.uid(), p_reason);

  -- final_status는 재검토 표시를 위해 'live'로 되돌린다. completed→live 전이는
  -- prevent_direct_final_status_update 트리거에 걸리므로 이 함수 내부에서만 잠깐 우회한다.
  perform set_config('app.bypass_session_lock', 'true', true);
  update sessions_v3 set final_status = 'live' where id = p_session_id;
end;
$$;
revoke execute on function public.reopen_session(uuid, text) from public, anon, authenticated, service_role;

create or replace function public.recomplete_session(p_session_id uuid, p_new_final_status v3_session_final_status, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prev v3_session_final_status;
begin
  if not public.is_admin() then
    raise exception '관리자만 세션을 재확정할 수 있습니다.';
  end if;

  select final_status into v_prev from sessions_v3 where id = p_session_id for update;
  if v_prev is distinct from 'live' then
    raise exception 'reopen_session() 이후에만 recomplete_session()을 호출할 수 있습니다.';
  end if;

  -- (2026-08-30 정정) 재확정 대상은 종료 상태여야 한다. 'scheduled'/'live'로 다시
  -- "확정"하는 것은 recomplete_session의 목적(재개방된 세션을 최종 판정으로 되돌리기)에
  -- 맞지 않으므로 명시적으로 차단한다.
  if p_new_final_status in ('scheduled', 'live') then
    raise exception 'recomplete_session()은 scheduled/live로 되돌릴 수 없습니다. 확정 가능한 종료 상태만 허용됩니다.';
  end if;

  update sessions_v3 set final_status = p_new_final_status, finalized_at = now() where id = p_session_id;

  insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
  values (p_session_id, 'recompleted', v_prev, p_new_final_status, auth.uid(), p_reason);
end;
$$;
revoke execute on function public.recomplete_session(uuid, v3_session_final_status, text) from public, anon, authenticated, service_role;

grant execute on function public.reopen_session(uuid, text) to authenticated;
grant execute on function public.recomplete_session(uuid, v3_session_final_status, text) to authenticated;
-- authenticated에 grant하되 함수 내부의 is_admin() 검사가 실질적 관문(§5.1 SECURITY DEFINER 규칙).
-- service_role로 호출하면 auth.uid()가 비어 is_admin()이 항상 false가 되어 어차피 거부된다 —
-- 이 두 함수는 관리자 본인의 authenticated 세션으로 호출하도록 설계됐다.

comment on table reservations is 'Gate B §3.4: sessions_v3를 참조하지 않는다(순환 FK 제거). 예약 확정 뒤에 세션이 생성되어 reservation_id로 역참조. 재예약 개념 없음 — 취소 후 새 예약을 생성한다.';
comment on table sessions_v3 is 'Gate B §3.5: 세션 당시 teacher/rate/lesson_type/material 스냅샷 보존. 완료 후에는 reopen_session()/recomplete_session()로만 상태 변경. shadow 테이블(cutover 전까지 sessions_v3 유지).';
