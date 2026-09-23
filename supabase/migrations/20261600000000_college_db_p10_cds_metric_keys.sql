-- P10 10차 세션: Common Data Set(CDS) 상세 지표 확장
-- 배경: 관리자가 프린스턴 CDS 2025-2026 공식 PDF를 업로드하여 검토한 결과, 기존
-- metric_key 화이트리스트(체크 제약)가 CDS의 영역별 SAT/ACT 25/50/75, GPA 4.0 비율,
-- 대기자명단, 재학유지율, 졸업률, 등록금 등 세부 지표를 저장할 수 없었다.
-- 이 마이그레이션은 university_admission_metrics.metric_key 체크 제약에 추가 키를
-- 허용하도록 확장한다(additive, 데이터 삭제 없음).

alter table public.university_admission_metrics
  drop constraint university_admission_metrics_metric_key_check;

alter table public.university_admission_metrics
  add constraint university_admission_metrics_metric_key_check
  check (
    metric_key = any (array[
      'sat_total_25','sat_total_50','sat_total_75',
      'sat_ebrw_25','sat_ebrw_50','sat_ebrw_75',
      'sat_math_25','sat_math_50','sat_math_75',
      'act_composite_25','act_composite_50','act_composite_75',
      'act_math_25','act_math_50','act_math_75',
      'act_english_25','act_english_50','act_english_75',
      'act_writing_25','act_writing_50','act_writing_75',
      'act_science_25','act_science_50','act_science_75',
      'act_reading_25','act_reading_50','act_reading_75',
      'sat_submitted_pct','act_submitted_pct',
      'gpa_average','top10pct_pct','ap_ib_indicator',
      'gpa_4_0_pct_all','gpa_4_0_pct_submitters','gpa_4_0_pct_nonsubmitters',
      'applicants_count','admitted_count','enrolled_count',
      'admit_rate','yield_rate',
      'waitlist_offered','waitlist_accepted','waitlist_admitted',
      'retention_rate_year1','grad_rate_6yr',
      'tuition_total'
    ])
  );
