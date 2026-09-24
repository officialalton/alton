-- 30차 세션: Oklahoma State University CDS 2024-2025 실수집 반영
-- Source: https://ira.okstate.edu/site-files/documents/cds/cds2425.pdf (Fall 2024 cohort)
-- 표지 학교명 확인: Oklahoma State University (Stillwater) 일치

do $$
declare
  v_university_id uuid := 'b2a726a8-8b10-459d-af6c-46801db4c1b0';
  v_source_url_id uuid := '5c440a0c-06b3-4e14-9869-c6582ef16e23';
  v_cycle_year int := 2024;
begin
  insert into university_admission_metrics
    (university_id, cycle_year, cohort, metric_key, value, verification_status, source_url_id, verified_at)
  values
    (v_university_id, v_cycle_year, 'applicant', 'applicants_count', 24910, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'admitted_count', 18693, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'enrolled_count', 5030, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'applicant', 'admit_rate', round(18693.0/24910*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'yield_rate', round(5030.0/18693*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_submitted_pct', 20.4, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_submitted_pct', 64.8, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_25', 1040, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_50', 1150, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_75', 1240, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_25', 530, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_50', 580, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_75', 630, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_25', 510, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_50', 570, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_75', 620, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_25', 20, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_50', 23, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_75', 27, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_25', 18, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_50', 22, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_75', 26, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_25', 19, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_50', 22, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_75', 26, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_25', 20, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_50', 23, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_75', 26, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_25', 21, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_50', 24, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_75', 29, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'gpa_average', 3.59, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'retention_rate_year1', 84.80, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'grad_rate_6yr', 65.87, 'official', v_source_url_id, now())
  on conflict (university_id, cycle_year, cohort, metric_key) do update set
    value = excluded.value,
    verification_status = excluded.verification_status,
    source_url_id = excluded.source_url_id,
    verified_at = excluded.verified_at;

  update universities set data_collection_status = 'verified_pilot' where id = v_university_id;
end $$;
