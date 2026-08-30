# Alton Education v3 개발자 전달서

- 상태: **최신 구현 지침**
- 제품·정책: `2026-08-29-product-architecture-v3.md`
- 실행 순서: `2026-08-29-master-roadmap-v3.md`
- R0 승인·기술 검증: `2026-08-29-r0-approval-and-technical-validation-package.md`
- 공통 용어: `../CONTEXT.md`

## 1. 요청 변경

기존 v2 계획의 목표였던 파일럿 우선순위를 폐기한다. 정식 오픈 전에 전체 고객 여정과 운영 수명주기를 완성하는 방향으로 범위를 재구성한다.

Google Workspace 전환만 별도로 구현하지 않는다. Calendar/Meet/Drive 연동 전에 계약, 과목 수강, 선생님 배정, 예약, 수업, 수업권, 정산의 경계를 먼저 고친다.

## 2. 착수 규칙

1. Gate A·B·C는 2026-08-30 완료. Gate C는 Google 기술 검증(GW-01~13)에서 데이터 모델을 바꿀 blocker 없음을 확인하고 완료됐다 — R1 구현 착수 가능. 다만 GW-10(보호자 거부 시 수동 리뷰 task), GW-12(`manual_review` 큐 적재·재처리), GW-14(보존·삭제 자동화)에 섞여 있던 ALTON 앱 워크플로우는 Gate C 범위 밖으로 분리해 R9/R8/R12의 필수 인수 기준(blocker)으로 이관했다 — 각 해당 절 구현을 "완료"로 보고하기 전에 반드시 이 인수 기준까지 통과시킨다(§3.11~3.13, `2026-08-29-master-roadmap-v3.md` R8/R9/R12 참고)
2. R1 스키마 리뷰 전 후속 UI의 데이터 계약 확정 금지
3. 미오픈 개발 서비스이므로 현재 DB를 백업한 뒤 v3 기준선을 만들고 필요한 테스트 계정만 검증 이전
4. 장기간 dual-write·무중단 운영 마이그레이션은 만들지 않되 검증 전 기존 테이블을 삭제하지 않음
5. **(2026-08-30 정정)** 새 쓰기 경로와 E2E가 통과한 뒤 기존 Calendly·Zoom·credit 경로를 완전히 제거한다. **DocuSign은 제거 대상이 아니다** — 계약 전자서명 서비스로 계속 사용하며 R3에서 신규 계약 구조(자녀별 계약·버전·Drive 장기보관)에 재연결한다. Calendly는 R2 Task 7(선생님 온보딩)과 R6(학생·보호자 예약)로 나눠 단계적으로 제거하고, Zoom은 R6에서 Google Meet로 완전히 대체한다. 현재 DB의 예약·계약·수업·credit 데이터는 실사용 이력이 아닌 개발·테스트 데이터이므로 레거시 제거 시 장기 보존·이관 없이 백업 후 폐기할 수 있다(`product-architecture-v3.md` §4.13 정정 참고, 로그인 테스트 계정·프로필은 예외로 유지).
6. 각 단계는 서버 권한·RLS·동시성·E2E·운영 재처리까지 포함

## 3. 최우선 스키마 교정

### 3.1 과목 수강과 선생님 배정

- `subject_enrollments`: student, subject, status, progress, contract relation
- `teacher_assignments`: subject_enrollment, teacher, effective range, reason, changed_by, source
- 활성 배정은 자녀·과목·시점당 하나만 허용
- 기존 `enrollments`는 백필 후 호환 레이어로 전환

### 3.2 세션 스냅샷

세션에 최소 다음을 직접 보존한다.

- subject_enrollment_id
- teacher_id
- lesson_type_id/version
- scheduled duration, actual start/end
- teacher hourly rate snapshot
- material version/snapshot
- reservation ID
- final status, reason, completed_by/at

과거 선생님·시급·교재를 현재 관계에서 역조회하지 않는다.

### 3.3 수업권

신규 코드의 canonical term은 `lesson entitlement`다. 기존 credit 테이블과 UI는 코드·화면 전환 대상이다 — 기존 credit 잔액·거래는 개발·테스트 데이터이므로 신규 entitlement 원장으로 데이터를 이관할 필요는 없다(§3.11 정정 참고).

- `lesson_types`: 수업 시간·형태 규격
- `entitlement_types`: 이용 가능한 lesson type과 소진 규칙의 버전
- `entitlement_products`: 판매 상품과 가격 버전
- `entitlement_grants`: 자녀에게 부여된 수업권 묶음
- `entitlement_holds`: 예약 중 확보된 수업권
- `entitlement_ledger`: grant/hold/release/consume/refund/expire/adjust

현재 기본값:

- 정규 1:1 수업 120분
- 수업권 1장으로 1회 예약
- 예약 확정 시 hold 1
- 정상 완료 시 consume 1
- 체험 60분은 수업권 미사용

유효기간·환불·이전 규칙:

- 기본 entitlement type version의 유효기간은 12개월이며 코드에 고정하지 않음
- grant에 `granted_at`, `original_expires_at`, 현재 `expires_at`, 지급 출처와 결제 원본 저장
- 예약 수업 시작 시각이 `expires_at` 이내인 grant만 hold 가능
- 할당 우선순위는 `expires_at ASC`, 동률이면 `granted_at ASC`
- 학생 정상 취소는 원래 만료일로 release하고, 늦은 취소·노쇼는 consume
- 선생님·회사 사유 취소는 release하며 만료까지 30일 미만이면 취소일+30일까지 extension 원장 항목 생성
- 환불 가능 수량은 동일 구매에서 발생한 미사용·미보류 유료 grant로 제한
- 기본 판매 상품은 20회 패키지이며 단건 회당가는 실제 구매 가능한 별도 가격 버전으로 관리
- 중도 해지 환불액은 `max(0, package_paid_amount - consumed_count × single_lesson_list_price_snapshot)`
- 늦은 취소·학생 노쇼 소진도 `consumed_count`에 포함하고 구매 당시 단건가를 스냅샷으로 보존
- 결제 화면과 계약에 단건가·패키지가·재정산 공식·계산 예시를 명확히 표시
- 무료·프로모션·보상 grant는 환불액 0
- 환불은 grant 삭제나 잔액 수정 대신 refund 원장 항목과 Stripe 환불 참조값으로 기록
- 자녀 간 셀프 이전 없음; 관리자가 미사용·미보류·호환 계약 조건을 검증한 뒤 transfer-out/transfer-in을 함께 생성
- 만료·연장·환불·이전·관리자 예외는 사유·처리자·시각과 이전 값을 감사 이력으로 보존

잔여량 캐시가 필요하면 원장과 대조 가능한 파생 캐시로만 둔다.

### 3.4 정산

- 시급은 effective date가 있는 이력으로 관리
- 계산 단위는 1분이며 `hourly_rate × payable_minutes ÷ 60`으로 계산
- Meet 실제 접속 시간, 브라우저 체류 시간, 네트워크 로그를 정산 소스로 사용하지 않음
- 예약 시간과 최종 수업 판정으로 `payable_minutes`를 확정
- 수업 완료 시 payout item에 teacher/rate/payable_minutes/type/source를 스냅샷
- 항목 금액은 소수 정밀도를 유지하고 payout batch 합계에서 원 단위 반올림
- payout batch는 item 합계를 승인·지급
- 지급 완료 후 원본 수정 대신 adjustment/reversal item 생성

### 3.5 화이트보드·필기

- full JSON last-write-wins 제거
- append 가능한 event와 주기적 snapshot 사용
- author, sequence, timestamp, document version, normalized coordinate 저장
- reconnect replay, duplicate event idempotency, clear/undo history
- 완료 세션 서버 쓰기 차단

### 3.6 선생님 지각 보충시간

보충시간은 수업권이나 독립 세션으로 모델링하지 않는다.

- 발생: 선생님 10분 이상 지각으로 제공하지 못한 분
- 당일 처리: 양쪽 동의와 이후 일정 충돌 없음이 확인되면 현재 reservation/session 종료 시각 연장
- 미래 처리: 잔여 분을 향후 동일 선생님의 정규 세션에 연결
- 가용성: 미래 세션 종료 뒤 추가 구간까지 선생님 가능 시간·Google busy·기존 예약과 충돌 검사
- 수업권: 추가 hold/consume 없음
- Calendar: 연결된 미래 이벤트의 종료 시각 연장
- 이력: triggering session, owed minutes, applied session, applied minutes, remaining minutes, status, timestamps
- 정산: 원래 수업은 미이행 분을 제외하고, 보충시간은 실제 적용된 미래 수업 완료 시 별도 인정

선생님 취소에는 우선권이 있는 재예약이나 해당 회차의 대체 선생님 배정 기능을 만들지 않는다. 기존 예약과 수업권 hold를 취소하고 학생이 일반 예약 흐름에서 별도의 새 예약을 만든다.

### 3.7 접속 기록과 최종 판정 분리

접속 기록은 향후 출석 분석과 품질 관리에 활용할 수 있도록 수집하되, 수업권 및 정산을 자동 결정하는 원본으로 사용하지 않는다.

- 참가자별 `joined_at`, `left_at`, `source`, 외부 참조값, 수집 시각 저장
- 한 참가자의 재접속을 덮어쓰지 않고 복수 접속 구간으로 저장
- source 예시: `google_meet`, `alton_join_click`, `session_view_presence`, `manual`
- Google Meet 참가자 기록의 제공 범위·권한·수집 지연을 먼저 기술 검증
- Meet 참가자 기록을 얻지 못한 경우 알톤의 입장 클릭이나 화면 체류를 실제 Meet 접속으로 표기하지 않음
- 접속 기록만으로 완료·노쇼·취소를 확정하거나 수업권 ledger와 payout item을 자동 생성하지 않음
- 최종 판정은 예약 상태, 당사자 신고, 관리자 확인, 확정 정책을 함께 적용해 별도로 기록

### 3.8 비정상 수업시간과 장애

- 정상 완료·학생 사유 조기 종료: entitlement 1 consume, `payable_minutes=120`, makeup 없음
- 선생님 사유 일부 진행: entitlement 1 consume, 제공 분만 payout item 생성, 미제공 분 makeup 생성
- 선생님 사유 최종 제공 분이 90분 미만이면 자동 QC case 생성
- 선생님 취소·노쇼로 미시작: hold release, `payable_minutes=0`
- 회사·Meet 장애로 미시작: 기존 예약 cancel, hold release, `payable_minutes=0`; 학생이 새 reservation 생성
- 회사·Meet 장애로 중단: entitlement 1 consume, 제공 분 payout, 미제공 분 makeup; 원래 수업과 makeup 합계 최대 120분
- `rebooked` 상태나 기존 예약 시간 이동을 만들지 않고 새 예약은 별도 reservation으로 생성하며 원인 예약 ID만 연결
- 제공 분은 Meet telemetry로 자동 확정하지 않고 신고·확인·관리자 판정 결과로 저장

### 3.9 과목 대화방과 관리자 조회

- thread scope는 child+subject+teacher assignment이며 선생님 변경 시 기존 thread를 read-only archive
- 학생-선생님 private DM 금지; 보호자를 기본 참가자로 포함
- 권한 있는 관리자는 모든 active/archived thread, message, attachment, edit/delete history, report 조회 가능
- 관리자 조회·내보내기·삭제·복원 작업은 audit event 생성
- 사용자 화면과 개인정보 고지에 관리자 조회 가능성을 표시

### 3.10 계속 계약과 해지

- child contract는 고정 만료일·자동 갱신·자동 결제 없는 evergreen 상태로 구현
- 20회권 재구매는 contract renewal이 아니라 기존 active contract에 연결된 새 purchase
- purchase마다 price/refund-policy/terms version snapshot 저장
- 중요 조건 변경 후 신규 구매 전에 guardian re-consent 필요
- 한 subject enrollment 종료가 다른 과목이나 child contract를 자동 종료하지 않음
- guardian termination은 미래 reservation별 취소정책 적용 후 패키지 할인 재정산
- company-convenience termination은 미사용 유료 수업권을 패키지 실결제 단가로 환불하며 discount recapture 없음
- 환불 승인 후 5영업일 이내 Stripe refund 요청 상태 생성
- 활성 과목·미래 예약·가용 수업권·미처리 금액/분쟁이 없는 상태가 12개월 지속될 때 30일 사전 알림 후 inactive termination 가능
- 자동 갱신·자동 결제는 향후 별도 subscription product와 consent version으로 추가 가능하게만 설계

### 3.11 데이터 보존과 삭제

**(2026-08-30 정정)** 아래 retention 기준은 정식 오픈 이후 실제 고객이 만드는 데이터에 적용한다. 오픈 전 개발·테스트로 생성된 예약·계약·수업·수업권(credit) 데이터는 실사용 업무 이력이 아니므로 이 정책의 적용 대상이 아니다 — 레거시 코드·테이블·컬럼 제거 시 안전한 백업과 롤백 지점만 남기면 이관 없이 폐기할 수 있다. 로그인 테스트 계정과 프로필은 업무 테스트 데이터와 구분해 유지한다.

- retention policy는 data category와 policy version으로 관리하고 코드 곳곳에 기간을 하드코딩하지 않음
- 7년: 계약·동의·결제·환불·수업권 원장·payout 회계 기록
- 3년: 최종 수업 기록·과제·필기 결과·리뷰·대화방·확정 출석·QC
- 12개월: Meet telemetry·화이트보드 원시 event·로그인/기기/보안 로그·미전환 상담 정보
- backup deletion lag 최대 35일
- account closure 즉시 인증·예약 차단, 진행 건 정리 후 일반 profile 30일 이내 삭제/익명화
- legal/accounting/safety hold는 별도 상태와 해제 조건을 가지며 일반 관리자가 무기한 설정하지 못함
- 13세 미만은 verified guardian consent 전 student account 활성화와 개인정보 수집 차단
- Google Drive·Supabase Storage·DB·메일의 삭제 작업을 하나의 deletion request로 추적
- 자동 만료·삭제 실패는 관리자 재처리함과 감사 이력 생성
- 사용자 요청에 대한 조회·정정·내보내기·삭제 처리 상태와 기한 저장
- **Gate C GW-14 인수 기준(blocker)**: 미검토 Smart Notes 원본(12개월)과 확정 리뷰(3년)가 서로 다른 만료일로 추적되고 실제로 자동 삭제되는지 인수 테스트로 확인해야 R12를 완료로 보고할 수 있다. Google Drive는 파일 만료를 네이티브로 지원하지 않아 Gate C 검증 범위 밖으로 분류됐다(`2026-08-29-gate-c-google-workspace-validation.md` §3 GW-14 참고)

### 3.12 Drive 자료 구조 자동화

- Shared Drive canonical path는 student→subject_enrollment→year→session이며 teacher path는 shortcut/view only
- child/enrollment/reservation/teacher-assignment domain event가 provisioning job을 생성
- 일반 운영 경로에 수동 폴더 생성·수동 ACL 부여 절차를 두지 않음
- job마다 idempotency key와 대상 Drive file ID를 저장하고 중복 이벤트가 폴더·권한을 중복 생성하지 않게 함
- teacher assignment 시작 시 과목 폴더 직접 권한 생성, 종료 시 동일 permission ID 회수
- teacher를 Shared Drive 전체 member로 추가하지 않음
- SmartNote `fileGenerated` 후 세션 폴더로 원본 이동, file ID·parent·driveId·Calendar attachment 검증
- 이동 실패나 세션 미식별은 `reconciliation_needed`로 보내고 관리자 재처리
- **Gate C GW-12 인수 기준(blocker)**: Drive/Meet API가 반환하는 오류(예: 잘못된 fileId)가 실제로 `manual_review`/`reconciliation_needed` 큐에 적재되고 재처리 배치가 정상 동작하는지 인수 테스트로 확인해야 R8을 완료로 보고할 수 있다. Gate C에서는 Google API가 안정적으로 재현 가능한 오류를 반환함(Pass)까지만 검증했다(`2026-08-29-gate-c-google-workspace-validation.md` §3 GW-12 참고)
- 학생·보호자 요청은 Drive ACL이 아니라 ALTON 관계 권한을 검사한 서버를 통해 전달
- Drive는 final artifact, Supabase Storage는 temporary/cache, DB는 artifact state와 접근 원장

### 3.13 Gemini 리뷰

- guardian별 `ai_notes_consent`와 동의/거부 policy version 저장. Google Meet 입장 시 명시적 동의와 별개로, 보호자 사전 거부가 우선
- 거부 학생의 Meet space는 `autoSmartNotesGeneration=OFF`
- 기본은 Smart Notes ON, 영상·원본 음성 recording OFF, 별도 Meet `Transcribe the meeting` OFF
- Smart Notes 문서에 Google이 포함·연결하는 수반 텍스트 전사는 허용하되 원본 Smart Notes와 같은 제한 권한·12개월 보관정책 적용. student/guardian API에는 원문 전사를 노출하지 않음
- Admin Console의 visual content는 `Only allow ... when recording is enabled`; ALTON은 녹화를 켜지 않으며 Gate C에서 실제 스크린샷 미생성을 검증
- raw SmartNote→teacher_reviewing→published/failed 상태 분리
- 18h reminder, 24h overdue queue, 36h QC case
- published review만 student/guardian API에서 조회 가능
- AI 초안 내용과 teacher final revision, 수정자·시각·source document ID 보존
- Smart Notes 실패는 수업 완료 트랜잭션을 막지 않고 수동 리뷰 task 생성
- **Gate C GW-10 인수 기준(blocker)**: 보호자가 AI 회의록을 거부했을 때 실제로 수동 리뷰 task가 생성되는지 인수 테스트로 확인해야 R9을 완료로 보고할 수 있다. Gate C에서는 Google API로 세션 단위 `autoSmartNotesGeneration=OFF` 전환이 가능함(Pass)까지만 검증했다(`2026-08-29-gate-c-google-workspace-validation.md` §3 GW-10 참고). 별도 텍스트 전사 tab 생성 여부는 회의 조건에 따라 비결정적임이 실측 확인됐으므로, "생성될 수 있다"는 전제로 제한 접근·12개월 보관정책을 예외 없이 적용한다

### 3.14 다중 통화와 정산 주기

- 모든 금액은 `amount_minor`와 ISO 4217 `currency`를 함께 저장하고 통화 없는 숫자 금지
- household billing currency 기본 USD, purchase마다 실제 currency와 price version snapshot
- refund는 original payment currency와 Stripe payment/refund reference 사용
- teacher rate history에 amount/currency/effective_from 저장; 기본 KRW
- payout item은 세션 당시 rate currency를 snapshot하고 서로 다른 통화를 합산하지 않음
- payout batch는 단일 currency만 허용하고 currency 변경 전후 item을 분리
- reporting currency 기본 USD; FX snapshot은 리포트 변환에만 사용하고 원장 금액을 수정하지 않음
- 월말 close→다음 달 3영업일 statement→5영업일 dispute→10영업일 payment 상태 전이

### 3.15 예약·교육 운영 기본값

- student booking window: 수업 시작 최소 24시간 전, 최대 8주 후; admin override만 예외
- teacher buffer: 연속 예약 사이 최소 15분
- recurring booking: 최대 8회, 회차별 entitlement hold, 부족하면 가능한 회차까지만 원자적으로 생성
- reminder: 24h/2h, entitlement 3/1/0, expiry 30d/7d, assignment due 24h
- assignment 기본 due는 다음 수업 24시간 전; late/resubmit 허용, 미제출 예약 차단 없음
- upload allowlist: PDF/Google Docs/DOCX/PPTX/XLSX/JPG/PNG, max 50MB; archive/executable/video 차단
- automatic QC: delivered<90, Smart Notes fail, review>36h, report, tardy/no-show, repeated cancel, new teacher first 3, random 5%

## 4. 반드시 검증할 시나리오

### 관계 변경

- 한 자녀가 두 과목을 동시에 수강
- 한 과목 선생님만 변경
- 과거 세션과 정산은 이전 선생님 유지
- 미래 확정 예약은 자동 이전되지 않음
- 새 선생님에게 현재 진도와 필요한 문서만 인계

### 수업권

- 10장 구매→1회 예약 시 available 9, held 1
- 무료 취소→available 10
- 완료→consumed 1, available 9
- 동시 두 예약이 마지막 1장을 함께 확보하지 못함
- Stripe 동일 이벤트 재전송이 중복 지급하지 않음
- 미래 신규 수업권 유형 추가가 과거 구매 의미를 바꾸지 않음
- 만료일이 다른 수업권 중 가장 임박한 수업권이 먼저 hold됨
- 만료일 이후 시작하는 수업에는 해당 수업권을 hold할 수 없음
- 학생 정상 취소는 원래 만료일로 복원되고 만료일이 연장되지 않음
- 선생님·회사 취소로 복원된 수업권의 잔여 유효기간이 30일 미만이면 취소일+30일까지 연장됨
- 20회 패키지 중도 해지 환불이 구매 당시 실제 단건 판매가로 소진분을 재계산함
- 단건가×소진 회차가 결제액보다 크면 환불액이 0원이며 음수 청구는 발생하지 않음
- 무료·프로모션·보상 수업권은 환불액을 만들지 않음
- 관리자 이전이 양쪽 자녀 원장과 감사 이력에 동일 참조값으로 남음
- 사용·보류 중인 수업권과 호환 계약이 없는 자녀로의 이전이 거절됨

### 수업 기록

- 수업 후 교재 원본 수정에도 과거 화면 불변
- 학생·선생님 동시 필기 후 재접속해도 모든 선 보존
- iPad와 데스크톱에서 같은 위치에 필기 표시
- 완료 세션 수정 거절, 관리자 재개방은 감사 이력 생성

### 정산

- 월중 시급 변경 전후 수업에 서로 다른 시급 적용
- 선생님 변경 전후 수업이 각 선생님에게 귀속
- 체험 완료는 기존 시급으로 회사 부담 item 생성
- 체험 당일 취소·노쇼는 item 미생성
- 지급 완료 후 보정은 역분개로 추적
- 선생님 사유로 89분 제공 시 자동 QC case 생성
- 회사·Meet 장애로 미시작 시 수업권 복원·0분 정산·새 예약 생성
- 회사·Meet 장애로 중단 시 원 수업과 보충시간의 총 인정시간이 120분을 넘지 않음

### 메시지

- 관리자 권한으로 모든 활성·보관 과목 대화방을 검색·조회
- 관리자 조회와 내보내기가 감사 이력에 남음
- 학생과 선생님만 존재하는 비공개 대화방 생성이 거절됨
- 선생님 변경 후 이전 대화방은 읽기 전용이며 새 선생님은 자동으로 과거 대화 전체를 받지 않음

### 계약·데이터 수명주기

- 20회권 추가 구매가 기존 계약을 덮어쓰거나 새 계약으로 오인되지 않음
- 과목 하나 종료 후 다른 과목과 계약이 유지됨
- 보호자 사유 해지와 회사 사유 해지에 서로 다른 환불 기준 적용
- 휴면 종료 조건 중 하나라도 충족하지 않으면 계약 자동 종료 안 됨
- 13세 미만 학생이 보호자 동의 전에 로그인·수업 참여·메시지 작성 불가
- 데이터 종류별 만료 작업이 Google Drive와 Supabase까지 추적되고 실패 시 재처리 가능
- legal hold 데이터는 일반 삭제에서 제외되고 해제 후 다시 만료 계산

### Drive·AI·통화

- 동일 이벤트 재전송이 학생·과목·세션 폴더 또는 teacher permission을 중복 생성하지 않음
- 선생님 변경 시 원본 폴더 이동 없이 이전 권한 회수·새 권한 부여가 완료됨
- Drive 이동 실패·권한 회수 실패가 관리자 재처리함에 표시됨
- 보호자 AI 회의록 거부 학생의 수업에서 Smart Notes가 생성되지 않음
- 리뷰 미확정 18/24/36시간 경계에서 알림·목록·QC가 각각 한 번만 생성됨
- USD 구매를 KRW 시급 선생님이 수업해도 두 원장 금액이 환산 없이 각각 보존됨
- 선생님 지급 통화 변경일 전후 수업이 서로 다른 단일통화 정산 묶음에 포함됨
- 환불이 원결제 통화로 처리되고 보고 환율 변경이 환불액·지급액을 바꾸지 않음

### 학생 취소·출석

- 시작 24시간 전까지 일반 취소: 수업권 hold 해제, 수업권 미소진, 선생님 비용 미지급
- 시작 24시간 미만 늦은 취소: 수업권 1장 소진, 선생님 120분 비용 지급
- 시작 후 15분까지 학생 접속이 없고 노쇼가 최종 확인됨: 수업권 1장 소진, 선생님 120분 비용 지급
- 학생 지각: 예정 종료 시각 유지, 수업권 1장 소진, 선생님 120분 비용 지급
- 학생 지각 시 선생님의 자발적 연장은 가능하지만 의무가 아니며 별도 보충시간을 생성하지 않음
- 관리자 예외 처리 시 수업권 ledger, payout adjustment, audit event가 함께 남음
- 접속 기록만으로 위 결과가 자동 확정되지 않음

## 5. 구현 완료의 정의

기능은 다음이 모두 있어야 완료다.

- 사용자 happy path
- 취소·실패·중복·재시도·권한 우회 경로
- DB 제약과 트랜잭션
- 서버 권한과 RLS
- 단위·통합·E2E 테스트
- 관리자 확인·수정·재처리 화면
- 구조화 로그와 감사 이력
- 마이그레이션과 롤백
- 운영 문서와 환경변수 문서

### 5.1 DB·스키마 변경이 포함된 작업의 추가 완료 기준

R1 데이터 기반 재설계 라운드(2026-08-30, 실행 로그
`2026-08-29-r1-migration-execution-log.md` §5~8)에서 SQL 정적 검토와 postgres
superuser 테스트만으로는 실제 버그(RLS 자기참조 재귀, 컬럼 한정 누락으로 인한 권한
우회, 두 테이블 간 RLS 상호 재귀, 락 순서 오류로 인한 entitlement 동시성 결함)를 전혀
잡아내지 못했다. 위 일반 체크리스트 중 "DB 제약과 트랜잭션", "서버 권한과 RLS",
"마이그레이션과 롤백" 세 항목은 DB·스키마를 바꾸는 모든 작업(R1뿐 아니라 이후 전
단계)에서 구체적으로 아래를 의미한다 — master-roadmap-v3.md "1-1. 모든 단계 공통
Definition of Done"과 동일한 기준이다.

1. 스키마·함수·정책을 바꾸기 전에 현재 앱 화면·서버 액션·웹훅이 해당 테이블·함수를
   어디서 어떻게 쓰는지 전수 조사한다.
2. 기존 이름을 즉시 rename/삭제하지 않고 shadow 이름으로 새 구조를 만든 뒤, 앱 코드
   전환과 함께 원자적으로 cutover하는 전략을 명시한다.
3. `migration apply`/`db push`가 오류 없이 끝났다는 사실 자체는 완료 기준이 아니다.
4. RLS가 있는 모든 신규/변경 테이블은 실제 관련 역할 전부(학생/보호자/담당 선생님/
   비담당 선생님/관리자/익명 등)로 `SET ROLE` + JWT 클레임 시뮬레이션으로 조회·쓰기
   결과를 실측한다(superuser/service_role 테스트만으로는 불충분). 동시 접근 가능한
   잔액·락·상태 전이 로직은 실제 동시 트랜잭션(백그라운드 세션 2개 이상)으로 경쟁
   상태의 직렬화를 검증한다. 해당 작업이 건드리는 주요 화면은 로컬 dev 서버로 골든
   패스·엣지 케이스를 직접 확인하고, 관련 웹훅은 실제/Sandbox 페이로드로 재현하며,
   타입 검사·빌드를 통과시킨다.
5. 실제 원격 환경에 적용하기 전에 신규/변경/rename 대상과 손대지 않는 기존 범위를
   구체적으로 사전 보고하고 승인받는다.
6. 롤백 절차는 "이론상 가능"이 아니라 로컬/테스트 환경에서 실제로 실행해 검증한다.
7. 해당 단계 시점에 상위 기능이 아직 없어 검증 불가능한 항목은 누락하지 않고, 반드시
   구체적인 후속 R 단계를 지정해 그 단계의 완료 기준에 blocker로 명시적으로 이관한다.

## 6. 개발자가 임의로 결정하지 않을 정책

다음 항목은 R0에서 제품 담당자가 확정한 뒤 구현한다.

- 현재 없음. 신규 정책이 생기면 이 목록에 추가한다.

패키지 환불, 미성년자 데이터와 보존 문구는 서비스 제공 지역 기준으로 법률 검토한 뒤 약관 문구를 확정한다.

## 7. 기존 구현에 대한 주의

- 현재 `enrollments.teacher_id`를 직접 바꾸는 방식으로 선생님 변경을 구현하지 않는다.
- 현재 `sessions`가 enrollment를 통해 선생님을 역조회하는 정산 방식을 유지하지 않는다.
- `students.credit_balance`를 신규 수업권 원본으로 사용하지 않는다.
- 교재 최신 본문을 과거 세션에 그대로 렌더링하지 않는다.
- 완료·취소·노쇼를 하나의 완료 화면 상태로 묶지 않는다.
- 화이트보드 전체 배열을 참가자가 각자 덮어쓰지 않는다.
- 이미 완료된 기능이라도 v3 불변 규칙과 충돌하면 호환 마이그레이션 대상으로 본다.
