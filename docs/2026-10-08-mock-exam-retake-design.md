# 모의고사 재응시 + 결과 화면 재설계 — 설계 메모 (2026-10-08)

오너 결정: 이미 응시한 모의고사도 **모든 학생이 다시 볼 수 있고, 매 응시는 별도 회차(Attempt 1, 2, …)로 기록**한다.

## 데이터
- `mock_exam_attempts.attempt_no int not null`(기존 행은 학생·시험 계열별 created_at 순으로 백필). 삽입 트리거가 advisory lock 아래서 max+1 부여.
- 유니크: 기존 `(student_id, exam_set_group_id)` 폐기 → `(student_id, exam_set_group_id, attempt_no)` 유니크 + `(student_id, exam_set_group_id) where status <> 'graded'` 부분 유니크(진행 중 응시는 시험당 하나).
- `max_attempts`/`attempt_count`는 한 번도 제한 로직에 쓰이지 않았다(attempt_count는 제출 시 1이 찍히는 플래그). 그대로 두고 재응시 제한 근거로 쓰지 않는다. 상세 응답의 기존 `attemptCount`는 덮어쓰지 않고 새 키 `attemptTotal`(그 시험 전체 회차 수)·`attemptNo`를 추가.

## 상태 전이 (`mock_exam_open_start`)
채점 전(assigned/in_progress/submitted) 응시가 있으면 그것을 돌려준다(이어하기, 멱등) → 전부 graded면 새 회차 생성(공개·구성 완료·무료 티어 검사는 새 회차에만 적용; 진행 중 응시는 세트가 보관돼도 이어갈 수 있다). 동시 시작은 부분 유니크 + `on conflict ... where status <> 'graded'`로 한 행만 생기고 모두 같은 id를 받는다.

## 읽기 경로 (모두 회차 분리, 최신 회차가 기본)
- catalog: 시험당 한 행 = 최신 회차 id·상태 + `attemptNo`·`attemptTotal` (lateral, N+1 없음).
- summaries/detail: 회차별 한 행, `attemptNo`·`attemptTotal`·`setGroupId` 추가. 목록 UI는 시험 한 줄 + "All attempts" 펼침(회차별 결과 보기), 채점 끝난 시험에 Retake.
- 결과 화면: 회차가 둘 이상이면 Attempt N | Attempt M 전환(최신 표시), 직전 회차 대비 정답 수 차이 카드.
- My Notebook: 오답 항목에 `Attempt N` 표기(항목은 attempt_id 단위라 원래 분리됨). 보드 카드·세션 탭·교사 내역·관리자 내역(한국어 "N회차")에 회차 표기.
- 약점 통계(`mock_exam_weakness_summary`): 시험당 **최신 채점 회차만** 집계(외운 문항 중복 집계 방지) — 오너 확인 필요 항목.

## 결과/통계 화면(Task B)
Summary = Overall Performance(도넛·정답 수·총 시간·면책) / Estimated Score Range(내부 추정, 비공식 표기, R&W·Math·Total 막대) / Section Breakdown(정답률·시간) / Performance by Domain (Preview, 정답률 낮은 4개 + View all) / Key Insights 카드(강점·집중 영역·찍음·문항당 시간·미응답·직전 회차 비교). 점수 추정 함수는 기존 `lib/mock-exam/score-estimate.ts`(v1-adaptive) 재사용, 새 정책 없음. 추가 쿼리 없음(재응시일 때만 요약 RPC 1회).
