# Alton Education Google Workspace 개편 — 개발자 전달서

> **문서 상태: v3로 대체됨.** 최신 구현 지침은 `2026-08-29-developer-handoff-v3.md`를 따른다. 파일럿 우선순위와 기존 결합 모델은 더 이상 개발 기준이 아니다.

- 과거 상태: **당시 구현 요청 기준, 현재 실행 금지**
- 기준일: 2026-08-29
- 선행 문서: `2026-08-29-architecture-decisions-v2.md`
- 실행 계획: `2026-08-29-work-plan-v2.md`

## 1. 요청 요약

현재 Next.js/Supabase 기반 Alton 서비스를 유지하면서 Calendly+Zoom 예약 파이프라인을 Google Calendar+Meet 기반의 자체 예약 시스템으로 교체한다. 동시에 상담 정보 수집, 체험 계정 생성, 계약 시점의 충돌을 바로잡는다.

Alton은 아직 정식 출시 전이며 실제 고객이 이용 중인 운영 서비스가 아니다. 따라서 이번 작업은 운영 중인 예약 시스템을 보호하거나 단계적으로 전환하는 작업이 아니라, 현재 개발본의 잘못된 외부 서비스 구조를 출시 전에 걷어내고 최종 구조로 완성하는 신규 개발 작업이다.

이번 작업은 UI 교체가 아니라 다음 업무 상태를 Alton 안에서 끊김 없이 연결하는 작업이다.

```text
상담 신청 → 상담 예약 → 상담 완료 → 체험 초대 → 체험 수업
→ 계약 → 결제 → 정규 매칭 → 회차 예약 → 수업 → 리뷰/정산
```

## 2. 현재 배포된 개발본에서 확인된 사실

2026-08-29에 `https://alton-ecru.vercel.app/`과 테스트용 관리자·학생·학부모·선생님 계정으로 개발 현황을 확인했다. 아래는 최종 기능 명세와 현재 프로토타입 사이의 불일치 목록이다.

### 최종 구현과 맞지 않는 부분

1. 랜딩은 `NEXT_PUBLIC_CALENDLY_URL`이 있으면 자체 인테이크 폼을 완전히 숨기고 Calendly iframe만 노출한다.
2. 랜딩 안내 문구가 아직 Zoom 상담이라고 표시한다.
3. 학부모 레슨 화면에도 `다음 회차 예약하기`가 노출된다. 최종 권한 설계에서 학부모는 일정 조회만 하고 예약 변경은 학생이 수행한다.
4. Calendly webhook과 `utm_content` 기반 예약 연결 코드가 남아 있다. 이 코드는 보완 대상이 아니라 삭제 대상이다.
5. 예약 시점에 `enrollments.current_session`을 증가시켜 예약만 해도 진도가 오른다.
6. 같은 enrollment에 동시에 들어온 예약이 동일한 다음 회차를 계산할 수 있다.
7. 계약서 발송 액션이 학부모·학생 계정을 생성하지만 제품 여정상 체험 수업이 계약보다 먼저다.

### 실제 미구현 화면

- 선생님: 일정, 교재, 정산
- 관리자: 상담, QC, 문서
- 학부모: 선생님 서브탭, 통계, 공통 계정메뉴
- 세션뷰: 보충자료

이 화면들을 모두 동시에 만들지 않는다. 예약·상담·체험 파이프라인을 먼저 완성한다.

## 3. 수정하지 말아야 할 기존 기능

명시적인 필요가 없으면 다음 기능은 리팩터링하지 않는다.

- 학생 포털의 과제·문제 기록·단어장·교재·통계
- 세션뷰 교재/캔버스/화이트보드/AI 문제 생성
- 선생님 커리큘럼과 수업 리뷰
- 관리자 사용자·매칭·커리큘럼·수업권·정산
- 인앱 채팅
- Stripe Checkout과 크레딧 원장
- Supabase RLS의 기존 역할 경계

## 4. 제품 요구사항

### 4.1 상담 신청

랜딩 상담 섹션은 다음의 2단계 흐름으로 변경한다.

#### 1단계 — 인테이크

필수 필드:

- 학부모 이름
- 이메일
- 연락처와 국가 코드
- 학생 이름
- 학년
- 거주 지역
- IANA timezone
- 관심 과목(복수 선택, `subjects` 참조)
- 현재 점수/성적
- 목표 점수/성적
- 희망 시작 시점
- 가장 큰 고민
- 개인정보 수집 동의 시각과 정책 버전

학생 이름·거주 지역을 `concerns` 문자열에 합치지 않는다.

#### 2단계 — 상담 예약

- 폼 저장에 성공한 뒤에만 슬롯을 표시한다.
- 상담 담당 Calendar의 Alton 가능 시간에서 Google busy를 제외한다.
- 예약 완료 시 Google Calendar 이벤트와 Meet를 생성한다.
- `consult_requests`에 예약 상태와 Google 식별자를 저장한다.
- 방문자와 관리자에게 확인 이메일을 전송한다.
- Google 이벤트 생성 실패 시 상담 신청 정보는 보존하고 다시 예약할 수 있어야 한다.

### 4.2 선생님 일정 오픈

선생님 포털 `일정` 탭을 다음 두 서브탭으로 구성한다.

#### 가능 시간

- 선생님의 기준 timezone 표시
- 요일별 반복 가능 시간 추가/수정/삭제
- 수업 길이와 예약 간 버퍼 표시
- 특정 날짜 휴무/추가 오픈
- Google Calendar 연결 상태 표시
- 슬롯 미리보기

#### 확정 일정

- 다가오는 수업 목록
- 학생, 과목, 회차, 현지 시각, Meet 링크
- 취소된 일정 포함 필터
- 수락/거절 버튼은 없음

### 4.3 학생 회차 예약

- 로그인한 학생만 예약할 수 있다.
- 자신의 active enrollment만 예약할 수 있다.
- `total_sessions`를 초과할 수 없다.
- 다음 미예약 회차를 예약한다. 예약만으로 진도가 증가하지 않는다.
- 담당 선생님의 가능 슬롯만 표시한다.
- 모든 슬롯은 학생 timezone으로 표시하고 선생님 timezone도 보조 표시한다.
- 최종 확인 화면에 과목, 선생님, 회차, 양쪽 timezone, 취소 기한을 표시한다.
- 예약 성공 시 DB 예약, Calendar 이벤트, Meet 링크가 모두 생성되어야 한다.
- 학부모는 일정과 Meet 링크를 조회할 수 있지만 예약·취소·재예약할 수 없다.

### 4.4 취소·재예약·지각 통보

- 취소 정책은 코드 상수가 아니라 설정값으로 관리한다.
- 취소 가능 기한 전: 학생 직접 취소·재예약 가능
- 기한 이후: 사유를 받고 운영 정책에 따라 late_cancel/no_show 후보로 기록
- 재예약은 기존 이벤트를 갱신하거나 취소 후 새 이벤트를 생성하되 감사 이력을 남긴다.
- Google Calendar에서만 직접 수정된 이벤트는 정기 동기화에서 불일치로 표시한다.
- 학생·선생님·필요한 경우 학부모에게 이메일과 인앱 알림을 보낸다.

### 4.5 체험 수업과 계정 생성

- 상담 완료 후 관리자가 체험 선생님과 과목을 선택한다.
- 이 시점에 학생·학부모 계정을 초대한다.
- 초대 완료 후 `is_trial=true` 세션을 생성한다.
- 체험 수업의 기본 길이는 60분으로 고정한다.
- 체험 세션은 정규 세션과 동일한 세션뷰·필기·리뷰 기능을 사용한다.
- 체험 수업은 학생의 정규 수업권을 생성하거나 차감하지 않는다.
- 체험 수업을 완료한 선생님에게는 회사가 비용을 지급한다.
- 지급 단가는 해당 선생님의 기존 정규 수업 시급과 동일하다.
- 선생님 정산에는 포함하되 정규 수업과 구분되는 `trial` 유형과 회사 부담 비용으로 기록한다.
- 체험 수업은 자녀당 1회만 제공한다.
- 체험 수업 당일 취소 또는 노쇼에는 선생님 비용을 지급하지 않는다. 당일 여부는 선생님의 IANA timezone상 수업 예정일을 기준으로 계산한다.
- 체험 완료가 자동으로 정식 enrollment를 활성화해서는 안 된다.
- 체험 완료 후 계약 의사를 확인하고, 계약과 결제가 완료되면 관리자가 자녀별 정규 enrollment를 활성화한다.
- 체험 선생님은 해당 자녀·과목의 정규 담당 선생님으로 기본 승계한다.

### 4.6 Google Docs 연습장

- 세션당 0개 이상의 Google Docs를 연결할 수 있다.
- 선생님이 새 문서를 만들면 Shared Drive의 지정 폴더에 생성한다.
- 학생·선생님 Google 이메일에만 writer 권한을 부여한다.
- 앱에는 제목, 최근 수정일, 권한 상태, 미리보기를 보여준다.
- 편집은 `Google Docs에서 편집` 버튼으로 새 탭에서 수행한다.
- 공개 게시 또는 anyone-with-link 권한을 사용하지 않는다.

### 4.7 보충자료

- Google Drive가 아니라 Supabase Storage를 사용한다.
- 선생님/학생 서브탭을 제공한다.
- 업로더와 관리자만 삭제할 수 있다.
- 세션 당사자와 해당 학생의 보호자만 조회할 수 있다.
- 파일명, MIME type, 크기, storage path, 업로더, 업로드 시각을 DB에 저장한다.

### 4.8 계약

- 파일럿에서는 Google eSignature를 관리자가 수동 처리한다.
- 관리자 화면 상태: `준비 중 → 서명 요청 발송 → 서명 대기 → 서명 확인 → 완료/무효`
- 시스템은 Google eSignature 발송 완료를 자동 감지한다고 가정하지 않는다.
- 관리자가 Drive file ID와 서명 상태를 입력/확인한다.
- 계약 완료와 학생 활성화는 별도 작업으로 분리하고 감사 로그를 남긴다.

### 4.9 자녀·과목별 선생님 매칭

- 선생님 매칭 단위는 `자녀 + 과목`이다.
- 체험을 진행한 선생님을 해당 과목의 정규 담당 선생님으로 기본 지정한다.
- 관리자는 계약 전후 어느 시점이든 자녀·과목별 담당 선생님을 변경할 수 있다.
- 다른 과목의 담당 선생님은 함께 변경되지 않는다.
- 매칭 변경 화면에서 변경 사유와 적용 시점을 입력한다.
- 완료된 수업·리뷰·정산은 당시 담당 선생님을 그대로 유지한다.
- 이미 확정된 미래 예약은 자동으로 새 선생님에게 이전하지 않는다. 기존 예약 취소와 새 선생님 일정으로의 재예약을 별도로 확인한다.

## 5. 권장 데이터 모델 변경

정확한 SQL은 스키마 설계 리뷰 후 확정한다. 기존 데이터를 파괴하지 않는 additive migration을 우선한다.

### 5.1 사용자·Google 연결

#### `profiles` 추가 후보

- `timezone`: text, IANA timezone
- `google_email`: citext/text, nullable

#### `teachers` 추가 후보

- `workspace_account_status`: pending/active/suspended
- `google_calendar_id`: text, nullable
- `workspace_provisioned_at`: timestamptz, nullable

### 5.2 가능 시간

#### `availability_rules`

- `id`
- `owner_profile_id`
- `kind`: consult/lesson
- `day_of_week`
- `start_local_time`, `end_local_time`
- `timezone`
- `effective_from`, `effective_until`
- `slot_minutes`, `buffer_minutes`
- `active`

#### `availability_exceptions`

- `id`
- `owner_profile_id`
- `date`
- `type`: blocked/extra
- `start_at`, `end_at`
- `reason`

### 5.3 예약 원장

상담과 수업 예약을 동일한 외부 연동 패턴으로 다루기 위해 별도 예약 원장을 권장한다.

#### `calendar_reservations`

- `id`
- `owner_profile_id`: 일정 소유 관리자/선생님
- `kind`: consult/session
- `consult_request_id`, nullable
- `session_id`, nullable
- `starts_at`, `ends_at`
- `status`: holding/confirmed/cancelled/failed/reconciliation_needed
- `google_calendar_id`
- `google_event_id`
- `google_event_etag`
- `meet_url`
- `idempotency_key`, unique
- `created_by`
- `cancelled_by`, `cancelled_at`, `cancellation_reason`
- `last_synced_at`, `sync_error`

제약:

- consult/session 중 정확히 하나만 참조
- 같은 owner의 active 시간대가 겹치지 않도록 DB 제약 적용
- `google_event_id` unique
- `idempotency_key` unique

### 5.4 상담

`consult_requests`에 구조화된 학생 필드와 다음 상태를 추가하거나 별도 `consult_students`를 둔다.

- requested
- scheduled
- completed
- qualified
- trial_invited
- trial_booked
- trial_completed
- converted
- closed

상태가 너무 많아질 경우 상담, 체험, 계약 테이블의 실제 존재 여부에서 단계가 파생되도록 하고 하나의 거대 enum에 모두 넣지 않는다.

### 5.5 외부 파일

- `session_doc_links.external_url` 중심 모델을 `provider`, `provider_file_id`, `title`, `permission_status` 중심으로 변경
- `company_documents.storage_path`를 Drive file ID를 표현할 수 있는 구조로 변경
- 기존 Supabase 파일과 Google Drive 파일을 구분할 `storage_provider` 추가

### 5.6 체험 세션과 정산

기존 세션·리뷰·정산 구조를 재사용하고 체험 전용 시스템을 따로 만들지 않는다. 실제 컬럼명은 기존 스키마와 맞춰 확정하되 다음 의미를 보존해야 한다.

- 세션 유형: `trial`과 `regular` 구분 (`is_trial`을 유지해도 됨)
- 체험 기본 시간: `duration_minutes=60`
- 자녀당 허용 횟수: 1회
- 학생 수업권 차감 여부: 체험은 `false`
- 선생님 정산 포함 여부: 완료된 체험은 `true`
- 비용 부담 주체: `company`
- 지급 단가: 수업 시점에 적용되는 해당 선생님의 정규 수업 시급
- 당일 취소·노쇼 정산: `0`
- 정산 내역에서 체험 수업임을 식별할 유형 또는 참조값

체험 수업료는 학생의 계약·결제 성공 여부와 관계없이 회사 부담 비용으로 처리할 수 있어야 한다. 계약 전환 실패를 이유로 완료된 체험 정산이 누락되어서는 안 된다.

자녀당 중복 체험 생성을 서버와 DB에서 방지한다. 취소·노쇼 후 체험 자격을 다시 부여할지는 운영자가 명시적으로 처리할 수 있도록 감사 이력을 남긴다.

### 5.7 선생님 매칭 이력

현재 매칭은 자녀·과목별 enrollment 또는 동등한 관계에서 관리하고, 별도 이력에는 다음 값을 보존한다.

- 자녀·과목 또는 enrollment ID
- 이전 선생님 ID와 새 선생님 ID
- 적용 시각
- 변경 사유
- 변경한 관리자 ID
- 체험 선생님 자동 승계인지 관리자 변경인지 구분하는 변경 유형

현재 선생님 ID만 덮어쓰고 이전 매칭을 잃는 구현은 허용하지 않는다.

## 6. Google 연동 요구사항

### 6.1 준비

- Alton 전용 Google Cloud project
- Google Calendar API, Drive API, Docs API 활성화
- 전용 service account
- Workspace Admin에서 domain-wide delegation 설정
- 최소 OAuth scope 승인
- 테스트 계정:
  - 상담 관리자 1개
  - 테스트 선생님 1개
  - 외부 개인 Gmail 학생 1개
- 회사 문서용 Shared Drive와 폴더 구조

### 6.2 인증

- 서버에서 Google 공식 Node.js client library 사용
- service account private key는 Vercel secret으로만 보관
- 요청마다 작업 대상 Workspace 사용자를 명시적으로 impersonate
- 학생 개인 Google 계정을 impersonate하지 않음

### 6.3 Calendar 이벤트

- 자체 생성한 안정적인 event ID 또는 idempotency key 사용
- `conferenceDataVersion=1`
- 각 이벤트에 고유한 Meet `createRequest.requestId` 사용
- 참석자: 선생님, 학생, 필요 시 학부모
- 참석자 업데이트 알림 발송
- Alton reservation/session ID를 private extended property 또는 description에 저장

### 6.4 동기화

파일럿 1차 구현:

- 슬롯 조회 시 FreeBusy 실시간 조회
- Alton에서만 예약·취소·재예약 허용
- 주기적 reconciliation 작업으로 Google 이벤트 상태 대조
- 불일치는 관리자 알림과 `reconciliation_needed` 상태로 표시

Google Calendar push watch는 채널 갱신 운영이 필요하므로 1차 구현에서 제외한다.

## 7. API/서버 액션 경계

권장 서비스 모듈:

- `lib/google/auth.ts`
- `lib/google/calendar.ts`
- `lib/google/drive.ts`
- `lib/google/docs.ts`
- `lib/scheduling/availability.ts`
- `lib/scheduling/reservations.ts`
- `lib/scheduling/reconciliation.ts`

권장 원칙:

- React 컴포넌트에서 Google API를 직접 호출하지 않는다.
- 예약 생성·취소는 서버 액션/API 한 곳을 통해서만 수행한다.
- 역할, enrollment 소유권, 회차 한도는 서버에서 다시 검증한다.
- Google API 오류를 삼키지 않는다.
- 외부 호출 전후의 DB 상태를 명시한다.
- 재시도 가능한 오류와 사용자가 수정해야 하는 오류를 구분한다.

## 8. 비기능 요구사항

### 시간대

- DB 저장은 UTC
- 사용자 입력은 IANA timezone
- `PT`, `ET` 같은 고정 약어를 저장하지 않음
- DST 경계 테스트 필수

### 중복예약

- 동시에 두 요청이 들어와도 하나만 성공해야 한다.
- Google FreeBusy 조회만으로 중복을 방지하지 않는다.
- DB 잠금/제약으로 최종 방어한다.

### 보안

- 학부모가 예약 API를 직접 호출해도 거절되어야 한다.
- 학생은 자신의 enrollment만 예약할 수 있다.
- 선생님은 자신의 가능 시간만 변경할 수 있다.
- webhook/cron secret 미설정 시 500/401로 실패한다.
- 외부 파일을 공개 링크로 만들지 않는다.

### 관찰 가능성

- 예약 생성/Google 이벤트 생성/취소/동기화 실패를 구조화 로그로 남긴다.
- 관리자에게 재처리 가능한 실패 목록을 제공한다.
- 외부 API 에러 본문에 비밀값이 포함되지 않도록 한다.

## 9. 테스트 요구사항

### 단위 테스트

- 가능 시간 - busy - 기존 예약 계산
- DST 전환일 슬롯
- 예약 cutoff 계산
- total session 초과 차단
- 역할별 권한
- idempotency 재호출
- Google API 실패와 보상 처리
- 60분 체험 세션 생성
- 자녀당 중복 체험 생성 차단
- 체험 완료 시 학생 수업권 미차감
- 완료된 체험에 기존 시급을 적용한 회사 부담 선생님 정산 생성
- 체험 당일 취소·노쇼 시 정산 미생성
- 체험 완료만으로 정규 enrollment가 활성화되지 않음
- 체험 선생님 정규 매칭 승계와 자녀·과목별 매칭 변경 이력

### 통합 테스트

- 테스트 선생님 Calendar FreeBusy 조회
- 이벤트 생성 후 Meet URL 수신
- 취소/재예약 후 Google 이벤트 상태
- 외부 Gmail에 Docs writer 권한 부여/회수

### E2E

1. 익명 상담 폼 → 상담 예약 → 관리자 상담 목록
2. 관리자가 체험 초대 → 학생 로그인 → 체험 예약
3. 학생 예약 → 선생님 일정 → 양쪽 Meet 링크 동일
4. 학부모는 조회 가능, 예약 버튼/API 사용 불가
5. 학생 취소/재예약 → Google Calendar와 포털 동기화
6. 수업 완료 전에는 진도·크레딧·정산이 증가하지 않음
7. 체험 완료 → 학생 수업권 미차감 → 회사 부담 선생님 정산 기록 → 계약은 미확정 상태 유지

공용 개발 데이터나 실제 Workspace 계정으로 E2E 쓰기 테스트를 하지 않는다. 별도 테스트 환경과 테스트 Workspace 계정을 사용한다.

## 10. 완료 정의

예약/Meet 개편은 다음을 모두 만족할 때만 완료다.

- Calendly 없이 상담과 수업 예약이 가능하다.
- 예약 직후 Alton과 Google Calendar 양쪽에 일정이 보인다.
- 모든 수업에 고유 Meet 링크가 있다.
- 중복예약 경쟁 테스트를 통과한다.
- 학부모·타학생·타선생님 권한 우회를 서버가 차단한다.
- 취소·재예약과 알림이 동작한다.
- Google API 장애 후 재처리 방법이 있다.
- 기존 완료 세션, 리뷰, 정산, 크레딧 데이터가 보존된다.
- 문서와 환경변수 목록이 실제 구현과 일치한다.

## 11. 개발자가 임의로 결정하면 안 되는 항목

다음 값이 없으면 구현 전에 제품 담당자에게 확인한다.

- 상담 시간 길이와 버퍼
- 정규 수업 기본 길이
- 예약 가능 최소/최대 선행 시간
- 무료 취소 cutoff
- 늦은 취소·노쇼의 크레딧 정책
- 학부모 Calendar 초대 여부
- 체험 수업 후 계정/데이터 보존 기간
- 체험 취소·노쇼 후 운영자가 체험 자격을 다시 부여할 수 있는 조건
- Google Workspace 요금제와 eSignature 사용 가능 여부
- 회사 Shared Drive의 폴더/보존 정책
