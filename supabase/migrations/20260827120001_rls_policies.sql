-- Alton Education — RLS policies (draft, for review)
-- Convention: 학생은 자기 데이터만, 선생님은 자기가 담당하는 학생 데이터만, 관리자는 전체.
-- 서버 사이드 코드(Next.js server actions/route handlers)는 SUPABASE_SECRET_KEY로 RLS를 우회해서 쓰는 게
-- 기본 경로이고, 여기 정책들은 (1) 클라이언트에서 직접 Supabase를 호출하는 경우와 (2) Realtime 구독의
-- 방어선 역할이다. 첫 초안이라 세부 조정은 003(auth-roles) 실제 로그인 테스트하면서 다듬을 것.

-- =========================================================================
-- 헬퍼 함수
-- =========================================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_guardian_of(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guardian_students gs
    where gs.student_id = p_student_id and gs.parent_id = auth.uid()
  );
$$;

create or replace function public.teaches_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments e
    where e.student_id = p_student_id and e.teacher_id = auth.uid() and e.status = 'active'
  );
$$;

-- 세션 하나가 특정 학생/선생님/학부모와 관련 있는지 (enrollment을 경유해서 확인)
create or replace function public.session_student_id(p_session_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select e.student_id from public.sessions s join public.enrollments e on e.id = s.enrollment_id
  where s.id = p_session_id;
$$;

create or replace function public.session_teacher_id(p_session_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select e.teacher_id from public.sessions s join public.enrollments e on e.id = s.enrollment_id
  where s.id = p_session_id;
$$;

create or replace function public.is_session_participant(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sessions s join public.enrollments e on e.id = s.enrollment_id
    where s.id = p_session_id and (e.student_id = auth.uid() or e.teacher_id = auth.uid())
  );
$$;

create or replace function public.is_session_related(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_session_participant(p_session_id)
    or public.is_guardian_of(public.session_student_id(p_session_id))
    or public.is_admin();
$$;

create or replace function public.is_enrollment_participant(p_enrollment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrollments e
    where e.id = p_enrollment_id and (e.student_id = auth.uid() or e.teacher_id = auth.uid())
  );
$$;

create or replace function public.is_enrollment_related(p_enrollment_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_enrollment_participant(p_enrollment_id)
    or public.is_admin()
    or exists (
      select 1 from public.enrollments e
      where e.id = p_enrollment_id and public.is_guardian_of(e.student_id)
    );
$$;

-- =========================================================================
-- 1. 인증 / 사용자
-- =========================================================================

alter table profiles enable row level security;
create policy "본인 프로필 조회" on profiles for select using (id = auth.uid() or is_admin());
create policy "본인 프로필 수정" on profiles for update using (id = auth.uid() or is_admin());
create policy "프로필 생성은 서버(트리거/서비스롤)에서만" on profiles for insert with check (is_admin());

alter table students enable row level security;
create policy "학생 본인/담당 선생님/보호자/관리자 조회" on students for select
  using (id = auth.uid() or teaches_student(id) or is_guardian_of(id) or is_admin());
create policy "학생 데이터 쓰기는 관리자만" on students for insert with check (is_admin());
create policy "학생 데이터 수정은 본인/관리자" on students for update using (id = auth.uid() or is_admin());

alter table parents enable row level security;
create policy "학부모 본인/관리자 조회" on parents for select using (id = auth.uid() or is_admin());
create policy "학부모 데이터 쓰기는 관리자만" on parents for insert with check (is_admin());
create policy "학부모 데이터 수정은 본인/관리자" on parents for update using (id = auth.uid() or is_admin());

alter table guardian_students enable row level security;
create policy "당사자/관리자 조회" on guardian_students for select
  using (parent_id = auth.uid() or student_id = auth.uid() or is_admin());
create policy "관리자만 생성/삭제" on guardian_students for all using (is_admin()) with check (is_admin());

alter table teachers enable row level security;
create policy "선생님 본인/관리자/담당학생/학부모 조회" on teachers for select
  using (
    id = auth.uid() or is_admin()
    or exists (select 1 from enrollments e where e.teacher_id = teachers.id and e.student_id = auth.uid())
    or exists (select 1 from enrollments e where e.teacher_id = teachers.id and is_guardian_of(e.student_id))
  );
create policy "선생님 데이터 쓰기는 관리자만" on teachers for insert with check (is_admin());
create policy "선생님 데이터 수정은 본인/관리자" on teachers for update using (id = auth.uid() or is_admin());

-- =========================================================================
-- 2. 상담 / 온보딩 — 계정 생성 전 단계라 기본적으로 관리자만 접근
-- =========================================================================

alter table consult_requests enable row level security;
create policy "관리자만 접근" on consult_requests for all using (is_admin()) with check (is_admin());

alter table consult_attachments enable row level security;
create policy "관리자만 접근" on consult_attachments for all using (is_admin()) with check (is_admin());

-- =========================================================================
-- 3. 계약
-- =========================================================================

alter table contracts enable row level security;
create policy "당사자/관리자 조회" on contracts for select
  using (parent_id = auth.uid() or student_id = auth.uid() or is_admin());
create policy "관리자만 쓰기" on contracts for insert with check (is_admin());
create policy "관리자만 수정" on contracts for update using (is_admin());

alter table teacher_contracts enable row level security;
create policy "당사자/관리자 조회" on teacher_contracts for select
  using (teacher_id = auth.uid() or is_admin());
create policy "관리자만 쓰기" on teacher_contracts for insert with check (is_admin());
create policy "관리자만 수정" on teacher_contracts for update using (is_admin());

-- =========================================================================
-- 5. 커리큘럼 (과목 템플릿은 전체 공개 읽기 — 단일 진실 소스라 모두가 참조)
-- =========================================================================

alter table subjects enable row level security;
create policy "인증된 사용자 전체 조회" on subjects for select using (auth.uid() is not null);
create policy "관리자만 쓰기" on subjects for all using (is_admin()) with check (is_admin());

alter table subject_template_units enable row level security;
create policy "인증된 사용자 전체 조회" on subject_template_units for select using (auth.uid() is not null);
create policy "관리자만 쓰기" on subject_template_units for all using (is_admin()) with check (is_admin());

alter table teacher_curriculum_templates enable row level security;
create policy "본인 선생님/관리자 조회" on teacher_curriculum_templates for select
  using (teacher_id = auth.uid() or is_admin());
create policy "본인 선생님/관리자 쓰기" on teacher_curriculum_templates for all
  using (teacher_id = auth.uid() or is_admin()) with check (teacher_id = auth.uid() or is_admin());

alter table teacher_curriculum_template_units enable row level security;
create policy "본인 선생님/관리자 조회" on teacher_curriculum_template_units for select
  using (
    is_admin()
    or exists (select 1 from teacher_curriculum_templates t where t.id = template_id and t.teacher_id = auth.uid())
  );
create policy "본인 선생님/관리자 쓰기" on teacher_curriculum_template_units for all
  using (
    is_admin()
    or exists (select 1 from teacher_curriculum_templates t where t.id = template_id and t.teacher_id = auth.uid())
  )
  with check (
    is_admin()
    or exists (select 1 from teacher_curriculum_templates t where t.id = template_id and t.teacher_id = auth.uid())
  );

-- =========================================================================
-- 4. 매칭 / 등록
-- =========================================================================

alter table enrollments enable row level security;
create policy "당사자/보호자/관리자 조회" on enrollments for select
  using (student_id = auth.uid() or teacher_id = auth.uid() or is_guardian_of(student_id) or is_admin());
create policy "관리자만 쓰기" on enrollments for insert with check (is_admin());
create policy "당사자/관리자 수정" on enrollments for update
  using (teacher_id = auth.uid() or is_admin());

-- =========================================================================
-- 8. 교재(curriculum_docs)
-- =========================================================================

alter table curriculum_docs enable row level security;
create policy "배포된 문서는 전체, 초안은 작성자/관리자만" on curriculum_docs for select
  using (status = 'published' or owner_teacher_id = auth.uid() or is_admin());
create policy "관리자/선생님 생성" on curriculum_docs for insert
  with check (is_admin() or owner_teacher_id = auth.uid());
create policy "작성자/관리자 수정" on curriculum_docs for update
  using (owner_teacher_id = auth.uid() or is_admin());

alter table curriculum_doc_sections enable row level security;
create policy "상위 문서 규칙 상속" on curriculum_doc_sections for select
  using (exists (
    select 1 from curriculum_docs d where d.id = curriculum_doc_id
      and (d.status = 'published' or d.owner_teacher_id = auth.uid() or is_admin())
  ));
create policy "작성자/관리자 쓰기" on curriculum_doc_sections for all
  using (exists (
    select 1 from curriculum_docs d where d.id = curriculum_doc_id
      and (d.owner_teacher_id = auth.uid() or is_admin())
  ))
  with check (exists (
    select 1 from curriculum_docs d where d.id = curriculum_doc_id
      and (d.owner_teacher_id = auth.uid() or is_admin())
  ));

alter table curriculum_doc_adoptions enable row level security;
create policy "본인/관리자" on curriculum_doc_adoptions for all
  using (teacher_id = auth.uid() or is_admin()) with check (teacher_id = auth.uid() or is_admin());

alter table curriculum_doc_versions enable row level security;
create policy "작성자/관리자 조회" on curriculum_doc_versions for select
  using (exists (
    select 1 from curriculum_docs d where d.id = curriculum_doc_id
      and (d.owner_teacher_id = auth.uid() or is_admin())
  ));
create policy "관리자만 쓰기" on curriculum_doc_versions for insert with check (is_admin());

alter table subject_template_unit_materials enable row level security;
create policy "인증된 사용자 조회" on subject_template_unit_materials for select using (auth.uid() is not null);
create policy "관리자만 쓰기" on subject_template_unit_materials for all using (is_admin()) with check (is_admin());

alter table teacher_curriculum_template_unit_materials enable row level security;
create policy "본인 선생님/관리자" on teacher_curriculum_template_unit_materials for all
  using (
    is_admin()
    or exists (
      select 1 from teacher_curriculum_template_units u
      join teacher_curriculum_templates t on t.id = u.template_id
      where u.id = unit_id and t.teacher_id = auth.uid()
    )
  );

-- =========================================================================
-- 6. 수업 세션
-- =========================================================================

alter table sessions enable row level security;
create policy "당사자/보호자/관리자 조회" on sessions for select using (is_session_related(id));
create policy "관리자만 생성" on sessions for insert with check (is_admin());
create policy "당사자(주로 선생님)/관리자 수정" on sessions for update using (is_session_participant(id) or is_admin());

alter table session_memos enable row level security;
create policy "관련자 조회" on session_memos for select using (is_enrollment_related(enrollment_id));
create policy "당사자/관리자 작성" on session_memos for insert
  with check (is_enrollment_participant(enrollment_id) or is_admin());

alter table makeup_credits enable row level security;
create policy "당사자/관리자 조회" on makeup_credits for select
  using (student_id = auth.uid() or teacher_id = auth.uid() or is_admin());
create policy "관리자만 쓰기" on makeup_credits for all using (is_admin()) with check (is_admin());

alter table teacher_qc_warnings enable row level security;
create policy "관리자만 접근" on teacher_qc_warnings for all using (is_admin()) with check (is_admin());

-- =========================================================================
-- 7. 세션뷰 기능별 데이터
-- =========================================================================

alter table problems enable row level security;
create policy "확정된 문제는 관련 세션 참여자, 초안은 작성자/관리자" on problems for select
  using (
    is_admin()
    or created_by = auth.uid()
    or (status = 'confirmed' and (origin_session_id is null or is_session_related(origin_session_id)))
  );
create policy "선생님/관리자 생성" on problems for insert with check (is_admin() or created_by = auth.uid());
create policy "작성자/관리자 수정" on problems for update using (created_by = auth.uid() or is_admin());

alter table homework_items enable row level security;
create policy "관련자 조회" on homework_items for select using (is_session_related(session_id));
create policy "선생님/관리자 생성" on homework_items for insert
  with check (is_session_participant(session_id) or is_admin());
create policy "학생(답안)/선생님/관리자 수정" on homework_items for update
  using (is_session_participant(session_id) or is_admin());

alter table session_problem_attempts enable row level security;
create policy "본인 학생/담당 선생님/보호자/관리자 조회" on session_problem_attempts for select
  using (student_id = auth.uid() or teaches_student(student_id) or is_guardian_of(student_id) or is_admin());
create policy "본인 학생 작성" on session_problem_attempts for insert
  with check (student_id = auth.uid() or is_admin());
create policy "본인 학생 수정(저장 토글 등)" on session_problem_attempts for update
  using (student_id = auth.uid() or is_admin());

alter table teacher_problem_tags enable row level security;
create policy "관련 선생님/관리자" on teacher_problem_tags for all
  using (teacher_id = auth.uid() or is_admin()) with check (teacher_id = auth.uid() or is_admin());

alter table vocab_words enable row level security;
create policy "본인 학생/담당 선생님/보호자/관리자 조회" on vocab_words for select
  using (student_id = auth.uid() or teaches_student(student_id) or is_guardian_of(student_id) or is_admin());
create policy "본인 학생 쓰기" on vocab_words for all
  using (student_id = auth.uid() or is_admin()) with check (student_id = auth.uid() or is_admin());

alter table session_doc_links enable row level security;
create policy "관련자 조회" on session_doc_links for select using (is_session_related(session_id));
create policy "선생님/관리자 쓰기" on session_doc_links for all
  using (is_session_participant(session_id) or is_admin())
  with check (is_session_participant(session_id) or is_admin());

alter table session_files enable row level security;
create policy "관련자 조회" on session_files for select using (is_session_related(session_id));
create policy "참여자 업로드" on session_files for insert with check (is_session_participant(session_id) or is_admin());
create policy "본인이 올린 파일만 삭제" on session_files for delete
  using (uploaded_by_id = auth.uid() or is_admin());

alter table canvas_annotations enable row level security;
create policy "관련자 조회" on canvas_annotations for select using (is_session_related(session_id));
create policy "참여자 쓰기" on canvas_annotations for all
  using (is_session_participant(session_id) or is_admin())
  with check (is_session_participant(session_id) or is_admin());

-- =========================================================================
-- 9. 수업 리뷰
-- =========================================================================

alter table session_reviews enable row level security;
create policy "관련자 조회" on session_reviews for select using (is_session_related(session_id));
create policy "담당 선생님/관리자 쓰기" on session_reviews for all
  using (session_teacher_id(session_id) = auth.uid() or is_admin())
  with check (session_teacher_id(session_id) = auth.uid() or is_admin());

alter table session_review_categories enable row level security;
create policy "관련자 조회" on session_review_categories for select
  using (exists (select 1 from session_reviews r where r.id = review_id and is_session_related(r.session_id)));
create policy "담당 선생님/관리자 쓰기" on session_review_categories for all
  using (exists (
    select 1 from session_reviews r where r.id = review_id
      and (session_teacher_id(r.session_id) = auth.uid() or is_admin())
  ));

alter table session_review_revisions enable row level security;
create policy "관련자 조회" on session_review_revisions for select using (is_session_related(session_id));
create policy "관리자만 쓰기" on session_review_revisions for insert with check (is_admin());

alter table session_student_feedback enable row level security;
create policy "관련자 조회" on session_student_feedback for select using (is_session_related(session_id));
create policy "본인 학생 쓰기" on session_student_feedback for all
  using (student_id = auth.uid() or is_admin()) with check (student_id = auth.uid() or is_admin());

-- =========================================================================
-- 10. 메시징 / 알림
-- =========================================================================

alter table chat_threads enable row level security;
create policy "당사자/관리자 조회" on chat_threads for select
  using (student_id = auth.uid() or teacher_id = auth.uid() or is_admin());
create policy "당사자/관리자 생성" on chat_threads for insert
  with check (student_id = auth.uid() or teacher_id = auth.uid() or is_admin());

alter table chat_messages enable row level security;
create policy "스레드 당사자/관리자 조회" on chat_messages for select
  using (exists (
    select 1 from chat_threads t where t.id = thread_id
      and (t.student_id = auth.uid() or t.teacher_id = auth.uid() or is_admin())
  ));
create policy "스레드 당사자 전송" on chat_messages for insert
  with check (exists (
    select 1 from chat_threads t where t.id = thread_id
      and (t.student_id = auth.uid() or t.teacher_id = auth.uid())
  ));

alter table parent_requests enable row level security;
create policy "당사자/관리자 조회" on parent_requests for select
  using (parent_id = auth.uid() or teacher_id = auth.uid() or is_admin());
create policy "본인 학부모 작성" on parent_requests for insert with check (parent_id = auth.uid() or is_admin());
create policy "관리자 처리" on parent_requests for update using (is_admin());

alter table notifications enable row level security;
create policy "본인 조회" on notifications for select using (recipient_id = auth.uid() or is_admin());
create policy "본인 읽음처리" on notifications for update using (recipient_id = auth.uid() or is_admin());
create policy "관리자/서버 생성" on notifications for insert with check (is_admin());

-- =========================================================================
-- 11. 결제 / 크레딧
-- =========================================================================

alter table credit_packages enable row level security;
create policy "인증된 사용자 전체 조회" on credit_packages for select using (auth.uid() is not null);
create policy "관리자만 쓰기" on credit_packages for all using (is_admin()) with check (is_admin());

alter table credit_purchases enable row level security;
create policy "본인/보호자/관리자 조회" on credit_purchases for select
  using (student_id = auth.uid() or is_guardian_of(student_id) or is_admin());
create policy "관리자/서버 생성" on credit_purchases for insert with check (is_admin());

alter table credit_transactions enable row level security;
create policy "본인/보호자/관리자 조회" on credit_transactions for select
  using (student_id = auth.uid() or is_guardian_of(student_id) or is_admin());
create policy "관리자/서버 생성" on credit_transactions for insert with check (is_admin());

alter table payment_methods enable row level security;
create policy "본인 학부모/관리자 접근" on payment_methods for all
  using (parent_id = auth.uid() or is_admin()) with check (parent_id = auth.uid() or is_admin());

-- =========================================================================
-- 12. 정산
-- =========================================================================

alter table teacher_payouts enable row level security;
create policy "본인 선생님/관리자 조회" on teacher_payouts for select
  using (teacher_id = auth.uid() or is_admin());
create policy "관리자만 쓰기" on teacher_payouts for insert with check (is_admin());
create policy "관리자만 수정" on teacher_payouts for update using (is_admin());

-- =========================================================================
-- 13. 관리자 내부
-- =========================================================================

alter table company_documents enable row level security;
create policy "관리자만 접근" on company_documents for all using (is_admin()) with check (is_admin());
