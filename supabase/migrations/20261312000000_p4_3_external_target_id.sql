-- P4-3 — 회사 문서 접근 기록이 저장되지 않던 문제.
--
-- document_access_events.target_id는 uuid다. 계약 서명본·교사 제출 서류는
-- 우리 DB의 행이라 uuid가 맞지만, 회사 문서는 Google Drive의 파일이고 그 id는
-- uuid가 아니다("1g71Jn4A2OVdlwuDIQuKUiNdtn4DWXVGv"). 그래서 회사 문서를 열면
-- Drive 읽기는 성공하고 감사 기록에서 깨졌다 — 20261307000000에서
-- company_document 종류만 추가하고 id 모양을 보지 않은 탓이다.
--
-- uuid 컬럼을 text로 바꾸지 않는다. 기존 두 종류는 진짜 uuid이고, 그 타입이
-- 오타·잘못된 참조를 걸러주고 있다. 외부 식별자는 별도 컬럼에 담는다.
alter table document_access_events
  add column target_external_id text;

alter table document_access_events
  alter column target_id drop not null;

comment on column document_access_events.target_external_id is
  'P4-3: 외부 시스템의 식별자(회사 문서 = Google Drive file id). 우리 DB의 행을 '
  '가리키는 target_id와 배타적으로 쓴다.';

-- 둘 중 정확히 하나만 채운다. 둘 다 비면 무엇을 봤는지 알 수 없고, 둘 다 차면
-- 어느 쪽이 진짜인지 알 수 없다.
alter table document_access_events
  add constraint document_access_events_target_id_or_external
  check (num_nonnulls(target_id, target_external_id) = 1);

-- 회사 문서는 외부 식별자를, 나머지는 내부 uuid를 쓴다.
alter table document_access_events
  add constraint document_access_events_target_id_shape
  check (
    case target_kind
      when 'company_document' then target_external_id is not null
      else target_id is not null
    end
  );

create index on document_access_events (target_external_id);
