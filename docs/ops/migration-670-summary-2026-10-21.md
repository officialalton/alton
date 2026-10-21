# 마이그레이션 670 요약 — `20262100000670_admin_attempt_facts_ap_item_count.sql` (2026-10-21)

**적용 금지. 이번 핫픽스 승인(`hotfix/admin-ap-result`)에 포함되지 않았다.** 이 브랜치에는 670 파일 자체가 없다(통합 브랜치에만 있음). 오너 별도 승인 뒤 적용.

## 목적
미채점 AP 응시(assigned/in_progress/submitted)가 관리자 응시 이력에서 문항 수 없이 '—' 로 보이는 문제의 표시 개선. 640 의 `mc_total`/`mc_correct` 는 채점 뒤에만 채워지므로, 세트 구성(`mock_exam_set_items`)에서 AP 객관식 문항 수를 세어 `mc_item_count` 로 항상 제공한다(FRQ 제외, SAT 응시는 null). 정답 수는 채점 전 null 유지.

## 변경 객체
- 함수 `public.admin_student_mock_attempt_facts(uuid)` 1개: `drop function if exists` 후 `create or replace`(반환 열 `mc_item_count int` 1개 추가, 나머지 열·본문은 640 과 동일). 테이블·인덱스·데이터 변경 없음, 추가형(additive)에 가까운 재생성. 의존 뷰·객체 없음(앱 코드만 호출).
- 실행 권한: `revoke execute … from public, anon; grant execute … to authenticated;` (640 과 동일 문장).

## 실행 권한 실측(격리 스택 ALTON_hf28, pg_proc / has_function_privilege)
| 상태 | proacl | security definer | volatility | anon / authenticated / service_role 실행 | mc_item_count 열 |
|---|---|---|---|---|---|
| 640 | `{postgres=X, authenticated=X, service_role=X}` | t | s(stable) | f / t / t | 없음 |
| 640 + 670 | `{postgres=X, authenticated=X, service_role=X}` | t | s | f / t / t | 있음 |
→ 640 과 동일(권한 변화 없음). 가드 `_free_accounts_staff()` 동일 본문(학생·상담사·권한 없는 supervisor 거부, 관리자·master·full·학생관리 supervisor 통과 — 4개 조합 통합 테스트에서 확인).

## 현재 Production 코드 영향 (main + 640 → main + 640 + 670, 격리 실측)
main 의 `factsFromRpcRows` 는 열을 이름으로 읽어 새 열을 무시한다. 목록·요약·상세 결과가 670 적용 전후 동일(AP 상세 크래시는 640 상태에서도 존재하는 기존 결함이며 670 과 무관 — `hotfix/admin-ap-result` 가 해소). SAT 응시 표시 동일.

## 핫픽스 코드와의 조합
- 핫픽스 + 640(670 없음): 미채점 AP 행 '—', 채점 AP 행 "1/3 correct (multiple choice) · …". 정상.
- 핫픽스 + 640 + 670: 미채점 AP 행 "2 questions · not graded yet" / 배정만 "3 questions · not graded yet"(통합 테스트 단언 `mc_item_count` 3/2/3, SAT null 통과).
→ 670 은 순수 표시 개선, 없어도 안전.

## 검증 결과
- 격리 DB 에서 640 → 670 순차 적용 성공(`CREATE FUNCTION/REVOKE/GRANT`), 호환 통합 테스트 3/3 통과(4개 조합), 함수 재적용(640 재실행)으로 되돌림도 확인.
- 공유 DB: 읽기·쓰기 모두 접촉하지 않음(이 실측은 전부 격리 스택).

## 적용 시 주의
- 함수 시그니처(반환 열)가 바뀌어 drop+create 이므로 적용 순간 짧게 함수가 없는 구간이 있으나 단일 트랜잭션(마이그레이션 단위)이라 외부에는 보이지 않는다.
- 롤백: 640 파일 내용을 새 번호 마이그레이션으로 재적용(열 제거). 새 번호가 필요(이미 적용된 번호는 수정해도 반영되지 않음).
