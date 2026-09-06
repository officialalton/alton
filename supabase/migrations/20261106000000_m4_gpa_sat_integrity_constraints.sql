-- M4 프로필 무결성 보강(2026-09-05 후속) — GPA/SAT 값 검증을 DB CHECK
-- 제약으로 강제한다(additive). 기존 gpa_scale/nullable sat_score 구현
-- (20261102000000_m4_profile_uat2_followup.sql) 위에 아래 제약만 추가한다.
--
-- 확정 정책(제품 오너, 재질문 없음):
--   1) GPA 값이 있으면 gpa_scale이 필수(null 불가).
--   2) GPA 값은 선택한 척도를 초과할 수 없다 — 척도별 상한: 4.0/4.3/4.5/5.0
--      각각 자기 자신이 상한(gpa_scale의 텍스트 값이 곧 만점 숫자값과 같다).
--   3) GPA가 없으면 gpa_scale도 null이어야 한다(척도만 있고 GPA가 없는 상태 금지).
--   4) SAT 미입력은 null(기존 구현 유지, 재확인만).
--   5) SAT 입력값이 있으면 실제 유효 범위(400~1600)만 허용 — 기존 0~1600 범위를
--      400~1600으로 좁힌다.
--
-- 적용 전 로컬 DB 실데이터 점검(psql, 2026-09-05): 위반 행 3건 발견 —
--   - cccccccc-0000-0000-0000-000000000001/2: seed.sql 고정 픽스처
--     (gpa=3.7, gpa_scale 미설정) — seed.sql에 gpa_scale='4.0'을 추가해 수정.
--   - e2476647-e2da-423b-ad45-4420e19c868c: 이전 세션의 수기 UAT 클릭 테스트로
--     남은 임시 로컬 행(sat_score=0, 커밋된 fixture 아님, 서비스는 오픈 전이라
--     실제 고객 데이터 아님) — `supabase db reset --local`로 초기화되어 이 행
--     자체가 제거된다. 임의로 값을 지어내 채우지 않았다.

-- =========================================================================
-- 1) SAT 유효 범위를 400~1600으로 좁힌다(기존 0~1600 대체)
-- =========================================================================
alter table students drop constraint if exists students_sat_score_range;
alter table students add constraint students_sat_score_range
  check (sat_score is null or (sat_score >= 400 and sat_score <= 1600));

comment on column students.sat_score is
  'M4 프로필 완성: SAT 점수. 미입력은 null. 입력 시 실제 유효 범위 400~1600만 허용 '
  '(2026-09-05 무결성 보강 — 기존 0~1600 범위를 좁힘).';

-- =========================================================================
-- 2) GPA ↔ gpa_scale 상호 필수/배제 + 척도 상한 검증
--    - gpa is null  ⇔ gpa_scale is null (둘 다 있거나 둘 다 없어야 함)
--    - gpa가 있으면 gpa_scale이 가리키는 만점을 초과할 수 없음(척도 텍스트
--      값 자체가 만점 숫자값과 같으므로 gpa <= gpa_scale::numeric로 검증)
-- =========================================================================
alter table students drop constraint if exists students_gpa_range;
alter table students add constraint students_gpa_requires_scale
  check ((gpa is null) = (gpa_scale is null));
alter table students add constraint students_gpa_within_scale
  check (gpa is null or gpa_scale is null or gpa <= gpa_scale::numeric);

comment on column students.gpa is
  'M4 프로필 완성: GPA, 선택 입력(nullable). 값이 있으면 gpa_scale이 반드시 함께 있어야 '
  '하고(students_gpa_requires_scale), 선택한 척도를 초과할 수 없다(students_gpa_within_scale) '
  '— 2026-09-05 무결성 보강.';
comment on column students.gpa_scale is
  'M4 UAT #2 후속: GPA 척도(4.0/4.3/4.5/5.0 만점). gpa와 항상 함께 있거나 함께 없어야 한다 '
  '(students_gpa_requires_scale, 2026-09-05 무결성 보강).';

-- =========================================================================
-- 3) complete_student_profile() — 서버(DB 함수) 레벨 검증 추가.
--    CHECK 제약과 같은 규칙을 여기서도 먼저 검증해 더 명확한 한국어 에러
--    메시지를 사용자에게 보여준다(DB 제약 위반 메시지보다 사용자 친화적).
--    시그니처는 불변 — CREATE OR REPLACE만 사용.
-- =========================================================================
create or replace function public.complete_student_profile(
  p_date_of_birth date,
  p_school_name text,
  p_grade text,
  p_sat_score integer,
  p_gpa numeric,
  p_target_colleges text[],
  p_intended_majors text[],
  p_gpa_scale text default null
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

  -- SAT: 입력값이 있으면 유효 범위(400~1600)만 허용.
  if p_sat_score is not null and (p_sat_score < 400 or p_sat_score > 1600) then
    raise exception 'SAT 점수는 400~1600 사이여야 합니다.';
  end if;

  -- GPA ↔ 척도: 값이 있으면 척도 필수, 척도만 있고 값이 없는 상태는 금지,
  -- 값은 선택한 척도의 만점을 초과할 수 없음(척도 텍스트 값=만점 숫자값).
  if p_gpa is not null and p_gpa_scale is null then
    raise exception 'GPA를 입력하려면 GPA 척도를 함께 선택해야 합니다.';
  end if;
  if p_gpa is null and p_gpa_scale is not null then
    raise exception 'GPA 척도만 선택하고 GPA 값이 없는 상태는 허용되지 않습니다.';
  end if;
  if p_gpa is not null and p_gpa_scale is not null and p_gpa > p_gpa_scale::numeric then
    raise exception 'GPA 값(%)이 선택한 척도(%)를 초과할 수 없습니다.', p_gpa, p_gpa_scale;
  end if;

  update students set
    school_name = btrim(p_school_name),
    grade = btrim(p_grade),
    sat_score = p_sat_score,
    gpa = p_gpa,
    gpa_scale = p_gpa_scale,
    target_colleges = coalesce(p_target_colleges, '{}'),
    intended_majors = coalesce(p_intended_majors, '{}'),
    profile_completed_at = now()
  where id = v_student_id;
end;
$$;
revoke execute on function public.complete_student_profile(date, text, text, integer, numeric, text[], text[], text) from public;
grant execute on function public.complete_student_profile(date, text, text, integer, numeric, text[], text[], text) to authenticated;
comment on function public.complete_student_profile(date, text, text, integer, numeric, text[], text[], text) is
  'M4 프로필 완성. 2026-09-05 무결성 보강: SAT 400~1600 범위, GPA↔척도 상호 필수/배제, '
  '척도 상한 초과 금지를 여기서 먼저 명확한 메시지로 검증(DB CHECK 제약이 최종 방어선으로 뒤에 있음).';
