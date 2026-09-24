-- 30차 세션: New Jersey Institute of Technology CDS 2024-2025 실수집 반영 (Fall 2024 cohort)
-- Source: https://www.njit.edu/oie/sites/njit.edu.oie/files/CDS_2024-2025_v12.xlsx
-- 표지/본문 학교명 확인: NJIT 일치

do $$
declare
  v_university_id uuid := '8e01db76-2425-4b3f-a3e8-61d7f040dc5b';
  v_source_url_id uuid := 'fffe78d3-b86d-4aba-9cea-fca55bb5f5bc';
  v_cycle_year int := 2024;
begin
  insert into university_admission_metrics
    (university_id, cycle_year, cohort, metric_key, value, verification_status, source_url_id, verified_at)
  values
    (v_university_id, v_cycle_year, 'applicant', 'applicants_count', 15607, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'admitted_count', 10156, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'enrolled_count', 1746, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'applicant', 'admit_rate', round(10156.0/15607*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'yield_rate', round(1746.0/10156*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'waitlist_offered', 3621, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'waitlist_accepted', 2520, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'waitlist_admitted', 827, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_submitted_pct', 40, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_submitted_pct', 3, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_25', 1235, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_50', 1340, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_75', 1460, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_25', 610, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_50', 650, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_75', 710, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_25', 630, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_50', 680, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_75', 760, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_25', 28, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_50', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_75', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_25', 27, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_50', 32, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_75', 35, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_25', 26, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_50', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_75', 35, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_25', 27, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_50', 32, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_science_75', 35, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_25', 28, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_50', 32, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_reading_75', 35, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'gpa_average', 3.73, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'retention_rate_year1', 90, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'grad_rate_6yr', 72.84, 'official', v_source_url_id, now())
  on conflict (university_id, cycle_year, cohort, metric_key) do update set
    value = excluded.value,
    verification_status = excluded.verification_status,
    source_url_id = excluded.source_url_id,
    verified_at = excluded.verified_at;

  update universities set data_collection_status = 'verified_pilot' where id = v_university_id;
end $$;
