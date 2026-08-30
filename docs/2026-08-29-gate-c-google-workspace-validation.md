# Gate C — Google Workspace Sandbox 기술 검증

- 상태: **완료 — Gate D/R1 착수 가능.** Google 기술 검증 범위(GW-01~14)에서 데이터 모델을 바꿀 blocker가 발견되지 않았고, GW-11까지 육안 확인이 끝났다.
- **Gate C의 범위(기획자 확정, 2026-08-30)**: Gate C는 "Google 기술이 실제로 가능한가, 데이터 모델을 바꿀 blocker가 있는가"만 확인한다. ALTON 앱 자체의 기능 동작(수동 리뷰 task 생성, `manual_review` 큐 적재·재처리, 보존·삭제 자동화)은 앱이 아직 없는 R1 이전 시점에 검증할 대상 자체가 없으므로 Gate C의 Pass/Fail 판정에서 분리한다 — 삭제하지 않고 각 R 단계의 필수 인수 기준으로 `2026-08-29-master-roadmap-v3.md`와 `2026-08-29-developer-handoff-v3.md`에 명시적으로 이관했다(§3 비고, 각 문서 참고).
- 기준: `r0-approval-and-technical-validation-package.md` §7, `docs/research/2026-08-29-google-drive-lesson-folder-architecture.md`, `docs/research/2026-08-29-google-meet-gemini-notes.md`
- 개정 이력 v2: Meet 설정 변경용 scope 추가, Workspace Events API/Pub·Sub 구독 절차 추가, 테스트 회의 기준시간 완화, Smart Notes 스크린샷 단독 차단 설정을 GW-07 핵심 검증 항목으로 명시, 라이선스 단정을 확인 항목으로 전환, 자동화 계정 3분리를 권장안으로 재분류
- 개정 이력 v3: OAuth scope를 전체 URI로 표기(§1.3), Workspace Events API Pub/Sub 발행자가 Google 관리형 서비스 에이전트(`meet-api-event-push@system.gserviceaccount.com`)이고 앱 서버는 Subscriber라는 점을 정정(§1.3), 구독 만료 기간을 resource data 포함 여부·DWD 사용 여부별로 구분하고 초기 권장안을 resource data 제외 + Meet API 재조회로 명시(§1.1, §1.3), 이벤트명을 `google.workspace.meet.smartNote.v2.fileGenerated`로 통일(전체), `meetings.space.settings`로 스크린샷 차단이 실제로 가능하다고 단정하지 않고 Sandbox 검증 항목으로만 유지(§1.3, §5)
- 개정 이력 v4: `alton.education` Business Plus 및 Admin Console 설정을 실측 확인. 녹화·별도 Meet 전사가 꺼진 상태에서도 Smart Notes 결과 문서에 텍스트 전사 탭이 생성된 테넌트 동작을 반영해, 영상·원본 음성 녹화와 별도 Meet 전사는 계속 금지하되 Smart Notes에 수반되는 텍스트 전사는 제한적으로 허용하는 제품 정책으로 변경. 보호자 사전 거부와 Meet 입장 시 명시적 동의를 함께 요구하고, 스크린샷은 녹화가 켜진 경우에만 허용하도록 관리자 설정을 확정
- 개정 이력 v5: Google Cloud 프로젝트(`alton-integration-sandbox`) 생성, 필요 API 전체 활성화, 서비스 계정 생성 및 domain-wide delegation 등록·keyless impersonation 동작 검증, Pub/Sub 토픽·구독 생성과 `meet-api-event-push@system.gserviceaccount.com` Publisher 권한 부여까지 완료(상세 이력은 `2026-08-29-gate-c-sandbox-infra-log.md`). 이를 기반으로 GW-01(학생 폴더)~GW-04(재전송 멱등성)를 실제 Sandbox Shared Drive/Calendar/Meet API로 실행해 전부 Pass 처리. §1.1/§1.2 체크리스트를 실제 완료 상태로 갱신
- 개정 이력 v6: 테스트 선생님 계정 2개(`teacher1@`, `teacher2@alton.education`, Shared Drive 비멤버 상태로 생성)로 GW-05(배정)·GW-06(변경) 실행해 Pass 처리. 과목 폴더 단위 권한 부여·회수, 하위 폴더 상속, 원본 위치 불변을 모두 확인. 권한 상속에 약 15초 전파 지연이 있다는 실측 결과를 §5에 신규 기술 제약으로 추가. 이어서 GW-13(teacher2 퇴사 시뮬레이션 — 폴더 권한 회수, 회사 원본 보존)과 GW-12(잘못된 fileId로 의도적 실패 유발 — 안정적 404 재현 확인)도 Pass 처리
- 개정 이력 v7: GW-03 테스트 Meet space(`spaces/UGuIoiRBp7cB`)를 대상으로 실제 Workspace Events API 구독(`subscriptions/meet-spaces-...`, resource data 제외, 7일 유효)을 생성 완료 — GW-07 실제 회의 시 `smartNote.v2.fileGenerated` 이벤트를 즉시 수신할 준비가 됐다. GW-11(외부 계정 조회)은 자동화 계정 조회 성공 + 외부 후보 계정 4개의 직접 ACL 부재까지 확인해 조건부 Pass 처리(육안 확인 1건만 남음)
- 개정 이력 v8(기획자 정정): GW-12를 Pass(조건부)에서 **Partial**로 하향 정정. "Google API가 재현 가능한 오류를 반환한다"는 것과 GW-12의 실제 통과 기준("manual_review/reconciliation_needed **목록에 표시**")은 다른 문장이며, ALTON 자체 큐가 R1 이전이라 존재하지 않아 후자를 검증할 수 없었다 — manual_review 큐 실제 적재·재처리 검증은 R1 구현 후로 명시적으로 이연(deferred to R1)
- 개정 이력 v9: 실제 2인(컴퓨터+휴대폰) 라이브 Meet 회의로 GW-07~10을 실행. GW-07: 약 15분 회의에서 녹화·별도 전사 없이 Smart Notes 요약 생성, 스크린샷 0개, 외부 참가자 자동공유 없음, Workspace Events→Pub/Sub 이벤트 실제 수신까지 확인해 Pass. GW-08: My Drive 원본을 세션 폴더로 이동해도 fileId 불변 확인해 Pass. GW-09: 이동 후에도 Calendar 첨부 fileId 일치·Docs API 열람 가능 확인해 Pass — 연구 문서가 "공식 보장 아님"이라 표시했던 추론을 실증. GW-10: `meetings.space.settings`로 개별 세션 Smart Notes OFF 전환 확인. 이번 실측에서 별도 텍스트 전사 tab은 생성되지 않아 v4의 "텍스트 전사 탭 생성" 관찰과 달랐다 — Google 동작이 회의 조건에 따라 비결정적임을 보여주는 증거로 확정하고 §5의 보수적 정책(제한 접근·12개월 보관 유지)은 그대로 둔다
- 개정 이력 v10(이번, 기획자 구조 정정): GW-11 외부 계정 육안 확인 완료 반영(Pass 확정). **Gate C 범위를 "Google 기술 검증"으로 명확히 하고 ALTON 앱 구현 후 인수 테스트와 분리** — GW-10(세션별 Smart Notes OFF)과 GW-12(Google API 실패 재현)는 Google 기술 부분만으로 Pass 재판정(v8의 Partial 판정 정정), 그 안에 섞여 있던 앱 워크플로우(수동 리뷰 task 생성, `manual_review` 큐 적재·재처리)는 삭제하지 않고 `2026-08-29-master-roadmap-v3.md`(R9, R8)와 `2026-08-29-developer-handoff-v3.md`에 인수 기준(blocker)으로 이관. GW-14는 처음부터 Google 기술 검증 대상이 아니므로(보존·삭제는 ALTON 앱 워크플로우) Gate C 범위 밖으로 재분류하고 R12 인수 기준으로 이관. Google 기술상 데이터 모델 변경 blocker가 없고 GW-11까지 통과했으므로 **Gate C를 완료 처리하고 Gate D/R1 착수 가능 상태로 전환**

## 0. 현재 상태 요약

`alton.education` Workspace Business Plus와 Meet 관리자 설정은 확인됐고 수동 Meet 사전 검증도 수행했다. Google Cloud 프로젝트(`alton-integration-sandbox`), 서비스 계정(`gate-c-automation@...`), domain-wide delegation, Pub/Sub, `ALTON Integration Sandbox` Shared Drive까지 모두 준비 완료했고, 이를 이용해 GW-01~04를 실제로 실행해 Pass 처리했다(상세 인프라 이력: `2026-08-29-gate-c-sandbox-infra-log.md`).

**GW-01~13은 전부 Gate C 범위(Google 기술 검증)에서 Pass. GW-14는 처음부터 Gate C 범위 밖(ALTON 저장·삭제 자동화 구현 후 인수 테스트)으로 재분류했다.** GW-10과 GW-12에 섞여 있던 ALTON 앱 워크플로우 부분(수동 리뷰 task 생성, `manual_review` 큐 적재·재처리)은 Gate C 판정에서 분리해 각 R 단계 인수 기준으로 이관했다 — 상세는 §3 비고.

---

## 1. 사전조건 체크리스트 (사람이 준비할 것)

### 1.1 Workspace/Cloud

- [x] `alton.education` Google Workspace **Business Plus** 확인(2026-08-29 Admin Console 실측) — Smart Notes 지원 에디션 조건 충족
- [x] 전용 Google Cloud 프로젝트 생성(운영 프로젝트와 분리) — `alton-integration-sandbox`(2026-08-29)
- [x] Calendar API, Drive API, Docs API, Meet API, **Google Workspace Events API** 활성화(2026-08-29)
- [x] Cloud Pub/Sub 토픽(`gate-c-meet-events`) + 구독(`gate-c-meet-events-sub`) 생성, `meet-api-event-push@system.gserviceaccount.com` Publisher 권한 부여 완료(2026-08-29, 조직 정책 임시 완화·복구 경위는 `2026-08-29-gate-c-sandbox-infra-log.md` §4/§7 참고). 구독 만료 정책(resource data 제외 시 최대 7일 등)은 실제 구독 갱신 cron까지는 아직 구현하지 않음 — GW-07 실행 전 확인
- [x] 서비스 계정(`gate-c-automation@alton-integration-sandbox.iam.gserviceaccount.com`) 생성 + domain-wide delegation 등록 완료, keyless impersonation으로 `official@alton.education` 가장 동작 검증 완료(2026-08-29)
- [x] Admin Console에서 AI note-taking ON, 기본 공유 `Hosts and co-hosts only`, Ask Gemini OFF, 모든 hosted meeting에서 기본 note-taking ON, 참가자 명시적 동의 요구를 확인(2026-08-29)
- [x] `Visual content in notes`를 `Only allow screenshots ... when recording is enabled`로 설정. **실제 15분 회의 결과 문서에서 스크린샷(inlineObjects) 0개로 최종 확인 완료(2026-08-30, GW-07 Pass)**
- [x] 성인(18세 이상) 테스트 선생님 회사 계정 2개 — `teacher1@alton.education`, `teacher2@alton.education`(2026-08-29 생성, Shared Drive 비멤버 상태로 GW-05/06에 사용 완료). GW-13(퇴사)에도 이 계정 재사용
- [x] 테스트 학생·보호자 역할 외부 계정(외부 개인 Gmail 포함 — GW-11 검증용) — 신규 Workspace 계정 대신 기존 개인 계정 4개(`matchbox512@gmail.com`/`@snu.ac.kr`, `jiman@springcamp.co`/`@bulqot.co`)로 대체, GW-11에서 사용 완료(2026-08-30)
- [x] Shared Drive 관리자(Manager) 2명 이상 — `official@alton.education`, `jiman@alton.education`(2026-08-29)
- [x] 자동화 전용 내부 계정 — **(변경)** 별도 `drive-automation@` 계정을 만들지 않고 `official@alton.education`을 Sandbox 한정 임시 자동화·주최 계정으로 사용하기로 확정(사용자 결정, 2026-08-29)

### 1.2 Shared Drive

- [x] `ALTON Integration Sandbox` Shared Drive 생성 완료(운영용 `ALTON Learning Records`와 별도, `driveId` 뒷자리는 `2026-08-29-gate-c-sandbox-infra-log.md` 참고)
- [x] 폴더 구조 사전 생성: `00_System`, `10_Students`, `20_Teacher_Portals`(연구 문서 §1 구조) — 확인 완료(2026-08-29)
- [x] 외부 공유·비구성원 공유·다운로드 제한 정책 — 별도 정책 설정 없이도 Shared Drive 기본값(비구성원 접근 거부)으로 GW-11이 통과함을 실측 확인(2026-08-30). 세부 다운로드 제한 옵션은 R1 이후 운영 정책으로 별도 검토 가능(blocker 아님)

### 1.3 OAuth scope(최소 권한, 연구 문서 §5.3 기준 — **개정: 전체 URI로 표기**)

| 용도 | scope(전체 URI) |
|---|---|
| Meet Smart Notes 발견 | `https://www.googleapis.com/auth/meetings.space.readonly` |
| **(신규)** Meet 공간 설정 변경(예: GW-10 보호자 거부 시 `autoSmartNotesGeneration=OFF` 개별 전환) | `https://www.googleapis.com/auth/meetings.space.settings` — Admin Console에는 스크린샷을 `녹화 시에만 허용`하는 조직 설정이 존재함을 확인했다. 다만 이 조직 설정과 동일한 항목을 이 API scope로 회의별 변경할 수 있다고 단정하지 않으며, ALTON은 조직 설정으로 고정하고 보호자 거부 시에는 Smart Notes 전체를 회의별 OFF 처리한다 |
| Meet 생성 Drive 파일 읽기 | `https://www.googleapis.com/auth/drive.meet.readonly`(가능하면) |
| Docs 내용 읽기 | `https://www.googleapis.com/auth/documents.readonly` |
| Smart Notes 이동·권한 부여/회수(전용 작업자) | `https://www.googleapis.com/auth/drive`(전체, 별도 서비스 계정으로 격리) |
| Calendar 첨부 확인 | `https://www.googleapis.com/auth/calendar.events.readonly` |
| Calendar 첨부 수정(복사 폴백에만) | `https://www.googleapis.com/auth/calendar.events` |
| **(신규)** Workspace Events API 이벤트 구독 대상 리소스 읽기 | 구독 대상 리소스에 대응하는 위 Meet 관련 scope(예: `meetings.space.readonly`) — Workspace Events API 자체는 별도 OAuth scope가 아니라 구독 대상 리소스의 기존 scope를 재사용한다 |

**(개정) Pub/Sub 발행·구독 역할 정정**: 이벤트를 Pub/Sub 토픽에 실제로 게시(publish)하는 주체는 우리 서비스 계정이 아니라 **Google이 관리하는 Workspace Events 서비스 에이전트**(`meet-api-event-push@system.gserviceaccount.com`)다. 우리가 만든 Pub/Sub 토픽에 이 Google 관리형 계정을 **Publisher**(`roles/pubsub.publisher`)로 등록해야 하고, 앱 서버(또는 pull subscription을 읽는 워커)는 그 토픽의 **Subscriber**(`roles/pubsub.subscriber`)로만 등록한다. v2 초안의 "서비스 계정에 pubsub.publisher, 앱 서버에 pubsub.subscriber"는 발행자를 우리 서비스 계정으로 잘못 표기한 것이었다.

역할 분리(연구 문서 §5.2, **권장안 — Sandbox 시작의 필수조건 아님**): `drive-provisioner`(Manager, 초기 설정 전용) / `drive-ingestor`(Content manager 또는 Contributor, 일상 운영) / `drive-reader`(읽기 전용, 앱 서빙용)로 3개 계정을 분리하면 런타임 경로가 Manager 권한을 갖지 않아 더 안전하다. 다만 Sandbox 검증(GW-01~14)은 단일 자동화 계정(§1.1의 `drive-automation@`)으로도 시작할 수 있고, 3계정 분리는 실제 구현(R6 이후) 시점에 채택 여부를 정한다.

---

## 2. GW-01~14 실행 절차와 통과 기준 (Sandbox 준비 후 실행)

각 항목은 사전조건 완료 후 실제 Sandbox에서 실행하고, 결과를 이 문서의 §3 표에 채운다.

| ID | 절차 | 통과 기준 |
|---|---|---|
| GW-01 | 테스트 학생 활성화 트리거 → provisioning job 실행 | 학생 폴더 1개만 생성, `fileId`가 DB(또는 이 검증에서는 로그)에 기록 |
| GW-02 | 테스트 과목 수강 활성화 | `10_Students/STU_.../ENR_..._<subject>` 폴더와 `연도` 하위구조 자동 생성 |
| GW-03 | 예약 확정(테스트) | 세션 폴더 + Calendar 이벤트(고유 `eventId`) + 고유 Meet(`conferenceId`) 자동 생성 |
| GW-04 | 동일 provisioning 이벤트 재전송 | 폴더·이벤트·Meet **중복 생성 0건**(idempotency key로 확인) |
| GW-05 | 선생님 배정(테스트 선생님 A) | A는 배정된 과목 폴더만 접근, 다른 학생 폴더 접근 시 거부 |
| GW-06 | 선생님 변경(A→B) | A 권한 회수, B 권한 부여, **원본 폴더 위치 이동 없음** 확인 |
| GW-07 | Smart Notes 생성(**권장 최소 15분 이상** 테스트 회의, `autoSmartNotesGeneration=ON`, 영상·원본 음성 녹화 OFF, 별도 Meet `Transcribe the meeting` OFF). Smart Notes 문서에 수반되는 텍스트 전사는 허용하고 제한 접근·12개월 보관 적용 | `google.workspace.meet.smartNote.v2.fileGenerated` 이벤트를 Workspace Events API/Pub·Sub 구독으로 수신. 녹화 OFF 상태에서 화면 스크린샷이 실제로 포함되지 않고, 결과 문서와 수반 텍스트 전사가 호스트·공동 호스트 외부에 자동 공유되지 않는지 확인 |
| GW-08 | Smart Notes 이동 | 주최자 My Drive 원본을 세션 폴더로 이동, **동일 `fileId`** 유지 확인(`files.update`의 `addParents`/`removeParents`) |
| GW-09 | Calendar 첨부 검증 | 이동 후 Calendar 이벤트의 `attachments[].fileId`가 같은 문서를 계속 가리키는지, Docs API로 실제 열람 가능한지 |
| GW-10 | 보호자 AI 회의록 거부 — **Gate C 범위**: 해당 세션의 Meet 공간 `autoSmartNotesGeneration=OFF`로 개별 전환 가능한지만 검증 | Google API로 세션 단위 Smart Notes 차단이 가능한지 확인. (수동 리뷰 task 생성은 ALTON 앱 워크플로우라 Gate C 범위 밖 — R9 인수 기준으로 이관, §3 비고) |
| GW-11 | 학생·보호자 조회(외부 Gmail 계정으로) | 그 계정에 Drive ACL을 **전혀 주지 않고** ALTON 서버 경유로만 확정 자료 조회 가능 |
| GW-12 | 실패 복구 — **Gate C 범위**: 의도적으로 권한 API 실패를 유발(예: 잘못된 fileId)했을 때 Google API가 성공으로 위장하지 않고 안정적으로 재현 가능한 오류를 반환하는지만 검증 | 재시도해도 동일한 오류가 안정적으로 재현되는지 확인. (`manual_review`/`reconciliation_needed` 목록 적재·재처리는 ALTON 앱 워크플로우라 Gate C 범위 밖 — R8 인수 기준으로 이관, §3 비고) |
| GW-13 | 선생님 퇴사(테스트 선생님 B 비활성화) | 담당하던 모든 폴더 접근 회수, 회사 원본 파일은 그대로 보존 |
| GW-14 | **Gate C 범위 밖** — 보존·삭제는 Google Drive 자체 기능이 아니라 ALTON의 저장·삭제 자동화가 수행할 앱 워크플로우이므로, 이 항목 전체를 R12 인수 기준으로 이관(§3 비고) | (해당 없음 — R12 저장 흐름 구현 후 인수 테스트에서 검증) |

### 2.1 GW-07~09 관련 특별 주의(연구 문서 §4.2가 명시적으로 "공식 보장 아님"이라 표시한 부분)

Smart Notes를 Shared Drive로 이동한 뒤에도 Calendar 첨부가 같은 문서를 계속 가리킨다는 것은 **Drive의 일반 파일 ID 안정성 + Calendar 첨부의 `fileId` 참조 방식을 결합한 아키텍처 추론**이며, Smart Notes 전용 보장 문구가 공식 문서에 없었다. **2026-08-30 실제 Sandbox 검증(GW-08/09)에서 이 추론이 사실로 확인됐다** — 이동 후에도 fileId 불변, Calendar 첨부 fileId 일치, Docs API 열람 가능을 모두 확인해 복사 폴백 대안은 필요 없는 것으로 결론.

---

## 3. Pass/Fail 표 (Sandbox 실행 후 채움)

| ID | 상태 | 증빙 위치 | 비고 |
|---|---|---|---|
| GW-01 | **Pass** (2026-08-29) | 학생 폴더 fileId 앞4자리 `1vMg`(sha256 8자리 `2ac4807c`), `10_Students` 아래 정확히 1개 생성 | `official@alton.education` DWD impersonation으로 실행. 합성 테스트 ID(`TEST_STU_GATEC_001`) 사용, 실제 학생 데이터 아님 |
| GW-02 | **Pass** (2026-08-29) | 과목 폴더 fileId 앞4자리 `1So_`(sha256 8자리 `462a8ab3`) + `00_Course_Materials`/`10_Sessions/2026` 하위구조 자동 생성 확인 | GW-01 학생 폴더 아래 정상 중첩 생성 |
| GW-03 | **Pass** (2026-08-29) | 세션 폴더 fileId 앞4자리 `1nLC`(sha256 `331a80ab`), Calendar eventId sha256 `e023f832`, Meet conferenceId sha256 `cb7404d4` | Calendar `events.insert`(`conferenceDataVersion=1`)로 세션 폴더+Calendar 이벤트+고유 Meet을 한 번에 생성. 테스트 회의는 Gate C 권장대로 15분 길이로 설정(실제 미개최, 메타데이터만 생성) |
| GW-04 | **Pass** (2026-08-29) | GW-01~03의 학생/과목/세션 폴더 3종 + Calendar 이벤트를 동일 idempotency 키로 재요청 → 폴더 3종 모두 `created=false`(기존 fileId 그대로 반환), Calendar `privateExtendedProperty` 조회로 이벤트 1건만 확인(중복 0건) | Drive는 `appProperties` 기반 find-or-create, Calendar/Meet은 `extendedProperties.private.alton_session_id` 기반 조회로 검증. 두 메커니즘 모두 재전송에 안전함을 확인 |
| GW-05 | **Pass** (2026-08-29) | 대조군 학생 폴더 fileId sha256 `4ebc308b`, teacher1 권한 permissionId sha256 `674c417a`. 배정 폴더(ENR) 접근 200, 하위 세션 폴더 상속 접근 200(권한 전파 대기 후), 다른 학생 폴더·`10_Students` 상위 폴더 접근 404 | 테스트 계정 `teacher1@alton.education`(Shared Drive 비멤버, 폴더 단위 권한만 부여) 사용. **발견 사항**: 하위 폴더로의 권한 상속이 즉시 반영되지 않고 약 15초 전파 지연이 있었음 — 실제 구현 시 권한 부여 직후 하위 자료 접근을 요구하는 UX에서 고려 필요 |
| GW-06 | **Pass** (2026-08-29) | teacher2 권한 permissionId sha256 `3a60643e`, ENR 폴더 `parents` 변경 전후 동일(위치 이동 없음) | teacher1 권한 DELETE(204) 후 teacher2에게 동일 폴더 writer 부여. 20초 대기 후 teacher1 접근 404(거부), teacher2 접근 200(허용) 확인 |
| GW-07 | **Pass** (2026-08-30) | 회의 conferenceRecord sha256 `0082e5d0`, smartNote sha256 `e2fb4f40`, 결과 문서 fileId sha256 `d29ac0da`. 2명(`official@alton.education`, `matchbox512@gmail.com`) 동시 접속 약 12분 37초, `recordings`/`transcripts` 빈 배열(녹화·별도 전사 미생성), `smartNotes.state`가 `ENDED`→`FILE_GENERATED`로 전이, Pub/Sub에서 `google.workspace.meet.smartNote.v2.fileGenerated`(`ce-subject`가 대상 space와 일치) 실제 수신, 문서 `inlineObjects`(이미지) 0개, 공유 권한이 `official@alton.education` 단독(외부 참가자 자동공유 없음), 실제 요약문(Summary 섹션) 생성 확인 | 2026-08-29 수동 사전 검증(대화량 부족으로 요약 실패)과 달리 이번엔 15분 안팎 실제 대화로 요약까지 정상 생성됐다. **참고(기획자 판단 반영)**: 이전 수동 테스트는 "녹화·전사 OFF여도 별도 텍스트 전사 탭 생성"을 관찰했으나, 이번 자동 검증에서는 tab이 "Notes" 1개뿐이고 별도 전사 tab이 없었다. 이 차이는 **Google 쪽 동작이 회의 조건(길이·참가자 구성 등)에 따라 달라질 수 있다는 증거**로 확정하고, 매번 생성되지 않는다고 해서 정책을 느슨하게 바꾸지 않는다 — v4의 "생성될 수 있으므로 제한 접근·12개월 보관 적용"을 그대로 유지하는 것이 안전하다는 결론(§5) |
| GW-08 | **Pass** (2026-08-30) | fileId sha256 `d29ac0da`(이동 전후 동일) | `official@alton.education` My Drive의 자동 생성 폴더(`Meet Recordings` 계열)에서 GW-03 세션 폴더로 `addParents`/`removeParents`로 이동, 동일 fileId 유지 확인 |
| GW-09 | **Pass** (2026-08-30) | Calendar eventId sha256 `e023f832`의 `attachments[0].fileId`가 fileId sha256 `d29ac0da`와 일치 | 이동 후에도 Calendar 첨부가 같은 문서를 계속 가리키며, Docs API `documents.get`으로 이동 후에도 정상 열람(status 200) 확인 — 연구 문서 §4.2가 "공식 보장 아님"이라 표시했던 아키텍처 추론을 실제 Sandbox에서 실증 |
| GW-10 | **Pass**(Gate C 범위, 2026-08-30) | space `spaces/UGuIoiRBp7cB`에 `meetings.space.settings` scope로 PATCH, 응답에서 `smartNotesConfig.autoSmartNotesGeneration`이 `ON`→`OFF`로 개별 전환 확인 | Google 쪽 세션 단위 Smart Notes 차단 메커니즘 확인이 Gate C의 검증 범위이며 여기서는 Pass. "수동 리뷰 task 생성"은 ALTON 앱 워크플로우이고 R1 이전이라 검증 대상 자체가 없어 Gate C 판정에서 제외 — `2026-08-29-master-roadmap-v3.md` R9 인수 기준으로 이관(blocker로 명시) |
| GW-11 | **Pass** (2026-08-30) | 확정 자료 fileId sha256 `4e61da19`. ENR 폴더·세션 폴더·Shared Drive 전체 권한 목록에 외부 후보 계정 4개(`matchbox512@gmail.com`/`@snu.ac.kr`, `jiman@springcamp.co`/`@bulqot.co`) 전부 부재 확인. `matchbox512@gmail.com`으로 로그인한 휴대폰 브라우저에서 세션 폴더 링크 직접 접근 시 "You need access" 거부 화면 실측 확인(2026-08-30) | 자동화 계정(official@ DWD)의 서버 경유 조회 성립 + 외부 계정 직접 접근 거부 육안 확인까지 모두 완료돼 조건부 표시 해제 |
| GW-12 | **Pass**(Gate C 범위, 2026-08-29) | 잘못된 fileId로 `files.get`/`permissions.create` 호출 → 항상 404, 재시도해도 동일하게 재현 | Google API가 실패를 성공으로 위장하지 않고 안정적으로 재현되는 오류를 반환한다는, Gate C가 확인해야 할 "Google 기술 가능 여부"는 확정됐다. `manual_review`/`reconciliation_needed` 큐에 실제로 적재·재처리되는지는 ALTON 앱 워크플로우이고 R1 이전이라 검증 대상 자체가 없어 Gate C 판정에서 제외 — `2026-08-29-master-roadmap-v3.md` R8 인수 기준으로 이관(blocker로 명시). (2026-08-30 기획자 방침: Google 기술 검증과 앱 인수 테스트를 분리하는 원칙에 따라 v8의 Partial 판정을 Pass로 재조정) |
| GW-13 | **Pass** (2026-08-29) | 권한 회수 대상 permissionId sha256 `3a60643e`(GW-06과 동일 건), 퇴사 처리 전후 폴더 `driveId`·`trashed` 상태 동일 | teacher2 담당 폴더 권한 DELETE 후 20초 대기, 접근 404 확인. 폴더는 회사 Shared Drive에 그대로 보존(`trashed=false`, `driveId` 불변). **범위 제한**: 이번 테스트는 Drive 폴더 권한 회수만 검증했고, 실제 Workspace 계정 자체의 정지(Admin SDK Directory API)는 검증 범위 밖(R2의 계정 수명주기 영역) |
| GW-14 | **이관 — Gate C 범위 밖**(2026-08-30) | — | 보존·삭제는 Google Drive의 네이티브 기능이 아니라 ALTON의 삭제 배치·감사 이력 워크플로우가 수행할 일이라, 애초에 Gate C가 "Google 기술 가능 여부"로 검증할 대상이 아니다. `2026-08-29-master-roadmap-v3.md` R12 인수 기준으로 이관(blocker로 명시), 해당 저장 흐름 구현 후 인수 테스트로 수행 |

**전체 통과 기준(§7.4, Gate C 범위 내 5개 지표는 GW-01~13으로 전부 충족)**: 수동 폴더 생성 0건(GW-01/02), 학생·학부모 Drive 직접 ACL 0건(GW-11), 중복 생성 0건(GW-04), 권한 회수 실패 0건(GW-06/13), 실패 이벤트 유실 0건(GW-12, Google API 재현성 기준) — Sandbox 실행 결과로 전부 확인됨.

---

## 4. 검증 재개 지점

사람이 §1 체크리스트를 완료하면 다음 순서로 재개한다.

1. GW-01~06(Drive/Calendar/Meet provisioning, 재전송 멱등성, 선생님 배정·변경 권한) — **전부 Pass 완료(2026-08-29)**
2. GW-07~09(Smart Notes) — **전부 Pass 완료(2026-08-30)**. 2인(컴퓨터+휴대폰) 실제 회의로 이벤트 수신·스크린샷 미포함·이동 후 fileId·Calendar 첨부 일치까지 확인
3. GW-10(보호자 거부, Gate C 범위) — **Pass 완료(2026-08-30)**. Google 쪽 개별 세션 OFF 전환 확인. 수동 리뷰 task 생성은 R9 인수 기준으로 이관
4. GW-11(학생·보호자 조회) — **Pass 완료(2026-08-30)**, 외부 계정 육안 확인까지 완료
5. GW-12(실패 복구, Gate C 범위) — **Pass 완료(2026-08-29)**. Google API 오류 재현성 확인. `manual_review` 큐 적재·재처리는 R8 인수 기준으로 이관
6. GW-13(퇴사) — **Pass 완료(2026-08-29)**
7. GW-14(보존·삭제) — **Gate C 범위 밖으로 재분류(2026-08-30)**. R12 인수 기준으로 이관, 저장 흐름 구현 후 검증

**Gate C는 위 7단계로 완료됐다.** 각 단계의 마스킹된 로그(파일 ID는 앞 4자리만, 이벤트 ID는 해시)는 §3 표에 반영했다.

## 5. 제품 정책에 영향을 줄 수 있는 기술 제약(사전 인지, 확정 아님)

- Smart Notes는 Business Standard 이상 필요 → **(개정)** 회의 주최자 계정에만 상위 라이선스를 배정하면 된다고 단정하지 않는다. 현재 `alton.education` Workspace 계약이 계정별/조직단위별 혼합 라이선스를 지원하는지 먼저 확인해야 하며, 지원하지 않으면 더 넓은 범위(OU 전체 또는 전사)의 업그레이드 비용을 검토해야 한다(§1.1)
- 제한 접근 폴더(`inheritedPermissionsDisabled`) 전환은 `organizer`(Manager) 권한이 필요 → 이 기능을 쓰지 않기로 한 현재 설계(선생님 앱 포털 우선, 연구 문서 권장 A안)를 유지하면 회피 가능, 별도 정책 변경 불필요
- Smart Notes 이동 후 참가자 공유 권한 재평가 방식이 공식 문서에 상세 기술되어 있지 않았으나, **2026-08-30 실측에서 이동 후에도 문서 공유 권한이 `official@alton.education` 단독으로 유지됨(참가자에게 자동 재공유되지 않음)을 확인** — "학생·보호자에게 원본 회의록을 절대 직접 공유하지 않는다"는 기존 정책(ADR-010류 원칙)을 그대로 유지 가능
- Admin Console에 `Visual content in notes` 설정이 실제로 존재하고 `Only allow screenshots ... when recording is enabled`를 선택할 수 있음을 확인했다. ALTON은 녹화를 금지하므로 설정상 화면 캡처도 차단되지만, 실제 Smart Notes 결과에서 스크린샷 미포함을 한 번 더 검증한다.
- 별도 Meet `Transcribe the meeting`이 OFF여도 Smart Notes 결과 문서에 텍스트 전사 탭이 생성되는 테넌트 동작을 2026-08-29 수동 테스트에서 확인했으나, 2026-08-30 자동 검증(GW-07)에서는 같은 조건에서도 전사 탭이 생성되지 않았다 — **이 동작이 회의 조건에 따라 달라질 수 있음(비결정적)이 실측으로 확인됐다.** 생성되지 않은 사례가 있다고 정책을 완화하지 않고, "생성될 수 있으므로" 전제로 Smart Notes 수반 산출물 전체에 원본 회의록과 동일한 제한 접근·12개월 보관정책을 계속 적용한다. 학생·보호자에게는 선생님 검토 후 확정 요약만 제공한다.
- **(신규, GW-05 실측)** Shared Drive 폴더 권한 부여가 하위 폴더까지 상속되는 데 즉시가 아니라 약 15초 정도의 전파 지연이 있음을 실측 확인했다(과목 폴더에 writer 권한 부여 직후 하위 세션 폴더 접근 시 404, 15초 후 재시도하면 200). 선생님 배정 확정 직후 곧바로 세션 자료 접근을 요구하는 화면(R6 배정·예약 흐름)에서는 이 지연을 고려해 재시도 로직이나 짧은 로딩 상태 UX를 둬야 한다 — 실패로 오인해 배정을 되돌리는 로직을 만들지 않는다.
