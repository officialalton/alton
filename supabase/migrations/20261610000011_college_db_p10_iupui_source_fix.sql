-- 30차 세션: IUPUI(Indiana University-Purdue University Indianapolis) 등록 오류 수정
-- 29차 세션에서 발견된 문제: 기존 approved 처리된 common_data_set URL
--   (https://www.purdue.edu/idata/products-services/common-data-set.php)
-- 이 실제로는 Purdue University West Lafayette 본교의 CDS 페이지였음 (IUPUI/IU Indianapolis와 무관).
-- 2024년 IUPUI가 IU Indianapolis(학사)/IU Columbus(공학 일부)로 개편되면서 관리 주체도 IU로 이전됨.
-- 확인 경로: irds.indianapolis.iu.edu/reports-presentations/common-data-set.html
--   -> "To find Common Data Set information for IUPUI, please go to https://uirr.iu.edu/apps/cds/"
--   (uirr.iu.edu/apps/cds/ -> iuia.iu.edu 로 리다이렉트되는 IU 전체 캠퍼스 공식 CDS 애플리케이션)
-- 해당 앱은 캠퍼스 선택 파라미터가 필요한 동적 웹앱이라 이번 세션에서 자동화 도구로 Indianapolis 캠퍼스 페이지의
-- 최종 렌더 데이터까지는 확보하지 못함 (관리자 검토/수동 확인 필요로 계속 남김).

do $$
declare
  v_university_id uuid := '435a52f7-d6d1-4146-b878-3424aa34d371';
  v_wrong_source_id uuid := '80fc7ee0-d14d-49ce-b9cf-0c96932f5a06';
begin
  -- 잘못된 출처(Purdue West Lafayette CDS 페이지) reject 처리
  update university_source_urls
  set status = 'rejected',
      review_note = '30차 세션 확인: 이 URL은 Purdue University(West Lafayette) 본교의 CDS 페이지이며 IUPUI/IU Indianapolis와 무관. irds.indianapolis.iu.edu 안내에 따르면 IUPUI CDS는 uirr.iu.edu/apps/cds/(iuia.iu.edu 캠퍼스별 앱)에서 확인해야 함.',
      reviewed_at = now()
  where id = v_wrong_source_id and university_id = v_university_id;

  -- 올바른 공식 출처(IU 전체 캠퍼스 공용 CDS 앱, Indianapolis 캠퍼스 선택 필요)를 pending으로 신규 등록
  insert into university_source_urls (university_id, url, source_type, is_official, status, review_note)
  values (
    v_university_id,
    'https://uirr.iu.edu/apps/cds/',
    'common_data_set',
    true,
    'pending',
    '30차 세션: irds.indianapolis.iu.edu 공식 안내로 확인한 IU 전체 캠퍼스 CDS 앱 진입점(Indianapolis 캠퍼스 데이터 확인 필요, 캠퍼스 선택 파라미터 미확인으로 자동화 접근 실패 - 관리자 수동 확인 요망).'
  )
  on conflict do nothing;
end $$;
