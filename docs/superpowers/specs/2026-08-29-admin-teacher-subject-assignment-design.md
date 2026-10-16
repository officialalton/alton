# 관리자가 선생님 담당 과목을 배정하는 기능 설계

> **문서 상태: 과거 설계 이력.** 신규 teacher assignment는 v3 기간 이력 모델이 우선한다.

## 배경

`app/admin/TeacherDetailPanel.tsx`의 "담당 과목" 칸은 사실 `enrollments`(실제 매칭된 학생) 기준으로 계산된 `teacher.subjectNames`를 보여주고 있었다 — "매칭된 학생 없음"이라는 폴백 문구가 이를 정확히 말해준다. 정작 "이 선생님이 어떤 과목을 가르칠 수 있는가"(`teacher_curriculum_templates`, 선생님 포털의 "내 과목")는 관리자 화면 어디에도 안 보이고, 관리자가 이걸 직접 등록해줄 방법도 없다.

방금 만든 매칭(083) 기능은 정확히 `teacher_curriculum_templates`를 조회해서 선생님 후보를 추려낸다(`loadTeacherCandidatesBySubject`) — 즉 지금 이 화면이 없으면, 선생님이 스스로 "내 과목"에 등록하지 않는 한 관리자는 그 선생님을 어떤 과목의 매칭 후보로도 쓸 수 없다. 이번 기능은 매칭 기능이 실제로 쓸모 있으려면 꼭 필요한 짝이다.

## 결정 사항

- "담당 과목"과 "매칭된 학생"을 화면에서 분리한다: 
  - **담당 과목 (등록)** — `teacher_curriculum_templates` 기준, 관리자가 pill 버튼으로 추가/제거 가능
  - **매칭된 학생 (수강 중)** — 기존 `subjectNames`(enrollments 기준) 그대로, 라벨만 명확하게 바꿈
- 관리자가 과목을 등록하면 선생님 포털의 `createMyTemplate`과 동일하게 그 과목의 회차(과목 템플릿의 `subject_template_units`)를 그대로 복사해 `teacher_curriculum_template_units`를 만든다 — 관리자가 등록하든 선생님이 스스로 등록하든 이후 "내 커리큘럼" 편집 화면에서 동일하게 보이고 편집 가능해야 하기 때문.
- 관리자가 과목을 제거하면 `teacher_curriculum_templates` 행을 삭제한다(연결된 units는 FK cascade로 함께 삭제됨, 이미 스키마에 있음). 단, 이미 그 과목으로 매칭된 학생(`enrollments`)이 있으면 제거를 막고 안내한다(매칭 해제 없이 담당 과목만 빼면 기존 학생의 교재/커리큘럼 참조가 끊기기 때문).
- RLS는 이미 `teacher_curriculum_templates`/`teacher_curriculum_template_units` 둘 다 "본인 선생님 또는 관리자" 쓰기 정책이 있어(`supabase/migrations/20260827120001_rls_policies.sql:151-171`) 새 마이그레이션이 필요 없다.

## UI

`TeacherDetailPanel.tsx`의 기존 "담당 과목" 박스를 아래 두 박스로 교체한다:

1. **담당 과목 (등록)**: 전체 과목 pill 목록(051 과목 템플릿의 `subjects`), 이 선생님이 등록한 과목은 강조 표시. 등록 안 된 과목 pill 클릭 → 등록. 등록된 과목 pill 클릭 → 제거 확인(매칭된 학생 있으면 에러 메시지로 막힘).
2. **매칭된 학생 (수강 중)**: 기존 `teacher.subjectNames.join(", ")`, 폴백 문구는 "매칭된 학생 없음" 그대로 유지(이제 라벨이 정확해졌으므로 문구도 정확함).

## 영향받는 파일

- `app/admin/users-data.ts` — `TeacherListItem`에 `assignedSubjectIds: string[]` 추가, `loadTeachers`가 `teacher_curriculum_templates`도 조회
- `app/admin/teacher-subjects-actions.ts` (신규) — `assignTeacherSubject(teacherId, subjectId)`, `unassignTeacherSubject(teacherId, subjectId)`(매칭된 학생 있으면 에러)
- `app/admin/TeacherDetailPanel.tsx` — UI 교체, `subjects: AdminSubject[]` prop 추가
- `app/admin/UsersTab.tsx` — `subjects` prop을 받아 `TeacherDetailPanel`에 전달
- `app/admin/AdminShell.tsx` — 이미 갖고 있는 `subjects`를 `UsersTab`에도 전달(현재 `CatalogTab`에만 전달 중인지 확인 후 배선)
- 새 마이그레이션 불필요

## 스코프 제외

- 매칭된 학생이 있는 과목의 담당 과목 제거를 강제로 허용하는 UI(예: "그래도 제거" 버튼) — 이번엔 막기만 하고, 필요하면 관리자가 먼저 그 학생의 매칭을 해제해야 한다(매칭 해제 UI 자체가 083 스코프 밖이었던 것과 동일한 이유로 이번에도 제외).
- 관리자가 등록한 과목의 회차(units) 내용을 직접 편집하는 것 — 그건 이미 있는 "내 커리큘럼" 화면(선생님 본인 전용)의 몫으로 남긴다.
