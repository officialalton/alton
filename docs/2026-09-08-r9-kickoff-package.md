# R9 Kickoff Package (2026-09-08)

계획 문서. 코드/마이그레이션/배포 없음. Task C(R10 payout_batches 관리자 화면)와
Task D(R8 session_annotation_events)를 반영한 현재 코드 기준으로 "수업 시작 →
세션뷰 진입, 커리큘럼·교재·수업 준비·리뷰" 흐름을 정리한다.

## 1. 현재 코드 기준 흐름 한 장 정리

```
[예약 확정] confirm_lesson_booking() → reservations(status=confirmed) + sessions(v3, final_status=scheduled)
      │
      ▼
[커리큘럼 배정] ??? (R9 범위, 아직 미구현)
   session-source-data.ts loadV3Session()이 curriculumDocId를 항상 null로 반환
   ("R9 이후 과목 템플릿 기반 배정 메커니즘이 생기면 채울 것" — 코드 주석에 명시)
      │
      ▼
[세션뷰 진입] /session/[id]/page.tsx → loadNormalizedSession()
   → legacy_sessions 우선 조회, 없으면 v3 sessions로 폴백 (source: "legacy"|"v3")
   → resolveViewerRole()로 student/teacher/parent/admin 판정
   → SessionShell.tsx가 source·viewerRole·status(upcoming/completed)로 렌더 분기
      │
      ├─ [수업 준비 / 진행] WhiteboardCanvas.tsx
      │    - 레거시 트랙: Realtime broadcast + legacy_sessions.whiteboard_strokes(스냅샷)
      │    - 신규 트랙(Task D, 아직 미연결): session_annotation_events(append-only,
      │      v3 세션 전용) + annotation-events-actions.ts(append/replay)
      │    → 두 트랙이 공존 중. v3 세션은 아직 화이트보드 UI가 신규 테이블을
      │      쓰지 않는다(WhiteboardCanvas는 여전히 레거시 경로만 구현).
      │
      └─ [수업 완료 → 리뷰] app/teacher/review/[sessionId]/review-actions.ts
           - 레거시 세션(enrollment_id 기반) 리뷰 흐름만 존재
           - v3 세션(sessions_v3/final_status) 리뷰 흐름은 미구현
           - Smart Notes 생성 이벤트(smart_notes_generation_events, R6)는
             session_id(v3)에 연결되지만 "리뷰 생성·공개"는 R9 범위로 명시
             보류돼 있음(R6 마이그레이션 주석)
```

## 2. Connection points (연결 지점 — 이번에 처음 잇거나 다시 만져야 하는 이음매)

1. **예약 확정 → 커리큘럼 배정**: `sessions.material_version_id`가 지금은 항상
   null(R9 이전). 과목 템플릿(`subject_template_units`, 커리큘럼 문서 버전
   `curriculum_doc_versions`)에서 다음 배정 단원을 계산해 세션 생성 시점(또는
   확정 직후)에 채우는 로직이 R9에서 처음 생긴다. `prevent_material_version_
   reassignment` 트리거(R8, 20261219000000)가 이미 "세션 시작/완료 후 재배정
   금지" 불변식을 걸어뒀으므로, 배정 로직은 반드시 "세션 시작 전"에만 값을
   써야 한다.
2. **세션뷰 진입 → 화이트보드**: WhiteboardCanvas.tsx를 v3 세션에 대해서는
   `annotation-events-actions.ts`(append/replay)로 갈아끼우는 작업. 레거시
   세션은 그대로 두거나(source==="legacy"면 기존 경로), v3 세션(source==="v3")
   에서만 신규 트랙을 쓰도록 분기하는 게 가장 안전한 접근.
3. **세션뷰 진입 → 세션 번호 표시**: `loadV3Session()`이 `sessionNumber: 1`로
   하드코딩돼 있음(코드 주석: "실제 N회차 표시가 필요해지면 R9에서 subject_
   enrollment 단위 세션 카운트 계산 뷰/쿼리 추가"). UI가 이 숫자를 노출하는
   화면(세션뷰 헤더 등)이 있다면 R9에서 실제 카운트 쿼리로 교체해야 함.
4. **수업 완료 → 리뷰 생성**: v3 세션 완료(`final_status`가 completed류로
   전이) 시 리뷰 워크플로가 아직 없음. 레거시 review-actions.ts의 권한/데이터
   모델(author_role, enrollment_id 기반)을 v3(teacher_id/subject_enrollment_id
   기반)로 다시 설계해야 함 — 단순 리네임이 아니라 참조 컬럼 자체가 다름.
5. **payout_batches와의 접점**: `generate_payout_batches()`(R10)는 세션의
   `payable_minutes`/`final_status`를 원천으로 정산 항목을 만든다. R9에서
   세션뷰/리뷰 흐름을 바꿀 때 `payable_minutes` 산정 로직(교사 부분 결석,
   학생 취소 등 M5 계열 트리거)을 건드리지 않도록 주의 — 이미 R10에서
   검증된 pre-incorporation 게이트와 무관한 레이어이지만, 세션 완료 판정
   로직을 바꾸면 정산 계산 입력값도 함께 바뀐다.

## 3. Source of truth per state

| 상태/데이터 | 현재 source of truth | 비고 |
|---|---|---|
| 예약 시간/상태 | `reservations`(v3) | R1 |
| 세션 진행 상태 | `sessions.final_status`(v3) / `legacy_sessions.status` | 두 트랙 |
| 배정 교재/단원 | 없음(R9에서 신설) | 지금은 항상 null |
| 화이트보드 내용 | `legacy_sessions.whiteboard_strokes`(레거시, 스냅샷) 또는 `session_annotation_events`(v3, 이벤트 로그, Task D) | 두 트랙, 아직 프론트 미연결 |
| 리뷰/피드백 | `session_memos`(레거시, enrollment_id 기반) | v3용 테이블 없음 |
| Smart Notes 산출물 | `smart_notes_generation_events` → `sessions.smart_notes_drive_file_id` | 연결까지만, 공개는 R9 |
| 정산 | `payout_batches`/`payout_items`(v3, R10) | Task C UI 완료, 법인 설립 전 승인까지만 |

## 4. Permission boundaries (현재 코드 기준)

- `resolveViewerRole()`(session-source-data.ts): student(본인)/teacher(담당)/
  parent(프로필 role)/admin. 그 외는 세션 자체를 조회하지 못함(null 반환 →
  page.tsx가 404/권한없음 처리).
- `is_session_related_v3(session_id)`(R6, 20260930): teacher_id 일치 또는
  child_id 일치 또는 보호자(household/individual)일 때 RLS 통과. admin은
  `is_admin()`으로 별도 허용.
- `is_session_teacher_v3(session_id)`(R8 Task D, 신규): teacher_id 일치만.
  `session_annotation_events`의 clear_all INSERT 정책에서만 쓰임 — 다른
  세션 관련 테이블에는 아직 이 좁은 헬퍼가 없으므로, "선생님 전용" 액션이
  더 생기면(R9 리뷰 생성 등) 재사용 가능.
- admin 화면(payout_batches 등)은 `requireAdmin()`(role='admin') 또는
  `requireAdminOrCapability(capability)`(R2 Task 8, capability 기반) 둘 중
  하나로 게이트 — R9에서 세션뷰 관련 admin 기능을 추가한다면 어느 쪽을
  쓸지 먼저 결정해야 함(단순 admin 전용이면 requireAdmin, 위임 가능한
  운영 업무면 capability).

## 5. 필요한 마이그레이션 (예상, 착수 시 재검토 필요)

1. 세션→교재 배정 컬럼/로직: `sessions.material_version_id` 채우는 함수 +
   "세션 시작 전에만" 배정을 강제하는 트리거는 이미 있음(20261219000000) —
   배정 함수 자체만 신규.
2. v3 세션 회차 번호: 뷰 또는 계산 쿼리(마이그레이션이 아니라 쿼리/뷰 추가로
   충분할 가능성 높음 — 세션 카운트는 파생 데이터).
3. v3 세션 리뷰 테이블(가칭 `session_reviews_v3` 또는 `session_memos`를
   v3로 확장): 권한 모델(author_role) 재설계 필요.
4. WhiteboardCanvas → `session_annotation_events` 연결: 마이그레이션 불필요
   (테이블은 이미 있음, 프론트엔드 작업만).

## 6. UAT 시나리오 목록 (초안)

1. 교사가 v3 세션뷰에 진입해 교재/단원이 배정돼 있는지 확인 (현재는 항상
   "교재 미배정" 빈 상태 — R9 완료 후 실제 배정 표시로 바뀌어야 함).
2. 학생이 화이트보드에 그리고 새로고침(재접속)해도 그림이 그대로 복원되는지
   (레거시: 마지막 스냅샷 복원 확인 / v3: replay 기반 복원 확인, 프론트
   연결 후).
3. 교사가 "전체 지우기"를 누르면 학생 화면에서도 즉시 지워지고, 이후 새로
   그린 내용만 재접속 시 복원되는지 (v3, Task D 이벤트 기반).
4. 학생/보호자 계정으로는 "전체 지우기" 버튼 자체가 보이지 않거나, 만약
   API를 직접 호출해도 거부되는지 (RLS 레벨 — 이미 Task D에서 DB 레벨은
   검증됨, UI 노출 여부는 R9에서 실제 연결 시 재확인 필요).
5. 세션 완료 후 교사가 리뷰를 작성하면 학생/보호자에게 노출되는지 (v3
   흐름 신설 시 신규 시나리오 — 레거시 리뷰 플로우와 병행 테스트).
6. 정산 담당 관리자가 "정산 (v3)" 탭에서 batch 생성 → 검토 제출 → 승인까지
   진행 가능하고, 그 이상(지급 실행) 버튼이 없는지 재확인 (Task C, 회귀
   방지용으로 R9에서도 스팟체크 권장).

## 7. 열린 정책 질문 (제품 오너 확인 필요, 진짜 정책 질문만)

1. **교재 배정 시점과 방식**: 세션 확정(예약) 시점에 자동 배정할지, 아니면
   교사가 세션뷰에서 수동으로 "다음 단원" 확정 버튼을 누르는 방식일지 —
   코드 관점에서는 둘 다 구현 가능하지만 UX/운영 정책 결정 필요.
2. **v3 리뷰 공개 범위**: Smart Notes 자동 생성 산출물을 학생/보호자에게
   그대로 노출할지, 교사 승인 후에만 노출할지 (레거시는 교사가 직접 작성한
   리뷰만 노출하는 모델 — Smart Notes 자동화가 이 모델을 대체하는지 보완
   하는지 결정 필요).
3. **화이트보드 두 트랙 통합 시점**: 레거시 세션이 실제로 얼마나 남아있는지
   (신규 예약은 전부 v3라 레거시는 자연 감소 추세로 추정되나 실측 필요)에
   따라 "레거시도 이벤트 로그로 백필할지" 여부를 결정해야 함 — 순수 기술
   판단이 아니라 레거시 세션 잔존 기간에 대한 제품 판단이 필요.
