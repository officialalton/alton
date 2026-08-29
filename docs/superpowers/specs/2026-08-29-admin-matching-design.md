# 관리자 "매칭" 탭 설계

## 배경

`docs/tickets.md`의 083 티켓은 "Airtable을 계속 쓸지 우리 앱으로 가져올지부터 결정 필요"라고 명시돼 있었다. 사용자 확인: **Airtable 안 쓰고 인앱으로 구현한다.**

현재 관리자 대시보드(050)에 "학생 매칭 대기"(`students.status = 'pending'`) 카드가 이미 있지만 클릭해서 들어갈 전용 화면이 없다. `enrollments` 테이블(student_id, teacher_id, subject_id, status, total_sessions, current_session)은 스키마상 이미 존재하지만, 이 테이블에 실제로 INSERT하는 관리자 액션이 코드베이스 어디에도 없다 — 지금까지는 시드 데이터로만 채워져 있었다.

`contracts` 테이블에는 과목이나 회차 수 정보가 없다(계약서 자체가 서명 여부/URL만 관리) — Airtable로 하던 방식에서도 이 정보는 관리자가 상담/계약 과정을 보고 수기로 알고 있는 값이었을 것이므로, 인앱으로 옮겨도 마찬가지로 관리자가 직접 입력한다.

## 결정 사항

- 매칭 대상은 `students.status = 'pending'`인 학생만 다룬다(이미 매칭된 학생에게 두 번째 과목을 추가로 매칭하는 것은 이번 스코프 밖 — 대시보드 카드가 애초에 "매칭 대기"만 집계하던 것과 일치).
- 선생님 후보는 선택한 과목을 `teacher_curriculum_templates`에 등록해둔(051에서 만든 "내 과목" 개념) `status = 'active'` 선생님만 보여준다.
- 총 회차 수(`enrollments.total_sessions`)는 관리자가 직접 입력하는 숫자 필드다(자동 계산 소스가 없음).
- 매칭 확정 시 한 트랜잭션처럼(서버 액션 안에서 순차 실행) `enrollments` insert + `students.status`를 `'active'`로 update한다.
- `(student_id, teacher_id, subject_id)` 조합의 활성 매칭은 스키마상 이미 부분 unique 인덱스로 막혀있다(`enrollments_active_unique`) — 같은 학생을 같은 선생님에게 같은 과목으로 중복 매칭하려 하면 DB가 막고, 이를 사용자 친화적 에러로 변환한다.

## UI

- **목록 화면**: 매칭 대기 학생 카드 목록 — 이름, 학년(grade), intake_type, "매칭하기" 버튼. 빈 상태는 "매칭 대기 중인 학생이 없습니다."
- **매칭 폼** (학생 클릭 시): 과목 선택(전체 `subjects` pill 버튼, 051의 과목 템플릿 탭과 동일한 패턴) → 과목 선택 시 그 과목의 `teacher_curriculum_templates`를 가진 `active` 선생님 목록이 라디오/pill로 나타남(선생님이 없으면 "이 과목을 가르치는 선생님이 없습니다. 먼저 선생님의 담당 과목을 등록해주세요." 안내) → 총 회차 수 숫자 입력(기본값 없음, 1 이상 필수) → "매칭 확정" 버튼.
- 확정 성공 시 목록 화면으로 돌아가고 그 학생은 목록에서 사라진다(더 이상 pending이 아니므로).

## 영향받는 파일

- `app/admin/matching-data.ts` (신규) — pending 학생 목록 로드, 과목별 선생님 후보 로드
- `app/admin/matching-actions.ts` (신규) — `confirmMatch(studentId, teacherId, subjectId, totalSessions)`: enrollments insert + students.status update, unique 제약 위반 시 친화적 에러
- `app/admin/MatchingTab.tsx` (신규) — 위 UI
- `app/admin/AdminShell.tsx` / `app/admin/page.tsx` — "매칭" 준비중 placeholder를 실제 탭으로 교체(다른 완료된 탭과 동일한 배선 패턴)
- 새 마이그레이션 불필요(모든 테이블/컬럼이 최초 스키마부터 존재)
- RLS: `enrollments`/`students`에 관리자 전체 권한이 이미 있는지 구현 태스크에서 확인, 없으면 마이그레이션 추가

## 스코프 제외

- 이미 매칭된 학생에게 두 번째 과목 추가 매칭
- 매칭 해제/재매칭 UI(기존 활성 enrollment를 cancelled로 바꾸는 플로우) — functional-spec의 "소프트 삭제로 이력 보존" 원칙은 스키마상 이미 지원되지만, 그 UI 자체는 083 티켓 스코프에 없음
- 선생님 추천/자동 배정 로직(관리자가 목록에서 직접 고르는 수동 방식만)
