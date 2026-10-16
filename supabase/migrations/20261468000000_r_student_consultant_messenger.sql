-- 2026-09-22(사용자 지시 — "컨설턴트는 학생이랑도 메신저 필요하긴 하겠네") —
-- 지금까지 household 메신저는 보호자<->관리자/컨설턴트만 오갔다. 학생 본인도
-- 같은 household 문의 스레드를 읽고 답장할 수 있게 한다(보호자와 동등한 권한 —
-- 새 문의를 열 수도, 답장할 수도 있다). household_members RLS(20260830080000)는
-- 이미 "profile_id = auth.uid()"로 학생 본인 행을 허용하므로, household_id 조회는
-- 컨설턴트 때와 달리 SECURITY DEFINER 없이 학생 세션 클라이언트로 직접 해도 된다.

alter table household_messages drop constraint if exists household_messages_sender_role_check;
alter table household_messages add constraint household_messages_sender_role_check
  check (sender_role in ('guardian', 'admin', 'consultant', 'student'));

alter table household_message_reads drop constraint if exists household_message_reads_viewer_role_check;
alter table household_message_reads add constraint household_message_reads_viewer_role_check
  check (viewer_role in ('guardian', 'admin', 'consultant', 'student'));

alter table household_inquiries drop constraint if exists household_inquiries_opened_by_role_check;
alter table household_inquiries add constraint household_inquiries_opened_by_role_check
  check (opened_by_role in ('guardian', 'admin', 'student'));

-- household_inquiries: 학생 본인도 조회·작성.
create policy "학생 본인 household 조회" on household_inquiries for select using (
  exists (
    select 1 from household_members hm
    where hm.household_id = household_inquiries.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'child'
  )
);
create policy "학생 본인 household 작성" on household_inquiries for insert with check (
  opened_by_role = 'student' and opened_by = auth.uid() and exists (
    select 1 from household_members hm
    where hm.household_id = household_inquiries.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'child'
  )
);

-- household_messages: 학생 본인도 조회·답장(열린 문의에 한해).
create policy "학생 본인 household 조회" on household_messages for select using (
  exists (
    select 1 from household_members hm
    where hm.household_id = household_messages.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'child'
  )
);
create policy "학생 본인 household 작성" on household_messages for insert with check (
  sender_role = 'student' and sender_id = auth.uid()
  and exists (
    select 1 from household_members hm
    where hm.household_id = household_messages.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'child'
  )
  and exists (select 1 from household_inquiries hi where hi.id = household_messages.inquiry_id and hi.status = 'open')
);

-- household_message_reads: 학생 본인 읽음 기록.
create policy "학생 본인 household 조회2" on household_message_reads for select using (
  exists (
    select 1 from household_members hm
    where hm.household_id = household_message_reads.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'child'
  )
);
create policy "학생 본인 household 기록" on household_message_reads for insert with check (
  viewer_role = 'student' and exists (
    select 1 from household_members hm
    where hm.household_id = household_message_reads.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'child'
  )
);
create policy "학생 본인 household 갱신" on household_message_reads for update using (
  viewer_role = 'student' and exists (
    select 1 from household_members hm
    where hm.household_id = household_message_reads.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'child'
  )
) with check (
  viewer_role = 'student' and exists (
    select 1 from household_members hm
    where hm.household_id = household_message_reads.household_id
      and hm.profile_id = auth.uid()
      and hm.role = 'child'
  )
);
