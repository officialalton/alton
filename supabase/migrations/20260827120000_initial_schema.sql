-- Alton Education — initial schema
-- Source of truth for design decisions: docs/spec/schema-draft.md (reviewed & approved)
-- gen_random_uuid() is built into Postgres 13+ (Supabase default), no extension needed.

-- =========================================================================
-- ENUMS
-- =========================================================================

create type profile_role as enum ('student', 'parent', 'teacher', 'admin');
create type intake_type as enum ('A', 'B', 'C', 'D', 'E');
create type student_status as enum ('active', 'pending', 'inactive');
create type teacher_status as enum ('active', 'pending');
create type guardian_relation as enum ('모', '부', '기타');
create type consult_category as enum ('family', 'teacher_applicant');
create type consult_status as enum ('requested', 'confirmed', 'completed');
create type contract_status as enum ('sent', 'signed');
create type enrollment_status as enum ('active', 'cancelled');
create type session_status as enum ('upcoming', 'completed', 'cancelled', 'no_show');
create type problem_format as enum ('mc', 'essay', 'math');
create type problem_difficulty as enum ('easy', 'medium', 'hard');
create type problem_status as enum ('draft', 'confirmed');
create type review_category as enum ('concept', 'problemsolving', 'participation', 'homework');
create type doc_owner_type as enum ('admin', 'teacher');
create type doc_status as enum ('draft', 'pending_approval', 'published', 'rejected');
create type teacher_student_role as enum ('teacher', 'student');
create type author_role as enum ('teacher', 'student', 'admin');
create type teacher_pick_reason as enum ('단어', '로직', '해석', '기타');
create type parent_request_status as enum ('open', 'resolved');
create type credit_tx_type as enum ('purchase', 'debit', 'refund', 'adjustment', 'referral_bonus');
create type payout_status as enum ('pending', 'approved', 'paid');
create type company_doc_category as enum ('법인설립', '계좌정보', '세무', '계약템플릿', '기타');

-- =========================================================================
-- 1. 인증 / 사용자
-- =========================================================================

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role profile_role not null,
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key references profiles (id) on delete cascade,
  grade text,
  intake_type intake_type,
  status student_status not null default 'active',
  credit_balance int not null default 0,
  joined_at timestamptz not null default now()
);

create table parents (
  id uuid primary key references profiles (id) on delete cascade,
  referral_code text unique,
  location text,
  joined_at timestamptz not null default now()
);

create table guardian_students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  relation_type guardian_relation not null,
  is_primary boolean not null default false,
  unique (parent_id, student_id)
);
create index on guardian_students (student_id);

create table teachers (
  id uuid primary key references profiles (id) on delete cascade,
  school text,
  bio text,
  status teacher_status not null default 'pending',
  joined_at timestamptz not null default now()
);

-- =========================================================================
-- 2. 상담 / 온보딩
-- =========================================================================

create table consult_requests (
  id uuid primary key default gen_random_uuid(),
  category consult_category not null,
  person_name text not null,
  email text not null,
  phone text,
  student_grade text,
  intake_type intake_type,
  concerns text,
  submitted_at timestamptz not null default now(),
  status consult_status not null default 'requested',
  scheduled_at timestamptz,
  meeting_link text,
  meeting_notes text,
  completed_at timestamptz,
  converted_student_id uuid references students (id) on delete set null,
  converted_parent_id uuid references parents (id) on delete set null,
  calendly_event_uri text
);
create index on consult_requests (converted_student_id);
create index on consult_requests (converted_parent_id);

create table consult_attachments (
  id uuid primary key default gen_random_uuid(),
  consult_request_id uuid not null references consult_requests (id) on delete cascade,
  filename text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);
create index on consult_attachments (consult_request_id);

-- =========================================================================
-- 3. 계약
-- =========================================================================

create table contracts (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents (id),
  student_id uuid not null references students (id),
  docusign_envelope_id text,
  status contract_status not null default 'sent',
  signed_at timestamptz,
  document_url text
);
create index on contracts (parent_id);
create index on contracts (student_id);

create table teacher_contracts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id),
  doc_type text not null,
  docusign_envelope_id text,
  status contract_status not null default 'sent',
  signed_at timestamptz,
  document_url text
);
create index on teacher_contracts (teacher_id);

-- =========================================================================
-- 5. 커리큘럼 — 3단 구조 (과목 템플릿 → 선생님 개인 템플릿 → 학생 배정)
-- subjects는 enrollments가 참조하므로 먼저 정의한다.
-- =========================================================================

create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table subject_template_units (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects (id) on delete cascade,
  position int not null,
  unit_title text not null,
  note text,
  unique (subject_id, position)
);
create index on subject_template_units (subject_id);

create table teacher_curriculum_templates (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id) on delete cascade,
  subject_id uuid not null references subjects (id),
  created_at timestamptz not null default now(),
  unique (teacher_id, subject_id)
);
create index on teacher_curriculum_templates (subject_id);

create table teacher_curriculum_template_units (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references teacher_curriculum_templates (id) on delete cascade,
  position int not null,
  unit_title text not null,
  note text,
  teacher_comment text,
  unique (template_id, position)
);

-- =========================================================================
-- 4. 매칭 / 등록 (매칭 = 커리큘럼 진행 요약을 겸함)
-- =========================================================================

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  teacher_id uuid not null references teachers (id),
  subject_id uuid not null references subjects (id),
  status enrollment_status not null default 'active',
  total_sessions int not null default 0,
  current_session int not null default 1,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index on enrollments (student_id);
create index on enrollments (teacher_id);
create index on enrollments (subject_id);
-- 활성 매칭은 (student, teacher, subject) 조합당 하나만 (소프트 삭제 상태는 재매칭 가능하도록 status 포함하지 않고 부분 unique index로 제한)
create unique index enrollments_active_unique
  on enrollments (student_id, teacher_id, subject_id)
  where (status = 'active');

-- =========================================================================
-- 8. 교재(curriculum_docs) — 세션과 무관한 콘텐츠 레이어
-- sessions/problems가 참조하므로 먼저 정의한다.
-- =========================================================================

create table curriculum_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject_id uuid not null references subjects (id),
  unit_id uuid references subject_template_units (id) on delete set null,
  owner_type doc_owner_type not null,
  owner_teacher_id uuid references teachers (id),
  status doc_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on curriculum_docs (subject_id);
create index on curriculum_docs (owner_teacher_id);

create table curriculum_doc_sections (
  id uuid primary key default gen_random_uuid(),
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  position int not null,
  title text not null,
  body text,
  teaching_tip text,
  unique (curriculum_doc_id, position)
);

create table curriculum_doc_adoptions (
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  teacher_id uuid not null references teachers (id) on delete cascade,
  adopted_at timestamptz not null default now(),
  primary key (curriculum_doc_id, teacher_id)
);

create table curriculum_doc_versions (
  id uuid primary key default gen_random_uuid(),
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  version_number int not null,
  snapshot jsonb not null,
  ai_assisted boolean not null default false,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (curriculum_doc_id, version_number)
);

-- 과목 템플릿 / 선생님 개인 템플릿의 단원 ↔ 교재 추천 자료 연결 (N:M)
create table subject_template_unit_materials (
  unit_id uuid not null references subject_template_units (id) on delete cascade,
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  primary key (unit_id, curriculum_doc_id)
);

create table teacher_curriculum_template_unit_materials (
  unit_id uuid not null references teacher_curriculum_template_units (id) on delete cascade,
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  primary key (unit_id, curriculum_doc_id)
);

-- =========================================================================
-- 6. 수업 세션 — 이 앱의 핵심 테이블
-- =========================================================================

create table sessions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments (id) on delete cascade,
  session_number int not null,
  unit_title text,
  source_template_unit_id uuid references teacher_curriculum_template_units (id) on delete set null,
  note text,
  teacher_comment text,
  status session_status not null default 'upcoming',
  scheduled_at timestamptz,
  duration_minutes int not null default 30,
  meeting_link text,
  curriculum_doc_id uuid references curriculum_docs (id),
  is_trial boolean not null default false,
  whiteboard_room_id text,
  whiteboard_strokes jsonb,
  calendly_event_uri text,
  created_at timestamptz not null default now(),
  unique (enrollment_id, session_number)
);
create index on sessions (enrollment_id);
create index on sessions (curriculum_doc_id);
create index on sessions (scheduled_at);

create table session_memos (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments (id) on delete cascade,
  author_role author_role not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index on session_memos (enrollment_id);

create table makeup_credits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  teacher_id uuid not null references teachers (id),
  triggering_session_id uuid references sessions (id) on delete set null,
  count int not null default 1,
  reason text,
  created_at timestamptz not null default now()
);
create index on makeup_credits (student_id);
create index on makeup_credits (teacher_id);

create table teacher_qc_warnings (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id),
  student_id uuid references students (id),
  type text not null,
  detail text,
  occurred_at timestamptz not null default now()
);
create index on teacher_qc_warnings (teacher_id);

-- =========================================================================
-- 7. 세션뷰 기능별 데이터
-- =========================================================================

create table problems (
  id uuid primary key default gen_random_uuid(),
  format problem_format not null,
  passage text,
  options jsonb,
  correct_index int,
  explanation text,
  difficulty problem_difficulty,
  skill_type text,
  subject_id uuid references subjects (id),
  section_id uuid references curriculum_doc_sections (id) on delete cascade,
  origin_session_id uuid references sessions (id) on delete cascade,
  status problem_status not null default 'draft',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index on problems (section_id);
create index on problems (origin_session_id);
create index on problems (subject_id);

create table homework_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  problem_id uuid references problems (id),
  title text not null,
  description text,
  student_answer text,
  graded boolean not null default false,
  score text,
  created_at timestamptz not null default now()
);
create index on homework_items (session_id);

create table session_problem_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions (id) on delete set null,
  student_id uuid not null references students (id),
  problem_id uuid not null references problems (id),
  response jsonb,
  correct boolean,
  saved boolean not null default false,
  attempted_at timestamptz not null default now()
);
create index on session_problem_attempts (student_id);
create index on session_problem_attempts (session_id);
create index on session_problem_attempts (problem_id);

create table teacher_problem_tags (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references session_problem_attempts (id) on delete cascade,
  teacher_id uuid not null references teachers (id),
  reason teacher_pick_reason not null,
  reason_text text,
  tagged_at timestamptz not null default now(),
  unique (attempt_id)
);

create table vocab_words (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  word text not null,
  definition text,
  example text,
  similar_words text[],
  source_session_id uuid references sessions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on vocab_words (student_id);

create table session_doc_links (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  title text not null,
  external_url text not null,
  created_at timestamptz not null default now()
);
create index on session_doc_links (session_id);

create table session_files (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  uploaded_by_role teacher_student_role not null,
  uploaded_by_id uuid not null references profiles (id),
  filename text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);
create index on session_files (session_id);

create table canvas_annotations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  strokes jsonb,
  updated_at timestamptz not null default now(),
  unique (session_id, curriculum_doc_id)
);

-- =========================================================================
-- 9. 수업 리뷰
-- =========================================================================

create table session_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  teacher_summary text,
  strength text,
  improve text,
  next_plan text,
  submitted_at timestamptz,
  unique (session_id)
);

create table session_review_categories (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references session_reviews (id) on delete cascade,
  category review_category not null,
  ai_draft_text text,
  final_text text,
  reviewed boolean not null default false,
  reviewed_at timestamptz,
  unique (review_id, category)
);

create table session_review_revisions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  revision_number int not null,
  snapshot jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (session_id, revision_number)
);

create table session_student_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  student_id uuid not null references students (id),
  rating int check (rating between 0 and 5),
  comment text,
  submitted_at timestamptz,
  unique (session_id)
);

-- =========================================================================
-- 10. 메시징 / 알림
-- =========================================================================

create table chat_threads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  teacher_id uuid not null references teachers (id) on delete cascade,
  unique (student_id, teacher_id)
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads (id) on delete cascade,
  sender_role teacher_student_role not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index on chat_messages (thread_id);

create table parent_requests (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents (id),
  student_id uuid not null references students (id),
  teacher_id uuid references teachers (id),
  text text not null,
  status parent_request_status not null default 'open',
  created_at timestamptz not null default now()
);
create index on parent_requests (parent_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  text text not null,
  link_view text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on notifications (recipient_id, read);

-- =========================================================================
-- 11. 결제 / 크레딧
-- =========================================================================

create table credit_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credit_count int not null,
  price_usd numeric(10, 2) not null,
  active boolean not null default true
);

create table credit_purchases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  package_id uuid not null references credit_packages (id),
  stripe_payment_intent_id text,
  amount_usd numeric(10, 2) not null,
  credits_purchased int not null,
  purchased_at timestamptz not null default now()
);
create index on credit_purchases (student_id);

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id),
  type credit_tx_type not null,
  amount int not null,
  related_session_id uuid references sessions (id),
  related_purchase_id uuid references credit_purchases (id),
  admin_id uuid references profiles (id),
  reason text,
  created_at timestamptz not null default now()
);
create index on credit_transactions (student_id);

create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents (id) on delete cascade,
  is_primary boolean not null default false,
  stripe_payment_method_id text not null,
  brand text,
  last4 text,
  expiry text
);
create index on payment_methods (parent_id);

-- =========================================================================
-- 12. 정산 (선생님 KRW 지급)
-- =========================================================================

create table teacher_payouts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id),
  amount_krw int not null,
  period_start date not null,
  period_end date not null,
  status payout_status not null default 'pending',
  wise_transfer_id text,
  approved_by uuid references profiles (id),
  paid_at timestamptz
);
create index on teacher_payouts (teacher_id);

-- =========================================================================
-- 13. 관리자 내부 (교재/세션과 무관)
-- =========================================================================

create table company_documents (
  id uuid primary key default gen_random_uuid(),
  category company_doc_category not null,
  filename text not null,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);
