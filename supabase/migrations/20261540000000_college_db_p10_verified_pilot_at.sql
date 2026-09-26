-- P10 마무리 세션: verified_pilot 상태에 "언제 재검증했는지" 시각을 함께 기록한다.
-- data_collection_status만으로는 재검증이 오래돼 다시 확인이 필요한지 알 수 없었음
-- (이전 세션 "결정 필요" 항목 중 순수 기술 항목만 이번 세션에서 마무리).
alter table universities
  add column if not exists data_collection_status_verified_at timestamptz;

comment on column universities.data_collection_status_verified_at is
  '지시서 E: data_collection_status가 verified_pilot로 바뀐(실제 재검증한) 시각. 상태만
   verified_pilot이고 이 값이 없으면 과거 데이터라는 뜻이므로 관리자 화면에서 함께 노출한다.';

-- 10개교 파일럿 백필 — docs/2026-09-23-university-info-sources-and-reports.md의
-- 지시서 D(5차 세션)/E(6차 세션) 실 WebFetch 재검증 기록 기준(모두 2026-09-23 세션 중 검증).
update universities
  set data_collection_status_verified_at = '2026-09-23T00:00:00Z'
  where name in (
    'Princeton University',
    'Massachusetts Institute of Technology',
    'Harvard University',
    'Stanford University',
    'Yale University',
    'University of Pennsylvania',
    'California Institute of Technology',
    'Duke University',
    'Brown University',
    'Johns Hopkins University'
  )
  and data_collection_status = 'verified_pilot';
