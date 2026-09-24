-- 30차 세션: Gonzaga University CDS 2025-2026 실수집 반영 (Fall 2025 cohort) - 5개 세션째 이월된 unconfirmed 해소
-- Source: https://www.gonzaga.edu/__data/assets/file/0022/217471/Gonzaga-University-CDS-2025-2026.pdf
-- 이전 세션들은 봇 차단(curl 등)으로 실패. 이번 세션에서 브라우저 자동화 + pdf.js 캔버스 렌더링으로 페이지 이미지를 직접 읽어 확보.
-- 표지(A1) 학교명 확인: "Gonzaga University", Spokane, Washington 일치

do $$
declare
  v_university_id uuid := '195e3316-2b3b-405c-8d1b-a5f28e8f7887';
  v_source_url_id uuid;
  v_cycle_year int := 2025;
begin
  insert into university_source_urls (university_id, url, source_type, is_official, status, reviewed_at, review_note)
  values (
    v_university_id,
    'https://www.gonzaga.edu/__data/assets/file/0022/217471/Gonzaga-University-CDS-2025-2026.pdf',
    'common_data_set',
    true,
    'approved',
    now(),
    '30차 세션: 브라우저 자동화(pdf.js 캔버스 렌더링)로 실제 데이터 확인 및 승인. 5개 세션째 이월된 unconfirmed 해소.'
  )
  returning id into v_source_url_id;

  insert into university_admission_metrics
    (university_id, cycle_year, cohort, metric_key, value, verification_status, source_url_id, verified_at)
  values
    (v_university_id, v_cycle_year, 'applicant', 'applicants_count', 8906, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'admitted_count', 7091, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'enrolled_count', 1130, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'applicant', 'admit_rate', round(7091.0/8906*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'admitted', 'yield_rate', round(1130.0/7091*100, 2), 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'waitlist_offered', 676, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'waitlist_accepted', 241, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'waitlist_admitted', 66, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_submitted_pct', 10, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_submitted_pct', 6, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_25', 1230, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_50', 1320, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_total_75', 1383, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_25', 620, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_50', 670, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_ebrw_75', 710, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_25', 590, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_50', 640, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'sat_math_75', 690, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_25', 29, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_50', 30, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_composite_75', 32, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_25', 27, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_50', 28, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_math_75', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_25', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_50', 31, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'act_english_75', 34, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'gpa_average', 3.70, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'retention_rate_year1', 90, 'official', v_source_url_id, now()),
    (v_university_id, v_cycle_year, 'enrolled', 'grad_rate_6yr', 86.00, 'official', v_source_url_id, now())
  on conflict (university_id, cycle_year, cohort, metric_key) do update set
    value = excluded.value,
    verification_status = excluded.verification_status,
    source_url_id = excluded.source_url_id,
    verified_at = excluded.verified_at;

  update universities set data_collection_status = 'verified_pilot' where id = v_university_id;
end $$;
