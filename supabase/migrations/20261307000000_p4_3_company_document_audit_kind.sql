-- P4-3 4단계 — 회사 문서 접근도 같은 감사 표에 남긴다.
--
-- 계약 서명본·교사 제출 서류와 같은 기준으로 다룬다. 표를 새로 만들지 않고
-- target_kind 값 하나를 더한다 — 어떤 종류든 "누가·무엇을·언제 열었는가"를
-- 한 곳에서 되짚을 수 있어야 한다.
alter table document_access_events
  drop constraint if exists document_access_events_target_kind_check;
alter table document_access_events
  add constraint document_access_events_target_kind_check
  check (target_kind in ('contract_artifact', 'teacher_document', 'company_document'));

comment on column document_access_events.target_kind is
  'contract_artifact: drive_artifacts.id. teacher_document: teacher_documents.id. '
  'company_document: 회사 문서 Drive의 fileId(내부 표가 없으므로 Drive id를 그대로 쓴다).';
