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
