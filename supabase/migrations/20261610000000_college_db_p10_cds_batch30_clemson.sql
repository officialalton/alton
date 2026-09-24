-- 30차 세션: Clemson University CDS 2024-2025 실수집 반영
-- Source: https://open.clemson.edu/cgi/viewcontent.cgi?article=1016&context=cds (Common Data Set 2024-2025, Fall 2024 cohort)
-- 표지 학교명 확인: "Clemson University" 일치

do $$
declare
  v_university_id uuid := '75acb621-c4b7-4f76-82a7-771fbf2f6f5d';
  v_source_url_id uuid := '93ab6500-5d08-4a06-9613-8c0dca75ab83';
  v_cycle_year int := 2024;
begin
  insert into university_admission_metrics
    (university_id, cycle_year, cohort, metric_key, value, verification_status, source_url_id, verified_at)
  values
    (v_university_id, v_cycle_year, 'applicant', 'applicants_count', 61517, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'admitted_count', 23586, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'enrolled_count', 4880, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'applicant', 'admit_rate', round(23586.0/61517*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'yield_rate', round(4880.0/23586*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'waitlist_offered', 11102, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'waitlist_accepted', 3598, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_submitted_pct', 35, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_submitted_pct', 20, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_25', 1250, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_50', 1320, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_75', 1400, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_25', 620, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_50', 660, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_75', 700, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_25', 620, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_50', 660, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_75', 710, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_25', 28, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_50', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_75', 32, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_25', 26, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_50', 28, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_75', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_25', 26, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_50', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_75', 34, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'retention_rate_year1', 93.5, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'grad_rate_6yr', 86.6, 'official', v_source_url_id, now())
  on conflict (university_id, cycle_year, cohort, metric_key) do update set
    value = excluded.value,
    verification_status = excluded.verification_status,
    source_url_id = excluded.source_url_id,
    verified_at = excluded.verified_at;

  update universities set data_collection_status = 'verified_pilot' where id = v_university_id;
end $$;
