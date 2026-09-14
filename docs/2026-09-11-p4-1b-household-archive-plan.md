# P4-1(B) 착수 1장 정리 — 경량 가구 아카이브·복귀 (2026-09-11)

근거: `docs/2026-09-10-p4-1-account-expansion-and-household-archive-investigation.md` B절.
제품 오너 확정 지시(2026-09-11): C-2 종료 파이프라인 재사용 / 진행 중 수업은 변경
전 차단 / 완료 수업·사용 수업권 보존 / 별도 아카이브 상태 사용 / 복귀 시 예약·
매칭 자동 복원 없음. 이 정책은 재결정 대상이 아니다.

## 1. 사용자 흐름

- **정상**: 관리자 `사용자 > 학부모` 목록의 가구 행 → `아카이브` → 확인 모달에
  영향 미리보기(종료될 매칭 수, 취소될 미래 예약 수, 진행 중 수업 유무)를 보여줌
  → 실행 → 자녀별 활성 매칭 종료 + 남은 미래 확정 예약 취소 → 가구에
  `archived_at` 기록 → 목록에서 빠지고 `아카이브됨` 서브탭에 표시.
- **차단(진행 중 수업)**: 가구 안에 `live` 세션이 하나라도 있으면 **아무 것도 바꾸지
  않고** 차단하고 어느 수업 때문인지 안내한다. 부분 진행 상태를 남기지 않는다.
- **실패(부분)**: 중간 실패 시 요청이 `failed`로 남고 같은 버튼으로 재실행한다.
  이미 종료된 매칭·이미 취소된 예약은 건너뛴다(멱등).
- **취소**: 확인 모달을 닫으면 아무 것도 생성·변경되지 않는다.
- **복귀**: `아카이브됨` 목록의 `복귀` → `archived_at` 해제 + 이벤트 기록만 한다.
  취소된 예약·종료된 매칭·수강 상태는 **자동 복원하지 않는다**(다시 쓰려면 관리자가
  기존 매칭·예약 경로로 새로 만든다).

## 2. 데이터와 권한

- **신규 상태(마이그레이션 additive)**:
  - `households.archived_at timestamptz null`, `households.archived_by uuid`
    (+ `archived_at is null` 부분 인덱스).
  - `household_archive_requests(id, household_id, status(requested|processing|
    completed|failed), requested_by, error, created_at, updated_at)` — 선점·재시도용.
  - `household_archive_events(id, household_id, action(archived|restored),
    actor_id, detail jsonb, created_at)` — INSERT-only 감사 이력.
  - RLS: 세 대상 모두 조회는 `is_admin()`, 쓰기는 서버 액션(service_role) 전용.
- **별도 아카이브 상태를 쓰는 이유**: R2 계정 상태(`closure_pending`/`closed`)는
  `lib/auth.ts:37`이 즉시 로그아웃시킨다 — 로그인 차단은 이번 범위 밖이므로
  재사용하지 않는다. 가구 단위 경량 플래그만 둔다.
- **원본 경로 하나(재사용, 신규 종료·취소 경로 없음)**:
  - 매칭 종료 = `createTerminationRequest()` +
    `processTeacherAssignmentTermination({ resolution: "end_enrollment" })`
    (`lib/enrollment/teacher-assignment-termination.ts`).
  - 남은 예약 취소 = `cancelLessonBooking()`(`lib/booking/create-booking.ts`) —
    DB 취소 + Google Calendar 이벤트 삭제까지 한 경로.
  - 진행 중 판정 = C-2가 이미 쓰는 `sessionFinalStatus === 'live'`.
    가구 단위에서도 **어떤 변경보다 먼저** 전체를 확인한다.
- **보존**: 이미 최종 판정된 세션(완료/취소/노쇼)은 C-2의
  `skipped_already_delivered` 규칙대로 손대지 않는다 — 완료 수업과 이미 소진된
  수업권은 그대로 남는다. 미사용 수업권이 취소로 해제·만료 연장되는 것은
  `cancel_lesson_booking`의 기존 정책이며 새로 바꾸지 않는다.
- **상담 예약은 대상 밖**: `consult_requests`는 이메일 기반이라 가구·profile에
  귀속되지 않는다(`20260827120000_initial_schema.sql:83`) — 가구 단위로 안전하게
  특정할 수 없어 이번 범위에서 다루지 않는다.
- **권한**: 모든 진입점 `requireAdminOrCapability`. 클라이언트는 `householdId`만
  보내고 대상 자녀·매칭·예약은 서버가 다시 조회한다.

## 3. UAT 데이터

- 실행 ID `p4-1b-archive-20260911`. 전용 보호자 1가구(자녀 2명, 한 명은 매칭·미래
  예약 보유, 다른 한 명은 완료 수업 이력 보유)를 이 ID로 만든다. 자동 테스트는
  `@example.com` 픽스처만 쓰고 UAT 계정과 섞지 않는다.
- 완료 기준: 시작 전 공식 계정 목록 확인 → 종료 후 실행 ID 단위 비활성화(삭제 금지)
  → 공식 계정 보존 확인.

## 4. UI 기준

- `사용자` 탭에 `아카이브됨` 서브탭 추가(학부모/학생/선생님과 같은 레벨).
  열: 보호자명·이메일 / 자녀 목록 / 아카이브 시각 / 처리 관리자 / 취소된 예약 수·
  종료된 매칭 수 / `복귀` 버튼. 빈 상태 "아카이브된 가구가 없습니다."
- 학부모 목록 행에 `아카이브` 버튼 + 확인 모달(미리보기 수치, 되돌릴 수 없는 항목
  명시, 진행 중 수업이 있으면 실행 버튼 비활성 + 사유 표시).
- 실패한 요청은 학부모 행에 `재시도` 상태로 노출하고 같은 모달에서 재실행.
- 기존 목록(`loadParents`/`loadStudents`/`loadStudentsForMatching`/신규 보드/
  발송 내역)은 아카이브된 가구의 profile을 제외한다 — "아카이브된 household에
  속한 profile_id 집합"을 한 번 구해 빼는 방식으로 쿼리 수를 늘리지 않는다.

## 5. 검증과 성능

- **통합 테스트**: (a) 진행 중(`live`) 세션이 있으면 어떤 예약·매칭·플래그도 바뀌지
  않고 차단, (b) 미래 확정 예약이 취소되고 활성 매칭이 `ended`+수강
  `terminated`로 종료되며 `archived_at`이 마지막에 설정, (c) 이미 완료된 세션·소진
  수업권은 불변, (d) 부분 실패 후 재실행 시 이미 처리된 항목을 건너뛰고 완료(멱등),
  (e) 복귀는 `archived_at`만 해제하고 예약·매칭·수강 상태를 복원하지 않음,
  (f) 아카이브된 가구의 보호자·학생이 관리자 목록에서 빠지고 `아카이브됨`에만 보임.
- **Preview UAT**: 위 흐름을 실제 계정으로 1회.
- **성능**: 목록 필터는 아카이브 household·멤버 조회 1회를 추가하는 선에서 끝낸다
  (목록당 왕복 +1). 아카이브 처리 자체는 자녀 수·예약 수에 비례하는 순차 처리이며
  진행 상태는 `household_archive_requests`로만 노출한다.
