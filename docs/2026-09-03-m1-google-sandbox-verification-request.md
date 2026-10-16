# M1 Google Sandbox 외부 검증 승인 요청 (v1, 2026-09-03)

- 상태: **승인 대기 — 아직 실제 Google API를 호출하지 않았다.** 아래 승인을 받기 전까지 이
  요청서에 적힌 어떤 실제 외부 호출도 실행하지 않는다. **이 요청서는 M1 자체의 승인과도
  별개다** — M1 코드/DB/로컬 검증이 제품 오너 승인을 받은 뒤, 그리고 이 Sandbox 요청서가
  별도로 승인된 뒤에만 아래 절차를 실행한다.
- 목적: M1에서 mock/로컬로 배선한 상담(consultations) Calendar/Meet 생성(`official@alton.education`
  organizer)·확인 이메일 발송·Smart Notes readiness 확인·보정(`ensureMeetSpaceSmartNotesOn`)·
  Smart Notes 원본 자동 연결(기존 R6 Workspace Events 웹훅 재사용)이 **실제 Google API**에서도
  동작하는지 검증한다. R6 Sandbox 검증(`docs/2026-09-02-r6-google-sandbox-verification-request.md`,
  이미 통과·정리 완료)과 별개의 신규 요청이다 — 이벤트 소유 계정이 담당 선생님이 아니라 회사
  상담 관리자 계정(`official@alton.education`)이라는 점이 핵심 차이.
- **범위를 나누어 부분 실행하지 않는다.** Calendar/Meet 생성·Smart Notes 확인/보정·원본 자동
  연결(Workspace Events 수신)을 **한 번의 통합 실행**으로 검증한다.

## 1. 사용할 Sandbox 자원(기존 Gate C/R6 자원 재사용 — 신규 생성 최소화)

- **Google Cloud 프로젝트**: `alton-integration-sandbox`(기존, 신규 생성 없음).
- **이벤트 소유 계정**: 모든 Calendar 이벤트와 Meet은 **`official@alton.education`의 primary
  calendar에만** 생성한다(R6과 달리 담당 선생님이 아니라 회사 상담 관리자 계정이 organizer —
  M1 요구사항 3에 명시된 정책). 참석자(attendees)는 추가하지 않는다(R6과 동일 원칙 — ALTON
  화면 접속이 원본, 신청자 이메일로 Google 초대 메일이 나가지 않도록).
- **DWD 인증 체인**: R6에서 이미 검증된 것과 동일(Vercel OIDC → GCP WIF → 서비스 계정
  impersonation → signJwt → Calendar/Meet API) — 새 인증 경로 없음, subject email만
  `official@alton.education`으로 바뀐다.
- **Meet**: 위 Calendar 이벤트에 자동 첨부되는 Meet space만 사용.
- **Workspace Events 수신**: R6이 이미 만든 것과 동일한 Pub/Sub push 엔드포인트
  (`app/api/webhooks/workspace-events/route.ts`)를 그대로 재사용한다 — 새 웹훅·새 구독
  객체를 만들지 않는다. R6 검증 때 만든 구독이 이미 정리(삭제)됐으므로, 이 검증에서
  구독을 다시 활성화해야 한다면 **R6 요청서와 동일한 상한(최대 1개, 검증 후 즉시 삭제)**을
  그대로 따른다.
- **이메일 수신자**: 실제 신청자 이메일로 발송하지 않는다 — 아래 §5 참고, 팀 내부 통제된
  테스트 메일함(제품 오너가 지정하는 1개 주소)만 사용한다.
- 신규로 만들 Google Cloud 자원·서비스 계정·Shared Drive는 없다.

## 2. DWD scope 현황

M1이 실제로 호출하는 API는 R6가 이미 검증한 Calendar/Meet API와 완전히 동일한 두 클라이언트
(`lib/google-calendar.ts`, `lib/google-meet.ts`)이고, 코드가 요청하는 scope도 R6 검증 시점과
동일하다(`calendar.events`, `meetings.space.settings`, `meetings.space.readonly`) — M1에서 새로
추가한 scope는 없다. 다만 **subject가 `official@alton.education`으로 바뀐 것 자체가 검증
대상**이다 — R6는 `teacher1@alton.education` subject로만 검증했고, `official@alton.education`
subject로 Calendar 이벤트 생성·Meet space PATCH가 동일하게 동작하는지는 아직 실측된 적이
없다(같은 DWD 위임이 이 계정에도 적용되는지 최초 확인 필요).

**실제 확인 결과가 예상과 다를 경우**: 그 자리에서 어떤 추가 Google API도 호출하지 않는다.
이 문서를 갱신하고 제품 오너에게 재보고한 뒤 승인을 다시 받는다.

## 3. Sandbox 객체·호출 상한

- Calendar 이벤트(+Meet): 최대 **2개** — (1) 정상 생성·확인 이메일 발송·동의 토큰 발급까지의
  단건 흐름 1개, (2) 관리자 시간 변경(reschedule) 후 같은 이벤트가 patch되는지 확인용 1개
  (= 위 (1)의 이벤트를 재사용, 신규 이벤트 아님). 순수 신규 이벤트는 **1개**로 제한한다.
- Smart Notes 확인·보정(`ensureMeetSpaceSmartNotesOn`) 호출: 위 이벤트 1개에 대해 최대 2회
  (최초 GET 확인 + 필요 시 PATCH 보정 1회) — R6 15/N이 이미 canonical name PATCH가 403을
  우회함을 확인했으므로, 이번 검증은 주로 "GET 우선 확인이 org 정책 ON을 올바르게 인식하는지"
  에 집중한다.
- 실제 회의(Meet 접속) 없이는 Smart Notes 원본이 생성되지 않으므로, 원본 자동 연결(§6) 검증을
  위해 **최대 1회, 최대 20분 — Smart Notes 생성 확인 시 즉시 종료**한다(R6 15/N 실측에서
  실제 Smart Notes 생성 확인까지 약 19분이 걸렸던 것을 근거로 상한을 재조정했다 — 5분은
  비현실적으로 짧았다). 생성이 확인되면 그 즉시 회의를 끝내고 20분을 채우지 않는다. R6
  15/N이 이미 한 것과 동일한 패턴 —
  실제 상담 내용이 아닌 더미 회의).
- Workspace Events 구독: R6 요청서와 동일하게 최대 1개(재사용/재생성), 검증 직후 삭제.
- 확인 이메일 발송: 최대 **2통**(단건 생성 1통 + reschedule로 인한 재발송 1통, 동일 내용
  재시도로 인한 중복 발송이 없는지도 이 상한 안에서 함께 확인) — 전부 §1의 통제된 테스트
  메일함으로만 발송.

## 4. 검증 절차

1. **§2 scope 재확인** — 문서 대조만, 실제 호출 없음. 결과가 예상과 다르면 여기서 중단.
2. **단건 상담 확정 전체 흐름**: (테스트용 홈페이지 신청 1건 준비) → 관리자 수락 →
   `official@alton.education` subject로 Calendar 이벤트+Meet 생성 실측 확인 →
   `google_sync_status='synced'` 확인 → Smart Notes 확인·보정(`ensureMeetSpaceSmartNotesOn`)
   실측 → `smart_notes_config_status='applied'` 확인 → 확인 이메일이 §1의 테스트 메일함으로
   실제 발송됐는지 확인(제목·절대 URL·동의 토큰 링크 유효성) → 동의 확인 페이지(`/consult/consent?token=...`)
   에서 실제로 동의 확인이 기록되는지 확인.
3. **재처리 멱등성**: 같은 상담에 대해 관리자가 "Calendar 재처리 실행"을 한 번 더 눌러도
   기존 이벤트가 중복 생성되지 않고, 확인 이메일도 중복 발송되지 않는지 확인(§3의 이메일
   상한 안에서).
4. **시간 변경(reschedule)**: 관리자가 시간을 바꾸면 같은 Calendar 이벤트가 patch되고, 새
   확인 이메일이 (이번엔 실제로 내용이 바뀌었으므로) 1통 더 발송되는지 확인.
5. **Smart Notes 원본 자동 연결**: 위 §3의 짧은 합성 회의를 실제로 진행 → Workspace Events가
   실제로 이 웹훅에 도달하는지 → `consultations.google_meeting_code`로 매칭되어
   `smart_notes_drive_file_id`가 채워지는지 → 잠재고객에게 노출되는 어떤 화면에서도 이 값이
   보이지 않는지(관리자 전용 경로로만 노출) 재확인.
6. **readiness 게이트 실측**: 위 상담에 대해 관리자가 "상담 결과 기록"을 시도했을 때, 동의
   확인·Smart Notes 활성화가 둘 다 실제로 완료된 뒤에만 성공하고 그 전에는 서버가 거부하는지
   확인(이 부분은 로컬에서 이미 psql로 검증했지만, 실제 Google 응답을 거친 뒤에도 readiness
   판정이 정확한지 한 번 더 실측).

## 5. 테스트 데이터·정리 순서

- 이 검증에서 만드는 `prospect_contacts`/`consultations` 행은 실제 이메일 주소를 쓰지 않고
  §1의 통제된 테스트 메일함 주소만 사용한다.
- 검증 종료 직후 순서: (1) 생성된 Calendar 이벤트 전부 삭제, (2) Workspace Events 구독
  삭제(재사용했다면), (3) 이 검증용 `consultations`/`prospect_contacts`/`consultation_status_events`/
  `smart_notes_generation_events`/`consult_consent_tokens` 행을 로컬/Sandbox 전용 DB에서
  정리(운영 DB가 아님 — 이 세션 전체가 로컬 dev DB 기준이므로 실제로는 `supabase db reset --local`
  한 번으로 전부 정리됨, 별도 삭제 스크립트 불필요), (4) 임시로 확장한 IAM binding·권한이
  있었다면 제거 후 `get-iam-policy` 재조회로 원복 확인.
- 이 검증 과정에서 켠 모든 임시 플래그(`CALENDAR_SYNC_ALLOW_REAL_CALLS` 등)는 검증 종료
  즉시 원복(false/미설정)한다 — R6와 동일한 원칙.

## 6. 승인 전 확인 사항 요약

- [ ] `official@alton.education` subject로 Calendar/Meet DWD 위임이 실제로 유효한지(§2)
- [ ] 위 §3 객체·호출 상한에 동의
- [ ] §1의 통제된 테스트 이메일 수신자 주소 지정
- [ ] 검증 시각(팀 내부 조율 — 짧은 합성 회의 포함이므로 사람이 직접 참여해야 함)

이 문서는 작성만 완료했고 실제 Google API 호출은 0건이다. Production, 원격 운영 DB, 실사용자
이메일, 실제 외부 쓰기는 이번 세션에서 절대 하지 않았다.
