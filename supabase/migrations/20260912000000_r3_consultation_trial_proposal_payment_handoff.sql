-- R3 — 상담(consultation) → 체험(trial) → 제안서(proposal) → 계약(contract) →
-- 결제 핸드오프(payment handoff, 실제 Stripe 연동은 R4 범위) 데이터 모델.
--
-- 순수 additive 마이그레이션이다: 기존 테이블의 기존 컬럼은 건드리지 않는다.
-- master-roadmap-v3.md R3 섹션, product-architecture-v3.md §5.1(상담 상태모델)
-- §5.5(계약 상태모델) 기준. 레거시(v1) `consult_requests`(20260827120000)는 이번
-- 마이그레이션과 무관하게 그대로 동결 상태로 둔다 — rename도, 참조도 하지 않는다.
-- `reservations.consult_request_id`가 여전히 레거시 `consult_requests`를 가리키는
-- 것도(20260830040000) 의도적으로 그대로 둔다 — 예약(booking) 메커니즘과 신규
-- v3 상담 레코드의 통합은 R6(셀프서브 예약) 범위이며, 그때까지는 두 흐름이
-- 독립적으로 존재한다는 것이 알려진 gap이다(하단 코멘트 참고).

-- =========================================================================
-- 0. 신규 enum
-- =========================================================================

-- product-architecture-v3.md §5.1: requested→scheduled→completed→trial_planned→
-- trial_completed→proposed→contracted→converted, 조기 종료 시 closed.
create type v3_consultation_status as enum (
  'requested', 'scheduled', 'completed', 'trial_planned', 'trial_completed',
  'proposed', 'contracted', 'converted', 'closed'
);

create type v3_trial_status as enum (
  'scheduled', 'completed',
  'student_cancelled', 'student_no_show', 'teacher_cancelled', 'teacher_no_show'
);

create type v3_proposal_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');

-- DocuSign 봉투(envelope) 상태만 표현한다 — 계약 자체의 상태 기계는 여전히
-- v3_contract_status(ALTON DB가 source of truth)가 담당하고, 이 enum은 DocuSign
-- 쪽 실행(서명) 이벤트를 그대로 기록하는 부수 정보다(2026-08-29 정책: "DocuSign은
-- 서명 실행만 담당, 계약 상태의 source of truth는 ALTON DB").
create type v3_docusign_envelope_status as enum ('sent', 'delivered', 'completed', 'declined', 'voided');

-- =========================================================================
-- 1. consultations (v3, 신규 — 레거시 consult_requests의 rename/치환이 아니다)
-- =========================================================================
--
-- household_id/child_id는 상담 시점에 아직 없을 수 있다(가입 전 문의) — R2 초대
-- 흐름(app/admin/contracts-actions.ts 등)과 같은 패턴으로 raw contact 필드를
-- 함께 둔다. 프로필이 생기면 관리자가 household_id/child_id를 채워 넣는다.
create table consultations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households (id),
  child_id uuid references profiles (id),

  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  -- 중복 상담 탐지용 정규화 컬럼(아래 설계 판단 참고).
  contact_email_normalized text generated always as (lower(trim(contact_email))) stored,
  contact_phone_normalized text generated always as (regexp_replace(coalesce(contact_phone, ''), '\D', '', 'g')) stored,

  student_grade text,
  category consult_category, -- 기존 enum 재사용(테이블이 아닌 순수 enum 타입 재사용 — family/teacher_applicant)
  concerns text,

  status v3_consultation_status not null default 'requested',
  requested_at timestamptz not null default now(),
  scheduled_at timestamptz,
  completed_at timestamptz,

  -- 설계 판단 1(중복 상담 탐지): email+phone 조합에 하드 unique 제약을 걸지 않는다.
  -- 같은 보호자가 자녀별로, 또는 시간이 지나 재상담을 정당하게 여러 번 신청할 수
  -- 있어 삽입 자체를 막을 수 없기 때문이다. 대신 (a) 정규화된 email/phone에
  -- 인덱스를 걸어 조회를 빠르게 하고, (b) 관리자가 후보를 검토해 실제 중복이라고
  -- 확인하면 이 self-FK로 명시적으로 연결한다. 자동 판정이 아니라 "후보 제시 +
  -- 관리자 확인" 흐름 — find_possible_duplicate_consultations() 참고.
  duplicate_of_consultation_id uuid references consultations (id),

  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on consultations (household_id);
create index on consultations (child_id);
create index on consultations (contact_email_normalized);
create index on consultations (contact_phone_normalized) where (contact_phone_normalized <> '');
create index on consultations (duplicate_of_consultation_id);
create index on consultations (status);

comment on table consultations is
  'R3: v3 상담 레코드. 레거시(v1) consult_requests(Calendly 기반, 동결됨)와 별개의 신규 테이블 — rename 아님. '
  'household_id/child_id는 가입 전 상담에서는 null일 수 있다.';

create or replace function public.find_possible_duplicate_consultations(
  p_email text, p_phone text, p_exclude_id uuid default null
)
returns setof consultations
language sql stable security definer set search_path = public as $$
  select c.*
  from consultations c
  where c.id is distinct from p_exclude_id
    and (
      (p_email is not null and c.contact_email_normalized = lower(trim(p_email)))
      or (
        p_phone is not null
        and regexp_replace(p_phone, '\D', '', 'g') <> ''
        and c.contact_phone_normalized = regexp_replace(p_phone, '\D', '', 'g')
      )
    )
  order by c.created_at desc;
$$;

comment on function public.find_possible_duplicate_consultations(text, text, uuid) is
  'R3: email/phone 정규화 일치 기준 중복 상담 후보 조회. 하드 unique 제약 대신 관리자가 '
  '결과를 보고 duplicate_of_consultation_id로 명시 연결하는 반자동 흐름(설계 판단 1 참고).';

revoke execute on function public.find_possible_duplicate_consultations(text, text, uuid) from public;
grant execute on function public.find_possible_duplicate_consultations(text, text, uuid) to authenticated;

-- =========================================================================
-- 2. trial_sessions
-- =========================================================================
--
-- 자녀당 60분 체험 1회가 기본, 관리자가 예외 승인하면 2회 이상 허용
-- (exception_approved_by/exception_reason이 채워진 행은 partial unique index에서 제외).
-- 선생님 시급은 별도 체험 요율을 두지 않고 teacher_rate_history를 그대로 재사용한다
-- (확정 정책) — 이 테이블은 "누가 언제 어떤 과목을 가르쳤는가"만 기록하고, 실제
-- 정산 금액 계산은 payout 로직(기존 teacher_rate_history 조회)이 담당한다.
create table trial_sessions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations (id),
  child_id uuid not null references profiles (id),
  subject_id uuid not null references subjects (id),
  teacher_id uuid not null references profiles (id),

  scheduled_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes = 60),

  status v3_trial_status not null default 'scheduled',
  completed_at timestamptz,
  result_notes text,
  -- 체험 선생님이 기본적으로 정규 선생님이 되지만(확정 정책), 과목 단위 선생님
  -- 교체는 허용된다(R5 subject_enrollments/teacher_assignments 영역) — 여기서는
  -- "체험 결과 어떤 선생님을 추천하는가"만 남기고 실제 배정 로직은 만들지 않는다.
  recommended_teacher_id uuid references profiles (id),
  recommendation text,

  -- 당일 취소/노쇼면 해당 체험은 선생님 정산 대상에서 제외한다(확정 정책). 실제
  -- payout 쿼리가 이 플래그로 필터링한다 — payout 로직 자체는 이번 범위 밖.
  payable boolean not null default true,
  cancellation_reason text,

  exception_approved_by uuid references profiles (id),
  exception_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on trial_sessions (consultation_id);
create index on trial_sessions (child_id);
create index on trial_sessions (teacher_id);
create index on trial_sessions (subject_id);

-- 불변: exception이 승인되지 않은 한, 자녀당 "진행 중/완료" 체험은 1개.
-- (취소/노쇼 상태는 카운트하지 않는다 — 재예약이 자연스럽게 가능해야 한다.)
create unique index trial_sessions_one_active_per_child
  on trial_sessions (child_id)
  where (status in ('scheduled', 'completed') and exception_approved_by is null);

comment on table trial_sessions is
  'R3: 상담→체험 단계. 자녀당 60분 체험 1회 기본(exception_approved_by로 관리자 예외 승인 시 추가 허용). '
  '선생님 요율은 teacher_rate_history 재사용, 당일취소/노쇼는 payable=false로 정산 제외 표시.';

-- =========================================================================
-- 3. proposals
-- =========================================================================
--
-- contract_versions와 같은 버전 관리 패턴(version_number + supersedes)을 쓰되,
-- 이 단계는 아직 정식 계약이 아니므로 contract_versions처럼 완전한 상태 기계는
-- 두지 않는다(확정 정책: "심플하게 유지").
create table proposals (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations (id),
  trial_session_id uuid references trial_sessions (id),

  version_number int not null default 1,
  supersedes_proposal_id uuid references proposals (id),

  status v3_proposal_status not null default 'draft',

  -- 과목/선생님/회차수/가격 추천안. 계약(§4 참고)과 달리 정식 확정 전 초안이라
  -- 조인·활성화 로직이 필요 없어 jsonb로 충분하다고 판단(설계 판단 2, 계약
  -- 쪽과의 비대칭은 §4 코멘트에서 이유를 설명).
  recommended_subjects jsonb not null default '[]'::jsonb,
  recommended_teacher_id uuid references profiles (id),
  recommended_session_count int,
  price_summary jsonb,

  sent_at timestamptz,
  responded_at timestamptz,

  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (consultation_id, version_number)
);
create index on proposals (consultation_id);
create index on proposals (trial_session_id);
create index on proposals (supersedes_proposal_id);

comment on table proposals is
  'R3: 체험 이후 제안서. 계약처럼 완전한 상태 기계가 필요 없어 draft/sent/accepted/rejected/expired로 단순화(확정 정책). '
  'version_number + supersedes_proposal_id로 재발송/수정 이력만 보존한다.';

-- =========================================================================
-- 4. contracts — 신규 컬럼(제안서 연결 + DocuSign 연동)
-- =========================================================================

alter table contracts add column proposal_id uuid references proposals (id);
alter table contracts add column docusign_envelope_id text;
alter table contracts add column docusign_envelope_status v3_docusign_envelope_status;
alter table contracts add column docusign_status_updated_at timestamptz;
create index on contracts (proposal_id);
create index on contracts (docusign_envelope_id) where (docusign_envelope_id is not null);

comment on column contracts.proposal_id is 'R3: 이 계약의 출발점이 된 제안서(nullable — 제안서 없이 바로 생성된 계약도 허용).';
comment on column contracts.docusign_envelope_id is 'R3: DocuSign 봉투 id. 서명 실행만 DocuSign이 담당하고, 계약 상태의 source of truth는 여전히 ALTON DB(status 컬럼)다.';
comment on column contracts.docusign_envelope_status is 'R3: DocuSign 쪽 봉투 상태 스냅샷(sent/delivered/completed/declined/voided). 계약 status 전이는 이 값을 트리거로 앱 코드가 별도로 수행한다(이번 마이그레이션은 스키마만).';

-- =========================================================================
-- 5. contract_version_subjects — 계약 버전의 과목별 라인 아이템
-- =========================================================================
--
-- 설계 판단 2(정규화 vs jsonb): contract_versions.price_policy_snapshot jsonb에
-- 과목별 내역을 몰아넣는 대신 정규화된 테이블로 분리한다. 이유: R5에서
-- subject_enrollments를 계약에서 활성화할 때 "이 계약 버전에 어떤 과목이
-- 몇 회 얼마에 포함됐는가"를 subject_id 기준으로 직접 JOIN/집계해야 하고,
-- jsonb 안에 묻히면 그때마다 파싱 로직을 다시 만들어야 한다. price_policy_snapshot은
-- 여전히 "그 버전 시점의 가격 정책 원문(공제, 프로모션 등 비정형 정보)"을 통째로
-- 보존하는 용도로 남기고, 쿼리 가능해야 하는 구조적 데이터(과목/회차수/금액)만
-- 이 테이블로 분리했다.
create table contract_version_subjects (
  id uuid primary key default gen_random_uuid(),
  contract_version_id uuid not null references contract_versions (id) on delete cascade,
  subject_id uuid not null references subjects (id),
  recommended_session_count int,
  price_minor bigint,
  currency text not null default 'KRW',
  created_at timestamptz not null default now(),
  unique (contract_version_id, subject_id)
);
create index on contract_version_subjects (subject_id);

comment on table contract_version_subjects is
  'R3: 계약 버전의 과목별 라인 아이템(정규화, 설계 판단 2 참고). price_policy_snapshot jsonb는 비정형 가격 정책 원문 보존용으로 그대로 유지.';

-- =========================================================================
-- 6. drive_artifacts
-- =========================================================================
--
-- 서명 완료 문서 등은 회사 Google Shared Drive에 저장된다(확정 정책) — 이
-- 테이블은 그 Drive 파일에 대한 ALTON DB 쪽 참조·동기화 상태만 갖는다.
-- sync_status는 기존 v3_drive_job_status(queued/processing/succeeded/
-- retryable_failed/manual_review)를 재사용해 "웹훅 누락·다운로드 실패·Drive
-- 저장 실패 재처리 및 정기 대조"(master-roadmap R3) 요구를 지원한다.
create table drive_artifacts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  drive_file_id text,
  artifact_type text not null, -- 예: 'signed_document', 'certificate_of_completion'
  sync_status v3_drive_job_status not null default 'queued',
  checksum text,
  size_bytes bigint,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on drive_artifacts (contract_id);
create index on drive_artifacts (sync_status);

comment on table drive_artifacts is
  'R3: 계약 관련 Google Shared Drive 산출물의 ALTON DB 쪽 참조·동기화 상태. 실제 Drive API 호출은 이 마이그레이션 범위 밖(R4+ 앱 코드).';

-- =========================================================================
-- 7. external_event_receipts — 범용 웹훅 idempotency
-- =========================================================================
--
-- provider는 'docusign' 외 향후 'stripe'(R4) 등도 담을 범용 테이블로 이름 짓는다
-- (DocuSign 전용 이름을 피함 — 확정 정책). service_role(웹훅 핸들러)만 쓰므로
-- authenticated/anon용 정책은 만들지 않는다 — service_role은 RLS를 우회한다.
create table external_event_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  payload jsonb,
  processed_at timestamptz,
  unique (provider, event_id)
);
create index on external_event_receipts (provider, processed_at);

comment on table external_event_receipts is
  'R3: 범용 웹훅 idempotency 테이블(provider, event_id) unique. DocuSign(R3)·Stripe(R4 예정) 등 공용. service_role 전용, RLS에 authenticated/anon 정책 없음.';

alter table external_event_receipts enable row level security;

-- =========================================================================
-- 8. RLS
-- =========================================================================

alter table consultations enable row level security;
alter table trial_sessions enable row level security;
alter table proposals enable row level security;
alter table contract_version_subjects enable row level security;
alter table drive_artifacts enable row level security;

-- consultations: 관리자/운영자(manage_consultations capability) 전체, 보호자/본인은
-- 자기 자녀 상담만(child_id가 아직 null인 가입 전 상담은 관리자만 볼 수 있다).
create policy "관리자/운영자/본인가족 조회" on consultations for select
  using (
    is_admin()
    or current_user_has_capability('manage_consultations')
    or (child_id is not null and (child_id = auth.uid() or is_household_guardian_of(child_id)))
  );
create policy "관리자/운영자 쓰기" on consultations for all
  using (is_admin() or current_user_has_capability('manage_consultations'))
  with check (is_admin() or current_user_has_capability('manage_consultations'));

create policy "관리자/운영자/본인가족 조회" on trial_sessions for select
  using (
    is_admin()
    or current_user_has_capability('manage_consultations')
    or child_id = auth.uid()
    or is_household_guardian_of(child_id)
  );
create policy "관리자/운영자 쓰기" on trial_sessions for all
  using (is_admin() or current_user_has_capability('manage_consultations'))
  with check (is_admin() or current_user_has_capability('manage_consultations'));

create policy "관리자/운영자/본인가족 조회" on proposals for select
  using (
    is_admin()
    or current_user_has_capability('manage_consultations')
    or exists (
      select 1 from consultations c
      where c.id = proposals.consultation_id
        and c.child_id is not null
        and (c.child_id = auth.uid() or is_household_guardian_of(c.child_id))
    )
  );
create policy "관리자/운영자 쓰기" on proposals for all
  using (is_admin() or current_user_has_capability('manage_consultations'))
  with check (is_admin() or current_user_has_capability('manage_consultations'));

create policy "관리자/운영자/본인가족 조회" on contract_version_subjects for select
  using (
    is_admin()
    or current_user_has_capability('manage_consultations')
    or exists (
      select 1 from contract_versions cv
      join contracts ct on ct.id = cv.contract_id
      where cv.id = contract_version_subjects.contract_version_id
        and (ct.child_id = auth.uid() or is_household_guardian_of(ct.child_id))
    )
  );
create policy "관리자/운영자 쓰기" on contract_version_subjects for all
  using (is_admin() or current_user_has_capability('manage_consultations'))
  with check (is_admin() or current_user_has_capability('manage_consultations'));

create policy "관리자/운영자/본인가족 조회" on drive_artifacts for select
  using (
    is_admin()
    or current_user_has_capability('manage_consultations')
    or exists (
      select 1 from contracts ct
      where ct.id = drive_artifacts.contract_id
        and (ct.child_id = auth.uid() or is_household_guardian_of(ct.child_id))
    )
  );
create policy "관리자/운영자 쓰기" on drive_artifacts for all
  using (is_admin() or current_user_has_capability('manage_consultations'))
  with check (is_admin() or current_user_has_capability('manage_consultations'));

-- Capability 이름 추가(기존 패턴, 자유 텍스트 — supervisor_capabilities에 관리자가
-- 직접 부여): manage_consultations(상담/체험/제안서/계약 부속 산출물 운영).
