-- Mirrors 통합 세션의 20261800000000_college_db_p12_admission_metrics_keys_ext.sql
-- (그쪽에서 non-prod에 이미 적용, 이 파일은 로컬 워크트리 DB 정합성 유지용)
alter table university_admission_metrics drop constraint if exists university_admission_metrics_metric_key_check;
alter table university_admission_metrics add constraint university_admission_metrics_metric_key_check
check (metric_key = ANY (ARRAY[
  'sat_total_25','sat_total_50','sat_total_75','sat_ebrw_25','sat_ebrw_50','sat_ebrw_75',
  'sat_math_25','sat_math_50','sat_math_75','act_composite_25','act_composite_50','act_composite_75',
  'act_math_25','act_math_50','act_math_75','act_english_25','act_english_50','act_english_75',
  'act_writing_25','act_writing_50','act_writing_75','act_science_25','act_science_50','act_science_75',
  'act_reading_25','act_reading_50','act_reading_75','sat_submitted_pct','act_submitted_pct',
  'gpa_average','top10pct_pct','ap_ib_indicator','gpa_4_0_pct_all','gpa_4_0_pct_submitters',
  'gpa_4_0_pct_nonsubmitters','applicants_count','admitted_count','enrolled_count','admit_rate',
  'yield_rate','waitlist_offered','waitlist_accepted','waitlist_admitted','retention_rate_year1',
  'grad_rate_6yr','tuition_total','total_undergrad_enrollment',
  'ap_credit_accepted','ap_min_score_required','ap_max_credits','tuition_in_state','tuition_out_of_state',
  'tuition_international','required_fees','room_cost','board_cost','net_price_average',
  'student_faculty_ratio','academic_calendar'
]));
