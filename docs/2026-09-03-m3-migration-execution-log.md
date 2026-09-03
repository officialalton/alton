# M3 실행 로그 — 선생님 배정 종료(termination) 플로우 (2026-09-03)

## 0. 정책 전제(2026-09-03 최종 확정, 이전 M3 지시 전량 폐기)

trial/regular는 `teacher_assignments` 레벨에서 분리된 개념이 아니다 — 단일 배정
관계이며, trial 60분/regular 120분 구분은 세션의 수업유형(lesson_type)·수업권
(entitlement) 레벨에서만 존재한다. 체험 때 배정된 선생님은 정규 계약 이후에도
그대로 유지되고, 시스템은 절대 자동으로 다른 선생님을 선택하지 않는다. 실제
선생님 교체가 필요한 경우에만 기존 `change_teacher_assignment()`(R5)를 재사용하는
정식 종료 플로우를 쓴다. 이전에 전달됐던 "별도 체험 배정 모델"(candidate/pending/
rejected/expired 상태 머신, trial→regular 승계 제안/전환)은 이번 M3에서 만들지
않는다. 기존 `decideTrialTeacherSuccessionProposal()`/`proposals` 관련 코드·UI는
R5 회귀 위험 때문에 삭제하지 않고 "현재 정상 흐름에서 미사용" 상태로 남긴다.

커리큘럼/진도 핸드오프는 별도 요청/수락/완료 워크플로우·문서 복사·데이터
마이그레이션·Drive ACL 변경·핸드오프 체크리스트 없이, 새 배정 확정 즉시 읽기전용
과거 이력 접근을 제공하는 것으로 단순화한다(2절 참고).

## 1. DB — `supabase/migrations/20261014000000_m3_teacher_assignment_termination.sql`

- `teacher_assignment_termination_requests`: 요청자 role(guardian/teacher/admin),
  reason, status(requested/processing/completed/failed/cancelled), resolution
  (reassign/end_enrollment), new_teacher_id, effective_from, processed_by/at, error.
  RLS: `is_admin() OR 예약관리권한 OR 해당 배정의 선생님 본인 OR 요청 당사자`.
- `teacher_assignment_termination_reservation_actions`: 예약별 처리 감사(reassigned/
  cancelled), INSERT-only(reject-mutation 트리거).
- `preview_teacher_assignment_termination_impact(p_teacher_assignment_id)`: 그
  배정 선생님의 미래 확정 예약 + 보유분(hold) 여부.
- `assert_teacher_assignment_ready_for_closure(p_teacher_assignment_id)`: 미해결
  미래 예약이 남아있으면 예외 — 종료 완료 직전 최종 게이트.
- `list_subject_teaching_history_for_current_teacher(p_subject_enrollment_id)`:
  SECURITY DEFINER, 호출자가 `is_admin()`이거나 그 과목의 **현재 활성** 배정
  보유자일 때만 통과(매 호출마다 재검증 — 재배정 취소 시 접근이 자동 회수됨).
  반환 컬럼은 `session_id/starts_at/ends_at/final_status/lesson_type_name`뿐 —
  정산 단가(`hourly_rate_snapshot_*`), Smart Notes 원본, 내부 메모, 다른 과목
  기록은 애초에 SELECT하지 않는다(테이블 RLS가 아니라 컬럼 단위로 걸러내는 전용
  함수 방식 — Postgres RLS는 행 단위이기 때문).
- `teacher_assignments.curriculum_handoff_status`에는 "이 필드는 더 이상 실제
  업무 게이트가 아니며 이번 M3 종료 플로우가 대체한다"는 주석만 추가, 값은
  건드리지 않음(하위 호환, 삭제하지 않음).

적용: `npx supabase db reset --local`로 로컬 개발 DB에 적용 확인. 적용 중
`sessions_v3`(R6에서 `sessions`로 rename됨) 잔존 참조 3곳을 발견해 `sessions`로
수정 후 재적용 성공.

DB 레벨 smoke test(psql 직접 실행): 비배정 호출자가 `list_subject_teaching_
history_for_current_teacher()`를 호출하면 `이 과목 수강에 현재 배정된 선생님만
지난 수업 이력을 볼 수 있습니다` 예외로 거부됨을 확인. 3개 함수(`preview_
teacher_assignment_termination_impact`/`assert_teacher_assignment_ready_for_
closure`/`list_subject_teaching_history_for_current_teacher`)와
`teacher_assignment_termination_requests` 테이블 스키마 존재 확인.

## 2. 처리 로직 — `lib/enrollment/teacher-assignment-termination.ts`

- `previewTerminationImpact()`: 영향 미리보기 RPC 래퍼.
- `createTerminationRequest()`: 요청 생성(guardian/teacher/admin).
- `processTeacherAssignmentTermination()`: 핵심 오케스트레이션.
  - 이미 `completed`면 재처리 없이 바로 반환(멱등).
  - 조건부 UPDATE(`status in (requested, failed)`)로 처리를 선점(claim) —
    동시 호출 중 하나만 진행, 나머지는 "이미 처리 중" 예외.
  - 영향받는 예약마다: 이미 `teacher_assignment_termination_reservation_actions`에
    기록이 있으면 건너뜀(재처리 시 중복 처리 방지). `reassign`이면
    `is_teacher_slot_open()`/`violates_teacher_buffer()`로 새 선생님 가능시간·
    버퍼·중복예약을 재검증해 통과하면 `reservations.owner_profile_id`/
    `sessions.teacher_id`를 갱신(배타 제약이 최종 방어선), 실패하면 기존
    `cancelLessonBooking()`으로 정식 취소(Calendar 삭제+보유분 해제 동시 처리).
    `end_enrollment`면 전부 정식 취소.
  - `assert_teacher_assignment_ready_for_closure()`로 최종 게이트 확인.
  - `reassign`이면 `change_teacher_assignment()`(R5) 재사용. `end_enrollment`면
    `teacher_assignments.status='ended'` + `subject_enrollments.status='ended'`.
  - 실패 시 `status='failed'`+`error` 기록, 예외를 던지지 않고 결과 객체로 반환
    (관리자가 같은 requestId로 재처리 가능).

과거 수업/Smart Notes 리뷰/배정 이력/정산 기준은 이 로직 어디서도 수정·삭제하지
않는다.

## 3. 권한 경계

- `app/teacher/teacher-assignment-termination-actions.ts`: `requestOwnTerminationAsTeacher()`,
  `listMyTerminationRequests()`, `listMyTeachingHistoryForSubject()`만 존재 —
  확정 처리 함수 자체가 없어 구조적으로 선생님이 스스로 종료를 확정할 수 없다.
- `app/admin/teacher-assignment-termination-actions.ts`: `requireAdminOrCapability
  ("매칭권한")`으로 보호되는 `listTerminationRequests()`, `previewTerminationImpactAction()`,
  `adminCreateTerminationRequest()`(보호자 대신 접수 포함), `processTerminationRequestAction()`,
  `cancelTerminationRequestAction()`, `listSubjectTeachingHistoryForCurrentTeacher()`.

## 4. UI

- 관리자: `app/admin/TeacherAssignmentTerminationPanel.tsx`(`MatchingTab` 하단에
  마운트) — 요청 목록(요청자·사유·상태), 영향 미리보기(미래 예약 건수·보유분 여부),
  과거 수업 이력 건수 표시, 재배정/수강종료 선택, 처리 확정, 실패 시 오류 메시지+재처리.
- 선생님: `app/teacher/AssignmentsTab.tsx`에 "배정 종료 요청" 인라인 폼(제출 후
  상태만 조회, 중복 제출 방지) + "과거 수업 이력 보기" 접이식 위젯(현재 활성 배정
  건에 한해 날짜/수업유형/상태만 노출).
- 보호자·학생: 기존 R5 `EnrollmentTab.tsx`가 이미 `currentTeacher`/
  `upcomingTeacherChange`를 실시간 DB 조회로 보여주고 있어 별도 구현 없이 그대로
  확정된 현재 선생님과 예정된 변경 결과가 반영된다(변경 없음).

## 5. 검증

- Vitest 신규: `lib/enrollment/teacher-assignment-termination.test.ts`(5건 —
  RPC 매핑, insert, 멱등 반환, end_enrollment 전체 흐름, claim 충돌 예외),
  `app/admin/TeacherAssignmentTerminationPanel.test.tsx`(2건 — 처리 확정 흐름,
  실패 시 오류 표시), `app/admin/teacher-assignment-termination-actions.test.ts`
  (1건 — 민감 컬럼 비노출·안전 컬럼만 매핑), `app/teacher/AssignmentsTab.test.tsx`
  (3건 — 선생님 본인 확정 불가/직접 종료 버튼 없음, 중복 요청 시 폼 대신 상태만
  표시, 과거 이력 화면에 시급/정산/Smart Notes/내부 메모 문구 없음).
- 전체 회귀: Vitest 143개 파일/863건 전부 통과(회귀 없음), `npx tsc --noEmit` 클린,
  `npx next build` 성공(정적/동적 라우트 정상 생성).
- DB: 위 1절의 psql smoke test로 fail-closed 동작 확인.
- **미완료**: Playwright E2E(관리자→선생님→보호자 역할별 화면 통합 흐름), 클린
  `git worktree` 재현(별도 워크트리에서 node_modules 복사 후 build+Vitest 재현) —
  다음 라운드로 이관.

## 6. 커밋

- `3bf4cce` — 서버 레이어(마이그레이션, 처리 로직, 관리자/선생님 서버 액션, 첫
  단위 테스트).
- 이후 커밋(이 로그 포함) — UI(관리자 패널, 선생님 배정 종료 요청·과거 이력 위젯),
  추가 테스트, 문서(`docs/CURRENT.md`, 마스터 로드맵 M3/M4 절, 이 실행 로그).

전부 로컬 `main` 브랜치 커밋, `git push` 없음. 실제 Google/Stripe/DocuSign 호출,
실제 이메일 발송, 원격 DB 접근 전부 없음.
