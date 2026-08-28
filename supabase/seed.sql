-- Alton Education — 개발용 시드 데이터
-- 목업(alton_*.html)에 나온 예시 인물(지훈, 박서연 선생님, 김민지 학부모 등)을 기준으로 구성.
-- 이 파일은 로컬 개발 환경(`supabase start` + `supabase db reset`) 전용이다.
-- 개발용 비밀번호는 전부 'alton-dev-1234' (auth.users에 bcrypt로 저장됨, pgcrypto 필요).

create extension if not exists pgcrypto;

-- =========================================================================
-- 개발용 인증 계정 (auth.users + auth.identities)
-- =========================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
    'admin@alton.education', crypt('alton-dev-1234', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
    'minji.kim@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
    'jihoon@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
    'seoah@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
    'seoyeon@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
    'dohyun@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u
where u.id in (
  'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002',
  'dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002'
);

-- =========================================================================
-- 1. 인증 / 사용자
-- =========================================================================

insert into profiles (id, role, name, phone) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin', '관리자', null),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'parent', '김민지', '+1-650-555-0110'),
  ('cccccccc-0000-0000-0000-000000000001', 'student', '지훈', null),
  ('cccccccc-0000-0000-0000-000000000002', 'student', '이서아', null),
  ('dddddddd-0000-0000-0000-000000000001', 'teacher', '박서연 선생님', null),
  ('dddddddd-0000-0000-0000-000000000002', 'teacher', '이도현 선생님', null);

insert into parents (id, referral_code, location) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'ALTON-MINJI82', '캘리포니아 서니베일');

insert into students (id, grade, status, credit_balance) values
  ('cccccccc-0000-0000-0000-000000000001', '10학년', 'active', 14),
  ('cccccccc-0000-0000-0000-000000000002', '11학년', 'active', 8);

insert into teachers (id, school, status) values
  ('dddddddd-0000-0000-0000-000000000001', '서울대학교 수리과학부', 'active'),
  ('dddddddd-0000-0000-0000-000000000002', '연세대학교 화학과', 'active');

insert into guardian_students (parent_id, student_id, relation_type, is_primary) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', '모', true);

-- =========================================================================
-- 5. 커리큘럼 — 과목 템플릿 (functional-spec §1 우선순위 과목)
-- =========================================================================

insert into subjects (id, name) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'SAT Math'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'SAT Reading & Writing'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'AP Calculus AB'),
  ('eeeeeeee-0000-0000-0000-000000000004', 'AP Calculus BC'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'AP Statistics'),
  ('eeeeeeee-0000-0000-0000-000000000006', 'AP Chemistry'),
  ('eeeeeeee-0000-0000-0000-000000000007', 'AP Biology'),
  ('eeeeeeee-0000-0000-0000-000000000008', 'AP Physics'),
  ('eeeeeeee-0000-0000-0000-000000000009', 'AP Computer Science'),
  ('eeeeeeee-0000-0000-0000-00000000000a', 'AP Economics'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'AP Psychology');

insert into subject_template_units (subject_id, position, unit_title, note) values
  ('eeeeeeee-0000-0000-0000-000000000001', 1, '함수의 기초와 그래프 해석', '진단 결과 기반 시작 단원'),
  ('eeeeeeee-0000-0000-0000-000000000001', 2, '이차방정식과 이차함수', null),
  ('eeeeeeee-0000-0000-0000-000000000001', 7, '이차방정식 응용 문제 (1)', '실수 유형 확인 회차'),
  ('eeeeeeee-0000-0000-0000-000000000001', 8, '이차방정식 응용 문제 심화', '보강 세션 · 실수 유형 집중 교정'),
  ('eeeeeeee-0000-0000-0000-000000000001', 9, '함수의 합성과 역함수', null);

-- =========================================================================
-- 4~6. 매칭 / 커리큘럼 배정 / 수업 세션 (지훈 × 박서연 × SAT Math)
-- =========================================================================

insert into teacher_curriculum_templates (id, teacher_id, subject_id) values
  ('ffffffff-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001');

insert into teacher_curriculum_template_units (id, template_id, position, unit_title, note) values
  ('11111111-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 1, '함수의 기초와 그래프 해석', '진단 결과 기반 시작 단원'),
  ('11111111-0000-0000-0000-000000000007', 'ffffffff-0000-0000-0000-000000000001', 7, '이차방정식 응용 문제 (1)', '실수 유형 확인 회차'),
  ('11111111-0000-0000-0000-000000000008', 'ffffffff-0000-0000-0000-000000000001', 8, '이차방정식 응용 문제 심화', '보강 세션 · 실수 유형 집중 교정');

insert into enrollments (id, student_id, teacher_id, subject_id, status, total_sessions, current_session) values
  ('22222222-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
    'eeeeeeee-0000-0000-0000-000000000001', 'active', 12, 8);

insert into sessions (
  enrollment_id, session_number, unit_title, source_template_unit_id, teacher_comment, status, scheduled_at
) values
  ('22222222-0000-0000-0000-000000000001', 1, '함수의 기초와 그래프 해석', '11111111-0000-0000-0000-000000000001', null, 'completed', now() - interval '5 weeks'),
  ('22222222-0000-0000-0000-000000000001', 7, '이차방정식 응용 문제 (1)', '11111111-0000-0000-0000-000000000007', '실수 유형 확인 회차', 'completed', now() - interval '1 week'),
  ('22222222-0000-0000-0000-000000000001', 8, '이차방정식 응용 문제 심화', '11111111-0000-0000-0000-000000000008', '보강 세션 · 실수 유형 집중 교정', 'upcoming', now() + interval '3 days');

-- =========================================================================
-- 8. 교재 (세션과 무관한 콘텐츠)
-- =========================================================================

insert into curriculum_docs (id, title, subject_id, owner_type, status) values
  ('33333333-0000-0000-0000-000000000001', '이차방정식 개념 정리', 'eeeeeeee-0000-0000-0000-000000000001', 'admin', 'published');

insert into curriculum_doc_sections (curriculum_doc_id, position, title, body, teaching_tip) values
  ('33333333-0000-0000-0000-000000000001', 1, 'Lesson Overview', '<p>이차방정식의 기본 개념을 정리합니다.</p>', null),
  ('33333333-0000-0000-0000-000000000001', 2, 'Teacher Modeling', '<p>판별식을 이용한 근의 개수 판정 예시.</p>', '학생이 판별식 부호를 헷갈려하면 그래프로 다시 설명');

-- =========================================================================
-- 11. 결제 / 크레딧
-- =========================================================================

insert into credit_packages (name, credit_count, price_usd, active) values
  ('10장', 10, 1200.00, true),
  ('20장', 20, 2400.00, true),
  ('40장', 40, 4800.00, true);
