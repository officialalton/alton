-- 30차 세션: University of Dayton CDS 2025-2026 실수집 반영 (Fall 2025 cohort)
-- Source: https://docs.google.com/document/d/1LcfkO0vQyFI2JUUA9rgVqINRu6XkSagx (linked from udayton.edu/provost/ods/common_data_set.php, public UDayton CDS doc)
-- 표지/본문 학교명 확인: "Dayton, Ohio" respondent office 일치

do $$
declare
  v_university_id uuid := '4e4a6b84-d26e-4309-bd0b-9eb6b21cce44';
  v_source_url_id uuid := 'e4a921ec-da8a-41a7-a23b-547138c50425';
  v_cycle_year int := 2025;
begin
  insert into university_admission_metrics
    (university_id, cycle_year, cohort, metric_key, value, verification_status, source_url_id, verified_at)
  values
    (v_university_id, v_cycle_year, 'applicant', 'applicants_count', 22247, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'admitted_count', 14814, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'enrolled_count', 1578, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'applicant', 'admit_rate', round(14814.0/22247*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'yield_rate', round(1578.0/14814*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_submitted_pct', 10, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_submitted_pct', 27, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_25', 1210, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_50', 1270, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_75', 1350, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_25', 610, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_50', 650, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_75', 690, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_25', 600, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_50', 640, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_75', 690, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_25', 26, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_50', 29, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_75', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_25', 26, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_50', 28, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_75', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_25', 24, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_50', 28, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_75', 33, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_25', 25, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_50', 28, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_75', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_25', 27, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_50', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_75', 33, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'gpa_average', 3.78, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'retention_rate_year1', 90, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'grad_rate_6yr', 80.4, 'official', v_source_url_id, now())
  on conflict (university_id, cycle_year, cohort, metric_key) do update set
    value = excluded.value,
    verification_status = excluded.verification_status,
    source_url_id = excluded.source_url_id,
    verified_at = excluded.verified_at;

  update universities set data_collection_status = 'verified_pilot' where id = v_university_id;
end $$;
