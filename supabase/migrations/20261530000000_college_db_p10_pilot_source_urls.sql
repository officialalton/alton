-- P10 계속: 이번 세션에서 실제 fetch로 재검증한 5개교(UPenn/Caltech/Duke/Brown/JHU)
-- 공식 입학 홈페이지 URL을 승인된 출처로 등록한다. Princeton/MIT/Harvard/Stanford/Yale은
-- 지시서 D(5차 세션)의 university_source_urls 백필에 이미 등록되어 있을 수 있으므로
-- 여기서는 새 5개교만 대상. submitted_by는 NULL 허용(관리자 직접 등록, admin action과 동일 패턴).
insert into university_source_urls (university_id, url, source_type, is_official, status, cycle_year, review_note)
select u.id, v.url, v.source_type, true, 'approved', 2027, v.notes
from (values
  ('University of Pennsylvania', 'https://admissions.upenn.edu/', 'admissions_homepage', '2026-09-23 WebFetch 재검증: 200 응답, 페이지 제목/도메인 일치 확인(Penn Admissions)'),
  ('California Institute of Technology', 'https://www.admissions.caltech.edu/', 'admissions_homepage', '2026-09-23 WebFetch 재검증: 200 응답, 페이지 제목/도메인 일치 확인(Caltech Undergraduate Admissions)'),
  ('Duke University', 'https://admissions.duke.edu/', 'admissions_homepage', '2026-09-23 WebFetch 재검증: 200 응답, 페이지 제목/도메인 일치 확인(Duke Undergraduate Admissions)'),
  ('Brown University', 'https://admission.brown.edu/', 'admissions_homepage', '2026-09-23 WebFetch 재검증: 200 응답, 페이지 제목/도메인 일치 확인(Brown Undergraduate Admission)'),
  ('Johns Hopkins University', 'https://apply.jhu.edu/', 'admissions_homepage', '2026-09-23 WebFetch 재검증: 200 응답, 페이지 제목/도메인 일치 확인(JHU Undergraduate Admissions)')
) as v(name, url, source_type, notes)
join universities u on u.name = v.name
where not exists (
  select 1 from university_source_urls s
  where s.university_id = u.id and s.url = v.url
);
