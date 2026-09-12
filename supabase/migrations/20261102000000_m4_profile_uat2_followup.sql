-- M4 UAT #2 후속(2026-09-05 낮 세션) — 제품 오너 확정 정책 4건 반영
--
-- 배경: docs/CURRENT.md "M4 UAT 종합 검증 라운드" #2 절에서 결정 필요로 남겨둔
-- 항목 중, 이번 라운드에서 제품 오너가 확정한 것만 반영한다(전면 재작성 아님):
--   1) 생년월일 최초 1회 자가입력(protect_date_of_birth) — 기존 구현이 이미
--      정책과 일치 — 변경 없음.
--   2) 관리자가 화면에서 "확인 완료" 버튼으로 생년월일을 검증 — 신규 컬럼
--      profiles.date_of_birth_verified_at/verified_by.
--   3) 체험수업 시작 전 관리자 확인 완료 게이트 —
--      grant_trial_entitlement_for_consultation()에 추가(체험수업권 자동 지급
--      시점이 가장 이른 강제 지점 — 여기서 막으면 애초에 예약에 쓸 수업권 자체가
--      생기지 않는다).
--   4) SAT 미입력은 0이 아니라 null 저장 — sat_score를 nullable로 전환하고
--      기본값을 null로 변경. 오픈 전 상태(운영 데이터 없음)이지만 기존에 0으로
--      들어간 행이 실제 0점인지 미입력 기본값인지 구분 불가능하므로, 기존 값은
--      임의로 바꾸지 않는다(그대로 유지) — 신규 입력부터만 null 허용.
--   5) GPA 척도(gpa_scale) 컬럼 추가 — additive, nullable.

-- =========================================================================
-- 1) profiles: 생년월일 관리자 확인 기록
-- =========================================================================
alter table profiles
  add column if not exists date_of_birth_verified_at timestamptz,
  add column if not exists date_of_birth_verified_by uuid references profiles (id);

comment on column profiles.date_of_birth_verified_at is
  'M4 UAT #2 후속: 관리자가 학생 생년월일을 화면에서 "확인 완료" 처리한 시각. '
  'null이면 미확인 — 체험수업권 지급 게이트(grant_trial_entitlement_for_consultation)가 '
  '이 값을 검사한다. 신원확인 서류 등 별도 절차 없이 관리자 버튼 1개로 기록만 남긴다.';
comment on column profiles.date_of_birth_verified_by is
  'M4 UAT #2 후속: 확인 처리한 관리자 profiles.id. 감사용 기록.';

-- =========================================================================
-- 2) 관리자 전용 확인 처리 함수
-- =========================================================================
create or replace function public.verify_student_date_of_birth(p_student_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 생년월일 확인 처리를 할 수 있습니다.';
  end if;
  if not exists (select 1 from profiles where id = p_student_id and role = 'student') then
    raise exception '학생 계정을 찾을 수 없습니다: %', p_student_id;
  end if;
  if not exists (select 1 from profiles where id = p_student_id and date_of_birth is not null) then
    raise exception '생년월일이 아직 입력되지 않아 확인할 수 없습니다.';
  end if;

  update profiles
  set date_of_birth_verified_at = now(),
      date_of_birth_verified_by = auth.uid()
  where id = p_student_id;
end;
$$;
revoke execute on function public.verify_student_date_of_birth(uuid) from public;
grant execute on function public.verify_student_date_of_birth(uuid) to authenticated;
comment on function public.verify_student_date_of_birth(uuid) is
  'M4 UAT #2 후속: 관리자 화면(StudentDetailPanel) "생년월일 확인 완료" 버튼이 호출. '
  '복잡한 신원확인 절차 없이 확인자·확인시각만 기록.';

-- =========================================================================
-- 3) 체험수업 시작 전 관리자 확인 게이트 —
--    grant_trial_entitlement_for_consultation()에 추가(20261015000000의
--    최종본을 그대로 가져와 게이트 한 블록만 추가, 나머지 로직 불변)
-- =========================================================================
create or replace function public.grant_trial_entitlement_for_consultation(
  p_consultation_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_child_id uuid;
  v_existing_grant_id uuid;
  v_new_grant_id uuid;
  v_trial_product_id uuid;
  v_expires_at timestamptz;
begin
  select child_id into v_child_id from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_child_id is null then
    raise exception '연결된 학생 계정이 없어 체험수업권을 지급할 수 없습니다(잠재고객 단계 — 정식 학생 계정 연결 후 재시도 필요).';
  end if;

  -- M4: 학생별 체험 Smart Notes 동의가 없으면 지급 자체를 막는다(요구사항 4·5).
  if not exists (select 1 from trial_smart_notes_consents where child_id = v_child_id) then
    raise exception '체험 Smart Notes 동의가 없어 체험수업권을 지급할 수 없습니다(학생 id: %).', v_child_id;
  end if;

  -- M4 UAT #2 후속: 관리자가 생년월일을 확인 완료하지 않은 학생에게는 체험수업권을
  -- 지급하지 않는다 — 체험수업 시작 전에는 관리자 확인이 완료돼 있어야 한다는
  -- 정책을, 지급 시점(체험 예약에 쓸 수업권 자체가 생기는 가장 이른 강제 지점)에서
  -- 막는다.
  if not exists (
    select 1 from profiles where id = v_child_id and date_of_birth_verified_at is not null
  ) then
    raise exception '관리자의 생년월일 확인이 완료되지 않아 체험수업권을 지급할 수 없습니다(학생 id: %).', v_child_id;
  end if;

  select id into v_existing_grant_id from entitlement_grants where source_consultation_id = p_consultation_id;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  -- M4: 상담 재처리/중복 상담으로 같은 학생에게 반복 지급되지 않도록 학생 기준으로도
  -- 방어(요구사항 5). 이미 이 학생 앞으로 활성 grant가 있으면 그 grant를 반환한다.
  select eg.id into v_existing_grant_id
  from entitlement_grants eg
  join entitlement_products ep on ep.id = eg.entitlement_product_id
  where eg.child_id = v_child_id and ep.code = 'trial_lesson_grant'
  limit 1;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  select id into v_trial_product_id from entitlement_products where code = 'trial_lesson_grant';
  if v_trial_product_id is null then
    raise exception '체험수업권 상품(trial_lesson_grant)이 존재하지 않습니다 — 마이그레이션 순서 문제.';
  end if;

  v_expires_at := now() + interval '90 days';

  begin
    insert into entitlement_grants (
      child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at,
      is_paid, source_consultation_id
    ) values (
      v_child_id, v_trial_product_id, null, 1, v_expires_at, false, p_consultation_id
    )
    returning id into v_new_grant_id;
  exception when unique_violation then
    select id into v_new_grant_id from entitlement_grants where source_consultation_id = p_consultation_id;
    if v_new_grant_id is not null then
      return v_new_grant_id;
    end if;
    raise;
  end;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (v_new_grant_id, 'grant', 1, 'trial_grant:' || p_consultation_id::text)
  on conflict do nothing;

  return v_new_grant_id;
end;
$$;
comment on function public.grant_trial_entitlement_for_consultation(uuid) is
  'M2 요구사항 2·4 + M4 동의 게이트 + M4 UAT #2 후속 생년월일 확인 게이트: 학생별 체험 '
  'Smart Notes 동의와 관리자 생년월일 확인(profiles.date_of_birth_verified_at)이 모두 '
  '있어야만, 그리고 학생당 정확히 1개만 지급. is_paid=false로 생성되므로 환불·이전 대상에서 자동 제외.';
revoke execute on function public.grant_trial_entitlement_for_consultation(uuid) from public, anon, authenticated;

-- =========================================================================
-- 4) SAT 미입력은 0이 아니라 null — nullable 전환, 기본값 null.
--    기존에 0으로 들어간 행은 실제 0점 입력인지 미입력 기본값인지 구분 불가능
--    하므로 임의로 바꾸지 않는다(오픈 전 상태 전제 — 그대로 유지, 신규 입력부터만
--    null 허용). check 제약은 null을 허용하도록 재작성.
-- =========================================================================
alter table students alter column sat_score drop not null;
alter table students alter column sat_score drop default;
alter table students drop constraint if exists students_sat_score_range;
alter table students add constraint students_sat_score_range
  check (sat_score is null or (sat_score >= 0 and sat_score <= 1600));

comment on column students.sat_score is
  'M4 프로필 완성: 기존 SAT 점수. M4 UAT #2 후속(2026-09-05)부터 미입력은 null로 저장 '
  '(이전엔 기본값 0 — 0점 실제 입력과 구분 불가능한 문제가 있었음). 오픈 전이라 기존 '
  '0 값 행은 실제 0점인지 미입력인지 구분 불가능해 임의 변환하지 않고 그대로 둔다 — '
  '폼에서 빈 칸=null 전송, 명시적 0 입력=0 전송으로만 앞으로의 입력을 구분한다.';

-- =========================================================================
-- 5) GPA 척도 — gpa_scale 컬럼 추가(additive, nullable)
-- =========================================================================
alter table students
  add column if not exists gpa_scale text
  check (gpa_scale is null or gpa_scale in ('4.0', '4.3', '4.5', '5.0'));

comment on column students.gpa_scale is
  'M4 UAT #2 후속: GPA 척도(예: 4.0/4.3/4.5/5.0 만점). gpa 점수와 함께 저장 — '
  '선택 입력(nullable).';

-- =========================================================================
-- 6) complete_student_profile() 갱신 — SAT null 통과 + gpa_scale 저장.
--    시그니처가 바뀌므로(gpa_scale 파라미터 추가) 기존 7-인자 함수를 지우고
--    8-인자로 새로 만든다(마지막 인자는 default null이라 named-param 호출인
--    기존 앱 코드는 그대로 호환).
-- =========================================================================
drop function if exists public.complete_student_profile(date, text, text, integer, numeric, text[], text[]);

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
  'M4 UAT #2 후속(2026-09-05): p_sat_score는 이제 null 통과 허용(미입력=null, 기본값 0 강제하지 '
  '않음) — coalesce 제거. p_gpa_scale 신규 파라미터(선택).';
