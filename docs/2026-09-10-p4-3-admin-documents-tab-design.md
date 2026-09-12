# P4-3 관리자 문서 탭 설계 — 회사 문서 / 계약 / 동의서

상태: **설계안(2026-09-10 최초, 2026-09-12 P4-2 구현 대조 반영). 구현 착수 전
제품 오너 승인 필요.**
범위 근거: `docs/2026-09-10-p-execution-roadmap.md:982-994`(P4-3 관리자 문서 운영).
대조 대상: P4-2 구현(`docs/2026-09-12-p4-2-teacher-settlement-plan.md`,
마이그레이션 `20261284000000_p4_2_teacher_payout_account_and_documents.sql`).

이 문서는 계획만 만든다. 코드·마이그레이션·환경변수·Google Drive 권한은
이 설계 승인 전에 아무것도 바꾸지 않는다.

---

## 1. 개요

### 2026-09-11 추가 확정 — 교사 제출 서류 아카이브

- 기존 회사 문서·계약·동의서 구성에 **교사별 제출 서류 보관 영역**을 추가한다.
  아래의 기존 3분할 설명은 초기 설계이며, 이 추가 범위를 반영해 상세 설계한다.
- 교사가 본인 제출 창구에서 업로드하면 관리자 `문서`에서 해당 교사별로
  아카이빙되어 조회·다운로드할 수 있어야 한다. 단순 업로드·보관 창구로 사용한다.
- **제출 여부·검토·승인·보완 상태를 정산·매칭·수업 등 특정 업무의 게이트로
  사용하지 않는다.** 미제출 시 정산 보류 여부는 미결정 항목이 아니라 게이트를
  두지 않는 것으로 확정한다.
- 교사는 본인 서류만 접근하며 기존 관리자 전용 계약·동의서 권한은 확대하지
  않는다. 파일과 교사 연결, 저장 경로·메타데이터·접근 권한은 후속 상세 설계한다.
  회사 문서의 읽기 전용 정책과 교사 제출용 업로드 경로는 구분한다.
- 계좌 정보는 관리자 `정산`의 교사별 목록에서 조회한다(P4-2). 이 절은 계획
  반영이며 현재 P4-1 작업에 추가하지 않고, 코드·DB·Drive 권한을 변경하지 않는다.

### 2026-09-12 대조 — P4-2가 이미 만든 것 / P4-3이 할 일

P4-2 구현이 끝나면서 이 설계의 전제 두 가지가 바뀌었다.

- **바뀐 것 1 — 저장소가 이미 있다.** `teacher_documents` 테이블과 비공개
  Storage 버킷 `teacher-documents`가 P4-2에서 생성됐다. P4-3은 **새로 만들지
  않고 읽기만 한다**(§6). 교사 서류용 추가 migration은 필요 없다.
- **바뀐 것 2 — 게이트 불가가 스키마로 고정됐다.** `teacher_documents`에는
  승인·검토·보완 상태 컬럼이 아예 없다. 정책 문장뿐 아니라 **구조적으로**
  게이트를 만들 수 없고, 그 부재는 회귀 테스트로 고정돼 있다
  (`app/teacher/teacher-settlement-rls.integration.test.ts`).
- **그대로인 것**: 회사 문서(Drive 읽기 전용)·계약(읽기 전용 아카이브)·
  동의서(이관) 설계는 변경 없다.

### 1.1 목표

관리자에 독립된 **문서** 탭을 신설하고 세 개의 서브 영역으로 구성한다.

| 서브탭 | 성격 | 데이터 원본 |
| --- | --- | --- |
| 회사 문서 | 법인 기초 서류·계약서 양식 열람/다운로드 | Google Drive(폴더 구조·파일 메타데이터 자체가 1차 진실 소스) |
| 계약 | **읽기 전용 아카이브** — 계약·서명 상태 조회, 서명본 다운로드 | `contracts` / `contract_versions` / `drive_artifacts` |
| 동의서 | 보호자 동의 대기·완료 현황(기존 `신규 > 보호자 동의 대기` 이관) | `profiles` / `guardian_consents` |
| 교사 서류 | **읽기 전용 보관함** — 교사별 제출 파일 조회·다운로드 | `teacher_documents` + 비공개 Storage 버킷 `teacher-documents` (**P4-2에서 이미 생성됨**) |

### 1.2 확정 정책(재논의하지 않음)

1. 문서 탭은 회사 문서 / 계약 / 동의서 3분할.
2. 회사 문서는 기존 계약 capability와 **분리된 신규 capability**를 쓴다.
3. `company_documents` 테이블은 **되살리지도 삭제하지도 않는다** — 이 기능에서 참조하지 않는다.
4. 회사 문서의 1차 진실 소스는 Drive 폴더 구조와 파일 메타데이터다. 파일 목록용 로컬 캐시 테이블을 만들지 않는다.
5. 검증용 Shared Drive(`ALTON Integration Sandbox`)는 재사용하지 않는다. 전용 Drive 또는 전용 최상위 폴더를 새로 만든다(§5.2 권고안).
6. `문서 > 계약`은 조회·다운로드만 한다. 발송/재발송/무효화 버튼을 두지 않는다.
7. 계약 쓰기 동작의 진입점은 `신규 > 정규 계약 발송` **한 곳뿐**이다.
8. 보호자 동의 대기는 `문서 > 동의서`로 이관한다.
9. **교사 서류는 P4-2가 만든 원본을 그대로 읽는다** — 관리자용 사본 테이블·
   캐시·별도 버킷을 만들지 않는다. 업로드 창구는 교사 포털 `정산` 탭 하나뿐이고,
   관리자 문서 탭은 **읽기 전용**이다(업로드·삭제·대체 버튼을 두지 않는다).
10. **제출·검토·승인·미제출 여부는 어떤 업무의 조건도 되지 않는다.** 정산·매칭·
    수업 어느 경로도 `teacher_documents`를 읽지 않는다. 화면에도 "미제출",
    "검토 필요", "승인됨" 같은 상태 배지를 만들지 않는다.
11. 교사는 본인 파일만 접근한다(P4-2 경로 그대로, 변경 없음). 계약·동의서의
    관리자 전용 권한은 확대하지 않는다.

### 1.3 이번 범위 밖

- 실제 Drive/폴더 생성, Shared Drive 멤버십·권한 부여
- 실제 환경변수 추가(이 문서에 이름과 용도만 기록)
- 마이그레이션 **실행**(§7 결론: 문서 접근 감사 테이블 1건이 필요하다 —
  설계만 하고 이번 라운드에서 작성·적용하지 않는다)
- `teacher_documents`·`teacher-documents` 버킷의 스키마 변경(P4-2 구조를 그대로 쓴다)
- 회사 문서 업로드·편집·삭제(1차는 읽기 전용)
- `company_documents` 테이블의 복구 또는 제거

---

## 2. 정보 구조

### 2.1 현재 내비게이션

관리자 탭 id의 단일 진실 소스는 `app/admin/admin-tabs.ts:8-21`이다.

```
home, users, matching, consult, inquiry, catalog, billing,
entitlements, unified-schedule, booking, payouts, workspace
```

숨김 탭은 `app/admin/admin-tabs.ts:25`(`devlog`), 라벨·아이콘은
`app/admin/AdminShell.tsx:55-67`, 모바일 그룹 분류는
`app/admin/AdminShell.tsx:205-219`에 있다. `?tab=` 정규화는
`app/admin/admin-tabs.ts:33-35`의 `resolveAdminTab()`이 담당하고,
서버 컴포넌트 `app/admin/page.tsx:56-58`이 같은 함수로 탭별 SSR 로더를
게이팅한다.

### 2.2 추가 내용

- `ADMIN_NAV_TAB_IDS`에 `"documents"`를 추가한다(`app/admin/admin-tabs.ts:8`).
  삽입 위치는 **`workspace` 앞**을 권고한다 — 운영 흐름(신규·문의·일정·예약)
  뒤, 시스템성 탭(Workspace) 앞이 문서 아카이브의 성격에 맞는다.
- `AdminShell.tsx`의 `NAV_ITEMS`에 `{ id: "documents", label: "문서", icon: "📄" }`를
  추가하고(`app/admin/AdminShell.tsx:55-67`), 모바일 그룹은 `OPERATIONS_IDS`에
  포함시킨다(`app/admin/AdminShell.tsx:205-214`). `OPERATIONS_IDS`/`CONTENT_IDS`에
  들어가지 않은 id는 자동으로 "정산" 그룹으로 떨어지므로
  (`app/admin/AdminShell.tsx:219`) 누락하면 문서 탭이 정산 그룹에 표시된다 —
  반드시 명시적으로 넣는다.
- 서브탭은 상위 탭 내부 `useState`로 관리한다. `신규` 탭이 쓰는 방식
  (`app/admin/ConsultationTab.tsx:46-55`의 `SUB_NAV`, `:91`의 `useState<SubTab>`)을
  그대로 따르고, 서브탭을 URL에 싣지 않는다(현행 관례와 일치).
- 서브탭 순서(2026-09-12 갱신): `회사 문서` → `계약` → `동의서` → `교사 서류`.
  기본 서브탭은 **`계약`**을 권고한다 — 회사 문서는 별도 capability가 없으면
  빈 화면이 되고, 계약이 가장 자주 쓰이는 조회 대상이다. `교사 서류`는 조회
  빈도가 가장 낮아 맨 뒤에 둔다.
- 서브탭별 게이트가 다르다는 점에 주의한다: `회사 문서`만
  `manage_company_documents` capability이고, `계약`·`동의서`·`교사 서류`는
  전부 `requireAdmin()`이다(§9-1, §9-9). 서브탭 하나가 권한 부족으로 비어도
  나머지 서브탭은 정상 동작해야 한다 — 탭 전체를 막지 않는다.

### 2.3 기존 탭에 대한 영향

- `신규` 탭에서 `보호자 동의 대기` 서브탭 하나가 제거된다
  (`app/admin/ConsultationTab.tsx:52`, `:127`). 나머지 7개 서브탭은 그대로다.
- `신규 > 정규 계약 발송`(`app/admin/RegularContractTab.tsx`)은 손대지 않는다.
  계약 쓰기 동작의 유일한 진입점으로 유지한다.
- `신규 > 오류/재처리 현황판`은 그대로 `신규`에 남는다(재처리 버튼이 있는
  운영 화면이므로 문서 아카이브와 성격이 다르다). 단 이 화면도 `consentGaps`를
  읽으므로 데이터 의존 처리는 §4를 따른다.

### 2.4 계약 화면 2개의 역할 분리(중복 금지 규칙)

| | `신규 > 정규 계약 발송` | `문서 > 계약` |
| --- | --- | --- |
| 성격 | 액션 큐(오늘 처리할 것) | 아카이브(전체 이력 조회) |
| 대상 | 발송 대기·진행 중 후보만 | 모든 계약, 모든 상태 |
| 동작 | 발송·재발송·완료 처리 | 조회·필터·검색·다운로드 |
| 서버 액션 | `sendRegularContractOneClickAction`, `createNewContractVersionForResend` (`app/admin/RegularContractTab.tsx:11-14`) | 조회 로더 + 다운로드 액션만 |

**구현 규칙**: `문서 > 계약` 컴포넌트는 `trial-onboarding-actions.ts`의 발송
액션, `consultation-actions.ts:633`의 `voidContractVersion`을 **import 하지
않는다**. 이 규칙은 테스트로 고정한다(§8 참고).

---

## 3. 계약 아카이브 설계 (`문서 > 계약`)

### 3.1 데이터 원본 — 실제 컬럼

마이그레이션에서 재확인한 실제 스키마다.

**`contracts`** (`supabase/migrations/20260830010000_r1_household_contract.sql:68-76`에서
`contracts_v3`로 생성 → `supabase/migrations/20260911000000_r3_contracts_cutover.sql:24`에서
`contracts`로 rename)

| 컬럼 | 타입 |
| --- | --- |
| `id` | uuid PK |
| `household_id` | uuid → `households(id)` |
| `child_id` | uuid → `profiles(id)` |
| `status` | `v3_contract_status` |
| `created_at`, `updated_at` | timestamptz |
| `void_reason`, `voided_at` | text / timestamptz (`supabase/migrations/20260915000000_r3_contract_void_reason.sql:12-13`) |

`v3_contract_status` enum 값 11개(`supabase/migrations/20260830000000_r1_enums_and_capabilities.sql:9-12`):
`draft, ready, sent, awaiting_signature, signed, active, termination_pending,
terminated, void, superseded, expired`.

불변식: child당 `active` 계약은 1개
(`supabase/migrations/20260830010000_r1_household_contract.sql:81-82` 부분 unique index).

**`contract_versions`** (`.../20260830010000_r1_household_contract.sql:84-92` + R3 추가분)

| 컬럼 | 출처 |
| --- | --- |
| `id`, `contract_id`, `version_number`, `price_policy_snapshot`, `created_by`, `created_at` | `20260830010000_r1_household_contract.sql:84-92` |
| `docusign_envelope_id`, `docusign_envelope_status`, `docusign_status_updated_at` | `20260913000000_r3_contract_model_realignment.sql:91-93` |
| `template_version`, `company_signing_entity`, `guardian_snapshot`, `student_snapshot`, `privacy_policy_version`, `refund_policy_version`, `consent_policy_version_id`, `proposal_id` | `20260913000000_r3_contract_model_realignment.sql:105-113` |
| `company_signed_at`, `company_signed_by` | `20260913000000_r3_contract_model_realignment.sql:128-129` |
| `version_status` (`active`/`superseded`) | `20260913000000_r3_contract_model_realignment.sql:139-140` |
| `version_reason` (`initial`/`resend`/`re_enrollment`/`material_terms_change`/`party_change`) | `20260918000000_r3_contract_version_reason.sql:7-16` |

`v3_docusign_envelope_status` = `sent, delivered, completed, declined, voided`
(`20260912000000_r3_consultation_trial_proposal_payment_handoff.sql:35`).

**`drive_artifacts`** (`20260912000000_r3_consultation_trial_proposal_payment_handoff.sql:259-272`)

`id`, `contract_id`, `drive_file_id`, `artifact_type`(`signed_document` /
`certificate_of_completion`), `sync_status`(`v3_drive_job_status`:
`queued, processing, succeeded, retryable_failed, manual_review`), `checksum`,
`size_bytes`, `uploaded_at`, `created_at`, `updated_at`.

**참고 테이블(상세 화면에서만 조인)**

- `contract_company_approvals` — `contract_version_id`(unique), `approved_by`,
  `approver_name`, `approver_title`, `company_entity_name`, `document_identifier`,
  `approved_at` (`20261021000000_m4_contract_company_approval_audit.sql:8-17`)
- `contract_activation_retries` — `contract_id`, `contract_version_id`,
  `envelope_id`, `failure_reason`, `created_at`, `resolved_at`, `resolved_by`
  (`20260919000000_r3_contract_activation_retry.sql:10-19`). 문서 탭에서는
  "활성화 실패 이력"으로 **표시만** 하고 재시도 버튼은 두지 않는다(재시도는
  `신규 > 오류/재처리 현황판`에 이미 있다).

### 3.2 권한

RLS 현황을 그대로 따른다.

- `contracts` select: `child_id = auth.uid()` 또는 같은 household 구성원 또는
  `is_admin()` (`supabase/migrations/20260830080000_r1_rls_policies.sql:77-82`,
  cutover에서 정책명만 rename — `20260911000000_r3_contracts_cutover.sql:39`).
- `contract_versions` select / `drive_artifacts` select:
  `is_admin() or current_user_has_capability('manage_consultations') or` 본인 가족
  (`20260913000000_r3_contract_model_realignment.sql:172-181`,
  `20260912000000_r3_consultation_trial_proposal_payment_handoff.sql:363-372`).

→ 앱 레이어 게이트는 `requireAdminOrCapability("manage_consultations")`
(`lib/admin-auth.ts:25`)를 쓴다. 새 capability를 만들지 않는다 — 계약 조회에
관한 DB RLS가 이미 이 문자열로 열려 있고, 다른 문자열을 앱에서만 쓰면
"앱은 통과하는데 DB가 빈 결과를 주는" 어긋남이 생긴다.

> **주의(열린 항목 §9-1)**: `contracts` 자체의 select 정책에는
> `manage_consultations`가 없다. `role='admin'`이 아닌 운영자는
> `contract_versions`는 보이는데 `contracts`는 안 보이는 비대칭 상태다.
> 현재 실제 운영자는 전부 `role='admin'`이라 드러나지 않지만, 문서 탭은
> `contracts`를 주 목록으로 쓰므로 이 비대칭을 그대로 둘지 결정이 필요하다.

### 3.3 목록 화면

**필터**

| 필터 | 값 |
| --- | --- |
| 계약 상태 | `v3_contract_status` 11개 + "전체". 기본값은 "전체" |
| 서명 상태 | `v3_docusign_envelope_status` 5개 + "전체"(최신 active 버전 기준) |
| 서명본 보관 상태 | `drive_artifacts.sync_status` 5개 + "전체" |
| 검색 | 학생명 / 보호자명 / 계약 id 접두사. `profiles.name` ilike + `households` 조인 |
| 기간 | `contracts.created_at` 범위(기본 무제한) |

**목록 행 표시 항목**

| 표시 | 원본 |
| --- | --- |
| 학생명 | `profiles.name` (`contracts.child_id` 조인) |
| 보호자명 | `households.primary_guardian_id` → `profiles.name` |
| 계약 상태 | `contracts.status` |
| 최신 버전 | `max(contract_versions.version_number)` (= `version_status='active'` 행) |
| 서명 상태 | 해당 버전의 `docusign_envelope_status` + `docusign_status_updated_at` |
| 회사 서명 | `company_signed_at` 유무 배지 |
| 서명본 | `drive_artifacts`에서 `artifact_type='signed_document'` 행의 `sync_status`. `succeeded`이고 `drive_file_id`가 있을 때만 다운로드 버튼 활성 |
| 생성일 | `contracts.created_at` |

**쿼리 예산**: 목록은 **2 쿼리 이하**로 고정한다. (1) `contracts` +
`profiles`/`households` 임베디드 조인 1회, (2) 현재 페이지 계약 id 배열에 대한
`contract_versions` + `drive_artifacts` 배치 조회 1~2회. 행마다 추가 조회하는
N+1 패턴을 금지한다(같은 세션에서 매칭 현황표 N+1을 이미 제거한 전례가 있다 —
커밋 `b95c224`). 페이지네이션은 50행 단위 커서를 권고한다.

### 3.4 상세 화면

슬라이드오버 패널 1개. 표시 항목:

1. **계약 요약** — 학생/보호자, `status`, `created_at`/`updated_at`,
   `void_reason`·`voided_at`(있을 때만)
2. **버전 이력**(`contract_versions`를 `version_number` 내림차순) — 버전 번호,
   `version_reason`, `version_status`, `docusign_envelope_id`,
   `docusign_envelope_status`, `docusign_status_updated_at`,
   `company_signed_at`/`company_signed_by`, `template_version`,
   `company_signing_entity`, `privacy_policy_version`, `refund_policy_version`
3. **회사 승인 감사 기록** — `contract_company_approvals`의 `approver_name`,
   `approver_title`, `company_entity_name`, `document_identifier`, `approved_at`
4. **Drive 산출물** — `artifact_type`별 `sync_status`, `uploaded_at`,
   `size_bytes`, `checksum`, 다운로드 버튼
5. **활성화 실패 이력** — `contract_activation_retries`의 `failure_reason`,
   `created_at`, `resolved_at` (표시 전용)

`price_policy_snapshot`/`guardian_snapshot`/`student_snapshot`은 jsonb 원문이라
기본 접힘 상태로 두고 펼쳤을 때만 렌더한다.

**행동**: 다운로드와 "닫기"뿐. 발송/재발송/무효화 버튼 없음.

### 3.5 다운로드 흐름

**선택안: 서버 액션(또는 Route Handler)이 Drive에서 바이트를 받아 스트리밍한다.
서명 URL을 브라우저에 주지 않는다.**

근거:

- Drive v3에는 단기 서명 URL을 발급하는 깔끔한 API가 없다.
  `webContentLink`는 **호출자 권한이 아니라 열람자 자신의 Google 계정 권한**으로
  평가되므로, 회사 Shared Drive에 초대되지 않은 관리자 브라우저에서는 그냥 403이
  된다. `files.get?alt=media`의 응답 리다이렉트 URL을 그대로 넘기는 방식은
  사실상 서비스 계정 토큰을 URL에 실어 보내는 것과 같아 금지한다.
- 서버 경유 방식이면 **ALTON 세션 권한**으로 접근을 판정할 수 있다 — 이게
  핵심 요구사항이다(개인정보가 포함된 계약서).

**흐름**

```
클릭 → downloadContractArtifactAction(driveArtifactId)
  1. requireAdminOrCapability("manage_consultations")   // lib/admin-auth.ts:25
  2. RLS가 걸린 사용자 클라이언트로 drive_artifacts 행 조회
     (id로 조회 → 없거나 안 보이면 그대로 "권한 없음")
  3. sync_status='succeeded' 이고 drive_file_id 가 있는지 확인
  4. Drive 토큰 획득(§5.3의 경로 분기와 동일)
  5. GET /drive/v3/files/{drive_file_id}?alt=media&supportsAllDrives=true
  6. 응답 body 를 그대로 스트리밍,
     Content-Type: application/pdf
     Content-Disposition: attachment; filename="<학생명>-<artifact_type>-<버전>.pdf"
```

구현 형태는 **Route Handler**(`app/api/admin/contract-artifacts/[id]/route.ts`)를
권고한다 — 서버 액션은 바이너리 스트림 반환에 적합하지 않고, 큰 PDF를
base64로 부풀리게 된다.

**재사용 지점**: `lib/drive-artifacts.ts:13-23`의 `driveFetch()`가 정확히 이
용도의 래퍼지만 **export 되어 있지 않다**(export 목록은
`lib/drive-artifacts.ts:346-347`). 구현 시 `driveFetch`를 export 하거나
`lib/drive/fetch.ts`로 추출해 공유한다. 복붙 금지.

**로깅(2026-09-12 정정)**: 다운로드는 개인정보 접근이므로 구조화 로그와
**DB 감사 기록을 함께** 남긴다. 초안에는 "감사 테이블은 만들지 않는다"고
적혀 있었으나 §9-4에서 "1차부터 DB 감사 기록을 남긴다"로 확정됐다 —
이 문단이 그 확정과 어긋나 있었고, 여기서 확정 쪽으로 통일한다. 기록 대상은
§7이 정의하는 공용 테이블 `document_access_events` 한 곳이다(계약 서명본과
교사 제출 서류가 같은 테이블을 쓴다).

---

## 4. 동의서 이관 설계 (`문서 > 동의서`)

### 4.1 현재 상태

- `ConsentGapSection`은 `app/admin/ConsultationTab.tsx:685-744`에 정의된
  로컬 컴포넌트다. props는 `gaps: ConsentGapItem[]`, `completed:
  CompletedConsentItem[]` 두 개뿐이고 서버 액션을 호출하지 않는다 —
  **완전히 self-contained**이다. 내부 상태는 `view: "pending" | "done"`
  하나(`:686`).
- 사용처는 `app/admin/ConsultationTab.tsx:127` 한 곳.
- 데이터는 SSR로 내려온다: `app/admin/page.tsx:105-106`에서
  `loadConsentGaps` / `loadCompletedConsents`를 `need("consult")` 조건으로
  실행하고, `:161-162`에서 `AdminShell`에 넘긴다.
- **공유 의존**: 같은 `consentGaps` 배열이 `ErrorDashboardSection`
  (`app/admin/ConsultationTab.tsx:746-`, 사용처 `:131-137`)의 "보호자 동의 차단"
  섹션(`:883-897`)에서도 읽힌다. 이쪽은 표시 전용이고(재시도 불가 문구가
  명시돼 있다) 동의서 탭과 같은 데이터를 본다.
- 로더 `loadConsentGaps`는 `app/admin/consultation-data.ts:192-227`. `profiles`
  전체 student 조회 + `guardian_consents` 배치 조회로 2쿼리다.
  짝인 `loadCompletedConsents`는 `:240-`.

### 4.2 이관 방식 — SSR prop 드릴링을 끊고 TTL 캐시 지연 조회로 통일

두 화면이 서로 다른 최상위 탭으로 갈라지므로, 지금처럼 `page.tsx`가
`need("consult")`로 한 번 읽어 prop으로 내리는 구조는 유지할 수 없다
(문서 탭에서는 그 조건이 false다). 조건에 `"documents"`를 덧붙여 계속
드릴링하면 **동의서만 보려는 관리자가 오류 현황판용 로더까지 전부 실행하는**
역행이 된다(P1-3에서 탭별 로더 분리로 없앤 바로 그 문제 —
`app/admin/page.tsx:50-58` 주석).

대신 이미 확립된 TTL 캐시 패턴을 쓴다:
`app/admin/use-tab-cached-data.ts`의 `useTabCachedData`, 저장소는
`app/admin/tab-data-cache.ts`. 이 캐시는 컴포넌트 트리 밖 모듈 상태라
**두 탭이 같은 `cacheKey`를 쓰면 자연히 한 번만 fetch되고 공유된다** —
공통 부모로 끌어올릴 필요가 없다(문서 탭과 신규 탭은 공통 부모가
`AdminShell`뿐이라, 거기로 올리면 다시 전역 드릴링이 된다).

### 4.3 단계별 작업 순서

1. **서버 액션 추가** — `app/admin/consent-actions.ts`(기존 파일,
   `CAPABILITY = "manage_guardian_consent"`가 이미 `:5`에 있다)에
   `listConsentGapsAction()` / `listCompletedConsentsAction()`을 추가한다.
   내부에서 `requireAdminOrCapability("manage_guardian_consent")`로 게이트하고
   기존 `loadConsentGaps`/`loadCompletedConsents`(`consultation-data.ts:192`,
   `:240`)를 그대로 호출한다. **로더 함수 자체는 수정하지 않는다.**
2. **컴포넌트 추출** — `ConsultationTab.tsx:685-744`의 `ConsentGapSection`을
   `app/admin/ConsentGapSection.tsx`로 그대로 옮긴다. props 시그니처는
   변경하지 않는다(순수 표시 컴포넌트로 유지 → 테스트가 그대로 산다).
   `card` 상수(`ConsultationTab.tsx:62`)는 새 파일에 복제한다.
3. **데이터 컨테이너 추가** — `app/admin/ConsentGapPanel.tsx`(문서 탭용):
   ```ts
   useTabCachedData<ConsentGapItem[]>({
     cacheKey: "consent-gaps", ttlMs: 30_000,
     fetcher: listConsentGapsAction,
   })
   // completed 는 cacheKey: "consent-completed" 로 별도
   ```
   TTL 30초를 권고한다(상태 변화가 드문 화면 — 정규 계약 발송의 10초와 대비,
   `app/admin/RegularContractTab.tsx:19`).
4. **오류 현황판 쪽 전환** — `ErrorDashboardSection`이 `consentGaps`를
   prop으로 받던 것을(`ConsultationTab.tsx:748`, `:754`) 제거하고, 그 안에서
   **같은 `cacheKey: "consent-gaps"`**로 `useTabCachedData`를 호출한다.
   한 탭에서 이미 읽었으면 TTL 내에는 네트워크 요청이 나가지 않는다
   (`use-tab-cached-data.ts:29-34`의 age 체크).
5. **SSR 정리** — `app/admin/page.tsx`에서 `loadConsentGaps` /
   `loadCompletedConsents` 호출(`:105-106`)과 import(`:11-12`),
   `AdminShell` prop 전달(`:161-162`)을 제거한다. `AdminShell`·
   `ConsultationTab`의 `consentGaps`/`completedConsents` prop 타입도 함께 제거한다
   (`ConsultationTab.tsx:68`, `:80`).
6. **신규 탭에서 서브탭 제거** — `SUB_NAV`의 `{ id: "consent", ... }`
   (`ConsultationTab.tsx:52`)와 렌더 분기(`:127`) 삭제. `SubTab` 유니언에서도 제거.
7. **회귀 테스트** — `app/admin/ConsultationTab.test.tsx`에서 동의 관련
   케이스를 새 `ConsentGapSection.test.tsx`로 옮기고, 오류 현황판의
   "보호자 동의 차단" 섹션이 여전히 렌더되는지 확인하는 케이스를 추가한다.

### 4.4 왜 공통 부모로 끌어올리지 않는가

`문서 > 동의서`와 `신규 > 오류/재처리 현황판`의 유일한 공통 부모는
`AdminShell`이다. 거기에 상태를 두면 어느 탭에 있든 동의 데이터를 들고 있게
되어 P1-3이 없앤 전역 로딩으로 되돌아간다. 모듈 레벨 TTL 캐시는 컴포넌트
트리와 무관하게 살아 있으므로(`tab-data-cache.ts:8-19` 주석) 같은 효과를
비용 없이 낸다. 관리자 계정 전환 시 캐시가 비워지는 것도 이미 처리돼 있다
(`tab-data-cache.ts:24-29`의 `setActiveAdminUser`).

---

## 5. 회사 문서 Drive 통합 설계 (`문서 > 회사 문서`)

### 5.1 Capability 이름 제안

현재 저장소의 capability 문자열은 **두 계열이 섞여 있다**:

| 계열 | 예 | DB RLS 존재 여부 |
| --- | --- | --- |
| snake_case 영문 | `manage_invites`, `manage_consultations`, `manage_payments`, `manage_guardian_consent`, `manage_teacher_workspace`, `manage_account_merges`, `manage_bookings` | **있음** (`supabase/migrations/20260909000000_r2_task8_capability_gates.sql` 전반) |
| 한글 | `매칭권한`(`app/admin/matching-common-actions.ts:21`), `예약관리권한`(`app/admin/booking-actions.ts:18`), `학생관리`(`app/admin/invite-actions.ts:98`), `계약권한`(`supabase/migrations/20260830080000_r1_rls_policies.sql:84`) | 대부분 앱 레이어 전용 |

DB RLS까지 일관되게 쓰이는 쪽은 snake_case 영문이다. 따라서:

> **제안: `manage_company_documents`**

이유: (1) 새 capability는 앱 레이어에서만 쓰이지만 이름은 주류 관례를 따르는
편이 장기적으로 낫고, (2) 회사 문서는 새 DB 테이블을 만들지 않으므로 대응
RLS 정책이 없어도 모순이 없으며, (3) `계약권한`/`manage_consultations`와
문자열이 완전히 분리돼 "계약 조회 권한 ≠ 회사 문서 열람 권한"이 문자열만
봐도 드러난다.

`app/admin/company-documents-actions.ts`에
`const CAPABILITY = "manage_company_documents";`로 선언하는 기존 관례
(`app/admin/consent-actions.ts:5`, `app/admin/merge-actions.ts:6`)를 따른다.
`role='admin'`은 `requireAdminOrCapability`가 무조건 통과시키므로
(`lib/admin-auth.ts:34-36`) 현행 관리자는 별도 부여 없이 바로 쓸 수 있다.

### 5.2 Drive 리소스: 전용 Shared Drive vs 전용 최상위 폴더

| 기준 | (A) 전용 Shared Drive | (B) 기존 Drive 안 전용 최상위 폴더 |
| --- | --- | --- |
| 권한 격리 | 서비스 계정을 그 Drive에만 멤버로 초대 → 다른 회사 자료 접근 불가 | 폴더 단위 공유. 상위 Drive 멤버십이 상속되면 격리가 깨질 수 있음 |
| 코드 단순성 | `drives.list`로 이름 조회 후 그 안을 순회 — `lib/drive-artifacts.ts:59-67`의 기존 패턴 그대로 | 폴더 id를 환경변수로 고정하면 조회 1단계가 줄어 더 단순 |
| Workspace 관리 부담 | Shared Drive 신규 생성 1회 + 멤버 1명 초대 | 폴더 생성 + 공유 설정. 상위 Drive 권한 감사 필요 |
| 사고 반경 | 서비스 계정이 탈취돼도 그 Drive만 노출 | 상위 Drive 전체가 노출될 위험 |
| 대상 문서 성격 | 법인 기초 서류 — 민감도 높음 | 동일 |

> **권고: (A) 전용 Shared Drive.** 대상이 법인 기초 서류라 권한 격리가 운영
> 단순성보다 우선한다. Shared Drive 1개 추가는 Workspace 관리자 입장에서
> 일회성 작업이고, "이 서비스 계정은 이 Drive밖에 못 본다"는 사후 감사가
> 명확해진다. 검증용 `ALTON Integration Sandbox`
> (`lib/drive-artifacts.ts:10`)는 사용하지 않는다.

**구현이 소비해야 할, 향후 생성될 리소스 명세**(이번에 만들지 않는다):

1. 전용 Shared Drive 1개 — 이름 예: `ALTON Company Documents`
2. 그 안의 폴더 구조(1차):
   - `법인 서류/`
   - `계약서 양식/`
3. 서비스 계정을 이 Drive에 **Viewer(읽기 전용)** 로 초대.
   업로드를 하지 않으므로 Content Manager가 필요 없다 — 최소권한.
4. Drive id 또는 폴더 id를 환경변수로 고정(§5.5). **이름으로 찾지 않는다** —
   `getTestFolderId()`(`lib/drive-artifacts.ts:55-68`)가 실제 이름 대소문자
   불일치로 한 번 깨진 전례가 있다(`lib/drive-artifacts.ts:56-58` 주석).

### 5.3 재사용할 인증 경로

새 인증 체인을 만들지 않는다. 기존 Drive 스코프 토큰 함수를 그대로 쓴다.

| 단계 | 위치 |
| --- | --- |
| Vercel OIDC → GCP WIF → 서비스 계정 impersonation | `lib/google-workspace-auth.ts:80-131` (`getExternalAccountClient`), `:133-142` (`getImpersonatedAccessToken`) |
| Domain-wide Delegation JWT 서명 | `lib/google-workspace-auth.ts:144` (`signDelegatedAdminJwt`) |
| Drive 스코프 토큰 발급(캐시 포함) | `lib/google-workspace-auth.ts:225-247` (`getDriveApiAccessToken`), 스코프는 `:40` `DRIVE_SCOPE` |
| Preview 전용 분기 | `lib/drive-preview-verify-auth.ts:56` (`getR3PreviewDriveAccessToken`) |
| Preview 차단 가드 | `lib/google-workspace-auth.ts:73-77` (`assertNotPreview`) |
| Drive REST 래퍼 | `lib/drive-artifacts.ts:13-23` (`driveFetch`, 현재 미export) |

**Preview 분기 주의**: `lib/drive-artifacts.ts:160-163`의
`VERCEL_ENV === "preview" ? getR3PreviewDriveAccessToken() : getDriveApiAccessToken()`
패턴은 **R3 검증 전용 임시 조치**이며 회수 예정이다
(`lib/drive-preview-verify-auth.ts:4-20` 주석). 그 서비스 계정은
`ALTON Integration Sandbox`에만 초대돼 있어 새 회사 문서 Drive에는 접근할 수
없다. 따라서 회사 문서 기능은 Preview에서 **동작하지 않는 것이 정상**이다 —
Preview에서는 "이 환경에서는 회사 문서를 열람할 수 없습니다" 빈 상태를
명시적으로 렌더한다. Preview에서도 UAT하려면 그 서비스 계정을 새 Drive에도
초대해야 하는데, 이는 별도 승인 항목이다(§9-3).

또한 `DRIVE_SCOPE`는 전체 `drive` 스코프다(`lib/google-workspace-auth.ts:40`).
읽기 전용 목적에는 `drive.readonly`가 맞지만, DWD 스코프 목록 변경은 Google
Workspace 관리 콘솔 작업이라 이번 범위 밖이다 — 1차는 기존 `DRIVE_SCOPE`를
재사용하고, 코드에서 쓰기 API를 호출하지 않는 것으로 제한한다(§9-2).

### 5.4 서버 액션 개요

파일: `app/admin/company-documents-actions.ts` (신규)

**목록**

```
listCompanyDocumentsAction(input?: { folderPath?: string })
  → { folders: { id, name }[],
      files: { id, name, mimeType, size, modifiedTime, iconLink }[] }
```

- 게이트: `requireAdminOrCapability("manage_company_documents")`
- 토큰: §5.3 경로
- 호출: `GET /drive/v3/files?q='<folderId>' in parents and trashed=false`
  `&corpora=drive&driveId=<COMPANY_DRIVE_ID>`
  `&includeItemsFromAllDrives=true&supportsAllDrives=true`
  `&fields=files(id,name,mimeType,size,modifiedTime),nextPageToken`
  — 쿼리 구성은 `lib/drive-artifacts.ts:31-39`의 기존 패턴과 동일
- `folderPath`가 없으면 루트 폴더 id(환경변수)를 쓴다
- **DB 쓰기 없음.** 결과를 어디에도 캐시하지 않는다(정책 4).
  화면 단 TTL 캐시(`useTabCachedData`, TTL 60초 권고)만 쓴다 — 이건
  브라우저 메모리라 "로컬 캐싱 테이블"에 해당하지 않는다.

**다운로드**

`app/api/admin/company-documents/[fileId]/route.ts` (Route Handler,
§3.5와 같은 이유로 서버 액션이 아님)

- 게이트: `requireAdminOrCapability("manage_company_documents")`
- **경로 검증 필수**: 임의의 `fileId`를 그대로 받아 프록시하면 서비스 계정이
  볼 수 있는 모든 파일이 노출된다. 요청된 파일이 실제로 회사 문서 Drive에
  속하는지 `files.get?fields=driveId,name,mimeType`으로 먼저 확인하고
  `driveId === COMPANY_DRIVE_ID`일 때만 진행한다.
- `GET /drive/v3/files/{fileId}?alt=media&supportsAllDrives=true` 응답을
  `Content-Disposition: attachment`로 스트리밍
- Google Docs 네이티브 파일(`application/vnd.google-apps.*`)은 `alt=media`가
  실패한다 — `files/{id}/export?mimeType=application/pdf`로 분기한다.

### 5.5 신규 환경변수 목록 (이번에 추가하지 않음 — 문서화만)

| 이름 | 용도 |
| --- | --- |
| `COMPANY_DOCUMENTS_DRIVE_ID` | 전용 Shared Drive의 id. `drives.list` 이름 조회를 대체해 대소문자·개명 사고를 막는다. 목록·다운로드 양쪽에서 소속 검증에 쓴다. |
| `COMPANY_DOCUMENTS_ROOT_FOLDER_ID` | 루트로 보여줄 폴더 id. 권고안 (A)에서 Drive 루트를 그대로 쓰면 `COMPANY_DOCUMENTS_DRIVE_ID`와 같은 값이 된다. 옵션 (B)를 택하면 이 값이 필수가 된다. |
| `COMPANY_DOCUMENTS_ENABLED` | 기본 `false`. `true`가 아니면 서버 액션이 Drive를 호출하지 않고 빈 상태를 돌려준다. `DRIVE_ARTIFACTS_ALLOW_REAL_WRITES`(`lib/drive-artifacts.ts:152`), `WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`와 같은 안전 플래그 관례. |

기존 변수 재사용(추가 불필요): `GOOGLE_WORKLOAD_IDENTITY_AUDIENCE`,
`GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL`,
`GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL`
(`lib/google-workspace-auth.ts:84-85`, `:149`).

### 5.6 UI 기준

- 폴더 → 파일 2단 브레드크럼 목록. 행: 아이콘, 이름, 크기, 수정일, 다운로드.
- **빈 상태 3종을 구분**한다: (1) 권한 없음, (2) `COMPANY_DOCUMENTS_ENABLED`가
  꺼져 있음 / Preview 환경, (3) 폴더가 비어 있음. 셋을 같은 문구로 뭉개면
  운영자가 설정 문제인지 자료가 없는 건지 알 수 없다.
- 오류 상태: Drive 호출 실패 시 원문 대신 "회사 문서 Drive에 연결하지
  못했습니다"와 재시도 버튼. Drive API 오류 원문은 파일 경로가 섞여 나올 수
  있으므로 화면에 그대로 노출하지 않는다(`driveFetch`는 응답 본문 300자를
  그대로 에러 메시지에 담는다 — `lib/drive-artifacts.ts:20`).
- 로딩: 행 스켈레톤. `RegularContractTab.tsx:21-28`의 `ContractRowSkeleton`
  패턴 재사용.

---

## 6. 교사 제출 서류 보관 설계 (`문서 > 교사 서류`)

**성격: 읽기 전용 보관함이다.** 업로드는 교사 포털에서만 하고, 관리자 문서
탭은 교사별로 찾아 열어보는 창구다. 제출 여부로 어떤 업무도 막지 않는다.

### 6.0 이 서류는 "서명 문서"가 아니다 (2026-09-12 제품 오너 확인)

교사가 올리는 것은 **W-9 같은 서식 제출물**이다. 교사가 빈 양식을 받아
작성해서 올리는 파일이며, **전자서명 대상이 아니다.** 같은 `문서` 탭 안에
있지만 계약(§3)과는 성격이 정반대다 — 이 차이를 설계에서 섞지 않는다.

| | `문서 > 계약`(§3) | `문서 > 교사 서류`(§6) |
| --- | --- | --- |
| 무엇 | ALTON이 발송하고 상대가 **서명한** 계약 서명본 | 교사가 작성해 **제출한 서식**(W-9 등) |
| 생성 주체 | ALTON(DocuSign 발송 → 서명본 회수) | 교사 본인(직접 업로드) |
| 저장 | Drive(`drive_artifacts`) | Supabase Storage(`teacher_documents`) |
| 상태 개념 | 발송·서명·완료 상태가 **있다** | 상태가 **없다**(제출됐거나 아직 없거나) |
| 버전 | 서명 버전(`contract_versions`) | 없음 — 새로 올리면 새 행일 뿐 |

**따라서 하지 않는 것(설계 고정)**

- DocuSign·서명 경로에 절대 연결하지 않는다. `문서 > 교사 서류` 모듈은
  계약 발송·서명 관련 액션을 import 하지 않는다(§2.4와 같은 정적 검사 대상).
- "서명 대기", "서명 완료", "발송됨" 같은 계약 어휘를 화면에 쓰지 않는다.
- 서명 버전·재발송·무효화 개념을 만들지 않는다.

**빈 양식(작성 전 서식)은 어디에 두는가 — 확정(2026-09-12)**: 교사가 받아 갈
빈 W-9 양식은 제출물이 아니라 회사가 배포하는 문서다. **새 최상위 폴더를 만들지
않고** `문서 > 회사 문서` 아래 **`교사 제출 양식`**에 둔다(§9-14). 제출물
보관함(§6)에 빈 양식을 섞지 않는다.

### 6.0.1 민감도 — W-9는 납세자번호(TIN/SSN)를 담는다

W-9류 서식은 이름·주소와 함께 **납세자 식별번호**를 포함한다. 계약서와 같은
수준, 또는 그 이상으로 다뤄야 한다. 이 설계가 이미 반영하고 있는 것:

- 비공개 버킷 + 서버 액션 전용 쓰기(§6.1), 앱 게이트 `requireAdmin()`(§6.2).
- 다운로드마다 감사 1행(§6.4, §7.1).
- 감사 `detail`에 문서 **내용**을 복제하지 않는다(§7.1) — 파일명·종류 수준만.

아직 결정되지 않은 것은 **열람 가능한 관리자 범위**와 **보존 기간** 둘뿐이고
§9-15에 모아 둔다. **이 두 가지가 정해지기 전에는 교사 서류 영역의 구현을
시작하지 않는다.** 서식 종류는 강제하지 않는 것으로 확정됐다(§9-13).

### 6.1 이미 존재하는 구조 — 그대로 읽는다(P4-2, 재확인 완료)

마이그레이션 `20261284000000_p4_2_teacher_payout_account_and_documents.sql`.

| 대상 | 실제 정의 | P4-3에서 |
| --- | --- | --- |
| `teacher_documents` | `id / teacher_id / file_name / storage_path / content_type / size_bytes / note / uploaded_at / uploaded_by` | **그대로 조회**. 컬럼 추가·변경 없음 |
| Storage 버킷 `teacher-documents` | 비공개(`public=false`), 경로 규칙 `<teacher_id>/<uuid>-<파일명>` | **그대로 조회·서명 URL 발급** |
| `teacher_documents` RLS | select: `teacher_id = auth.uid() or is_admin() or current_user_has_capability('정산권한')`. **쓰기 정책 없음**(= 클라이언트 직접 쓰기 불가, 서버 액션 전용) | 변경 없음 |
| Storage 정책 `교사 본인 서류 조회` | `bucket_id = 'teacher-documents'` + 경로 첫 세그먼트가 본인 id (또는 관리자·정산권한) | 변경 없음 |
| 업로드 창구 | 교사 포털 `정산` 탭 — `uploadMyDocumentAction()` / `listMyDocumentsAction()` / `getMyDocumentDownloadUrlAction()` (`app/teacher/settlement-actions.ts`) | **P4-3은 이 경로를 건드리지 않는다** |

**게이트를 만들 수 없는 구조**: `teacher_documents`에는 승인·검토·보완 상태
컬럼이 존재하지 않는다(`status`/`review_status`/`approved_at`/`approved_by`/
`reviewed_at` 전부 없음). 이 부재 자체가 회귀 테스트로 고정돼 있다
(`app/teacher/teacher-settlement-rls.integration.test.ts` — "승인·검토·보완 상태
컬럼이 존재하지 않는다"). P4-3도 이 컬럼들을 **추가하지 않는다.**

### 6.2 데이터 원본과 권한 (확정)

- **원본 하나**: `teacher_documents` + `teacher-documents` 버킷. 관리자용 사본
  테이블·목록 캐시·미러 버킷을 만들지 않는다.
- **앱 게이트: `requireAdmin()`.** 계약·동의서와 같은 수준으로 제한한다
  (§9-1의 확정 — 비관리자 운영자에게 열지 않는다). 교사 인사 서류는 계약·
  동의서와 같은 민감도로 다룬다.
- **중요 — RLS가 실제 통제가 아니다**: 관리자 조회는 `createAdminClient()`
  (service_role)로 하므로 RLS를 우회한다. 따라서 `teacher_documents` RLS에
  `정산권한`이 열려 있는 것과 무관하게, **문서 탭의 실제 접근 통제는
  `requireAdmin()` 하나뿐**이다. 이 게이트를 빠뜨리면 RLS가 막아주지 않는다 —
  구현 시 액션 진입점마다 반드시 건다.
  (그 RLS의 `정산권한` 허용은 교사 본인·정산 운영자의 **직접 조회** 경로용으로
  남겨둔다. 이번에 좁히는 migration은 만들지 않는다.)
- **교사 쪽은 무변경**: 교사는 본인 파일만 본다. P4-2의 `getMyDocumentDownloadUrlAction()`이
  이미 `teacher_id !== 본인`이면 거부한다.

### 6.3 화면 구성

2단 구조다.

**(a) 교사 목록** — 파일을 1건 이상 올린 교사만 표시한다.

| 열 | 원본 |
| --- | --- |
| 선생님 이름 | `profiles.name` |
| 파일 수 | `teacher_documents` count |
| 최근 업로드 | `max(uploaded_at)` |

- 정렬: 최근 업로드 내림차순.
- 검색: 이름 부분 일치(관리자 사용자 탭과 같은 방식).
- 빈 상태: "업로드된 교사 서류가 없습니다."
- **표시하지 않는 것**: 제출률, "미제출", "검토 필요", 필수 서류 체크리스트,
  승인 배지. 정책 10을 화면에서 지키는 부분이다.

**(b) 교사 선택 후 파일 목록**

| 열 | 원본 |
| --- | --- |
| 파일명 | `file_name` |
| 형식 | `content_type` |
| 크기 | `size_bytes` |
| 메모 | `note` |
| 업로드 시각 | `uploaded_at` |
| 내려받기 | §6.4 |

- 빈 상태: "이 선생님이 업로드한 서류가 없습니다."
- 정렬: 업로드 시각 내림차순.
- **쿼리 수**: 목록 2회(`teacher_documents` 집계 1 + `profiles` 이름 1),
  상세 1회. 교사 수·파일 수에 비례한 N+1을 만들지 않는다.

### 6.4 다운로드 흐름 — 계약과 다르게 간다

계약 서명본(§3.5)은 Drive라서 **서버 스트리밍**이 필요했다. 교사 서류는
Supabase Storage라 **진짜 단기 서명 URL**을 쓸 수 있다(서비스 계정 토큰이
URL에 실리지 않는다). 그래서 방식이 다르다 — 같게 맞추려고 스트리밍을
끼워 넣지 않는다.

```
클릭 → adminGetTeacherDocumentUrlAction(documentId)
  1. requireAdmin()                                   // 유일한 실제 접근 통제
  2. teacher_documents 행 조회(service_role)
  3. document_access_events INSERT (§7)               // 감사 — 발급 전에 남긴다
  4. storage.from('teacher-documents').createSignedUrl(storage_path, 60)
  5. URL 반환 → 브라우저가 새 탭에서 연다
```

- **TTL 60초 고정**. P4-2의 교사 본인 다운로드와 같은 값이다.
- **한계를 문서에 남긴다**: 서명 URL 방식의 감사 기록은 "발급 시각"이지
  "실제 내려받은 시각"이 아니다. 발급 즉시 감사 행을 남기고 TTL을 짧게
  유지하는 것으로 갈음한다. 실제 페치까지 감사해야 한다는 요구가 생기면
  계약과 동일한 서버 스트리밍으로 바꾼다(그때는 별도 승인 항목).
- 관리자 화면에 **삭제·대체 버튼을 두지 않는다**(정책 9).
- 납세자번호가 담긴 서식이므로(§6.0.1) TTL을 늘리거나 URL을 공유 가능한
  형태로 바꾸지 않는다.

### 6.5 "게이트가 아니다"를 구조로 지키는 방법

정책 문장만으로는 나중에 깨진다. 세 가지로 고정한다.

1. **스키마**: 상태 컬럼 부재(§6.1) — 이미 테스트로 고정됨.
2. **의존 방향 정적 검사(신규)**: 정산·매칭·수업 모듈이
   `teacher_documents`/`teacher-documents`를 참조하지 않는지 확인하는 테스트를
   추가한다. 대상 경로: `app/teacher/settlement-data.ts`,
   `app/admin/payout-batches-*`, `app/admin/payouts-*`,
   `lib/enrollment/*`, `lib/booking/*`. §2.4의 "계약 화면 중복 금지" 정적
   검사와 같은 패턴이다.
3. **문구**: 화면에 상태 배지·필수 목록을 만들지 않는다(§6.3).

### 6.6 교사 서류에 필요한 migration

**없다.** 테이블·버킷·RLS·Storage 정책이 P4-2에 전부 있다. P4-3이 새로
필요로 하는 DB 객체는 다운로드 감사 테이블 하나뿐이고, 그건 계약 서명본과
공용이다(§7).

---

## 7. Migration 필요 여부

| 서브 영역 | 필요 여부 | 근거 |
| --- | --- | --- |
| 계약 아카이브 | **감사 테이블만 필요** | 계약 본문·버전·서명본 조회는 기존 데이터를 재사용한다. 다운로드를 1차부터 DB 감사로 남기므로(§9-4) 접근 감사 테이블이 필요하다. |
| 동의서 이관 | **불필요** | 화면 위치 이동과 데이터 로딩 경로 변경뿐. `loadConsentGaps`(`app/admin/consultation-data.ts:192`)의 쿼리 자체를 바꾸지 않는다. capability `manage_guardian_consent`와 그 RLS는 이미 존재한다(`supabase/migrations/20260909000000_r2_task8_capability_gates.sql:515`). |
| 회사 문서 | **불필요** | 1차 진실 소스가 Drive이고 로컬 캐시 테이블을 만들지 않는다(정책 4). `manage_company_documents`는 `supervisor_capabilities`에 관리자가 직접 부여하는 자유 텍스트라 enum/DDL 변경이 없다(`20260912000000_...:376-377` 주석의 기존 관례). `company_documents` 테이블은 손대지 않는다(정책 3). |
| 교사 서류 | **불필요** | 테이블(`teacher_documents`)·비공개 버킷(`teacher-documents`)·RLS·Storage 정책이 P4-2(`20261284000000`)에 전부 있다. P4-3은 읽기만 한다(§6.1). 상태 컬럼은 **추가하지 않는다**(정책 10). |

> **결론: P4-3에 필요한 additive migration은 문서 접근 감사 테이블 1건뿐이다.**
> 계약 서명본과 교사 제출 서류가 **같은 테이블**을 쓴다 — 접근 감사 대상이
> "개인정보가 포함된 문서 다운로드"로 같고, 두 개로 나누면 조회·보존 정책이
> 갈라지기 때문이다. contracts RLS 비대칭 보정, `company_documents` 테이블
> 변경, `teacher_documents` 스키마 변경은 이번 범위에 포함하지 않는다.

### 7.1 감사 테이블 설계 — `document_access_events`

```
document_access_events
  id            uuid pk default gen_random_uuid()
  actor_id      uuid not null references profiles(id)   -- 내려받은 관리자
  target_kind   text not null check (in ('contract_artifact','teacher_document'))
  target_id     uuid not null                            -- drive_artifacts.id 또는 teacher_documents.id
  subject_id    uuid references profiles(id)             -- 문서의 귀속 대상(학생 또는 교사), 조회 편의용
  action        text not null check (in ('download','download_url_issued'))
  detail        jsonb not null default '{}'::jsonb       -- 파일명·버전 등 비민감 식별 정보만
  created_at    timestamptz not null default now()
index on (target_kind, target_id, created_at desc)
index on (actor_id, created_at desc)
```

- **INSERT-only**: `household_archive_events`/`teacher_payout_account_events`와
  같은 패턴으로 update/delete 차단 트리거를 건다.
- **RLS**: 조회는 `is_admin()`만. 쓰기 정책 없음(서버 액션 service_role 전용).
- **`action` 두 값의 구분**: 계약은 서버가 바이트를 흘려보내므로 실제
  `download`을 기록한다. 교사 서류는 서명 URL 발급이라
  `download_url_issued`를 기록한다(§6.4의 한계와 짝을 이룬다) — 같은 테이블에
  섞되 무엇을 보장하는 기록인지 값으로 구분한다.
- **detail에 개인정보를 넣지 않는다**: 파일명·문서 종류·버전 정도만 담고,
  계좌번호·주민번호류 본문 내용은 절대 복제하지 않는다
  (`teacher_payout_account_events`가 전체 계좌번호를 복제하지 않는 것과 같은 원칙).
- **보존 기간**: 이번 설계에서 자동 삭제를 만들지 않는다. 개인정보 보존·삭제
  일괄 정책은 P6 범위이며, 그때 이 테이블도 함께 다룬다.

---

## 8. 단계별 구현 순서 제안

| 순서 | 작업 | 이유 |
| --- | --- | --- |
| 1 | 문서 탭 껍데기 + 3개 서브탭 라우팅 (`admin-tabs.ts`, `AdminShell.tsx`) | 외부 의존 0. 나머지 두 단계가 붙을 자리를 먼저 만든다. |
| 2 | 동의서 이관 (§4) | 위험도가 가장 낮다 — 컴포넌트가 self-contained이고 신규 쿼리·신규 권한·외부 서비스가 전혀 없다. SSR prop 제거로 `신규` 탭 로딩도 같이 가벼워진다. |
| 3 | 계약 아카이브 (§3) — 목록·상세까지, 다운로드 제외 | 순수 내부 데이터라 마이그레이션도 외부 호출도 없다. 이 단계까지는 Drive 리소스 준비를 기다리지 않아도 된다. |
| 4 | 계약 서명본 다운로드 (§3.5) | `driveFetch` export/추출이 선행돼야 하고, 기존 `ALTON Integration Sandbox`에 이미 올라간 파일을 읽는 것이라 새 Drive 준비와 무관하게 검증 가능하다. |
| 5 | **교사 서류 보관함 (§6)** | **외부 의존이 0이다** — 테이블·버킷이 P4-2에 이미 있고 Drive도 환경변수도 필요 없다. 회사 문서(외부 승인 대기)보다 먼저 끝낼 수 있다. |
| 6 | 회사 문서 Drive 연동 (§5) | 전용 Shared Drive 생성·서비스 계정 초대·환경변수 3개라는 **외부 프로비저닝 승인**에 막혀 있다. 앞 단계를 볼모로 잡지 않도록 맨 뒤에 둔다. |
| 7 | 문서 탭 전체 UI 폴리싱 | CLAUDE.md 규칙: 개별 기능 단위가 아니라 마일스톤 종료 시 역할별 화면을 묶어 폴리싱한다. |

> 감사 테이블(§7.1)은 4단계(계약 다운로드) 착수 시점에 만든다 — 5단계(교사
> 서류)가 같은 테이블을 재사용한다. 4·5단계 순서를 바꾸면 감사 테이블을
> 5단계로 당긴다.

**단계별 고정 검증**

- 2단계: `ConsentGapSection.test.tsx` 신규 + 오류 현황판이 여전히 동의 차단
  섹션을 렌더하는지 + 같은 `cacheKey`로 중복 fetch가 없는지.
- 3단계: 계약 목록 쿼리 수 ≤ 2 (§3.3), `문서 > 계약` 모듈이 발송/무효화
  액션을 import 하지 않는다는 정적 검사(§2.4).
- 4단계: 권한 없는 사용자·다른 Drive 소속 fileId·`sync_status != 'succeeded'`
  세 케이스가 전부 거부되는지 통합 테스트 + 다운로드마다 감사 1행.
- 5단계(교사 서류): ① `requireAdmin()` 없는 호출이 거부되는지, ② 다운로드
  URL 발급마다 감사 1행이 남는지, ③ **정산·매칭·수업 모듈이
  `teacher_documents`를 참조하지 않는다는 정적 검사**(§6.5-2), ④ 교사 본인
  경로(P4-2)가 그대로 동작하고 타 교사 파일은 여전히 막히는지 회귀.
- 6단계: 회사 문서 Drive 권한 케이스.
- 전 단계: 실행 ID 붙은 전용 UAT 계정 사용, 종료 후 실행 ID 단위 정리.

---

## 9. 확정 정책 (2026-09-11 / 2026-09-12)

1. **`contracts` select RLS의 capability 비대칭** — `contract_versions`와
   `drive_artifacts`의 조회 정책에는 `manage_consultations`가 있는데
   (`20260913000000_...:172-181`, `20260912000000_...:363-372`),
   `contracts` 본체 정책에는 없다(`20260830080000_r1_rls_policies.sql:77-82`).
   `role='admin'`이 아닌 운영자에게 문서 탭을 열어줄 계획이 있는가?
   계약·동의서는 당분간 `requireAdmin()`으로 제한한다. 비관리자 운영자에게
   열지 않으므로 contracts RLS 보정 migration은 만들지 않는다. 회사 문서만
   `manage_company_documents` capability를 사용한다.

2. **Drive 스코프 축소 여부** — 회사 문서는 읽기 전용이므로
   `drive.readonly`가 최소권한에 맞지만, 현재 DWD 등록 스코프는 전체 `drive`
   하나다(`lib/google-workspace-auth.ts:40`). Google Workspace 관리 콘솔에서
   기존 DWD `drive` 스코프를 유지하고 Workspace 관리 콘솔 변경은 하지 않는다.
   앱 코드에서 목록·다운로드만 허용한다.

3. **Preview 환경에서 회사 문서 UAT를 할 것인가** — 현재 Preview용 Drive
   서비스 계정(`r3-drive-preview-verify@...`,
   `lib/drive-preview-verify-auth.ts:24`)은 `ALTON Integration Sandbox`에만
   초대돼 있다. Preview에서 회사 문서를 실제로 확인하려면 이 계정을 새
   Drive에도 초대해야 한다. Preview UAT는 실제 법인 서류가 아닌 전용 Shared
   Drive 안의 더미 문서 UAT 폴더만 대상으로 하며, 검증 계정에 실제 법인 서류
   접근 권한을 주지 않는다.

4. **계약서 다운로드 감사 기록의 보존 형태** — §3.5는 구조화 로그만
   남기는 안이다. 개인정보 접근 이력 요구에 따라 1차부터 DB 감사 기록을
   남긴다. 최소 감사 테이블을 위한 additive migration을 설계에 포함한다.

5. **회사 문서 폴더 구조의 확정본** — §5.2는 `법인 서류/`, `계약서 양식/`
   2개 최상위 폴더를 사용하고 한 단계 하위 폴더까지만 UI에 노출한다.

6. **계약 목록의 기본 정렬·기간 기본값** — §3.3은 "기간 무제한, 생성일
   진행 중 계약은 기간과 무관하게 모두 표시한다. 완료·취소 계약은 최근
   90일을 기본으로 하며, 상태·기간 필터와 페이지네이션으로 과거 자료를 연다.

7. **회사 문서 업로드 시점** — 1차는 읽기 전용이고 파일 추가는 Drive에서
   직접 하는 읽기 전용 방식으로 확정한다. 관리자 업로드와 Content Manager
   권한은 2차에서 별도 결정하며 이번 Drive 준비에 포함하지 않는다.

### 2026-09-12 추가 확정 (P4-2 구현 대조 후)

8. **교사 서류 저장소** — P4-2가 만든 `teacher_documents` + 비공개 버킷
   `teacher-documents`를 **그대로 읽는다**. 사본·캐시·미러를 만들지 않고,
   이 영역 때문에 추가되는 migration은 없다.
9. **교사 서류 접근 권한** — 앱 게이트는 `requireAdmin()`이다(계약·동의서와
   동일 수준). 관리자 조회는 service_role로 RLS를 우회하므로 **이 게이트가
   유일한 실제 통제**다. `teacher_documents` RLS의 `정산권한` 허용은 교사 본인·
   정산 운영자의 직접 조회용으로 남기고, 좁히는 migration은 만들지 않는다.
10. **관리자 문서 탭은 교사 서류에 대해 읽기 전용** — 업로드·삭제·대체 버튼을
    두지 않는다. 업로드 창구는 교사 포털 `정산` 탭 하나뿐이다.
11. **게이트 금지를 구조로 고정** — 상태 컬럼을 추가하지 않고(스키마), 정산·
    매칭·수업 모듈이 `teacher_documents`를 참조하지 않는다는 정적 검사를 두고,
    화면에 상태 배지·필수 목록을 만들지 않는다(§6.5).
12. **교사 서류는 서명 문서가 아니다** — W-9 같은 서식 제출물이다. 계약·
    DocuSign·서명 상태·서명 버전 개념과 연결하지 않는다(§6.0). 빈 양식은
    제출물 보관함이 아니라 `문서 > 회사 문서`(Drive)에 둔다.
13. **서식 종류를 강제하지 않는다(확정)** — `W-9`/`W-8BEN` 같은 고정 목록을
    만들지 않고 **자유 업로드·보관 창구**를 유지한다. `teacher_documents`에
    종류 컬럼을 추가하지 않는다(= 이 영역의 추가 migration 여전히 0건).
    미제출·검토·승인 상태가 정산·매칭·수업을 차단하지 않는다는 원칙도 그대로다.
14. **빈 서식의 위치(확정)** — **새 최상위 폴더를 만들지 않는다.**
    `문서 > 회사 문서` 아래 **`교사 제출 양식`**에 둔다(§5.2의 Drive 구조에
    최상위 폴더를 추가하지 않고 회사 문서 하위로 들어간다). 제출물 보관함(§6)과
    빈 양식은 계속 분리한다.
15. **구현 착수 전 별도 제품 결정으로 남기는 2건** — 납세 서류가 납세자번호를
    담는 데서 생긴 항목이다(§6.0.1). **결정 전에는 P4-3 교사 서류 구현을
    시작하지 않는다.**
    ① **열람 가능한 관리자 범위**: 현재 설계는 `requireAdmin()`(관리자 전원)이다.
    납세 서식만 더 좁은 범위(예: 대표·정산 담당)로 제한할지.
    ② **보존 기간**: 지금은 자동 삭제를 만들지 않고 P6 개인정보 보존·삭제
    정책으로 넘긴다. 세무 서류에 별도 보존 연한이 필요한지.
16. **다운로드 감사 테이블은 계약과 공용** — `document_access_events` 1개를
    만들어 계약 서명본(`download`)과 교사 서류(`download_url_issued`)를 함께
    기록한다(§7.1). 교사 서류는 서명 URL 방식이라 "발급 시각" 기록임을
    문서에 명시했고, 실제 페치까지 감사해야 한다면 서버 스트리밍으로 바꾸는
    별도 승인 항목이다.

---

## 10. 구현 시 필요한 외부 변경 (이번 라운드에서는 하지 않음)

이 설계를 구현할 때 **ALTON 코드·DB 밖에서** 사람이 해야 하는 일만 모았다.
아래 3·4번은 회사 문서(§5)에만 해당하며, 계약·동의서·교사 서류는 외부 변경
없이 구현할 수 있다.

| # | 항목 | 대상 | 필요 시점 |
| --- | --- | --- | --- |
| 1 | additive migration 1건(`document_access_events`) 작성·로컬 적용·공유 non-prod push | Supabase non-prod(`worpsqwqgnspddnrtnvq`) | 계약 다운로드(4단계) 착수 시 |
| 2 | Preview 배포 | Vercel | 각 단계 UAT 시 |
| 3 | **전용 Shared Drive(또는 전용 최상위 폴더) 생성 + 폴더 구조(`법인 서류/`, `계약서 양식/`) 준비 + 서비스 계정 초대** | Google Workspace | 회사 문서(6단계) 착수 전 |
| 4 | **환경변수 3개 추가**(§5.5의 이름·용도 그대로) | Vercel Preview/Production | 회사 문서(6단계) 착수 전 |
| 5 | Preview 검증 계정을 **더미 문서 UAT 폴더에만** 초대(실제 법인 서류 접근 금지, §9-3) | Google Workspace | 회사 문서 UAT 시 |

**하지 않는 것**: Workspace 관리 콘솔의 DWD 스코프 변경(§9-2 — 기존 `drive`
스코프를 그대로 두고 코드에서 읽기·다운로드만 호출), `teacher_documents`·
`teacher-documents` 버킷 변경, Production DB 변경, 실제 법인 서류 접근 권한 부여.
