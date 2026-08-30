# ALTON R0 승인 및 기술 검증 패키지

작성일: 2026-08-29  
상태: **Gate A 제품 승인 완료**  
승인일: 2026-08-29  
승인 범위: 3절 도메인 경계, 4절 상태 전이, 5절 역할·권한  
남은 게이트: 없음 — Gate A·B·C 전부 완료(2026-08-30), R1 착수 가능. Gate C에서 R8/R9/R12로 이관한 인수 기준은 해당 R 단계 완료 조건으로 남아있음  
적용 문서: `CONTEXT.md`, `2026-08-29-product-architecture-v3.md`, `2026-08-29-master-roadmap-v3.md`, `2026-08-29-developer-handoff-v3.md`

## 1. 목적

R1 데이터 구조 변경 전에 다음 네 가지를 순서대로 통과시킨다.

1. 제품 담당자: 상태 전이표 승인
2. 제품 담당자: 역할·권한표 승인
3. 개발자: 현재 개발 DB에서 v3로 옮기는 스키마·데이터 변환안 제출
4. 개발자: 실제 `alton.education` Workspace에서 Calendar·Meet·Smart Notes·Drive 권한 자동화 검증

법률 문서 검토는 R0/R1을 막지 않지만 정식 오픈 게이트 R13 전에 완료한다.

## 2. 현재 구현에서 확인된 구조 충돌

현재 코드는 프로토타입으로 유지할 수 있지만 다음 항목은 v3 기준선과 충돌한다.

| 현재 구조 | 문제 | v3 방향 |
|---|---|---|
| `enrollments.student_id + teacher_id + subject_id` | 과목 수강과 선생님 배정이 한 행에 결합 | `subject_enrollments`와 기간이 있는 `teacher_assignments` 분리 |
| `students.credit_balance` | 잔여량 직접 수정 가능 | grant/hold/release/consume/refund/expire 원장 |
| `sessions.duration_minutes default 30` | 정규 120분·체험 60분 정책과 충돌 | versioned lesson type snapshot |
| `sessions`가 현재 enrollment로 선생님 역조회 | 선생님 변경 시 과거 귀속 불안정 | 세션 당시 teacher/rate/lesson/material snapshot |
| `session_status`가 upcoming/completed/cancelled/no_show | 학생·선생님·회사 사유와 중단 구분 불가 | 예약 상태와 수업 최종 판정 분리 |
| `makeup_credits.count` | 분 단위 보충시간을 표현하지 못함 | owed/applied/remaining minutes 원장 |
| `whiteboard_strokes jsonb` 전체 저장 | 동시 필기 덮어쓰기 위험 | append event + snapshot |
| 현재 선생님 관계를 사용하는 RLS | 선생님 변경 후 과거·현재 접근 범위가 모호 | assignment 기간·세션 snapshot 기반 권한 |
| 일부 server action의 service-role 우회 | RLS 우회가 업무 권한 검사를 대체할 위험 | 서버 capability 검사 후 제한된 service action |

서비스가 아직 오픈 전이므로 운영 데이터 무중단 이전이나 장기간 dual-write는 만들지 않는다.

## 3. 도메인 경계 승인안

| 개체 | 책임 | 다른 개체와 섞지 않는 것 |
|---|---|---|
| Household | 보호자·자녀·기본 결제 통화 | 계약, 수업권 잔액 |
| Contract | 자녀별 서비스·가격·정책 동의 버전 | 과목 상태, 선생님 배정 |
| Subject Enrollment | 자녀가 한 과목을 배우는 지속 관계 | 당시 선생님, 예약 한 건 |
| Teacher Assignment | 자녀·과목에 선생님이 배정된 기간 | 과거 수업 귀속 변경 |
| Reservation | 시간·Calendar·Meet·수업권 hold | 실제 교육 결과 |
| Session | 실제 수업 기록과 당시 snapshot | 현재 선생님 관계 |
| Lesson Entitlement | 자녀의 120분 정규 수업 1회 이용 권리 | 금액·통화 |
| Makeup Time | 선생님·회사 사유 미제공 분 의무 | 독립 수업권 |
| Session Review | AI 초안과 선생님 확정 리뷰 | 출석·정산 자동 판정 |
| Payout Item | 세션 당시 선생님·시급·통화·인정 분 | 월 합계 직접 수정 |
| Drive Artifact | 확정 자료의 회사 소유 파일 참조 | 사용자 접근권한 원장 |

## 4. 상태 전이 승인안

### 4.1 상담 건

`requested → scheduled → completed → trial_planned → trial_completed → proposed → contracted → converted`

- 상담 예약 취소·노쇼는 상담 건을 삭제하지 않고 일정 결과로 기록한다.
- 전환하지 않는 건은 종료 사유가 있는 `closed`로 끝낸다.

### 4.2 계약

`draft → ready → sent → awaiting_signature → signed → active → termination_pending → terminated`

- `void`: 서명 전 무효
- `superseded`: 중요 조건 변경으로 새 버전이 대체
- `expired`: 향후 고정기간 상품에만 사용
- 20회권 추가 구매는 계약 상태를 갱신하지 않는다.

### 4.3 과목 수강

`planned → active ↔ paused → completed/terminated`

- 한 과목 종료가 다른 과목이나 자녀 계약을 종료하지 않는다.
- 선생님 변경은 과목 수강 상태를 바꾸지 않는다.

### 4.4 선생님 배정

`planned → active → ended`

- 같은 자녀·과목에 같은 시점의 active 배정은 최대 하나다.
- 변경 시 과거 행을 수정하지 않고 기존 배정을 종료한 뒤 새 배정을 만든다.

### 4.5 예약

`holding → confirmed → cancelled/failed/reconciliation_needed`

- 다시 예약은 상태가 아니다. 기존 예약을 취소하고 별도의 새 예약을 만든다.
- 새 예약은 원인 예약 ID를 선택적으로 참조한다.
- Calendar·Meet·Drive 실패는 사용자 예약 상태와 외부 동기화 상태를 분리해 재처리한다.

### 4.6 수업

`scheduled → live → completed`

예외 최종 판정:

- `student_cancelled`
- `teacher_cancelled`
- `student_no_show`
- `teacher_no_show`
- `company_cancelled`
- `interrupted`

최종 판정에는 처리자·사유·판정 시각·수업권 결과·정산 인정 분을 보존한다.

### 4.7 수업 리뷰

`pending_source → ai_draft/manual_draft → teacher_reviewing → published`

- `generation_failed`: Gemini 생성 실패 후 수동 작성 필요
- `revision_requested`: 학생·보호자 정정 요청
- 공개 후 수정은 새 revision을 만들고 기존 버전을 보존한다.

### 4.8 수업권

수업권 묶음의 잔액 상태를 직접 수정하지 않는다. 다음 원장 이벤트로 계산한다.

`grant → hold → release/consume → expire/refund/transfer/adjust`

- 하나의 hold는 하나의 reservation만 참조한다.
- consume/refund/expire는 이미 종료된 동일 수량을 다시 종료할 수 없다.

### 4.9 정산

Payout item: `pending → approved → batched → paid`

- 정정은 `adjustment/reversal` 항목을 추가한다.
- Payout batch: `draft → reviewing → approved → processing → paid/failed`
- 하나의 batch는 하나의 통화만 가진다.

### 4.10 Drive 작업

`queued → processing → succeeded/retryable_failed/manual_review`

- 폴더·권한·Smart Notes 이동은 사용자 기능 상태와 분리한다.
- 실패를 성공으로 표시하거나 수동 처리 후 이력을 삭제하지 않는다.

### 4.11 결제·환불

결제 시도: `created → processing → succeeded/failed/cancelled/reconciliation_needed`

환불 요청: `requested → reviewing → approved/rejected → processing → succeeded/failed`

- 구매 상태는 결제·환불 원장에서 `pending/paid/partially_refunded/refunded/disputed`로 파생한다.
- Stripe 응답이 불명확하면 성공이나 실패로 추정하지 않고 `reconciliation_needed`에서 재조회한다.
- 실패한 환불을 완료로 표시하지 않으며 재시도와 관리자 조정 이력을 보존한다.

## 5. 역할·권한 승인안

표기: `O` 허용, `조회` 읽기 전용, `요청` 직접 변경 없이 관리자 흐름 생성, `-` 금지

| 기능 | 학생 | 보호자 | 선생님 | 관리자 | Supervisor capability |
|---|---:|---:|---:|---:|---:|
| 본인 프로필 조회·수정 | O | O | O | O | 사용자 권한 필요 |
| 자녀 관계 조회 | 본인만 | O | 담당 학생만 | O | 학생관리 권한 |
| 계약 서명·결제·환불 요청 | - | O | - | O | 계약/결제 권한 분리 |
| 수업권·구매내역 조회 | O | O | - | O | 결제 권한 |
| 수업권 원장 조정 | - | - | - | O, 사유 필수 | 수업권 조정 권한 |
| 예약 생성·정상 취소 | O | 조회 | - | O | 예약관리 권한 |
| 선생님 가능 시간 관리 | - | - | 본인 O | O | 선생님관리 권한 |
| 과목·선생님 배정 변경 | 요청 | 요청 | 요청 | O | 매칭 권한 |
| 수업 참여·필기 | O | 조회 | O | 필요 시 조회 | QC 권한 |
| 과제 제출 | O | 조회 | 조회·피드백 | O | 교육관리 권한 |
| AI 원본 회의록 조회 | - | - | 담당 수업 O | O | QC 권한 |
| 확정 수업 리뷰 조회 | O | O | 담당/과거 본인 수업 | O | QC 권한 |
| 리뷰 작성·공개 | - | 정정 요청 | 담당 선생님 | O | QC 권한 |
| 과목 대화방 | O | O | 담당 배정 중 O | 전체 조회 | 메시지감사 권한 |
| 선생님 정산 항목 조회 | - | - | 본인 조회 | O | 정산 권한 |
| 정산 승인·지급 완료 | - | - | 이의제기 | O | 승인/지급 권한 분리 |
| Drive 원본 폴더 직접 접근 | - | - | 담당 과목만 | O | 문서관리 권한 |
| 관리자 감사 로그 | - | - | 본인 관련 제한 조회 | O | 감사 권한 |

### 5.1 권한 불변 규칙

1. 서비스 키가 RLS를 우회하더라도 서버 업무 권한 검사를 생략하지 않는다.
2. 학생은 세션 행 전체를 update하지 않고 허용된 필기·과제 명령만 수행한다.
3. 선생님은 enrollment나 assignment를 직접 수정하지 않는다.
4. 관리자는 지급 완료 정산·소진된 수업권·완료 세션을 직접 덮어쓰지 않고 보정 이벤트를 만든다.
5. Supervisor는 역할명 하나로 전체 관리자 권한을 받지 않고 capability를 조합한다.
6. 보호자 AI 회의록 거부는 학생이나 선생님이 임의 해제하지 못한다.

## 6. 개발 DB→v3 마이그레이션 제출 요구사항

현재 서비스는 미오픈 상태이므로 다음 단순화 전략을 사용한다.

### 6.1 개발자가 제출할 문서

- 현재 테이블→v3 테이블 필드 매핑표
- 신규 enum·table·constraint·index 목록
- 유지할 테스트 계정과 폐기 가능한 fixture 목록
- 변환 불가능한 데이터와 처리 방식
- RLS·서버 capability 설계
- 실행 순서, 검증 쿼리, 롤백 순서

### 6.2 권장 실행 순서

1. 현재 개발 DB와 Storage 메타데이터 백업
2. 현재 테스트 계정 ID·이메일·역할 목록 고정
3. v3 신규 테이블·원장·제약 추가
4. 가족·보호자·자녀 관계 백필
5. `enrollments`를 subject enrollment와 teacher assignment로 분리
6. 세션 당시 teacher/rate/duration/material snapshot 백필
7. 신뢰 가능한 `credit_balance`만 opening entitlement grant로 변환
8. 불명확한 잔액·makeup count·완료 상태는 자동 추정하지 않고 검토 목록 생성
9. 새 RLS와 server capability 테스트
10. 기존 테스트 시나리오를 새 seed로 재작성
11. E2E 통과 후 앱 읽기·쓰기 경로 전환
12. 기존 테이블은 검증 기간 동안 read-only로 유지한 뒤 제거 여부 결정

장기간 dual-write, 운영 중 shadow migration, 무중단 cutover는 현재 단계에서 만들지 않는다.

### 6.3 필수 검증 수치

- 사용자 계정 수와 역할별 수
- 보호자-자녀 관계 수
- 활성 과목 수강 수
- 현재 선생님 배정 수
- 과거·미래 세션 수와 최종 상태별 수
- 학생별 opening entitlement 합계
- 선생님별 과거 정산 합계
- 변환 제외·수동 검토 건수

모든 차이는 원인과 승인자를 기록한다.

### 6.4 롤백

- 마이그레이션 전 DB 백업과 배포 커밋을 기록한다.
- v3 전환 전에는 기존 앱 경로를 삭제하지 않는다.
- 실패 시 앱 feature flag를 기존 읽기 경로로 되돌리고 백업으로 개발 DB를 복원한다.
- `git reset --hard`나 운영 데이터 파괴 명령을 롤백 절차로 사용하지 않는다.

## 7. Google Workspace 기술 검증

실제 운영 Drive가 아니라 `ALTON Integration Sandbox` Shared Drive에서 수행한다.

### 7.1 사전조건

- `alton.education` Workspace 에디션과 Smart Notes 지원 확인
- 성인 테스트 선생님 회사 계정 2개
- 테스트 학생·보호자 계정
- 자동화 전용 내부 계정과 최소 OAuth scope
- Shared Drive 관리자 2명 이상

### 7.2 필수 시나리오

| ID | 시나리오 | 통과 기준 |
|---|---|---|
| GW-01 | 학생 활성화 | 학생 폴더 1개만 자동 생성, DB에 file ID 저장 |
| GW-02 | 과목 수강 활성화 | 과목 폴더와 연도 구조 자동 생성 |
| GW-03 | 예약 확정 | 세션 폴더·고유 Calendar 이벤트·고유 Meet 자동 생성 |
| GW-04 | 동일 이벤트 재전송 | 폴더·이벤트·Meet 중복 없음 |
| GW-05 | 선생님 배정 | 담당 과목 폴더만 접근, 다른 학생 접근 거절 |
| GW-06 | 선생님 변경 | 이전 권한 회수, 새 권한 부여, 원본 이동 없음 |
| GW-07 | Smart Notes 생성 | 영상·원본 음성 녹화와 별도 Meet 전사 없이 회의록 생성 이벤트 수신. Smart Notes 수반 텍스트 전사는 허용하며 제한 접근·보관 적용. 녹화 OFF 상태에서 화면 스크린샷 미생성 확인 |
| GW-08 | Smart Notes 이동 | 동일 file ID로 세션 폴더 이동, Docs 읽기 가능 |
| GW-09 | Calendar 첨부 | 이동 후 Calendar 첨부가 유효하고 ACL이 의도대로 동작 |
| GW-10 | 보호자 거부 | 해당 세션 Smart Notes OFF, 수동 리뷰 task 생성 |
| GW-11 | 학생·보호자 조회 | Drive ACL 없이 ALTON 권한 검사 후 확정 자료만 제공 |
| GW-12 | 실패 복구 | 권한·이동 실패가 재시도 후 관리자 재처리함에 표시 |
| GW-13 | 선생님 퇴사 | 모든 담당 폴더 접근 회수, 회사 원본 보존 |
| GW-14 | 보존·삭제 | 원본 Smart Notes와 확정 리뷰의 서로 다른 만료일 추적 |

### 7.3 개발자 제출 증빙

- 각 시나리오 pass/fail 표
- 생성된 Drive/Calendar/Meet ID의 마스킹된 로그
- 선생님 변경 전후 권한 목록
- SmartNote 이동 전후 동일 file ID 확인
- Calendar 첨부와 Docs API 조회 결과
- 실패 재시도와 관리자 화면 캡처
- 사용한 OAuth scope와 Workspace 관리자 설정
- 발견한 제약, 우회안, 제품 정책 영향

### 7.4 통과 기준

- GW-01~14 전부 통과
- 수동 폴더 생성·수동 권한 부여 0건
- 학생·학부모에 대한 Drive 직접 ACL 0건
- 중복 생성 0건
- 권한 회수 실패 0건
- 실패 이벤트가 유실되지 않고 모두 재처리 가능

## 8. 승인과 실행 순서

### Gate A — 제품 승인

승인자: 제품 담당자  
대상: 3~5절 도메인 경계·상태 전이·역할 권한  
결과: **2026-08-29 승인 완료**  
승인 반영 시 보정: 구형 문서 우선순위 제거, 수업의 회사 취소·중단 상태와 결제·환불 상태 명시. 기존 합의 정책 변경 없음.

### Gate B — 개발 설계 리뷰

작성자: 개발자  
검토자: 제품 담당자·개발자  
대상: 6절 마이그레이션 매핑·RLS·서버 capability  
결과: **2026-08-29 승인 완료** — `2026-08-29-gate-b-migration-and-permission-design.md`(v5). 과목 대화방은 `teacher_assignment` 기준 유지(§4.11 변경 없음), 이전 선생님은 자신이 담당했던 archived 대화방을 읽기 전용으로 계속 조회 가능하나 이전·신규 선생님은 서로의 대화방을 조회할 수 없다.

### Gate C — Google 기술 검증

작성자: 개발자  
검토자: 제품 담당자  
대상: 7절 GW-01~14  
결과: **2026-08-30 완료** — `2026-08-29-gate-c-google-workspace-validation.md`. Google 기술 검증 범위(GW-01~13)에서 데이터 모델을 바꾸는 blocker 없음을 확인. GW-10(수동 리뷰 task)·GW-12(`manual_review` 큐 적재·재처리)에 섞여 있던 ALTON 앱 워크플로우와 GW-14(보존·삭제 자동화) 전체는 Gate C 판정에서 분리해 `2026-08-29-master-roadmap-v3.md` R8/R9/R12의 필수 인수 기준(blocker)으로 이관 — Gate C는 "Google 기술이 실제로 가능한가"만 확인하고, ALTON 앱 자체 기능은 각 R 단계 구현 후 인수 테스트로 검증한다.

### Gate D — R1 착수

- 결과: **완료(2026-08-30)**. R1 착수 전 Gate C 작업용으로 임시 부여했던 조직 레벨 `roles/orgpolicy.policyAdmin`(`official@alton.education`)을 회수하고 재조회로 제거를 확인, 조직 도메인 제한 정책 상속과 `meet-api-event-push@system.gserviceaccount.com`의 Pub/Sub Publisher 권한 유지도 확인했다(`2026-08-29-gate-c-sandbox-infra-log.md` §7).

조건:

- Gate A 승인 — **완료**
- Gate B 승인 — **완료(2026-08-29)**
- Gate C에서 데이터 모델을 바꾸는 blocker 없음 — **완료(2026-08-30)**
- 법률 작업은 `Later/R13 blocker`로 별도 추적

**Gate A·B·C 모두 완료됐으므로 R1 착수 가능.** 단, Gate C 검증 중 Gate C 범위 밖으로 분리해 이관한 R8/R9/R12 인수 기준(GW-10/12/14 관련)은 해당 R 단계를 "완료"로 보고하기 전에 반드시 통과해야 한다 — 삭제된 요구사항이 아니라 이관된 blocker다.

## 9. 개발자에게 보낼 요청

1. 이 문서 3~5절을 구현 기준으로 읽고 모순이나 구현 불가능 항목만 질문한다.
2. 코드를 수정하기 전에 6.1의 마이그레이션 설계 문서를 먼저 제출한다.
3. 동시에 Sandbox에서 GW-01~14 기술 검증을 수행한다.
4. 기술 검증 중 정책을 임의 변경하지 말고 실패 사실과 가능한 대안을 함께 보고한다.
5. Gate B와 C 승인 전 파괴적 스키마 변경과 기존 테스트 데이터 삭제를 하지 않는다.
