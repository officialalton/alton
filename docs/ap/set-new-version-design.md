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

## 구현(2026-10-12, 로컬 격리 스택에서만 검증 — 원격 미적용) — 새 기능 착수 전 1장 정리
1. **흐름**: 관리자가 공개 중인 세트에서 `createMockExamNewVersionAction(sourceSetId, swaps)` → 조립 규칙 점검(`lib/mock-exam/new-version.ts`: 문항군 상한·단원 비중(AB 풀)·계산기·중복·풀 모의고사 겹침 0) → RPC `mock_exam_create_new_version`(슬롯 유형·공개/review_env_ready·묶음 반쪽 교체 금지, 계열당 초안 1개) → 초안 검토 → 기존 `publishMockExamSet`(이제 RPC `mock_exam_publish_set` 한 트랜잭션: 이전 공개본 보관 + 공개, 공개 범위 `access_tier` 승계). 실패·취소: 초안은 `archiveMockExamSetAction` 으로 보관. 학생: 목록 카드에 `Updated version` 배지 + `You already answered N of these questions.` + 재응시 안내, 새 응시 결과 화면에 같은 안내.
2. **데이터·권한**: 새 RPC 는 service_role 전용 + actor 관리자 검증. 응시는 `exam_set_id` 로 옛 버전 고정(진행 중 응시는 `mock_exam_open_start` 이어하기로 옛 버전 유지). `mock_exam_attempts.is_updated_version_retake`(시작 시 같은 계열 다른 버전 응시가 있으면 true, 트리거), `mock_exam_item_exposures`(학생×문항 최초 노출, 고정형·AP 고정형 응시 시작 때 적재; 문항별 first/re_exposure 는 `mock_exam_attempt_item_exposure_kinds`). 조회 RPC `mock_exam_updated_version_overview`·`mock_exam_attempt_version_note` 는 `_mock_exam_can_view`(학생·보호자·담당 직원).
3. **UAT 데이터**: 실행 ID 접두 전용 학생(무료 회원 3명)·전용 세트/문항. 실제 공개 세트(AP Calculus AB — Practice Exam)에는 적용하지 않았다(오너 적용 전까지 대기). 통합 테스트는 격리 스택 전용(`SUPABASE_TEST_DB_URL`·`SUPABASE_TEST_API_URL` 명시 + `lib/dev/stack-identity.ts` 검증).
4. **UI 상태**: 카드(배지·N 문구; N=0 이면 N 문구 숨김, 재응시 안내만), 이력 없는 학생은 배지 없음, 학부모 읽기 전용에도 배지, 결과 화면 상단 안내(SAT·AP 결과 둘 다). 정보 조회 실패는 목록·결과를 막지 않는다.
5. **검증·성능**: 목록 로드 RPC 2→3회(병렬, 쿼리 증가 1개·세트별 추가 조회 없음), 결과 상세 RPC +1회(비-MST). 집계 취급: 목록·다음 시험·약점은 이미 계열(set_group_id) 단위라 새 버전을 새 시험으로 세지 않음; 분석 `testsStarted/Completed/startedCohort*/satStarted` 는 `is_updated_version_retake` 제외(마이그레이션 483). 점수 추이(`score-aggregate`)는 재응시를 별개 응시로 세는 기존 규칙을 유지(AP·고정형은 추정 점수 없음).
- 마이그레이션(오너 적용 대기): `20262100000480_mock_exam_version_exposure.sql`, `…481_mock_exam_new_version_rpcs.sql`, `…482_mock_exam_updated_version_info.sql`, `…483_analytics_exclude_updated_version_retakes.sql`.
- 남은 일: 실제 교체 10문항 목록(`docs/ap/exact-assignment-report.md`)으로 액션 실행·검토·공개는 오너 승인 뒤. 관리자 화면 버튼은 아직 없다(서버 액션만).

## 관리자 화면 'AB/AP 세트 새 버전' + 공개 범위 (2026-10-12, 로컬 격리 스택 검증 — 원격 미적용)
위치: 관리자 → Mock Exams → AP 재고 관리 맨 아래. 코드: `app/admin/mock-exam/ApNewVersionPanel.tsx`, 서버 액션 `app/admin/ap-new-version-actions.ts`, 로직 `lib/ap-admin/new-version.ts`·`new-version-service.ts`.
1. **흐름**: ① 공개 세트 선택 → 교체 계획(저장소 `data/ap/stock/*swap-plan*.json` 또는 한 줄에 "섹션 위치 새후보키" 직접 입력) → **미리보기**(검증 = TS `checkNewVersionComposition` + DB RPC 가 거부할 조건 사전 점검: 변환·review_env_ready·모의고사 용도·확정 공개 버전·같은 과목·슬롯 형식·풀 세트 겹침 0; 구성 전/후 표; 기존 응시 수와 "v1 에 그대로") → 확인 체크 → **새 버전 초안 만들기**(`createMockExamNewVersionAction`, 계획 해시 일치 시만) → ② 별도 단계 **새 버전 공개**(`publishMockExamSet` → 원자적 RPC: 이전 공개본 보관 + 공개 + 범위 승계; v2 이상 초안만). 실패·취소: 초안은 기존 '보관'으로 폐기.
2. **교체 계획 파일 형식**: `{kind:"ap_new_version_swap_plan", set, sourceSetName, sourceVersionNo, swaps:[{section, removeKey?, position?, addKey}]}`. removeKey 로 실제 슬롯을 찾으므로 위치가 어긋나도 안전. 계획 생성기: `scripts/ap-generation/ab1-new-version-plan.ts`(정수계획 최소 교체).
3. **가드**: requireAdmin, 환경 가드(`assertCanWrite`, 허용 목록 밖은 쓰기 거부), 미리보기와 같은 계획 해시일 때만 실행, 모든 단계 감사 기록(`ap_stock_admin_runs` action `new_version_preview|new_version_draft|new_version_publish|set_access_tier`). v1·응시·답안·결과는 읽기(응시 수)만.
4. **공개 범위(무료/튜터링)**: 마이그레이션 510 — `mock_exam_sets.planned_access_tier`(초안은 DB 가드 때문에 free 로 저장 불가 → 공개 때 적용할 범위를 기록), `mock_exam_publish_set` 은 이전 공개본 범위 → 계획 범위 → 초안 값 순으로 정한다, 가드된 RPC `ap_admin_set_access_tier`(관리자·AP·초안/공개만, 한 컬럼만 변경, 무료 가드 트리거 적용). 초안 저장(⑤)의 기본값은 **무료**, 새 버전 초안은 이전 공개본 범위를 승계. 화면 'AP 세트 공개 범위' 표에서 미리보기 → 확인 → 적용.
5. **검증**: `lib/ap-admin/new-version.test.ts`, `app/admin/mock-exam/ApNewVersionPanel.test.tsx`(단위·컴포넌트), `lib/ap-admin/ap-new-version-ui.integration.test.ts`(격리 스택: 미리보기 읽기 전용·위반 거절·해시 불일치 거부·초안→공개 원자성·v1/응시 불변·감사·쓰기 차단·범위 전환).
6. **AB#1 v2 계획 결과(초안 5세트 문항 240건 제외, DB 준비 재고만)**: 정수계획이 **불가능**을 증명 — 구조 문항군 상한 1 아래 AB 단원 6 이 공식 하한 7 인데 남은 서로 다른 구조 문항군은 5(초안 제외 후 재고 전체 기준). 단원 하한만 풀면 10건 교체로 가능하나 단원 6 이 2 부족해 허용되지 않는다. 계획 파일은 만들지 않았다.
