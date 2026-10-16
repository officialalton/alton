-- Additional attendees of a lesson (e.g. a sibling or relative joining). A customer's contract signature is not the
-- consent of every attendee, so the recording gate (lib/legal/recording-gate.ts) blocks capture while any flagged attendee
-- lacks a recorded notice or consent. Additive; no UI yet — rows are written by admin/service role only.
create table lesson_additional_attendees (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  relationship text check (relationship is null or char_length(relationship) <= 120),
  notice_given_at timestamptz,
  consent_recorded_at timestamptz,
  recorded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index on lesson_additional_attendees (session_id);

alter table lesson_additional_attendees enable row level security;
create policy "관리자 조회" on lesson_additional_attendees for select using (is_admin());
create policy "담당 선생님 조회" on lesson_additional_attendees for select
  using (exists (select 1 from sessions s where s.id = session_id and s.teacher_id = auth.uid()));
create policy "관리자 기록" on lesson_additional_attendees for insert with check (is_admin());
create policy "관리자 수정" on lesson_additional_attendees for update using (is_admin());

comment on table lesson_additional_attendees is
  '수업 추가 참석자. 고객 계약 서명은 모든 참석자의 동의가 아니므로, notice_given_at/consent_recorded_at이 비어 있으면 녹화·전사·AI 노트 게이트가 차단한다.';
