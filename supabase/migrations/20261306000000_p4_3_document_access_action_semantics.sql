-- P4-3 2단계 보완 — 감사 기록의 의미를 정확히 맞춘다(2026-09-12 제품 오너 지적).
--
-- 직전 정의는 서버가 Drive에서 바이트를 확보한 직후를 `download_completed`로
-- 적었다. 그것은 **사용자의 다운로드 완료가 아니다** — 서버가 파일을 손에 넣은
-- 시점일 뿐이고, 브라우저가 실제로 저장했는지는 이 앱이 알 수 없다.
--
-- 확인할 수 없는 것을 확인한 것처럼 적지 않는다. 값을 아래로 바꾼다.
--
--   download_requested  요청이 인가를 통과해 접근을 시작했다
--   file_retrieved      서버가 원본 바이트를 확보해 응답으로 넘겼다
--                       (브라우저 저장 여부는 여기서 보장하지 않는다)
--   download_url_issued 서명 URL을 내줬다(교사 서류 — 내려받았는지는 모른다)
--   download_failed     인가 통과 뒤 확보·전달에 실패했다
--
-- "사용자가 받아 갔다"를 뜻하는 값은 두지 않는다. 필요해지면 클라이언트가
-- 저장 완료를 별도로 보고하는 경로를 만들고 그때 값을 추가한다.

-- 기존 값을 새 의미로 옮긴다(로컬·비프로덕션 검증 데이터만 존재한다).
update document_access_events set action = 'download_requested' where action = 'download_started';
update document_access_events set action = 'file_retrieved' where action = 'download_completed';

alter table document_access_events
  drop constraint if exists document_access_events_action_check;
alter table document_access_events
  add constraint document_access_events_action_check
  check (action in ('download_requested', 'file_retrieved', 'download_url_issued', 'download_failed'));

comment on column document_access_events.action is
  'download_requested: 인가를 통과해 접근을 시작했다. '
  'file_retrieved: 서버가 원본 바이트를 확보해 응답으로 넘겼다 — 브라우저 저장 여부는 보장하지 않는다. '
  'download_url_issued: 서명 URL을 내줬다(실제 내려받았는지는 알 수 없다). '
  'download_failed: 인가 통과 뒤 확보·전달에 실패했다. '
  '"사용자 다운로드 완료"를 뜻하는 값은 의도적으로 두지 않는다 — 이 앱이 확인할 수 없기 때문이다.';
