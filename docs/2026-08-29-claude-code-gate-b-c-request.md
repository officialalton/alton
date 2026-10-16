# Claude Code 요청 — Gate B 설계 및 Gate C 기술 검증

작성일: 2026-08-29  
현재 상태: Gate A 승인 완료, Gate B·C 미승인  
작업 성격: 구현 전 조사·설계·Sandbox 검증

## 1. 먼저 읽을 문서

아래 순서대로 읽고 서로 충돌하면 앞선 문서를 우선한다.

1. `../CONTEXT.md`
2. `2026-08-29-product-architecture-v3.md`
3. `2026-08-29-r0-approval-and-technical-validation-package.md`
4. `2026-08-29-developer-handoff-v3.md`
5. `2026-08-29-master-roadmap-v3.md`
6. `README.md`

`tickets.md`, `prompts/`, `spec/schema-draft.md`, v2 문서와 `superpowers/`의 기존 계획은 현재 구현과 결정 이력을 확인할 때만 사용한다. 그 문서의 Calendly·Zoom·DocuSign·크레딧·파일럿 정책을 신규 설계 근거로 사용하지 않는다.

## 2. 이번 요청의 목표

Gate A에서 승인된 제품 정책을 바꾸지 말고 다음 두 제출물을 만든다.

1. Gate B: 현재 코드·마이그레이션·개발 DB를 v3로 전환하기 위한 실행 전 설계
2. Gate C: `ALTON Integration Sandbox`에서 GW-01~14를 검증한 결과 또는 검증을 막는 정확한 사전조건

서비스는 아직 오픈 전이다. 운영 무중단 전환이나 장기간 dual-write를 전제로 설계하지 않는다.

## 3. Gate B 제출물

`docs/2026-08-29-gate-b-migration-and-permission-design.md`를 작성한다. 코드를 변경하기 전에 다음을 모두 포함한다.

- 현재 실제 테이블·enum·constraint·index·RLS·server action 목록
- 현재 테이블에서 v3 개체로 가는 필드 매핑표
- 신규·변경·폐기 대상과 변경 이유
- 계약, 과목 수강, 선생님 배정, 예약, 수업, 수업권, 보충시간, 리뷰, 정산, Drive artifact의 FK와 불변 규칙
- 상태 전이별 허용 명령, 수행 주체, 트랜잭션 경계
- 학생·보호자·선생님·관리자·Supervisor capability별 RLS와 서버 권한 설계
- service-role을 사용해야 하는 최소 작업과 각 업무 권한 검사
- 기존 테스트 계정·fixture의 유지/재생성/폐기 구분
- 백필 규칙, 자동 변환 불가 데이터, 수동 검토 목록
- 실행 순서, 검증 쿼리, feature flag 또는 전환 방식, 롤백 순서
- 단위·통합·E2E·동시성·idempotency 테스트 계획
- 현재 코드에서 즉시 발견되는 v3 위반 목록과 후속 R 단계 배치

DDL이나 마이그레이션 초안을 제시할 수는 있지만 아직 실행하지 않는다. 기존 테이블·데이터·외부 연동을 삭제하지 않는다.

## 4. Gate C 제출물

`docs/2026-08-29-gate-c-google-workspace-validation.md`를 작성한다.

- Workspace 에디션, Smart Notes 지원, 필요한 관리자 설정과 OAuth scope 확인
- Sandbox Shared Drive, 자동화 계정, 테스트 선생님 2명, 테스트 학생·보호자 준비 상태
- 승인 패키지의 GW-01~14별 실행 절차, 실제 결과, pass/fail, 증빙 위치
- Drive file ID, Calendar event ID, Meet space ID는 문서에서 마스킹
- 중복 이벤트, 권한 회수, 실패 재시도, 학생·보호자 직접 ACL 0건을 별도로 확인
- Smart Notes가 녹화·축어 전사·스크린샷 없이 가능한지 실제 계정에서 검증
- 지원되지 않거나 관리자 설정이 필요한 항목은 추정하지 말고 blocker, 필요한 조치, 대안을 구분
- 기술 제약이 제품 정책에 영향을 주면 정책을 임의 변경하지 말고 선택지와 영향만 보고

Sandbox나 권한이 아직 준비되지 않았다면 임의로 운영 Drive를 만들거나 다른 계정으로 우회하지 않는다. 대신 사용자가 준비할 정확한 Admin Console 체크리스트와 검증 재개 지점을 제출한다.

## 5. 이번 단계에서 하지 않을 일

- 파괴적 스키마 변경 또는 기존 데이터 삭제
- 기존 Calendly·Zoom·DocuSign·credit 경로 제거
- R1 이후 UI 구현
- 정책값의 임의 변경
- 실제 학생·보호자에게 메일·초대·Calendar 이벤트 발송
- 운영용 폴더나 권한을 Sandbox 대신 사용

## 6. 완료 보고 형식

1. 생성한 Gate B·C 문서 링크
2. 확인한 현재 구조의 핵심 충돌 요약
3. Gate B 승인에 필요한 질문과 선택지
4. GW-01~14 pass/fail/blocker 표
5. 변경한 파일 목록
6. 실행한 읽기 전용 검사와 결과
7. 다음 단계에서 승인이 필요한 작업

Gate B와 Gate C 제출 후 작업을 멈추고 검토를 요청한다. 승인을 받았다고 가정해 R1 구현으로 넘어가지 않는다.
