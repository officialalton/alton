# 과제 발급 방식 변경 — 1장 정리 (2026-09-16)

제품 오너 지시: 과제를 "그 수업(회차) 키워드 풀"에 묶어 복잡하게 구성하지 않는다. 교사 포털에 별도
"과제" 탭을 만들어 학생별로 아무 키워드나 골라 과제 배치를 미리 만들고, 세션뷰에서는 그 배치 목록 중
최근 것을 선생님이 클릭해 그 수업에 불러오기만 한다. 단어장 즉석 시험 발급과 같은 구조.

## 1. 사용자 흐름
- 교사 포털 "과제" 탭: 담당 학생 선택(또는 "담당 학생" 탭의 각 학생 행 "과제 관리" 버튼으로 그 학생이 미리 선택된 채 진입) → 과목 키워드별 개수 입력 → "과제 만들기" → 문제은행에서 무작위로 뽑아 **배치**(아직 어느 수업에도 안 실림)로 저장.
- 세션뷰 "과제" 탭(교사): 이 학생의 최근 배치 목록(키워드·문항 수·만든 날짜) → 원하는 배치 "이 수업에 불러오기" → 그 수업의 과제로 실제 발급(기존 `issue_homework_items` 재사용, 조회·풀이·채점 흐름 전부 그대로). 이미 발급된 배치도 다시(다른 수업에) 불러올 수 있다.
- 세션뷰 "과제" 탭(학생): 기존과 동일 — 이 수업에 발급된 과제 풀기.

## 2. 데이터와 권한
- 새 테이블 `homework_draft_batches`(student_id, created_by, source jsonb, problem_ids uuid[], created_at, loaded_at, loaded_session_id) — RLS: `teaches_student(student_id) or is_admin()`만 읽고 쓴다(학생·보호자에게는 안 보인다 — 실제 수업에 실리기 전까지는 교사 내부 준비물).
- 새 RPC `create_homework_draft_batch(p_student_id, p_requests jsonb)` — `problem_auto_composition_candidates`에서 키워드별 무작위 픽(회차 제한 없음, 이 학생에게 이미 발급된 적 있는 문제는 제외).
- 새 RPC `load_homework_batch_into_session(p_batch_id, p_session_id)` — 배치의 student_id가 그 세션 학생과 일치하는지 재검증 후, 기존 `issue_homework_items`와 같은 검증(확정·공개 버전·중복)으로 삽입하되 "회차 키워드 범위" 검사만 뺀다(배치 자체가 이미 교사가 고른 것).
- 기존 `issue_homework_items`/`issue_homework_by_keywords`/`session_homework_items`/`session_problem_work`는 스키마·동작 변경 없음(세션에 실제로 실리는 순간부터는 지금 흐름 그대로) — 풀이판이 세션에 귀속돼야 하는 제약(session_problem_work.session_id not null)을 건드리지 않는다.

## 3. UI 기준
- 교사 포털 새 탭 "과제"(VocabAssignTab과 같은 패턴): 학생 선택 + 키워드 체크박스+개수 입력 + 만들기, 최근 배치 이력.
- "담당 학생" 탭 각 행에 "과제 관리" 버튼 → `?tab=homework&student=<id>`.
- 세션뷰 HomeworkTab: 기존 "회차 키워드로 직접 발급" UI를 걷어내고 "최근 배치 불러오기" 목록으로 교체. 이미 발급된 항목 목록·회수는 그대로 유지.

## 4. 검증
- RLS/RPC 통합 테스트: 담당 아닌 교사 거절, 배치-세션 학생 불일치 거절, 회차 키워드 범위 밖 문제도 배치를 통해선 발급 가능함(정책 변경 확인), 중복 발급 방지.
- 기존 회귀: `issue_homework_items`/`withdraw_homework_item` 기존 테스트 그대로 통과해야 함(로직 변경 없음).
