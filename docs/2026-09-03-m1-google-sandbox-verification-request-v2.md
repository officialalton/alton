# M1 Google Sandbox 외부 검증 요청 (v2, 2026-09-03) — 통합 재검증

- 상태: **승인 대기 — 아직 실제 Google API를 호출하지 않았다.** 이 문서에 적힌 어떤 실제
  외부 호출도 승인 전까지 실행하지 않는다.
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
3. **Workspace Events 구독 생성·갱신·삭제** — `lib/google-workspace-events-subscriptions.ts`
   가 실제로 구독을 만들 수 있는지, 응답 스키마(특히 `name`/`expireTime` 필드)가 코드의
   추정과 맞는지 확인(다르면 그 자리에서 중단, 코드만 그 실측에 맞게 나중에 수정).
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

## 3. 객체·이메일·회의 시간·IAM 변경 상한

- Calendar 이벤트(+Meet): 최대 **2개**(상담용 1개, 정규수업용 1개) — 순수 신규 생성
  기준, 시간변경은 같은 이벤트 재사용.
- Workspace Events 구독: organizer당 최대 1개, 총 **최대 2개**(상담 organizer 1 + 선생님
  organizer 1) — 검증 종료 즉시 삭제.
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

실제 외부 호출, Production·원격 DB 접근, 추가 이메일 발송, `git push`는 이번 문서
작성만으로는 전혀 실행되지 않았다 — 승인 후 별도 세션에서만 실행한다.
