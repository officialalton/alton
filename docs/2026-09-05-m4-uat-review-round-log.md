# M4 UAT 종합 검증 라운드 — 업무 로그 (2026-09-05 야간)

세션 컨텍스트가 매우 커서 새 세션에서도 이어갈 수 있도록 이번 라운드에서 완료·보류한
내용을 정리해둔다. `docs/CURRENT.md`는 아직 갱신 안 함 — 이 로그를 검토한 뒤 다음
세션에서 확정된 결정 기준으로 `CURRENT.md`에 반영할 것.

## 완료(배포까지 끝남, Preview 별칭 반영 완료)

1. **레거시 계약 화면 삭제** — `ContractsTab`/`contracts-actions.ts`/`contracts-data.ts`
   + 관련 테스트·R3 e2e 스펙 전부 삭제. 그 화면에만 있던 "재발송(새 버전 생성)"은
   `TrialOnboardingPanel`에 이식(재발송 버튼).
2. **에러 바운더리 추가** — `app/{admin,parent,student,teacher}/error.tsx`. 이전엔 한
   패널 렌더링 오류가 전체 포털을 "새로고침 말고는 복구 불가" 상태로 만들었음(React
   error #441 = "Server Components 렌더링 중 오류", production에선 원인 메시지 은폐).
3. **디버그 라우트 제거** — `app/api/debug-vercel-env`(env var·프로젝트 id 노출).
4. **참가자 join/leave 이벤트 403 버그 수정** — Smart Notes와 동일한 고정 관리자
   subject 버그가 여기도 있었음. `resolveOrganizerSubjectFromCeSubject()` 공통
   헬퍼로 통합.
5. **SMTP 미설정 시 가짜 성공 처리 수정** — `sendEmail()`이 이제 실제로 throw함.
   이메일 본문 HTML escape(`escapeHtml`) 추가, 확인된 2곳(온보딩 이메일)에 적용.
6. **선생님 배정 후 학생 활성화 실패가 콘솔 로그로만 남던 버그 수정** —
   `assignTeacherToSubjectEnrollment`가 이제 `activationWarning`을 반환, 관리자
   화면 2곳(SubjectEnrollmentPanel, TrialOnboardingPanel)에 노출.
7. **온보딩 계정 생성 부분 실패 시 고아 Auth 계정 정리** — 학생 계정 생성 실패 또는
   finalize RPC 실패 시 이미 만든 Auth 계정(들)을 삭제하도록 수정.
8. **Smart Notes 원본 식별자 노출 수정(#10)** — `sessions.smart_notes_drive_file_id`는
   행 단위 RLS라 학생·보호자 본인 세션이면 직접 조회 가능했음(정책 위반). 새 테이블
   `session_smart_notes`(담당 선생님·관리자·QC만 조회 가능한 RLS)로 분리, 기존 데이터
   백필 후 컬럼 삭제. 웹훅(쓰기)·선생님 일정 화면(읽기) 갱신.
9. **Workspace Events 재처리 상태 머신(#11)** — 두 이벤트 분기(Smart Notes 생성,
   참가자 join/leave) 모두 DB 반영 실패를 200(ack)으로 반환해 Pub/Sub 재시도를
   스스로 막던 버그 수정(이제 500 반환). Smart Notes 쪽은 추가로: 이전엔 같은
   pubsub_message_id 행이 "존재하기만 하면" 무조건 재처리를 건너뛰어서, 첫 시도가
   session/driveFileId를 못 찾은 미완료 상태로 남아도 재전송이 영원히 무시됐음 —
   이제 `linked && drive_file_id`가 모두 갖춰진 완료 행만 건너뛰고, 미완료 행은
   upsert로 다시 해석을 시도한다(멱등).
10. **학생 이메일 조기 확인 버그 수정(#2 원안)** — 학생 Auth 계정이 생성 즉시
    `email_confirmed_at`이 찍혀 있어 "Calendar 초대 전 이메일 검증 확인" 게이트
    (`resolveVerifiedStudentEmail`)가 항상 통과하는 죽은 코드였음. 이제
    `email_confirm: false`로 생성하고, 학생이 실제로 비밀번호 설정 링크를 열어
    제출에 성공하는 시점(`app/set-password/actions.ts`)에만 확인 처리 — 학생에게
    별도 단계를 추가하지 않음(이미 필수였던 첫 로그인 절차 자체가 검증 이벤트가 됨).
11. **관리자 UI 정리**: "제안서 관리" 탭 제거(요청 1번), "상담 관리" → "상담 현황"
    이름 변경(요청 3번), "보호자 동의 대기"를 대기/완료 하위 탭으로 분리(요청 7번,
    `loadCompletedConsents()` 신규).

모든 항목 tsc 클린, 전체 Vitest(947건, 기존부터 있던 로컬 통합 테스트 1개 파일만
날짜 의존적 flaky — 이번 변경과 무관, 실행마다 통과/실패가 갈림) 확인 후 배포·마이그레이션
반영 완료. Production/main 미변경.

## 의도적으로 보류(이유와 함께) — 다음 세션에서 확정 후 진행

### #2(프로필 필드 추가) — 스키마 설계만 먼저 확인 필요
요청: 학생 계정 설정 시 생년월일(필수)·학교명(필수)·학년(필수)·기존 SAT 점수(없으면
0)·GPA·AP 이수 상황·비교과 현황·목표 대학·관심 전공을 추가로 받아야 함.
**막힌 지점**: 이걸 `/set-password` 화면(학생이 처음 로그인하는 그 화면, 지금은
비밀번호만 받음)에 통째로 추가할지, 아니면 로그인 후 별도 "프로필 완성" 단계로
분리할지가 UX 결정 사항. 또한 AP 이수 상황·비교과 현황처럼 자유 텍스트/여러 개
입력이 필요한 항목은 단일 컬럼이 아니라 별도 테이블(예: `student_ap_courses`)이
나을 수 있어 스키마 형태를 먼저 정해야 함. **다음 세션 시작 시 질문할 것**: (a) 첫
로그인 화면에 다 넣을지 별도 단계로 분리할지, (b) AP 과목/비교과를 자유 텍스트 한
칸으로 받을지 구조화된 리스트로 받을지.

### #3.1(상담 관련 액션을 상담 현황 안으로 통합) — 범위 조사만 하고 미착수
"선생님 배정만 빼고" 상담 과정의 모든 버튼이 상담 현황 안에서 클릭 가능해야 함.
지금은 매칭 탭(`SubjectEnrollmentPanel`, `TrialOnboardingPanel`)에 흩어져 있는
체험 동의·체험수업권·리뷰 확정·정규 계약 발송 등을 상담 탭 쪽으로 옮기거나 재구성
해야 함 — 이건 관리자 정보구조(IA) 자체를 다시 짜는 작업이라 5번 항목(보드뷰)과
사실상 하나의 리디자인이다. 5번과 함께 설계해야 일관성이 생김.

### #4(체험 리뷰를 정식 리뷰 형식으로, 프로필에 별도 저장) — 미착수
요청: AI 미팅록 기반 자동 요약 + 카테고리별 선생님 의견 작성 방식으로 전환하고,
학생·보호자 포털에서 "지난 수업"의 리뷰 버튼으로 노출. 이건 지금 "대상자 이름
아래 한두 줄" 수준인 체험 리뷰 데이터 모델 자체를 정규수업 리뷰와 같은 구조로
새로 설계해야 하는 일 — 정규수업 리뷰 스키마·화면을 먼저 확인하고 그 구조를
체험에도 그대로 적용하는 형태가 될 것 같음. **다음 세션에서 정규수업 리뷰 스키마
위치부터 다시 확인 후 설계안 제시.**

### #5(상담 종료 버튼 + 지난 상담 탭 + 5단계 보드뷰) — 미착수, 가장 큰 항목
- "상담 종료" 버튼 → 리뷰 작성 팝업(AI 미팅록 요약의 재요약본) → 종료 처리 → "지난
  상담" 탭에 표시. 4가지 종료 유형(체험 없이 종료/체험 후 종료/정규 진행 중 종료/
  정규 계약 날인)별 필터·통계.
- "상담 현황"은 13단계 대신 5단계(상담 신청 – 상담 일정 확정 – 체험 신청 – 체험
  일정 확정 – 계약서 전달)로 압축한 칸반 보드뷰로 재구성.
이건 관리자 상담 화면 전체를 다시 만드는 작업이라 하룻밤에 안전하게 끝낼 범위가
아니라고 판단해 손대지 않았다. **다음 세션 우선순위: 이 항목의 화면 설계(보드뷰
컬럼 정의, 종료 리뷰 팝업 필드, 통계 지표)를 먼저 사용자와 확인한 뒤 착수.**

### #6(상담 등록에 캘린더뷰) — 미착수
상담 등록 시 일정을 캘린더뷰로 넣을 수 있어야 함 — `ConsultationSchedulingPanel`에
캘린더 위젯 추가 정도로 비교적 작은 작업으로 보이나, 5번 리디자인과 같은 화면을
건드리므로 5번과 함께 처리하는 게 효율적이라 순서상 뒤로 미룸.

### #9(체험 Smart Notes 동의 버전 — 클라이언트가 보낸 버전 문자열을 서버 검증 없이 저장)
사용자가 "법률 검토 받고 오픈 전에만 정리하면 됨, 큰 이슈 아님"으로 확정 — 액션
없음, 그대로 둠.

## 확인 필요(기획자 회신 대기 중이던 원본 질문, 아직 미해결)
- 관리자 코드 전반 점검에 대한 기획자 의견은 아직 회신 없음 — 회신 오면 위 "보류"
  목록과 대조해 우선순위 재조정할 것.

## 이번 라운드 커밋 목록(순서대로)
```
fca1a56 chore: remove legacy contract admin screen, add route-level error boundaries
1a2af3c fix: 3 confirmed planner-review bugs (SMTP fake success, unescaped email HTML, silent activation failure)
8f0fa7f fix: clean up orphaned Auth accounts when trial-onboarding finalize partially fails
49f193a fix: move Smart Notes raw Drive identifier out of student/guardian-readable sessions row
01769b9 fix: workspace-events webhook actually lets Pub/Sub retry real DB failures, and self-heals incomplete redeliveries
6d23296 fix: student email confirmation is now tied to a real verification event
e64b109 feat(admin): remove 제안서 관리 tab, rename 상담 관리 to 상담 현황, split 보호자 동의 into 대기/완료
```
(이전 라운드 — 같은 세션 앞부분: dc90525, 187edce, 41be830, 3b79596, 16a65f9 등)
