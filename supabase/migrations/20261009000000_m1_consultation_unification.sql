-- M1 — 상담 기반 재설계: 홈페이지 상담 신청 → 관리자 수락 → Calendar/Meet →
-- 동의 → Smart Notes 기록까지 하나의 흐름으로 통합한다.
-- master-roadmap-v3.md "근접 실행계획" M1 절, docs/CURRENT.md 참고.
--
-- 설계 원칙(요구사항 5번 근거): 레거시(v1) consult_requests(20260827120000)는
-- 계속 동결 상태로 둔다(rename/삭제하지 않음 — 과거 R3 방침과 동일). 홈페이지
-- 신청은 이제 이 신규 컬럼이 추가된 v3 consultations 테이블에 직접 쓴다 —
-- consult_requests를 신규 신청 경로로 다시 쓰지 않음으로써 "두 개의 정상 경로"
-- 문제를 해소한다(consult_requests는 과거 데이터 조회용으로만 남는다).
--
-- 순수 additive: 기존 consultations 컬럼은 건드리지 않는다.

-- =========================================================================
-- 0. 신규 enum
-- =========================================================================

create type consult_slot_source as enum ('homepage', 'admin', 'referral');

-- 요구사항 6번: 관리자가 상담 결과를 기록하는 4가지 값. 실제 체험 전환·수업권
-- 지급·선생님 매칭·정식 계정 생성은 M1에서 하지 않는다 — 이 값은 M2/M3/M4가
-- 사용할 "연결 지점"일 뿐이다.
create type consult_outcome as enum (
  'trial_recommended', 'regular_recommended', 'on_hold', 'closed'
);

create type consult_sync_status as enum ('pending', 'synced', 'failed', 'reconciliation_needed');
create type consult_smart_notes_config_status as enum ('pending', 'applied', 'failed', 'not_applicable');

-- =========================================================================
-- 1. prospect_contacts — 비로그인 잠재고객/상담 연락처 레코드 (요구사항 5번)
-- =========================================================================
--
-- 상담 신청 시점에는 로그인 가능한 임시 계정을 만들지 않는다. 이 레코드가
-- 신청 당시 이메일과 향후 보호자 로그인 이메일이 달라도 상담 이력을 연결할
-- 수 있는 고유 ID를 제공한다. converted_guardian_id는 이메일 문자열 자동
-- 병합이 아니라 관리자 확인 또는 검증된 onboarding token 경로로만 채워진다
-- (M4 범위 — 이 마이그레이션은 컬럼·제약만 준비하고 그 연결 로직은 만들지
-- 않는다).
create table prospect_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  primary_email text not null,
  primary_email_normalized text generated always as (lower(trim(primary_email))) stored,
  primary_phone text,
  primary_phone_normalized text generated always as (regexp_replace(coalesce(primary_phone, ''), '\D', '', 'g')) stored,

  -- M4에서 정식 보호자 계정이 생성되면 명시적으로 연결한다. 이메일 문자열
  -- 일치만으로 자동 채우지 않는다(요구사항 5번 — 자동 병합 금지).
  converted_guardian_id uuid references parents (id),
  converted_at timestamptz,
  converted_by uuid references profiles (id),
  conversion_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on prospect_contacts (primary_email_normalized);
create index on prospect_contacts (primary_phone_normalized) where (primary_phone_normalized <> '');
create index on prospect_contacts (converted_guardian_id);

comment on table prospect_contacts is
  'M1 요구사항 5: 상담 신청 시 생성되는 비로그인 잠재고객 레코드. 정식 보호자 계정 연결은 '
  'converted_guardian_id(관리자 확인 또는 검증된 onboarding token 경로, M4)로만 명시 연결한다 — 이메일 자동 병합 금지.';

alter table prospect_contacts enable row level security;
-- 클라이언트가 직접 조회/수정할 경로가 없다(홈페이지 신청은 SECURITY DEFINER
-- 함수로, 관리자 조회는 관리자 서버 액션이 service_role/관리자 세션으로 수행).
-- 명시적 select 정책만 관리자에게 부여한다.
create policy "관리자 조회" on prospect_contacts for select using (is_admin());

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
-- 기존에 동일 이름 함수가 있으면 재사용(없으면 위에서 생성). 있었다면 그대로.
create trigger prospect_contacts_set_updated_at
  before update on prospect_contacts
  for each row execute function public.set_updated_at();

-- =========================================================================
-- 2. consult_consent_versions — 상담용 동의 문구 버전형 인터페이스 (요구사항 4번)
-- =========================================================================
--
-- 법률 문구는 별도 계약 문서 세션에서 확정된다. 이 마이그레이션은 그 문구를
-- 담을 버전형 테이블만 만든다 — body는 명확한 placeholder이고 임의 법률
-- 문안을 확정하지 않는다.
create table consult_consent_versions (
  id uuid primary key default gen_random_uuid(),
  version_label text not null unique,
  title text not null,
  body_markdown text not null,
  is_placeholder boolean not null default true,
  is_active boolean not null default false,
  effective_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

comment on table consult_consent_versions is
  'M1 요구사항 4: 상담용 AI 회의록(Smart Notes)·비밀유지·이용 안내 동의 문구의 버전형 인터페이스. '
  '최종 법률 문구는 별도 계약 문서 세션에서 확정 전까지 is_placeholder=true로 유지한다 — 이 문구로 '
  '실제 법적 동의를 받았다고 취급하지 않는다(docs 의존성: 계약 문서 세션 산출물 확정 후 신규 버전 삽입 필요).';

insert into consult_consent_versions (version_label, title, body_markdown, is_placeholder, is_active, effective_at)
values (
  'consult-consent-v0.placeholder',
  '[PLACEHOLDER — 법률 문안 미확정] 상담 AI 회의록 및 비밀유지·이용 안내',
  '이 문구는 실제 법률 문안이 아닙니다. 별도 계약 문서 세션에서 상담용 동의 문구가 확정되면 '
  || '이 자리를 대체할 신규 버전이 삽입됩니다. 실제 서비스 오픈 전 반드시 교체해야 하며, 이 '
  || 'placeholder로 수집된 확인은 법적 동의로 취급하지 않습니다.' || chr(10) || chr(10)
  || '예정된 안내 항목(placeholder): 상담 중 Smart Notes(AI 회의록) 사용 여부 및 목적, 원본 '
  || '회의록의 보관·열람 범위, 상담 내용의 비밀유지 원칙, 상담 요약의 활용 범위.',
  true,
  true,
  now()
);

alter table consult_consent_versions enable row level security;
create policy "인증 사용자 조회" on consult_consent_versions for select using (true);

-- =========================================================================
-- 3. 공용 상담 가능시간 — 반복 주간 가능시간 + 날짜별 예외/휴무 (요구사항 1번)
-- =========================================================================
--
-- R6 teacher_availability_rules/exceptions 패턴을 상담용으로 재사용(신규
-- 지시사항에서 "재사용할지 착수 시 확정"으로 남겨둔 결정 — 이번 세션에서
-- 상담 전용 공용 테이블로 확정한다: 상담은 특정 담당자 1인에 귀속되지 않고
-- "회사 상담 가능시간" 자체가 자원이므로 teacher_id 같은 소유자 컬럼을 두지
-- 않는다. 향후 기존 보호자·학생·선생님 상담 요청도 이 같은 테이블을 그대로
-- 재사용할 수 있도록 상담 유형에 무관한 공용 구조로 설계했다(요구사항 1번).
create table consult_availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6), -- 0=일요일 ... 6=토요일(JS Date 기준과 통일)
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Los_Angeles',
  active boolean not null default true,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index on consult_availability_rules (weekday) where active;

create table consult_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  exception_date date not null,
  is_closed boolean not null default true, -- true=그 날짜 전체 휴무, false=아래 시간대만 임시 오픈/축소
  start_time time,
  end_time time,
  reason text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  check (is_closed or (start_time is not null and end_time is not null and end_time > start_time))
);
create unique index on consult_availability_exceptions (exception_date, coalesce(start_time, '00:00'::time));

comment on table consult_availability_rules is
  'M1 요구사항 1: 관리자가 등록하는 반복 주간 상담 가능시간(공용 자원 — 특정 담당자에 귀속되지 않음). '
  '향후 기존 보호자·학생·선생님 상담에도 재사용 가능한 구조.';
comment on table consult_availability_exceptions is
  'M1 요구사항 1: 날짜별 예외(휴무 또는 임시 오픈/축소). is_closed=true면 start/end_time 무시.';

alter table consult_availability_rules enable row level security;
alter table consult_availability_exceptions enable row level security;
create policy "전체 조회(가용성은 홈페이지에도 노출)" on consult_availability_rules for select using (true);
create policy "관리자 쓰기" on consult_availability_rules for all using (is_admin()) with check (is_admin());
create policy "전체 조회(가용성은 홈페이지에도 노출)" on consult_availability_exceptions for select using (true);
create policy "관리자 쓰기" on consult_availability_exceptions for all using (is_admin()) with check (is_admin());

-- =========================================================================
-- 4. consultations 확장 — 홈페이지 신청 hold, prospect 연결, Google 동기화,
--    Smart Notes, 동의, 상담 결과 (요구사항 2·3·4·5·6번)
-- =========================================================================

alter table consultations add column prospect_contact_id uuid references prospect_contacts (id);
alter table consultations add column source consult_slot_source not null default 'admin';
-- 요구사항 2: 제출 즉시 확정하지 않고 '승인 대기'(status='requested')로 저장한다.
-- **(2026-09-03 정정)** 최초 구현은 30분 후 슬롯이 조용히 풀리는 자동 만료를 뒀으나,
-- 고객에게 아무 알림 없이 신청이 무효화되는 것은 별도 정책 설계(만료 상태·알림 방식)
-- 없이 임의로 넣을 수 있는 결정이 아니라는 지적에 따라 제거했다. 지금은 `requested`
-- 상담은 관리자가 수락/거절하기 전까지 슬롯을 그대로 유지한다 — hold_expires_at
-- 컬럼은 향후(자동 만료+고객 알림을 정식으로 설계하는 시점) 재사용할 수 있도록
-- 스키마만 남겨두되, 이번 구현에서는 어떤 함수도 이 컬럼에 실제 만료 시각을 채우지
-- 않는다(항상 null). 비로그인 신청의 슬롯 무제한 점유·남용은 자동 만료가 아니라
-- "동일 이메일당 처리 대기 중인 신청 1건 제한"(아래 submit_homepage_consult_request
-- 참고)으로 방어한다 — UX는 바꾸지 않는다(에러 메시지만 추가).
alter table consultations add column hold_expires_at timestamptz;
alter table consultations add column idempotency_key text;
alter table consultations add column google_event_id text;
alter table consultations add column google_meet_link text;
alter table consultations add column google_sync_status consult_sync_status not null default 'pending';
alter table consultations add column google_sync_retry_count integer not null default 0;
alter table consultations add column google_sync_last_error text;
alter table consultations add column smart_notes_config_status consult_smart_notes_config_status not null default 'not_applicable';
alter table consultations add column smart_notes_config_error text;
alter table consultations add column smart_notes_drive_file_id text;
-- 요구사항 6: Smart Notes 원본은 고객에게 자동 공개하지 않는다 — 관리자가 검토한
-- 요약만 이 컬럼에 보존한다. 원본 식별자(smart_notes_drive_file_id)는 관리자만
-- 접근하는 경로에서만 쓴다(RLS로 아래에서 강제).
alter table consultations add column admin_review_summary text;
alter table consultations add column consent_version_id uuid references consult_consent_versions (id);
alter table consultations add column consent_confirmed_at timestamptz;
alter table consultations add column consent_confirmed_ip text;
alter table consultations add column outcome consult_outcome;
alter table consultations add column outcome_notes text;
-- cancelled_at/cancellation_reason는 R3(20260914000000)에서 이미 존재 — 재사용한다.
alter table consultations add column rescheduled_from_id uuid references consultations (id);

create index on consultations (prospect_contact_id);
create index on consultations (google_sync_status);
create unique index consultations_idempotency_key_uq on consultations (idempotency_key) where idempotency_key is not null;

comment on column consultations.hold_expires_at is
  'M1 요구사항 2(2026-09-03 정정): 자동 만료는 구현하지 않는다 — 이 컬럼은 항상 null이고, '
  '향후 만료+고객 알림을 정식 설계하기 전까지는 어떤 함수도 값을 채우지 않는다. requested 상담은 '
  '관리자가 수락/거절할 때까지 슬롯을 계속 점유한다.';
comment on column consultations.admin_review_summary is
  'M1 요구사항 6: 고객에게 노출 가능한 관리자 검토 요약. Smart Notes 원본(smart_notes_drive_file_id)은 '
  '별도로 관리자 전용 경로에서만 접근한다 — 원본 자동 공개 금지.';

-- 같은 60분 슬롯에 동시에 유효한(hold 만료 전 requested 또는 accepted/scheduled) 상담이
-- 중복 존재하지 않도록 배타 제약. R6 reservations_no_overlap과 동일한 원칙(DB가 최종
-- 방어선, 앱 레이어의 슬롯 조회는 사전 안내용).
create extension if not exists btree_gist;

alter table consultations add column starts_at timestamptz;
alter table consultations add column ends_at timestamptz;
comment on column consultations.starts_at is
  'M1: 60분 상담 슬롯 시작 시각. 기존 scheduled_at(R3)은 "확정된" 상담 시각이라는 의미를 유지하고, '
  'starts_at/ends_at은 신청 단계(아직 미확정 포함)부터 겹침 방지 제약이 참조하는 슬롯 시각이다. '
  '관리자 수락 시 scheduled_at = starts_at으로 동기화한다.';

-- **(2026-09-03 정정)** 자동 만료를 제거하면서 hold도 now() 의존 없이 IMMUTABLE 조건만으로
-- 표현할 수 있게 됐다 — requested(아직 hold 중)와 scheduled(확정) 둘 다 이 배타 제약이
-- 직접 하드 차단한다(DB가 최종 방어선, R1 배타 제약과 동일한 원칙). closed/cancelled/
-- no_show/converted/completed는 슬롯을 점유하지 않으므로 where절에서 제외한다.
-- submit_homepage_consult_request() 내부의 SELECT ... FOR UPDATE는 이 제약보다 먼저
-- 더 친절한 에러 메시지를 주기 위한 앱 레벨 이중 방어로 유지한다(레이스는 최종적으로
-- 이 배타 제약이 막는다).
alter table consultations add constraint consultations_no_overlap
  exclude using gist (
    tstzrange(starts_at, ends_at) with &&
  )
  where (
    starts_at is not null and ends_at is not null
    and status in ('requested', 'scheduled')
  );

-- =========================================================================
-- 5. consultation_status_events — 감사 이력 (immutable, 기존 account_status_events 패턴)
-- =========================================================================

create table consultation_status_events (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations (id),
  previous_status v3_consultation_status,
  new_status v3_consultation_status not null,
  actor_profile_id uuid references profiles (id),
  reason text,
  google_action text, -- 'created' | 'time_changed' | 'cancelled' | null(Google 변경과 무관한 전이)
  created_at timestamptz not null default now()
);
create index on consultation_status_events (consultation_id);

create or replace function public.reject_consultation_status_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'consultation_status_events는 INSERT-only입니다.';
end;
$$;
create trigger consultation_status_events_no_update
  before update or delete on consultation_status_events
  for each row execute function public.reject_consultation_status_event_mutation();
revoke execute on function public.reject_consultation_status_event_mutation() from public, anon, authenticated, service_role;

alter table consultation_status_events enable row level security;
create policy "관리자 조회" on consultation_status_events for select using (is_admin());

-- =========================================================================
-- 6. 함수: 홈페이지 상담 신청 (요구사항 2·5번)
-- =========================================================================
--
-- anon이 직접 호출한다(로그인 없이 신청) — SECURITY DEFINER로 prospect_contacts/
-- consultations insert 권한을 위임하되, 입력값 검증(60분 슬롯 정렬, 가용시간
-- 내인지, 과거 시각 금지)을 내부에서 강제해 임의 슬롯 생성을 막는다. 동일
-- idempotency_key 재요청은 새 행을 만들지 않고 기존 행을 반환한다(R6 예약
-- 멱등성 패턴과 동일).
create or replace function public.submit_homepage_consult_request(
  p_full_name text,
  p_email text,
  p_phone text,
  p_starts_at timestamptz,
  p_student_grade text,
  p_concerns text,
  p_idempotency_key text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ends_at timestamptz := p_starts_at + interval '60 minutes';
  v_prospect prospect_contacts;
  v_consultation consultations;
  v_existing consultations;
begin
  if p_idempotency_key is not null then
    select * into v_existing from consultations where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  if p_starts_at <= now() then
    raise exception '지난 시간은 상담을 신청할 수 없습니다.';
  end if;

  if extract(minute from p_starts_at) not in (0) or extract(second from p_starts_at) <> 0 then
    -- 상담 슬롯은 정시 기준 60분 단위만 허용(홈페이지 슬롯 선택 UI가 정시만 노출하므로
    -- 이 검사는 UI 우회 신청을 막는 방어선).
    raise exception '상담 슬롯은 정시 단위로만 신청할 수 있습니다.';
  end if;

  -- 겹치는 requested(hold, 이제 만료 없음) 또는 scheduled(확정) 상담이 있으면 신청을
  -- 막는다. FOR UPDATE로 같은 슬롯 동시 신청 레이스를 직렬화한다 — 최종 방어선은
  -- consultations_no_overlap 배타 제약(2026-09-03 정정으로 requested도 포함하도록
  -- 넓혔다), 이건 더 친절한 에러 메시지를 위한 사전 확인.
  perform 1 from consultations c
  where c.starts_at is not null
    and c.status in ('requested', 'scheduled')
    and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
  for update;
  if found then
    raise exception '이미 다른 상담이 신청되었거나 확정된 시간입니다. 다른 시간을 선택해 주세요.';
  end if;

  -- 요구사항 2(2026-09-03 추가) — 비로그인 신청이 슬롯을 무제한 점유하는 남용을
  -- 막기 위한 기본 방어: 같은 이메일로 이미 처리 대기 중(requested)인 신청이 있으면
  -- 새 신청을 막는다(UX는 바꾸지 않음 — 폼 자체는 그대로, 에러 메시지만 추가). 정규화된
  -- 이메일(대소문자·공백 무시) 기준이며, 관리자가 그 신청을 수락/거절하면 다시 신청할 수
  -- 있다.
  if exists (
    select 1 from consultations c
    where c.status = 'requested'
      and lower(trim(c.contact_email)) = lower(trim(p_email))
  ) then
    raise exception '이미 처리 대기 중인 상담 신청이 있습니다. 관리자가 확인할 때까지 기다려 주세요.';
  end if;

  -- 잠재고객 레코드는 이메일 일치로 재사용하지 않는다(요구사항 5 — 자동 병합 금지).
  -- 매 신청마다 새 prospect_contacts를 만든다: 신청 시점의 연락처를 그대로 보존하고,
  -- 같은 사람의 재신청 통합은 관리자 확인(find_possible_duplicate_consultations류
  -- 확장, 이번 범위 밖)으로만 한다.
  insert into prospect_contacts (full_name, primary_email, primary_phone)
  values (p_full_name, p_email, p_phone)
  returning * into v_prospect;

  insert into consultations (
    prospect_contact_id, source, contact_name, contact_email, contact_phone,
    student_grade, category, concerns, status, requested_at,
    starts_at, ends_at, idempotency_key
  ) values (
    v_prospect.id, 'homepage', p_full_name, p_email, p_phone,
    p_student_grade, 'family', p_concerns, 'requested', now(),
    p_starts_at, v_ends_at, p_idempotency_key
  )
  returning * into v_consultation;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_consultation.id, null, 'requested', '홈페이지 상담 신청');

  return v_consultation;
end;
$$;

comment on function public.submit_homepage_consult_request(text, text, text, timestamptz, text, text, text) is
  'M1 요구사항 2·5: 홈페이지 상담 신청. 로그인 계정을 만들지 않고 prospect_contacts를 생성, '
  'consultations를 requested로 저장 — 관리자가 수락/거절할 때까지 자동 만료 없이 슬롯을 유지한다. '
  '동일 idempotency_key 재요청은 기존 행 반환, 같은 이메일의 두 번째 대기 신청은 거부(남용 방지). '
  '겹치는 슬롯은 consultations_no_overlap 배타 제약이 최종 방어선으로 막는다.';

grant execute on function public.submit_homepage_consult_request(text, text, text, timestamptz, text, text, text)
  to anon, authenticated;

-- =========================================================================
-- 7. 함수: 관리자 수락/거절/시간변경/취소 (요구사항 3번)
-- =========================================================================

create or replace function public.admin_accept_consultation(
  p_consultation_id uuid,
  p_consent_version_id uuid
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row consultations;
begin
  if not is_admin() then
    raise exception '관리자만 상담을 수락할 수 있습니다.';
  end if;

  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_row.status not in ('requested') then
    raise exception '이미 처리된 상담입니다(현재 상태: %).', v_row.status;
  end if;

  update consultations set
    status = 'scheduled',
    scheduled_at = starts_at,
    hold_expires_at = null,
    consent_version_id = coalesce(p_consent_version_id, v_row.consent_version_id),
    created_by = coalesce(created_by, auth.uid()),
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, 'requested', 'scheduled', auth.uid(), '관리자 수락');

  return v_row;
end;
$$;

create or replace function public.admin_reject_consultation(
  p_consultation_id uuid,
  p_reason text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row consultations;
  v_prev v3_consultation_status;
begin
  if not is_admin() then
    raise exception '관리자만 상담을 거절할 수 있습니다.';
  end if;

  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  v_prev := v_row.status;

  -- 기존 R3 cancelConsultation()과 동일한 status='cancelled' 규약을 그대로 따른다
  -- (status enum의 'closed'는 "일정과 무관하게 파이프라인을 조기 종료"라는 다른
  -- 의미로 admin_record_consultation_outcome()의 outcome='closed'에서만 쓴다).
  update consultations set
    status = 'cancelled',
    hold_expires_at = null,
    outcome_notes = coalesce(p_reason, outcome_notes),
    cancelled_at = now(),
    cancellation_reason = p_reason,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, v_prev, 'cancelled', auth.uid(), coalesce(p_reason, '관리자 거절'));

  return v_row;
end;
$$;

-- 시간 변경: 새 슬롯으로 옮긴 신규 행을 만들지 않고(예약 시스템과 달리 상담은
-- 1건당 1 Google 이벤트라 in-place 갱신이 더 단순하다) starts_at/ends_at을
-- 갱신하고 google_sync_status를 pending으로 되돌려 재동기화 워커가 Calendar
-- 이벤트를 patch하도록 만든다. 배타 제약이 새 시간대 충돌을 자동 차단한다.
create or replace function public.admin_reschedule_consultation(
  p_consultation_id uuid,
  p_new_starts_at timestamptz,
  p_reason text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row consultations;
begin
  if not is_admin() then
    raise exception '관리자만 상담 시간을 변경할 수 있습니다.';
  end if;
  if p_new_starts_at <= now() then
    raise exception '지난 시간으로 변경할 수 없습니다.';
  end if;

  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_row.status not in ('requested', 'scheduled') then
    raise exception '진행 중이거나 확정된 상담만 시간을 변경할 수 있습니다(현재 상태: %).', v_row.status;
  end if;

  update consultations set
    starts_at = p_new_starts_at,
    ends_at = p_new_starts_at + interval '60 minutes',
    scheduled_at = case when status = 'scheduled' then p_new_starts_at else scheduled_at end,
    google_sync_status = case when google_event_id is not null then 'pending' else google_sync_status end,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason, google_action)
  values (p_consultation_id, v_row.status, v_row.status, auth.uid(), coalesce(p_reason, '관리자 시간 변경'), 'time_changed');

  return v_row;
end;
$$;

create or replace function public.admin_cancel_consultation(
  p_consultation_id uuid,
  p_reason text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row consultations;
  v_prev v3_consultation_status;
begin
  if not is_admin() then
    raise exception '관리자만 상담을 취소할 수 있습니다.';
  end if;

  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  v_prev := v_row.status;

  update consultations set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = p_reason,
    google_sync_status = case when google_event_id is not null then 'pending' else google_sync_status end,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason, google_action)
  values (p_consultation_id, v_prev, 'cancelled', auth.uid(), coalesce(p_reason, '관리자 취소'), 'cancelled');

  return v_row;
end;
$$;

-- 요구사항 6: 상담 결과 기록(체험 진행 권장/정규 진행 권장/보류/종료) — M2/M3가
-- 사용할 전환 상태의 연결 지점. 이 함수는 상태값만 기록하고 실제 체험 전환·
-- 수업권 지급·선생님 매칭은 하지 않는다.
create or replace function public.admin_record_consultation_outcome(
  p_consultation_id uuid,
  p_outcome consult_outcome,
  p_notes text,
  p_admin_review_summary text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row consultations;
begin
  if not is_admin() then
    raise exception '관리자만 상담 결과를 기록할 수 있습니다.';
  end if;

  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;

  -- M1 요구사항 3(2026-09-03 추가) — readiness 게이트: "동의 확인 완료 + Smart Notes 활성화
  -- 확인 완료" 두 조건을 서버에서 강제한다. 관리자 화면이 안내를 빠뜨리거나 우회해도 이
  -- 함수 자체가 막는다 — 아직 한 번도 확정(scheduled)되지 않은 상담은 애초에 이 두 조건을
  -- 채울 기회가 없었으므로 함께 막는다(상담 자체를 하지 않고 결과만 기록하는 경로 없음).
  if v_row.consent_version_id is null or v_row.consent_confirmed_at is null then
    raise exception '동의 확인이 완료되지 않아 상담 결과를 기록할 수 없습니다(consent_confirmed_at 없음).';
  end if;
  if v_row.smart_notes_config_status is distinct from 'applied' then
    raise exception 'Smart Notes 활성화가 확인되지 않아 상담 결과를 기록할 수 없습니다(smart_notes_config_status: %).', v_row.smart_notes_config_status;
  end if;

  update consultations set
    status = case when status = 'scheduled' then 'completed' else status end,
    completed_at = coalesce(completed_at, now()),
    outcome = p_outcome,
    outcome_notes = coalesce(p_notes, outcome_notes),
    admin_review_summary = coalesce(p_admin_review_summary, admin_review_summary),
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, v_row.status, v_row.status, auth.uid(), '상담 결과 기록: ' || p_outcome::text);

  return v_row;
end;
$$;

grant execute on function public.admin_accept_consultation(uuid, uuid) to authenticated;
grant execute on function public.admin_reject_consultation(uuid, text) to authenticated;
grant execute on function public.admin_reschedule_consultation(uuid, timestamptz, text) to authenticated;
grant execute on function public.admin_cancel_consultation(uuid, text) to authenticated;
grant execute on function public.admin_record_consultation_outcome(uuid, consult_outcome, text, text) to authenticated;
revoke execute on function public.admin_accept_consultation(uuid, uuid) from anon;
revoke execute on function public.admin_reject_consultation(uuid, text) from anon;
revoke execute on function public.admin_reschedule_consultation(uuid, timestamptz, text) from anon;
revoke execute on function public.admin_cancel_consultation(uuid, text) from anon;
revoke execute on function public.admin_record_consultation_outcome(uuid, consult_outcome, text, text) from anon;

-- =========================================================================
-- 8. 함수: 60분 슬롯 조회(공용 상담 가능시간 - 예외 - 이미 점유된 슬롯) — 요구사항 1·2번
-- =========================================================================

create or replace function public.list_open_consult_slots(
  p_from timestamptz,
  p_to timestamptz
)
returns table (slot_starts_at timestamptz)
language sql stable
security definer
set search_path = public
as $$
  -- 관리자 UI/홈페이지 모두 이 함수로 열린 슬롯을 조회한다. 실제 최종 방어선은
  -- consultations_no_overlap 배타 제약이므로, 여기서는 후보를 안내하는 용도다.
  with weekday_rules as (
    select r.weekday, r.start_time, r.end_time
    from consult_availability_rules r
    where r.active
  ),
  days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day')::date as d
  ),
  -- 규칙의 start_time~end_time 창 안에서 60분 간격 슬롯을 전부 펼친다(예: 09:00~18:00
  -- 규칙이면 09:00,10:00,...,17:00 총 9개 슬롯). 최초 구현이 start_time 슬롯 하나만
  -- 만들던 버그를 실제 로컬 E2E(m1-consultation-flow.spec.ts) 작성 중 발견해 수정.
  candidate_slots as (
    select
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + (n * interval '60 minutes')) as slot_start,
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + ((n + 1) * interval '60 minutes')) as slot_end
    from days d
    join weekday_rules wr on wr.weekday = extract(dow from d.d)::smallint
    cross join lateral generate_series(0, (extract(epoch from (wr.end_time - wr.start_time)) / 3600)::int - 1) as n
    where not exists (
      select 1 from consult_availability_exceptions e
      where e.exception_date = d.d and e.is_closed
    )
  )
  -- distinct: 겹치는 반복 가능시간 규칙이 여러 개 등록돼 있으면(예: 관리자가 09-18과
  -- 09-20을 동시에 켜둔 경우) 같은 slot_start가 규칙 개수만큼 중복 생성될 수 있어
  -- 명시적으로 제거한다 — 실제 로컬 E2E(m1-consultation-flow.spec.ts)에서 React key
  -- 중복 경고로 발견한 버그.
  select distinct cs.slot_start
  from candidate_slots cs
  where cs.slot_start >= p_from
    and cs.slot_start < p_to
    and cs.slot_start > now()
    and not exists (
      select 1 from consultations c
      where c.starts_at is not null
        and c.status in ('requested', 'scheduled')
        and tstzrange(c.starts_at, c.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
  order by cs.slot_start;
$$;

comment on function public.list_open_consult_slots(timestamptz, timestamptz) is
  'M1 요구사항 1·2: 반복 가능시간에서 휴무 예외를 제거하고, 이미 점유된(requested 또는 scheduled) 슬롯을 '
  '뺀 열린 60분 슬롯 후보를 반환. 최종 중복 방지 방어선은 consultations_no_overlap 배타 제약. '
  '(2026-09-03 정정) hold 자동 만료를 제거해 requested도 scheduled와 동일하게 항상 점유로 취급한다.';

grant execute on function public.list_open_consult_slots(timestamptz, timestamptz) to anon, authenticated;

-- =========================================================================
-- 9. hold 정책(2026-09-03 정정 — 자동 만료 제거)
-- =========================================================================
--
-- requested 상담은 관리자가 수락/거절하기 전까지 슬롯을 계속 점유한다 — 자동 만료를
-- 제거했으므로 별도 만료 정리 cron도 필요 없다. consultations_no_overlap 배타 제약이
-- requested/scheduled 둘 다 직접 하드 차단하므로(위 4번 섹션 참고), 이 constraint
-- comment로 그 사실을 명시적으로 문서화한다.
comment on constraint consultations_no_overlap on consultations is
  'M1 요구사항 2(2026-09-03 정정): requested(hold, 자동 만료 없음)와 scheduled(확정) 둘 다 이 배타 제약이 '
  '직접 하드 차단한다 — now() 의존 없는 IMMUTABLE 조건만 허용되는 Postgres 제약과도 맞아, hold 만료 개념을 '
  '아예 없앤 뒤에는 앱 레벨 이중 검사(SELECT ... FOR UPDATE)가 더 친절한 에러만 앞단에서 줄 뿐 최종 방어선은 이 제약이다.';

-- =========================================================================
-- 10. Smart Notes 원본 자동 연결 (요구사항 4, 2026-09-03 추가)
-- =========================================================================
--
-- 기존 R6 Workspace Events 웹훅(app/api/webhooks/workspace-events/route.ts)이 이미
-- reservations.google_meeting_code로 세션을 찾아 smart_notes_generation_events에
-- 적재하는 구조를 그대로 재사용한다 — 새 웹훅을 만들지 않는다. consultations도 같은
-- 방식으로 매칭할 수 있도록 google_meeting_code 컬럼과 nullable consultation_id FK,
-- 중복 이벤트 멱등 처리용 pubsub_message_id를 추가한다.
alter table consultations add column google_meeting_code text;
create index on consultations (google_meeting_code);
comment on column consultations.google_meeting_code is
  'M1 요구사항 4: google_meet_link에서 추출한 회의 코드(extractMeetingCodeFromLink) — Workspace Events '
  '웹훅이 이 값으로 상담을 찾아 Smart Notes 원본을 자동 연결한다. Calendar 동기화 성공 시 함께 기록.';

alter table smart_notes_generation_events add column consultation_id uuid references consultations (id);
create index on smart_notes_generation_events (consultation_id);
alter table smart_notes_generation_events add column pubsub_message_id text;
create unique index smart_notes_generation_events_pubsub_message_id_uq
  on smart_notes_generation_events (pubsub_message_id) where pubsub_message_id is not null;
comment on column smart_notes_generation_events.consultation_id is
  'M1 요구사항 4: 세션(session_id)이 아니라 상담에 매칭된 이벤트 — 상담은 sessions 테이블과 무관하므로 '
  '별도 FK로 둔다. 매칭 실패(둘 다 null)는 유실이 아니라 linked=false로 보존해 관리자가 재처리할 수 있다.';
comment on column smart_notes_generation_events.pubsub_message_id is
  'M1 요구사항 4: Pub/Sub 메시지 messageId — 동일 이벤트 재전송(at-least-once 배달) 시 중복 행이 쌓이지 '
  '않도록 유니크 인덱스로 멱등 처리한다(null이면 과거 이벤트처럼 검사하지 않음, 하위 호환).';

-- =========================================================================
-- 11. 안전한 동의 확인 토큰 (요구사항 5, 2026-09-03 추가)
-- =========================================================================
--
-- 상담 UUID 자체를 공개 확인 권한으로 쓰지 않는다 — 별도의 만료형 확인 토큰을 발급하고
-- 원문은 저장하지 않는다(해시만 저장, R2 account_invites의 토큰 해시 패턴과 동일한 원칙).
create table consult_consent_tokens (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations (id),
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on consult_consent_tokens (consultation_id);
create unique index consult_consent_tokens_hash_uq on consult_consent_tokens (token_hash);

comment on table consult_consent_tokens is
  'M1 요구사항 5: 동의 확인 이메일 링크에 실리는 토큰의 해시만 저장한다(원문은 DB/로그에 남기지 않음) — '
  '위조·재사용·다른 상담 확인을 막기 위해 상담 1건당 매번 새로 발급하고 만료·1회성으로 제한한다.';

alter table consult_consent_tokens enable row level security;
create policy "관리자 조회" on consult_consent_tokens for select using (is_admin());
-- insert/update는 client에서 하지 않는다 — 확인 이메일 발송 시 서버가 service_role로 발급하고,
-- confirm_consult_consent_by_token()이 검증·소비를 전담한다(아래).

-- SHA-256 해시로 원문 토큰과 비교한다(pgcrypto digest) — 평문 토큰은 이 함수 호출자(서버
-- 액션)에서만 잠깐 메모리에 있다가 여기 오면 즉시 해시로만 다뤄진다.
create extension if not exists pgcrypto;

create or replace function public.issue_consult_consent_token(
  p_consultation_id uuid,
  p_token_plain text,
  p_ttl_hours integer default 168 -- 기본 7일(상담이 그보다 멀리 잡혀도 여유 있게, 짧게 만료시켜 재발급 필요할 땐 관리자 재전송으로 대응)
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into consult_consent_tokens (consultation_id, token_hash, expires_at)
  values (p_consultation_id, encode(extensions.digest(p_token_plain, 'sha256'), 'hex'), now() + make_interval(hours => p_ttl_hours));
end;
$$;
revoke execute on function public.issue_consult_consent_token(uuid, text, integer) from anon, authenticated;
grant execute on function public.issue_consult_consent_token(uuid, text, integer) to service_role;

-- 조회 전용(읽기 화면용) — 아직 소비하지 않는다. 위조된 토큰이나 만료된 토큰은 조용히
-- null을 반환한다(에러로 토큰 존재 여부를 흘리지 않음 — enumeration 방지).
create or replace function public.resolve_consult_consent_token(p_token_plain text)
returns table (consultation_id uuid, already_used boolean)
language sql stable
security definer
set search_path = public
as $$
  select t.consultation_id, (t.used_at is not null) as already_used
  from consult_consent_tokens t
  where t.token_hash = encode(extensions.digest(p_token_plain, 'sha256'), 'hex')
    and t.expires_at > now()
  limit 1;
$$;
grant execute on function public.resolve_consult_consent_token(text) to anon, authenticated;

-- 실제 확인 처리(멱등) — 동일 토큰으로 여러 번 호출돼도 최초 1회만 기록되고, 이후
-- 호출은 이미 확인됨을 그대로 반환한다(요구사항 5: 동일 요청 멱등 처리).
create or replace function public.confirm_consult_consent_by_token(p_token_plain text)
returns table (consultation_id uuid, consent_version_id uuid, confirmed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token consult_consent_tokens;
  v_consultation consultations;
begin
  select * into v_token from consult_consent_tokens
  where token_hash = encode(extensions.digest(p_token_plain, 'sha256'), 'hex') and expires_at > now()
  for update;
  if not found then
    raise exception '유효하지 않거나 만료된 확인 링크입니다.';
  end if;

  select * into v_consultation from consultations where id = v_token.consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다.';
  end if;

  if v_token.used_at is null then
    update consult_consent_tokens set used_at = now() where id = v_token.id;
  end if;

  if v_consultation.consent_confirmed_at is null then
    update consultations set
      consent_confirmed_at = now(),
      consent_confirmed_ip = null -- IP는 앱 레이어(요청 헤더 접근 가능한 서버 액션)에서 별도 UPDATE로 기록한다.
    where id = v_consultation.id
    returning * into v_consultation;
  end if;

  return query select v_consultation.id, v_consultation.consent_version_id, v_consultation.consent_confirmed_at;
end;
$$;
grant execute on function public.confirm_consult_consent_by_token(text) to anon, authenticated;

comment on function public.confirm_consult_consent_by_token(text) is
  'M1 요구사항 5: 동의 확인 토큰을 소비해 consultations.consent_confirmed_at을 1회 기록한다(멱등 — '
  '이미 확인된 토큰으로 재호출해도 에러 없이 같은 결과 반환). IP 기록은 호출부(서버 액션)가 별도로 UPDATE한다.';

-- =========================================================================
-- 12. 확인 이메일 발송 멱등성 (요구사항 6, 2026-09-03 추가)
-- =========================================================================
--
-- 재처리(Calendar 재동기화 재시도 등)가 이미 보낸 것과 똑같은 내용의 확인 이메일을
-- 중복 발송하지 않도록, 마지막으로 보낸 이메일 내용의 지문(시간+Meet 링크 해시)과
-- 발송 시각을 남긴다. 시간변경으로 내용이 실제로 달라지면 지문이 달라져 새 이메일을
-- 보낸다(요구사항 6: "최신 일시/Meet 정보 반영하되 단순 재시도로 중복 발송 금지").
alter table consultations add column confirmation_email_sent_at timestamptz;
alter table consultations add column confirmation_email_content_hash text;
comment on column consultations.confirmation_email_content_hash is
  'M1 요구사항 6: sha256(starts_at + google_meet_link)의 hex 다이제스트. 다음 동기화 시도에서 '
  '같은 해시면 이메일을 다시 보내지 않고, 달라지면(시간 변경 등) 새로 보낸다.';
