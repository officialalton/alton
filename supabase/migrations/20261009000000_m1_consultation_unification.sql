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
-- 요구사항 2: 제출 즉시 확정하지 않고 '승인 대기'(status='requested')로 저장하되,
-- 동일 시간 중복 신청 방지용 임시 hold + 만료 정책. 홈페이지 신청은 hold_expires_at을
-- 채운다(관리자가 직접 등록한 상담은 hold 개념이 없으므로 null로 둔다).
-- 만료값 결정 근거: R6 예약 흐름에 이미 있는 "관리자 확인 대기" SLA가 따로
-- 문서화돼 있지 않아, 상담 신청은 관리자가 통상 영업일 내 확인한다는 전제로
-- 30분을 기본 hold 창으로 채택했다(짧은 슬롯 점유로 다른 신청자를 막지 않으면서
-- 관리자가 알림을 확인할 최소 시간을 준다) — 향후 운영 데이터로 조정 가능하도록
-- 하드코딩 상수가 아니라 컬럼 값으로 신청마다 저장한다.
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
  'M1 요구사항 2: 홈페이지 신청의 임시 hold 만료 시각(기본 30분, submit_homepage_consult_request에서 설정). '
  '관리자가 수락하면 null로 정리되고, 만료되면 그 슬롯은 다시 신청 가능해진다(만료된 requested 건은 상태 유지, '
  '관리자가 뒤늦게 처리할 수 있으나 새 신청과의 슬롯 경합에서는 더 이상 우선권이 없다).';
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

-- 배타 제약의 where절은 IMMUTABLE 함수만 허용해 now() 기준 hold 만료를 인덱스
-- 조건에 넣을 수 없다(Postgres 제약). 대신 두 겹 방어로 나눈다:
--  1) 이 배타 제약은 "확정된"(scheduled) 상담끼리의 겹침만 하드 차단한다 —
--     확정 상담은 hold 개념이 없으므로 now() 의존 없이 안전하게 IMMUTABLE 조건만 쓴다.
--  2) 아직 hold 상태인 requested 건끼리의 겹침은 submit_homepage_consult_request()
--     함수 내부에서 명시적 SELECT ... FOR UPDATE로 "만료되지 않은 겹치는 hold가
--     있는지" 트랜잭션 안에서 확인한다(R3 find_possible_duplicate_consultations와
--     같은 SQL 계층 검증, R1 배타 제약과 동일한 최종 방어 정신을 함수 레벨로 구현).
alter table consultations add constraint consultations_no_overlap
  exclude using gist (
    tstzrange(starts_at, ends_at) with &&
  )
  where (
    starts_at is not null and ends_at is not null
    and status = 'scheduled'
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

  -- 아직 만료되지 않은 겹치는 hold(requested) 또는 이미 확정된(scheduled) 상담이
  -- 있으면 신청을 막는다. FOR UPDATE로 같은 슬롯 동시 신청 레이스를 직렬화한다
  -- (배타 제약이 scheduled끼리만 커버하는 gap을 여기서 메운다 — 위 3번 섹션 코멘트 참고).
  perform 1 from consultations c
  where c.starts_at is not null
    and c.status not in ('closed', 'converted', 'cancelled', 'no_show')
    and (c.status = 'scheduled' or c.hold_expires_at > now())
    and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
  for update;
  if found then
    raise exception '이미 다른 상담이 신청되었거나 확정된 시간입니다. 다른 시간을 선택해 주세요.';
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
    starts_at, ends_at, hold_expires_at, idempotency_key
  ) values (
    v_prospect.id, 'homepage', p_full_name, p_email, p_phone,
    p_student_grade, 'family', p_concerns, 'requested', now(),
    p_starts_at, v_ends_at, now() + interval '30 minutes', p_idempotency_key
  )
  returning * into v_consultation;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_consultation.id, null, 'requested', '홈페이지 상담 신청');

  return v_consultation;
end;
$$;

comment on function public.submit_homepage_consult_request(text, text, text, timestamptz, text, text, text) is
  'M1 요구사항 2·5: 홈페이지 상담 신청. 로그인 계정을 만들지 않고 prospect_contacts를 생성, '
  'consultations를 requested+hold_expires_at(기본 30분)으로 저장. 동일 idempotency_key 재요청은 '
  '기존 행 반환. 겹치는 슬롯은 consultations_no_overlap 배타 제약이 최종 방어선으로 막는다.';

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
        and c.status not in ('closed', 'converted', 'cancelled', 'no_show')
        and (c.hold_expires_at is null or c.hold_expires_at > now())
        and tstzrange(c.starts_at, c.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
  order by cs.slot_start;
$$;

comment on function public.list_open_consult_slots(timestamptz, timestamptz) is
  'M1 요구사항 1·2: 반복 가능시간에서 휴무 예외를 제거하고, 이미 점유된(hold 유효 또는 확정) 슬롯을 '
  '뺀 열린 60분 슬롯 후보를 반환. 최종 중복 방지 방어선은 consultations_no_overlap 배타 제약.';

grant execute on function public.list_open_consult_slots(timestamptz, timestamptz) to anon, authenticated;

-- =========================================================================
-- 9. 만료된 hold 정리 — 요구사항 2번(임시 hold + 만료 정책)
-- =========================================================================
--
-- 만료된 requested 건은 삭제하지 않는다(관리자가 뒤늦게라도 확인할 수 있어야
-- 함) — 대신 hold_expires_at이 지나면 consultations_no_overlap 배타 제약의
-- where 절 조건에서 자동으로 빠져 그 슬롯이 새 신청에 다시 열린다. 별도
-- cron 함수는 필요 없다(배타 제약이 now() 기준으로 매 신규 insert 시점에
-- 재평가되므로). 이 절은 그 사실을 명시적으로 문서화한다.
comment on constraint consultations_no_overlap on consultations is
  'M1 요구사항 2: 이 배타 제약은 확정(scheduled) 상담끼리의 겹침만 하드 차단한다(now() 의존 없는 IMMUTABLE 조건만 '
  '허용되는 Postgres 제약 때문). 아직 hold 상태인 requested 건끼리의 겹침·만료 처리는 submit_homepage_consult_request() '
  '함수 내부의 명시적 SELECT ... FOR UPDATE 검사가 담당한다 — 만료된 hold는 그 검사 조건에서 자동 제외되어 재신청 가능해진다.';
