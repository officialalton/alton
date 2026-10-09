-- R12(상담 신청·메신저 V1) — docs/2026-09-17-parent-admin-support-spec.md.
-- 제품 오너 결정: R11(household_messages, meeting_requests)을 신규 테이블로
-- 중복 생성하지 않고 확장한다. 기존 데이터·RLS 구조·UAT 이력은 보존한다.
--
-- 변경 내용:
--  1. meeting_requests: 상담 신청에 필요한 필드(내용, 연락 방식·시간대) 추가,
--     status를 5단계(requested→confirming→scheduling→scheduled→completed)로
--     확장(cancelled는 기존 데이터 보존을 위해 유지, 신규 UI에서는 노출 안 함).
--  2. meeting_request_messages — 상담 신청 건별 대화(스펙 §"상담 신청 상세에도
--     해당 상담 건의 대화가 이어질 수 있다"). household_messages(메신저)와는
--     별도 스레드.
--  3. household_message_reads — 메신저(household_messages) 읽음 추적, household
--     단위로 역할(guardian/admin)별 last_read_at을 저장해 안 읽은 메시지 수를
--     계산한다.

-- =========================================================================
-- 1. meeting_requests 확장
-- =========================================================================
alter table meeting_requests
  add column if not exists content text,
  add column if not exists contact_preference text check (contact_preference in ('phone', 'message', 'either')),
  add column if not exists preferred_contact_time text;

comment on column meeting_requests.subject is 'R12: 상담 주제.';
comment on column meeting_requests.content is 'R12: 상담 내용(학부모 작성).';
comment on column meeting_requests.contact_preference is 'R12: 희망 연락 방식(phone|message|either).';
comment on column meeting_requests.preferred_contact_time is 'R12: 희망 연락 시간대(자유 텍스트, 예: "평일 오후").';

alter table meeting_requests drop constraint if exists meeting_requests_status_check;
alter table meeting_requests add constraint meeting_requests_status_check check (
  status in ('requested', 'confirming', 'scheduling', 'scheduled', 'completed', 'cancelled')
);
comment on table meeting_requests is
  'R11/R12: 상담 신청(구 "면담"). 상태: requested(신청됨)→confirming(확인 중)→scheduling(일정 조율 중)→scheduled(일정 확정)→completed(완료). cancelled는 기존 데이터 보존용.';

-- =========================================================================
-- 2. meeting_request_messages — 상담 신청 건별 대화
-- =========================================================================
create table meeting_request_messages (
  id uuid primary key default gen_random_uuid(),
  meeting_request_id uuid not null references meeting_requests (id) on delete cascade,
  sender_id uuid not null references profiles (id),
  sender_role text not null check (sender_role in ('guardian', 'admin')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index on meeting_request_messages (meeting_request_id, created_at);

comment on table meeting_request_messages is
  'R12: 상담 신청(meeting_requests) 건별 대화. household_messages(일반 메신저)와 별도 스레드.';

alter table meeting_request_messages enable row level security;

create policy "관리자 전체 조회" on meeting_request_messages for select using (is_admin());
create policy "보호자 본인 household 조회" on meeting_request_messages for select using (
  exists (
    select 1 from meeting_requests mr
    join household_members hm on hm.household_id = mr.household_id
    where mr.id = meeting_request_messages.meeting_request_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);
create policy "관리자 작성" on meeting_request_messages for insert with check (
  is_admin() and sender_role = 'admin' and sender_id = auth.uid()
);
create policy "보호자 본인 household 작성" on meeting_request_messages for insert with check (
  sender_role = 'guardian' and sender_id = auth.uid() and exists (
    select 1 from meeting_requests mr
    join household_members hm on hm.household_id = mr.household_id
    where mr.id = meeting_request_messages.meeting_request_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);

-- =========================================================================
-- 3. household_message_reads — 메신저 읽음 추적(안 읽은 메시지 수 계산용)
-- =========================================================================
create table household_message_reads (
  household_id uuid not null references households (id) on delete cascade,
  viewer_role text not null check (viewer_role in ('guardian', 'admin')),
  last_read_at timestamptz not null default now(),
  primary key (household_id, viewer_role)
);

comment on table household_message_reads is
  'R12: household_messages(메신저) 읽음 추적. household당 역할(guardian|admin)별 last_read_at 1행 — 다인 가구/다인 관리자는 v1에서 역할 단위로 공유한다.';

alter table household_message_reads enable row level security;

create policy "관리자 전체 조회" on household_message_reads for select using (is_admin());
create policy "보호자 본인 household 조회" on household_message_reads for select using (
  exists (
    select 1 from household_members hm
    where hm.household_id = household_message_reads.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);
create policy "관리자 본인 role 기록" on household_message_reads for insert with check (
  is_admin() and viewer_role = 'admin'
);
create policy "관리자 본인 role 갱신" on household_message_reads for update using (is_admin() and viewer_role = 'admin') with check (is_admin() and viewer_role = 'admin');
create policy "보호자 본인 household 기록" on household_message_reads for insert with check (
  viewer_role = 'guardian' and exists (
    select 1 from household_members hm
    where hm.household_id = household_message_reads.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);
create policy "보호자 본인 household 갱신" on household_message_reads for update using (
  viewer_role = 'guardian' and exists (
    select 1 from household_members hm
    where hm.household_id = household_message_reads.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
) with check (
  viewer_role = 'guardian' and exists (
    select 1 from household_members hm
    where hm.household_id = household_message_reads.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'guardian'
  )
);
