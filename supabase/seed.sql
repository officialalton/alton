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
  id, enrollment_id, session_number, unit_title, source_template_unit_id, teacher_comment, status, scheduled_at
) values
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 1, '함수의 기초와 그래프 해석', '11111111-0000-0000-0000-000000000001', null, 'completed', now() - interval '5 weeks'),
  ('44444444-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000001', 7, '이차방정식 응용 문제 (1)', '11111111-0000-0000-0000-000000000007', '실수 유형 확인 회차', 'completed', now() - interval '1 week'),
  ('44444444-0000-0000-0000-000000000008', '22222222-0000-0000-0000-000000000001', 8, '이차방정식 응용 문제 심화', '11111111-0000-0000-0000-000000000008', '보강 세션 · 실수 유형 집중 교정', 'upcoming', now() + interval '3 days');

-- =========================================================================
-- 8. 교재 (세션과 무관한 콘텐츠)
-- =========================================================================

insert into curriculum_docs (id, title, subject_id, owner_type, status) values
  ('33333333-0000-0000-0000-000000000001', '이차방정식 개념 정리', 'eeeeeeee-0000-0000-0000-000000000001', 'admin', 'published');

insert into curriculum_doc_sections (id, curriculum_doc_id, position, title, body, teaching_tip) values
  ('55555555-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 1, 'Lesson Overview',
    '<p>이차방정식 <b>ax² + bx + c = 0</b>의 판별식 D = b² - 4ac를 이용하면 실근의 개수를 계산 없이 바로 알 수 있습니다.</p>',
    null),
  ('55555555-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001', 2, 'Teacher Modeling',
    '<p>판별식 D의 부호에 따라 서로 다른 개수의 실근을 가집니다: D&gt;0이면 서로 다른 두 실근, D=0이면 중근, D&lt;0이면 실근이 없습니다.</p>',
    '학생이 판별식 부호를 헷갈려하면 그래프(포물선과 x축의 교점 개수)로 다시 설명');

insert into problems (id, format, passage, options, correct_index, explanation, difficulty, subject_id, section_id, status, created_by) values
  ('66666666-0000-0000-0000-000000000001', 'mc',
    'x² - 4x + 4 = 0의 판별식 D의 값과 이 방정식의 실근 개수로 옳은 것은?',
    '["D = 0, 서로 다른 두 실근", "D = 0, 중근 1개", "D = -16, 실근 없음", "D = 16, 서로 다른 두 실근"]'::jsonb,
    1,
    '판별식 D = b² - 4ac = (-4)² - 4·1·4 = 16 - 16 = 0 이므로 중근을 가집니다.',
    'easy', 'eeeeeeee-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000002',
    'confirmed', 'dddddddd-0000-0000-0000-000000000001');

-- 8회차 세션에 이 교재를 배정
update sessions set curriculum_doc_id = '33333333-0000-0000-0000-000000000001'
  where id = '44444444-0000-0000-0000-000000000008';

-- 세션에 배정되지 않은 교재도 하나 더 시드 — 023(교재 라이브러리)에서
-- "세션과 무관하게 과목 전체 교재를 훑어보는" 화면을 검증할 데이터가 필요.
insert into curriculum_docs (id, title, subject_id, unit_id, owner_type, status)
select '33333333-0000-0000-0000-000000000002', '이차함수의 그래프와 성질',
  'eeeeeeee-0000-0000-0000-000000000001', id, 'admin', 'published'
from subject_template_units
where subject_id = 'eeeeeeee-0000-0000-0000-000000000001' and position = 2;

insert into curriculum_doc_sections (id, curriculum_doc_id, position, title, body, teaching_tip) values
  ('55555555-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000002', 1, 'Graph Basics',
    '<p>이차함수 y = a(x-p)² + q의 그래프는 꼭짓점 (p, q)를 갖는 포물선입니다.</p>',
    null);

-- =========================================================================
-- 11. 결제 / 크레딧
-- =========================================================================

insert into credit_packages (name, credit_count, price_usd, active) values
  ('10장', 10, 1200.00, true),
  ('20장', 20, 2400.00, true),
  ('40장', 40, 4800.00, true);
