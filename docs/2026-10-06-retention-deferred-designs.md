# 보존·삭제 보류 항목 설계 (내부 문서, 2026-10-06)

자동화 미구현 항목의 설계만 담는다. 사용자 노출 문구 없음. 모든 삭제·익명화 경로는 `has_active_legal_hold()`를 먼저 확인한다(20262100000082/83/100).

## 1. 가족(보호자-관리자) 메시지 건 식별 — `inquiry_case_id`
현황: `household_messages(household_id, sender_id, body, status open|resolved, created_at)`는 가구당 하나의 긴 대화이고, 건 묶음 키가 없다. `meeting_request_messages`(요청 단위), `household_inquiries`·`consultations`는 별도 건 단위를 가진다. 방 전체 기준(마지막 메시지+2년)으로 지우면 오래된 건의 메시지가 최근 건 때문에 영구 보존되거나 반대로 진행 중 건이 지워질 수 있다.
설계:
1. 테이블 `inquiry_cases(id, household_id, opened_at, closed_at, consultation_id null, meeting_request_id null)`; `household_messages.inquiry_case_id uuid null` 추가(additive).
2. 백필: 같은 가구 메시지를 `status='resolved'` 전환 시점 또는 7일 이상 공백으로 분할해 건 생성, 연결된 면담 요청(`source_message_id`)·상담이 있으면 그 건에 귀속. 모호한 건은 가구 단위 한 건으로 두고 관리자 검토 목록에 올린다.
3. 신규 메시지는 열린 건에 자동 귀속, 없으면 새 건 생성. resolved 처리 = `closed_at` 기록.
4. 보존 기준: 건의 `closed_at`(상담·면담 종료일이 있으면 그 날짜) +2년, 없으면 건의 마지막 메시지+2년. 삭제는 메시지 본문만, 건 행은 통계용 유지. hold는 household·consultation 대상 모두 확인.
5. 롤아웃: 컬럼·백필 → 앱 신규 메시지 귀속 → 건별 삭제 함수(dry-run 먼저) → 배치 편입. `consultant_admin_messages`(0건)·`meeting_request_messages`(요청 종료일 기준)도 같은 패턴.

## 2. 레거시 채팅 테이블 이관·폐기 계획
조사 결과: `chat_threads/chat_messages`는 로컬 0건이나 `app/student/ChatPanel.tsx`, `chat-actions.ts`, `chat-data.ts`, `teacher-data.ts`가 읽고 쓰며, 계정 병합 함수(r2_account_merge, r3_contracts_cutover)가 소유권을 이전하고, realtime publication(r9_annotation_events_realtime)을 전제로 한다. 신규 흐름은 `subject_threads/subject_thread_messages`(배정 단위, archived 상태 보유).
계획: (1) 학생 ChatPanel이 쓰는 실제 화면·진입점을 확인(기능 플래그 여부) (2) 사용 중이면 subject_threads로 화면을 전환, 미사용이면 UI 제거 (3) 운영 데이터가 생긴 뒤라면 (student, teacher) 쌍 → teacher_assignment 매핑으로 메시지 이관(매핑 불가 건은 보류 목록) (4) 쓰기 차단 → 일정 기간 읽기 전용 → 테이블 drop은 별도 승인. 이름·연식만으로 삭제하지 않는다. 이관 전까지 보존 자동화는 두지 않는다(종료 개념 없음).

## 3. 무료회원 3년 삭제·익명화 범위
시작점: `student_last_learning_activity()`(실제 학습 이벤트만, 로그인·하트비트·알림 제외) +3년, 활성 과외 수강이 있으면 보류. 과외 전환 이력이 있으면 출결·학습이력은 `tutoring_service_end()` +3년과 비교해 더 늦은 쪽(활성 수강 있으면 보류).
| 자료 | 처리 |
|---|---|
| 모의고사 응시·답안(mock_exam_attempts/answers) | 삭제(개인 학습 기록). 문항 통계에 쓰이는 집계는 비식별 집계로만 유지 |
| 오답노트(saved_to_practice 답안) | 삭제(위 답안과 함께) |
| 단어장·퀴즈(vocab_words/quizzes) | 삭제 |
| 자료 읽기 위치·학습 이벤트 | 삭제 |
| 학생 프로필 | 계정 상태에 따름: 무료 계정 폐쇄 요청이면 §4 절차, 단순 장기 미활동은 `inactive` 유지(자동 익명화 금지, §4.13) |
| 상담·계약·결제 기록 | 학습 이력 삭제와 별개로 각자 기준(상담 2년, 계약·결제 7년) |
구현 순서: 대상 선정 쿼리(dry-run, hold 검사) → 사전 통지·보관 목적 재검토(§4.13 "기간이 끝났다고 즉시 삭제하지 않음") → 삭제 함수 → 배치 편입.

## 4. 아동 정보 조기 삭제 — 보호자 삭제 요청 흐름
원칙: 보호자(또는 13세 미만이면 보호자 대리)가 요청하면 목적이 끝난 데이터를 보존기간 만료를 기다리지 않고 삭제한다. 과외 종료 ≠ 모든 학습 목적 종료이므로 무료 학습을 계속하는 계정은 학습 데이터를 유지하고 과외 전용 자료만 대상으로 한다(본인이 무료 학습 삭제까지 요청하면 포함).
흐름:
1. `child_deletion_requests(id, child_id, household_id, requested_by, requested_at, scope[tutoring|free_learning|all], status requested|verified|processing|completed|partially_completed|rejected, verified_by, completed_at)` — 보호자 포털에서 접수, 본인 확인 후 관리자 승인.
2. **가구 archive 요청(`household_archive_requests`)은 삭제 요청을 자동으로 무효화하지 않는다.** 두 요청은 독립 상태로 관리하고, archive 처리 시에도 열린 삭제 요청이 있으면 삭제 흐름이 우선 진행된다.
3. 예외(삭제 보류)는 개별 기록: `legal_holds`(subject_type=student) 또는 요청 행의 `exception`(대상·사유·기간 필수, review_by 필수) — 일반 메모로 대체 불가. 보류 대상은 요청자에게 통지.
4. 자료군별 처리:
   - 삭제: 학습이력(과제·필기·리뷰·모의고사·오답노트·단어장), 수업 메시지·상담 메모, Smart Notes·전사·수업자료(Drive 삭제 큐 경유), 프로필 부가정보(학년·학교·사진·연락처).
   - 보존(최소 식별자만): 계약·가격·동의·결제·환불·원장·정산 귀속 — 법정·회계 보존 기간 동안 계약/거래 식별에 필요한 최소 필드(이름 이니셜 또는 계약 ID, 거래 ID, 금액·일자)만 남기고 접근 제한. **계정 ID 치환만으로는 익명화로 보지 않는다**: 다른 필드로 재식별 가능하면 해당 필드를 함께 제거·일반화.
5. 처리 결과는 요청 행에 자료군별 완료/보류(사유·기간) 기록, 삭제 실패는 Drive 큐와 같은 재시도·관리자 알림 경로를 쓴다.
구현 가능한 선행 작업(이번에는 미구현): 요청 테이블+상태머신, 자료군별 삭제 매핑표(테이블 목록)와 dry-run 보고, hold 검사 연동. 정책 확인 필요: 13세 미만 외 미성년(13~17세)의 본인 직접 요청 허용 여부, 최소 식별자 목록의 법무 확정.
