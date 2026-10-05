-- =========================================================================
-- 2026-10-05 무료 학습 회원 S2 — 과외 기능 DB 가드
-- docs/briefs/2026-10-05-free-member-tutoring-design.md §3.1·§5.1(…0002)
--
--   1) has_tutoring_access 축소: 과외 회원 AND 살아 있는 과외 관계(활성 v3 수강 ∨ 유효 수업권 ∨
--      레거시 활성 enrollment ∨ 체험 온보딩으로 생성된 계정 ∨ status=pending 온보딩 고객).
--      S1의 "household 소속만으로 과외 권한" 절을 뺐다 — 계약 종료 뒤에는 과외 키만 빠지고
--      무료/공통 키는 남는다(과거 이력 읽기는 RLS "과거 열람 허용" 그대로).
--   2) 학생 자기서비스 쓰기 정책(pg_policies에서 cmd<>SELECT, auth.uid() 본인 기준, 학생이 쓰는 테이블)
--      에 `not is_free_member(auth.uid())` 추가. 대상(2026-10-05 로컬 DB 열거):
--        chat_threads "당사자/관리자 생성", chat_messages "스레드 당사자 전송",
--        household_inquiries/household_messages "학생 본인 household 작성",
--        meeting_requests "학생 본인 신청", parent_requests "본인 학부모/자녀→보호자 작성",
--        session_memos "당사자/관리자 작성", 로드맵 전 테이블(_roadmap_can_write 본인 분기).
--      기존 정책은 전부 관계 기반이라 household·선생님이 없는 무료 회원은 이미 막히지만, 근거를
--      회원 유형으로도 고정한다(브리프 §2.1 "메뉴·서버·DB 근거 일치").
--      학생이 실행 가능한 security definer RPC 중 과외 전용(list_open_consultant_meeting_slots,
--      get_lesson_reviews_for_family 등)은 consultant_assignments/household 관계를 이미 요구하므로
--      그대로 둔다(통합 테스트로 무료 회원 거절을 고정).
-- =========================================================================

-- 1) has_tutoring_access 축소 -------------------------------------------------------
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
        or exists (select 1 from enrollments e where e.student_id = s.id and e.status = 'active')
        or exists (select 1 from trial_onboarding_link_students t where t.child_auth_user_id = s.id and t.status = 'created')
      )
  );
$$;
revoke execute on function public.has_tutoring_access(uuid) from public, anon;
grant execute on function public.has_tutoring_access(uuid) to authenticated;
comment on function public.has_tutoring_access(uuid) is
  '2026-10-05 S2 — 과외 회원이면서 활성 과외 관계가 있을 때만 true(household 소속만으로는 false). 계약 종료 → 과외 키만 소멸.';

-- 2) 학생 자기서비스 쓰기 정책 ----------------------------------------------------------
drop policy if exists "당사자/관리자 생성" on chat_threads;
create policy "당사자/관리자 생성" on chat_threads for insert
  with check (
    (student_id = auth.uid() and not is_free_member(auth.uid()))
    or teacher_id = auth.uid()
    or is_admin()
  );

drop policy if exists "스레드 당사자 전송" on chat_messages;
create policy "스레드 당사자 전송" on chat_messages for insert
  with check (
    exists (
      select 1 from chat_threads t
      where t.id = chat_messages.thread_id
        and ((t.student_id = auth.uid() and not is_free_member(auth.uid())) or t.teacher_id = auth.uid())
    )
    and current_account_access_allowed()
  );

drop policy if exists "학생 본인 household 작성" on household_inquiries;
create policy "학생 본인 household 작성" on household_inquiries for insert
  with check (
    opened_by_role = 'student' and opened_by = auth.uid()
    and not is_free_member(auth.uid())
    and exists (
      select 1 from household_members hm
      where hm.household_id = household_inquiries.household_id and hm.profile_id = auth.uid() and hm.role = 'child'
    )
  );

drop policy if exists "학생 본인 household 작성" on household_messages;
create policy "학생 본인 household 작성" on household_messages for insert
  with check (
    sender_role = 'student' and sender_id = auth.uid()
    and not is_free_member(auth.uid())
    and exists (
      select 1 from household_members hm
      where hm.household_id = household_messages.household_id and hm.profile_id = auth.uid() and hm.role = 'child'
    )
    and exists (select 1 from household_inquiries hi where hi.id = household_messages.inquiry_id and hi.status = 'open')
  );

drop policy if exists "학생 본인 신청" on meeting_requests;
create policy "학생 본인 신청" on meeting_requests for insert
  with check (
    requested_by = auth.uid() and child_id = auth.uid()
    and not is_free_member(auth.uid())
    and (starts_at is null or consultant_id is not null)
    and (consultant_id is null or exists (
      select 1 from consultant_assignments ca where ca.student_id = auth.uid() and ca.consultant_id = meeting_requests.consultant_id
    ))
  );

drop policy if exists "본인 학부모/자녀→보호자 작성" on parent_requests;
create policy "본인 학부모/자녀→보호자 작성" on parent_requests for insert
  with check (
    parent_id = auth.uid()
    or is_admin()
    or (
      not is_free_member(auth.uid())
      and exists (select 1 from guardian_students gs where gs.parent_id = parent_requests.parent_id and gs.student_id = auth.uid())
    )
  );

drop policy if exists "당사자/관리자 작성" on session_memos;
create policy "당사자/관리자 작성" on session_memos for insert
  with check (
    (is_enrollment_participant(enrollment_id) and current_account_access_allowed() and not is_free_member(auth.uid()))
    or is_admin()
  );

-- 로드맵(student_academic_profile, student_college_interests, student_roadmap_milestones, student_test_records,
-- student_courses, student_demographics, student_activities, student_awards, student_prep_items, student_ap_*)
-- 쓰기 정책은 전부 _roadmap_can_write(student_id)를 쓴다 — 본인 분기만 회원 유형으로 제한(결정 7-13: 1차 불허).
create or replace function public._roadmap_can_write(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select (p_student_id = auth.uid() and not is_free_member(auth.uid()))
    or is_guardian_of(p_student_id)
    or is_assigned_consultant_of(p_student_id)
    or is_admin();
$$;
