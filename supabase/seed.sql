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
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '77777777-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
    'hana.jung@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '88888888-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
    'junseo.park@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
    'hyunwoo.lee@example.com', crypt('alton-dev-1234', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u
where u.id in (
  'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
  'cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002',
  'dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002',
  '77777777-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000002'
);

-- =========================================================================
-- 1. 인증 / 사용자
-- =========================================================================

-- R2 Task 6: date_of_birth가 없으면 fail-closed로 13세 미만 취급되어 보호자
-- 동의 게이트에 걸린다(§4) — 학생 시드 계정은 학년에 맞는 현실적인
-- 생년월일을 INSERT 시점에 채운다(protect_date_of_birth 트리거는 UPDATE만
-- 막고 INSERT는 막지 않는다). 실제 13세 미만 동의 흐름은 테스트에서
-- set_student_date_of_birth()로 별도 설정한다.
insert into profiles (id, role, name, phone, date_of_birth) values
  ('cccccccc-0000-0000-0000-000000000001', 'student', '지훈', null, (now() - interval '16 years')::date),
  ('cccccccc-0000-0000-0000-000000000002', 'student', '이서아', null, (now() - interval '17 years')::date),
  ('88888888-0000-0000-0000-000000000001', 'student', '박준서', null, (now() - interval '15 years')::date);

insert into profiles (id, role, name, phone) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin', '관리자', null),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'parent', '김민지', '+1-650-555-0110'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'parent', '이현우', '+1-650-555-0112'),
  ('dddddddd-0000-0000-0000-000000000001', 'teacher', '박서연 선생님', null),
  ('dddddddd-0000-0000-0000-000000000002', 'teacher', '이도현 선생님', null),
  ('77777777-0000-0000-0000-000000000001', 'teacher', '정하나 선생님', null);

insert into parents (id, referral_code, location) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'ALTON-MINJI82', '캘리포니아 서니베일'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ALTON-HYUNWOO17', '캘리포니아 서니베일');

insert into students (id, grade, status, credit_balance) values
  ('cccccccc-0000-0000-0000-000000000001', '10학년', 'active', 14),
  ('cccccccc-0000-0000-0000-000000000002', '11학년', 'active', 8),
  ('88888888-0000-0000-0000-000000000001', '9학년', 'pending', 0);

-- (2026-08-30 R2 추가) teachers.status='active'로 바로 INSERT하면 R1의
-- teachers_enforce_active_requires_rate 트리거가 유효한 현재 시급 이력
-- (teacher_rate_history)을 요구한다 — teacher_rate_history.teacher_id는
-- profiles(id)를 참조하므로, teachers보다 먼저 생성된 profiles 행을 대상으로
-- 여기서 미리 시급 이력을 만들어둔다(실제 앱에서는 관리자가 초대 시
-- set_teacher_rate()로 만드는 것과 동일한 선행 조건).
insert into teacher_rate_history (teacher_id, amount_minor, currency, effective_from) values
  ('dddddddd-0000-0000-0000-000000000001', 50000, 'KRW', now()),
  ('dddddddd-0000-0000-0000-000000000002', 45000, 'KRW', now());

-- school/bio는 목업(alton_student_portal_v16.html TEACHERS 딕셔너리) 텍스트 그대로.
-- 기존 시드에 이도현 school이 최지우(목업엔 없는 시드 미등록 선생님) 것과
-- 뒤바뀌어 있던 걸 바로잡음.
insert into teachers (id, school, bio, status) values
  ('dddddddd-0000-0000-0000-000000000001', '서울대학교 수리과학부 재학 · SAT Math 전담',
    'SAT Math 800점 만점 지도 경험 다수. 함수·이차방정식 단원에 특히 강점이 있으며, 실수 패턴 분석을 통한 오답 교정 방식으로 지도합니다.',
    'active'),
  ('dddddddd-0000-0000-0000-000000000002', 'KAIST 수학과 · AP Calculus 전담',
    '미국 서부 시간대 저녁 시간 지도 다수, AP 5점 지도 경험 다수.',
    'active'),
  ('77777777-0000-0000-0000-000000000001', '연세대학교 화학과 재학 · AP Chemistry 지원',
    null, 'pending');

-- (2026-08-30 R2 Task 3) 가족 관계 원본은 households/household_members다
-- (guardian_students는 동결돼 INSERT 자체가 트리거로 거부된다) — 이 파일은
-- 새로 만드는 시드라 백필을 거치지 않고 처음부터 최종 구조로 직접 심는다.
--
-- 김민지 학부모는 자녀가 지훈 하나뿐이면 030(학부모 셸)의 "자녀 전환" UI를
-- 실제로 검증할 데이터가 없어서, 둘째 자녀(이서아, AP Calculus BC · 이도현)도
-- 연결해둔다. 지훈에게는 공동 보호자(이현우)도 추가해 "한 자녀가 복수 보호자를
-- 갖는" 케이스를, 김민지에게는 두 자녀를 둬서 "한 보호자가 복수 자녀를 갖는"
-- 케이스를 로컬 환경에서 함께 검증할 수 있게 한다.
insert into households (id, primary_guardian_id, billing_currency) values
  ('aabbccdd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'USD');

insert into household_members (household_id, profile_id, role, relation, is_primary) values
  ('aabbccdd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'guardian', '모', true),
  ('aabbccdd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'guardian', '기타', false);

insert into household_members (household_id, profile_id, role, is_primary) values
  ('aabbccdd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'child', true),
  ('aabbccdd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', 'child', false);

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
    'eeeeeeee-0000-0000-0000-000000000001', 'active', 12, 8),
  ('22222222-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002',
    'eeeeeeee-0000-0000-0000-000000000004', 'active', 12, 2),
  -- 박서연 선생님은 목업(TEACHERS 딕셔너리)에서 SAT Math·AP Statistics 둘 다
  -- 담당하므로, 040(선생님 스케줄)이 여러 과목/세션에 걸친 목록을 실제로
  -- 검증할 수 있도록 지훈 앞으로 두 번째 과목 enrollment를 추가한다.
  ('22222222-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
    'eeeeeeee-0000-0000-0000-000000000005', 'active', 12, 1);

insert into sessions (
  id, enrollment_id, session_number, unit_title, source_template_unit_id, teacher_comment, status, scheduled_at
) values
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 1, '함수의 기초와 그래프 해석', '11111111-0000-0000-0000-000000000001', null, 'completed', now() - interval '5 weeks'),
  ('44444444-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000001', 7, '이차방정식 응용 문제 (1)', '11111111-0000-0000-0000-000000000007', '실수 유형 확인 회차', 'completed', now() - interval '1 week'),
  ('44444444-0000-0000-0000-00000000000b', '22222222-0000-0000-0000-000000000003', 1, '기술통계 기초', null, null, 'upcoming', now() + interval '1 day'),
  ('44444444-0000-0000-0000-000000000008', '22222222-0000-0000-0000-000000000001', 8, '이차방정식 응용 문제 심화', '11111111-0000-0000-0000-000000000008', '보강 세션 · 실수 유형 집중 교정', 'upcoming', now() + interval '3 days'),
  ('44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 2, '극한과 연속', null, null, 'upcoming', now() + interval '2 days');

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

-- =========================================================================
-- 12. 관리자 대시보드(050) 검증용 — 상담 요청/QC 경고
-- =========================================================================

insert into consult_requests (id, category, person_name, email, phone, student_grade, intake_type, concerns, submitted_at, status) values
  ('99999999-0000-0000-0000-000000000001', 'family', '오하윤', 'hayoon.oh@example.com', null, '11학년', 'A',
    'SAT Math 점수를 단기간에 올리고 싶습니다.', now() - interval '2 days', 'requested');

insert into consult_requests (id, category, person_name, email, phone, student_grade, intake_type, concerns, submitted_at, status, scheduled_at) values
  ('99999999-0000-0000-0000-000000000002', 'family', '이현우', 'hyunwoo.lee@example.com', null, '10학년', 'B',
    'AP Chemistry 선생님 매칭 상담 요청', now() - interval '5 days', 'confirmed', now() + interval '2 days');

insert into teacher_qc_warnings (teacher_id, student_id, type, detail, occurred_at) values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'late_start',
    '수업 10분 지각', now() - interval '10 days'),
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'no_homework_review',
    '전 회차 과제 피드백 누락', now() - interval '3 days');
