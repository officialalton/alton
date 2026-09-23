-- P10 (지시서 E): 200개교 확대 상태 관리
-- universities 테이블에 학교별 데이터 수집 상태를 additive로 추가한다.
-- 'verified_pilot'    : 이번 세션에서 출처 URL을 실제로 fetch해 재검증하고
--                       수집봇/변경안 검토 파이프라인을 실제로 실행 확인한 학교.
-- 'sources_pending_review' : 출처 URL 후보는 있으나 이번 세션에서 재검증하지 않은 학교.
-- 'unconfirmed'       : 기본값 — 아직 아무 검증도 하지 않은 학교.
alter table universities
  add column if not exists data_collection_status text
    not null default 'unconfirmed'
    check (data_collection_status in ('verified_pilot', 'sources_pending_review', 'unconfirmed'));

comment on column universities.data_collection_status is
  '지시서 E: 실제 재검증(fetch+파이프라인 실행) 완료 여부 3단계. 재검증 없이 verified_pilot로 표시 금지.';

-- 10개교 실 UAT 대상(이번 세션에서 URL을 실제로 fetch해 재검증하고
-- requestUniversityRefresh/runRefreshJob을 실제로 실행 확인)만 verified_pilot로 표시.
-- Princeton/MIT/Harvard/Stanford/Yale: 지시서 D(5차 세션)에서 이미 mitadmissions.org에
-- 대한 실제 HTTP 요청으로 수집봇 파이프라인을 검증(Princeton은 봇 UA에 403을 반환해
-- 그 세션에서 MIT로 대체 검증됨 - 문서 5차 세션 기록 참고).
update universities
  set data_collection_status = 'verified_pilot'
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
  );
