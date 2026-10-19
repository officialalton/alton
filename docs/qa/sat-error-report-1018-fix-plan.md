# SAT Practice Test 1 Math 외부 검수 오류 신고(2026-10-18) 수정 계획

신고 9건(문항 번호는 SAT Practice Test 1 Math 기준, DB `problem_error_reports` 미처리). 이 문서는 코드 수정 내용, 전수 점검 결과, 공개 문항을 새 버전으로 바꾸는 순서를 정리한다. 원격 DB와 공개 문항은 이 작업에서 수정하지 않았다(Production·원격 DB 쓰기 없음, 유료 API 호출 없음).

## 1. 고친 템플릿·컴파일러

| 신고 | 문항 | 결함 | 수정 |
|---|---|---|---|
| (1) | 10·11·15·19 | 그래프와 식을 둘 다 줘서 한쪽만으로 풀림 | 아래 표. 그래프 읽기는 그래프만, 계산은 식만. 같은 곡선·직선을 두 표현으로 주지 않는다. |
| (2) | 13 | `sin(angle B)` | `right-triangles-trigonometry.ts` 질문·해설을 `sin B`로. |
| (3) | 14 | `same characteristic` | `inference-from-sample.ts` 지문·질문에 집단과 성질을 직접 쓴다(`work remotely at least once a week` 등). 표 자료의 행 이름도 같은 문구로. |
| (4) | 2 | 막대그래프 값을 눈금으로 읽을 수 없음 | `lib/problem-figures/templates/data.ts`: 값이 눈금선 위에 있지 않으면 막대 위·점 위에 값 라벨을 자동 표시(`valueLabels`로 명시 가능). 렌더러 수정이라 이미 저장된 `figure` 데이터도 다시 그릴 때 라벨이 붙는다. |
| (5) | 7 | `whose highest power of x is 2` | `ee.polynomial_distribution.TB.P`: 표준형 `ax^2+bx+c`를 이미 주므로 도입부의 차수 안내(quadratic, degree 2, highest power)를 전부 중립 문장으로 바꿨다. |
| (6) | 22 | `in terms of π` | 수정하지 않음(실제 SAT와 같은 표현). |

신고 (1)의 컴파일러별 처리(수정 전에는 모두 식과 그림을 같이 냈다).

| 컴파일러 | 문항 종류 | 수정 후 |
|---|---|---|
| `linear-functions` plane | 함수값, x 역산, 기울기 | 그래프만(식·두 점 삭제), 해설을 그래프 읽기로 |
| `nonlinear-functions` plane | 꼭짓점 x·y | 그래프만 |
| `nonlinear-functions` | 함수값(evaluate) | 식만. plane 자료와는 함께 낼 수 없다(`batch.ts`가 `require_plane`일 때 꼭짓점 문항만 뽑고, evaluate 지정은 거부) |
| `nonlinear-equations-systems` plane | 일차·이차 교점 | 그래프만, 질문을 "the graphs shown"으로 |
| `linear-two-variables` | 교점·기울기·절편 | 식만(같은 두 직선의 그래프를 붙이지 않음) |
| `linear-inequalities` | 점이 해인지 | 식만(같은 부등식의 영역 그림 삭제) |
| `circles` plane | 원의 방정식·중심·반지름·이동 | 그래프만 |

신고 15번은 "그래프만 보면 풀리는 구조를 다시 설계"로 적혀 있어 두 가지로 읽힌다. 이 수정에서는 15번이 그래프만 남는 읽기 문항이 되도록 식을 지운다(옛 틀과 맞으면 자동 패치, 아니면 `replacement-candidates.json`의 같은 종류 문항으로 교체). 그래프만으로도 쉽게 풀려서 난도를 올려 달라는 뜻이면 별도 재설계가 필요하다. 오너 확인 바람.

신규 코드: `lib/problem-generation/graph-expression-redundancy.ts`(중복 검출기), `lib/audit-fix/sat-error-report-1018.ts`(옛 문안 → 새 문안 패치 규칙).

## 2. 같은 결함 전수 점검

방법: `scripts/mock-exam-generation/sat-error-report-1018-scan.ts`가 저장소의 SAT Math 문항 4,187건(`data/` 아래 문항 JSON)을 읽는다. DB와 API 호출은 없다. 결과 원본은 `data/mock-exam-generation/sat-error-report-1018/scan-result.json`.

| 결함 | 저장소 문항 중 건수 | 템플릿 |
|---|---|---|
| 그래프와 식 동시 제시 | 75 | nonlinear_functions 22, nonlinear_equations_systems 21, linear_equations_two_var 18, systems_linear 8, linear_inequalities 6 (모두 컴파일러·구형 생성물). 레시피 기반 문항(archetype)은 0건 |
| 막대·선그래프 값을 눈금으로 읽을 수 없음 | 6 | percentages 4, evaluating_statistical_claims 1, ratios_rates_units 1 (모두 컴파일러 생성물). 레시피 기반은 0건 |
| `highest power of x is 2` 문구 | 13 | `ee.polynomial_distribution.TB` |
| 표준형을 주면서 차수도 다시 안내 | 155 | `ee.polynomial_distribution.TB` (위 13건 포함) |
| `sin(angle X)` 표기 / `same characteristic` | 0 | 저장소 JSON에는 없다. 이 둘은 컴파일러가 DB로 바로 저장한 문항에서만 나오므로 해당 skill의 컴파일러 문항 전부가 대상이다(right_triangles_trigonometry의 trig_ratio, inference_margin_error) |

세트별 노출은 세트 계획 파일(`new-sets.json`)의 그룹 표기로 센다. 레시피 문항은 템플릿을 알 수 있고, 그룹이 `t:`로 시작하는 문항(컴파일러·구형)은 본문을 알 수 없어 skill별 상한으로 센다.

| 계획 파일 | 세트 | polynomial_distribution.TB | 컴파일러·구형 문항 상한 |
|---|---|---|---|
| unique-sets-20261007 | 1 | 1 | 1 (inference 1) |
| rebalance-20261008 | 4 | 8 | 7 (inference 1, linear_equations_two_var 3, nonlinear_equations_systems 1, systems_linear 2) |
| sat-expand-20261015 (Test 14~26 후보) | 13 | 24 | 16 (nonlinear_equations_systems 3, nonlinear_functions 1, linear_equations_two_var 4, inference 2, right_triangles_trigonometry 1, systems_linear 4, circles 1) |

Test 14~26 후보의 Math는 새로 만든 문항이 아니라 기존 은행 문항을 배정한 것이다(신규 생성은 R&W만). 그래서 후보 세트의 결함은 기존 은행 문항의 결함이다. 레시피 기반 문항 중 그래프+식 중복은 없고, 위 표의 24건은 도입부 차수 문구(이번 코드 수정으로 새로 생성되는 문항은 해결, 이미 저장된 문항은 아래 패치 필요)이며, 컴파일러·구형 16건은 게시 전에 아래 순서 2의 읽기 결과로 개별 확인해야 한다. Test 2~13의 개별 문항은 DB에서만 읽을 수 있어 로컬에서는 템플릿·skill 수준으로만 확인했다.

## 3. 공개 문항 수정: 새 문항 버전 흐름

원격 DB와 공개 문항은 직접 수정하지 않는다. 기존 감사 수정 흐름(`scripts/audit/apply-audit-fixes.ts`, `lib/audit-fix/plan.ts`)을 그대로 쓴다. 문항마다 새 `problem_versions` 행을 만들고, 세트는 새 세트 버전으로 새 문항 버전을 가리키게 한다. 응답 기록이 있는 Test 1의 기존 버전과 응시 결과는 건드리지 않는다.

1. 읽기 전용 SELECT 출력: `npx tsx scripts/audit/sat-error-report-1018-build-patches.ts --print-select-sql`
2. 총괄이 `supabase db query --linked`로 실행해 `rows.json` 저장(읽기 전용). Test 1~13과 Test 14~26 후보(draft)의 Math 문항 현재 버전을 한꺼번에 읽는다.
3. 패치 생성: `npx tsx scripts/audit/sat-error-report-1018-build-patches.ts --in rows.json --out data/audit/2026-10-18-sat-error-report-patches.json`
   - 신고 9건뿐 아니라 같은 결함이 있는 다른 세트 문항도 같은 규칙으로 잡는다. 규칙에 걸린 항목은 `PATCH`, 옛 틀과 맞지 않는 그래프+식 중복은 `MANUAL`로 출력된다.
   - 출력 패치는 기존 형식(`problemId`, `expectVersionId`, `changes[{field, old, new}]`)이다.
4. `apply-audit-fixes.ts --dry-run`에 이 패치 파일을 넣어 전후 diff, 실행 SQL, 롤백 SQL을 만든다(총괄이 SQL 실행).
5. `MANUAL` 항목(예: 신고 15번이 옛 틀과 맞지 않을 때)은 `data/mock-exam-generation/sat-error-report-1018/replacement-candidates.json`의 같은 skill·세부 패턴 후보로 새 문항 버전을 만든다.
6. 반영 후 `mock_exam_validate_mst_set`·`mock_exam_set_item_issues`로 세트를 다시 검증하고, 신고 9건을 해결로 처리한다(`problem_error_reports.resolved_*`).

신고 문항별 적용 규칙(옛 틀의 문안이 정규식으로 맞을 때 자동 패치):

| 문항 | 규칙 | 변경 필드 |
|---|---|---|
| 2 | R2 | `figure.valueLabels = true`(렌더러도 자동 처리하므로 데이터 변경 없이도 읽힘) |
| 7 | R7 | `passage`에서 `, whose highest power of $x$ is 2,` 삭제 |
| 10·11·15·19 | G1~G7 중 해당 | `passage`, `explanation(_en)`, 필요 시 `figure=null` 또는 `question` |
| 13 | R13 | `question`, `explanation`, `explanation_en` |
| 14 | R14 | `passage`, `question`, `figure`(표 행 이름) |

## 4. 산출물

- 수정본 JSON: `data/mock-exam-generation/sat-error-report-1018/replacement-candidates.json`. 고친 컴파일러로 만든 대체 문항 후보 28건. 신고 항목별 종류(일차함수 3종, 이차함수 꼭짓점·함수값, 교점, 연립, 원, 부등식, 삼각비, 표본 추정)마다 2~3건씩이고 모두 그래프와 식이 중복되지 않는다. 공개 Test 1의 정확한 현재 문안은 원격 DB에만 있어 로컬에서는 문항별 수정본을 확정할 수 없다. 문항별 수정본은 위 3단계가 만드는 `data/audit/2026-10-18-sat-error-report-patches.json`이다.
- 전수 점검 결과: `data/mock-exam-generation/sat-error-report-1018/scan-result.json`.
- 점검 스크립트: `scripts/mock-exam-generation/sat-error-report-1018-scan.ts`, 패치 생성기: `scripts/audit/sat-error-report-1018-build-patches.ts`, 대체 후보 생성기: `scripts/mock-exam-generation/sat-error-report-1018-replacements.ts`.

## 5. 검증

- 단위 테스트: `lib/problem-generation/math-compilers/sat-error-report-1018.test.ts`(17건, 신고 항목별 회귀), `lib/audit-fix/sat-error-report-1018.test.ts`(8건, 옛 문안 → 새 문안 패치와 멱등).
- 기존 테스트 2건 갱신: `linear-two-variables.test.ts`, `linear-inequalities.test.ts`(식을 주는 경로는 그림이 없다).

## 6. 남은 사항

- `linear-functions`의 data(표) 모드는 표와 식을 같이 준다. 이번 신고(그래프+식)가 아니라 손대지 않았다. 같은 원칙(한 표현만)을 적용할지 오너 확인 바람.
- 기존 `nonlinear_equations_systems.linear_quadratic_intersection.FN.P`(레시피)는 포물선은 그래프로, 직선은 식으로 주고 직선도 그림에 그린다. 직선이 이중 제시지만 포물선은 그래프로만 얻을 수 있어 한쪽만으로는 풀리지 않으므로 수정하지 않았다.
- 정확한 Test 1 문항별 패치는 총괄의 읽기 전용 SELECT 결과가 있어야 확정된다.
