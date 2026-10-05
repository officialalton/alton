-- =========================================================================
-- 2026-10-05 무료 학습 회원 기반(S1) — docs/briefs/2026-10-05-free-member-tutoring-design.md §3.1·§3.2·§5.1
--
-- 추가만 한다(기존 행·동작 변화 0):
--   1) students.member_type('free'|'tutoring', 기본 'tutoring') / students.signup_source
--   2) consult_slot_source enum += 'free_member' (이 파일에서는 값을 사용하지 않는다 — 55P04 회피)
--   3) mock_exam_sets.access_tier('free'|'tutoring', 기본 'tutoring')
--   4) student_terms_acceptances — 셀프 가입 약관 동의 원장(기존 guardian_consents는
--      보호자→자녀 동의 전용이라 재사용하지 않는다)
--   5) is_free_member / has_tutoring_access / student_feature_access — 기능 권한 단일 근거
--   6) provision_free_member — 이메일 확인된 셀프 가입 Auth 계정을 무료 학생으로 프로비저닝
--   7) students.member_type 보호 트리거 — 학생 본인 UPDATE 정책(초기 스키마 "본인/관리자")으로
--      member_type을 'tutoring'으로 바꾸는 권한 상승 차단
-- =========================================================================

-- 1) 회원 유형·가입 출처 -----------------------------------------------------
alter table students
  add column if not exists member_type text not null default 'tutoring',
  add column if not exists signup_source text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'students_member_type_check') then
    alter table students add constraint students_member_type_check
      check (member_type in ('free', 'tutoring'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'students_signup_source_check') then
    alter table students add constraint students_signup_source_check
      check (signup_source is null or signup_source in ('self_signup', 'consultation', 'admin_direct'));
  end if;
end $$;

comment on column students.member_type is
  '2026-10-05 무료 학습 회원. free=셀프 가입 무료 회원(household 없음), tutoring=기존 과외 고객. 전환은 free→tutoring 한 방향, 전용 RPC(S5)로만.';
comment on column students.signup_source is
  '가입 출처(self_signup/consultation/admin_direct). 퍼널·분석용 — 권한 판정에는 쓰지 않는다.';

create index if not exists students_member_type_idx on students (member_type);

-- 2) 상담 소스 enum ----------------------------------------------------------
-- 같은 트랜잭션에서 새 값을 참조하면 55P04 — 이 파일은 값을 추가만 하고 사용은 S4(20262100000003)에서.
alter type consult_slot_source add value if not exists 'free_member';

-- 3) 모의고사 세트 공개 티어 ---------------------------------------------------
alter table mock_exam_sets
  add column if not exists access_tier text not null default 'tutoring';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mock_exam_sets_access_tier_check') then
    alter table mock_exam_sets add constraint mock_exam_sets_access_tier_check
      check (access_tier in ('free', 'tutoring'));
  end if;
end $$;
comment on column mock_exam_sets.access_tier is
  '2026-10-05 무료 회원 공개 여부. free=무료 회원에게도 노출(오너 결정 7-1: 3세트), tutoring=과외 회원만. 카탈로그/시작 RPC 필터는 S2(20262100000001).';

-- 4) 약관 동의 원장 ------------------------------------------------------------
create table if not exists student_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'self_signup'
);
create index if not exists student_terms_acceptances_student_idx on student_terms_acceptances (student_id);
alter table student_terms_acceptances enable row level security;
drop policy if exists "약관 동의는 본인/관리자 조회" on student_terms_acceptances;
create policy "약관 동의는 본인/관리자 조회" on student_terms_acceptances for select
  using (student_id = auth.uid() or is_admin());
-- insert/update/delete 정책 없음 = RPC(security definer)로만 기록, 사후 변경 불가.
comment on table student_terms_acceptances is
  '2026-10-05 학생 셀프 가입 약관·개인정보 동의 기록(버전·시각). guardian_consents(보호자→자녀)와 별개.';

-- 5) 권한 판정 함수 ----------------------------------------------------------
create or replace function public.is_free_member(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.member_type = 'free' from students s where s.id = p_student_id),
    false
  );
$$;
revoke execute on function public.is_free_member(uuid) from public, anon;
grant execute on function public.is_free_member(uuid) to authenticated;

-- 과외 관계가 "살아 있는" 과외 회원인가. S1에서는 넓게 잡는다(기존 고객의 동작 변화 0):
-- 과외 회원이면서 (활성 v3 수강 ∨ 유효 수업권 ∨ household 소속 ∨ 레거시 활성 enrollment ∨
-- 체험 온보딩으로 생성된 계정 ∨ status=pending 온보딩 고객). 계약 종료 뒤 범위 축소는 S2에서 조정.
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
        or exists (select 1 from household_members hm where hm.profile_id = s.id and hm.role = 'child')
        or exists (select 1 from enrollments e where e.student_id = s.id and e.status = 'active')
        or exists (select 1 from trial_onboarding_link_students t where t.child_auth_user_id = s.id and t.status = 'created')
      )
  );
$$;
revoke execute on function public.has_tutoring_access(uuid) from public, anon;
grant execute on function public.has_tutoring_access(uuid) to authenticated;

-- 기능 키(brief §2.1 표와 1:1, lib/feature-access.ts FEATURE_KEYS와 동일해야 한다 — 단위 테스트가 고정).
--   공통(C): account, problem_report
--   무료(F): home, mock_exam, problem_log, vocab, materials_free, tutoring_info
--   과외(T): roadmap, course, class, teacher, homework, lesson_booking, teacher_chat,
--            consultant_portal, credits, college, session
-- 규칙: students.status='active'가 아니면 빈 배열(suspended/pending은 기존 전용 화면이 처리).
-- self-only가 기본이고 관리자·컨설턴트는 타인 조회 가능(화면 표시용).
create or replace function public.student_feature_access(p_student_id uuid)
returns text[]
language plpgsql stable security definer set search_path = public as $$
declare
  v_status text;
  v_keys text[] := array[]::text[];
begin
  if auth.uid() is null then
    return v_keys;
  end if;
  if p_student_id <> auth.uid()
     and not exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'consultant')) then
    return v_keys;
  end if;

  select s.status::text into v_status from students s where s.id = p_student_id;
  if v_status is distinct from 'active' then
    return v_keys;
  end if;

  v_keys := array['account', 'problem_report', 'home', 'mock_exam', 'problem_log', 'vocab', 'materials_free', 'tutoring_info'];
  if has_tutoring_access(p_student_id) then
    v_keys := v_keys || array['roadmap', 'course', 'class', 'teacher', 'homework', 'lesson_booking', 'teacher_chat',
                              'consultant_portal', 'credits', 'college', 'session'];
  end if;
  return v_keys;
end;
$$;
revoke execute on function public.student_feature_access(uuid) from public, anon;
grant execute on function public.student_feature_access(uuid) to authenticated;
comment on function public.student_feature_access(uuid) is
  '2026-10-05 학생 기능 권한 단일 근거. 메뉴 숨김(StudentShell)과 서버 가드(requireStudentFeature)가 같은 결과를 쓴다.';

-- 6) 무료 회원 프로비저닝 ---------------------------------------------------------
-- 호출 조건(모두 DB에서 강제):
--   (a) auth.users.email_confirmed_at not null
--   (b) raw_user_meta_data->>'signup_source' = 'self_signup' — 공개 가입 폼(/signup/student)이 signUp 시점에
--       넣는 표식. 역할은 metadata에서 절대 읽지 않는다(항상 student/free 고정). 표식 위조로 얻는 것은
--       공개 폼으로도 얻을 수 있는 무료 계정뿐이고, 반대로 다른 경로(체험 온보딩·초대)가 만든 "프로필 없는
--       고아 Auth 계정"은 표식이 없어 기존 fail-closed(unknown→로그아웃)가 그대로 유지된다.
--   (c) 프로필이 이미 있으면: 같은 사용자가 이미 free/self_signup으로 프로비저닝된 경우만 멱등 반환, 그 외 거절
--   (d) 만 13세 이상(UTC 날짜, is_under_13과 같은 기준). 생년월일 null 거절
--   (e) 이름·학년·약관 버전 필수, 학교 선택
create or replace function public.provision_free_member(
  p_name text,
  p_birthdate date,
  p_grade text,
  p_school text default null,
  p_terms_version text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_confirmed timestamptz;
  v_meta jsonb;
  v_existing_member_type text;
  v_existing_source text;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select u.email_confirmed_at, u.raw_user_meta_data
    into v_confirmed, v_meta
  from auth.users u where u.id = v_uid;
  if not found then
    raise exception '계정을 찾을 수 없습니다.';
  end if;
  if v_confirmed is null then
    raise exception '이메일 확인이 필요합니다.';
  end if;

  -- 멱등: 같은 사용자가 이미 무료 회원으로 프로비저닝됨 → 그대로 반환.
  select s.member_type, s.signup_source into v_existing_member_type, v_existing_source
  from students s where s.id = v_uid;
  if exists (select 1 from profiles p where p.id = v_uid) then
    if v_existing_member_type = 'free' and v_existing_source = 'self_signup' then
      return v_uid;
    end if;
    raise exception '이미 등록된 계정입니다.';
  end if;

  if coalesce(v_meta->>'signup_source', '') <> 'self_signup' then
    raise exception '셀프 가입 경로로 만든 계정만 등록할 수 있습니다.';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception '이름은 필수 항목입니다.';
  end if;
  if p_grade is null or btrim(p_grade) = '' then
    raise exception '학년은 필수 항목입니다.';
  end if;
  if p_birthdate is null then
    raise exception '생년월일은 필수 항목입니다.';
  end if;
  if p_birthdate > (now() at time zone 'utc')::date then
    raise exception '생년월일이 올바르지 않습니다.';
  end if;
  if (p_birthdate + interval '13 years') > (now() at time zone 'utc')::date then
    raise exception '만 13세 미만은 직접 가입할 수 없습니다. 보호자가 상담을 신청해 주세요.';
  end if;
  if p_terms_version is null or btrim(p_terms_version) = '' then
    raise exception '약관 동의가 필요합니다.';
  end if;

  insert into profiles (id, role, name, date_of_birth)
  values (v_uid, 'student', btrim(p_name), p_birthdate);

  -- 학교는 선택(오너 결정 7-4) → profile_completed_at을 바로 채워 /complete-profile 게이트를 지난다.
  insert into students (id, grade, school_name, status, member_type, signup_source, profile_completed_at)
  values (v_uid, btrim(p_grade), nullif(btrim(coalesce(p_school, '')), ''), 'active', 'free', 'self_signup', now());

  insert into student_terms_acceptances (student_id, terms_version, source)
  values (v_uid, btrim(p_terms_version), 'self_signup');

  return v_uid;
end;
$$;
revoke execute on function public.provision_free_member(text, date, text, text, text) from public, anon;
grant execute on function public.provision_free_member(text, date, text, text, text) to authenticated;
comment on function public.provision_free_member(text, date, text, text, text) is
  '2026-10-05 무료 학습 회원 셀프 가입 프로비저닝(authenticated 전용, 이메일 확인·self_signup 표식·만 13세 이상·프로필 없음). 과외 객체(계약·수업권·수강·배정·household·상담)는 생성하지 않는다.';

-- 7) member_type 보호 --------------------------------------------------------------
-- 초기 스키마의 students UPDATE 정책("본인/관리자")은 컬럼을 제한하지 않아 학생이 REST로
-- member_type을 'tutoring'으로 바꿀 수 있다. 관리자 또는 전환 RPC(app.allow_member_type_change)만 허용.
create or replace function public.protect_student_member_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.member_type is distinct from old.member_type or new.signup_source is distinct from old.signup_source)
     and coalesce(current_setting('app.allow_member_type_change', true), 'false') <> 'true'
     and auth.uid() is not null
     and not is_admin() then
    raise exception 'member_type/signup_source는 관리자 또는 전환 절차로만 바꿀 수 있습니다.';
  end if;
  return new;
end;
$$;
drop trigger if exists students_protect_member_type on students;
create trigger students_protect_member_type
  before update of member_type, signup_source on students
  for each row execute function public.protect_student_member_type();
