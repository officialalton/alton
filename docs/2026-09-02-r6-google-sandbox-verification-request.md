# R6 Google Sandbox 외부 검증 승인 요청 (개정 v5, 2026-09-02)

- 상태: **승인 대기 — 아직 실제 Google API를 호출하지 않았다.** 아래 승인을 받기 전까지 이 요청서에 적힌 어떤 실제 외부 호출도 실행하지 않는다.
- 목적: R6에서 mock/fixture로 배선한 FreeBusy·Calendar/Meet 생성(담당 선생님 organizer)·선생님 외부 일정 바쁨 블록 표시·Google 직접 변경 처리(시간 변경 양방향 + 이벤트 삭제 양자택일)·Smart Notes ON/OFF·Workspace Events 구독·Meet 참가 기록 조회가 **실제 Google API**에서도 동작하는지 검증한다. 로컬 Vitest/Playwright는 전부 mock이라 이 검증을 대체하지 못한다.
- **범위를 나누어 부분 실행하지 않는다.** 내부 구현이 전부 끝난 뒤, §2의 scope 확인 절차까지 통과한 다음에만 FreeBusy·Calendar/Meet·외부 일정 표시·직접 변경/삭제 처리·Smart Notes·Workspace Events·참가 기록을 **한 번의 통합 실행으로** 검증한다. 이 원칙에 예외를 두는 문구는 이 문서 어디에도 없다.
- v5 개정 사유(이번 개정, 제품 오너 보정 지시 2건 반영 — 코드 변경 없음, 문서만 정정):
  1. **객체 상한 정정**: §3의 "동시 존재"와 "누적 생성"을 구분하지 않고 "최대 합계"로만 적었던 것을 정정했다. 삭제된 이벤트를 "ALTON 일정 유지(재생성)"로 처리하면 새 Calendar 이벤트+Meet이 추가로 생기므로, 동시 존재 개수와 누적 생성 개수가 다르다. 어떤 기존 예약을 어느 순서로 재사용해 재생성·정식 취소 시나리오를 모두 검증할지도 §3/§7에 명시해 추가 테스트 예약을 만들지 않도록 했다.
  2. **Smart Notes 증적 처리 정정**: Shared Drive로 이동·보존하는 선택지를 삭제했다(파일 이동·ACL은 R8 범위). R6에서는 합성 자료 생성과 세션 연결만 확인하고, 필요한 식별정보(파일 ID 등)만 검증 기록에 남긴 뒤 생성된 합성 Smart Notes 파일은 선생님 Sandbox Drive에서 정리(삭제)하는 것으로 고정했다(§8, §10).

## 1. 사용할 Sandbox 자원(기존 Gate C 자원 재사용 — 신규 생성 없음)

- **Google Cloud 프로젝트**: `alton-integration-sandbox`(운영 프로젝트와 분리, Gate C에서 이미 생성·구성됨)
- **이벤트 소유 계정**: 모든 Calendar 이벤트와 Meet은 **`teacher1@alton.education`의 primary calendar에만** 생성한다(담당 선생님의 회사 계정이 organizer, ALTON 서버가 DWD로 이 계정을 대행). `official@alton.education`은 Smart Notes 생성 검증(§6)의 두 번째 참가자로만 쓰고, 이벤트를 만들거나 주최하지 않는다. `official` 관리자는 어떤 선생님의 개인 Google Calendar도 직접 공유받지 않는다.
- **선생님 개인 캘린더 읽기**: `teacher1@alton.education`의 FreeBusy만 조회한다(§2의 FreeBusy scope 재사용, 신규 scope 아님) — 제목·내용·참석자를 반환하지 않는 API이므로 구조적으로 그 이상을 읽지 않는다.
- **Calendar**: `teacher1@alton.education`의 기본 캘린더(Gate C GW-01~04에서 이미 사용한 것과 동일 계정) — 새 캘린더를 만들지 않는다.
- **Meet**: 위 Calendar 이벤트에 자동 첨부되는 Meet space만 사용(GW-03/07과 동일 방식).
- **기존 Pub/Sub pull 구독**(재사용, 신규 아님): `gate-c-meet-events-sub`(Gate C가 이미 만들어둔 pull 구독) — Smart Notes 생성 이벤트를 이 구독에서 pull한다(§8).
- **신규 Workspace Events 구독**(§3의 상한 대상, 위 pull 구독과는 별개 객체): `teacher1@alton.education`의 Meet space를 리소스로 하는 Workspace Events 구독을 최대 1개 새로 생성한다 — 기존 pull 구독 자체를 재사용하는 게 아니라, 그 구독이 받는 토픽에 새 리소스를 구독 등록하는 것이 신규 행위다.
- 신규로 만들 Google Cloud 자원·서비스 계정·Shared Drive는 없다.

## 2. DWD scope 현황 — 세 범주로 명확히 구분(실제 Admin Console API 호출 없음)

**주의**: 아래 "문서상" 분류는 `docs/2026-08-29-gate-c-sandbox-infra-log.md`(§"등록할 scope")에 남아 있는, Gate C가 등록을 *의도했던* 기록을 코드가 실제로 요청하는 scope와 대조한 것일 뿐이다 — **실제 Admin Console을 조회한 결과가 아니다**(이 세션은 Admin Console에 접근할 수단이 없다). 이 문서의 어떤 표현도 "실제 등록이 확정됐다"는 뜻으로 읽혀서는 안 된다.

Gate C 기록상 등록 대상 scope(전체): `meetings.space.readonly`, `meetings.space.settings`, `drive.meet.readonly`, `documents.readonly`, `drive`, `calendar.events.readonly`, `calendar.events`

| 기능 | 코드가 실제 요청하는 scope | ① 문서상 등록 예상 | ② 문서상 추가 필요 |
|---|---|---|---|
| Calendar 이벤트+Meet 생성·수정·취소, Calendar 직접 변경 증분 조회 | `https://www.googleapis.com/auth/calendar.events` | 예 — Gate C 목록에 있음. (참고: 이전에는 더 넓은 `.../auth/calendar`를 요청해 등록 목록과 불일치했던 코드 버그를 이번에 발견·수정했다) | — |
| FreeBusy 조회(예약 충돌 검사 + 선생님 외부 일정 바쁨 블록 표시 공용) | `https://www.googleapis.com/auth/calendar.events.freebusy`(전용 토큰) | — | **예** — Gate C 목록에는 `calendar.events.readonly`만 있고 이 전용 scope는 없음 |
| Smart Notes 설정 변경(ON/OFF) | `https://www.googleapis.com/auth/meetings.space.settings`(전용 토큰) | 예 | — |
| Meet 참가 기록 조회 | `https://www.googleapis.com/auth/meetings.space.readonly`(전용 토큰) | 예 | — |
| Workspace Events 구독 생성 | 구독 대상 리소스의 기존 scope 재사용(`meetings.space.readonly`) | 예 | — |

**③ Sandbox 시작 전 사람이 Admin Console에서 실제로 확인해야 하는 scope — 위 표의 모든 행(①·② 구분과 무관하게 전부).** "①문서상 등록 예상"이라고 표시된 행도 실제 등록 여부가 확인된 것이 아니다 — 문서 기록과 실제가 다를 가능성은 모든 행에 동일하게 있다.

**실제 확인 결과가 이 표와 다를 경우의 처리 — 반드시 지킬 것**: 어떤 행이든 실제 Admin Console 조회 결과가 위 표(① 또는 ②)와 다르면, **그 자리에서 어떤 Google API도 호출하지 않는다.** 이 문서를 실제 확인된 내용으로 갱신하고(개정 이력 추가), 제품 오너에게 **그 결과만 한 번 재보고**한다. 재보고 후 승인을 다시 받은 뒤에만 §5 이후 절차를 실행한다 — 이 문서 안에서 스스로 판단해 진행 범위를 조정하지 않는다.

## 3. Sandbox 객체·시나리오 상한(동시 존재 vs 누적 생성을 구분)

### 3.1 최초 생성(동시 존재 최대 4개)

- 선생님 FreeBusy 충돌 검증용 합성 외부 일정(**E4**): 최대 **1개**, Meet 없음(단순 바쁨 시간 블록, Sandbox 관리자가 수동 생성) — 이 일정은 §6의 "외부 일정 바쁨 블록 렌더링 검증"에도 그대로 재사용한다(추가 일정 생성 없음).
- ALTON 단건 예약 성공(**E1**): 최대 **1개**
- 동일 예약 재시도·멱등성(idempotency) 검증: **E1을 재사용** — 추가 이벤트 0개
- 주 1회 반복 예약(**E2**, **E3**): 최대 **1개 시리즈, 2회차**
- 이 시점의 **동시 존재 Calendar 이벤트는 최대 4개**(E1+E2+E3+E4), **Meet space는 최대 3개**(E1+E2+E3 — E4는 Meet 없음)

### 3.2 시나리오별 이벤트 재사용 순서(추가 예약을 만들지 않는다)

| 이벤트 | 용도 순서 |
|---|---|
| E1 | ① 단건 생성 확인·멱등성 재시도(§5) → ② Google에서 직접 시간 변경 → **"Google 시간 반영"**으로 확인(§7-1,2) |
| E2 | ① 반복 1회차 생성 확인(§5) → ② Google에서 직접 시간 변경 → **"ALTON 시간 유지"**로 확인(§7-3) |
| E3 | ① 반복 2회차 생성 확인(§5) → ② Google에서 직접 삭제 → **"ALTON 일정 유지(재생성)"** 선택 → 새 Calendar 이벤트+Meet(**E3′**)이 생성됨(§7-4,5) → ③ E3′을 Google에서 다시 직접 삭제 → **"예약 취소"** 선택(정식 `cancelLessonBooking`)로 마무리(§7-6) — 이 마지막 정식 취소가 §5-4의 "최소 1건 정식 취소" 요구도 함께 충족한다. |
| E4 | FreeBusy 충돌 검증(§4) + 외부 일정 바쁨 블록 렌더링 검증(§6) — 두 검증 모두 이 한 이벤트로 수행 |

같은 예약(subject_enrollment/reservation id 기준)이 E3 → E3′로 이어지는 것이며, 이 시나리오를 위해 별도의 신규 테스트 예약을 만들지 않는다.

### 3.3 상한 요약

- **Calendar 이벤트: 동시 존재 최대 4개(E1~E4), 누적 생성 최대 5개**(E1, E2, E3, E4, 그리고 E3 삭제 후 재생성으로 추가되는 E3′)
- **Meet space: 누적 최대 4개**(E1, E2, E3, E3′ — E4는 Meet 없음)
- **신규 Workspace Events 구독: 최대 1개**(§1에서 명시한 대로 기존 pull 구독과는 별개 객체, resource data 제외, GW-07과 동일하게 7일 만료)

모든 ALTON 이벤트는 `teacher1@alton.education`의 primary calendar에만 생성한다. 학생·보호자 이메일은 attendees에 넣지 않고 `sendUpdates=none`을 사용한다. 실제 이메일·메시지 발송은 하지 않는다.

## 4. FreeBusy 충돌 검증 절차

1. `teacher1@alton.education`의 primary calendar에 합성 외부 일정(**E4**) 1개를 **수동으로**(Sandbox 관리자가 직접, 코드로 만들지 않음) 생성한다 — 제목은 "SANDBOX TEST — 삭제 예정", Meet 없음.
2. 그 시간대와 겹치는 슬롯으로 ALTON 예약을 시도해 `checkTeacherFreeBusyBeforeBooking()`이 실제로 `conflict:true`를 반환하는지 확인한다.

## 5. Calendar·Meet 생성/취소 검증 절차

1. 단건 예약 1건(**E1**) 생성 → `teacher1@alton.education`의 캘린더에 실제로 이벤트+고유 Meet 링크가 생기는지, organizer가 `teacher1@alton.education`인지, attendees가 비어 있는지, `extendedProperties.private.altonReservationId`가 실제로 저장되는지 확인.
2. E1로 재시도(동일 idempotency key) — 새 Calendar 이벤트·Meet가 중복 생성되지 않는지 확인.
3. 주 1회 반복 예약 1시리즈 2회차(**E2**, **E3**) 생성 → 각 회차마다 별도 이벤트가 생기는지 확인.
4. 정식 취소 경로(`cancelLessonBooking`)로 Calendar 이벤트가 실제로 삭제되는지의 확인은 §7-6에서 E3′을 대상으로 수행한다(이 절차를 위한 별도 취소는 여기서 하지 않는다).

## 6. 선생님 외부 일정 바쁨 블록 렌더링 검증(신규, v4)

1. §4에서 만든 합성 외부 일정(**E4**)이 있는 상태에서, `teacher1@alton.education`으로 로그인해 "정규수업" 탭(주간/월간)과 "가능시간" 탭(월간 달력)을 연다.
2. 그 날짜에 밑줄 표시("외부 일정 있음")가 실제로 나타나는지, 날짜를 클릭했을 때 "외부 일정(예약 불가)" 목록에 시작~종료 시간만(제목·설명·참석자 없이) 표시되는지 확인.
3. 같은 화면을 보호자·학생·다른 선생님 계정으로는 접근할 수 없음을 코드 경로로 재확인(이 액션들은 `requireUser()`로 본인 확인 후 본인 `workspace_email`만 사용 — 다른 계정이 호출할 방법 자체가 없음, 별도 화면 없음).

## 7. Google 직접 변경(시간 변경 양방향 + 이벤트 삭제 양자택일) 검증 절차

§3.2의 재사용 순서를 그대로 따른다 — 이 절차를 위해 신규 예약을 만들지 않는다.

1. **E1**을 Google Calendar에서 **직접 시간 변경** → `reconcileTeacherCalendarChanges()`(증분 조회) 실행 후 ALTON 관리자 화면(BookingReconciliationPanel의 "Google 외부 변경 감지" 섹션)에 `time_changed`/"관리자 확인 필요"로 뜨는지 확인 — 이 시점까지 예약·세션·수업권 hold는 자동으로 바뀌지 않아야 한다.
2. E1에 **"Google 시간 반영"** 버튼 → `reschedule_reservation_to_google_time()`이 가용성·버퍼·중복예약·수업권을 재검증한 뒤 ALTON DB가 Google의 새 시간으로 실제로 갱신되는지, `reservation_reschedules`에 감사 이력이 남는지 확인.
3. **E2**를 Google에서 직접 시간 변경한 뒤 **"ALTON 시간 유지"** 버튼 → `patchCalendarEventTime()`이 실제로 Google 이벤트를 ALTON 기준 시간으로 되돌리는지, 감사 이력이 남는지 확인.
4. **E3**을 Google Calendar에서 **직접 삭제** → 사이트에 `deleted`/"관리자 확인 필요"로만 뜨고 예약·세션·수업권 hold가 자동으로 취소·재생성되지 않는지 확인. 이 상태에서는 "무시" 버튼 자체가 UI에 없다.
5. E3에 **"ALTON 일정 유지(재생성)"** 버튼 → 예약·세션·수업권 hold는 그대로 두고 담당 선생님(`teacher1@alton.education`) 소유로 Calendar 이벤트+Meet이 실제로 새로 생성되는지(**E3′**), `reservation_reschedules`에 `google_event_deleted_recreated`로 감사 이력이 남는지 확인.
6. 이어서 **E3′**을 Google Calendar에서 다시 **직접 삭제** → 같은 예약이 다시 `deleted`/"관리자 확인 필요"로 뜨는지 확인한 뒤, 이번엔 **"예약 취소"** 버튼 → 정식 취소 절차(`cancelLessonBooking`, 회사 귀책)가 실행돼 수업권 release/30일 연장, 알림 outbox 기록, `external_change_status` 정리가 함께 되는지 확인(§5-4의 "최소 1건 정식 취소" 요구를 이 단계가 충족한다).

## 8. Smart Notes·참가 기록 검증

사전 조건(Admin Console, Sandbox 관리자가 직접 확인):
- 영상·원본 음성 녹화 **OFF**
- 별도 Meet `Transcribe the meeting` **OFF**

검증 시나리오(정확히 이 2가지만, Gate C의 기술 실험을 반복하지 않는다):
1. **Smart Notes ON 세션**: E1(§7-2에서 시간이 이미 확정된 상태) 또는 E2의 세션 중 하나(`sessions.smart_notes_status`가 `pending`/opt-out 안 함 상태)에서, `teacher1@alton.education`과 `official@alton.education` 단 둘이서만 그 Meet 링크로 접속한다. **회의 길이는 실패 방지를 위해 최대 15분으로 제한한다** — 그 안에 생성되지 않으면 실패로 기록하고 재시도하지 않는다. 합성 테스트 대화만 사용, 실제 학생 정보나 업무 내용은 사용하지 않는다. Smart Notes 문서가 실제로 생성되는지, Workspace Events(§9)로 생성 이벤트가 수신되는지, `smart_notes_generation_events`에 적재되고 `sessions.smart_notes_drive_file_id`가 연결되는지 확인한다.
2. **보호자 opt-out 세션**: 다른 세션 하나를 `sessions.smart_notes_status = 'disabled_by_guardian'`로 만든 뒤, Calendar 동기화가 실제로 `setMeetSpaceSmartNotesConfig({enabled:false})`를 호출해 Meet space 설정이 꺼졌는지 재조회해 확인한다(실제 회의 불필요).

**Smart Notes 증적 처리(정정, v5)**: 생성된 Smart Notes 문서를 Shared Drive로 이동하거나 보존하지 않는다(파일 이동·ACL 부여는 R8 범위 — 이번에 앞당겨 하지 않는다). 검증 기록에는 결과 확인에 필요한 최소 식별정보(파일 ID, `smart_notes_generation_events` 행 ID, 생성 시각)만 이 문서의 개정 이력에 남긴다. 파일 본체는 §10의 정리 절차에서 `teacher1@alton.education`의 Sandbox Drive에서 삭제한다.

참가 기록: 위 1번 회의에서 `listConferenceParticipantEvents()`로 참가자 기록을 실제로 조회해 `session_access_events`에 `source:"google_meet_api"`로 삽입되는지 확인한다. 이 기록만으로 출석·수업권·정산을 자동 확정하지 않는다(R7 범위).

## 9. Workspace Events 수신 검증 방식(pull 전용 — ngrok/push/Production endpoint 사용 안 함)

이번 Sandbox 검증에서는 임시 공개 터널(ngrok 등), Production endpoint, Preview push endpoint를 **사용하지 않는다**. 대신:

1. **기존** Sandbox Pub/Sub pull 구독(`gate-c-meet-events-sub`)에서 실제 Workspace Events 메시지를 로컬 스크립트로 pull한다 — 이 구독 자체는 재사용(신규 생성 아님).
2. 이번 검증 대상 Meet space(§1의 "신규 Workspace Events 구독")를 그 토픽의 리소스로 추가 등록 — 이 리소스 등록이 §3의 "신규 Workspace Events 구독 최대 1개"에 해당하는 신규 행위.
3. pull한 메시지를 `app/api/webhooks/workspace-events/route.ts`가 쓰는 것과 **동일한 내부 파서/처리기**에 그대로 전달해 처리한다 — push route 자체를 실행하지 않는다.
4. Smart Notes·참가 기록의 세션 연결이 정상 동작하는지 이 경로로 확인한다.
5. Google Calendar 직접 변경 감지(`reconcileTeacherCalendarChanges()`)도 실제 Calendar 증분 조회(`listCalendarEventsIncremental()`)로 확인한다 — pull(목록 조회) 방식이라 별도 endpoint가 필요 없다.
6. **실제 Pub/Sub push→배포된 endpoint 전달 검증은 이번 범위가 아니다 — R13 Production 준비 체크리스트로 이관한다.**

## 10. 정리(cleanup) 범위 — 검증 종료 즉시 수행

1. 생성한 Calendar 이벤트를 **누적 생성분 전부(최대 5개: E1, E2, E3, E4, E3′)** 삭제 확인 — E3/E3′은 §7 절차 자체에서 이미 삭제·취소되므로 남는 것은 실질적으로 E1, E2, E4뿐이다. 남은 것은 `cancelLessonBooking` 경로로 지워지지 않았다면 Calendar API로 직접 삭제한다(E4 포함).
2. §1/§3/§9의 **신규 Workspace Events 구독**(최대 1개)을 명시적으로 취소 — 기존 `gate-c-meet-events-sub` pull 구독은 건드리지 않는다.
3. 이 검증으로 생긴 모든 테스트 예약·세션은 정상 테스트 데이터 정리 절차로 처리한다(로컬 dev DB 한정 — `supabase db reset --local`로 자동 정리, 리모트 dev DB에는 애초에 반영하지 않는다. 이 검증은 로컬(`npm run dev`)에서만 수행).
4. **Smart Notes 합성 파일 삭제(정정, v5)**: §8에서 생성된 Smart Notes 문서를 `teacher1@alton.education`의 Sandbox Drive에서 삭제한다 — Shared Drive로 이동·보존하지 않는다. 삭제 전 필요한 식별정보(파일 ID 등)만 이 문서의 개정 이력에 기록해두고 삭제를 진행한다.
5. `CALENDAR_SYNC_ALLOW_REAL_CALLS`와 모든 Workspace 관련 플래그(`WORKSPACE_PROVISIONING_ALLOW_REAL_CALLS`/`WORKSPACE_PREFLIGHT_ALLOW_REAL_READS`/`WORKSPACE_EVENTS_PUSH_*`)를 다시 미설정 또는 명시적 `false`로 복원.
6. `.env.local`의 Sandbox 전용 값을 제거하고 `git status`로 미커밋 상태 확인.

## 11. 비용

이 규모(Calendar 이벤트 누적 최대 5개, Meet space 누적 최대 4개, 신규 Workspace Events 구독 1개, 15분 이내 회의 1회, FreeBusy 조회 다수)에서는 **추가 과금이 발생하지 않는다** — 전부 Gate C에서 이미 사용 중인 무료/포함 한도 내 API이고, 신규 유료 라이선스·구독을 만들지 않는다.

**중단 조건**: 검증 도중 예상치 못한 과금 안내, 라이선스 업그레이드 요구, §2의 실제 확인 결과가 문서와 다름, 또는 §3의 객체 상한을 초과해야만 다음 단계를 진행할 수 있는 상황이 발생하면 즉시 중단하고 제품 오너에게 보고한다.

## 12. 구현 완료 범위(이 승인의 배경 — 코드는 이미 준비됨, 실제 호출만 안 한 상태)

- 학생·보호자 예약: 월간 캘린더 날짜 선택기 + 선택일 시간 패널, 빠른 추천 시간, 요약 확인 후 최종 확정(반복은 생성 시도 날짜 최대 8개 미리 표시). 보호자는 자녀별로 재사용.
- 선생님 일정: "정규수업" 탭(금주 목록/주간/월간, 확정 수업+휴무/임시 오픈), "가능시간" 탭(월간 캘린더 기본, 반복 템플릿+날짜별 예외+기간 휴무+지난달 복사). **선생님 외부 일정 바쁨 블록**을 두 탭 모두에서 실제로 렌더링(제목·내용 없이 밑줄+칩, 본인만 조회 가능) — mock 테스트 완료, 실제 렌더링은 §6에서 검증.
- 관리자 통합 일정: "통합 일정" 탭(오늘/주간/월간 + 필터, ALTON DB 중앙 조회, `official` 계정에 개별 Google Calendar 미공유).
- Google 직접 변경 — 시간 변경: "ALTON 시간 유지"/"Google 시간 반영" 둘 다 실제 재검증·복원 로직 연결, `reservation_reschedules` 감사 이력.
- Google 직접 변경 — 이벤트 삭제: "무시" 불가, "ALTON 일정 유지(재생성)"(Calendar 이벤트+Meet 재생성)와 "예약 취소"(정식 취소 절차) 둘 다 실제 연결, 감사 이력 기록.

전부 mock 유닛 테스트로 검증 완료(`lib/booking/external-busy.test.ts`, `lib/booking/external-change-resolution.test.ts`, `app/teacher/TeacherLessonScheduleTab.test.tsx`, `app/admin/BookingReconciliationPanel.test.tsx` 등).

## 13. 이 승인 요청에 포함된, 한 번에 분리해 표시하는 외부 변경 목록

| # | 외부 변경 | 필요 여부 | 비고 |
|---|---|---|---|
| 1 | DWD에 `calendar.events.freebusy` scope 추가 | §2 실제 확인 결과에 따라 결정 | 문서상으로는 필요해 보이나, 실제 확인 전에는 확정으로 표현하지 않는다(§2). |
| 2 | 선생님(`teacher1@alton.education`) Sandbox Calendar·Meet 생성·수정·삭제(직접 변경/삭제/재생성 시나리오 포함) | **필요**(§3 상한 내) | Calendar 이벤트 누적 최대 5개(E1~E4, E3′), Meet space 누적 최대 4개, 실제 API 호출 + Sandbox 관리자의 수동 시간 변경·삭제 조작. |
| 3 | 신규 Workspace Events 구독 생성·취소(기존 pull 구독과 별개) | **필요**(§3 상한 내) | 최대 1개, 7일 만료 또는 명시적 취소. |
| 4 | 실제 합성 Meet 1회(최대 15분, `teacher1@alton.education`+`official@alton.education`만 참여) | **필요** | §8 참고, 합성 테스트 대화만, 실제 학생 정보·업무 내용 미사용. |
| 5 | 선생님 FreeBusy 실제 조회(외부 일정 바쁨 블록 렌더링용) | **필요** | §6 참고, 제목·내용·참석자 없음(API 구조상 불가능). |
| 6 | Smart Notes 합성 파일 생성 및 삭제 | **필요**(§3 상한 내, 보존 아님) | §8/§10 참고 — Shared Drive 이동·보존 없음. 식별정보만 기록 후 Sandbox Drive에서 삭제. |
| 7 | 추가 비용 | **0원 예상**(§11) | 예상을 벗어나면 즉시 중단. |
| 8 | 전체 플래그 복원 절차 | 검증 종료 즉시 수행(§10-5, 10-6) | — |

**이 승인 범위에 포함되지 않는 것**(별도 blocker로만 보고):
- IAM/도메인 전체 위임(DWD) 신규 설정, Admin Console 조직 설정 변경(§13-#1을 제외한 나머지는 전부 Gate C에서 이미 완료된 값을 그대로 사용)
- 유료 라이선스 추가 발급
- Production 환경변수/배포/Google 설정 변경
- Stripe Production 웹훅 등록

## 14. 실행 순서(승인 후 — scope 확인 → 한 번의 통합 실행 → 종료)

1. **scope 실제 확인(§2)**: 사람이 Admin Console → 보안 → API 제어 → 도메인 전체 위임에서 서비스 계정의 클라이언트 ID에 실제로 등록된 scope 목록을 확인한다. 이 표(§2)와 다르면 **이 시점에서 중단** — 어떤 API도 호출하지 않고 문서를 갱신해 재보고, 승인을 다시 받는다. 일치하면(또는 §13-#1의 추가 등록이 완료되면) 다음 단계로 진행한다.
2. **로컬 dev 서버 기동** — Production/원격 dev 배포는 건드리지 않는다. 로컬(`npm run dev`)에서만 수행.
3. `CALENDAR_SYNC_ALLOW_REAL_CALLS=true`로 전환 → §5(Calendar/Meet 생성·취소) → §4(FreeBusy) → §6(외부 일정 바쁨 블록 렌더링) → §7(직접 변경 시간·삭제 양방향 처리) → §8(Smart Notes·참가 기록) → §9(Workspace Events pull) 순서로 **한 번에** 실행한다.
4. 검증 결과(Smart Notes 파일 식별정보 포함)를 이 문서에 개정 이력(v6)으로 기록.
5. **즉시 전부 원복**: §10의 정리 절차 전체 수행.
6. 원복 후 `git status`/`.env.local` 재확인으로 플래그가 실제로 꺼졌는지 육안 재확인 — 이 결과를 최종 보고의 "외부 변경" 항목에 기록.
