-- M4 UAT #2(프로필 필드 추가) — 학생 계정 설정 시 추가 프로필 정보 수집
--
-- 확정된 UX(사용자 승인, 2026-09-05):
--   1) /set-password 화면에는 넣지 않는다. 비밀번호 설정 → /post-auth →
--      (프로필 미완료면) /complete-profile 로 분리한다. 건너뛰기 불가, 로그인마다
--      미완료면 리다이렉트 — 기존 resolveAccountDestination() 게이트 패턴
--      (account-pending/account-suspended/consent-pending과 동일 방식)에
--      한 단계를 추가해 구현한다(lib/auth.ts).
--   2) AP 이수 상황·비교과 활동은 구조화된 리스트 — student_ap_courses /
--      student_extracurricular_activities 신규 테이블에 여러 행으로 저장.
--
-- 필수/선택 구분(원 요청 문구 기준 — "필수"라고 명시된 항목만 완료 게이트에
-- 반영한다): 생년월일(필수)·학교명(필수)·학년(필수)은 프로필 완료 판정에
-- 포함한다. SAT 점수는 "없으면 0"이라 기본값 0으로 항상 충족된 것으로 취급—
-- 완료 게이트에 별도로 포함하지 않는다(입력값 자체는 그대로 저장). GPA·AP
-- 이수 상황·비교과 현황·목표 대학·관심 전공은 원문에 "필수" 표시가 없어 수집은
-- 하되 완료 게이트 조건에 넣지 않는다(선택 입력, 나중에 추가/수정 가능).
--
-- 목표 대학·관심 전공은 한 학생이 여러 개 가질 수 있다고 보는 것이 자연스러워
-- text[] 배열 컬럼으로 설계했다(개수 제한 없음) — 이 부분은 실제 정책 확인이
-- 필요한 가정이라 개발자 보고의 "결정 필요"에 명시한다.

-- =========================================================================
-- 1) students 테이블 확장
-- =========================================================================
alter table students
  add column if not exists school_name text,
  add column if not exists sat_score integer not null default 0,
  add column if not exists gpa numeric(3,2),
  add column if not exists target_colleges text[] not null default '{}',
  add column if not exists intended_majors text[] not null default '{}',
  add column if not exists profile_completed_at timestamptz;

alter table students
  add constraint students_sat_score_range check (sat_score >= 0 and sat_score <= 1600);
alter table students
  add constraint students_gpa_range check (gpa is null or (gpa >= 0 and gpa <= 5.0));

comment on column students.school_name is 'M4 프로필 완성: 학교명(필수).';
comment on column students.sat_score is 'M4 프로필 완성: 기존 SAT 점수, 없으면 0(기본값) — 완료 게이트에서 별도 필수 취급하지 않음(항상 충족).';
comment on column students.gpa is 'M4 프로필 완성: GPA, 선택 입력(nullable).';
comment on column students.target_colleges is 'M4 프로필 완성: 목표 대학 목록(선택 입력, 여러 개 가능 — 개수 제한 없음, 정책 확인 필요 가정).';
comment on column students.intended_majors is 'M4 프로필 완성: 관심 전공 목록(선택 입력, 여러 개 가능).';
comment on column students.profile_completed_at is 'M4 프로필 완성 시각. null이면 미완료 — lib/auth.ts resolveAccountDestination()가 이 값으로 /complete-profile 리다이렉트를 강제한다.';

-- =========================================================================
-- 2) 구조화 리스트: AP 이수 상황 / 비교과 활동
-- =========================================================================
create table student_ap_courses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  course_name text not null,
  status text not null check (status in ('planned', 'taking', 'completed')),
  exam_year integer,
  score integer check (score is null or (score >= 1 and score <= 5)),
  created_at timestamptz not null default now()
);
create index on student_ap_courses (student_id);

create table student_extracurricular_activities (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  activity_name text not null,
  description text,
  start_date date,
  end_date date,
  is_ongoing boolean not null default false,
  created_at timestamptz not null default now()
);
create index on student_extracurricular_activities (student_id);

-- RLS: 요청 문구 그대로 "본인/보호자/관리자만 조회·본인만 수정" — 기존
-- students 테이블 RLS(teaches_student/is_guardian_of/is_admin 패턴, R1
-- 20260827120001_rls_policies.sql)를 그대로 재사용한다.
alter table student_ap_courses enable row level security;
create policy "학생 본인/담당 선생님/보호자/관리자 조회" on student_ap_courses for select
  using (
    student_id = auth.uid()
    or teaches_student(student_id)
    or is_guardian_of(student_id)
    or is_admin()
  );
create policy "본인/관리자만 추가" on student_ap_courses for insert
  with check (student_id = auth.uid() or is_admin());
create policy "본인/관리자만 수정" on student_ap_courses for update
  using (student_id = auth.uid() or is_admin());
create policy "본인/관리자만 삭제" on student_ap_courses for delete
  using (student_id = auth.uid() or is_admin());

alter table student_extracurricular_activities enable row level security;
create policy "학생 본인/담당 선생님/보호자/관리자 조회" on student_extracurricular_activities for select
  using (
    student_id = auth.uid()
    or teaches_student(student_id)
    or is_guardian_of(student_id)
    or is_admin()
  );
create policy "본인/관리자만 추가" on student_extracurricular_activities for insert
  with check (student_id = auth.uid() or is_admin());
create policy "본인/관리자만 수정" on student_extracurricular_activities for update
  using (student_id = auth.uid() or is_admin());
create policy "본인/관리자만 삭제" on student_extracurricular_activities for delete
  using (student_id = auth.uid() or is_admin());

-- =========================================================================
-- 3) 생년월일 최초 1회 자가입력 허용(2026-09-05, 신규 결정)
--
-- 기존 protect_date_of_birth()(20260904000000_r2_minor_consent.sql)는 학생
-- 본인의 date_of_birth 자가수정을 전면 차단하고 보호자/관리자만 허용한다 —
-- 13세 미만 동의 게이트(is_under_13)를 학생 스스로 회피하지 못하게 하려는
-- 의도적 방어다. 이 방어는 유지한다: "이미 값이 있는 생년월일을 학생 본인이
-- 바꾸는 것"은 여전히 차단한다.
--
-- 다만 이번 프로필 완성 단계는 학생이 자기 계정을 처음 설정하며 생년월일을
-- "최초로" 입력하는 시나리오다. 이 페이지에 도달했다는 것 자체가 이미
-- current_account_access_allowed() 게이트(resolveAccountDestination, R2)를
-- 통과했다는 뜻 — date_of_birth가 null인 채로 여기 온 학생은 이미 보호자
-- 동의(guardian_consents)가 유효하게 등록돼 있어야만 여기 도달할 수 있다
-- (null이면 is_under_13()이 fail-closed로 true를 반환해 보호자 동의 없이는
-- consent-pending에서 막힌다). 즉 보호자가 이미 이 학생을 미성년자로 보고
-- 검증한 뒤라, 학생이 이 시점에 자기 생년월일을 "최초로" 적어 넣는 것은
-- 새로운 위조 경로를 열지 않는다 — 값이 이미 있는 상태에서의 변경만 계속
-- 완전히 차단하면 된다.
create or replace function public.protect_date_of_birth()
returns trigger language plpgsql as $$
begin
  if new.date_of_birth is distinct from old.date_of_birth then
    if not (
      is_admin()
      or exists (
        select 1 from household_members hm
        join household_members child
          on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = new.id
        where hm.role = 'guardian' and hm.profile_id = auth.uid()
      )
      or (old.date_of_birth is null and new.id = auth.uid())
    ) then
      raise exception '생년월일은 본인이 직접 수정할 수 없습니다 — 보호자 또는 관리자만 변경할 수 있습니다.';
    end if;
  end if;
  return new;
end;
$$;
comment on function public.protect_date_of_birth() is
  'M4(2026-09-05) 갱신: 기존 값이 없을 때(최초 입력)에 한해 학생 본인 자가입력을 추가로 허용 '
  '(프로필 완성 단계, complete_student_profile() 경유). 이미 값이 있는 생년월일의 변경은 '
  '여전히 보호자/관리자만 가능 — 위조 방지 방어는 그대로 유지.';

-- =========================================================================
-- 4) 프로필 완료 원자적 처리 함수
-- =========================================================================
create or replace function public.complete_student_profile(
  p_date_of_birth date,
  p_school_name text,
  p_grade text,
  p_sat_score integer,
  p_gpa numeric,
  p_target_colleges text[],
  p_intended_majors text[]
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_student_id uuid := auth.uid();
  v_current_dob date;
begin
  if v_student_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (select 1 from profiles where id = v_student_id and role = 'student') then
    raise exception '학생 계정만 프로필을 완성할 수 있습니다.';
  end if;
  if not exists (select 1 from students where id = v_student_id) then
    raise exception '학생 데이터가 없습니다: %', v_student_id;
  end if;

  select date_of_birth into v_current_dob from profiles where id = v_student_id;
  if v_current_dob is null then
    if p_date_of_birth is null then
      raise exception '생년월일은 필수 항목입니다.';
    end if;
    update profiles set date_of_birth = p_date_of_birth where id = v_student_id;
  end if;

  if p_school_name is null or btrim(p_school_name) = '' then
    raise exception '학교명은 필수 항목입니다.';
  end if;
  if p_grade is null or btrim(p_grade) = '' then
    raise exception '학년은 필수 항목입니다.';
  end if;

  update students set
    school_name = btrim(p_school_name),
    grade = btrim(p_grade),
    sat_score = coalesce(p_sat_score, 0),
    gpa = p_gpa,
    target_colleges = coalesce(p_target_colleges, '{}'),
    intended_majors = coalesce(p_intended_majors, '{}'),
    profile_completed_at = now()
  where id = v_student_id;
end;
$$;
revoke execute on function public.complete_student_profile(date, text, text, integer, numeric, text[], text[]) from public;
grant execute on function public.complete_student_profile(date, text, text, integer, numeric, text[], text[]) to authenticated;

-- =========================================================================
-- 5) 게이트 확인 함수 — resolveAccountDestination()에서 사용
-- =========================================================================
create or replace function public.current_student_profile_completed()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select case
        when p.role <> 'student' then true
        else exists (select 1 from students s where s.id = p.id and s.profile_completed_at is not null)
      end
      from profiles p where p.id = auth.uid()
    ),
    true
  );
$$;
revoke execute on function public.current_student_profile_completed() from public;
grant execute on function public.current_student_profile_completed() to authenticated;
comment on function public.current_student_profile_completed() is
  'M4 프로필 완성 게이트(self-only). 학생이 아니거나 프로필/계정 정보를 찾지 못하면 fail-open(true) — '
  '계정 상태 자체의 이상은 current_account_status()/resolveAccountDestination()의 다른 분기가 이미 처리한다.';
