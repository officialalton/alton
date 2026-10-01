# 2026-09-30 수학 hard 원형(세부 패턴 × 연산자) 컴파일러 — 구조 검증 보고(파일럿 4 skill)

작성: 하위 에이전트(수학 hard 컴파일러). 브랜치 `feat/math-hard-compilers`(worktree `~/Developer/ALTON-worktrees/math-hard-compilers`). **DB·원격·배포·유료 API 사용 0**, 마이그레이션 없음. 구조 검증이 목적이라 대량 생성은 하지 않았다(산출기는 구현만, 실행은 총괄 승인 후).

## 1. 결론

- **기존 컴파일러만으로는 easy+medium 1,740문항을 채울 수 없다.** 세부 패턴마다 본문 유사도 0.6 미만 독립 문항이 1개 안팎(문장 틀이 고정이고 숫자는 마스킹되어 같은 틀=같은 문항으로 계산됨)이라, 30세트 필요량(easy 440·medium 1,300) 대비 안전 생산이 합계 약 232(13%)다. 예외적으로 `linear_equations_one_var.literal_rearrange`만 변수 문자 조합으로 수백 개가 나오지만 유사문항 그룹이 3개뿐이라 그룹 상한(그룹×30세트)에 걸린다.
- **세부 패턴 × 범용 연산자(8종) 원형 구조는 맞다.** 파일럿 4 skill(10 세부 패턴, 원형 40개) 전부 합격: 시드 200,000건에서 정답 재계산 불일치 0·선지 겹침 0·표기 위반 0·예외 0, 원형당 본문 유사도 0.6 미만 독립 변형 48~400 이상(기준 30). 확대 시 나머지 75개 세부 패턴 × 4 = 300개 원형이 필요하다(아래 진행표).
- 원형은 '풀이 구조가 다른 문항 틀'이고, 문항 수는 틀의 **표현 변형(사실 문장별 대안 문구·맥락·변수 문자)** 에서 나온다. 숫자만 바꾸면 유사도 마스킹 때문에 1문항으로 센다 → 원형마다 사실 문장 3~5개 × 대안 3~5개(`facts()` 묶음)를 작성하는 것이 원형당 작업량의 대부분이다.
- hard 필요량(240)은 원형 1개당 수 문항이면 충분하다. '원형당 30변형'이 본질적으로 필요한 곳은 **easy·medium 대량 공급** 쪽이므로, 같은 틀(세부 패턴 × 연산자, 난이도 축소판)을 easy/medium 원형으로 확장하는 것이 부족분(1,508)을 AI 없이 줄이는 길이다(총괄 판단 사항).

## 2. 구성(파일)

| 경로 | 역할 |
|---|---|
| `lib/problem-generation/math-archetypes/types.ts` | `Archetype`(id·skill·kind·operator·structure·extraThinking·concepts·mediumSteps·generate)·`Instance`·연산자 8종 |
| `.../rng.ts` | 시드 난수(mulberry32), (원형 ID, 시드)만으로 같은 문항 재생성 |
| `.../text.ts` | 선지 구성(오답 후보 중복·값 겹침 제거, 식형 선지는 평가값으로 겹침 차단)·`facts()`/`spin()` 표현 변형·분수·다항식 문자열 |
| `.../verify.ts` | 검증기: `verification_js`(vm) 정답 재계산, 선지 문자열 수식 평가, 값 겹침, 표기 검사, 공개 게이트(checkContent·checkFigure), hard 주장 검사 |
| `.../skills/*.ts` | 파일럿 원형 40개: `equivalent-expressions`(8)·`ratios-rates-units`(8)·`linear-equations-one-var`(12)·`probability`(12) |
| `.../registry.ts`·`sweep.ts` | 원형 목록·시드 스윕·본문 유사도(`import.ts` 와 동일한 숫자 마스킹 3-gram Jaccard) |
| `.../bulk.ts` | 대량 산출기: `produceFromArchetypes`(hard), `produceFromCompilers`(기존 컴파일러 easy/medium, `Math.random` 시드 교체로 재현) → `passed.json` 호환 레코드 |
| `lib/problem-generation/math-compilers/sweep.ts` | 기존 컴파일러 전수 시드 스윕 하네스(75 세부 패턴 + 카탈로그 밖 3종 × 난이도 3) |
| `scripts/mock-exam-generation/*.ts` | `archetype-sweep`·`archetype-samples`·`archetype-pilot-samples`(Preview 샘플)·`math-compiler-sweep`·`math-coverage`·`medium-baseline`·`math-supply-table` |

### 레코드 규약(`import.ts` 호환)

`createdVia="compiler"`, `usage_scope=mock_exam`(import 가 고정), `subpattern="<원형ID>/<변형>"`(유사문항 그룹 키 `c:<skill>:<subpattern>`), hard 는 `quality.mockExamGeneration = { difficultyStatus: "provisional_ai", source: "compiler_archetype", archetypeId, operator, kind, extraThinking, concepts, steps, mediumSteps, seed, variant, verification }` 와 `recipeId=원형ID`·`recipeCheck`. easy/medium 은 `difficultyStatus: "confirmed"`. `import.ts` 는 이 `mockExamGeneration` 를 덮어쓰지 않고 병합하도록 한 줄 수정했다(`hardBasis="compiler_archetype"` 추가). **난이도 교정 계획**: 출시 후 `problem_response_stats` 를 `quality.mockExamGeneration.archetypeId`(원형)·`operator`·`kind` 단위로 집계해 원형별 정답률을 구하고, 정답률이 medium 분포와 같은 원형은 hard 주장을 철회(`difficultyStatus` 갱신)한다. 원형 ID 가 문항 품질 JSON 에 들어 있으므로 별도 마이그레이션이 필요 없다.

## 3. 세부 패턴 전체 목록(카탈로그 75 + 카탈로그 밖 10 = 85)

`kind-catalog.ts` 에 있는 16 skill 75개 + 카탈로그에 세부 패턴이 없는 3 skill(`systems_linear`·`inference_margin_error`·`evaluating_statistical_claims`)의 제안 10개. 카탈로그 밖 3 skill 은 컴파일러가 단일 모델이라 **세부 패턴을 새로 정의**했다(`systems_linear` 는 `linear_equations_two_var` 계산을 재사용하는 컴파일러). 이 10개는 구현 시 `kind-catalog.ts` 에 추가한다.

| skill | 세부 패턴(수) | 목록 |
|---|---|---|
| area_volume | 6 | `rectangle_area`, `triangle_area`, `prism_volume`, `prism_missing_dimension`, `cylinder_volume_radius`, `cylinder_volume_diameter` |
| circles | 7 | `circumference_radius`, `circumference_diameter`, `arc_length`, `sector_area`, `central_from_inscribed`, `inscribed_from_central`, `circle_equation_transform` |
| linear_equations_one_var | 3 | `solve`, `word_problem_translate`, `literal_rearrange` |
| linear_functions | 5 | `evaluate`, `find_x_for_value`, `slope_from_two_points`, `interpret_slope`, `interpret_intercept` |
| linear_inequalities | 3 | `solve_one_var`, `point_in_solution`, `table_verification` |
| linear_equations_two_var | 6 | `intersection_x`, `intersection_y`, `intersection_sum`, `slope`, `intercept`, `num_solutions` |
| lines_angles_triangles | 4 | `triangle_angle_sum`, `exterior_angle`, `isosceles_base_angle`, `similar_triangles` |
| nonlinear_equations_systems | 9 | `root`, `sum_of_roots`, `product_of_roots`, `num_real_solutions`, `irrational_sum_of_roots`, `irrational_product_of_roots`, `irrational_root_radical_form`, `linear_quadratic_intersection`, `parameter_discriminant` |
| nonlinear_functions | 6 | `evaluate`, `vertex_x`, `vertex_y`, `find_x_for_value`, `interpret_a`, `interpret_b` |
| one_variable_data | 4 | `mean`, `median`, `range`, `grouped_median_interval` |
| percentages | 5 | `percent_of`, `find_whole`, `percent_change`, `find_percent`, `compound_change` |
| probability | 3 | `simple`, `conditional`, `sequential_without_replacement` |
| ratios_rates_units | 2 | `proportion`, `chained_conversion` |
| right_triangles_trigonometry | 3 | `pythagorean_hypotenuse`, `pythagorean_leg`, `trig_ratio` |
| two_variable_data | 7 | `cell`, `row_total`, `conditional_share`, `scatter_equation`, `scatter_predict`, `scatter_slope_context`, `scatter_count_above` |
| equivalent_expressions | 2 | `polynomial_distribution`, `rational_equivalence` |
| systems_linear (카탈로그 밖·제안) | 4 | `substitution_solve`, `elimination_value`, `param_no_solution`, `word_system` |
| inference_margin_error (카탈로그 밖·제안) | 3 | `population_estimate`, `margin_interval`, `sample_size_effect` |
| evaluating_statistical_claims (카탈로그 밖·제안) | 3 | `generalizability`, `cause_vs_association`, `conclusion_scope` |
| **합계** | **85** | |

## 4. 연산자 설계(8종)

hard 구조를 만드는 범용 변환. 세부 패턴 하나에 서로 다른 연산자 4개를 적용해 원형 4개를 만든다(테스트가 '같은 세부 패턴의 원형은 연산자가 모두 다름'을 강제).

| 코드 | 연산자 | 변환 | 추가 요구 사고(medium 대비) | 예(파일럿) |
|---|---|---|---|---|
| P | `param_condition` | 결과 조건(해의 개수·동치·판별식)을 주고 매개변수를 구함 | 조건을 식으로 번역(암묵 조건 도출) | `le.solve.param_condition`(해가 무수히 많도록), `ee.rational_equivalence.param_condition` |
| I | `inverse` | 결과·관계를 주고 입력·구성·계수를 역산 | 정방향 계산의 역방향 재구성 | `rr.proportion.inverse`(변화 후 비 → 처음 인원), `probability.sequential...inverse` |
| C | `compose_kind` | 다른 개념·패턴의 입력으로 합성 | 서로 다른 개념의 연결 | `le.solve.compose_kind`(방정식→둘레→넓이) |
| H | `chain2` | 앞 단계 결과가 뒤 단계의 조건 | 2단계 연쇄·묻는 대상 재계산 | `le.solve.chain2`(첫 해 → 둘째 방정식 해) |
| U | `unit_ratio` | 단위·비율·차원 변환 결합 | 차원(넓이·부피) 변환, 역수 방향 해석 | `rr.chained_conversion.unit_ratio`(m³→L) |
| R | `repr_shift` | 표현 변환(문장·도형·표 → 식) | 모델링(식 세우기) | `ee.polynomial_distribution.repr_shift`(테두리 넓이) |
| S | `constraint_select` | 제약 추가 후 해 선택·개수(외래근·정의역·정수해) | 제약 추적·후보 제거 | `le.solve.constraint_select`(외래근) |
| V | `compare_scenarios` | 두 경우 비교·임계점 | 두 모델을 세우고 차·시점 비교 | `rr.proportion.compare_scenarios`(시차 있는 생산) |

**hard 로 인정하지 않는 것**: 긴 지문·복잡한 숫자·계산량만 늘린 변형. 기계 검사로 강제한다 — (1) 풀이 단계(`trace`) ≥ max(5, 같은 세부 패턴 medium 실측 단계 + 1), (2) 결합 개념 ≥ 2, (3) 지문에 4자리 이상 숫자(단위 환산 상수 1000 제외)·소수 둘째 자리 금지, (4) `mediumSteps` ≥ 기존 medium 컴파일러 해설 문장 수 실측(`data/mock-exam-generation/math-medium-baseline.json`).

## 5. 적용 가능 매트릭스(세부 패턴 × 연산자 4개)

코드 4자가 그 세부 패턴에 적용할 연산자다(의미 없는 조합은 제외). ✔ 는 이번 파일럿에서 구현·합격한 칸.

| skill | 세부 패턴 | 연산자(코드) | 원형 수 |
|---|---|---|---|
| area_volume | rectangle_area | I(inverse) C(compose_kind) R(repr_shift) V(compare_scenarios) | 0/4 |
| area_volume | triangle_area | I(inverse) C(compose_kind) R(repr_shift) S(constraint_select) | 0/4 |
| area_volume | prism_volume | I(inverse) U(unit_ratio) C(compose_kind) V(compare_scenarios) | 0/4 |
| area_volume | prism_missing_dimension | I(inverse) H(chain2) U(unit_ratio) S(constraint_select) | 0/4 |
| area_volume | cylinder_volume_radius | I(inverse) C(compose_kind) U(unit_ratio) V(compare_scenarios) | 0/4 |
| area_volume | cylinder_volume_diameter | I(inverse) H(chain2) U(unit_ratio) V(compare_scenarios) | 0/4 |
| circles | circumference_radius | I(inverse) U(unit_ratio) C(compose_kind) V(compare_scenarios) | 0/4 |
| circles | circumference_diameter | I(inverse) U(unit_ratio) H(chain2) V(compare_scenarios) | 0/4 |
| circles | arc_length | I(inverse) H(chain2) U(unit_ratio) R(repr_shift) | 0/4 |
| circles | sector_area | I(inverse) H(chain2) C(compose_kind) V(compare_scenarios) | 0/4 |
| circles | central_from_inscribed | I(inverse) H(chain2) C(compose_kind) S(constraint_select) | 0/4 |
| circles | inscribed_from_central | I(inverse) H(chain2) S(constraint_select) R(repr_shift) | 0/4 |
| circles | circle_equation_transform | P(param_condition) I(inverse) C(compose_kind) S(constraint_select) | 0/4 |
| linear_equations_one_var | solve | P(param_condition) S(constraint_select) H(chain2) C(compose_kind) | ✔ 4/4 |
| linear_equations_one_var | word_problem_translate | H(chain2) U(unit_ratio) S(constraint_select) R(repr_shift) | ✔ 4/4 |
| linear_equations_one_var | literal_rearrange | C(compose_kind) I(inverse) H(chain2) P(param_condition) | ✔ 4/4 |
| linear_functions | evaluate | H(chain2) C(compose_kind) R(repr_shift) V(compare_scenarios) | 0/4 |
| linear_functions | find_x_for_value | I(inverse) H(chain2) C(compose_kind) S(constraint_select) | 0/4 |
| linear_functions | slope_from_two_points | I(inverse) C(compose_kind) R(repr_shift) V(compare_scenarios) | 0/4 |
| linear_functions | interpret_slope | U(unit_ratio) R(repr_shift) V(compare_scenarios) H(chain2) | 0/4 |
| linear_functions | interpret_intercept | U(unit_ratio) R(repr_shift) I(inverse) V(compare_scenarios) | 0/4 |
| linear_inequalities | solve_one_var | P(param_condition) S(constraint_select) H(chain2) C(compose_kind) | 0/4 |
| linear_inequalities | point_in_solution | I(inverse) S(constraint_select) R(repr_shift) V(compare_scenarios) | 0/4 |
| linear_inequalities | table_verification | R(repr_shift) S(constraint_select) I(inverse) V(compare_scenarios) | 0/4 |
| linear_equations_two_var | intersection_x | C(compose_kind) I(inverse) V(compare_scenarios) R(repr_shift) | 0/4 |
| linear_equations_two_var | intersection_y | H(chain2) I(inverse) S(constraint_select) C(compose_kind) | 0/4 |
| linear_equations_two_var | intersection_sum | P(param_condition) I(inverse) C(compose_kind) S(constraint_select) | 0/4 |
| linear_equations_two_var | slope | H(chain2) I(inverse) C(compose_kind) R(repr_shift) | 0/4 |
| linear_equations_two_var | intercept | I(inverse) H(chain2) R(repr_shift) V(compare_scenarios) | 0/4 |
| linear_equations_two_var | num_solutions | P(param_condition) I(inverse) S(constraint_select) C(compose_kind) | 0/4 |
| lines_angles_triangles | triangle_angle_sum | I(inverse) H(chain2) R(repr_shift) S(constraint_select) | 0/4 |
| lines_angles_triangles | exterior_angle | I(inverse) H(chain2) S(constraint_select) C(compose_kind) | 0/4 |
| lines_angles_triangles | isosceles_base_angle | I(inverse) H(chain2) R(repr_shift) C(compose_kind) | 0/4 |
| lines_angles_triangles | similar_triangles | U(unit_ratio) C(compose_kind) I(inverse) S(constraint_select) | 0/4 |
| nonlinear_equations_systems | root | P(param_condition) S(constraint_select) H(chain2) I(inverse) | 0/4 |
| nonlinear_equations_systems | sum_of_roots | I(inverse) P(param_condition) C(compose_kind) H(chain2) | 0/4 |
| nonlinear_equations_systems | product_of_roots | I(inverse) P(param_condition) C(compose_kind) H(chain2) | 0/4 |
| nonlinear_equations_systems | num_real_solutions | P(param_condition) S(constraint_select) C(compose_kind) V(compare_scenarios) | 0/4 |
| nonlinear_equations_systems | irrational_sum_of_roots | I(inverse) C(compose_kind) H(chain2) R(repr_shift) | 0/4 |
| nonlinear_equations_systems | irrational_product_of_roots | I(inverse) C(compose_kind) H(chain2) R(repr_shift) | 0/4 |
| nonlinear_equations_systems | irrational_root_radical_form | I(inverse) H(chain2) S(constraint_select) C(compose_kind) | 0/4 |
| nonlinear_equations_systems | linear_quadratic_intersection | P(param_condition) C(compose_kind) R(repr_shift) S(constraint_select) | 0/4 |
| nonlinear_equations_systems | parameter_discriminant | P(param_condition) I(inverse) S(constraint_select) H(chain2) | 0/4 |
| nonlinear_functions | evaluate | H(chain2) C(compose_kind) R(repr_shift) V(compare_scenarios) | 0/4 |
| nonlinear_functions | vertex_x | I(inverse) C(compose_kind) R(repr_shift) H(chain2) | 0/4 |
| nonlinear_functions | vertex_y | I(inverse) C(compose_kind) R(repr_shift) V(compare_scenarios) | 0/4 |
| nonlinear_functions | find_x_for_value | I(inverse) S(constraint_select) H(chain2) C(compose_kind) | 0/4 |
| nonlinear_functions | interpret_a | U(unit_ratio) R(repr_shift) V(compare_scenarios) H(chain2) | 0/4 |
| nonlinear_functions | interpret_b | U(unit_ratio) R(repr_shift) V(compare_scenarios) I(inverse) | 0/4 |
| one_variable_data | mean | I(inverse) V(compare_scenarios) H(chain2) S(constraint_select) | 0/4 |
| one_variable_data | median | I(inverse) S(constraint_select) V(compare_scenarios) R(repr_shift) | 0/4 |
| one_variable_data | range | I(inverse) S(constraint_select) V(compare_scenarios) C(compose_kind) | 0/4 |
| one_variable_data | grouped_median_interval | R(repr_shift) I(inverse) S(constraint_select) V(compare_scenarios) | 0/4 |
| percentages | percent_of | C(compose_kind) H(chain2) I(inverse) V(compare_scenarios) | 0/4 |
| percentages | find_whole | H(chain2) I(inverse) U(unit_ratio) V(compare_scenarios) | 0/4 |
| percentages | percent_change | H(chain2) I(inverse) V(compare_scenarios) U(unit_ratio) | 0/4 |
| percentages | find_percent | I(inverse) H(chain2) U(unit_ratio) S(constraint_select) | 0/4 |
| percentages | compound_change | I(inverse) H(chain2) V(compare_scenarios) R(repr_shift) | 0/4 |
| probability | simple | C(compose_kind) I(inverse) V(compare_scenarios) R(repr_shift) | ✔ 4/4 |
| probability | conditional | R(repr_shift) H(chain2) I(inverse) C(compose_kind) | ✔ 4/4 |
| probability | sequential_without_replacement | V(compare_scenarios) I(inverse) S(constraint_select) H(chain2) | ✔ 4/4 |
| ratios_rates_units | proportion | H(chain2) I(inverse) V(compare_scenarios) U(unit_ratio) | ✔ 4/4 |
| ratios_rates_units | chained_conversion | C(compose_kind) U(unit_ratio) V(compare_scenarios) H(chain2) | ✔ 4/4 |
| right_triangles_trigonometry | pythagorean_hypotenuse | I(inverse) C(compose_kind) H(chain2) U(unit_ratio) | 0/4 |
| right_triangles_trigonometry | pythagorean_leg | I(inverse) H(chain2) S(constraint_select) R(repr_shift) | 0/4 |
| right_triangles_trigonometry | trig_ratio | I(inverse) C(compose_kind) H(chain2) R(repr_shift) | 0/4 |
| two_variable_data | cell | I(inverse) H(chain2) R(repr_shift) S(constraint_select) | 0/4 |
| two_variable_data | row_total | I(inverse) H(chain2) R(repr_shift) V(compare_scenarios) | 0/4 |
| two_variable_data | conditional_share | I(inverse) H(chain2) C(compose_kind) V(compare_scenarios) | 0/4 |
| two_variable_data | scatter_equation | I(inverse) R(repr_shift) H(chain2) S(constraint_select) | 0/4 |
| two_variable_data | scatter_predict | H(chain2) I(inverse) V(compare_scenarios) R(repr_shift) | 0/4 |
| two_variable_data | scatter_slope_context | U(unit_ratio) R(repr_shift) V(compare_scenarios) I(inverse) | 0/4 |
| two_variable_data | scatter_count_above | S(constraint_select) R(repr_shift) V(compare_scenarios) C(compose_kind) | 0/4 |
| equivalent_expressions | polynomial_distribution | C(compose_kind) I(inverse) R(repr_shift) S(constraint_select) | ✔ 4/4 |
| equivalent_expressions | rational_equivalence | I(inverse) H(chain2) P(param_condition) S(constraint_select) | ✔ 4/4 |
| systems_linear | substitution_solve | I(inverse) C(compose_kind) R(repr_shift) H(chain2) | 0/4 |
| systems_linear | elimination_value | I(inverse) H(chain2) S(constraint_select) V(compare_scenarios) | 0/4 |
| systems_linear | param_no_solution | P(param_condition) I(inverse) S(constraint_select) C(compose_kind) | 0/4 |
| systems_linear | word_system | R(repr_shift) U(unit_ratio) V(compare_scenarios) H(chain2) | 0/4 |
| inference_margin_error | population_estimate | U(unit_ratio) I(inverse) H(chain2) V(compare_scenarios) | 0/4 |
| inference_margin_error | margin_interval | I(inverse) S(constraint_select) V(compare_scenarios) R(repr_shift) | 0/4 |
| inference_margin_error | sample_size_effect | P(param_condition) V(compare_scenarios) I(inverse) H(chain2) | 0/4 |
| evaluating_statistical_claims | generalizability | R(repr_shift) S(constraint_select) V(compare_scenarios) C(compose_kind) | 0/4 |
| evaluating_statistical_claims | cause_vs_association | R(repr_shift) S(constraint_select) V(compare_scenarios) C(compose_kind) | 0/4 |
| evaluating_statistical_claims | conclusion_scope | R(repr_shift) S(constraint_select) V(compare_scenarios) C(compose_kind) | 0/4 |

## 6. 파일럿 결과(4 skill · 10 세부 패턴 · 원형 40개)

파일럿 선택: `equivalent_expressions`(식 동치, 수식 선지), `ratios_rates_units`(단위·비율), `linear_equations_one_var`(대수·문장제), `probability`(분수 정답·경우의 수). 서로 다른 답 형식(정수·분수·식)과 검증 방식(brute-force 스캔·전수 열거)을 포괄한다.

시드 스윕: 원형당 5,000 시드(총 200,000) — 생성 제약을 못 맞춘 표집은 같은 시드에서 파생한 난수로 최대 40회 재추출(결과는 (원형, 시드)만으로 결정). 합계 생산 199,889건, 재추출 후에도 실패 111건(0.06%), **정답 재계산 불일치·선지 값 겹침·표기·공개 게이트 위반 0, 예외 0**.

| 원형 ID | 풀이 구조 | 추가 요구 사고 | 개념 | medium 실측→선언 | 최소 풀이 단계 | 생산/5000 | 검증 실패 | 독립 변형(<0.6, 상한 400) | 그룹(변형) | 합격 |
|---|---|---|---|---|---|---|---|---|---|---|
| `ee.polynomial_distribution.compose_kind` | 두 이항식의 제곱을 각각 전개한 뒤 뺄셈 부호를 분배해 동류항 정리(또는 '큰 정사각형에서 작은 정사각형을 뺀 넓이' 모델링) | 제곱 전개(중간항)와 뺄셈 전체에 대한 부호 분배, 동류항 결합 — medium 은 a(x+b)+c(x+d) 선형 분배 한 번 | 이항식 제곱 전개, 뺄셈의 부호 분배, 동류항 정리 | 3→3 | ≥5 | 5000 | 0 | 75 | 2 | 합격 |
| `ee.polynomial_distribution.inverse` | 곱 (ax+b)(cx+k) 를 전개해 일차항 계수 조건에서 미지 상수 k 를 구하고, 다시 상수항 C 를 계산 | 결과식의 계수를 주고 입력 상수를 역추적(계수 비교 → k → 상수항) — medium 은 주어진 식을 그대로 전개만 함 | 다항식 곱 전개, 계수 비교(항등식), 미지 상수 역산 | 3→3 | ≥5 | 5000 | 0 | 282 | 1 | 합격 |
| `ee.polynomial_distribution.constraint_select` | 이차식을 (mx+n)(px+q) 로 인수분해하되 m>p>0 정수 제약으로 계수 쌍을 선택하고 n+q 를 구함 | 상수항의 인수쌍과 x^2 계수의 인수쌍을 시도해 중간항으로 선별하는 제약 탐색 — medium 은 전개 방향(분배) 한 번 | 이차식 인수분해(선행계수≠1), 인수쌍 탐색, 제약 조건 선택 | 3→3 | ≥5 | 5000 | 0 | 52 | 2 | 합격 |
| `ee.polynomial_distribution.repr_shift` | 문장·도형(직사각형 둘레에 폭 w 의 길/테두리)을 바깥·안쪽 넓이식으로 세워 전개·뺄셈 후 선지 선택 | 문장→식 변환(바깥 변 = 안 변 + 2w)과 모서리 정사각형 4w² 포함 여부 판단 — medium 은 주어진 식의 전개 | 도형의 넓이 모델링, 이항식 곱 전개, 동류항 정리 | 3→3 | ≥5 | 5000 | 0 | 187 | 1 | 합격 |
| `ee.rational_equivalence.inverse` | 분자 mx+n 이 주어진 유리식을 부분분수 A/(x−p)+B/(x+q) 로 분해해 미지의 A, B 를 구한 뒤 A−B 또는 A·B 를 계산 | 공통분모를 '만드는' 방향이 아니라 분해 방향(미지수 A, B 역산): 양변에 분모를 곱하고 근을 대입하거나 계수 비교 — medium 은 공통분모로 결합 | 유리식 공통분모, 항등식 계수 비교, 부분분수 분해 | 4→4 | ≥5 | 5000 | 0 | 81 | 2 | 합격 |
| `ee.rational_equivalence.compose_kind` | 분수 두 개의 합(차)의 역수인 복합분수를 통분·역수로 단순화해 동치 선지 선택 | 복합분수 구조 인식: 안쪽 분수 통분 → 분자·분모 역전 → 약분 — medium 은 두 분수의 단순 합 | 복합분수 단순화, 통분, 역수 | 4→4 | ≥5 | 5000 | 0 | 93 | 2 | 합격 |
| `ee.rational_equivalence.param_condition` | (x²+kx+m)/(x−r) 가 x+s 와 동치가 되기 위한 매개변수 조건: 분자가 (x−r)(x+s) 로 인수분해되어야 함 | 동치가 되려면 나머지가 0(인수정리)이어야 한다는 암묵 조건 도출 후 계수 비교 — medium 은 주어진 두 유리식의 결합 | 유리식 동치 조건, 인수정리·다항식 나눗셈, 계수 비교 | 4→4 | ≥5 | 5000 | 0 | 72 | 3 | 합격 |
| `ee.rational_equivalence.constraint_select` | 전개된 분자·분모를 각각 인수분해해 공통인수를 약분하고, 약분 전 원식의 정의역 제외값(분모의 모든 영점)의 합을 구함 | 약분해 사라진 인수도 원식에서는 제외값이라는 정의역 제약 추적 — medium 은 동치 결합만 요구하고 제외값을 묻지 않음 | 유리식 약분, 이차식 인수분해, 정의역(제외값) | 4→4 | ≥5 | 5000 | 0 | 90 | 1 | 합격 |
| `rr.proportion.chain2` | A:B 와 B:C 두 비를 공통 항 B 로 맞춰 A:B:C 연비를 만들고 전체량을 비례배분해 C 를 구함 | 공통 항을 맞추는 연비 구성(최소공배수 배분) — medium 은 비 하나의 비례식 | 연비 구성, 비례배분, 공통 항 통일 | 1→2 | ≥5 | 5000 | 0 | 112 | 2 | 합격 |
| `rr.proportion.inverse` | 처음 비 a:b 를 (a k, b k)로 두고 인원 변화 후의 새 비로 방정식을 세워 k 를 구해 처음 전체 인원을 역산 | 비를 미지 배수로 매개변수화하고 변화 후 비율을 식으로 세우는 역문제 — medium 은 주어진 비로 한 수량을 직접 계산 | 비의 매개변수화, 변화 후 비례식, 일차방정식 | 1→2 | ≥5 | 4963 | 0 | 133 | 2 | 합격 |
| `rr.proportion.compare_scenarios` | 두 기계의 단위 생산률을 구하고, A 가 먼저 시작한 선행 생산량을 반영해 합산 목표 생산량에 도달하는 시간을 구함 | 선행(시차) 생산량과 두 비율의 합성 — medium 은 단일 비율 비례식 | 단위 비율, 시차가 있는 합성 작업률, 일차방정식 | 1→2 | ≥5 | 5000 | 0 | 179 | 1 | 합격 |
| `rr.proportion.unit_ratio` | 지도 위 넓이와 실제 넓이의 비에서 길이 축척(제곱근)을 역산해 실제 도로 길이를 지도 길이로 환산 | 넓이비는 길이비의 제곱이라는 차원 변환과 그 역산(제곱근) — medium 은 길이 축척 하나의 비례 | 넓이와 길이 축척의 관계, 제곱근, 단위 비율 환산 | 1→2 | ≥5 | 5000 | 0 | 82 | 1 | 합격 |
| `rr.chained_conversion.compose_kind` | 분→시 환산 → 거리=속력×시간 → 연비로 연료량(또는 100마일당 연료 사용량을 역수로 해석) → 연료비 | 속도·연비·가격·시간 단위를 한 사슬로 연결하면서 연비가 '100마일당 갤런' 꼴이면 역수 방향을 스스로 판단 — medium 은 단위 환산 두 번 | 연쇄 단위 환산, 거리·속력·시간, 비율의 방향(역수) 해석 | 3→3 | ≥5 | 4979 | 0 | 216 | 2 | 합격 |
| `rr.chained_conversion.unit_ratio` | 수조의 수심 증가분으로 부피(m³)를 구하고 1 m³ = 1000 L 로 환산한 뒤 분당 급수량으로 나눠 시간을 구함 | 부피 단위는 길이 환산의 세제곱(1 m³ = 1000 L)이라는 차원 변환과 수심 변화량 추출 — medium 은 선형 길이 단위 환산 | 부피 단위 환산, 직육면체 부피, 비율(유량)로 시간 계산 | 3→3 | ≥5 | 5000 | 0 | 49 | 1 | 합격 |
| `rr.chained_conversion.compare_scenarios` | 두 상품의 가격을 공통 단위(리터당 센트)로 환산(리터·밀리리터·달러·센트)한 뒤 차이를 구함 | 서로 다른 용량 단위·화폐 단위를 공통 단위로 통일해 비교(단위 기준 선택)한 뒤 차를 구함 — medium 은 단일 환산 | 단위 가격, 용량 단위 환산, 두 값 비교 | 3→3 | ≥5 | 5000 | 0 | 81 | 1 | 합격 |
| `rr.chained_conversion.chain2` | km/h → m/min 환산 후 구간 1·2 이동 거리를 각각 구해 합산 | 속력 단위(km/h→m/min) 환산을 구간마다 독립 적용하고 합산(구간별 속력·시간이 다름) — medium 은 한 구간 단위 환산 | 속력 단위 환산, 구간별 거리, 합산 | 3→3 | ≥5 | 4950 | 0 | 81 | 1 | 합격 |
| `le.solve.param_condition` | k(x+m)+n = a(x+b)+c 에서 해가 무수히 많거나(또는 없도록) 하는 매개변수를 x 계수 일치·상수항 일치 두 조건으로 결정 | '해가 무수히 많다/없다'를 x 계수 일치 + 상수항 일치(불일치)라는 두 조건으로 번역 — medium 은 해를 하나 구하는 풀이 | 해의 개수 조건, 분배·동류항 정리, 항등식 계수 비교 | 2→3 | ≥5 | 5000 | 0 | 400 | 2 | 합격 |
| `le.solve.constraint_select` | 유리방정식 (x+a)/(x-b) = c + d/(x-b) 를 양변에 (x-b)를 곱해 일차방정식으로 바꿔 풀고, 얻은 해가 정의역 x≠b 에 맞는지(외래근) 확인 | 분모에 변수가 있는 방정식의 정의역 제약과 외래근 판별 — medium 은 분모에 변수가 없는 일차방정식 | 유리방정식, 정의역 제약, 외래근 판별 | 2→3 | ≥5 | 5000 | 0 | 71 | 2 | 합격 |
| `le.solve.chain2` | 첫 방정식의 해 s 를 구하고 '둘째 방정식의 해 = α s + β' 관계로 둘째 해를 정한 뒤 둘째 방정식에 대입해 상수 k 를 구함 | 두 방정식의 해를 문장 관계로 연결하는 2단계 연쇄 — medium 은 방정식 하나의 해 | 일차방정식 풀이, 해 사이의 관계(문장→식), 대입으로 미지 상수 결정 | 2→3 | ≥5 | 5000 | 0 | 400 | 6 | 합격 |
| `le.solve.compose_kind` | 직사각형의 가로·세로가 x 의 일차식이고 둘레가 주어졌을 때 둘레식으로 x 를 구한 뒤 가로×세로로 넓이를 계산 | 일차방정식을 기하 공식(둘레→변→넓이)과 합성 — medium 은 방정식의 해 x 만 구함 | 일차방정식, 직사각형 둘레, 직사각형 넓이 | 2→3 | ≥5 | 5000 | 0 | 62 | 1 | 합격 |
| `le.word_problem_translate.chain2` | 연속한(짝수·홀수) 정수 k 개의 합과 가장 큰 수 사이의 관계를 식으로 번역해 가장 작은 수를 구하고, 그 결과로 가장 큰 수를 계산 | 문장 관계(합 = α·최댓값 + β)를 변수 하나로 번역하는 두 겹의 식 세우기와 '묻는 수 ≠ 미지수' 재계산 — medium 은 한 번의 관계식 | 연속 정수 표현, 문장→방정식, 묻는 대상 재계산 | 2→2 | ≥5 | 5000 | 0 | 52 | 2 | 합격 |
| `le.word_problem_translate.unit_ratio` | 두 사람이 함께 일한 부분(h/p + h/q)을 뺀 나머지를 한 사람이 혼자 끝내는 시간을 작업률(1/p, 1/q)로 세운 방정식으로 구해 총 시간을 계산 | 작업량=1 을 기준으로 한 작업률의 역수 모델링과 '함께 → 혼자' 두 구간 합성 — medium 은 한 번의 선형 관계식 | 작업률(역수), 분수 방정식, 구간 합성 | 2→2 | ≥5 | 4999 | 0 | 236 | 1 | 합격 |
| `le.word_problem_translate.constraint_select` | 나이 문제: 현재 배수 관계와 y년 뒤 합(또는 y년 전 배수 관계)을 식으로 세워 풀고 제약(나이 양수)에 맞는 해 선택 | 시점이 다른 두 조건(현재·미래/과거)을 각각 식으로 번역하고 같은 변수로 연결 — medium 은 한 시점 관계 | 시점별 나이 표현, 문장→방정식, 제약 확인 | 2→2 | ≥5 | 5000 | 0 | 269 | 2 | 합격 |
| `le.word_problem_translate.repr_shift` | 세 종류 물건의 개수 관계(C = B + q, A = m × B)와 총 가치를 식으로 번역해 B 의 개수를 구하고 묻는 종류의 개수를 계산 | 여러 미지수를 하나의 변수로 줄이는 번역(개수 관계)과 가치 가중합 식 — medium 은 한 종류 관계 | 미지수 축소(변수 하나로 표현), 가치 가중합, 문장→방정식 | 2→2 | ≥5 | 5000 | 0 | 400 | 1 | 합격 |
| `le.literal_rearrange.compose_kind` | A = P + P·r·t 처럼 같은 변수가 두 번 나오는 공식을 P 에 대해 묶어(인수분해) 정리하고, 주어진 수로 계산 | 목표 변수가 두 항에 나오므로 공통인수로 묶어 재배열(literal equation 의 핵심 함정)한 뒤 수치 대입 — medium 은 한 항의 이항·나눗셈 | 리터럴 방정식 재배열, 공통인수로 묶기, 퍼센트→소수 | 2→3 | ≥5 | 5000 | 0 | 93 | 1 | 합격 |
| `le.literal_rearrange.inverse` | 역수 공식 1/f = 1/u + 1/v 에서 f, u 가 주어졌을 때 v 를 역산(1/v = 1/f − 1/u → 통분 → 역수) | 분수식에서 변수가 분모에 있는 공식을 역수 형태로 재배열(통분 후 다시 뒤집기) — medium 은 분모에 변수가 없는 재배열 | 역수 공식, 분수 통분, 리터럴 방정식 재배열 | 2→3 | ≥5 | 5000 | 0 | 125 | 3 | 합격 |
| `le.literal_rearrange.chain2` | F = (9/5)C + 32 를 두 방향으로 연쇄 사용: 화씨→섭씨, 섭씨 변화량 적용, 다시 화씨 | 같은 공식을 역방향→변화량 적용→정방향으로 연쇄하고 '섭씨 변화량은 화씨로 9/5 배' 단위 규모를 구분 — medium 은 공식 한 번 적용 | 공식 역방향 사용, 변화량과 절대값 구분, 연쇄 환산 | 2→3 | ≥5 | 5000 | 0 | 136 | 2 | 합격 |
| `le.literal_rearrange.param_condition` | ax + by = cx + d 를 x = my + n 으로 재배열했을 때의 계수 m, n 을 구해 m + n 계산 | x 항을 한쪽으로 모아 공통인수 (a−c)로 묶어 나누고 y 계수·상수를 각각 읽어내는 재배열 — medium 은 한 변수 이항 | 리터럴 방정식 재배열, 공통인수 묶기, 계수 읽기 | 2→3 | ≥5 | 5000 | 0 | 60 | 1 | 합격 |
| `probability.simple.compose_kind` | 면의 수가 다른 두 주사위의 표본공간(s1×s2)에서 소수·배수·인수 관계 사건의 경우의 수를 체계적으로 세어 확률을 구함 | 두 대상의 합성 표본공간 구성과 사건의 수론 성질(소수·약수·배수) 분석 — medium 은 한 번의 단순 확률 | 합성 표본공간, 수론 성질(소수·배수·약수), 경우의 수 세기 | 2→2 | ≥5 | 5000 | 0 | 113 | 6 | 합격 |
| `probability.simple.inverse` | '정확히 하나만 하는 학생 수 r'와 각 활동 인원 A, B 로부터 '둘 다 하는 학생 수' C=(A+B−r)/2 를 역산해 확률을 구함 | 합집합 공식을 역방향으로 사용해 교집합을 구하는 역문제(정확히 하나 = A+B−2C) — medium 은 주어진 개수로 바로 확률 계산 | 벤 다이어그램 집합 관계, 교집합 역산, 확률 | 2→2 | ≥5 | 5000 | 0 | 54 | 1 | 합격 |
| `probability.simple.compare_scenarios` | 빨간 구슬 r개·파란 구슬 b개 주머니에 빨간 구슬을 x개 더 넣어 P(빨강)=p/q 가 되게 하는 x 를 방정식으로 구함(처음과 나중 비교) | 현재·추가 후 두 상태의 확률 비교를 미지수 방정식으로 세우는 역문제 — medium 은 주어진 구성에서 확률 계산 | 확률 정의, 분수 방정식, 상황 변화 | 2→2 | ≥5 | 5000 | 0 | 108 | 1 | 합격 |
| `probability.simple.repr_shift` | 원판 세 부채꼴의 중심각이 x 의 일차식일 때 합=360° 방정식으로 x 를 구해 한 부채꼴의 확률(각/360)을 구함 | 기하 표현(중심각 합 360°)을 대수 방정식으로 번역한 뒤 확률로 재해석 — medium 은 주어진 각으로 바로 확률 계산 | 원의 중심각 합, 일차방정식, 기하학적 확률 | 2→2 | ≥5 | 4998 | 0 | 107 | 1 | 합격 |
| `probability.conditional.repr_shift` | 전체·한 집단 크기·전체 선호 인원·한 집단의 선호 인원이 주어진 서술형 자료에서 이원표의 빠진 칸을 채워 다른 집단의 조건부 확률을 구함 | 서술된 주변합·일부 칸으로 이원표를 복원한 뒤 조건(다른 집단)의 행만 골라 조건부 확률 — medium 은 완성된 표에서 읽기 | 이원표 복원, 조건부 확률, 여집단 계산 | 2→2 | ≥5 | 5000 | 0 | 124 | 1 | 합격 |
| `probability.conditional.chain2` | 기계 A·B 의 생산 비율과 각 불량률로 1000개 기준 불량 개수를 구한 뒤 '불량품이 A 에서 나왔을 확률'(역조건)을 계산 | 정방향 확률(기계→불량)을 역방향(불량→기계)으로 뒤집는 2단계 조건부 확률 — medium 은 한 방향의 조건부 확률 | 조건부 확률(역방향), 가중 평균 개수, 비율 계산 | 2→2 | ≥5 | 5000 | 0 | 131 | 1 | 합격 |
| `probability.conditional.inverse` | P(A∩B)와 P(A|B)가 주어졌을 때 조건부확률 정의를 뒤집어 P(B)를 구한 뒤 여사건 1−P(B)를 계산 | 조건부확률 정의 P(A|B)=P(A∩B)/P(B)를 역방향으로 써서 P(B)를 구하고 여사건까지 잇는 2단계 — medium 은 정의를 그대로 적용 | 조건부확률 정의 역산, 분수 나눗셈, 여사건 | 2→2 | ≥5 | 5000 | 0 | 55 | 1 | 합격 |
| `probability.conditional.compose_kind` | 두 주사위 표본공간에서 조건(합이 t 이상)을 만족하는 경우를 먼저 추려 그 안에서 사건의 개수를 세 조건부확률을 구함 | 표본공간을 조건으로 축소한 뒤 그 안에서 사건을 세는 2단계(조건 축소→사건 계수) — medium 은 축소 없이 전체에서 한 번 계산 | 표본공간 축소, 조건부확률, 경우의 수 세기 | 2→2 | ≥5 | 5000 | 0 | 82 | 3 | 합격 |
| `probability.sequential_without_replacement.compare_scenarios` | 같은 주머니에서 복원·비복원으로 두 번 뽑아 모두 빨간 공일 확률을 각각 구해 그 차이를 계산 | 복원/비복원 두 시행 모델을 비교하고 분수 뺄셈으로 차이를 구함 — medium 은 한 시행의 연속 확률 | 복원·비복원 추출, 독립/종속 사건, 분수 뺄셈 | 0→2 | ≥5 | 5000 | 0 | 48 | 1 | 합격 |
| `probability.sequential_without_replacement.inverse` | 빨간 공 r개와 미지수 b개의 파란 공이 든 주머니에서 비복원으로 두 개를 뽑아 모두 빨간 공일 확률이 p/q 일 때 b 를 구함 | 연속 비복원 확률 식 r(r−1)/(n(n−1)) 을 세워 미지수 n=r+b 를 역산(이차 관계를 대입·탐색으로 해결) — medium 은 주어진 구성에서 확률 계산 | 비복원 연속 확률, 미지수 역산(분수·이차 관계), 표본공간 크기 관계 | 0→2 | ≥5 | 5000 | 0 | 96 | 1 | 합격 |
| `probability.sequential_without_replacement.constraint_select` | 세 색 공에서 비복원으로 세 개를 뽑을 때 '색이 모두 다름' 또는 '빨간 공이 하나 이상'의 확률(순서 경우의 수·여사건) | 순서 있는 표본공간에서 색 배치(3!)를 고려한 경우의 수 또는 여사건 전환 — medium 은 두 번 뽑기의 곱 | 순서 있는 비복원 추출, 경우의 수(3!)·여사건, 분수 약분 | 0→2 | ≥5 | 5000 | 0 | 56 | 2 | 합격 |
| `probability.sequential_without_replacement.chain2` | 주머니 A 에서 공 하나를 B 로 옮긴 뒤 B 에서 뽑을 때 빨간 공일 확률: 옮긴 공의 색에 따른 두 경우의 가중합 | 앞 단계(이동한 공의 색)가 뒤 단계 확률을 바꾸는 경우 분할과 가중합(전확률) — medium 은 한 주머니의 연속 추출 | 경우 분할·가중합(전확률), 조건부확률, 분수 덧셈 | 0→2 | ≥5 | 5000 | 0 | 61 | 1 | 합격 |

## 7. 검증 계층(모든 원형 공통)

1. **구성 vs brute-force 독립 재계산**: 생성기는 정답을 닫힌 식·역산으로 '구성'하고, 문항마다 함께 내보내는 `verification_js`(외부 입력 없는 JS 본문, `vm` 500ms 제한)는 **문제에 인쇄된 수치만으로** 정수 스캔·전수 열거·수치 평가로 답을 다시 구한다. 두 경로의 답이 다른 선택지와 겹치지 않고 표기 정답과 일치해야 통과.
2. **선지 문자열 재해석**: 선택지 텍스트를 수식 평가기(`evalMath`: 분수·암묵 곱셈·제곱근·지수)로 다시 읽어 값을 만든다(생성기가 주장한 값을 믿지 않음). 식형 선지는 검사 지점에서 값이 같아지는 오답 후보를 만들 때부터 제외.
3. **인쇄 충실성**: `verification_js` 상수가 지문·질문·선지에 실제로 적힌 수인지 확인(숨은 값으로 푼 재계산 방지), '상수 X 와 Y'로 선언한 문자가 수식에 있는지 확인(변수명 불일치 — 실제로 발견해 수정).
4. **표기 규칙**: `$` 짝 맞춤·수식 안 한글 금지·지문/질문 영어 전용·`NaN/undefined` 누출·금칙어.
5. **공개 게이트 동일 적용**: `import.ts` 와 같은 합성(`composeProblemText`)으로 `checkContent` 이슈 0·`checkFigure` 통과(그림 없는 문항이 'as shown' 류 표현을 쓰면 `figure_required` 로 거절 — 실제로 잡아 문구 수정). 원형 문항은 그림을 쓰지 않아 렌더는 KaTeX 수식뿐이다.
6. **돌연변이 테스트**: 정답 키 변경·검증 상수 변경·선지 중복·수식 안 한글·`$` 불일치·상수 미인쇄·단계 부족·4자리 숫자가 모두 검증기에서 실패하는지 확인(검증기가 공허하지 않음).

한계(미완료): 텍스트 문장과 모델 변수의 의미 일치(예: '둘레'를 '넓이'로 쓴 문장 오류)는 자동 검증으로 보증되지 않는다 — 원형당 샘플 1~2건의 사람 눈 확인이 필요하다(아래 Preview 샘플).

## 8. 기존 컴파일러 19종 측정

### 8.1 불변식 스윕(정확성)

75 세부 패턴 + 카탈로그 밖 3 skill × 난이도 3 = 234칸 × 10,000 시드 = **2,340,000회**: 채택 2,160,000건, **예외·선택지 4개 미만/중복·정답 인덱스·오답 근거 인덱스 위반 0건**. 자료 필수 세부 패턴(`probability.sequential_without_replacement`·`two_variable_data.scatter_*` 등)은 자료 정책 없이 전부 거절되므로 `require_data` 로 재실행했다. 답 자체의 독립 재계산(brute-force)은 **기존 컴파일러에는 아직 없다**(각 컴파일러 `validate*Model` 의 닫힌 식 검산뿐) — 미완료 항목.

### 8.2 간헐 실패 원인과 수정(총괄 요청)

`linear-equations-one-var.test.ts` 의 '오답은 항상 정확히 3개' 가 간헐 실패한 원인: 오답 후보가 3개 미만으로 남으면 30회 재시도 끝에 **마지막 시도에서 짧은(오답 1~2개) 모델을 그대로 반환**하는 경로(`if (distractors.length < 3 && attempt < 29) continue;`). 시드 스윕으로 재현(solve 난이도 hard 시드 336·3498·12023·13719·15640·15651·16103, medium 10757 — 18만 시드 중 8건). 실제 제품 경로에서는 `validateLinearOneVarModel` 이 거절해 화면에 나가지 않았지만 모델 단위 테스트가 난수 때문에 흔들렸다. 수정: (1) 후보 풀 확대(두 예비 오류 경로 추가), (2) 마지막 시도에서도 3개 미만이면 반환하지 않고 루프 뒤 throw, (3) **같은 패턴 38곳**(area_volume 6·circles 10·equivalent_expressions 2·linear_functions 3·linear_two_variables 2·nonlinear_equations_systems 3·nonlinear_functions 4·lines_angles_triangles 4·right_triangles 3·linear_inequalities 1)에 같은 규칙 적용, (4) `runMathCompilerBatch` 가 컴파일러 예외를 그 후보만 실패로 집계하도록 try/catch, (5) 기존 난수 의존 테스트를 시드 고정 + 고정 시드 회귀(수정 전 실패·후 통과 확인) + 3,000시드 스윕 테스트 추가, (6) 234칸 × 120시드 스윕 테스트(`sweep.test.ts`).

### 8.3 공급 가능량(easy/medium, 세부 패턴 강제 표집 1,500건/칸)

`independent100` = 본문 유사도 0.6 미만 독립 문항 수(표본 섞어 25/50/100% 곡선 측정, 대부분 25% 시점에 이미 포화). 그룹 수 = 유사문항 그룹(세부 패턴). easy/medium 은 같은 틀(숫자 범위만 다름)이라 **합산이 아니라 공유**된다.

| skill | 난이도 | 그룹 수 | 독립 25%/50%/100% | 세부 패턴별 독립 수 |
|---|---|---|---|---|
| linear_equations_two_var | easy | 6 | 13/16/21 | intersection_x:1, intersection_y:1, intersection_sum:1, slope:1, intercept:1, num_solutions:15 |
| linear_equations_two_var | medium | 6 | 12/15/19 | intersection_x:1, intersection_y:1, intersection_sum:1, slope:1, intercept:1, num_solutions:16 |
| systems_linear | easy | 4 | 4/4/4 | intersection_x:1, intercept:1, intersection_y:1, slope:1 |
| systems_linear | medium | 6 | 13/16/21 | intersection_x:1, intercept:1, intersection_sum:1, intersection_y:1, num_solutions:14, slope:1 |
| linear_inequalities | easy | 3 | 4/4/4 | solve_one_var:2, point_in_solution:1, table_verification:1 |
| linear_inequalities | medium | 3 | 4/4/4 | solve_one_var:2, point_in_solution:1, table_verification:1 |
| linear_equations_one_var | easy | 3 | 102/226/476 | solve:2, word_problem_translate:1, literal_rearrange:472 |
| linear_equations_one_var | medium | 3 | 103/221/476 | solve:2, word_problem_translate:1, literal_rearrange:472 |
| linear_functions | easy | 5 | 10/11/11 | evaluate:1, find_x_for_value:1, slope_from_two_points:1, interpret_slope:4, interpret_intercept:6 |
| linear_functions | medium | 5 | 7/8/8 | evaluate:1, find_x_for_value:1, slope_from_two_points:1, interpret_slope:4, interpret_intercept:4 |
| equivalent_expressions | easy | 2 | 3/3/3 | polynomial_distribution:2, rational_equivalence:1 |
| equivalent_expressions | medium | 2 | 3/3/3 | polynomial_distribution:2, rational_equivalence:1 |
| nonlinear_equations_systems | easy | 9 | 12/14/15 | root:1, sum_of_roots:1, product_of_roots:1, num_real_solutions:5, irrational_sum_of_roots:1, irrational_product_of_roots:1, irrational_root_radical_form:1, linear_quadratic_intersection:5, parameter_discriminant:1 |
| nonlinear_equations_systems | medium | 9 | 12/12/14 | root:1, sum_of_roots:1, product_of_roots:1, num_real_solutions:4, irrational_sum_of_roots:1, irrational_product_of_roots:1, irrational_root_radical_form:1, linear_quadratic_intersection:5, parameter_discriminant:1 |
| nonlinear_functions | easy | 6 | 14/14/14 | evaluate:1, vertex_x:1, vertex_y:1, find_x_for_value:4, interpret_a:4, interpret_b:4 |
| nonlinear_functions | medium | 6 | 14/14/14 | evaluate:1, vertex_x:1, vertex_y:1, find_x_for_value:4, interpret_a:4, interpret_b:4 |
| ratios_rates_units | easy | 2 | 12/12/12 | proportion:5, chained_conversion:7 |
| ratios_rates_units | medium | 2 | 12/12/12 | proportion:5, chained_conversion:7 |
| percentages | easy | 5 | 6/6/6 | percent_of:1, find_whole:1, percent_change:1, find_percent:1, compound_change:2 |
| percentages | medium | 5 | 6/6/6 | percent_of:1, find_whole:1, percent_change:1, find_percent:1, compound_change:2 |
| one_variable_data | easy | 4 | 2/2/2 | mean:1, median:1, range:1, grouped_median_interval:1 |
| one_variable_data | medium | 4 | 2/2/2 | mean:1, median:1, range:1, grouped_median_interval:1 |
| two_variable_data | easy | 3 | 7/7/7 | cell:3, row_total:1, conditional_share:3 |
| two_variable_data | medium | 3 | 7/7/7 | cell:3, row_total:1, conditional_share:3 |
| probability | easy | 2 | 2/2/2 | simple:1, conditional:1 |
| probability | medium | 2 | 2/2/2 | simple:1, conditional:1 |
| inference_margin_error | easy | 1 | 4/4/4 | -:4 |
| inference_margin_error | medium | 1 | 4/4/4 | -:4 |
| evaluating_statistical_claims | easy | 1 | 4/4/4 | -:4 |
| evaluating_statistical_claims | medium | 1 | 4/4/4 | -:4 |
| area_volume | easy | 6 | 5/5/5 | rectangle_area:1, triangle_area:1, prism_volume:1, prism_missing_dimension:1, cylinder_volume_radius:1, cylinder_volume_diameter:1 |
| area_volume | medium | 6 | 5/5/5 | rectangle_area:1, triangle_area:1, prism_volume:1, prism_missing_dimension:1, cylinder_volume_radius:1, cylinder_volume_diameter:1 |
| lines_angles_triangles | easy | 3 | 3/3/3 | triangle_angle_sum:1, isosceles_base_angle:1, similar_triangles:1 |
| lines_angles_triangles | medium | 3 | 3/3/3 | triangle_angle_sum:1, isosceles_base_angle:1, similar_triangles:1 |
| right_triangles_trigonometry | easy | 3 | 1/1/1 | pythagorean_hypotenuse:1, pythagorean_leg:1, trig_ratio:1 |
| right_triangles_trigonometry | medium | 3 | 1/1/1 | pythagorean_hypotenuse:1, pythagorean_leg:1, trig_ratio:1 |
| circles | easy | 7 | 7/7/7 | circumference_radius:1, circumference_diameter:1, arc_length:1, sector_area:1, central_from_inscribed:1, inscribed_from_central:1, circle_equation_transform:3 |
| circles | medium | 7 | 7/7/7 | circumference_radius:1, circumference_diameter:1, arc_length:1, sector_area:1, central_from_inscribed:1, inscribed_from_central:1, circle_equation_transform:3 |

## 9. 산출 목표량 — skill × 난이도 생산 가능 수량과 AI 부족분

필요량은 `plan.json` 3세트분 목표 × 10(30세트, 기존 공개분 차감 전). '안전 생산' = min(본문 유사도 0.6 미만 독립 문항 수, 유사문항 그룹 수 × 30세트)(세트당 그룹 1문항 제약). hard 는 파일럿 원형 기준.

| skill | 필요 easy | 필요 medium | 필요 hard | 기존 컴파일러 안전 생산(easy+medium 합, 프레임 공유) | easy+medium AI 부족분 | 원형 수(파일럿) | 원형 hard 안전 생산 상한 | hard AI 부족분 |
|---|---|---|---|---|---|---|---|---|
| linear_equations_one_var | 30 | 90 | 20 | 90 | 30 | 12 | 711 | 0 |
| linear_functions | 30 | 90 | 20 | 11 | 109 | 0 | 0(미구현) | 20 |
| linear_equations_two_var | 30 | 90 | 20 | 21 | 99 | 0 | 0(미구현) | 20 |
| systems_linear | 30 | 90 | 20 | 21 | 99 | 0 | 0(미구현) | 20 |
| linear_inequalities | 30 | 90 | 10 | 4 | 116 | 0 | 0(미구현) | 10 |
| equivalent_expressions | 50 | 150 | 30 | 3 | 197 | 8 | 392 | 0 |
| nonlinear_equations_systems | 50 | 150 | 30 | 15 | 185 | 0 | 0(미구현) | 30 |
| nonlinear_functions | 50 | 150 | 30 | 14 | 186 | 0 | 0(미구현) | 30 |
| ratios_rates_units | 10 | 30 | 10 | 12 | 28 | 8 | 330 | 0 |
| percentages | 10 | 30 | 10 | 6 | 34 | 0 | 0(미구현) | 10 |
| one_variable_data | 10 | 30 | 0 | 2 | 38 | 0 | 0(미구현) | 0 |
| two_variable_data | 10 | 30 | 0 | 7 | 33 | 0 | 0(미구현) | 0 |
| probability | 10 | 30 | 0 | 2 | 38 | 12 | 521 | 0 |
| inference_margin_error | 10 | 30 | 0 | 4 | 36 | 0 | 0(미구현) | 0 |
| evaluating_statistical_claims | 10 | 30 | 0 | 4 | 36 | 0 | 0(미구현) | 0 |
| area_volume | 20 | 50 | 10 | 5 | 65 | 0 | 0(미구현) | 10 |
| lines_angles_triangles | 20 | 50 | 10 | 3 | 67 | 0 | 0(미구현) | 10 |
| right_triangles_trigonometry | 20 | 50 | 10 | 1 | 69 | 0 | 0(미구현) | 10 |
| circles | 10 | 40 | 10 | 7 | 43 | 0 | 0(미구현) | 10 |
| **합계** | 440 | 1300 | 240 | 232 | 1508 | 40 | 60(필요량 이내만) | 180 |

- easy+medium: 기존 컴파일러 안전 생산 232 / 1,740, **AI 또는 신규 easy/medium 원형이 채워야 할 부족분 1,508**(이 문서의 원형 체계를 easy/medium 으로 확장하면 AI 없이 줄일 수 있다 — 총괄 결정 필요).
- hard: 파일럿 skill 중 필요량이 있는 `linear_equations_one_var`(20)·`equivalent_expressions`(30)·`ratios_rates_units`(10)은 원형만으로 충족. 나머지 11개 skill 의 hard 180은 원형 미구현(진행표).

## 10. Preview 육안 확인 샘플(원형당 2건)

`data/mock-exam-generation/math-archetype-pilot/passed.json`(80건, import.ts 호환)·`samples.tsv`. 재생성: `npx tsx scripts/mock-exam-generation/archetype-pilot-samples.ts`. 로컬 임포트(총괄이 대상 DB 지정): `npx tsx scripts/mock-exam-generation/import.ts --file data/mock-exam-generation/math-archetype-pilot/passed.json --tag math-archetype-pilot`. 같은 (원형, 시드)는 언제나 같은 문항이고 gid 도 같다.

| 원형 | 시드 | gid | 그룹(subpattern) |
|---|---|---|---|
| `ee.polynomial_distribution.compose_kind` | 0 | `a8b1b69b-4c8f-590e-afff-db8dadc5f7b8` | `ee.polynomial_distribution.compose_kind/abstract` |
| `ee.polynomial_distribution.compose_kind` | 1 | `a6119db6-12d7-5773-aa4d-39a06e47d207` | `ee.polynomial_distribution.compose_kind/area_context` |
| `ee.polynomial_distribution.inverse` | 0 | `e966cb21-dc53-5f87-a988-897b75197018` | `ee.polynomial_distribution.inverse/coefficient_inverse` |
| `ee.polynomial_distribution.inverse` | 1 | `746d6e01-2062-5fd7-a384-38c2ce63f62c` | `ee.polynomial_distribution.inverse/coefficient_inverse` |
| `ee.polynomial_distribution.constraint_select` | 0 | `c1e88672-4cfc-50c9-a3bb-cb05fb121796` | `ee.polynomial_distribution.constraint_select/abstract` |
| `ee.polynomial_distribution.constraint_select` | 1 | `c69b349d-65b3-561b-ad93-70da4630ea4b` | `ee.polynomial_distribution.constraint_select/rectangle_context` |
| `ee.polynomial_distribution.repr_shift` | 0 | `6778ef4b-0119-5f5f-a805-9e1be93fece4` | `ee.polynomial_distribution.repr_shift/border_area` |
| `ee.polynomial_distribution.repr_shift` | 1 | `10de2ad7-c507-5eeb-a690-5638e7e9a691` | `ee.polynomial_distribution.repr_shift/border_area` |
| `ee.rational_equivalence.inverse` | 0 | `c482e185-b532-53f4-a437-19b385254e9a` | `ee.rational_equivalence.inverse/product` |
| `ee.rational_equivalence.inverse` | 1 | `aec10900-586b-59e6-ae0d-07938f14d89c` | `ee.rational_equivalence.inverse/product` |
| `ee.rational_equivalence.compose_kind` | 0 | `b76d76e1-1bf2-5425-a80d-2ef49f3be897` | `ee.rational_equivalence.compose_kind/reciprocal_of_difference` |
| `ee.rational_equivalence.compose_kind` | 1 | `b3f28525-4c59-507c-a6d1-502c7f71ef90` | `ee.rational_equivalence.compose_kind/reciprocal_of_difference` |
| `ee.rational_equivalence.param_condition` | 0 | `85e88847-4fcf-5079-a02e-5915b7718108` | `ee.rational_equivalence.param_condition/ask_sum` |
| `ee.rational_equivalence.param_condition` | 1 | `6d1377b7-430b-5169-a0f8-4b7b552fa32d` | `ee.rational_equivalence.param_condition/ask_k` |
| `ee.rational_equivalence.constraint_select` | 0 | `4faa3eff-57ca-5d24-a787-2586e8161d5a` | `ee.rational_equivalence.constraint_select/excluded_values_sum` |
| `ee.rational_equivalence.constraint_select` | 1 | `aa73c9a8-2d18-5919-ae76-908e8d93bd5b` | `ee.rational_equivalence.constraint_select/excluded_values_sum` |
| `rr.proportion.chain2` | 0 | `c88374f8-9926-56f7-a53e-d2b35be92438` | `rr.proportion.chain2/mixture` |
| `rr.proportion.chain2` | 1 | `cc6c9f5f-4e30-5399-a093-d2692507a2ed` | `rr.proportion.chain2/mixture` |
| `rr.proportion.inverse` | 0 | `adc7547f-2e25-59c1-afd5-675afa7330dd` | `rr.proportion.inverse/remove` |
| `rr.proportion.inverse` | 1 | `560a17d9-fce4-52d2-a9a8-abaca52f3323` | `rr.proportion.inverse/remove` |
| `rr.proportion.compare_scenarios` | 0 | `a9615f67-50d3-501a-adf3-3ba196ea36b7` | `rr.proportion.compare_scenarios/head_start` |
| `rr.proportion.compare_scenarios` | 1 | `0e0e3b8e-1c8f-5575-a27f-6a58c2a83b2d` | `rr.proportion.compare_scenarios/head_start` |
| `rr.proportion.unit_ratio` | 0 | `fa9e5dbf-e9fa-51f1-abbe-bf1fe16fc939` | `rr.proportion.unit_ratio/area_scale_inverse` |
| `rr.proportion.unit_ratio` | 1 | `8ea695e6-2480-574c-a927-d852718e965d` | `rr.proportion.unit_ratio/area_scale_inverse` |
| `rr.chained_conversion.compose_kind` | 0 | `68773330-eff5-533e-a9ec-75de3b70ace6` | `rr.chained_conversion.compose_kind/gallons_per_100_miles` |
| `rr.chained_conversion.compose_kind` | 1 | `f14646fc-eb2e-5a6d-a338-309c74ff88ab` | `rr.chained_conversion.compose_kind/gallons_per_100_miles` |
| `rr.chained_conversion.unit_ratio` | 0 | `c286ef2b-3995-5a40-a129-e37ec7b9b24b` | `rr.chained_conversion.unit_ratio/volume_to_time` |
| `rr.chained_conversion.unit_ratio` | 1 | `5ee47cd6-00dd-5fc2-a9c6-6affd039bd3c` | `rr.chained_conversion.unit_ratio/volume_to_time` |
| `rr.chained_conversion.compare_scenarios` | 0 | `95105d8c-add9-5126-afbd-591ec65672d4` | `rr.chained_conversion.compare_scenarios/unit_price_gap` |
| `rr.chained_conversion.compare_scenarios` | 1 | `d3bbc3d3-8872-516e-a375-09e5a5c0745f` | `rr.chained_conversion.compare_scenarios/unit_price_gap` |
| `rr.chained_conversion.chain2` | 0 | `a7137707-f6c4-55f1-a12c-e8ef845abddf` | `rr.chained_conversion.chain2/two_legs` |
| `rr.chained_conversion.chain2` | 1 | `0e5a58c5-dab7-5d96-ad6b-e96df9bccffa` | `rr.chained_conversion.chain2/two_legs` |
| `le.solve.param_condition` | 0 | `85643397-1ec3-51d7-a164-0662df21ec3c` | `le.solve.param_condition/infinitely_many` |
| `le.solve.param_condition` | 1 | `c0a486f4-ff8e-5e40-afe0-280b2e90c01c` | `le.solve.param_condition/no_solution` |
| `le.solve.constraint_select` | 0 | `4c3d67fb-e9c8-5d67-acd7-08c1e24db454` | `le.solve.constraint_select/count_solutions` |
| `le.solve.constraint_select` | 1 | `10467a75-80b0-5e31-a2db-af973edb0fb8` | `le.solve.constraint_select/count_solutions` |
| `le.solve.chain2` | 0 | `09e112d2-e7a0-5b77-a9d6-0cdc06aa8ff4` | `le.solve.chain2/relation_the_opposite_of` |
| `le.solve.chain2` | 1 | `51498776-064a-5387-ae10-7fafc7eea97c` | `le.solve.chain2/relation_4_less_than` |
| `le.solve.compose_kind` | 0 | `73b67de1-3a2e-5507-aaf8-65d29183f198` | `le.solve.compose_kind/perimeter_to_area` |
| `le.solve.compose_kind` | 1 | `2f201347-7e58-5e3c-a511-4c5aa1c4e82e` | `le.solve.compose_kind/perimeter_to_area` |
| `le.word_problem_translate.chain2` | 0 | `54130a2b-6be9-5c5c-ad23-e99b4cae6d0b` | `le.word_problem_translate.chain2/consecutive_even_odd` |
| `le.word_problem_translate.chain2` | 1 | `700c2955-ac92-58b8-a8fe-491ea24cbcc9` | `le.word_problem_translate.chain2/consecutive_even_odd` |
| `le.word_problem_translate.unit_ratio` | 0 | `d9e6a66c-deb8-5dde-af5b-4f41a9575739` | `le.word_problem_translate.unit_ratio/work_then_alone` |
| `le.word_problem_translate.unit_ratio` | 1 | `619d5696-2e82-5182-a1f7-78f282640809` | `le.word_problem_translate.unit_ratio/work_then_alone` |
| `le.word_problem_translate.constraint_select` | 0 | `d274e6ee-0580-5321-a860-230f378d9258` | `le.word_problem_translate.constraint_select/future_sum` |
| `le.word_problem_translate.constraint_select` | 1 | `30fd65cb-8e4a-5b7f-a947-048e20794268` | `le.word_problem_translate.constraint_select/future_sum` |
| `le.word_problem_translate.repr_shift` | 0 | `d6cc7008-28ac-5987-a15f-1be1428e9e8a` | `le.word_problem_translate.repr_shift/three_item_types` |
| `le.word_problem_translate.repr_shift` | 1 | `d09e32f8-c91e-506b-aebe-e609783af6da` | `le.word_problem_translate.repr_shift/three_item_types` |
| `le.literal_rearrange.compose_kind` | 0 | `4c3c5048-5764-5e77-ae77-4bb95282bf72` | `le.literal_rearrange.compose_kind/factor_then_substitute` |
| `le.literal_rearrange.compose_kind` | 1 | `4b0b4440-8644-54b6-ab9b-1d9e59142f69` | `le.literal_rearrange.compose_kind/factor_then_substitute` |
| `le.literal_rearrange.inverse` | 0 | `802204d0-7041-55b9-af93-8261320ea46c` | `le.literal_rearrange.inverse/thin_lens` |
| `le.literal_rearrange.inverse` | 1 | `c8501683-86ed-5b79-a71f-48aab0e2490a` | `le.literal_rearrange.inverse/parallel_resistors` |
| `le.literal_rearrange.chain2` | 0 | `ebfddbcd-ceaf-51c2-a540-0ab259125248` | `le.literal_rearrange.chain2/warmer` |
| `le.literal_rearrange.chain2` | 1 | `ba5f23cb-19c1-54a5-a134-4215a4c8f600` | `le.literal_rearrange.chain2/warmer` |
| `le.literal_rearrange.param_condition` | 0 | `d1f642c4-94c5-5f39-ae61-1d6f94fde3e9` | `le.literal_rearrange.param_condition/collect_and_divide` |
| `le.literal_rearrange.param_condition` | 1 | `fe54488e-8e9c-5ea0-a596-9ee557387eb6` | `le.literal_rearrange.param_condition/collect_and_divide` |
| `probability.simple.compose_kind` | 0 | `54b8f3e8-cef3-5949-a119-4c9a2a520a62` | `probability.simple.compose_kind/dice_prime` |
| `probability.simple.compose_kind` | 1 | `60861cb5-c409-56ae-a6ef-d08634c8b955` | `probability.simple.compose_kind/dice_prodeven` |
| `probability.simple.inverse` | 0 | `9f2d7953-2133-5e70-a5b6-a52ccd3dae7f` | `probability.simple.inverse/exactly_one_inverse` |
| `probability.simple.inverse` | 1 | `d9745d48-2b75-58b2-ab0c-c63546f64c6a` | `probability.simple.inverse/exactly_one_inverse` |
| `probability.simple.compare_scenarios` | 0 | `7dde7fee-0e77-5a59-a452-14c734eb08f8` | `probability.simple.compare_scenarios/add_to_reach_probability` |
| `probability.simple.compare_scenarios` | 1 | `680c5c10-1745-5c1a-a6bc-301a6d745ada` | `probability.simple.compare_scenarios/add_to_reach_probability` |
| `probability.simple.repr_shift` | 0 | `ceb3ef5b-0f95-5723-a2c4-6a912393f47d` | `probability.simple.repr_shift/angles_to_probability` |
| `probability.simple.repr_shift` | 1 | `a4f53ebb-7d10-523e-a656-195796554885` | `probability.simple.repr_shift/angles_to_probability` |
| `probability.conditional.repr_shift` | 0 | `d99b7776-a786-586c-a76d-0692236a315d` | `probability.conditional.repr_shift/rebuild_two_way_table` |
| `probability.conditional.repr_shift` | 1 | `16e39d73-19cd-52b4-a6f2-7c2d1064c774` | `probability.conditional.repr_shift/rebuild_two_way_table` |
| `probability.conditional.chain2` | 0 | `24cb6e94-dcf9-5b06-a9f1-dd07903c4b64` | `probability.conditional.chain2/reverse_conditional_defects` |
| `probability.conditional.chain2` | 1 | `2ca595c1-0b47-5a90-ae34-ae5e307e8123` | `probability.conditional.chain2/reverse_conditional_defects` |
| `probability.conditional.inverse` | 0 | `6559e7ec-567a-512c-a473-41c77e63cb76` | `probability.conditional.inverse/reverse_definition_complement` |
| `probability.conditional.inverse` | 1 | `9c297570-533d-54fd-aea1-9ffe68b57b3c` | `probability.conditional.inverse/reverse_definition_complement` |
| `probability.conditional.compose_kind` | 0 | `e5fede6f-6b3d-5e10-a7e1-558762fe0b75` | `probability.conditional.compose_kind/dice_given_sum_same` |
| `probability.conditional.compose_kind` | 1 | `c06759b9-99c2-5ed5-afbf-9204305b15b2` | `probability.conditional.compose_kind/dice_given_sum_same` |
| `probability.sequential_without_replacement.compare_scenarios` | 0 | `99eea1c9-60b2-5f3f-a65a-a1a4bfcb0d2b` | `probability.sequential_without_replacement.compare_scenarios/with_vs_without_replacement` |
| `probability.sequential_without_replacement.compare_scenarios` | 1 | `d2e4761f-f749-5fcd-af88-1ed8907a8b3e` | `probability.sequential_without_replacement.compare_scenarios/with_vs_without_replacement` |
| `probability.sequential_without_replacement.inverse` | 0 | `2a18f158-c44e-5958-a7af-144a66a403e5` | `probability.sequential_without_replacement.inverse/unknown_count_from_probability` |
| `probability.sequential_without_replacement.inverse` | 1 | `f8e49c67-a376-58d6-adb8-3705abcda83d` | `probability.sequential_without_replacement.inverse/unknown_count_from_probability` |
| `probability.sequential_without_replacement.constraint_select` | 0 | `d366915d-92e9-5f5f-aaee-3b5ca32b29c9` | `probability.sequential_without_replacement.constraint_select/at_least_one_red` |
| `probability.sequential_without_replacement.constraint_select` | 1 | `685a7431-ccaa-5c7f-a83d-14b74a86060b` | `probability.sequential_without_replacement.constraint_select/at_least_one_red` |
| `probability.sequential_without_replacement.chain2` | 0 | `f89f84c3-88d1-59b2-a603-49acd89e01b6` | `probability.sequential_without_replacement.chain2/transfer_then_draw` |
| `probability.sequential_without_replacement.chain2` | 1 | `3dc644c2-03f1-550c-a584-530e735e97d7` | `probability.sequential_without_replacement.chain2/transfer_then_draw` |

## 11. 진행표(skill · 세부 패턴 · 원형 수 · 합격)

| skill | 세부 패턴 수 | 목표 원형(×4) | 완료 | 합격 | 비고 |
|---|---|---|---|---|---|
| area_volume | 6 | 24 | 0 | - |  |
| circles | 7 | 28 | 0 | - |  |
| linear_equations_one_var | 3 | 12 | 12 | 합격 12 |  |
| linear_functions | 5 | 20 | 0 | - |  |
| linear_inequalities | 3 | 12 | 0 | - |  |
| linear_equations_two_var | 6 | 24 | 0 | - |  |
| lines_angles_triangles | 4 | 16 | 0 | - |  |
| nonlinear_equations_systems | 9 | 36 | 0 | - |  |
| nonlinear_functions | 6 | 24 | 0 | - |  |
| one_variable_data | 4 | 16 | 0 | - |  |
| percentages | 5 | 20 | 0 | - |  |
| probability | 3 | 12 | 12 | 합격 12 |  |
| ratios_rates_units | 2 | 8 | 8 | 합격 8 |  |
| right_triangles_trigonometry | 3 | 12 | 0 | - |  |
| two_variable_data | 7 | 28 | 0 | - | 자료(표·산점도) 필수 패턴이 많아 figure 스키마 연동 필요 |
| equivalent_expressions | 2 | 8 | 8 | 합격 8 |  |
| systems_linear | 4 | 16 | 0 | - |  |
| inference_margin_error | 3 | 12 | 0 | - | 수치형이지만 구조가 단순(비례·구간) — 4개 달성 가능성 중간 |
| evaluating_statistical_claims | 3 | 12 | 0 | - | 정성적 판단형 — 풀이 구조 다양성이 본질적으로 제한될 수 있음(연산자 R·S·V·C 위주, 4개 미달 가능) |
| **합계** | 85 | 340 | 40 | 40 | |

## 12. 확대 계획과 결정 필요

- 확대 순서(30세트 hard 수요 큰 skill 의 세부 패턴부터): nonlinear_equations_systems(9)·nonlinear_functions(6)·equivalent_expressions(완료) → linear_functions·linear_equations_two_var·systems_linear·linear_inequalities → percentages·area_volume·lines_angles_triangles·right_triangles·circles → 수요 0 으로 계산된 통계 5 skill(후순위 필수 포함).
- 원형당 비용은 '사실 문장 대안 작성'이 지배적이다(파일 길이 기준 원형당 약 40~60줄). 세부 패턴 75개 × 4 = 300개를 같은 방식으로 만들면 수작업 분량이 크다 — 대안 문구 작성을 모델 1회성 호출로 보조하는 방안(수 달러 이내)이 있으나 이번 작업에서는 쓰지 않았다(비용 0 유지).
- 자료(표·산점도·도형) 필수 세부 패턴은 기존 figure 스키마와의 연동이 필요하다(원형 파일럿은 그림 없는 문항만).
