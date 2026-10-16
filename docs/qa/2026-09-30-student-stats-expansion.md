# 학생 통계 탭 확장 — 착수 전 1장 정리 (2026-09-30, 브랜치 `feat/student-stats-expansion`)

## 1. 사용자 흐름
- 열람 위치: 학생 포털 홈 > `통계` 서브탭 / 학부모 포털 홈 > `통계` 서브탭(자녀 전환 시 다시 로드) / 관리자 학생 상세·컨설턴트 담당 학생 > `통계` 탭. 선생님은 통계 탭 없음.
- 정상: 탭 진입 시 스켈레톤 → 섹션 카드(학습 성과 / 모의고사 / 학습 습관 / 수업 운영 / 수업권 / 선생님 피드백[관리자]). 실패: 오류 문구 + `다시 시도`. 데이터 없음: 섹션별 빈 상태 문구.
- 열람 기록: 관리자·컨설턴트만 기존대로(`record_staff_student_view`), 학부모·학생 본인은 기록 안 함.

## 2. 데이터와 권한
- 원천: 새 정의자 함수 `student_stats_aggregate(p_student_id, p_include_staff)` 1개(마이그레이션 `20261960000000_student_stats_aggregate.sql`, service_role 전용, 내부에서도 `_is_service_role()` 재검사). 서버 액션이 권한 검사(`assertCanViewStudent`/학생 본인/`is_guardian_of`) 통과 후 서비스 클라이언트로 호출 — `auto_correct`·`raw_correct_count` 컬럼 권한 구조는 그대로(함수가 읽고 집계 수치만 반환, 문항·정답 ID 없음).
- 정오 집계는 교사 채점 확정(`graded_at`/`graded=true`)된 응답만. `partial`은 오답으로 센다. 원천: `session_problem_work` + `homework_batches.items`.
- 역할별 노출(서버가 필드를 빼서 내려준다):

| 항목 | 학생 본인 | 학부모(본인 자녀) | 컨설턴트(담당) | 관리자 | 선생님 |
|---|---|---|---|---|---|
| 통계 탭 | O | O(학생과 동일) | O | O | 없음 |
| 참여율·과목별·skill·과제·습관·수업운영·수업권 | O | O | O | O | - |
| 선생님 피드백 만족도 | X | X | O | O | - |
| 모의고사 예상 점수 범위 추이(총점) | O | O | O | O | - |
| 모의고사 섹션 범위·섹션/영역 강약 | X | X | O | O | - |
| 선생님 리뷰 작성 현황·채점 지연(관리자 전용) | X | X | X | O | - |
| 모의고사 경로·난이도·정책 버전·modelVersion | X | X | X | X | - |

## 3. UAT 데이터
- 자동 테스트는 실행 ID(`RUN`) 전용 학생·문제·과제·단어·보드·수업권·모의고사 세트만 생성, 종료 시 학생/세트 외 행 정리. 공식 계정은 읽기 전용(미사용).

## 4. UI 기준
- 카드 섹션 + 요약 4칸, 약점 skill 막대(값은 글자로도 표기, 변화는 ▲/▼ 글자), SVG 추이선·주별 막대·점수 범위 막대(외부 라이브러리 없음), 차트는 `role="img"` + aria-label 요약, 표는 caption/scope. 모바일 1열, 날짜는 `lib/format-datetime.ts`(Asia/Seoul).

## 5. 검증과 성능
- 탭 1회 열람 = 서버 액션 1회(클라이언트 추가 요청 0) → DB 쿼리: 기존 요약 3(학부모·학생 family는 만족도 조회 생략, 직원 4) + 집계 RPC 1, 병렬. 권한 판정 2(프로필 + RPC 1). 문제 수·응답 수에 비례하는 N+1 없음(skill·주·월 집계는 SQL 안). 인덱스 추가: `session_problem_work(student_id, submitted_at desc)` partial, `vocab_words(student_id, created_at desc)`.
- 테스트: 순수 지표 단위, 화면(빈·로딩·오류·역할별), 액션 권한 매트릭스, 재실행 안전 통합(격리 스택).
