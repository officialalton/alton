-- 2026-09-22(사용자 지시 + docs/superpowers/specs/2026-09-22-consultant-role-and-intake-design.md) —
-- "Household messenger: Read and reply" — 담당 컨설턴트가 담당 학생의 household
-- 메신저(문의)를 읽고 답장할 수 있게 한다. 새 문의를 여는 건 보호자/관리자만
-- 유지(스펙: 컨설턴트는 "assigned household" 메시지를 받고 답장 — 새로 열지 않음).
--
-- household과 컨설턴트 배정은 간접 연결이다: consultant_assignments는 student_id
-- 기준(20261447000000)이고, household_members에서 role='child'인 profile_id가
-- 학생이다 — 그래서 helper 함수로 한 번에 계산한다.

create or replace function public.is_assigned_consultant_of_household(p_household_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members hm
    join consultant_assignments ca on ca.student_id = hm.profile_id
    where hm.household_id = p_household_id
      and hm.role = 'child'
      and ca.consultant_id = auth.uid()
  );
$$;

comment on function public.is_assigned_consultant_of_household(uuid) is
  '2026-09-22 — 이 컨설턴트가 이 household의 학생(들) 중 하나를 담당하는지. 메신저 RLS 전용.';

-- household_messages.sender_role / household_message_reads.viewer_role에 'consultant' 추가.
alter table household_messages drop constraint if exists household_messages_sender_role_check;
alter table household_messages add constraint household_messages_sender_role_check
  check (sender_role in ('guardian', 'admin', 'consultant'));

alter table household_message_reads drop constraint if exists household_message_reads_viewer_role_check;
alter table household_message_reads add constraint household_message_reads_viewer_role_check
  check (viewer_role in ('guardian', 'admin', 'consultant'));

-- household_inquiries 조회: 담당 컨설턴트도 자기 household의 문의 목록을 볼 수 있다
-- (열기는 여전히 보호자/관리자만 — opened_by_role 체크 제약은 그대로 둔다).
create policy "담당 컨설턴트 조회" on household_inquiries for select using (
  is_assigned_consultant_of_household(household_id)
);

-- household_messages: 담당 컨설턴트는 읽고, 열린 문의에 한해 답장(sender_role='consultant')할 수 있다.
create policy "담당 컨설턴트 조회" on household_messages for select using (
  is_assigned_consultant_of_household(household_id)
);
create policy "담당 컨설턴트 작성" on household_messages for insert with check (
  sender_role = 'consultant' and sender_id = auth.uid()
  and is_assigned_consultant_of_household(household_id)
  and exists (select 1 from household_inquiries hi where hi.id = household_messages.inquiry_id and hi.status = 'open')
);

-- household_message_reads: 담당 컨설턴트 본인 읽음 기록.
create policy "담당 컨설턴트 조회2" on household_message_reads for select using (
  is_assigned_consultant_of_household(household_id)
);
create policy "담당 컨설턴트 기록" on household_message_reads for insert with check (
  viewer_role = 'consultant' and is_assigned_consultant_of_household(household_id)
);
create policy "담당 컨설턴트 갱신" on household_message_reads for update using (
  viewer_role = 'consultant' and is_assigned_consultant_of_household(household_id)
) with check (
  viewer_role = 'consultant' and is_assigned_consultant_of_household(household_id)
);
