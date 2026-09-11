# P4-3 관리자 문서 탭 설계 — 회사 문서 / 계약 / 동의서

상태: **설계안(2026-09-10). 구현 착수 전 제품 오너 승인 필요.**
범위 근거: `docs/2026-09-10-p-execution-roadmap.md:982-994`(P4-3 관리자 문서 운영).

이 문서는 계획만 만든다. 코드·마이그레이션·환경변수·Google Drive 권한은
이 설계 승인 전에 아무것도 바꾸지 않는다.

---

## 1. 개요

### 1.1 목표

관리자에 독립된 **문서** 탭을 신설하고 세 개의 서브 영역으로 구성한다.

| 서브탭 | 성격 | 데이터 원본 |
| --- | --- | --- |
| 회사 문서 | 법인 기초 서류·계약서 양식 열람/다운로드 | Google Drive(폴더 구조·파일 메타데이터 자체가 1차 진실 소스) |
| 계약 | **읽기 전용 아카이브** — 계약·서명 상태 조회, 서명본 다운로드 | `contracts` / `contract_versions` / `drive_artifacts` |
| 동의서 | 보호자 동의 대기·완료 현황(기존 `신규 > 보호자 동의 대기` 이관) | `profiles` / `guardian_consents` |

### 1.2 확정 정책(재논의하지 않음)

1. 문서 탭은 회사 문서 / 계약 / 동의서 3분할.
2. 회사 문서는 기존 계약 capability와 **분리된 신규 capability**를 쓴다.
3. `company_documents` 테이블은 **되살리지도 삭제하지도 않는다** — 이 기능에서 참조하지 않는다.
4. 회사 문서의 1차 진실 소스는 Drive 폴더 구조와 파일 메타데이터다. 파일 목록용 로컬 캐시 테이블을 만들지 않는다.
5. 검증용 Shared Drive(`ALTON Integration Sandbox`)는 재사용하지 않는다. 전용 Drive 또는 전용 최상위 폴더를 새로 만든다(§5.2 권고안).
6. `문서 > 계약`은 조회·다운로드만 한다. 발송/재발송/무효화 버튼을 두지 않는다.
7. 계약 쓰기 동작의 진입점은 `신규 > 정규 계약 발송` **한 곳뿐**이다.
8. 보호자 동의 대기는 `문서 > 동의서`로 이관한다.

### 1.3 이번 범위 밖

- 실제 Drive/폴더 생성, Shared Drive 멤버십·권한 부여
- 실제 환경변수 추가(이 문서에 이름과 용도만 기록)
- 마이그레이션 작성(§6 결론: 초기 범위에서는 불필요)
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
- 서브탭 순서: `회사 문서` → `계약` → `동의서`. 기본 서브탭은 **`계약`**을
  권고한다 — 회사 문서는 별도 capability가 없으면 빈 화면이 되고, 계약이
  가장 자주 쓰이는 조회 대상이다.

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
않는다**. 이 규칙은 테스트로 고정한다(§7 참고).

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

> **주의(열린 항목 §8-1)**: `contracts` 자체의 select 정책에는
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

**로깅**: 다운로드는 개인정보 접근이므로, 누가 어느 `drive_artifact_id`를
언제 받았는지 구조화 로그(`console.error`/로그 싱크의 기존 JSON 패턴,
`lib/drive-artifacts.ts:101-108` 참고)로 남긴다. 감사 테이블은 만들지 않는다
(§6 — migration 없음 원칙 유지). 감사 테이블이 필요하다는 판단이 서면 별도
승인 항목이다(§8-4).

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
초대해야 하는데, 이는 별도 승인 항목이다(§8-3).

또한 `DRIVE_SCOPE`는 전체 `drive` 스코프다(`lib/google-workspace-auth.ts:40`).
읽기 전용 목적에는 `drive.readonly`가 맞지만, DWD 스코프 목록 변경은 Google
Workspace 관리 콘솔 작업이라 이번 범위 밖이다 — 1차는 기존 `DRIVE_SCOPE`를
재사용하고, 코드에서 쓰기 API를 호출하지 않는 것으로 제한한다(§8-2).

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

## 6. Migration 필요 여부

| 서브 영역 | 필요 여부 | 근거 |
| --- | --- | --- |
| 계약 아카이브 | **불필요** | `contracts`/`contract_versions`/`drive_artifacts`/`contract_company_approvals`/`contract_activation_retries`가 모두 존재하고, 조회 RLS도 이미 `is_admin() or manage_consultations`로 열려 있다(§3.2). 읽기 전용이라 새 컬럼·상태·제약이 없다. |
| 동의서 이관 | **불필요** | 화면 위치 이동과 데이터 로딩 경로 변경뿐. `loadConsentGaps`(`app/admin/consultation-data.ts:192`)의 쿼리 자체를 바꾸지 않는다. capability `manage_guardian_consent`와 그 RLS는 이미 존재한다(`supabase/migrations/20260909000000_r2_task8_capability_gates.sql:515`). |
| 회사 문서 | **불필요** | 1차 진실 소스가 Drive이고 로컬 캐시 테이블을 만들지 않는다(정책 4). `manage_company_documents`는 `supervisor_capabilities`에 관리자가 직접 부여하는 자유 텍스트라 enum/DDL 변경이 없다(`20260912000000_...:376-377` 주석의 기존 관례). `company_documents` 테이블은 손대지 않는다(정책 3). |

> **결론: P4-3 초기 범위 전체에 마이그레이션이 필요하지 않다.** 세 영역
> 어디에도 DDL 변경이 없다. 만약 구현 중 §8의 열린 항목(특히 §8-1 RLS
> 비대칭, §8-4 다운로드 감사 테이블)이 "필요"로 결론 나면, 그때만 별도
> additive 마이그레이션을 승인받는다.

---

## 7. 단계별 구현 순서 제안

| 순서 | 작업 | 이유 |
| --- | --- | --- |
| 1 | 문서 탭 껍데기 + 3개 서브탭 라우팅 (`admin-tabs.ts`, `AdminShell.tsx`) | 외부 의존 0. 나머지 두 단계가 붙을 자리를 먼저 만든다. |
| 2 | 동의서 이관 (§4) | 위험도가 가장 낮다 — 컴포넌트가 self-contained이고 신규 쿼리·신규 권한·외부 서비스가 전혀 없다. SSR prop 제거로 `신규` 탭 로딩도 같이 가벼워진다. |
| 3 | 계약 아카이브 (§3) — 목록·상세까지, 다운로드 제외 | 순수 내부 데이터라 마이그레이션도 외부 호출도 없다. 이 단계까지는 Drive 리소스 준비를 기다리지 않아도 된다. |
| 4 | 계약 서명본 다운로드 (§3.5) | `driveFetch` export/추출이 선행돼야 하고, 기존 `ALTON Integration Sandbox`에 이미 올라간 파일을 읽는 것이라 새 Drive 준비와 무관하게 검증 가능하다. |
| 5 | 회사 문서 Drive 연동 (§5) | 전용 Shared Drive 생성·서비스 계정 초대·환경변수 3개라는 **외부 프로비저닝 승인**에 막혀 있다. 앞 단계를 볼모로 잡지 않도록 맨 뒤에 둔다. |
| 6 | 문서 탭 전체 UI 폴리싱 | CLAUDE.md 규칙: 개별 기능 단위가 아니라 마일스톤 종료 시 역할별 화면을 묶어 폴리싱한다. |

**단계별 고정 검증**

- 2단계: `ConsentGapSection.test.tsx` 신규 + 오류 현황판이 여전히 동의 차단
  섹션을 렌더하는지 + 같은 `cacheKey`로 중복 fetch가 없는지.
- 3단계: 계약 목록 쿼리 수 ≤ 2 (§3.3), `문서 > 계약` 모듈이 발송/무효화
  액션을 import 하지 않는다는 정적 검사(§2.4).
- 4·5단계: 권한 없는 사용자·다른 Drive 소속 fileId·`sync_status != 'succeeded'`
  세 케이스가 전부 거부되는지 통합 테스트.
- 전 단계: 실행 ID 붙은 전용 UAT 계정 사용, 종료 후 실행 ID 단위 정리.

---

## 8. 구현 착수 전 확인 필요한 나머지 질문

1. **`contracts` select RLS의 capability 비대칭** — `contract_versions`와
   `drive_artifacts`의 조회 정책에는 `manage_consultations`가 있는데
   (`20260913000000_...:172-181`, `20260912000000_...:363-372`),
   `contracts` 본체 정책에는 없다(`20260830080000_r1_rls_policies.sql:77-82`).
   `role='admin'`이 아닌 운영자에게 문서 탭을 열어줄 계획이 있는가?
   있다면 `contracts` 조회 정책에 capability를 추가하는 additive
   마이그레이션이 1건 필요하다(그러면 §6 결론이 바뀐다). 없다면 문서 탭
   전체를 `requireAdmin()`(`lib/admin-auth.ts:3`)으로 좁히는 것도 선택지다.

2. **Drive 스코프 축소 여부** — 회사 문서는 읽기 전용이므로
   `drive.readonly`가 최소권한에 맞지만, 현재 DWD 등록 스코프는 전체 `drive`
   하나다(`lib/google-workspace-auth.ts:40`). Google Workspace 관리 콘솔에서
   `drive.readonly`를 추가 등록할 것인가, 아니면 기존 스코프를 재사용하고
   코드 레벨에서만 읽기로 제한할 것인가?

3. **Preview 환경에서 회사 문서 UAT를 할 것인가** — 현재 Preview용 Drive
   서비스 계정(`r3-drive-preview-verify@...`,
   `lib/drive-preview-verify-auth.ts:24`)은 `ALTON Integration Sandbox`에만
   초대돼 있다. Preview에서 회사 문서를 실제로 확인하려면 이 계정을 새
   Drive에도 초대해야 한다 — 회사 법인 서류가 들어갈 Drive에 "검증 후 회수
   예정"인 임시 계정을 넣는 셈이라 승인이 필요하다. 대안은 Preview에서
   기능을 끄고(빈 상태) Production 배포 후 확인하는 것.

4. **계약서 다운로드 감사 기록의 보존 형태** — §3.5는 구조화 로그만
   남기는 안이다(마이그레이션 없음). 개인정보 접근 이력을 DB로 남겨야 하는
   요구(P6 권한·감사 항목)가 이미 확정돼 있다면, 지금 `document_access_logs`
   같은 테이블을 같이 만드는 편이 나중에 소급하는 것보다 낫다. 판단 필요.

5. **회사 문서 폴더 구조의 확정본** — §5.2는 `법인 서류/`, `계약서 양식/`
   2개를 가정했다. 실제로 어떤 폴더·문서를 노출할지 확정해야 UI의 빈 상태와
   브레드크럼 깊이(1단만 허용할지, 무제한 하위 폴더를 허용할지)를 정할 수 있다.

6. **계약 목록의 기본 정렬·기간 기본값** — §3.3은 "기간 무제한, 생성일
   내림차순"을 가정했다. 계약 건수가 늘면 기본을 최근 90일로 좁히는 편이
   나을 수 있다. 운영 관점의 선택.

7. **회사 문서 업로드 시점** — 1차는 읽기 전용이고 파일 추가는 Drive에서
   직접 한다. 이 운영 방식으로 확정인지, 아니면 2차에서 관리자 화면 업로드를
   전제로 서비스 계정을 처음부터 Content Manager로 초대해 둘지.
