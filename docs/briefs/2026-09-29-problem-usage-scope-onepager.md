# 문제 용도(usage_scope) + 유사문항 그룹 자동 부여 — 1장 정리

작성: 하위 에이전트(2026-09-29). 제품 오너 결정 A(생성 시 일반용/모의고사용 분류)·B(similarity_group 자동 부여). 구현 전에 적은 계획이며, 실제 구현과 달라진 점은 맨 아래 "설계 편차"에 적는다.

## 1. 사용자 흐름
- 관리자: 문제은행 `생성`에서 **용도(일반용/모의고사용)를 먼저 고른다(필수, 기본값 없음)** → 직접 생성·AI 생성·계산형 배치 모두 같은 선택을 쓴다. 고르기 전에는 버튼이 비활성.
- 관리자: 목록에서 용도 배지·필터로 보고, 기존(미분류, `both`) 문제는 체크박스 선택 또는 "필터 전체"로 일괄 재분류(확인창에 개수, 실행 시 서버가 개수를 다시 대조). 상세에서 단건 재분류·유사문항 그룹 직접 수정.
- 관리자: 모의고사 관리 `생성`에서 영역·세부 기술별 모의고사용/기존/일반용 공개 문항 수를 본다.
- 교사·학생: 화면 변화 없음. 모의고사용 문제는 수업·과제 후보에서만 조용히 빠진다.
- 실패·취소: 용도 미선택은 서버 액션·RPC가 거절, 재분류 개수 불일치는 실행 안 하고 새로고침 안내.

## 2. 데이터와 권한
- `problems.usage_scope` text NOT NULL check in (general, mock_exam, both), default `both`(기존 행 전부 both — 동작 변화 0). `problems.similarity_group_manual` boolean(수동 잠금).
- `both`는 레거시 전용: 다른 값→`both` UPDATE는 트리거가 거절, `create_bank_problem`은 general|mock_exam 필수, 5인수 옛 오버로드 삭제.
- 재분류 RPC `retag_problem_usage_scope`(service_role 전용) + 트리거가 모든 변경을 `problem_usage_scope_changes`(append-only, 수정 불가)에 기록(누가/언제/from→to/사유/배치).
- 컬럼 SELECT 권한: `usage_scope`만 anon/authenticated에 부여(무해). `similarity_group_manual`·감사 테이블·RPC는 부여 안 함. `correct_index`·`explanation` 회수 유지.
- 소비자 게이트(서버 측): 모의고사 — `fetchEligiblePage` + `mock_exam_set_items` 트리거(general 거절). 수업·과제 — `problem_auto_composition_candidates` 뷰(키워드 자동 구성·`issue_homework_by_keywords/batch/batch_v2`·`sync_*_auto_problems`·`loadKeywordProblems`·교사 후보 조회), `compose_homework_from_session`, `issue_homework_items`, 트리거 `check_unit_problem_usable`·`check_prep_item_usable`·`check_homework_item_problem_confirmed`·`check_prepared_content_item_selectable`(새로 담는 순간만).
- **고정 불변:** `problem_keywords_selectable` 뷰·`pin_session_selection`·매니페스트·모의고사 세트/응시는 건드리지 않는다. 나중 재분류는 이미 고정·배정된 것에 영향 없음(기준본 회차의 `auto` 항목만 다음 동기화 때 후보에서 빠지는 기존 동작).
- 유사문항 그룹: SQL 함수 `problem_similarity_key` 한 곳. 컴파일러는 `c:<skill>:<subpattern>`, 그 외는 `t:<skill>:<md5(질문+지문 정규화) 16자>`(소문자·숫자→#·한글/영문/# 외 제거). 트리거가 문제 행 변경·버전 본문 저장 때 부여, 수동 값은 잠금.

## 3. UAT 데이터
- 자동 테스트: 실행 ID(`Date.now()`)가 붙은 전용 키워드·문제·회차·세트, 실행마다 새 전용 선생님(`test/per-run-teacher.ts`)·전용 관리자. 공식 시드 계정·시드 선생님 예약 창은 쓰지 않는다. afterAll에서 만든 문제·세트·항목 삭제(세션·예약 원장은 다른 통합 테스트와 같이 남는다).
- Preview UAT는 총괄 담당(이 작업 범위 밖).

## 4. UI 기준
- 생성 폼 0단계 "용도(필수)": 두 버튼(라디오), 선택 전 안내문, 선택 후 한 줄 설명. 기존 룩 유지.
- 목록: 행 제목 앞 배지(일반용/모의고사용/기존(미분류)), 필터 `용도 필터`, 미분류가 있으면 상단 바(개수 + 필터 전체 재분류 두 버튼), 선택 바에 `일반용으로 (N)`·`모의고사용으로 (N)`.
- 상세: 용도 버튼 + 유사문항 그룹 입력·`그룹 저장`·`자동으로 되돌리기`, "자동 부여/직접 지정됨" 표시.
- 모의고사 `생성` 탭: `모의고사 문항 풀` 접이식 표(영역·기술별, 공개 문항 기준).
- 상태: 빈 목록·오류·로딩은 기존 컴포넌트 그대로, 재분류는 확인창·진행 중 비활성·성공/실패 메시지.

## 5. 검증과 성능
- DB: 생성 검증·both 거절·재분류 감사·권한·조립 게이트·각 수업 후보(키워드 발급 배치·자동 과제 구성·직접 발급·기준본 자동 구성·준비안·과제 트리거)·그룹 결정성·컴파일러 키·수동 잠금·백필 멱등 — `lib/problem-usage-scope.integration.test.ts`. 액션: `app/admin/problem-usage-scope-actions.integration.test.ts`. UI: `ProblemBankTab.test.tsx`.
- 성능: 후보 뷰에 `p.usage_scope` 조건 하나 추가(이미 problems 조인) — 쿼리 수 증가 없음. 목록은 컬럼 3개 추가 SELECT(기존 1쿼리). 풀 요약은 RPC 1회(집계). 클라이언트 추가 요청: 모의고사 생성 탭 진입 시 1회.

## 설계 편차
- **직접 SQL INSERT는 default `both`**: NOT NULL·default 없음으로 하면 기존 통합 테스트 픽스처 수십 개와 `supabase/seed.sql`이 깨진다. 앱·스크립트의 모든 생성 경로는 `create_bank_problem` RPC(용도 필수) 또는 명시적 `usage_scope` 값을 쓰도록 바꿨고, 스크립트는 `PROBLEM_USAGE_SCOPE` 환경변수를 요구한다(기본값 없음). `both`가 새 행에 생기는 유일한 길은 service_role의 직접 SQL INSERT뿐이다.
- 그룹 계산은 본문이 필요해 `create_bank_problem` 시점이 아니라 **문제 행 변경 + 버전 본문 저장 트리거**에서 한다(생성 직후엔 본문이 없으므로 null, 초안 저장 즉시 부여).
- 감사는 RPC 대신 트리거(어떤 경로로 바뀌든 기록)로 두었다.
