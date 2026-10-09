# 게시된 풀 모의고사의 새 버전 적용 설계 (AB#1, 2026-10-09, 설계만 — 적용 안 함)

## 설계
- 같은 `set_group_id`, `version_no + 1`, 새 `mock_exam_set_items` 스냅샷(교체 10건만 다르고 나머지는 기존 공개 문항 버전 재사용), 이전 공개본은 `archived`(그룹당 공개 1개 부분 유니크 `mock_exam_sets_one_published_per_group`).
- 기존 응시·답안·결과는 옛 버전에 그대로 보존(`mock_exam_attempts.exam_set_id` 가 시작 시점 버전 고정, `mock_exam_answers.set_item_id` 가 그 버전 항목).
- 진행 중 응시는 중간에 바꾸지 않는다(`mock_exam_open_start` 가 채점 전 응시를 이어 하므로 옛 버전으로 계속).
- 기존 응시자가 새 버전을 다시 풀 수 있다. UI 는 **'Updated version'** 표시 + 이전 응시에서 이미 푼 문항 수(새 세트와 겹치는 문항 = 이전 응시 항목과 `problem_version_id`/문항이 같은 것)를 보여주고, **독립된 새 모의고사로 세지 않는다**(재응시 회차로 취급).

## 코드 현황 점검
| 항목 | 현재 |
|---|---|
| 버전 컬럼·유니크 | 있음(`20261415…p7_mock_exam_v1_foundation.sql`) |
| 새 버전 공개 시 이전 공개본 archive | 있음(`app/admin/mock-exam-actions.ts` publish: 기존 공개본 archive → 새 버전 publish) |
| 응시의 버전 고정, 보관 세트의 지난 응시 표시 | 있음(`attempts.exam_set_id`, `open-list.ts` `archived`) |
| 재응시(회차) | 있음(`attempt_no`, 마이그레이션 `…370_mock_exam_retake_attempt_no.sql`; 학생×세트 계열 진행 중 1개) |
| 진행 중 응시 유지 | 있음(`mock_exam_open_start` 이어하기) — 새 버전 공개 뒤에도 옛 응시를 이어 한다는 통합 테스트는 확인 필요 |
| **기존 세트에서 `version_no+1` 초안·문항 일부 교체를 만드는 관리자 동작** | **없음**(읽기만 있고 version_no 증가 생성 코드 없음) → 필요 |
| 'Updated version' 표시와 이전 응시와 겹친 문항 수 | **없음**(UI·조회 없음) → 필요 |
| 응시가 독립 시험으로 집계되는지(`score-aggregate`/`insights`가 attempt_no·`exam_set_group_id` 를 구분) | 확인 필요(grep 상 해당 파일에 그룹/회차 구분 없음 → 같은 계열 재응시를 독립 응시로 셀 수 있음) |
- 필요한 코드(만들지 않음): (1) 새 버전 초안 생성 RPC/액션(그룹 복제 + 교체 항목 적용 + 게이트 재검증), (2) 학생 목록·시작 화면 배지와 겹침 수 조회(응시 답안의 `problem_version_id` ∩ 새 세트 항목, 쿼리 1개), (3) 집계·인사이트의 재응시/새 버전 취급 확인·보정, (4) 진행 중 응시가 새 버전 공개 뒤에도 옛 버전으로 완료되는 통합 테스트.
- 오너 결정 필요(이미 보고된 것): 이미 응시한 학생의 새 버전 점수를 새 시험 점수로 볼지(위 설계는 재응시 회차). 지금 응시자가 없으면(테스트 계정 제외) 부담 없음.
