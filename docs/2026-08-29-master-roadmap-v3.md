# Alton Education 정식 오픈 마스터 로드맵 v3

- 상태: **최신 실행 기준**
- 목표: 파일럿 최소 기능이 아닌 정식 오픈 완성도
- 제품 기준: `2026-08-29-product-architecture-v3.md`
- 개발 기준: `2026-08-29-developer-handoff-v3.md`
- R0 승인·기술 검증: `2026-08-29-r0-approval-and-technical-validation-package.md`

## 1. 실행 원칙

- 날짜보다 의존성과 출시 게이트를 기준으로 진행한다.
- 모든 단계는 구현·마이그레이션·테스트·운영 화면·문서까지 완료해야 닫힌다.
- 화면을 먼저 만들고 데이터 구조를 나중에 맞추지 않는다.
- 미오픈 개발 DB는 백업 후 v3 기준선으로 전환하며 불필요한 운영용 dual-write를 만들지 않는다.
- 수동 운영을 허용하더라도 상태, 담당자, 시각, 근거 문서는 시스템에 남긴다.
- 각 단계의 미정 정책은 구현 전에 제품 담당자가 확정한다.

## 1-1. 모든 단계 공통 Definition of Done

R1 DB 재설계 라운드(2026-08-30, 실행 로그 `2026-08-29-r1-migration-execution-log.md` §5~8)에서
SQL 정적 검토와 postgres superuser 테스트만으로는 실제 보안·기능 버그(RLS 자기참조 재귀,
잘못된 컬럼 한정으로 인한 권한 우회, 두 테이블 간 RLS 상호 재귀, 락 순서 오류로 인한
동시성 결함)를 전혀 잡아내지 못했다는 것이 확인됐다. 이 경험을 일회성 실행 로그로만
남기지 않고, **R1 이후 모든 단계(R2~R13)에 공통으로 적용되는 완료 기준**으로 아래를
못박는다. 각 단계의 완료 보고에는 아래 항목을 어떻게 충족했는지 명시해야 하며, 항목 중
하나라도 "해당 단계에서 검증 불가"인 경우 반드시 다음 하위 절의 절차를 따른다.

1. **DB 변경 전 기존 사용처 전수 조사**: 스키마·함수·정책을 바꾸기 전에 현재 앱 화면,
   서버 액션, 웹훅(Calendly/DocuSign/Google 등)이 해당 테이블·함수를 어디서 어떻게
   쓰고 있는지 전수 조사하고, 그 결과를 보고에 포함한다.
2. **기존 구조 교체 시 shadow/cutover 전략 명시**: 기존 이름을 즉시 rename/삭제하지
   않고, shadow 이름으로 새 구조를 만든 뒤 앱 코드 전환과 함께 원자적으로 cutover하는
   전략을 문서화한다. "지금 당장 rename해도 안전하다"는 판단은 위 1번 전수 조사 없이
   내리지 않는다.
3. **SQL 적용 성공만으로 완료 판정 금지**: `migration apply` 또는 `db push`가 오류 없이
   끝났다는 사실 자체는 완료 기준이 아니다. 아래 4번의 실제 실행 기반 검증을 통과해야
   완료로 인정한다.
4. **역할별 RLS·동시성·주요 화면 smoke test·웹훅·타입 검사/빌드 검증**:
   - RLS가 있는 모든 신규/변경 테이블에 대해 실제 관련 역할 전부(예: 학생/보호자/담당
     선생님/비담당 선생님/관리자/익명)로 `SET ROLE` + JWT 클레임 시뮬레이션(또는 동등한
     실제 인증 컨텍스트)을 이용해 조회·쓰기 결과를 실측한다. postgres superuser나
     service_role 테스트만으로는 RLS 자체가 우회되므로 충분한 검증으로 인정하지 않는다.
   - 동시 접근이 가능한 잔액·락·상태 전이 로직(수업권, 보충시간, 정산, 예약 등)은
     실제 동시 트랜잭션(백그라운드 세션 2개 이상, 필요시 `pg_sleep`으로 락 대기를
     강제 재현)으로 경쟁 상태가 의도대로 직렬화되는지 검증한다.
   - 해당 단계가 건드리는 주요 화면·플로우는 실제로 띄워(로컬 dev 서버 등) 골든 패스와
     핵심 엣지 케이스를 눈으로 확인한다(CLAUDE.md "UI/프론트엔드 변경" 원칙과 동일선상).
   - 관련 웹훅(Calendly/DocuSign/Google Workspace 등)이 있으면 실제 또는 Sandbox
     페이로드로 재현 테스트한다.
   - 타입 검사(`tsc`)와 빌드(`next build` 등)를 통과시킨다.
5. **원격 적용 대상·영향 범위 사전 보고**: 실제 원격(Supabase 등) 환경에 적용하기 전에
   무엇을 새로 만들고/바꾸고/rename하는지, 어떤 기존 테이블·데이터·정책은 손대지
   않는지 구체적으로 보고하고 승인받는다.
6. **실제 실행 가능한 롤백 절차 검증**: "이론적으로 롤백 가능하다"가 아니라, 실패 시
   실행할 정확한 명령·순서를 로컬/테스트 환경에서 실제로 실행해보고 검증한다.
7. **미구현 검증 항목은 후속 단계의 명시적 인수 기준으로 이관**: 해당 단계 시점에는
   아직 구현되지 않은 상위 기능이 있어 검증할 수 없는 항목(예: R1 시점에 앱이 없어
   검증 못한 워크플로우)은 절대 누락하거나 "나중에 확인"으로 방치하지 않는다. 반드시
   구체적인 후속 단계(R#)를 지정하고, 그 단계의 완료 기준(§ 각 R 섹션의 체크리스트)에
   "완료로 보고하기 전에 반드시 통과시켜야 하는 blocker"로 명시적으로 옮겨 적는다
   (선례: Gate C에서 발견된 GW-10/GW-12/GW-14 앱 워크플로우 항목이 R9/R8/R12로
   이관된 방식 — `CLAUDE.md` "현재 작업 기준" 문단 참고).

## 2. 전체 순서

| 단계 | 목표 | 주요 의존성 | 게이트 |
|---|---|---|---|
| R0 | 도메인·정책 동결 | 없음 | G0 |
| R1 | 데이터 기반 재설계 | R0 | G1 |
| R2 | 계정·가족·권한 수명주기 | R1 | G1 |
| R3 | 상담·체험·제안·계약 | R1, R2 | G2 |
| R4 | 수업권·결제 원장 | R1, R3 | G2 |
| R5 | 과목 수강·선생님 배정 | R2, R3, R4 | G2 |
| R6 | 예약·Calendar·Meet | R4, R5 | G3 |
| R7 | 수업 상태·출석·정산 근거 | R5, R6 | G3 |
| R8 | 핵심 수업 공간 신뢰성 | R1, R7 | G3 |
| R9 | 교육 워크플로우 완성 | R5, R7, R8 | G3 |
| R10 | 결제·환불·선생님 정산 | R4, R7 | G4 |
| R11 | 알림·문의·QC·운영 도구 | R2~R10 | G4 |
| R12 | 보안·감사·관찰·복구 | 전 단계 | G5 |
| R13 | 종단 QA·오픈 준비 | 전체 | G6 |

## R0 — 도메인·정책 동결

- [x] `CONTEXT.md`를 팀 공통 용어로 승인
- [x] 정규 수업 120분·수업권 1장 정책 승인
- [x] 계약, 과목 수강, 선생님 배정, 예약, 수업의 경계 승인
- [x] 정규 취소·지각·노쇼 정책 확정
- [x] 수업권 환불·유효기간·만료 순서·자녀 간 이전 정책 확정
- [x] 계속 계약·중도 해지·회사 종료 정책 확정
- [x] 데이터 종류별 보존·삭제 정책 확정
- [x] Drive 학생 중심 원본·자동 권한·Gemini 리뷰 정책 확정
- [x] 기본 USD 결제·KRW 지급과 통화 변경 정책 확정
- [x] 월말 마감·3영업일 명세·5영업일 이의·10영업일 지급 확정
- [x] 상태 전이표와 권한표 승인
- [x] R0 승인 패키지 Gate A 승인
- [x] 현재 스키마→v3 스키마 마이그레이션 설계 리뷰(Gate B, 2026-08-29 승인 완료)
- [x] Workspace Sandbox GW-01~14 기술 검증(Gate C, 2026-08-30 완료 — Google 기술 검증 범위 GW-01~13 Pass, 데이터 모델 변경 blocker 없음. GW-10/GW-12에 섞여 있던 ALTON 앱 워크플로우와 GW-14 전체는 R8/R9/R12 인수 기준으로 이관, 위 해당 섹션 참고)

G0: 미정 정책과 데이터 소유 관계가 목록화되고 개발자가 임의 결정할 항목이 없다.

## R1 — 데이터 기반 재설계

**진행 상태(2026-08-30): 아래 스키마·RLS·DB 함수 계층은 원격 개발 DB에 적용·검증까지 완료했다(`2026-08-29-r1-migration-execution-log.md` 전체 참고). `contracts_v3`/`sessions_v3`는 기존 `contracts`/`sessions`와 이름이 충돌해 shadow 이름으로 만들었다 — 이 두 항목은 "스키마·RLS 자체는 완료, 실제 앱이 새 이름으로 갈아타는 cutover는 별도"로 구분해 표시했고, cutover는 각각 R3·R6에 명시적 선행 조건으로 남겼다. 그 외 항목은 기존 테이블과 이름 충돌이 없는 순수 신규 테이블이라 cutover 자체가 필요 없다.**

- [x] 가족/보호자/자녀 관계 보강 — `households`/`household_members`(신규, 이름 충돌 없음). 6개 역할(학생/보호자/담당·비담당 선생님/관리자/익명) 실제 JWT 기반 RLS 테스트 완료.
- [x] 자녀별 계약과 계약 버전 — **스키마·RLS 완료(shadow)**: `contracts_v3`/`contract_versions` 생성, RLS 자기참조 보안 버그(§실행 로그 §6-3) 발견·수정 후 역할별 테스트 통과. **cutover 미완료**: 실제 앱·서버 액션·Calendly/DocuSign 웹훅은 여전히 기존 `contracts`를 그대로 쓴다. `contracts_v3`→`contracts` rename은 R3에서 앱 코드 전환과 함께 원자적으로 수행(R3 항목 참고, 그 전까지 새 계약 관련 기능은 `contracts_v3` 위에서 개발·검증만 가능).
- [x] `subject_enrollments` 분리 — 신규, 이름 충돌 없음. teacher_assignments와의 RLS 상호 재귀 버그(§실행 로그 §6-3) 발견·수정 완료.
- [x] `teacher_assignments`와 변경 이력 — 기간 겹침 방지 exclusion constraint, 선생님 시급 무결성 강제(아래 항목)까지 포함해 완료.
- [x] 수업 유형과 수업권 유형 버전 — `lesson_types`/`entitlement_types`/`entitlement_products`(신규, 이름 충돌 없음, 시드 데이터 포함).
- [x] 수업권 grant/hold/ledger — `entitlement_grants`/`entitlement_ledger`. `consume`/`release` 동시 실행 시 이중 계상 가능하던 락 순서 버그를 발견·수정하고 실제 동시 트랜잭션으로 재현·검증 완료.
- [x] 예약 원장과 상태 이력 — `reservations`(신규, 이름 충돌 없음), `session_status_events`(신규 감사 테이블, `sessions_v3`를 참조하지만 테이블 자체는 이름 충돌 없음).
- [ ] 세션 당시 선생님·시급·수업 유형·교재 버전 스냅샷 — **스키마·시급 스냅샷 완료(shadow)**: `sessions_v3` 생성, `hourly_rate_snapshot_minor/currency`는 생성 시점에 트리거로 강제 스냅샷(호출자 입력 무시하고 항상 실제 현재 시급으로 덮어씀, §실행 로그 §12). `material_version_id`(교재 버전) 컬럼과 FK는 만들었지만 세션 생성 시 이 컬럼을 채우는 트리거·서버 로직은 아직 없다 — R6/R7에서 실제 세션 생성 흐름을 구현할 때 함께 채운다. **cutover 미완료**: `sessions_v3`→`sessions` rename은 R6(예약 시 수업권 hold, 첫 실제 세션 생성 지점)에서 앱 코드 전환과 함께 수행(R6 항목 참고).
- [x] 선생님 시급 이력과 payout item/batch — **(2026-08-30 확장, 사용자 요청)** 김도경 선생님 시급 미설정 누락이 그대로 active 전환·배정까지 진행될 뻔한 것을 계기로, 관리자 화면 입력 검증만으로는 우회 가능하다고 판단해 DB 트리거로 강제했다: `teachers.status='active'` 전환, `teacher_assignments` planned/active 배정, `sessions_v3` 생성 시점 모두 유효한 현재 `teacher_rate_history`(금액>0, 통화 설정) 존재를 트리거로 강제 확인하고, 위반 시 INSERT/UPDATE 자체를 차단한다(`has_valid_current_teacher_rate()`). 시급 변경은 `set_teacher_rate()`(잠금 후 기존 이력 종료 → 새 이력 생성, 동시 변경 직렬화 검증됨)로만 하도록 `teacher_rate_history_protect` 트리거로 직접 UPDATE/DELETE(effective_until 단독 종료 포함, §실행 로그 §12에서 추가 보정)를 차단했다. 세션 생성 시 그 시점 시급·통화를 `sessions_v3.hourly_rate_snapshot_*`에 항상 강제 스냅샷하며(호출자 입력값 무시), 체험/정규 구분 없이 동일 로직을 적용해 "체험 지급 단가 = 당시 시급"을 별도 예외 없이 만족한다. 정상·미설정·0원·이력 공백·동시 변경 5가지 케이스 전부 실제 실행으로 검증(§실행 로그 §11~12 참고).
- [ ] 범용 감사 이벤트와 정책 설정 — 아직 착수하지 않음(R1 범위에서 실제로 만들지 않았다). `session_status_events`처럼 개별 테이블 단위 감사 이력은 있지만, 엔티티 전반을 아우르는 범용 감사 이벤트 테이블은 R12(보안·감사·관찰·복구) "모든 중요 변경의 감사 로그" 항목과 통합해 설계할지 별도 확인 필요.
- [x] 보충시간 발생·잔여·적용 이력 — `makeup_obligations`/`makeup_events`(신규, 이름 충돌 없음). 음수/0 입력 검증, 이중 적용 방지 unique index 포함.
- [x] 기존 데이터 백필·검증·롤백 계획 — 전체 백업(체크섬 검증)·로컬 복원 재현·원격 적용 전후 데이터 건수 대조·롤백 절차 전부 실행 완료(§실행 로그 전체).

G1: 같은 데이터로 잔여 수업권·현재 선생님·과거 정산을 언제든 재계산할 수 있다.

## R2 — 계정·가족·권한 수명주기

**진행 상태(2026-08-30): 정책 확정 완료.** 조사·설계는 `2026-08-30-r2-account-family-lifecycle-investigation-and-plan.md`, 정책 확정은 `product-architecture-v3.md` §4.13/4.19/4.20/4.21/5.7, 태스크 단위 구현 계획은 `docs/superpowers/plans/2026-08-30-r2-account-family-lifecycle.md` 참고.

- [x] **(R2 Task 1 완료, 2026-08-30 — 이 체크박스만 갱신 누락돼 있었음, 실행 로그에 완료 기록 있음)** R1이 만든 회귀: `inviteTeacher()`/`setTeacherHourlyRate()`가 `teachers.hourly_rate_krw`만 직접 쓰고 `set_teacher_rate()`(R1)를 호출하지 않아, R1 트리거 때문에 이 경로로 처리된 선생님이 `active` 전환에서 막히던 문제. 두 경로 모두 `set_teacher_rate()`를 쓰도록 수정 완료, active 전환 전 사용자 친화적 사전 안내 추가 완료.
- [x] 보호자 우선 초대, 자녀 초대, 만료·재발송 — **R2 Task 4 완료(2026-08-30)**: `account_invites` 자체 토큰 상태 머신(`pending→{accepted|superseded|revoked|expired|failed|manual_review}`)으로 구현. 관리자가 보호자 초대 + 가입한 보호자가 자녀 추가 초대, 초대 유효기간 7일, 재발송 시 기존 토큰 즉시 superseded, 24시간 내 최대 3회, 철회 가능(계정 삭제는 안 함), 전부 `account_invite_events` 감사 이력. 상세는 `2026-08-29-r2-migration-execution-log.md` Task 4 참고.
  - **(운영 전 필수 후속 작업, blocker는 아님)** `mark_expired_invites()`는 관리자 권한으로 호출 가능한 배치 함수로만 존재하고, 이를 주기적으로 실행하는 스케줄러(cron)가 아직 없다. 수락 API(`claim_account_invite`)의 실시간 만료 차단(저장된 status와 무관하게 `expires_at`을 직접 비교)은 스케줄러 유무와 무관하게 항상 정상 동작하므로 Task 4 완료를 막는 요소는 아니다 — 다만 관리자 목록 화면에 정확한 `expired` 상태를 보여주려면 정식 오픈 전에 이 함수를 호출하는 스케줄러 연결이 필요하다(R11 알림·운영 도구 또는 R13 정식 오픈 체크리스트에서 처리, 아래 R13 항목 참고).
- [x] **(완료, 2026-09-01)** 복수 보호자와 주 보호자 설정 — `households`/`household_members`(Task 3)가 스키마는 이미 갖추고 있었지만 실제 초대 경로가 없었다(Task 4 구현 당시 "다중 보호자 초대 UX는 별도 설계"라고만 남기고 미구현). `create_account_invite()`/`finalize_account_invite()`를 확장해 관리자가 기존 household에 공동 보호자(is_primary=false)를 초대할 수 있게 했고, `set_primary_guardian()`(관리자 전용, `households.primary_guardian_id` 비정규화 컬럼도 동기화)을 신규 추가했다. `app/admin/invite-actions.ts`의 `inviteGuardianToHousehold`/`setPrimaryGuardian`, 관리자 UI는 아직 없음(서버 액션·DB만 완료 — Task 6 `record_manual_guardian_consent`와 동일한 선례). 상세는 실행 로그 "R2 잔여 항목 — 복수 보호자" 참고. 관계 원본인 레거시 `guardian_students`는 cutover 후 읽기 전용 동결(DB 트리거로 쓰기 차단, 삭제는 R12로 이관). **(2026-08-30 정정) `parents`는 동결 대상이 아니다** — 보호자 역할별 계정 정보·계정 상태(`pending/active/suspended/closure_pending/closed`, `transition_account_status()`)는 당분간 계속 `parents`가 원본이다.
- [x] **(중복 계정 병합 절차는 완료, 2026-08-31 Task 5)** — 병합 계정 즉시 로그인 차단, 데이터는 생존 계정으로 단일 트랜잭션 재배정, 병합된 인증 계정 30일 후 삭제·익명화, 병합 매핑·감사 기록 7년 보관, 관리자 전용·되돌리기 없음. **잘못된 이메일 수정은 정책 미확정 — 사용자 판단 필요(2026-09-01 확인)**: product-architecture-v3.md 어디에도 "이메일 수정"에 대한 확정 정책이 없다(§4.19는 병합 정책만 다룬다). PENDING 초대의 오타는 기존 revoke+재초대로 이미 충분히 해결 가능(추가 구현 불필요). 미확정인 것은 **이미 active로 가입 완료된 계정의 로그인 이메일을 관리자가 정정**하는 절차다 — 본인 확인 방법, 재인증 요구 여부, Supabase Auth 자체 이메일과 `personal_contact_email` 등 부가 필드 간 관계, 악용(계정 탈취) 방지 방법이 전부 열려있다. 정책 확정 후 별도 작업으로 구현한다.
- [x] **(부분 완료, 2026-09-01)** 역할별 시간대·Google 이메일·연락처 — 스키마(`profiles.timezone`, `households.default_timezone`)는 Task 2에서 이미 존재했다. `lib/timezone.ts`의 `resolveUserTimezone()`으로 확정된 해석 순서(개인 설정 → household 기본값 → `America/Los_Angeles`)를 순수 함수로 구현·테스트 완료. **브라우저 감지 기반 최초 로그인 제안 UI는 의도적으로 미룬다** — 이 값을 실제로 표시할 화면(예약·세션 시간 표시)이 R6(자체 예약) 이전엔 존재하지 않아 지금 만들면 소비자 없는 UI가 된다. R6 착수 시 이 유틸리티를 재사용해 함께 구현한다. Google 이메일·연락처(선생님 Workspace 계정, `personal_contact_email` 등)는 R2 Task 7에서 완료.
- [x] 계정 비활성화·재활성화 — **확정(2026-08-31, `inactive` 추가)**: `pending→active↔suspended`(가역적 일시정지), `active/suspended↔inactive`(일반적인 서비스 중단, 자료별 보관기간 내 `reactivate_account()`로 복귀 가능, 자동 삭제·익명화 안 함), `active/suspended→closure_pending`(명시적 폐쇄·삭제 요청, 30일 철회 유예)`→closed`(폐쇄 확정, 복원 없음). **R2 자체 범위 확인 완료(2026-09-01)**: 상태 enum·전이 규칙(`transition_account_status()`)은 Task 2에서 이미 구현·검증됐고, R2 Task 5는 계정 병합만 추가로 다뤘다 — `inactive`/`reactivate_account()`/보관기간별 자동화/제한 보관 접근통제/스케줄러의 실제 구현은 이미 R12로 명시적으로 이관되어 있어(위 R12 항목 참고) R2에 남은 별도 구현은 없다.
- [x] **(R2 Task 7 완료 2026-09-01, 실제 인프라 쓰기 검증까지 완료)** 선생님 퇴사 시 Workspace·Docs·채팅·향후 세션 권한 회수 — Google Workspace OAuth 로그인 + `teacher_workspace_provisioning` staging + 7개 활성화 선행조건(각각 별도 증거·시각) + 정지(`suspend`, 삭제 아님)/재활성화 전부 실제 Google Workspace·실제 OAuth 로그인·개발 DB로 검증 완료(테스트 OU 계정 생성·재시도·정지·재활성화·최초 로그인·activation 게이트 전부 실제 인프라 확인). 검증 중 실제 버그 2건(Server Action 오류 마스킹, activation 게이트가 `pending→active`에만 걸려 있던 것) 발견·수정. 테스트 계정은 `teacher_rate_history`/`account_status_events`의 하드 immutable 트리거 때문에 물리 삭제가 불가능해 `suspended`로 영구 보존 — 안전한 테스트 데이터 정리 절차를 이 R12 안에 별도 항목으로 등록(아래 참고). 상세는 `2026-08-29-r2-migration-execution-log.md` Task 7 참고.
- [x] 개인정보/약관 동의 버전 이력 — **R2 Task 6 완료(2026-08-31)**: `consent_policy_versions`/`guardian_consents`(불변, 철회 전용 함수) + `is_under_13()`(UTC 기준, `date_of_birth` NULL이면 fail-closed) + `current_account_access_allowed()`(계정 lifecycle과 분리된 별도 게이트, 26개 자기서비스 쓰기 정책 전수 교체) + `transition_account_status()`의 13세 미만 active 전환 선행조건 결합 + 철회 시 `privacy_review_tasks` 자동 생성. 미동의 학생은 로그인은 되지만 `/consent-pending`(동의 상태·보호자 통지 여부·로그아웃·최소 문의만)으로 제한. 상세는 `2026-08-29-r2-migration-execution-log.md` Task 6 참고.
  - **(운영 전 필수 후속 작업, blocker)** 원격 적용 시점에 실제 학생 1명(장세온)의 `date_of_birth`가 없어 즉시 fail-closed(`/consent-pending`)됐다 — 의도된 동작이며 Task 6 완료를 막지 않지만, 실제 생년월일을 확인해 `set_student_date_of_birth()` 정상 관리자 경로로만 설정해야 한다(학년 기반 추정·DB 직접 UPDATE 금지).
  - **(2026-08-31 확정, blocker)** 신규 학생은 **생년월일이 실제로 확인·저장되기 전에는 `active` 전환이 불가능해야 한다** — 현재 `transition_account_status()`는 "13세 미만이면서 미동의"만 막는데, 보호자가 `date_of_birth`를 아예 설정하지 않고도 `consent_as_guardian()`으로 동의만 기록하면 게이트를 통과해 `active` 전환이 가능한 구멍이 있다(동의 함수가 DOB 존재 여부를 확인하지 않음). 학생 온보딩 플로우 구현 시 DOB 확인 여부를 동의와 무관한 **별도의 독립적인 activate 선행조건**으로 추가해야 한다.
  - **(2026-08-31 확정, 서비스 오픈 전 필수 blocker)** 보호자가 자기 자녀의 생년월일을 입력·확인하는 UI(`setChildDateOfBirth` 서버 액션만 존재, 화면 없음) — R12의 "미완료 목록"이 아니라 **정식 오픈 체크리스트의 필수 인수 조건**으로 다룬다.
  - **(2026-08-31 확정)** DOB **최초 입력과 이후 변경은 구분**해야 한다 — 최초 입력(온보딩)보다 이후 변경(정정)에는 더 강한 확인 절차(예: 관리자 재확인·증빙 요구)와 별도 감사 로그(누가·언제·이전 값·사유)가 필요하다. 현재 `protect_date_of_birth()`/`set_student_date_of_birth()`는 이 둘을 구분하지 않는다 — 구현 시 변경 이력 테이블 신설을 검토한다.
  - **(정식 오픈 전 법률 검토 필요)** "인증된 보호자 계정 + 검증된 household 관계"가 COPPA verifiable parental consent 요건을 충분히 충족하는지는 이 구현이 전제하지 않는다 — 법률 검토로 확정 필요.
  - **(2026-08-31 확정, 관리자 UI 부착 전 필수 하드닝)** 관리자 수동 동의(`record_manual_guardian_consent`)는 **관리자가 임의로 동의를 대신하는 기능이 되면 안 된다** — 오프라인/별도 방식으로 보호자 자격과 동의를 검증한 증빙이 있을 때만 예외적으로 기록 가능해야 한다. **현재 구현은 이 요건을 완전히 만족하지 않는다**: `p_consented_by`(동의자로 기록되는 보호자)가 실제 그 학생 household의 활성 guardian인지 검증하지 않고, `verification_reference`도 "비어있지 않은 텍스트"이면 통과한다(증빙의 실체는 검증하지 않음). 관리자 화면을 붙이기 전에 반드시 `p_consented_by` 자격 검증을 추가하거나 UI에서 검증된 값만 넘기도록 강제해야 한다. 또한 수동 동의 필수 필드(검증방법·시각·정책버전·증빙참조는 이미 있음) 중 **"실행자"(입력한 관리자 본인)가 현재 별도로 기록되지 않는다** — `consented_by`는 보호자 id일 뿐 실행 관리자 id가 아니므로, 하드닝 시 `recorded_by` 컬럼 또는 감사 이벤트를 추가해야 한다. 상세는 `2026-08-29-r2-migration-execution-log.md` Task 6 "후속 조치" 참고.
- [x] **(R2 Task 8 완료, 2026-09-01)** 슈퍼바이저 capability 기반 권한 — R2 신규 민감 액션(Task 4/5/6/7, 13개 함수 + 앱 서버 액션 + RLS)에 `is_admin() OR current_user_has_capability('...')`로 강제(서버+DB 양쪽, 로컬·원격 개발 DB 실측 검증 완료). 기존 `is_admin()` 전면 교체(레거시 9개 함수 등)는 R12로 이관(위 R12 항목 참고).

## R3 — 상담·체험·제안·계약

**(2026-09-01) 상태: 완료.** 로컬 스키마·상태 전이·관리자 UI·유닛/통합/로컬 E2E, Drive 실제 저장(업로드·file ID·멱등·재시도), DocuSign 실제 웹훅 전달(HMAC 검증·payload 파싱·DB 반영·idempotency)까지 전부 실측 검증 완료 — 상세는 `docs/CURRENT.md`, 경과는 `2026-08-29-r3-migration-execution-log.md` 참고.

- [x] **(R1 cutover 선행 조건, blocker)** `contracts_v3`→`contracts` rename과 기존 `contracts`→`legacy_contracts` rename을 앱 코드·서버 액션 전환과 함께 같은 배포에서 원자적으로 수행한다(R1에서 shadow 이름으로 미룬 부분, `2026-08-29-r1-migration-execution-log.md` §4 cutover 전략 참고). 이 항목을 완료하기 전까지 아래 계약 관련 항목은 `contracts_v3` 위에서만 개발·검증한다.
- [x] 구조화된 인테이크와 중복 상담 식별
- [x] 상담 예약·취소·재예약·노쇼
- [x] 학생 유형 분류(관리자 확장형 `classification_tags`, 레거시 A~E 코드 미이식), 상담 메모, 후속 작업
- [x] 체험 선생님·과목·목표 지정
- [x] 자녀당 체험 1회와 관리자 예외 승인
- [x] 60분 체험 세션과 결과 평가
- [x] 추천 과목·선생님·횟수·가격 제안서 버전
- [ ] 자녀별 계약 준비·발송·서명·무효·해지·갱신 — 준비/발송/무효는 로컬 완료, **실제 서명 완료(DocuSign 실배달)는 미검증**, 해지·갱신 흐름 미구현
- [x] 계약 문서와 정책·가격 스냅샷(`contract_versions`의 템플릿버전·당사자모드·정책버전 스냅샷)
- [x] 계약 서명 완료 후 결제 단계로 전환(웹훅 로직상 `contracts.status='active'` 전이는 실측 확인, 트리거인 DocuSign 실제 전달은 미검증)
- [x] 자동 갱신·자동 결제 없는 자녀별 계속 계약(설계상 해당 로직 자체가 없음)
- [ ] 20회권 추가 구매와 계약 갱신 분리 — R4 범위로 확정, 미착수
- [ ] 보호자 해지·회사 종료·과목별 종료 흐름 — 미구현
- [ ] 12개월 무활동 계약의 30일 고지 후 휴면 종료 — 미구현

### R3 전자서명 — DocuSign 확정 구조 (2026-08-30 확정, `product-architecture-v3.md` §5.5 참고)

**DocuSign은 제거 대상이 아니다.** 계약 데이터·상태의 기준 원본은 ALTON DB, 서명 발송·절차는 DocuSign, 서명 완료본·감사증명서 장기 보관은 회사 Google Shared Drive — 3단 분리 구조로 R3에서 구현·검증한다. 기존 `docs/superpowers/plans/2026-08-28-docusign-family-contract.md`는 v3 이전(자녀별 계약 버전·Drive 보관 구조가 없던 시절) 구현 이력이라 스키마·흐름이 아래와 다르다 — 그대로 재사용하지 말고 R3 착수 시 이 목록을 기준으로 새 task 단위 계획을 작성한다(R2와 동일한 절차: 영향 범위·핵심 테스트 계획 공유 후 승인받고 구현).

- [x] 자녀별 계약 및 계약 버전 생성(수정 계약은 기존 계약을 덮어쓰지 않고 새 버전 생성)
- [x] DocuSign envelope 생성·발송(sandbox 실측: JWT 인증·발송·실서명 완료·API 상태조회 확인)
- [x] envelope ID와 계약 버전 연결(`contract_versions.docusign_envelope_id`, 계약이 아닌 버전 레벨로 정정 완료)
- [x] **(2026-09-01 완료)** `sent/delivered/completed/declined/voided` 상태 자동 반영(웹훅) — 근본원인 2건 해결(계정 Connect Key로 HMAC 서명 정상화, envelope-level eventNotification의 실제 평탄 payload 구조에 맞춘 파서 수정) 후 새 envelope로 sent·completed 두 이벤트 모두 HMAC 통과·2xx·payload 파싱·DB 반영·`external_event_receipts` 기록까지 라이브로 실측 확인.
- [x] 중복·재전송·순서 역전 웹훅 멱등 처리 — `external_event_receipts(provider, event_id)` 기반(Preview+원격 dev DB 대상 직접 검증 완료, 실제 DocuSign 배달 경로와는 별개로 로직 자체는 확인됨)
- [x] **(2026-09-01 완료)** 서명 완료본과 감사증명서(certificate of completion) 다운로드 — `downloadCompletedDocument`/`downloadCertificateOfCompletion` 실호출 배선 완료, 실측 검증됨
- [x] **(2026-09-01 완료)** 회사 Shared Drive의 해당 자녀 계약 폴더에 저장 — Preview 전용 최소권한 인프라로 실제 업로드 검증 완료(`Alton Integration Sandbox` Shared Drive)
- [x] **(2026-09-01 완료)** Drive file ID를 계약과 `drive_artifacts`에 연결 — 실측 확인(`drive_file_id` 실제 값 부여, 멱등 재실행 시 중복 없음)
- [x] 완료 후 결제 단계 활성화(웹훅 로직상 상태 전이 자체는 실측 확인)
- [x] **(2026-09-01 완료)** 웹훅 누락·다운로드 실패·Drive 저장 실패 재처리 및 정기 대조 — `processQueuedDriveArtifacts()`(claim/lock, `queued→processing→succeeded/retryable_failed→manual_review`), `reconcileDocusignStatus` 확장, 전부 실측+mock 테스트 검증

**보안 요구사항(구현·검증 필수)**:
- DocuSign 웹훅 서명 검증 필수 — signing secret 미설정 시 개발 환경을 포함해 어떤 환경에서도 웹훅 요청을 통과시키지 않는다.
- `external_event_receipts(provider, event_id)` 기반 중복 방지.
- 비밀키와 access token은 서버에서만 사용(클라이언트 노출 금지).
- 계약 발송·무효·재발송·완료·파일 보관 전 과정 감사 이력.

기존 `contracts`/`contract_versions`(레거시)나 개발 중 만들어진 계약·세션 테스트 데이터는 실사용 이력이 아니므로 신규 구조로 이관할 필요가 없다(오픈 전 개발 데이터, `product-architecture-v3.md` §4.13 정정 참고) — 백업 후 폐기 가능. 로그인 테스트 계정은 유지한다.

## R4 — 수업권·결제 원장 — **완료(2026-09-01), 단 1건 blocker**(상세: `docs/2026-09-01-r4-migration-execution-log.md`, `docs/CURRENT.md`)

- [x] 사용자 용어와 코드의 신규 표기를 수업권으로 통일
- [x] `regular_1to1_120` 수업 유형
- [x] 기본 수업권 1장=120분 정규 수업 1회
- [x] 수업권 상품·상품 버전·판매 중단
- [x] 실제 단건 판매가와 20회 패키지 할인가 버전
- [x] 수업권 유형 버전별 유효기간과 기본 12개월 설정
- [x] Stripe 결제→자녀별 수업권 지급 — 실제 Stripe TEST 모드 API로 성공/거절/환불 검증 완료
- [x] 예약 시 보류, 취소 시 해제/정책 소진, 완료 시 소진
- [x] 만료 임박순·지급일순 hold 할당
- [x] 수업 시작일 기준 유효기간 검증
- [x] 환불·조정·만료·연장·복원·이전 원장
- [x] 회사·선생님 취소 시 잔여 30일 미만 수업권 연장
- [x] 관리자 전용 자녀 간 예외 이전과 호환 계약 검증
- [x] 부족 수업권 예약 방지와 재구매 흐름
- [x] 결제 실패·중복 웹훅·차지백 재처리 — 결제 실패·중복 웹훅(멱등성)은 실측 검증 통과. **차지백(`charge.dispute.created`/`.updated`/`.closed`) 처리 버그 수정(2026-09-01 후속)**: `purchases.status`를 무효 enum 값(`'disputed'`)으로 갱신하려던 코드를 제거하고, 신규 `payment_disputes` 테이블(`20260924000000_r4_payment_disputes.sql`)을 분쟁 전용 소스오브트루스로 upsert(`stripe_dispute_id` 유니크, idempotent). 분쟁 생성은 `entitlement_ledger`를 건드리지 않음(자동 회수 없음, 정책 확정). 관리자 대사 화면·보호자 영수증에 분쟁 상태 노출 추가. Vitest 8건 + Playwright(`e2e/r4-webhook-dispute.spec.ts`) 4건으로 검증.
- [x] 부모 결제 영수증과 자녀별 사용 내역

## R5 — 과목 수강·선생님 배정 (진행 중, 2026-09-02)

`subject_enrollments`/`teacher_assignments` 테이블·겹침방지 exclusion·시급강제 트리거·RLS는
R1(`20260830020000`, `20260830100000`, `20260830080000`)에서 이미 구현돼 있었다. 이번 세션은
그 위의 앱 레이어(활성화 선행조건, 승계 판정, 원자적 변경, 스레드, 문서권한 큐, 관리자
서버액션/UI, DB 레벨 테스트)를 추가했다 — 상세는 `docs/2026-09-02-r5-migration-execution-log.md`.

- [x] 계약·결제 완료 후 자녀별 과목 수강 활성화 — `subject_enrollment_activation_ready()` +
      `subject_enrollments_enforce_activation` 트리거(fail closed), 관리자 UI에서 사전 확인 후 안내.
- [x] 한 자녀의 복수 과목 추가 — 과목별 독립 `subject_enrollments` 행(R1 unique index가 과목당
      동시 active/paused 1개만 보장, 서로 다른 과목은 무제한).
- [x] 과목별 planned/active/paused/completed/terminated — `v3_subject_enrollment_status`(R1).
- [x] 선생님 과목 자격과 커리큘럼 보유 여부 분리 — `trial_teacher_succession_eligibility()`가
      `has_subject_qualification`/`has_curriculum`을 독립 컬럼으로 반환, 커리큘럼 미보유가 자격을
      막지 않음을 DB 테스트로 검증.
- [x] 체험 선생님 정규 승계(자격 판정) — `decideTrialTeacherSuccessionProposal()`(순수 로직) +
      관리자 UI 사전 확인. 다만 "체험→정규 자동 승계 제안" UI 흐름 자체(체험 세션과의 연결)는
      미완료 — 아래 미완료 참고.
- [x] 자녀·과목별 선생님 변경과 이력 — `change_teacher_assignment()`(단일 트랜잭션), 관리자 UI
      이력 조회.
- [x] 적용일 지정, 변경 사유, 관리자 기록 — `change_teacher_assignment(p_effective_from, p_reason,
      p_changed_by)`.
- [x] 완료 수업·정산·리뷰·채팅 아카이브 보존 — teacher_assignments/sessions_v3/payout 등은 UPDATE
      대상이 아니라 새 행만 추가(불변 확인), `subject_threads`는 archive만 하고 과거 메시지는 그대로.
- [x] 확정 미래 예약 취소 대상 표시와 새 예약 안내 — `listFutureBookingImpact()`(읽기 전용, 실제
      취소/이전은 하지 않음), 관리자 UI에 안내 문구.
- [ ] 커리큘럼 진도와 문서 권한 인계 — `teacher_assignments.curriculum_handoff_status` placeholder
      컬럼(not_applicable/pending)만 마련, 실제 인계 화면·절차는 R9. `document_permission_retries`
      큐 + `lib/documents/permission-retry-worker.ts` stub(claim/재시도/manual_review 전이 로직은
      구현, 실제 Drive ACL 호출은 R8에서 stub 본문만 교체).
- [x] 선생님 휴가·장기 부재 시 과목 단위 배정 변경(단일 수업 취소의 즉시 대체 아님) —
      `change_teacher_assignment()`를 그대로 재사용(별도 대체 기능 없음, DB 테스트로 검증).
- [x] **(R1에서 DB 레벨 강제 완료, 이 단계 서버 액션·화면에서 재확인)** 선생님 배정 서버 액션
      사전 확인 — `assignTeacherToSubjectEnrollment()`/`changeTeacherAssignment()` 모두
      `has_valid_current_teacher_rate()`를 먼저 확인해 원시 DB 에러 대신 안내 메시지 표시.
      **R2 기존 "선생님 active 전환" 흐름 재사용은 미완료** — 아래 미완료 참고.

### R5 미완료(다음 세션)

- 관리자 UI는 기존 "매칭" 탭에 `SubjectEnrollmentPanel`로 통합했으나 학생 검색이 버튼 나열
  방식으로 단순함(학생 다수 시 UX 개선 필요), 체험→정규 "제안" 자체를 트리거하는 전용 버튼
  UI는 없음(수동으로 배정 폼 사용).
- 학생/보호자/선생님 role 화면(현재 과목별 수강 상태·현재 선생님·예정 변경일, 선생님의
  현재 배정 학생/과목 목록)은 아직 구현하지 않음 — RLS는 이미 열려 있음(R1), 화면만 없음.
- R2 선생님 온보딩 화면(active 전환 버튼)이 이 세션에서 만든 사전 확인 로직
  (`lib/enrollment/subject-enrollment-decision.ts`의 시급 메시지)을 재사용하도록 리팩터링하지
  않음 — 현재도 DB 트리거가 최종 방어선 역할은 하고 있어 안전하지만, spec의 "중복 구현 금지"
  요구를 완전히 충족하지 못함.
- Playwright E2E는 DB 레벨 검증(`e2e/r5-subject-enrollment-teacher-assignment.spec.ts`, 8건)만
  있고, spec이 요구한 "관리자 UI 클릭으로 전체 흐름(생성→활성화→배정→변경)을 완주하고 학생/
  보호자/선생님 화면에서 결과를 확인하는" 브라우저 기반 role E2E는 아직 작성하지 못함(role
  화면 자체가 없어 작성 불가 — 위 항목과 연결).
- 동시-변경/재시도 멱등성(concurrent-change idempotency) 전용 테스트는 없음 — `change_teacher_assignment()`의
  행 잠금(`for update`)으로 설계상 직렬화되지만 별도 동시성 테스트로 실측 검증하지 않음.
- Vercel Preview 배포+검증은 이번 세션에서 수행하지 않음(R5는 로컬+원격 개발 DB 검증까지만).

## R6 — 자체 예약·Google Calendar·Meet

- [ ] **(R1 cutover 선행 조건, blocker)** `sessions_v3`→`sessions` rename과 기존 `sessions`→`legacy_sessions` rename을 앱 코드·서버 액션 전환과 함께 같은 배포에서 원자적으로 수행한다(R1에서 shadow 이름으로 미룬 부분). 이 시점에 세션 생성 서버 액션에서 `material_version_id`(교재 버전 스냅샷) 채우기도 함께 구현한다(R1에서는 컬럼·FK만 준비하고 실제 채우기 로직은 만들지 않았다).
- [ ] 선생님 반복 가능 시간·날짜별 예외·버퍼
- [ ] 120분 슬롯·15분 버퍼·24시간~8주 예약 가능 기간
- [ ] Google FreeBusy 충돌 제거
- [ ] DB 슬롯 잠금과 중복예약 방지
- [ ] 예약 시 수업권 hold
- [ ] Calendar 이벤트와 고유 Meet 생성
- [ ] Smart Notes 자동 활성화, 영상·원본 음성 녹화 및 별도 Meet 전사 비활성화, Smart Notes 수반 텍스트 전사의 제한 보관
- [ ] 녹화 OFF 상태에서 Smart Notes 화면 스크린샷 미생성 실측 검증
- [ ] 보호자 AI 회의록 거부 시 세션별 Smart Notes 비활성화
- [ ] SmartNote 생성 이벤트·Meet API 대조·세션 연결
- [ ] 취소·새 예약·지각·노쇼 신고
- [ ] 선생님 취소 시 예약·수업권 hold 해제 후 학생의 일반 새 예약 흐름
- [ ] Google Meet 참가자 기록의 제공 범위·권한·수집 지연 기술 검증
- [ ] Meet 참가자 기록과 알톤 입장 클릭·화면 체류 기록의 source 분리
- [ ] 양쪽 timezone과 DST
- [ ] Google 실패 보상·재처리·정기 대조
- [ ] 주간 고정 시간 최대 8회와 회차별 수업권 hold
- [ ] 수업 24시간·2시간 전 리마인드

### R6 레거시 제거 — Calendly·Zoom 완전 삭제 (2026-08-30 확정)

신규 자체 예약(Calendar/Meet) 경로의 E2E 통과 후 아래를 완전히 제거한다. 제거 전 안전한 DB 백업과 롤백 지점만 남기면 충분하다 — ALTON은 아직 운영을 시작하지 않았고 현재 예약·Zoom 링크 데이터는 개발·테스트 데이터이므로 장기 보존이나 신규 구조로의 이관은 필요 없다(`product-architecture-v3.md` §4.13 정정 참고). 로그인 테스트 계정·프로필은 예외로 유지한다.

**Calendly 제거(학생·보호자 예약, R2 Task 7에서 이미 제거한 선생님 온보딩 경로와 별개)**:
- [ ] 학생·보호자용 Calendly 예약 UI와 링크
- [ ] `CalendlyWidget.tsx`
- [ ] Calendly 기반 `booking-data.ts`
- [ ] Calendly 예약 생성·취소·재예약 처리
- [ ] `app/api/webhooks/calendly/*`
- [ ] Calendly 환경변수와 signing secret
- [ ] Calendly 예약 시 `current_session`을 변경하는 레거시 코드
- [ ] 신규 코드에서 `teachers.calendly_scheduling_url`을 참조하는 모든 경로
- [ ] 전환 완료 후 `teachers.calendly_scheduling_url` 컬럼 삭제(R2 Task 7에서는 다른 레거시 예약 코드가 아직 이 컬럼을 쓸 수 있어 컬럼 자체는 보존, 실제 삭제는 여기서 수행)

**Zoom 제거(Google Meet로 완전 대체)**:
- [ ] 기존 Zoom 링크 생성·저장·노출 코드 제거
- [ ] Zoom 관련 환경변수와 외부 계정 의존성 제거
- [ ] 신규 수업은 Google Calendar 이벤트별 고유 Meet 링크만 사용
- [ ] 기존 과거 수업의 Zoom 링크는 이력으로 보존할 필요 없음(개발·테스트 데이터, 위 원칙과 동일)

**검증**: 코드·DB·환경변수·운영 문서 전체에서 Calendly/Zoom 잔여 참조를 검사하고, 과거 실행 로그와 마이그레이션 문서의 역사적 언급을 제외하고 활성 코드 참조 0건을 확인한다.

## R7 — 수업 상태·출석·정산 근거

- [ ] draft/scheduled/live/completed 상태 전이
- [ ] 학생·선생님 취소와 노쇼 분리
- [ ] 실제 시작·종료 시각과 출석 기록
- [ ] 참가자별 복수 접속·이탈 구간과 수집 source 저장
- [ ] 접속 기록과 운영상 최종 수업 판정 분리
- [ ] 시작 24시간 전까지 일반 취소 시 hold 해제·미소진·미지급
- [ ] 24시간 미만 학생 늦은 취소 시 1장 소진·120분 지급
- [ ] 시작 후 15분 학생 미접속과 최종 노쇼 확인 시 1장 소진·120분 지급
- [ ] 학생 지각 시 예정 종료 유지·1장 소진·120분 지급·보충시간 미생성
- [ ] 예약 시간과 최종 판정 기반의 분 단위 `payable_minutes`
- [ ] Meet 실제 접속 시간은 정산 계산에서 제외
- [ ] 수업 종료 권한과 관리자 보정
- [ ] 완료 시 진도·수업권·정산 항목 단일 트랜잭션
- [ ] 완료 취소 또는 재개방의 역이력
- [ ] 체험과 정규 수업 정산 규칙
- [ ] 선생님 지각분의 당일 상호 합의 연장
- [ ] 미이행 지각분을 분 단위 보충시간으로 생성
- [ ] 선생님 사유 최종 제공 90분 미만 자동 QC
- [ ] 회사·Meet 장애 미시작 시 수업권 복원·0분 정산·신규 예약 흐름
- [ ] 회사·Meet 장애 중단 시 미제공 분 보충시간과 총 120분 정산 상한
- [ ] 보충시간을 미래 정규 수업 뒤에 연결
- [ ] 연장 구간의 선생님 가능 시간·Calendar 충돌 검사
- [ ] 보충시간 적용 시 추가 수업권 미소진
- [ ] 지각·보충시간 QC와 감사 이력

## R8 — 핵심 수업 공간 신뢰성

- [ ] 세션 교재 버전 스냅샷
- [ ] 교재 오버레이 필기의 페이지/영역 기준 정규화 좌표
- [ ] 작성자·시각·순서가 있는 annotation event
- [ ] 실시간 전송, 영구 저장, 재접속 복구
- [ ] 동시 필기 충돌과 마지막 저장 덮어쓰기 제거
- [ ] 전체 지우기 권한·복구·감사 이력
- [ ] 완료 세션 읽기 전용 잠금
- [ ] 회사 Shared Drive 학생→과목→연도→세션 폴더 자동 생성
- [ ] 선생님 배정 이벤트 기반 과목 폴더 권한 자동 부여·회수
- [ ] Smart Notes 원본의 세션 폴더 이동과 file ID·Calendar 첨부 검증
- [ ] Drive 확정 산출물과 Supabase 임시·실시간 데이터 역할 분리
- [ ] 폴더·권한·파일 이동 실패 재처리와 정기 대조
- [ ] **(Gate C GW-12 인수 기준, blocker)** 잘못된 fileId 등 Drive/Meet API 실패가 실제로 `manual_review`/`reconciliation_needed` 큐에 적재되고, 재처리 배치가 이를 정상 처리하는지 인수 테스트로 확인 — Gate C에서는 Google API가 안정적으로 재현 가능한 오류를 반환함(Pass)까지만 검증했고, ALTON 자체 큐 적재·재처리는 이 R8 구현이 끝나야 검증 가능하다
- [ ] 학생·학부모 Drive ACL 없이 ALTON 서버를 통한 자료 제공
- [ ] iPad/Apple Pencil/회전/확대/스크롤 실기기 QA
- [ ] 느린 네트워크·오프라인·재접속 시험

## R9 — 교육 워크플로우 완성

- [ ] 과목 템플릿과 학생별 진도 스냅샷
- [ ] 선생님 변경 시 커리큘럼 인계
- [ ] 교재 승인·버전·저작권/AI 관여 기록
- [ ] 과제 마감일·제출·지각·재제출·채점·피드백
- [ ] 다음 수업 24시간 전 기본 과제 마감과 미제출 예약 허용
- [ ] 문제 기록·단어장·학생 피드백
- [ ] Gemini 초안→선생님 검토→확정 리뷰 상태
- [ ] 리뷰 18시간 알림·24시간 관리자 목록·36시간 QC
- [ ] 보호자 AI 회의록 동의·거부 이력과 수동 리뷰 대안
- [ ] **(Gate C GW-10 인수 기준, blocker)** 보호자가 AI 회의록을 거부하면 실제로 수동 리뷰 task가 생성되는지 인수 테스트로 확인 — Gate C에서는 Google API로 세션 단위 Smart Notes를 개별 OFF 전환할 수 있음(Pass)까지만 검증했고, ALTON 수동 리뷰 task 생성은 이 R9 구현이 끝나야 검증 가능하다
- [ ] 학생·보호자 지난 수업 기록 조회

## R10 — 결제·환불·선생님 정산

- [ ] 수업권 구매·환불·차지백 대사
- [ ] 미사용·미보류 유료 수업권만 환불 허용
- [ ] 중도 해지 시 구매 당시 실제 단건 판매가로 소진 회차 재정산
- [ ] 단건가·패키지가·환불 공식·예시의 결제 전 고지
- [ ] 무료·프로모션·보상 수업권 환불 제외
- [ ] 가족 기본 결제 통화 USD와 구매별 통화·가격 버전 스냅샷
- [ ] 원결제 통화·수단 환불
- [ ] 선생님 기본 지급 통화 KRW와 시급·통화 적용일 이력
- [ ] 단일통화 payout batch와 통화 변경 전후 분리
- [ ] USD 보고 통화와 리포트 전용 FX snapshot
- [ ] 세션별 payout item과 정산 근거
- [ ] 시급×정산 인정 분÷60 계산과 항목 스냅샷
- [ ] 항목 소수 정밀도 보존 후 정산 묶음에서 원 단위 반올림
- [ ] 체험·정규·보충·조정 구분
- [ ] 정산 묶음 생성·검토·승인·지급·역분개
- [ ] 월말 마감·3영업일 명세·5영업일 이의·10영업일 지급
- [ ] 선생님 정산 상세 조회와 이의제기
- [ ] 계좌 정보 변경 이력과 민감정보 보호
- [ ] 매출·선생님 비용·매출총이익 리포트

## R11 — 알림·문의·QC·운영 도구

- [ ] 이벤트별 알림 템플릿과 수신자 규칙
- [ ] 수업권 만료 30일·7일 전 학생·보호자 알림
- [ ] 수업권 잔여 3장·1장·0장 알림
- [ ] 이메일·인앱 전달 상태·재시도·중복 방지
- [ ] 사용자 알림 설정
- [ ] 학부모 문의와 관리자 지원 케이스
- [ ] 학부모-선생님 소통 채널 정책 구현
- [ ] 학생-선생님 비공개 DM 차단과 보호자 포함 과목 대화방
- [ ] 관리자 전체 대화방 검색·조회와 조회 감사 로그
- [ ] 선생님 변경 시 기존 대화방 읽기 전용 보관
- [ ] 90분 미만·Gemini 실패·36시간 미확정·지각·노쇼·민원 QC
- [ ] 신규 선생님 첫 3회와 전체 수업 무작위 5% QC
- [ ] 상담·계약·예약·수업권·정산 실패 재처리함
- [ ] 회사 문서와 계약 문서 검색·보존
- [ ] 운영 대시보드와 핵심 전환 지표

## R12 — 보안·감사·관찰·복구

- [ ] 역할·관계·capability 기반 서버 권한과 RLS
- [ ] **(R1에서 발견, 신규 회귀 아님 — 별도 보안 감사 항목)** 레거시(R0) SECURITY DEFINER 함수 9개(`is_admin`, `is_guardian_of`, `teaches_student`, `session_student_id`, `session_teacher_id`, `is_session_participant`, `is_session_related`, `is_enrollment_participant`, `is_enrollment_related`)가 `anon`/`public` 실행 가능 상태로 배포돼 있다(R1 실행 로그 `2026-08-29-r1-migration-execution-log.md` §6-7에서 실측 발견). 전부 `auth.uid()`로만 필터링되는 구조라 구조적으로 안전하지만(인자와 무관하게 anon은 항상 false), Gate B §7 최소 권한 원칙을 엄격히 적용하면 revoke 대상이다. R1 배치가 만든 문제가 아니므로 R1 push의 blocker로 잡지 않았고, 이 R12 단계에서 전수 재검토한다 — revoke 시 이 함수들을 참조하는 R0 RLS 정책에서 anon 조회가 하드 오류로 바뀌는 부작용이 있으므로(§6-3/§6-7과 동일한 문제 클래스) `current_user_has_capability()` 같은 안전한 대체 헬퍼 설계까지 함께 검토한다.
- [ ] **(R2 Task 7에서 발견, 2026-09-01 — 위 항목과 같은 문제 클래스, 원인까지 확인 완료)** 이 Supabase 프로젝트는 `public` 스키마에 새로 생성되는 모든 함수에 `anon`/`authenticated`/`service_role` EXECUTE를 자동 부여하는 기본 권한 규칙(`pg_default_acl`, owner `postgres`/`supabase_admin`)을 갖고 있다 — `revoke ... from public`만으로는 `anon`에 개별적으로 걸린 이 기본 권한이 회수되지 않는다. R2 Task 7의 `begin_workspace_preflight_run()`/`finish_workspace_preflight_run()`은 이를 확인하고 `20260907000000_r2_workspace_preflight_permissions_fix.sql`에서 `anon` EXECUTE를 명시적으로 revoke·`authenticated`로 한정했지만(원격 재검증 완료: anon 호출은 `42501 permission denied`), 같은 세션에서 실측한 바 R2 Task 7의 다른 기존 함수(`link_teacher_workspace_identity`, `record_workspace_created`, `suspend_teacher_workspace` 등)를 포함해 **이 프로젝트의 SECURITY DEFINER 함수 전체가 잠재적으로 같은 상태**다. 개별 함수의 `is_admin()`/`auth.uid()` 런타임 검사가 이중 방어로 실제 접근은 막고 있으나(각 함수 자체 로직 확인 필요), Gate B §7 원칙상 GRANT 층도 정리해야 한다 — 위 legacy 9개 함수 항목과 **하나의 전체 감사 작업으로 통합**해 처리한다: (1) 이 프로젝트의 모든 SECURITY DEFINER 함수 목록과 각각의 anon/public EXECUTE 현황 전수 조사, (2) 함수별로 anon 호출이 안전한지(런타임 검사로 항상 차단되는지) 개별 검증, (3) 안전이 확인된 함수부터 일괄 revoke, (4) 이후 `alter default privileges`로 이 프로젝트의 기본 권한 규칙 자체를 `revoke execute on functions from public/anon` 방향으로 재설정해 향후 신규 함수에 권한이 다시 자동으로 열리는 것을 원천 차단.
- [ ] 모든 중요 변경의 감사 로그
- [ ] **(R2 Task 7 실제 쓰기 검증 중 발견, 2026-09-01)** 운영 전 검증(테스트 계정 생성·suspend·reactivate 등)이 `teacher_rate_history`/`account_status_events`처럼 하드 immutable 트리거(bypass flag 없음, `service_role`까지 EXECUTE revoke)가 걸린 테이블에 실제 행을 남기면 정리할 방법이 없다 — Task 7 검증에서 만든 테스트 선생님(`teacher-provisioning-test@alton.education`, profile id는 이 항목·Task 7 실행 로그에 기록)의 `profiles`/`teachers`/`auth.users`조차 `teacher_rate_history` FK(`NO ACTION`) 때문에 삭제 불가해 `suspended` 상태로 영구 보존하기로 결정했다(사용자 확정, 물리 삭제·트리거 우회 안 함). 다음 3가지를 별도 보안·운영 정리 작업으로 등록한다:
  1. **운영 전 검증용 계정과 종속 이력을 안전하게 일괄 정리하는 관리자 전용 절차** — 일반 운영 이력의 immutability는 그대로 유지하되, 명시적으로 "테스트 데이터"로 표시된 행만 엄격한 조건(예: 관리자 재확인, 대상 profile에 실제 세션·정산·계약 이력이 전혀 없음을 자동 검증)과 자체 감사 기록 하에 정리할 수 있는 별도 경로 설계.
  2. 이를 위해서는 애초에 "이 profile/teacher가 테스트 데이터인지"를 구분할 수 있는 구조(예: `profiles`/`teachers`에 `is_test_data` 플래그, 또는 완전히 분리된 스테이징 프로젝트로 실제 쓰기 검증을 이관하는 방안 — Gate C 이후 실제 인프라 검증은 매번 운영 DB에 흔적을 남기고 있다는 근본 원인도 함께 검토)까지 포함해서 설계.
  3. **테스트 데이터가 정산·매칭·운영 통계에 절대 섞이지 않는다는 공통 필터 + 회귀 테스트.** 이번 케이스는 우연히 안전했다(`matching-data.ts`/`users-data.ts`가 이미 `status = 'active'`로 필터링하고 있고, `payouts-data.ts`는 실제 세션이 있어야만 금액을 계산하므로 세션 없는 테스트 계정은 자연히 제외됨) — 하지만 이는 각 쿼리가 우연히 가진 기존 필터 덕분이지, "테스트 데이터는 절대 섞이지 않는다"를 보장하는 명시적 장치가 아니다. `is_test_data`(또는 동등한) 플래그와, 정산/매칭/통계 관련 쿼리가 이를 실제로 배제하는지 확인하는 회귀 테스트를 추가한다.
- [ ] Google/Stripe/service-role 비밀값 관리
- [ ] **(R2 Task 7에서 이관, 정식 오픈 전 필수)** Google Workspace Directory API 호출의 domain-wide delegation 위임 대상을 `official@alton.education`(초기 Sandbox 검증 및 R2 Task 7 로컬 구현 단계에서 임시 사용)에서 **사용자 관리 권한만 가진 전용 자동화 관리자 계정**으로 분리한다. 서비스 계정 JSON 키·장기 OAuth refresh token은 계속 금지(Vercel OIDC→GCP WIF→signJwt 체인 유지).
- [ ] 허용 파일 형식·50MB 제한·악성 파일 검사·실행/압축/영상 차단
- [ ] 개인정보 보존·삭제·내보내기 절차
- [ ] **(2026-08-31 정정)** 데이터 종류별 retention policy — 계약·결제·환불·정산·시급 지급 기록 7년, 출결·예약·수업권 원장·학습 이력 3년, Gemini 회의록·전사·수업자료 1년, 채팅·상담 기록 2년, 보안·접근 감사 로그 1년, 법적 분쟁 자료는 legal hold 해제 시까지(전부 초기 운영정책, 정식 오픈 전 법률 검토로 조정 가능하게 정책 버전 관리). 상세는 `product-architecture-v3.md` §4.13 참고.
- [ ] **(Gate C GW-14 인수 기준, blocker)** 미검토 Smart Notes 원본(1년)과 확정 리뷰(3년)가 서로 다른 만료일로 추적·자동 삭제되는지 인수 테스트로 확인 — Google Drive는 파일 만료를 네이티브로 지원하지 않으므로 Gate C 범위 밖으로 분류했고, 이 저장·삭제 자동화 구현이 끝나야 검증 가능하다
- [ ] **(2026-08-31 정정, 메커니즘은 R2 Task 6에서 구현 완료)** 13세 미만 보호자 검증 동의와 동의 버전 이력 — 위 R2 Task 6 항목의 8개 후속 blocker(생년월일 확인 전 activate 불가, 보호자 DOB 입력 UI, DOB 최초입력/변경 구분과 강화된 확인·감사, COPPA 법률 검토, 관리자 수동 동의 하드닝 2건) 그대로 참고 — 여기서 별도로 다시 나열하지 않는다.
- [ ] DB·Google Drive·Supabase Storage 통합 삭제 작업
- [ ] **(2026-08-31 정정, R2 Task 5에서 정책 확정·이관)** 일반적인 서비스 중단(학생 수업 중단·계약 종료, 선생님 퇴사, 장기 미접속)은 `closed`나 자동 삭제·익명화 대상이 아니다 — `inactive`로 처리하고 학생 최소 3년·선생님 최소 7년의 복귀 지원기간을 둔다. `closed`로의 전환과 그 이후 제한 보관·순차 삭제·비식별화는 **사용자가 명시적으로 요청한 계정 폐쇄**에만 적용한다(30일 철회 유예 포함). 상세는 `product-architecture-v3.md` §4.13/§4.19 참고.
- [ ] **(R2 Task 5에서 이관, 정식 오픈 전 필수 인수 조건)** `inactive` 상태 도입과 상태 머신 반영, 학생·선생님 장기 복귀 정책 구현, 관리자 전용 `reactivate_account()` 정상 경로(신규 profile 미생성, 과거 계약/수업권/배정 자동 복원 금지, 복귀 시점 기준 신규 계약/수업권/시급 생성, 감사 이력), **`inactive`↔`active` 상태 전환·복귀 신청·복귀 승인을 다루는 관리자·사용자 UI**, 자료 유형별 보관기간 실제 자동 적용, `closed` 계정 제한 보관에 대한 접근통제(사유 입력 필수 + 조회/내보내기/변경 감사), 보관기간 종료 후 삭제·비식별화 자동화, 이 모든 배치를 실행할 정기 스케줄러 연결. R2 Task 5(계정 병합)는 이 중 병합 전용 백엔드(원본 계정 즉시 폐쇄, `account_merges`, `merge_accounts()`, `anonymize_merged_account()`, `teacher_rate_history_with_merged()`)만 구현했다 — **관리자가 실제로 병합을 실행하는 화면(후보 검색·확인·사유 입력·실행)도 아직 없다**(서버 액션 `app/admin/merge-actions.ts`만 존재). 병합 UI와 inactive 상태 머신·복귀 UI 둘 다 이 항목의 후속 작업이다.
- [ ] **(R2 종료 시 이관, 2026-09-01, 사용자 확정)** 이미 `active`인 계정의 로그인 이메일 자체를 정정하는 절차 — 현재 확정된 정책은 계정 병합(중복 계정 정리)뿐이고, "같은 계정의 이메일 오기를 정정"하는 별도 절차는 정책 자체가 없다(대기 중(pending) 초대의 오타는 기존 revoke+재발송으로 이미 충분히 해결됨 — 이 항목은 그 경우가 아니라 이미 활성화된 계정 한정). 단순 UPDATE가 아니라 본인확인 방법, Google Workspace/Supabase Auth 쪽 identity 재연결, 정정 대상 이메일이 이미 다른 계정에 쓰이고 있을 때의 충돌 처리, 감사 이력을 함께 설계해야 하는 별도 계정관리 정책 — 구현 전 제품 담당자가 정책부터 확정한다.
- [ ] legal hold와 자동 삭제 실패 재처리
- [ ] 구조화 로그·오류 추적·알림
- [ ] DB 백업과 복구 훈련
- [ ] 외부 서비스 권한 대조와 회수 작업
- [ ] 접근성·성능·브라우저 호환성

## R13 — 종단 QA·정식 오픈

- [ ] 상담→체험→제안→계약→결제→과목 수강→예약→수업→리뷰→정산 E2E
- [ ] 과목 추가·중단·재개
- [ ] 선생님 변경과 과거 기록·정산 보존
- [ ] 환불·취소·노쇼·Google 장애·결제 실패
- [ ] 복수 자녀·복수 보호자·복수 과목
- [ ] 4개 기본 역할과 슈퍼바이저 권한 우회 테스트
- [ ] iPad 실시간 수업 2인 동시 장시간 테스트
- [ ] 데이터 마이그레이션 리허설과 롤백
- [ ] 운영 매뉴얼·고객지원·장애 대응 훈련
- [ ] 실제 도메인·이메일·정책·법적 문서 점검
- [ ] **(R2 Task 4에서 이관, 정식 오픈 전 필수)** `mark_expired_invites()`를 주기적으로 실행하는 스케줄러(cron) 연결 — 실시간 만료 차단 자체는 이미 정상 동작하므로 기능 결함은 아니지만, 관리자 초대 목록 화면의 상태 정확도를 위해 오픈 전 반드시 연결한다.
- [ ] **(R2 Task 9 E2E 작성 중 발견, 2026-09-01, CI 안정화 필요)** `e2e/account-lifecycle.spec.ts`와 `e2e/account-merge.spec.ts`가 시드 데이터의 같은 전역 계정(선생님 박서연 `dddddddd-...0001`, 학부모 김민지 `bbbbbbbb-...0001`)의 상태를 직접 변경·병합한다 — `playwright.config.ts`의 `fullyParallel:true`(worker 수 미지정) 아래서 다른 스펙 파일이 같은 워커 구간에 동시 실행되면 그 계정을 공유하는 다른 테스트(`auth-roles.spec.ts`, `minor-consent.spec.ts`, `session-review-flow.spec.ts` 등)가 레이스로 실패할 수 있다(실측 확인: 기본 병렬 실행 시 6개 실패, `--workers=1`로는 전부 통과). `account-lifecycle.spec.ts`는 `test.describe.serial`로 최소한 파일 내부 레이스는 막아뒀지만 파일 간 레이스는 남아있다 — 근본 해결은 이 두 스펙이 전역 시드 계정 대신 테스트마다 새로 만드는 전용 픽스처를 쓰도록 리팩터링하는 것이다. 정식 오픈 전 CI에서 기본 병렬 설정으로 안정적으로 통과하는지 확인 필요.

G6: 모든 필수 여정과 예외 여정이 통과하고, 미결정 정책·수동 DB 작업·출시 차단 결함이 0개일 때만 오픈한다.

## 3. 병렬화 가능 범위

R0 승인 후 다음은 병렬로 검증할 수 있다.

- Google Calendar/Meet/Drive 기술 검증
- 화이트보드 동시성·iPad 기술 검증
- Stripe 수업권 원장 이벤트 설계
- 가족/계정 UX 설계

하지만 R1 데이터 모델이 승인되기 전 최종 UI와 서버 액션을 확정하지 않는다.

## 4. 진행 보고 형식

각 단계는 다음 네 상태만 사용한다.

- `Not ready`: 정책 또는 선행 모델 미확정
- `Ready`: 요구사항·의존성·완료 조건 확정
- `In progress`: 구현과 검증 진행 중
- `Done`: 코드·테스트·마이그레이션·운영 문서·게이트 통과

부분 구현을 `Done`으로 표시하지 않는다.
