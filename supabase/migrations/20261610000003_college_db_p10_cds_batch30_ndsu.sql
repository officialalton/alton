-- 30차 세션: North Dakota State University CDS 2024-2025 실수집 반영 (Fall 2024 cohort)
-- Source: https://www.ndsu.edu/sites/default/files/fileadmin/oira/Common_Data_Set/NDSU_CDS_2024-2025.xlsx
-- 표지/본문 학교명 확인: "North Dakota State University" 일치

do $$
declare
  v_university_id uuid := '9d3e7a84-bd14-43f6-bd23-69b8c8c7bc6c';
  v_source_url_id uuid := 'e6c56207-cb82-48fe-883f-5be33e59f889';
  v_cycle_year int := 2024;
begin
  insert into university_admission_metrics
    (university_id, cycle_year, cohort, metric_key, value, verification_status, source_url_id, verified_at)
  values
    (v_university_id, v_cycle_year, 'applicant', 'applicants_count', 7228, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'admitted_count', 6864, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'enrolled_count', 2197, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'applicant', 'admit_rate', round(6864.0/7228*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'yield_rate', round(2197.0/6864*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_submitted_pct', 0.59, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_submitted_pct', 51.80, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_25', 1130, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_50', 1280, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_75', 1430, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_25', 540, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_50', 640, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_75', 670, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_25', 550, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_50', 630, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_75', 690, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_25', 19, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_50', 22, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_75', 25, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_25', 18, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_50', 23, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_75', 26, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_25', 17, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_50', 21, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_75', 24, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_writing_25', 6, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_writing_50', 7, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_writing_75', 8, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_25', 20, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_50', 23, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_75', 26, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_25', 19, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_50', 23, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_75', 27, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'gpa_average', 3.52, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'retention_rate_year1', 78.42, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'grad_rate_6yr', 63.89, 'official', v_source_url_id, now())
  on conflict (university_id, cycle_year, cohort, metric_key) do update set
    value = excluded.value,
    verification_status = excluded.verification_status,
    source_url_id = excluded.source_url_id,
    verified_at = excluded.verified_at;

  update universities set data_collection_status = 'verified_pilot' where id = v_university_id;
end $$;
