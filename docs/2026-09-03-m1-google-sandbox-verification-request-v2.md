# M1 Google Sandbox 외부 검증 요청 (v2, 2026-09-03) — 통합 재검증

- **상태: 제품 오너가 이 문서 절차로 실제 Sandbox 검증을 직접 실행 — 전부 통과 보고됨
  (2026-09-03).** 이 문서 자체는 Claude가 실제 API를 호출하지 않고 작성했고, 실제
  실행·정리는 제품 오너가 직접 수행했다. 실측 결과 요약(제품 오너 보고 그대로 기록,
  상세는 `docs/CURRENT.md`의 "M1/R6 — Workspace Events 구독 모델 정정 및 실제
  Sandbox 재검증 통과" 절 참고):
  - §1의 1~6번 검증 항목 전부 통과. 사용자 단위 구독(`//cloudidentity.googleapis.com/
    users/{Directory API 불변 ID}`)이 실제로 성립함을 확인 — canonical Meet space
    단위로 전환할 필요 없음(§1-3의 미확정 판단 해소).
  - 기존 `gate-c-meet-events` Pub/Sub 토픽에 이미 필요한 Publisher 권한이 있어 §2의
    신규 토픽 생성 없이도 검증 가능했다(사전 준비 STEP 0.5 중 토픽 생성 단계는
    불필요했던 것으로 확인).
  - §7 정리 전부 완료: Calendar 이벤트 2개·Smart Notes 문서 삭제, 구독 2개 실제 삭제,
    IAM binding·`.env.local` 원복.
  - 검증 중 발견된 앱 버그 2건은 별도로 정식 수정·커밋됨(문서 참고).
- 배경: v1 요청서(`docs/2026-09-03-m1-google-sandbox-verification-request.md`) 범위로 이미
  한 차례 실제 Sandbox 검증이 실행됐다 — `official@alton.education` Calendar/Meet 생성,
  확인 이메일(`matchbox512@snu.ac.kr`), 동의 토큰 확인까지는 실제로 통과했으나, **Workspace
  Events 구독을 생성하는 코드 자체가 없어 Smart Notes 원본 자동 연결은 검증되지 못했다.**
  이번 v2는 그 공백을 메운 신규 구현(구독 수명주기, Calendar 네이티브 초대로의 정책 전환,
  Smart Notes 외부 비공개 확인)을 포함해 **한 번의 통합 실행**으로 다시 검증하기 위한
  최소 추가 요청서다 — v1과 중복되는 절차를 다시 나열하지 않고 이번에 새로 필요한 것만
  적는다.

## 1. 이번 v2가 새로 검증해야 하는 것(v1 대비 차이)

1. **상담 이벤트에 외부 attendee 추가** — v1은 attendee 없이 organizer 단독 이벤트만
   확인했다. 이번엔 `official@alton.education`이 organizer, 신청 이메일(테스트 계정)이
   유일한 attendee, `sendUpdates="all"`로 실제 Google 초대 메일이 attendee에게 가는지
   확인한다.
2. **정규수업 이벤트에 학생 attendee 추가** — 선생님 회사 계정이 organizer, 검증된 테스트
   학생 계정 이메일이 attendee. 보호자는 attendee로 추가되지 않는지도 함께 확인.
3. **Workspace Events 구독 생성·갱신·삭제(2026-09-03 모델 정정 반영)** —
   `lib/google-workspace-events-subscriptions.ts`가 (a) Directory API로 organizer
   이메일→불변 사용자 ID를 resolve하고, (b) `targetResource=//cloudidentity.
   googleapis.com/users/{그 ID}`로, (c) `notificationEndpoint.pubsubTopic`에 실제
   Pub/Sub 토픽 리소스 이름(`projects/{project}/topics/{topic}`, 웹훅 URL 아님)을 넣어
   실제로 구독을 만들 수 있는지 확인한다. 응답 스키마(특히 `name`/`expireTime` 필드)가
   코드의 추정과 맞는지도 함께 확인(다르면 그 자리에서 중단, 코드만 그 실측에 맞게
   나중에 수정). **사용자 단위 구독 자체가 기술적으로 거부되면**(예: cloudidentity
   리소스로 404/400) canonical Meet space 단위 구독으로 전환이 필요할 수 있다 — 이
   판단은 이 실측에서만 확정할 수 있으므로, 거부 응답이 나오면 그 원문을 그대로
   기록하고 코드를 그 자리에서 임의로 바꾸지 않는다.
4. **Calendar 생성·시간변경·취소의 네이티브 알림** — attendee가 실제로 초대/변경/취소
   알림을 받는지(테스트 계정 받은편지함으로 확인).
5. **Smart Notes 생성 이벤트의 상담·세션 자동 연결** — 3번의 구독이 실제로 붙어있는
   상태에서 합성 회의를 진행해, Workspace Events 웹훅이 실제로 도착하고
   `consultations.smart_notes_drive_file_id`가 자동으로 채워지는지 확인(v1에서 못했던 것).
6. **외부 attendee의 Smart Notes 원본 접근 차단 확인** — attendee 계정으로 로그인해
   Calendar 이벤트에서 Smart Notes 첨부가 보이는지, 클릭했을 때 실제로 원본 문서에
   접근할 수 있는지(접근돼서는 안 됨) 확인. **만약 실제로 접근이 확인되면 그 자리에서
   즉시 중단하고 공유 범위를 넓히지 않는다 — 이는 §4의 코드 한계가 아니라 정책 blocker로
   보고한다** (Google API가 host/co-host 전용 공유를 직접 지원하지 않으므로, 이 통제는
   전적으로 Workspace 관리자 기본 설정에 의존한다 — 그 설정이 기대와 다르면 코드로
   해결할 수 없다).

## 2. 사용할 Sandbox 자원(v1과 동일, 재사용)

v1 §1과 동일 — `alton-integration-sandbox` 프로젝트, `official@alton.education`(상담
organizer), 담당 선생님 테스트 계정(수업 organizer), 신규로 추가되는 것은 아래뿐:

- **attendee 계정은 `matchbox512@snu.ac.kr` 하나뿐이다** — 상담 신청자 이메일과 정규수업
  테스트 학생 계정 이메일을 **동일하게 이 주소로 맞춘다**(역할별로 별도 계정 2개를 만들지
  않는다 — 학생 계정이라면 이 이메일로 `email_confirmed_at`이 채워져 있어야 정규수업
  Calendar 동기화가 attendee를 추가한다, §STEP 6-1 참고). 새 실제 개인 이메일을 추가로
  쓰지 않는다.
- **Workspace Events 구독 객체**: organizer당 최대 1개, v1이 이미 만들었다가 정리한
  것과 별개로 새로 만든다(재사용 아님 — v1 종료 시 이미 삭제됐으므로).
- **신규 Pub/Sub 리소스(이번 검증 전용, 검증 종료 즉시 삭제)**: 토픽 1개
  (`m1-sandbox-workspace-events-v2`) + 그 토픽에 대한 push subscription 1개
  (`m1-sandbox-workspace-events-push-v2`, push endpoint는 공인 접근 가능한 웹훅 URL —
  로컬 3010은 불가). Workspace Events 발행 서비스 계정에 이 토픽의
  `roles/pubsub.publisher` 권한 부여 필요(정확한 서비스 계정 이름은 GCP 콘솔에서
  실행 직전 확인 — 문서에 추정값을 적지 않는다).

## 3. 객체·이메일·회의 시간·IAM 변경 상한

- Calendar 이벤트(+Meet): 최대 **2개**(상담용 1개, 정규수업용 1개) — 순수 신규 생성
  기준, 시간변경은 같은 이벤트 재사용.
- Workspace Events 구독: organizer당 최대 1개, 총 **최대 2개**(상담 organizer 1 + 선생님
  organizer 1) — 검증 종료 즉시 삭제.
- Pub/Sub: 신규 토픽 1개 + push subscription 1개(위 §2) — 검증 종료 즉시 삭제, Publisher
  IAM binding도 토픽 삭제로 함께 제거되는지 재확인.
- 이메일·Calendar 알림 수신자: **`matchbox512@snu.ac.kr`만** — 별도 지시가 없으면 다른
  주소로 보내지 않는다(상담 신청·정규수업 학생 attendee 전부 이 한 계정). 예상 발송/알림:
  Calendar 네이티브 초대(상담) 1건 + 네이티브 초대(정규수업) 1건 + 시간변경 네이티브 알림
  1건. **커스텀 SMTP fallback 이메일은 이 검증에서 의도적으로 유도하지 않는다** — Calendar
  초대가 정상 성공하는 경로만 검증하고, 실패를 인위적으로 재현해 fallback 발송을 트리거하지
  않는다(그런 경우 커스텀 이메일도 항상 같은 `matchbox512@snu.ac.kr`로만 갈 것이므로 별도
  상한을 두지 않되, 이번 절차 어디에도 fallback을 의도적으로 발생시키는 단계는 없다).
- 합성 회의: 최대 1회, 최대 **20분 — Smart Notes 생성 확인 시 즉시 종료**(R6 15/N 실측
  근거, v1과 동일 상한).
- IAM: v1과 동일한 좁은 조건(`environment:development`)의 임시 WIF binding, 검증 종료
  즉시 제거 후 `get-iam-policy` 재조회로 원복 확인.

## 4. 검증 절차(v1 절차 뒤에 이어서 실행)

1. v1 §0(사전 확인)·§1(IAM binding)·§2(env 플래그) 그대로 재실행.
2. §1의 1~4번(attendee 포함 Calendar 생성·시간변경·취소, Workspace Events 구독 생성)을
   순서대로 실행하고 각 단계 실측 확인.
3. §1의 5번(합성 회의 진행, Workspace Events 웹훅 수신, 자동 연결 확인).
4. §1의 6번(attendee의 원본 접근 차단 확인) — 이 단계에서 예상과 다른 결과가 나오면
   그 자리에서 중단.
5. 정리: v1 §5와 동일한 순서(Calendar 이벤트 삭제, 구독 삭제, 합성 문서 삭제, 로컬 DB
   reset, IAM 원복, 플래그 원복, 재조회로 확인).

## 5. 승인 전 확인 사항

- [ ] §1의 6가지 신규 검증 항목에 동의
- [ ] §3 상한에 동의(이메일·Calendar 알림 수신자 `matchbox512@snu.ac.kr` 하나로 고정,
      상담 신청자와 정규수업 테스트 학생 계정 전부 이 주소)
- [ ] 정규수업 검증용 테스트 학생 계정의 `auth.users.email`이 실제로
      `matchbox512@snu.ac.kr`인지 사전 확인(§STEP 6-1)
- [ ] 검증 시각(합성 회의 포함이므로 사람이 직접 참여)
- [ ] Pub/Sub 토픽·push subscription·Publisher 권한 사전 준비(§2 신규 리소스, 실행
      절차는 `scripts/m1-sandbox-verification.sh` STEP 0.5) — 공인 웹훅 URL(Preview
      배포 등) 확보 필요, 로컬만으로는 이 부분을 실측할 수 없음

실제 외부 호출, Production·원격 DB 접근, 추가 이메일 발송, `git push`는 이번 문서
작성만으로는 전혀 실행되지 않았다 — 승인 후 별도 세션에서만 실행한다.
