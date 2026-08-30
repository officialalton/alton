# Gate C — Sandbox 인프라 프로비저닝 로그

- 목적: Gate C GW-01~14 검증을 위해 실제로 생성한 Google Cloud/Workspace 리소스와 ID를 기록한다. `2026-08-29-gate-c-google-workspace-validation.md`(설계 승인본)의 §1 체크리스트를 실제로 어떻게 채웠는지의 실행 기록이며, 이 문서 자체는 정책 문서가 아니다.
- 갱신 방식: 리소스를 만들거나 상태가 바뀔 때마다 이 문서에 추가한다(삭제된 리소스도 취소선으로 남기고 삭제 사유 기록).

## 1. Google Cloud 프로젝트

| 항목 | 값 |
|---|---|
| 프로젝트 ID | `alton-integration-sandbox` |
| 생성일 | 2026-08-29 |
| 생성 계정 | `official@alton.education` |
| 조직 | `alton.education` (Organization ID `768857337621`, Cloud Identity Customer ID `C0425ji70`) |

## 2. 활성화된 API

`drive.googleapis.com`, `calendar-json.googleapis.com`, `docs.googleapis.com`, `meet.googleapis.com`, `workspaceevents.googleapis.com`, `pubsub.googleapis.com`, `iam.googleapis.com`, `iamcredentials.googleapis.com`, `orgpolicy.googleapis.com`

## 3. 서비스 계정

| 이메일 | Unique ID(client_id, DWD 등록용) | 용도 |
|---|---|---|
| `gate-c-automation@alton-integration-sandbox.iam.gserviceaccount.com` | `112226937341201546024` | Gate C 전 구간 자동화(GW-01~14). Sandbox 단계라 Gate C §1.3 권고대로 단일 계정 사용, provisioner/ingestor/reader 3분리는 하지 않음 |

**키 발급 불가(개정 사항 아님, 조직 정책 확인됨)**: 조직 정책 `constraints/iam.managed.disableServiceAccountKeyCreation`이 JSON 키 발급을 차단한다(보안 모범 사례이므로 우회하지 않음). 대신 **키 없는 방식**으로 진행한다 — `official@alton.education`에게 이 서비스 계정에 대한 `roles/iam.serviceAccountTokenCreator`를 부여했고(완료), IAM Credentials API의 `signJwt`로 DWD `sub` claim이 포함된 JWT를 서명한 뒤 OAuth 토큰 엔드포인트에 교환하는 방식으로 Workspace 사용자를 가장(impersonate)한다.

## 4. Pub/Sub

| 리소스 | 이름 | 상태 |
|---|---|---|
| 토픽 | `projects/alton-integration-sandbox/topics/gate-c-meet-events` | 생성 완료 |
| 구독(Pub/Sub) | `projects/alton-integration-sandbox/subscriptions/gate-c-meet-events-sub` | 생성 완료(pull, ack-deadline 60초), Subscriber 역할을 `gate-c-automation@...`에 부여 완료 |
| 구독(Workspace Events API) | `subscriptions/meet-spaces-78e7720c-979c-48f6-9cda-1d3641ecba24` | 생성 완료(2026-08-30). 대상: GW-03 테스트 Meet space `spaces/UGuIoiRBp7cB`(`meet.google.com/wqv-acba-jxj`), 이벤트: `google.workspace.meet.smartNote.v2.fileGenerated`, resource data 제외(`payloadOptions.includeResource=false`) → 만료 `2026-09-06T06:34:51Z`(7일). **실제 동작 검증 완료(2026-08-30)**: 2인 실제 Meet 회의 후 Pub/Sub 구독에서 해당 이벤트를 실제로 수신함(`ce-subject`가 대상 space와 일치) — 상세는 `2026-08-29-gate-c-google-workspace-validation.md` GW-07 참고 |

**해결 완료(2026-08-29)**: `meet-api-event-push@system.gserviceaccount.com`에 토픽 Publisher 부여 완료. 경위: 조직 정책 `constraints/iam.allowedPolicyMemberDomains`(도메인 제한 공유, 허용값: Customer ID `C0425ji70`만)가 개별 외부 서비스 계정 예외를 지원하지 않아 최초 시도가 거부됨 → `official@alton.education`에게 조직 레벨 `roles/orgpolicy.policyAdmin` 부여(Console 자가발급, 대상 리소스 `alton.education` 조직 전체 — 범위가 넓다는 점을 인지하고 진행) → Google 공식 문서가 안내하는 절차대로 (1) `alton-integration-sandbox` 프로젝트에 한해 정책을 `allowAll: true`로 임시 완화 (2) `meet-api-event-push@system.gserviceaccount.com`에 `roles/pubsub.publisher` 부여 (3) 프로젝트 정책을 즉시 삭제해 조직 정책(Customer ID `C0425ji70`만 허용) 상속 상태로 원복. 원복 후에도 이미 부여된 IAM 바인딩은 유지됨을 확인(조직 정책은 부여 시점에만 강제되고 기존 바인딩을 소급 회수하지 않음). 조직 전체 정책은 처음 상태 그대로이며 이번 예외는 이 서비스 계정 하나, 이 토픽 하나에만 적용된 IAM 바인딩이다.

## 5. Domain-wide Delegation

| 항목 | 값 |
|---|---|
| 등록할 Client ID | `112226937341201546024` (= `gate-c-automation@alton-integration-sandbox.iam.gserviceaccount.com`의 unique ID) |
| 등록 위치 | Admin Console → 보안 → API 제어 → 도메인 전체 위임 → 새로 추가 |
| 등록할 scope(쉼표 구분, 공백 없이) | `https://www.googleapis.com/auth/meetings.space.readonly,https://www.googleapis.com/auth/meetings.space.settings,https://www.googleapis.com/auth/drive.meet.readonly,https://www.googleapis.com/auth/documents.readonly,https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/calendar.events.readonly,https://www.googleapis.com/auth/calendar.events` |

상태: **등록 완료·동작 검증 완료(2026-08-29)**. `test-dwd.mjs`로 `official@alton.education`을 가장(impersonate)해 access token 발급 성공 → `drive/v3/about`으로 impersonate된 사용자가 `official@alton.education`임을 확인 → `drive/v3/drives` 조회로 `ALTON Integration Sandbox` Shared Drive(`driveId: 0AOV2sP-lyILlUk9PVA`)에 정상 접근 가능함을 확인. 키 없는 domain-wide delegation 메커니즘이 end-to-end로 동작함이 검증됐다. 검증 스크립트는 스크래치패드(`gate-c-keys/impersonate.mjs`, `gate-c-keys/test-dwd.mjs`, 세션 종료 시 사라짐 — 재사용하려면 다시 작성 필요)에 있다.

## 6. Shared Drive / 계정 (사용자가 이미 완료, 2026-08-29)

- `ALTON Integration Sandbox` Shared Drive 생성 완료, `00_System`/`10_Students`/`20_Teacher_Portals` 폴더 생성 완료
- Manager: `official@alton.education`, `jiman@alton.education`
- Content manager: `chrisy@alton.education`
- 별도 자동화 계정 없이 `official@alton.education`을 임시 자동화·주최 계정으로 사용(Gate C §1.3 권고 — 3계정 분리는 필수조건 아님)
- **테스트 선생님 계정(2026-08-29 생성, GW-05/06/13용)**: `teacher1@alton.education`, `teacher2@alton.education` — 의도적으로 **Shared Drive 멤버로 추가하지 않음**(폴더 단위 권한만으로 접근 범위가 실제로 제한되는지 검증하기 위함). 비밀번호는 이 문서·대화에 기록하지 않음(사용자가 직접 관리)

## 7. 조직 정책 예외 처리 이력(완료, 2026-08-29) + 사후 보안 정리(완료, 2026-08-30)

`official@alton.education`에게 조직 레벨 `roles/orgpolicy.policyAdmin`을 부여(Console 자가발급 — Cloud 콘솔이 "Fix access" 버튼으로 자가발급 가능함을 확인해 제시, 대상 리소스는 `alton.education` 조직 전체이므로 범위가 넓다는 점을 사용자에게 사전 고지 후 진행). 이후 §4에 기록한 절차(임시 완화 → 권한 부여 → 즉시 원복)로 Pub/Sub Publisher 예외를 처리했다.

**사후 보안 정리(2026-08-30, Gate D 착수 전 필수 정리)**:

1. `gcloud organizations remove-iam-policy-binding 768857337621 --member=user:official@alton.education --role=roles/orgpolicy.policyAdmin` 실행 완료
2. `gcloud organizations get-iam-policy 768857337621`로 재조회 — `roles/orgpolicy.policyAdmin` 바인딩이 완전히 제거되고 `domain:alton.education`의 `billing.creator`/`resourcemanager.projectCreator`만 남음을 확인
3. `gcloud org-policies describe iam.allowedPolicyMemberDomains --project=alton-integration-sandbox --effective`로 재조회 — 여전히 `allowedValues: [C0425ji70]`로 조직 정책이 그대로 상속·적용됨을 확인. 프로젝트 레벨 오버라이드는 `POLICY_NOT_FOUND`로 존재하지 않음을 확인(임시 완화분이 남아있지 않음)
4. `gcloud pubsub topics get-iam-policy gate-c-meet-events`로 재조회 — `meet-api-event-push@system.gserviceaccount.com`의 `roles/pubsub.publisher` 바인딩은 그대로 유지됨을 확인(의도적으로 유지)

최종 상태: 조직 레벨에는 이번 작업을 위해 임시로 부여했던 권한이 전혀 남아있지 않고, 조직 전체 도메인 제한 정책은 최초 상태 그대로이며, Pub/Sub 예외는 이 서비스 계정 하나·이 토픽 하나에 한정된 좁은 바인딩만 남아 GW-07 재검증(재구독 등)에 계속 사용 가능하다.

## 8. 남은 항목

1. ~~(Workspace 슈퍼관리자) `alton.education` Workspace 에디션 확인~~ — **완료**: Business Plus 확인됨(2026-08-29 Admin Console 실측, `2026-08-29-gate-c-google-workspace-validation.md` §1.1)
2. ~~(Workspace 슈퍼관리자) Gemini settings 설정~~ — **완료**: AI note-taking ON, 기본 공유 `Hosts and co-hosts only`, Ask Gemini OFF 등 확인됨(2026-08-29, 같은 문서 §1.1)
3. ~~(Workspace 슈퍼관리자) 화면 스크린샷 분리 차단 설정 확인~~ — **완료**: `Visual content in notes`를 `Only allow screenshots ... when recording is enabled`로 설정 확인 + 실제 15분 회의 결과에서 스크린샷(inlineObjects) 0개로 최종 검증까지 완료(2026-08-30, GW-07 Pass)
4. ~~(보안 정리) `official@alton.education`의 조직 레벨 `roles/orgpolicy.policyAdmin` 회수 여부 결정~~ — **완료**: 2026-08-30 회수 및 재조회 검증까지 완료(§7)

Gate C 관련 남은 항목 없음. Gate D 완료, R1 착수.
