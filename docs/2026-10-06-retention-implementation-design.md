# 보존·삭제 구현 설계 (내부 문서, 2026-10-06)

사용자 노출 문구 없음. 기준: 사이트 개인정보처리방침의 통일 보존표 + product-architecture-v3 §4.13 + 기획자·오너 답변(Q1~Q5).
배치(`RETENTION_BATCH_ENABLED`)·cron·`RETENTION_DRIVE_DELETION_ENABLED`는 모두 닫힌 상태로 유지한다.

## 1. 구현된 것 (migrations 20262100000081~83)
| 항목 | 시작점 | 구현 |
|---|---|---|
| 알림 90일, 접근로그 1년, 상담·잠재고객 2년 | 기존 | 기존 + legal hold 검사 추가(083) |
| 수업 스레드·교사-관리자 메시지 | 스레드 archived / 문의 closed +2년 | `retention_delete_expired_*_messages` |
| Smart Notes 문서·전사(Drive) | **각 수업 종료일(`sessions.actual_end_at`) +1년**, 수강 지속으로 연장하지 않음 | 큐 적재 → Drive 삭제 워커 → 성공분만 DB 정리 |
| legal hold | — | `legal_holds`, `legal_hold_events`, place/extend/release RPC |
| 정책 레지스트리 | — | `retention_policies`(기준표, 신규 산출물은 행 추가로 같은 일정에 연결) |

### Smart Notes 삭제 순서 (DB 선삭제 금지)
1. `retention_enqueue_expired_smart_notes`: 만료 대상의 `drive_file_id`를 `retention_deletion_targets`에 기록(DB 행은 그대로). 멱등(unique). hold 대상 제외.
2. 워커(`lib/retention/drive-deletion.ts`): `retention_claim_deletion_targets`(hold 재검사, skip locked) → Drive DELETE(404=성공) → `retention_mark_deletion_result`. 실패는 `failed` + 지수 백오프(최대 7일), `last_error` 보관 — 관리자 조회 가능, 자동 재시도.
3. `retention_finalize_deleted_smart_notes`: Drive 삭제 성공(`deleted`) 후에만 `session_smart_notes` 행 삭제, `smart_notes_generation_events`의 raw_payload·Drive/회의 식별자 제거.
테스트: SQL 통합 테스트 + 워커 단위 테스트(Drive mock). 실제 Drive 삭제는 실행하지 않았다.
관리자 재처리 화면은 아직 없음(큐 테이블 조회만 가능) — 후속 UI 작업.

### 녹화(Q1)
현재 시스템에는 전사·Smart Notes만 있고 녹화 파일·기능이 없다. `retention_policies.lesson_recordings`는 `no_feature`로 등록해 두었고, 녹화 기능이 생기면 같은 큐(`category='lesson_recording'`)와 같은 수업 종료일+1년 기준에 연결한다.
동의 범위: 기존 `ai_notes_consent_events`는 선택형 AI 노트 동의(정책 변경으로 계약서 서명 일원화)이고, 전사·Smart Notes 보존·삭제에 대한 별도 동의 레코드는 없다 → 계약서 조항이 유일한 근거. 계약 문안에 "전사·Smart Notes를 수업 종료 후 1년 보관 후 삭제" 포함 여부를 기획자 확인 필요.

### 녹화·전사·AI 노트 동일 규칙 (2026-10-07 지침, migration 20262100000192)
- 영상 녹화·음성 녹화·전사·AI 노트/요약은 **각 수업 또는 상담 종료일 +1년**에 삭제 대상이 되며 수강 지속·재수강으로 연장하지 않는다. 사용자 문구도 같은 표현("lesson or consultation")으로 통일했다.
- `retention_policies`: `lesson_ai_artifacts`(전사·Smart Notes, 구현됨)와 `lesson_recordings`(영상·음성, `no_feature`)를 같은 규칙의 산출물 유형으로 등록했다. 신규 산출물은 행 추가 + 같은 큐(`retention_deletion_targets`) 연결만 하면 된다.
- 외부 저장소(Drive) 삭제 실패는 `failed` + 백오프로 추적·재시도(기존 워커). **파일 연결 정리 전 DB 행 삭제 금지**(Smart Notes는 이미 이 순서로 구현됨, 녹화는 같은 순서를 강제하는 것이 활성화 선행 조건).
- 상담(consultation) 산출물(2026-10-07, migration 20262100000200): 현재 상담 산출물은 첫 상담 Smart Notes 파일(`consultations.smart_notes_drive_file_id`) 하나다(후속 상담 `meeting_requests`에는 산출물 컬럼 없음). `retention_enqueue_expired_consultation_artifacts`가 `coalesce(ends_at, completed_at, scheduled_at)+1년` 경과분을 같은 큐에 적재(상담·학생·가구·전체 hold 제외)하고, `retention_claim_deletion_targets`가 상담 hold를 다시 확인하며, `retention_finalize_deleted_smart_notes`는 Drive 삭제 성공 후에만 `smart_notes_drive_file_id`를 비운다(그 전에는 컬럼 유지). 적재 함수는 어떤 크론에도 연결하지 않았다(스위치 닫힘).
- **정책 충돌 보고**: 첫 상담은 "녹화·전사·AI 노트 실행에서 항상 제외"인데, 현재 시스템은 첫 상담에도 별도 상담 동의(consult_consent_versions)로 Smart Notes를 생성해 관리자 전용으로 저장한다. 문구·게이트는 지침대로 제외이고 이 기존 기능은 건드리지 않았다. 유지·중단 결정이 필요하다.
- 활성화 선행: 실제 녹화는 `lib/legal/recording-gate.ts`(회차 유형, 서명 계약 문구 버전, 13세 미만 보호자 동의, 추가 참석자)를 통과해야 한다. 이번 작업은 게이트와 동의 문구만 구현했고 녹화·삭제 실행은 하지 않았다.

### 무료회원 학습 이력 3년 (Q2)
`students.last_active_at`은 포털 진입 하트비트(`touch_student_activity`, 10분 쓰로틀)라 기준으로 쓰지 않는다. `student_last_learning_activity(student_id)`는 실제 학습 이벤트만 합산한다: 모의고사 응시, 단어 추가·퀴즈 제출, 자료 읽기 위치, `student_learning_events`(학습 화면 열람 기록만 쌓임). 로그인·하트비트·자동 알림은 갱신 사유가 아니다. **삭제 자동화는 아직 없음** — 무엇을 지우고 무엇을 비식별화할지(응시 기록, 오답노트, 단어장) 확정 후 구현.
과외 학생(출결·학습이력 3년)은 "과외 서비스 종료일"이 필요한데 단일 컬럼이 없다(subject_enrollments 종료 시각 + 계정 상태 조합). 활성 수강이 있으면 학습이력은 보류하되 오래된 수업자료(위 1년 규칙)는 면제하지 않는다. 종료일 정의 확정 전까지 미구현.

## 2. legal hold (Q4)
- 대상: global / profile / student / household / consultation / enrollment / session / prospect_contact / consult_request. scope 배열, 구체적 사유(10자 이상), set_by/set_at, **review_by 필수**(내일~12개월), released_by/at, 변경 이력 `legal_hold_events`(INSERT-only).
- 일반 관리자는 무기한 설정 불가. 연장은 `extend_legal_hold`(사유 필수, 매번 12개월 이내)로 이력에 남는다. 직접 INSERT/UPDATE 불가(RLS 정책 없음 + 변경 가드 트리거).
- review_by가 지나도 **자동 해제하지 않는다**. `legal_hold_notify_reviews_due`가 설정자에게 알림 + 이력(7일 간격).
- 검사 적용 경로: 모든 `retention_*` 함수, Drive 삭제 큐(적재·claim), `anonymize_merged_account`(래퍼가 거부). 계정 closed 전환은 삭제가 아니라 접근 제한이므로 대상 아님; 향후 closed 계정 최종 익명화 경로를 만들면 반드시 `has_active_legal_hold` 호출.
- 미해결: hold 설정 UI(관리자 화면), 어떤 관리자 권한이 설정 가능한지(현재 `is_admin()` 전체), 일반 hold 알림을 총괄 관리자에게 별도 전달할지.

### 인사·급여·정산 기록 분류 (자동 삭제 없음 — `retention_policies`에 manual_only)
| 분류 | 시작점 | 기간 | 성격 |
|---|---|---|---|
| 계약·가격·동의, 결제·환불·원장 | 계약/거래 종료 | 7년 | 회사 운영 기준(세무·회계 법정기간은 법무 확인) |
| 선생님·컨설턴트 정산(해외 송금 포함) | 지급 완료/계약 종료 | 7년(운영) | 해외 송금은 별도 법정 기간 가능 — 법무 확인 |
| 직원 인사 기록 | 퇴직일 | 최소 3년(California, 확인 필요) | 법정 최소; 회사 7년과 별개 |
| 급여·근무시간·출결 | 지급일/근무일 | 최소 3년(CA)·연방 세무 4년(확인 필요) | 법정 최소 |
위 법정 기간은 개발 쪽 정리이므로 법무 확인 전에는 확정값이 아니다.

## 3. 채팅·상담 메시지 (Q3)
- 가족(보호자-관리자) 메시지 `household_messages`: 기본 = 마지막 메시지 +2년, **건(case) 묶음 단위**. 상담 건 종료일이 있으면 그 날짜 기준. 현재 `source_message_id`로 면담 요청과 연결되는 구조뿐이고 건 묶음 키가 없다 → 설계: 대화를 `inquiry_case_id`로 묶는 컬럼 추가 후(미구현) 건별 마지막 활동+2년. 지금 구현하면 방 전체 기준이 되어 오삭제 위험 → 보류.
- 레거시 `chat_threads/chat_messages`: 현재 DB 0건이지만 `app/student/ChatPanel.tsx`, `chat-actions.ts`, `chat-data.ts`, `teacher-data.ts`가 실제로 읽고 쓰며 계정 병합 함수가 소유권을 이전한다. 이름·연식만으로 폐기·이관하지 않는다. 사용처 정리(기능을 subject_threads로 일원화할지) 결정 후 폐기. 정리 전에는 thread 종료 개념이 없어 보존 자동화도 없음.
- `consultant_admin_messages`(0건), `meeting_request_messages`(15건)도 종료 기준 확정 후 같은 방식 적용.

## 4. 아동 정보 조기 삭제 (Q5) — 설계만(데이터 모델은 hold로 예외를 기록)
- 과외 종료 ≠ 모든 학습 목적 종료: 무료 학습 계속 여부를 구분한다(활성 free 계정이면 학습 데이터 유지, 과외 전용 데이터만 대상).
- 계약·결제는 일괄 익명화 금지: 법정 보존에 필요한 최소 식별자만 남기고 불필요한 아동 데이터(프로필 부가정보, 학습이력, 메시지, 자료)는 삭제. 계정 ID 치환만으로 익명화로 보지 않는다.
- 가구 archive 요청(`household_archive_requests`)은 자녀 삭제 요청을 자동으로 무효화하지 않는다. 예외(삭제 보류)는 반드시 **사유·범위·기간**을 기록 → `legal_holds`(subject_type=student, scope 배열, review_by)로 표현.
- 구현 순서 제안: (1) 삭제 요청 레코드(요청자·자녀·접수일·상태) (2) 자료군별 삭제/비식별화 매핑표 (3) 요청 처리 RPC가 hold 검사 후 실행 (4) 관리자 UI. 1~2는 정책 확인 후.
