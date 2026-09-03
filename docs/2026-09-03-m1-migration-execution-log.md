# M1 — 상담 기반 재설계 실행 로그 (2026-09-03)

`docs/2026-08-29-master-roadmap-v3.md` "근접 실행계획" M1 절의 1차 구현 실행 기록. 전체
요구사항 원문은 로드맵 문서에 있고, 여기서는 실제로 무엇을 어떻게 구현·검증했는지만 기록한다.

## 0. 범위 확인

M0(R6 최종 마감)은 이미 완료 상태였다. 이번 세션은 M1만 진행했고 M2(R4 후속 수업권)·M3(R5
후속 배정)·M4(전환 통합)는 착수하지 않았다 — `outcome` 컬럼 등 연결 지점만 준비했다.

## 1. 기존 구조 조사

- `consult_requests`(20260827120000, 레거시 v1) — Calendly 흔적 포함, 홈페이지 `ConsultForm`이
  직접 쓰던 테이블.
- `consultations`(20260912000000, R3 v3) — household/child 연결·정규화 이메일/전화 컬럼 보유,
  관리자 `ConsultationTab.tsx`가 운용하던 테이블. `v3_consultation_status` enum은
  `requested/scheduled/completed/trial_planned/trial_completed/proposed/contracted/converted/closed`
  + 후속 마이그레이션(20260914000000)에서 추가된 `cancelled`/`no_show`.
- R6 예약 인프라: `lib/booking/create-booking.ts`(`confirmLessonBooking()`), `lib/booking/
  calendar-sync.ts`(`syncOneReservationCalendarEvent()`, 낙관적 잠금 클레임 패턴),
  `lib/google-calendar.ts`(`createCalendarEventWithMeet()`/`patchCalendarEventTime()`/
  `deleteCalendarEvent()`, `CALENDAR_SYNC_ALLOW_REAL_CALLS` 안전 게이트), `lib/google-meet.ts`
  (`enableMeetSpaceSmartNotes()`), `lib/google-workspace-auth.ts`(subject별 access token 발급
  함수 — `getCalendarApiAccessToken(subjectEmail)` 등).
- R2 `account_status_events` 불변 감사 이력 패턴(INSERT-only 트리거 + anon/authenticated/
  service_role 전체 EXECUTE revoke)을 그대로 재사용해 `consultation_status_events`를 만들었다.

## 2. 설계 판단(사용자 확정 지시에 따라 기술 선택은 개발자 자체 판단으로 결정)

1. **레거시 `consult_requests`는 계속 동결 보존**한다(rename/삭제하지 않음, R3와 동일 방침).
   홈페이지 신청은 `consultations`(+ 신규 `prospect_contacts`)에 직접 쓴다. 이렇게 "두 개의
   정상 경로" 문제를 해소했다.
2. **공용 상담 가능시간은 상담 전용 신규 테이블**(`consult_availability_rules`/
   `consult_availability_exceptions`)로 만들었다. R6 `teacher_availability_rules`와 패턴은
   같지만 특정 담당자(teacher_id)에 귀속되지 않는 공용 자원이라는 점이 다르다 — 향후 기존
   보호자·학생·선생님 상담에도 그대로 재사용 가능한 구조.
3. **hold 만료는 30분**으로 채택했다(하드코딩 상수가 아니라 신청마다 `hold_expires_at`
   컬럼값으로 저장 — 운영 데이터로 조정 가능). 근거: 관리자가 신청을 확인할 최소 시간을
   주면서도 다른 신청자를 과도하게 막지 않는 절충값. 공식 SLA 문서가 없어 개발자 판단으로
   결정했다.
4. **중복 슬롯 방지는 이중 방어**로 구현했다. Postgres 배타 제약(exclusion constraint)의
   `WHERE` 절은 IMMUTABLE 함수만 허용해 `now()` 기준 hold 만료를 인덱스 조건에 넣을 수
   없다(실제로 마이그레이션 적용 중 `functions in index predicate must be marked IMMUTABLE`
   에러로 발견) — 그래서 (a) 확정(`status='scheduled'`) 상담끼리의 겹침은 `tstzrange` 배타
   제약으로 하드 차단하고, (b) 아직 hold 중인 `requested` 건끼리·hold-확정 간 겹침은
   `submit_homepage_consult_request()` 함수 내부의 명시적 `SELECT ... FOR UPDATE`로
   트랜잭션 안에서 직렬화한다.
5. **prospect_contacts는 신청마다 새로 생성**하고 이메일 일치로 재사용하지 않는다(요구사항 5
   — 자동 병합 금지). 같은 사람의 재신청 통합은 향후 관리자 확인 절차(기존 R3
   `find_possible_duplicate_consultations()`와 유사한 패턴)로만 하며, 이번 범위에서는
   prospect 레벨 중복 탐지 UI까지 만들지 않았다.
6. **Calendar/Meet 소유는 `official@alton.education`**(env var `CONSULT_ORGANIZER_EMAIL`로
   재정의 가능, 기본값). R6 DWD 인증 체인·Calendar API 클라이언트를 그대로 재사용하되
   subject만 바꿨다 — 새 인증 경로를 만들지 않았다.
7. **동의 문구는 임의로 확정하지 않았다.** `consult_consent_versions` 버전형 테이블에
   `is_placeholder=true`인 1개 행만 삽입했고, 본문은 "이 문구는 실제 법률 문안이 아닙니다"로
   명시했다. `/consult/[id]/consent` 화면도 placeholder일 때 상단에 경고 배너를 띄운다.

## 3. 구현 파일

- `supabase/migrations/20261009000000_m1_consultation_unification.sql` — 스키마 전체(위 참고).
- `lib/consultation/calendar-sync.ts` — 상담 확정 시 Calendar/Meet 생성·재시도, Smart Notes
  best-effort 연결, 확정 이메일 발송.
- `app/consult-actions.ts` — 홈페이지 신청·슬롯 조회·동의 확인(재작성, 레거시
  `submitConsultRequest`는 `submitHomepageConsultRequest`로 교체).
- `app/admin/consultation-scheduling-actions.ts` — 관리자 수락/거절/시간변경/취소/결과기록,
  공용 가능시간 CRUD.
- `app/admin/ConsultationSchedulingPanel.tsx` — 관리자 "상담 운영" 탭(신규 sub-tab, 기존
  `ConsultationTab.tsx`에 추가).
- `app/ConsultForm.tsx` — 슬롯 선택 UI 추가(기존 학생이름/거주지역 필드는 신규 스키마에
  대응 컬럼이 없어 제거 — concerns 자유 텍스트로 흡수 가능).
- `app/consult/[id]/consent/page.tsx` + `ConsentConfirmButton.tsx` — 동의 확인 화면(1회성,
  반복 체크 없음, 이미 확인했으면 재확인 버튼 자체를 숨김).
- `e2e/m1-consultation-flow.spec.ts` — 신규 실브라우저 E2E.
- `app/ConsultForm.test.tsx` — 신규 슬롯 선택 흐름에 맞게 재작성.

## 4. 실제 발견·수정한 버그

1. **`list_open_consult_slots()`가 슬롯을 하루에 하나만 만들던 버그.** 최초 구현은 규칙의
   `start_time`에만 슬롯을 만들어 "09:00~18:00 가능"이라고 등록해도 09:00 슬롯 하나만
   나왔다. `generate_series`로 `start_time~end_time` 창 전체에 60분 간격 슬롯을 펼치도록
   수정 — 로컬 psql로 "18개 슬롯(2일 × 9슬롯)" 나오는지 직접 확인했다.
2. **겹치는 가용시간 규칙이 있으면 슬롯이 중복 반환되던 버그.** 실브라우저 E2E 실행 중 브라우저
   콘솔에서 React key 중복 경고(`Encountered two children with the same key`)로 발견 — 최종
   SELECT에 `DISTINCT`를 추가해 해결.
3. **마이그레이션 문법 오류 2건**(적용 과정에서 발견, 즉시 수정): `E'...'` 다중행 문자열
   연결이 Postgres 파서 에러를 내 `||` 연결로 교체, 기존 R3 `cancelled_at`/`cancellation_reason`
   컬럼과 신규 컬럼명이 충돌해 `column already exists` 에러 — 기존 컬럼을 재사용하도록 수정.
4. **status 값 관례 불일치.** 초안은 관리자 거절/취소 시 `status='closed'`로 뒀는데, 기존 R3
   `cancelConsultation()`은 `status='cancelled'`를 쓰고 있었다(`closed`는 "파이프라인
   조기종료"라는 다른 의미로 이미 쓰이고 있었음, product-architecture 문서 참고). 기존 관례에
   맞춰 `cancelled`로 통일하고, `closed`는 `outcome`(상담 결과) enum에서만 쓰도록 정리했다.

## 5. 검증

- `npx supabase db reset --local` — 전체 마이그레이션(M1 포함) 로컬 반영 성공.
- psql 직접 스모크 테스트: `submit_homepage_consult_request()` 정상 생성, 동일 슬롯 재신청
  거부 확인, `admin_accept_consultation()`(관리자 세션 시뮬레이션) 정상 전이,
  `admin_record_consultation_outcome()` 정상 기록.
- `npx tsc --noEmit` — 클린.
- `npx vitest run` — 전체 134개 파일 811건 통과(신규 M1 코드 포함, 회귀 없음).
- `npx playwright test e2e/m1-consultation-flow.spec.ts --workers=1` — 통과. 홈페이지에서
  이름·이메일·슬롯 선택·동의 체크 후 신청 → DB에서 `status='requested'` 확인 → 관리자
  로그인 후 "상담 운영" 탭에서 수락 클릭 → 승인 대기 0건으로 갱신 → DB에서
  `status='scheduled'` 확인 → `google_sync_status`가 `pending`/`failed`/`reconciliation_needed`
  중 하나로 남아있음(=예약 확정 자체는 Google 연동 실패와 무관하게 절대 막히지 않음)을 확인.
  로그에 `CALENDAR_SYNC_ALLOW_REAL_CALLS=true가 아니면 실제 Calendar API를 호출하지 않습니다`
  메시지가 찍혀 실제로 mock/미설정 상태로 동작했음을 확인했다.

## 6. 미완료(다음 세션 이관)

- 기존 로그인 보호자·학생·선생님이 보내는 상담 요청 유형 UI/구분 — `source` enum만 준비.
- Smart Notes 원본 생성 이벤트 → `consultations` 자동 연결 webhook(R6
  `smart_notes_generation_events`와 동일 패턴) — 컬럼만 준비, 관리자가 수동으로
  `admin_review_summary`를 남기는 경로만 있음.
- `prospect_contacts.converted_guardian_id` 실제 연결 로직(M4 범위).
- 실제 Google Sandbox 검증(R6 15/N과 동일한 패턴의 별도 승인 요청 필요) — 이번 세션은 코드/
  mock 검증까지만 완료, Sandbox 요청서 자체도 아직 작성하지 않았다.
- 동의 법률 문구 최종본 — 별도 계약 문서 세션 확정 대기(placeholder 유지).

## 7. 외부 변경·플래그 상태

- Google/Stripe/DocuSign 실제 API 호출: 0건.
- Production/원격 dev Supabase 접근: 0건(로컬 전용).
- 실제 이메일 발송: 0건(SMTP 미설정 로컬 환경, `lib/email.ts`가 자동 no-op).
- `CALENDAR_SYNC_ALLOW_REAL_CALLS` 등 모든 외부 플래그: 세션 시작 시 상태(false/미설정) 그대로
  유지, 이번 세션에서 한 번도 변경하지 않음.
- `git push`: 하지 않음(로컬 커밋만, 사용자 확인 후 별도 push).

## 8. 2026-09-03 보완(제품 오너 M1 미승인, 9개 항목 지시 반영)

M1은 커밋했지만 **아직 승인되지 않은 상태**에서, 제품 오너가 저장소 무결성·정책·보안 문제
9가지를 지적해 같은 세션에서 보완했다. 커밋은 `6f978db`(1차)를 재작성하지 않고
`d8862bb`(R6 잔여 반영)·`1feb800`(M1 보완) 신규 커밋으로 이어붙였다.

1. **저장소 무결성**: `6f978db`가 당시 미커밋 R6 파일(`lib/google-meet.ts` 등 90여 개)에
   의존해 단독 체크아웃으로는 빌드가 안 되던 문제 발견 — R6 잔여 변경을 M1과 분리해
   `d8862bb`로 별도 커밋(파일 목록은 커밋 메시지 참고). 출처가 불명확한 사용자 소유 변경
   (`.env.example`/`AGENTS.md`/`CLAUDE.md`/`README.md`/`docs/contracts/*`/`docs/prompts/*`/
   `docs/superpowers/*`/`docs/tickets.md`/`docs/spec/*`/`docs/README.md`)은 손대지 않고
   그대로 두었다. 이후 별도 `git worktree`(커밋된 파일만 존재)에서 `next build`+전체
   Vitest를 재실행해 실제로 통과함을 확인.
2. **hold 정책**: 30분 자동 만료 제거, `requested`는 관리자 처리 전까지 배타 제약으로
   하드 점유. 동일 이메일 중복 대기 신청 방지 추가.
3. **Smart Notes 필수 흐름**: `ensureMeetSpaceSmartNotesOn()`(GET 먼저, org 정책이 이미
   ON이면 추가 쓰기 없음, 아닐 때만 canonical PATCH) 추가. 확인·보정 실패는 이메일을 막지
   않되, `admin_record_consultation_outcome()`이 서버에서 "동의 확인+Smart Notes 활성화
   확인" 둘 다 없으면 완료 처리를 거부(readiness 게이트). 관리자 화면에 readiness 상태와
   수동 재처리 버튼 추가.
4. **Smart Notes 원본 자동 연결**: 새 웹훅 없이 기존 R6 Workspace Events 웹훅의 매칭
   대상을 상담까지 넓힘 — `consultations.google_meeting_code` 추가, `smart_notes_generation_events.
   consultation_id`/`pubsub_message_id`(멱등) 추가. 매칭 실패는 유실 없이 보존.
5. **동의 링크·확인 기록**: 상담 UUID 대신 만료형 해시 토큰(`consult_consent_tokens`, 원문
   미저장)으로만 동의 페이지 접근 — `/consult/[id]/consent` → `/consult/consent?token=...`.
   `issue_consult_consent_token()`/`resolve_consult_consent_token()`/
   `confirm_consult_consent_by_token()` 세 함수로 발급·조회·소비(멱등) 분리.
6. **이메일 신뢰성**: `currentRequestOrigin()` 기반 절대 URL로 수정(기존 상대경로 버그).
   `confirmation_email_content_hash`로 동일 내용 재발송 방지, 시간 변경 시에는 새로 발송.
7. **문서 상태 정정**: 이 로그와 `docs/CURRENT.md`/`master-roadmap-v3.md`를 실제 구현 상태에
   맞게 갱신(위 4번 항목을 "완료 안 됨"에서 "실제 자동 연결 완료"로 정정 등).
8. **검증**: 로컬 psql 직접 호출로 hold 무기한 점유·동일 이메일 제한·readiness 게이트 차단·
   토큰 발급/소비 멱등·해시 저장(평문 미저장)을 실측 확인. 신규 유닛 테스트
   (`lib/consultation/calendar-sync.test.ts` 3건, `workspace-events/route.test.ts` 신규 3건)
   추가. 전체 Vitest 817건, `tsc --noEmit`, `next build` 클린, 전체 Playwright 52건
   (`--workers=1`, 기존 R2~R6 스펙 전부 포함) 통과 — 로컬 작업트리와 별도 clean worktree
   양쪽에서 재확인.
9. **외부 검증 요청서**: `docs/2026-09-03-m1-google-sandbox-verification-request.md`(v1) 작성
   완료 — official 계정 Calendar+Meet+Smart Notes 통합 검증, 객체·호출 상한, DWD scope,
   통제된 이메일 수신자, 테스트 데이터 정리 순서, 임시 권한·플래그 복원 방법 포함. 실제
   Google API 호출은 0건, 모든 플래그 false 유지 — **승인 대기 상태**(아래 §9 최종 보완에서
   합성 회의 시간 상한을 "최대 20분, Smart Notes 생성 확인 시 즉시 종료"로 재조정).

## 9. 2026-09-03 조건부 승인 최종 보완(4개 항목)

제품 오너가 8절의 보완을 확인하고 **M1을 조건부 승인**하면서 마지막 4가지를 추가 지시했다.
같은 세션에서 전부 반영·검증했다(push/실제 Sandbox 호출은 계속 금지, M2 미착수).

1. **상담 진행 readiness와 상담 완료 readiness 분리**: 기존 단일 `readiness` 필드를
   `consultReadiness`(동의 확인 + Smart Notes ON)와 `completionReadiness`(그 위에 원본
   자동 연결 + 비어있지 않은 검토 요약)로 분리(`app/admin/consultation-scheduling-actions.ts`
   의 `computeConsultReadiness()`/`computeCompletionReadiness()`).
2. **`admin_record_consultation_outcome()` 4개 조건 전부 강제**: `consent_confirmed_at` 존재,
   `smart_notes_config_status='applied'`, `smart_notes_drive_file_id` 존재,
   `admin_review_summary`가 공백이 아닌 값 — 넷 중 하나라도 없으면 `completed` 전이·outcome
   기록을 전부 거부(부분 허용 없음). 로컬 psql로 4가지 실패 케이스(동의 없음/Smart Notes
   미활성/원본 미연결/요약 공백)와 성공 케이스를 각각 실측 확인.
3. **관리자 화면 구분 표시**: `ConsultationSchedulingPanel.tsx`에 "상담 진행 준비"/"상담 완료
   준비" 문구를 별도 라인으로 표시, 완료 불가 사유별 안내. Smart Notes 원본 매칭 실패
   ("완료 불가 — Smart Notes 원본이 아직 자동 연결되지 않음")일 때는 "상담 결과 기록" 버튼을
   비활성화하고 "Smart Notes 재처리" 버튼만 노출 — 고객에게 원본을 노출하는 경로는 여전히
   없음(관리자 전용 컬럼 select만 존재).
4. **재처리 경로 신규 구현**: `reprocessUnlinkedSmartNotesEvents()`(`lib/consultation/
   calendar-sync.ts`) — 매칭 실패로 `linked=false`로 남은 이벤트를 다시 매칭 시도(대개
   웹훅이 상담의 `google_meeting_code` 저장 전에 먼저 도착하는 레이스가 원인). 관리자 화면
   "Smart Notes 미매칭 재처리" 버튼으로 실행. 신규 테스트 2건(재매칭 성공/여전히 미매칭)
   추가.
5. **테스트**: 성공(psql 실측, DB 레벨 4조건 전부 충족), 원본 미연결(psql 실측 + 재처리
   테스트), 요약 누락(psql 실측, 공백 문자열 포함), 중복 Workspace Event(기존 dedup 테스트
   재확인), 매칭 실패 후 재처리(신규 vitest 2건) — 각각 별도로 검증.
6. **문서 정리**: 마스터 로드맵 M1 절의 "Smart Notes 원본 연결은 이번 범위에서 만들지 않음"
   문구 제거, `CURRENT.md`의 "요청서 작성 예정"을 "작성 완료·승인 대기"로 정정, 이 실행
   로그(8절)의 "요청서 미작성" 문구 정정, `docs/CURRENT.md` M1 절 제목을 "조건부 승인, push
   대기"로 갱신.
7. **Sandbox 요청서 합성 회의 상한**: R6 15/N 실측(Smart Notes 생성 확인까지 약 19분)을
   근거로 "최대 5분"이 비현실적이었음을 인정하고 "최대 20분, Smart Notes 생성 확인 시 즉시
   종료"로 수정. 실제 실행은 여전히 별도 승인 대상, 이번에도 호출 없음.
- **검증**: 로컬 `supabase db reset --local` 재적용, `tsc --noEmit`·`next build` 클린, 신규
  vitest 2건 포함 전체 Vitest 통과, 별도 clean `git worktree`에서 재검증(§8과 동일 방식).
  로컬 psql로 4조건 게이트의 성공/실패 4가지 케이스 전부 실측 확인.
- **외부 변경**: 이번에도 0건. `git push` 하지 않음 — M1은 조건부 승인됐지만 push는 별도
  지시가 있을 때까지 보류.

## 10. 2026-09-03 M1 최종 마감 + R6 Calendar 정책 보정(통합 작업)

제품 오너가 §9 조건부 승인 이후 실제 Google Sandbox로 v1 요청서 범위 통합 검증을 직접
실행했다(Claude 세션은 실제 호출 없음). 실측 결과 Calendar/Meet/이메일/동의 확인까지는
통과했으나 **Workspace Events 구독을 만드는 코드 자체가 없어 Smart Notes 자동 연결은
검증되지 못한 gap**이 드러났다. 같은 날 후속 세션에서 이 gap 해결과 제품 정책 확정
(Calendar 네이티브 초대를 상담·체험·정규수업 확정 일정의 기본 전달 수단으로) 을 하나의
작업으로 통합해 반영했다 — 상세는 `docs/CURRENT.md`의 "M1 — Google Sandbox 실측 결과 +
최종 통합 보완" 절에 전부 옮겨뒀다(중복 작성하지 않음). 요약:

1. `workspace_events_subscriptions` 테이블 + `lib/google-workspace-events-subscriptions.ts`
   + `lib/workspace-events/subscription-lifecycle.ts` — 구독 생성·재사용·갱신·정지·재생성,
   Meet API 사후 대조(`reconcileMissedSmartNotesEvents`) 신규 구현.
2. `lib/google-calendar.ts`의 Calendar 함수 3개에 attendee/sendUpdates/guest 제한 파라미터
   추가 — 상담·정규수업 둘 다 네이티브 초대로 전환(R6 "attendees 없음" 정책 폐기).
   `lib/booking/calendar-sync.ts`에 학생 이메일 검증 확인(`resolveVerifiedStudentEmail`)
   추가 — 미검증 학생은 조용히 무시하지 않고 예외로 관리자 조치 필요 상태 노출.
3. Smart Notes 외부 비공개는 정책·기존 구조 재확인만(신규 API 강제 코드 없음, Google이
   해당 설정을 API로 지원하지 않음) — 다음 Sandbox 요청서(v2)의 검증 항목으로만 추가.
4. `ConsultationSchedulingPanel.tsx` — `window.prompt()` 2곳(시간변경/결과기록)을 인라인
   폼으로 교체, Calendar 동기화 상태 문구 세분화, 구독 상태 섹션 신규.
5. 보안 점검: 제품 오너가 보고한 실제 SMTP 자격증명 임시 사용·제거를 저장소·`.env.local`
   현재 상태로 직접 재확인 — 평문 잔존 없음(`.env.local` gitignore 확인, `SMTP_PASS` 길이
   0, 테스트 결과물·스크립트 어디에도 없음). 강제 회전은 하지 않음(판단은 제품 오너 몫).
6. `scripts/m1-sandbox-verification.sh`(이전 세션에서 초안 작성, 비밀값 없음 확인) 커밋.
7. 신규 Sandbox 요청서 v2(`docs/2026-09-03-m1-google-sandbox-verification-request-v2.md`)
   — 구독 생성 포함 통합 재검증 절차만 작성, 실제 호출 없음.
- **검증**: 로컬 `supabase db reset --local` 재적용, 신규 유닛 테스트(구독 수명주기 9건,
  Calendar attendee/guest 제한 1건, 학생 이메일 미검증 차단 1건) 포함 전체 Vitest 832건,
  `tsc --noEmit`·`next build` 클린, 전체 Playwright 52건(`--workers=1`) 중 51건 통과(1건은
  무관한 기존 R4 동시성 플레이키 테스트 — 단독 재실행 시 즉시 통과 재확인).
- **미완료**: 학생·보호자·선생님용 예약 화면의 Calendar 상태 표시 갱신(관리자 화면만
  갱신), 실제 Sandbox 재검증(v2, 승인·실행 대기).
- **외부 변경**: 이번 세션 Claude 실행분은 0건. 제품 오너가 세션 흐름 중 직접 실행한
  실제 Google 객체 생성·삭제·이메일 2통·임시 SMTP 자격증명 사용은 위 5번 항목에서 사후
  확인만 수행. `git push` 없음(로컬 커밋만).
