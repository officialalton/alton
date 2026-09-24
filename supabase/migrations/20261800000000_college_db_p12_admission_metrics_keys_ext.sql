-- ALTON: university_admission_metrics.metric_key CHECK 제약에 12개 신규 키 추가
-- (AP 학점 인정, 학비 세분화, 학생 대 교수 비율, 학사력) — 데이터 수집팀(43차 세션)
-- 요청. additive(기존 값 제거 없음). CHECK 제약은 drop 후 재생성해야 하므로
-- create or replace 불가 — 이미 적용된 버전이 있어도 이 파일을 새 번호로 다시
-- 실행하면 같은 결과가 되도록 drop constraint if exists 패턴을 쓴다.

alter table university_admission_metrics drop constraint if exists university_admission_metrics_metric_key_check;

alter table university_admission_metrics add constraint university_admission_metrics_metric_key_check
  check (metric_key = any (array[
    'sat_total_25', 'sat_total_50', 'sat_total_75',
    'sat_ebrw_25', 'sat_ebrw_50', 'sat_ebrw_75',
    'sat_math_25', 'sat_math_50', 'sat_math_75',
    'act_composite_25', 'act_composite_50', 'act_composite_75',
    'act_math_25', 'act_math_50', 'act_math_75',
    'act_english_25', 'act_english_50', 'act_english_75',
    'act_writing_25', 'act_writing_50', 'act_writing_75',
    'act_science_25', 'act_science_50', 'act_science_75',
    'act_reading_25', 'act_reading_50', 'act_reading_75',
    'sat_submitted_pct', 'act_submitted_pct', 'gpa_average', 'top10pct_pct',
    'ap_ib_indicator', 'gpa_4_0_pct_all', 'gpa_4_0_pct_submitters', 'gpa_4_0_pct_nonsubmitters',
    'applicants_count', 'admitted_count', 'enrolled_count', 'admit_rate', 'yield_rate',
    'waitlist_offered', 'waitlist_accepted', 'waitlist_admitted',
    'retention_rate_year1', 'grad_rate_6yr', 'tuition_total', 'total_undergrad_enrollment',
    -- 2026-09-24(43차 세션 요청) 신규 12개 — AP 학점 인정/학비 세분화/학생-교수 비율/학사력.
    'ap_credit_accepted', 'ap_min_score_required', 'ap_max_credits',
    'tuition_in_state', 'tuition_out_of_state', 'tuition_international',
    'required_fees', 'room_cost', 'board_cost', 'net_price_average',
    'student_faculty_ratio', 'academic_calendar'
  ]::text[]));

comment on constraint university_admission_metrics_metric_key_check on university_admission_metrics is
  'metric_key 허용값 목록. 확장 시 이 파일을 새 timestamp로 복제해 drop+add 하는 패턴을 유지한다(create or replace 불가한 CHECK 제약).';
