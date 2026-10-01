# 2026-10-01 수학 원형 확대 A — nonlinear_equations_systems · nonlinear_functions · equivalent_expressions(easy/medium)

작성: 하위 에이전트(math-archetypes-A). worktree `~/Developer/ALTON-worktrees/math-archetypes-A`, 브랜치 `feat/math-archetypes-A`(베이스 `feat/math-hard-compilers` 344e8c01). 원격 DB·배포·푸시·유료 API·마이그레이션 0. 공용 문서 `2026-09-30-math-hard-archetypes.md` 는 수정하지 않았다.

**사고 기록(공유 로컬 DB)**: 작업 막바지에 문서 작성용 셸 here-doc 의 백틱 문구가 셸에서 실행되는 실수로 이 worktree 에서 `supabase db reset` 이 한 번 실행되어 공유 로컬 Supabase(54422)가 이 브랜치의 마이그레이션(최신 20261986000000) 기준으로 초기화됐다(메인 체크아웃의 최신 20261987000000 및 다른 worktree 의 신규 마이그레이션·테스트 데이터는 현재 로컬 DB 에 없음). 원격(공유 비프로덕션)·운영 DB 는 건드리지 않았다. 복구(메인 체크아웃 기준 재적용)와 다른 세션 통지는 총괄 몫이다.

## 1. 결론(상태: 이번 세션에서 담당 범위 전부 완료)

- **hard 원형 60개**(nonlinear_equations_systems 9 세부 패턴 × 4 = 36, nonlinear_functions 6 세부 패턴 × 4 = 24) — 같은 세부 패턴의 4개는 연산자가 모두 다르고 공용 문서 5절 적용 매트릭스와 일치(테스트가 강제). `equivalent_expressions` hard 8개는 파일럿에서 이미 완료라 건드리지 않았다.
- **easy/medium 원형 37개**(원형 하나 = 문장 틀 하나 = 유사문항 그룹 하나): nonlinear_equations_systems 13(easy 4·medium 9), nonlinear_functions 12(4·8), equivalent_expressions 12(4·8, 지수 규칙 원형은 변형 2개라 그룹 9). 세트당 필요 문항(≈6.7 = plan.json 3세트분 ÷ 3)을 세트당 같은 그룹 1문항 규칙에서 채우려면 skill 마다 그룹 7개 이상이 필요한데, skill 마다 **그룹 12개 이상**(easy 4·medium 8~9)으로 맞췄다.
- 합격 기준(완화 없음)을 **97개 원형 전부 시드 5,000 스윕에서 통과**: 정답 재계산 불일치 0·선지 값 겹침 0·표기 위반 0·예외 0·명사-수식 매핑 위반 0, 본문 유사도 0.6 미만 독립 변형 최소 76(기준 30, 스윕 상한 400), **서로 다른 수치 조합 최소 30**(독립 변형이 '문장만 다르고 수치가 같은 문항'이 아님을 보증하려고 추가한 기준).
- 생산 가능 수량(그룹당 30 상한·독립 변형·서로 다른 수치 조합 중 최소)은 skill × 난이도 전부 30세트 필요량(easy 50·medium 150·hard 30)을 충족한다(5절).
- 모델 보조 문구 생성은 사용하지 않았다(비용 US$0). 문장 틀의 대안 서술은 사람이 쓰듯 직접 작성했다(`[[a|b]]` 선택 슬롯 + 상황 설정 문장).

## 2. 구성(파일)

| 경로 | 역할 |
|---|---|
| `lib/problem-generation/math-archetypes/skills/nes-hard-1.ts`·`nes-hard-2.ts` | nonlinear_equations_systems hard 36개(root·sum_of_roots·product_of_roots·num_real_solutions / irrational_sum·product·radical_form·linear_quadratic_intersection·parameter_discriminant) |
| `.../skills/nes-em.ts` | nonlinear_equations_systems easy 4·medium 9 |
| `.../skills/nf-hard.ts`·`nf-em.ts` | nonlinear_functions hard 24, easy 4·medium 8 |
| `.../skills/ee-em.ts` | equivalent_expressions easy 4·medium 8(두 세부 패턴 polynomial_distribution·rational_equivalence 의 문장 틀) |
| `.../skills/nonlinear-equations-systems.ts`·`nonlinear-functions.ts`·`a-registry.ts` | skill 단위 묶음(registry 는 skill 당 한 줄씩만 등록) |
| `.../skills/a-kit.ts` | 공용 도구: 분수·근호·이차식 문자열, 명사-수식 매핑 표와 `checkSemantics`, `lead()` 상황 설정 문장, `finishA` |
| `.../a-archetypes.test.ts` | 매트릭스·그룹 수·easy/medium 스윕(400 시드)·재현성·명사-수식 돌연변이 테스트·대량 산출기 레코드 |
| `scripts/mock-exam-generation/archetype-sweep-a.ts`·`archetype-a-samples.ts`·`archetype-a-report.ts` | 스윕 CLI(5,000 시드), Preview 샘플 생성, 이 문서의 표 생성 |
| `data/mock-exam-generation/math-archetype-A/` | `passed.json`(import.ts 호환 194건 = 원형 97 × 2), `samples.tsv`(점검 포인트·문항 요약) |

### 공용 프레임워크 파일 변경(최소·추가형, 다른 에이전트와 병합 시 확인 필요)

- `types.ts`: `Archetype.difficulty?`(생략 시 hard), `OperatorId` 에 `"frame"`(easy/medium 문장 틀), `Instance.semantics?`(명사-수식 선언).
- `verify.ts`: 풀이 단계·결합 개념 hard 주장 검사를 `difficulty` 가 hard 일 때만 적용(정답 재계산·선지 겹침·표기·공개 게이트는 모든 난이도에 그대로).
- `bulk.ts`: `archetypeRecord` 가 원형의 난이도로 레코드를 만들고 easy/medium 은 `difficultyStatus: "confirmed"`.
- `registry.ts`: hard 한 줄 + `ARCHETYPES_EM`(easy/medium 목록) 추가, `archetypeById` 가 두 목록을 모두 찾는다.
- `kind-catalog.ts`: 변경 없음(모든 원형이 기존 세부 패턴 값을 쓴다 — 드롭다운이 지원하지 않는 값을 노출하지 않는다).

## 3. 설계 요약

- **그룹 키**: `c:<skill>:<원형ID>/<변형>`. easy/medium 은 원형마다 변형 이름이 하나라 원형 = 그룹이다(지수 규칙 원형만 변형 2개).
- **본문 독립 변형**: 숫자는 유사도 계산에서 마스킹되므로 같은 틀은 같은 문항으로 센다. 틀마다 `[[a|b|c]]` 선택 슬롯과 `lead()`(슬롯 6개 × 7~9개 대안의 상황 설정 문장)로 표현을 달리해 0.6 미만 독립 변형을 만든다. 같은 수치가 반복되는 것은 `distinctParams`(서로 다른 수치 조합) 기준으로 따로 막는다.
- **hard 인정 기준**: 풀이 단계 ≥ max(5, medium 실측+1)·결합 개념 ≥ 2·4자리 이상 숫자 지문 금지(verify 가 기계 검사), 원형 메타데이터 `extraThinking` 에 '추가 요구 사고'를 명시(6절). 길이·복잡한 숫자·계산량만 늘린 변형은 만들지 않았다.
- **문장과 변수의 의미 일치**: 문장이 말하는 양(넓이·둘레·매출)은 `a-kit.ts` 의 매핑 표(`NOUN_FN`)의 규칙으로만 식을 세우고 `Instance.semantics` 에 선언한다. `checkSemantics` 가 (1) 문장에 명사가 있으면 대응 식이 선언돼 있는지, (2) 선언된 식이 같은 규칙으로 다시 계산한 값과 맞는지, (3) 선언된 명사가 문장에 실제 있는지를 검사한다(둘레/넓이 혼동 방지). 돌연변이 테스트로 검사 자체를 검증했다. 해당 원형 7개: 넓이 문장제(irrational_sum repr, linear_quadratic repr, nes m_word_area, ee m_area_expression, 울타리 최대 넓이 nf vertex_x repr), 매출 문장제(irrational_product repr, nf vertex_y repr).
- **정답 재계산**: 모든 `verification_js` 는 문제에 인쇄된 수치만 받아(검사: `checkParamsPrinted`) 정수 근 스캔·꼭짓점 평가·이분법·부동소수점 근 등 생성식과 다른 경로로 정답을 다시 계산한다. 근호꼴 선지는 수식 평가기로 값을 비교한다.

## 4. 진행표

| skill | hard 원형 | hard 합격 | easy 원형 | medium 원형 | easy/medium 합격 | 그룹(easy/medium/hard) |
|---|---|---|---|---|---|---|
| nonlinear_equations_systems | 36 | 36/36 | 4 | 9 | 13/13 | 4/9/53 |
| nonlinear_functions | 24 | 24/24 | 4 | 8 | 12/12 | 4/8/31 |
| equivalent_expressions | 파일럿 8(별도) | - | 4 | 8 | 12/12 | 4/9/14(파일럿) |

### 세부 패턴별 hard 원형(연산자)

| skill | 세부 패턴 | 연산자 4 | 합격 |
|---|---|---|---|
| nonlinear_equations_systems | root | param_condition, constraint_select, chain2, inverse | 4/4 |
| nonlinear_equations_systems | sum_of_roots | inverse, param_condition, compose_kind, chain2 | 4/4 |
| nonlinear_equations_systems | product_of_roots | inverse, param_condition, compose_kind, chain2 | 4/4 |
| nonlinear_equations_systems | num_real_solutions | param_condition, constraint_select, compose_kind, compare_scenarios | 4/4 |
| nonlinear_equations_systems | irrational_sum_of_roots | inverse, compose_kind, chain2, repr_shift | 4/4 |
| nonlinear_equations_systems | irrational_product_of_roots | inverse, compose_kind, chain2, repr_shift | 4/4 |
| nonlinear_equations_systems | irrational_root_radical_form | inverse, chain2, constraint_select, compose_kind | 4/4 |
| nonlinear_equations_systems | linear_quadratic_intersection | param_condition, compose_kind, repr_shift, constraint_select | 4/4 |
| nonlinear_equations_systems | parameter_discriminant | param_condition, inverse, constraint_select, chain2 | 4/4 |
| nonlinear_functions | evaluate | chain2, compose_kind, repr_shift, compare_scenarios | 4/4 |
| nonlinear_functions | vertex_x | inverse, compose_kind, repr_shift, chain2 | 4/4 |
| nonlinear_functions | vertex_y | inverse, compose_kind, repr_shift, compare_scenarios | 4/4 |
| nonlinear_functions | find_x_for_value | inverse, constraint_select, chain2, compose_kind | 4/4 |
| nonlinear_functions | interpret_a | unit_ratio, repr_shift, compare_scenarios, chain2 | 4/4 |
| nonlinear_functions | interpret_b | unit_ratio, repr_shift, compare_scenarios, inverse | 4/4 |

## 5. 생산 가능 수량표

### skill × 난이도 생산 가능 수량(그룹당 30 상한 · 본문 독립 변형 · 서로 다른 수치 조합 중 최소) 대 30세트 필요량

| skill | 난이도 | 그룹(문장 틀) 수 | 생산 가능 | 30세트 필요 | 충족 |
|---|---|---|---|---|---|
| nonlinear_equations_systems | easy | 4 | 120 | 50 | 충족 |
| nonlinear_equations_systems | medium | 9 | 270 | 150 | 충족 |
| nonlinear_equations_systems | hard | 53 | 1482 | 30 | 충족 |
| nonlinear_functions | easy | 4 | 120 | 50 | 충족 |
| nonlinear_functions | medium | 8 | 240 | 150 | 충족 |
| nonlinear_functions | hard | 31 | 845 | 30 | 충족 |
| equivalent_expressions | easy | 4 | 120 | 50 | 충족 |
| equivalent_expressions | medium | 9 | 270 | 150 | 충족 |
| equivalent_expressions | hard | 14(파일럿) | 파일럿 8 원형 | 30 | 파일럿 완료 |

### 원형별 스윕 결과

| 원형 | 난이도 | 생성/시드 | 검증 실패 | 독립 변형(0.6 미만, 상한 400) | 서로 다른 수치 조합 | 그룹 |
|---|---|---|---|---|---|---|
| nes.root.param_condition | hard | 5000/5000 | 0 | 400 | 30 | 2 |
| nes.root.constraint_select | hard | 5000/5000 | 0 | 400 | 33 | 1 |
| nes.root.chain2 | hard | 5000/5000 | 0 | 400 | 1264 | 2 |
| nes.root.inverse | hard | 5000/5000 | 0 | 400 | 272 | 2 |
| nes.sum_of_roots.inverse | hard | 5000/5000 | 0 | 400 | 288 | 1 |
| nes.sum_of_roots.param_condition | hard | 5000/5000 | 0 | 400 | 4575 | 1 |
| nes.sum_of_roots.compose_kind | hard | 5000/5000 | 0 | 400 | 4711 | 2 |
| nes.sum_of_roots.chain2 | hard | 5000/5000 | 0 | 400 | 4236 | 1 |
| nes.product_of_roots.inverse | hard | 5000/5000 | 0 | 308 | 288 | 1 |
| nes.product_of_roots.param_condition | hard | 5000/5000 | 0 | 400 | 4615 | 1 |
| nes.product_of_roots.compose_kind | hard | 5000/5000 | 0 | 400 | 49 | 2 |
| nes.product_of_roots.chain2 | hard | 5000/5000 | 0 | 320 | 436 | 1 |
| nes.num_real_solutions.param_condition | hard | 5000/5000 | 0 | 400 | 154 | 2 |
| nes.num_real_solutions.constraint_select | hard | 5000/5000 | 0 | 400 | 927 | 2 |
| nes.num_real_solutions.compose_kind | hard | 5000/5000 | 0 | 400 | 4407 | 1 |
| nes.num_real_solutions.compare_scenarios | hard | 5000/5000 | 0 | 400 | 2796 | 1 |
| nes.irrational_sum_of_roots.inverse | hard | 5000/5000 | 0 | 400 | 246 | 2 |
| nes.irrational_sum_of_roots.compose_kind | hard | 5000/5000 | 0 | 400 | 444 | 2 |
| nes.irrational_sum_of_roots.chain2 | hard | 5000/5000 | 0 | 400 | 2275 | 1 |
| nes.irrational_sum_of_roots.repr_shift | hard | 5000/5000 | 0 | 357 | 3615 | 1 |
| nes.irrational_product_of_roots.inverse | hard | 5000/5000 | 0 | 400 | 807 | 1 |
| nes.irrational_product_of_roots.compose_kind | hard | 5000/5000 | 0 | 400 | 43 | 1 |
| nes.irrational_product_of_roots.chain2 | hard | 5000/5000 | 0 | 400 | 1918 | 1 |
| nes.irrational_product_of_roots.repr_shift | hard | 5000/5000 | 0 | 241 | 4150 | 1 |
| nes.irrational_root_radical_form.inverse | hard | 5000/5000 | 0 | 400 | 576 | 1 |
| nes.irrational_root_radical_form.chain2 | hard | 5000/5000 | 0 | 400 | 126 | 1 |
| nes.irrational_root_radical_form.constraint_select | hard | 5000/5000 | 0 | 400 | 320 | 2 |
| nes.irrational_root_radical_form.compose_kind | hard | 5000/5000 | 0 | 400 | 78 | 1 |
| nes.linear_quadratic_intersection.param_condition | hard | 5000/5000 | 0 | 400 | 3498 | 2 |
| nes.linear_quadratic_intersection.compose_kind | hard | 5000/5000 | 0 | 400 | 4985 | 2 |
| nes.linear_quadratic_intersection.repr_shift | hard | 4688/5000 | 0 | 400 | 33 | 3 |
| nes.linear_quadratic_intersection.constraint_select | hard | 5000/5000 | 0 | 400 | 3197 | 1 |
| nes.parameter_discriminant.param_condition | hard | 5000/5000 | 0 | 400 | 120 | 3 |
| nes.parameter_discriminant.inverse | hard | 5000/5000 | 0 | 400 | 50 | 2 |
| nes.parameter_discriminant.constraint_select | hard | 5000/5000 | 0 | 400 | 574 | 1 |
| nes.parameter_discriminant.chain2 | hard | 5000/5000 | 0 | 76 | 90 | 1 |
| nf.evaluate.chain2 | hard | 5000/5000 | 0 | 400 | 4460 | 2 |
| nf.evaluate.compose_kind | hard | 5000/5000 | 0 | 400 | 3975 | 1 |
| nf.evaluate.repr_shift | hard | 5000/5000 | 0 | 400 | 2559 | 1 |
| nf.evaluate.compare_scenarios | hard | 5000/5000 | 0 | 180 | 4905 | 1 |
| nf.vertex_x.inverse | hard | 5000/5000 | 0 | 139 | 4030 | 1 |
| nf.vertex_x.compose_kind | hard | 5000/5000 | 0 | 400 | 4711 | 1 |
| nf.vertex_x.repr_shift | hard | 5000/5000 | 0 | 340 | 76 | 2 |
| nf.vertex_x.chain2 | hard | 5000/5000 | 0 | 400 | 4215 | 1 |
| nf.vertex_y.inverse | hard | 5000/5000 | 0 | 145 | 1238 | 2 |
| nf.vertex_y.compose_kind | hard | 5000/5000 | 0 | 400 | 4279 | 2 |
| nf.vertex_y.repr_shift | hard | 5000/5000 | 0 | 400 | 52 | 1 |
| nf.vertex_y.compare_scenarios | hard | 5000/5000 | 0 | 375 | 4424 | 1 |
| nf.find_x_for_value.inverse | hard | 5000/5000 | 0 | 103 | 233 | 1 |
| nf.find_x_for_value.constraint_select | hard | 5000/5000 | 0 | 400 | 49 | 1 |
| nf.find_x_for_value.chain2 | hard | 5000/5000 | 0 | 211 | 4480 | 1 |
| nf.find_x_for_value.compose_kind | hard | 5000/5000 | 0 | 400 | 2339 | 1 |
| nf.interpret_a.unit_ratio | hard | 5000/5000 | 0 | 189 | 460 | 1 |
| nf.interpret_a.repr_shift | hard | 5000/5000 | 0 | 118 | 42 | 1 |
| nf.interpret_a.compare_scenarios | hard | 5000/5000 | 0 | 79 | 3476 | 1 |
| nf.interpret_a.chain2 | hard | 5000/5000 | 0 | 120 | 207 | 1 |
| nf.interpret_b.unit_ratio | hard | 5000/5000 | 0 | 400 | 31 | 2 |
| nf.interpret_b.repr_shift | hard | 5000/5000 | 0 | 400 | 34 | 2 |
| nf.interpret_b.compare_scenarios | hard | 5000/5000 | 0 | 164 | 3193 | 1 |
| nf.interpret_b.inverse | hard | 5000/5000 | 0 | 400 | 30 | 2 |
| nes.root.e_factored_form | easy | 5000/5000 | 0 | 400 | 809 | 1 |
| nes.sum_of_roots.e_equation_sum | easy | 5000/5000 | 0 | 400 | 128 | 1 |
| nes.product_of_roots.e_equation_product | easy | 5000/5000 | 0 | 400 | 128 | 1 |
| nes.num_real_solutions.e_pure_square | easy | 5000/5000 | 0 | 400 | 536 | 1 |
| nes.root.m_nonmonic_larger | medium | 5000/5000 | 0 | 400 | 786 | 1 |
| nes.root.m_other_solution | medium | 5000/5000 | 0 | 400 | 238 | 1 |
| nes.root.m_word_area | medium | 5000/5000 | 0 | 400 | 345 | 1 |
| nes.sum_of_roots.m_rearranged | medium | 5000/5000 | 0 | 400 | 339 | 1 |
| nes.product_of_roots.m_nonmonic | medium | 5000/5000 | 0 | 400 | 576 | 1 |
| nes.irrational_sum_of_roots.m_vieta_irrational | medium | 5000/5000 | 0 | 400 | 1312 | 1 |
| nes.linear_quadratic_intersection.m_intersection_x | medium | 5000/5000 | 0 | 400 | 4623 | 1 |
| nes.parameter_discriminant.m_one_solution_c | medium | 5000/5000 | 0 | 400 | 64 | 1 |
| nes.num_real_solutions.m_discriminant_count | medium | 5000/5000 | 0 | 400 | 840 | 1 |
| nf.evaluate.e_quad_standard | easy | 5000/5000 | 0 | 400 | 2612 | 1 |
| nf.evaluate.e_exp_value | easy | 5000/5000 | 0 | 400 | 80 | 1 |
| nf.vertex_x.e_standard_formula | easy | 5000/5000 | 0 | 400 | 974 | 1 |
| nf.find_x_for_value.e_exp_solve | easy | 5000/5000 | 0 | 400 | 126 | 1 |
| nf.evaluate.m_negative_input | medium | 5000/5000 | 0 | 400 | 3514 | 1 |
| nf.evaluate.m_function_difference | medium | 5000/5000 | 0 | 400 | 4476 | 1 |
| nf.vertex_x.m_symmetry_points | medium | 5000/5000 | 0 | 400 | 1427 | 1 |
| nf.vertex_y.m_min_value_standard | medium | 5000/5000 | 0 | 400 | 973 | 1 |
| nf.vertex_y.m_max_projectile | medium | 5000/5000 | 0 | 207 | 300 | 1 |
| nf.find_x_for_value.m_exp_double_period | medium | 5000/5000 | 0 | 400 | 490 | 1 |
| nf.interpret_a.m_initial_amount | medium | 5000/5000 | 0 | 328 | 171 | 1 |
| nf.interpret_b.m_growth_percent | medium | 5000/5000 | 0 | 400 | 975 | 1 |
| ee.polynomial_distribution.e_distribute_single | easy | 5000/5000 | 0 | 400 | 135 | 1 |
| ee.polynomial_distribution.e_combine_like_terms | easy | 5000/5000 | 0 | 400 | 4841 | 1 |
| ee.polynomial_distribution.e_distribute_plus_constant | easy | 5000/5000 | 0 | 400 | 1534 | 1 |
| ee.polynomial_distribution.e_factor_common | easy | 5000/5000 | 0 | 400 | 120 | 1 |
| ee.polynomial_distribution.m_binomial_product | medium | 5000/5000 | 0 | 400 | 562 | 1 |
| ee.polynomial_distribution.m_square_binomial | medium | 5000/5000 | 0 | 400 | 64 | 1 |
| ee.polynomial_distribution.m_difference_squares | medium | 5000/5000 | 0 | 400 | 45 | 1 |
| ee.polynomial_distribution.m_factor_quadratic | medium | 5000/5000 | 0 | 400 | 112 | 1 |
| ee.rational_equivalence.m_cancel_common_factor | medium | 5000/5000 | 0 | 400 | 168 | 1 |
| ee.rational_equivalence.m_add_same_denominator | medium | 5000/5000 | 0 | 400 | 4841 | 1 |
| ee.polynomial_distribution.m_area_expression | medium | 5000/5000 | 0 | 400 | 112 | 1 |
| ee.polynomial_distribution.m_exponent_rules | medium | 5000/5000 | 0 | 400 | 66 | 2 |

## 6. 원형 메타데이터

### hard 원형 메타데이터(추가 요구 사고)

| 원형 | 연산자 | 풀이 구조 | 추가 요구 사고(medium 대비) | 결합 개념 | medium 단계 |
|---|---|---|---|---|---|
| nes.root.param_condition | param_condition | '해가 하나뿐'이라는 조건을 판별식 = 0 으로 번역해 상수를 정하고 그 중근을 구한다 | 해의 개수 조건을 판별식 식으로 번역하고 부호 조건(양수 상수)으로 값을 하나로 고른 뒤 다시 방정식을 풀어야 한다 — medium 은 인수분해된 두 근 중 큰 근을 읽는 풀이 | 판별식 조건, 완전제곱 중근, 부호 조건 선택 | 2 |
| nes.root.constraint_select | constraint_select | 제곱근 방정식을 양변 제곱해 이차식으로 바꾼 뒤 두 후보 중 원식(우변 ≥ 0)을 만족하는 근만 선택 | 제곱으로 생긴 외래근을 원식에 대입해 걸러내야 한다(제약 추적·후보 제거) — medium 은 인수분해로 나온 근을 그대로 답 | 무리방정식 제곱, 이차방정식 인수분해, 외래근 검증 | 2 |
| nes.root.chain2 | chain2 | 첫 이차방정식의 큰 근 k 를 구한 뒤, k 가 들어간 둘째 방정식 (x-k)² = m² 의 해를 구한다 | 앞 단계에서 구한 값이 뒤 방정식의 계수가 되는 2단계 연쇄 — medium 은 한 방정식의 근 하나 | 이차방정식 인수분해, 치환·전개, 완전제곱형 방정식 | 2 |
| nes.root.inverse | inverse | 한 근과 '다른 근과의 차'를 주고 이차방정식의 계수 b, c 를 근과 계수의 관계로 역산해 합을 구한다 | 근 → 계수의 역방향 재구성(두 번째 근 도출, 합·곱의 부호 처리) — medium 은 주어진 방정식의 근을 읽음 | 근과 계수의 관계, 근의 차 조건, 계수 역산 | 2 |
| nes.sum_of_roots.inverse | inverse | ax² = bx + c 꼴에서 두 근의 합과 곱을 주고 이항 후 근과 계수의 관계로 b, c 를 역산해 b + c 를 구한다 | 표준형으로 이항할 때 b·c 의 부호 변화를 추적하며 합·곱 조건을 계수로 역산 — medium 은 표준형 방정식의 근의 합을 -b/a 로 읽음 | 표준형 정리(이항), 근과 계수의 관계, 계수 역산 | 2 |
| nes.sum_of_roots.param_condition | param_condition | x² + (uk+v)x + (wk+z) = 0 에서 '근의 합이 S' 라는 조건으로 k 를 정하고 곱을 구한다 | 근의 합 조건을 매개변수 방정식으로 번역해 k 를 정한 뒤 다른 계수에 다시 대입 — medium 은 계수가 숫자인 방정식에서 합을 읽음 | 근과 계수의 관계, 매개변수 일차방정식, 대입 후 곱 계산 | 2 |
| nes.sum_of_roots.compose_kind | compose_kind | 포물선 y=x²+bx+c 와 직선 y=mx+n 의 교점 x(또는 y)좌표 합을 두 식을 같게 놓은 이차방정식의 근과 계수 관계로 구한다 | 연립(교점) 개념과 근의 합 개념을 연결해 두 식을 같게 놓고 정리한 뒤 합을 읽는다 — medium 은 주어진 이차방정식의 근의 합 | 이차함수와 직선의 교점, 방정식 정리, 근과 계수의 관계 | 2 |
| nes.sum_of_roots.chain2 | chain2 | 첫 방정식의 근의 합 k 를 구해 둘째 방정식 kx² - tx + w = 0 의 최고차 계수로 쓰고 그 근의 합을 구한다 | 앞 단계 결과가 뒤 방정식의 최고차 계수가 되고, 근이 무리수일 수 있어 합을 근과 계수의 관계로 읽어야 한다 — medium 은 한 방정식의 합 | 근과 계수의 관계, 연쇄 대입, 판별식으로 실근 확인 | 2 |
| nes.product_of_roots.inverse | inverse | kx² - bx + c = 0 에서 근의 곱을 알려 주고 미지의 최고차 계수 k 를 c/곱 으로 구한 뒤 근의 합 b/k 를 구한다 | 곱 조건으로 최고차 계수를 역산한 뒤 그 계수로 합을 다시 계산 — medium 은 최고차 계수가 숫자인 방정식에서 곱을 읽음 | 근과 계수의 관계(곱), 최고차 계수 역산, 근과 계수의 관계(합) | 2 |
| nes.product_of_roots.param_condition | param_condition | x² - (uk+v)x + (wk+z) = 0 에서 '근의 곱이 Pr' 인 k 를 정하고, 그 k 로 만든 방정식의 큰 근을 구한다 | 곱 조건 → k → 계수 대입 → 인수분해의 순서로 한 방정식을 두 번 쓴다 — medium 은 계수가 숫자인 방정식의 곱 | 근과 계수의 관계(곱), 매개변수 방정식, 이차방정식 풀이 | 2 |
| nes.product_of_roots.compose_kind | compose_kind | x⁴ + (e-u)x² - eu = 0 (또는 x⁴ - bx² + c) 를 x² = t 로 치환해 t 의 근을 구하고 실근 x 의 곱을 구한다 | 치환(이차식 꼴 발견), t 의 근의 부호에 따른 실근 선별, x = ±√t 의 곱 계산을 연결 — medium 은 이차방정식의 근의 곱 | 치환(x²=t), 근과 계수의 관계, 실근 선별(음수 제곱 제외) | 2 |
| nes.product_of_roots.chain2 | chain2 | 첫 방정식의 근의 곱 k 를 구해 둘째 방정식 x² + (k-m)x - mk = 0 에 쓰고 두 근의 제곱의 합을 구한다 | 앞 단계의 곱이 뒤 방정식의 계수가 되고, 근을 구하거나 (합)²-2(곱) 로 제곱합을 계산하는 2단계 연쇄 — medium 은 한 방정식의 곱 | 근과 계수의 관계, 연쇄 대입, 제곱의 합 | 2 |
| nes.num_real_solutions.param_condition | param_condition | x² + bx + k = 0 이 서로 다른 두 실근(또는 실근 없음)을 갖는 정수 k 의 개수를 판별식 부등식으로 센다 | 판별식 부등식 D>0 (경계 D=0 제외)을 세워 범위 안의 정수 개수를 센다 — medium 은 주어진 방정식의 실근 개수(0·1·2)만 판정 | 판별식 부등식, 정수 개수 세기, 경계값 처리 | 3 |
| nes.num_real_solutions.constraint_select | constraint_select | (x²-p²)(x²-Bx+C)=0 의 서로 다른 '양의' 실근 개수를 두 인수의 근 집합에서 중복을 제거해 센다 | 양의 실근만 선별하고 두 인수의 근이 겹치는 경우를 제거(제약·중복 추적) — medium 은 한 이차방정식의 실근 개수 | 곱의 영 인수분해, 양수 조건, 중복 해 제거 | 3 |
| nes.num_real_solutions.compose_kind | compose_kind | 포물선 y=x²+bx+c 를 좌우·상하 이동한 그래프의 x절편 개수를 이동 후 최솟값의 부호(수직 이동만 영향)로 판정 | 도형 이동(그래프 변환)과 실근 개수 개념을 연결하고 수평 이동은 개수에 영향을 주지 않음을 구분 — medium 은 방정식의 판별식 부호 판정 | 그래프 평행이동, 꼭짓점(최솟값), x절편과 실근 개수 | 3 |
| nes.num_real_solutions.compare_scenarios | compare_scenarios | 두 이차방정식 각각의 실근 집합을 구한 뒤 합집합의 서로 다른 값의 개수를 센다(공통근 처리) | 두 경우의 해 집합을 모두 구해 비교하고 겹치는 해를 한 번만 세어야 한다 — medium 은 한 방정식의 실근 개수 | 이차방정식 풀이, 해 집합 비교, 합집합의 원소 수 | 3 |
| nes.irrational_sum_of_roots.inverse | inverse | 정수 계수 이차방정식의 해가 p ± q√n 으로 주어질 때 켤레근의 합·곱으로 b, c 를 역산해 b + c 를 구한다 | 해에서 계수로 역방향 재구성(켤레근의 합 2p, 곱 p²-q²n 의 부호 처리) — medium 은 무리수 근 방정식의 근의 합 -b/a 를 읽음 | 켤레근, 근과 계수의 관계, 근호 제곱 계산 | 3 |
| nes.irrational_sum_of_roots.compose_kind | compose_kind | 무리수 근을 갖는 이차방정식에서 근을 직접 구하지 않고 대칭식(제곱합 또는 차의 제곱)을 합과 곱으로 계산 | 근과 계수의 관계에 대칭식 항등식((r+s)²-2rs, (r-s)²=(r+s)²-4rs)을 결합 — medium 은 근의 합만 읽음 | 근과 계수의 관계, 대칭식 항등식, 판별식으로 실근 확인 | 3 |
| nes.irrational_sum_of_roots.chain2 | chain2 | 첫 방정식(무리수 근)의 근의 합 k 를 구해 둘째 방정식 x² - mx - k = 0 의 해의 제곱합을 구한다 | 근을 구하지 않고 앞 단계의 합이 뒤 방정식의 상수항이 되는 2단계 연쇄, 제곱합 항등식 재사용 — medium 은 한 방정식의 합 | 근과 계수의 관계, 연쇄 대입, 제곱합 항등식 | 3 |
| nes.irrational_sum_of_roots.repr_shift | repr_shift | 직사각형의 가로 w, 세로 aw+b, 넓이 A 라는 문장을 w(aw+b)=A 로 세우고 표준형 이차방정식의 두 근의 합 -b/a 를 구한다 | 문장(넓이 조건)을 식으로 모델링해 표준형으로 정리한 뒤, 도형에서는 의미 없는 근까지 포함한 근의 합을 읽음 — medium 은 이미 식으로 주어진 방정식의 합 | 도형 문장의 식 세우기(넓이), 표준형 정리, 근과 계수의 관계 | 3 |
| nes.irrational_product_of_roots.inverse | inverse | ax²+bx+c=0 의 해가 (u ± √D)/w 로 주어졌을 때 분자·분모·근호 안에서 b 와 c 를 역산한다 | 근의 공식 결과에서 b = -u, 판별식 b²-4ac = D 로 c 를 거꾸로 푸는 역방향 재구성 — medium 은 무리수 근 방정식의 근의 곱 c/a 를 읽음 | 근의 공식, 판별식 역산, 계수 비교 | 3 |
| nes.irrational_product_of_roots.compose_kind | compose_kind | x² - b|x| + c = 0 에서 u = |x| 로 치환해 u 의 두 양근을 구하고 x = ±u 네 해의 곱을 구한다 | 절댓값 방정식을 이차식으로 치환하고 양·음 대칭 해 4개의 곱(부호·제곱 처리)을 계산 — medium 은 이차방정식 두 해의 곱 | 절댓값 치환, 근과 계수의 관계, 대칭 해의 곱 | 3 |
| nes.irrational_product_of_roots.chain2 | chain2 | 첫 방정식(무리수 근)의 근의 곱 k 를 구한 뒤 둘째 방정식 x² + (k+m)x + km = 0 을 인수분해해 큰 근을 구한다 | 무리수 근을 풀지 않고 곱을 읽은 뒤 그 값이 인수분해 가능한 둘째 방정식의 계수가 되는 연쇄 — medium 은 한 방정식의 곱 | 근과 계수의 관계, 연쇄 대입, 이차방정식 인수분해 | 3 |
| nes.irrational_product_of_roots.repr_shift | repr_shift | 가격 p 와 판매량 D-mp 로부터 매출 R 의 식 p(D-mp)=R 을 세워 표준형으로 정리하고 두 근의 곱 R/m 을 구한다 | 문장(가격·판매량·매출)을 식으로 모델링한 뒤 표준형의 상수항과 최고차 계수의 비를 읽음 — medium 은 식으로 주어진 방정식의 곱 | 문장 모델링(매출=가격×판매량), 표준형 정리, 근과 계수의 관계 | 3 |
| nes.irrational_root_radical_form.inverse | inverse | 정수 계수 이차방정식의 한 해가 p ± q√n 일 때 켤레근 정리로 다른 해를 근호꼴로 적는다 | 한 해에서 다른 해를 역으로 추론(켤레근 정리, 합 2p 로 확인)하고 근호꼴을 정리 — medium 은 방정식을 직접 풀어 근호꼴로 적음 | 켤레근 정리, 근과 계수의 관계, 근호 표기 | 3 |
| nes.irrational_root_radical_form.chain2 | chain2 | x² - 2px + c = 0 의 큰 해 k 를 근호꼴로 구한 뒤 k² 을 전개해 근호꼴로 정리한다 | 근의 공식 → 근호 정리 → 이항 제곱 전개 → 동류항 정리의 4단 연쇄 — medium 은 근호꼴 해를 구하는 한 단계 | 근의 공식·근호 정리, 이항식 제곱, 근호 동류항 정리 | 3 |
| nes.irrational_root_radical_form.constraint_select | constraint_select | x² - 2px + c = 0 의 두 무리수 해 중 부호 조건(양수/음수)을 만족하는 해를 근호꼴로 적는다 | 두 해의 부호(c<0 이면 서로 다른 부호)를 판단해 조건에 맞는 해를 고르고 근호를 정리 — medium 은 근호꼴의 두 해를 구함 | 근의 공식·근호 정리, 근의 부호 판단, 조건에 맞는 해 선택 | 3 |
| nes.irrational_root_radical_form.compose_kind | compose_kind | 차가 2e 이고 제곱의 합이 N 인 두 양수에서 이차방정식을 세워 근호꼴의 큰 수 e + q√n 을 구한다 | 문장(수의 관계)을 이차방정식으로 모델링해 근의 공식과 근호 정리, 양수 조건 선택, 큰 수 계산까지 연결 — medium 은 주어진 방정식의 근호꼴 해 | 문장 모델링, 근의 공식·근호 정리, 양수 조건 선택 | 3 |
| nes.linear_quadratic_intersection.param_condition | param_condition | 포물선 y=x²+bx+c 와 직선 y=mx+k 가 한 점에서 만나는(접하는) 조건 → 판별식 0 으로 k(또는 접점의 x좌표)를 구한다 | '한 점에서 만난다'를 두 식을 같게 놓은 이차방정식의 판별식 0 으로 번역해 직선의 상수를 정함 — medium 은 교점 개수 또는 좌표를 직접 구함 | 이차함수와 직선의 교점, 판별식 조건, 접점 | 3 |
| nes.linear_quadratic_intersection.compose_kind | compose_kind | 직선이 지나는 두 점으로 직선의 식을 구하고 포물선과의 교점의 x(또는 y)좌표 합을 구한다 | 두 점에서 직선의 식(기울기·절편)을 구하는 개념과 교점 개념을 연결 — medium 은 식이 주어진 직선과 포물선의 교점 | 두 점을 지나는 직선, 이차함수와 직선의 교점, 근과 계수의 관계 | 3 |
| nes.linear_quadratic_intersection.repr_shift | repr_shift | 직사각형의 넓이(가로의 이차식)가 둘레(가로의 일차식)의 p 배라는 문장을 w(w+d)=2p(2w+d) 로 세워 양의 해를 구한다 | 넓이와 둘레를 혼동하지 않고 각각 올바른 식으로 모델링해 이차식=일차식의 교점 방정식을 세우고 양수 해를 선택 — medium 은 이미 식으로 주어진 교점 | 도형 문장의 식 세우기(넓이·둘레), 이차식=일차식 방정식, 양수 해 선택 | 3 |
| nes.linear_quadratic_intersection.constraint_select | constraint_select | 포물선과 직선의 두 교점 중 제1사분면(x>0, y>0)에 있는 점을 골라 y좌표를 구한다 | 두 교점을 모두 구한 뒤 사분면 조건(양쪽 좌표 부호)으로 후보를 제거 — medium 은 교점의 x좌표를 구함 | 이차함수와 직선의 교점, 방정식 풀이, 사분면 조건 선택 | 3 |
| nes.parameter_discriminant.param_condition | param_condition | x²+kx+(uk+m)=0 이 해를 하나만 갖는 k 의 값들 — 판별식 0 이 k 에 대한 이차방정식이 되어 그 근의 합·곱·큰 값을 묻는다 | 해의 개수 조건이 매개변수에 대한 또 하나의 이차방정식(k²-4uk-4m=0)이 되는 이중 구조 — medium 은 계수 하나가 미지수인 판별식 부등식 | 판별식 조건, 매개변수 이차방정식, 근과 계수의 관계 | 3 |
| nes.parameter_discriminant.inverse | inverse | 해가 하나뿐이며 그 값이 r(또는 그래프가 x축에 (r,0)에서 접함)일 때 b, c 를 완전제곱식 (x-r)² 으로 역산해 b+c(또는 c-b)를 구한다 | 중근 조건에서 이차식 자체를 (x-r)² 으로 재구성해 계수를 읽는 역방향 사고 — medium 은 판별식으로 매개변수를 구함 | 중근과 완전제곱식, 전개·계수 비교, 접선(꼭짓점이 x축 위) | 3 |
| nes.parameter_discriminant.constraint_select | constraint_select | kx²+bx+c=0 이 서로 다른 두 실근을 갖는 0 이 아닌 정수 k(-N ≤ k ≤ N)의 개수 — 판별식 부등식과 k≠0·경계 D=0 제외 | 최고차 계수가 매개변수라 k=0 제외, 음수 k 는 항상 성립, 양수 k 는 경계(D=0) 제외로 나눠 세는 제약 추적 — medium 은 부호 조건을 만족하는 k 하나를 구함 | 판별식 부등식, 정수 범위 세기, k≠0 조건 | 3 |
| nes.parameter_discriminant.chain2 | chain2 | 첫 방정식 x²+kx+c₁=0 이 해가 하나뿐이도록 하는 양수 k 를 구한 뒤 둘째 방정식 x²-kx+w=0 의 실근 개수를 판별식으로 판정 | 앞 단계의 판별식 조건에서 구한 k 가 뒤 방정식의 판별식 부호를 결정하는 2단계 연쇄 — medium 은 한 방정식의 판별식 부호 | 판별식 조건, 양수 조건 선택, 실근 개수 판정 | 3 |
| nf.evaluate.chain2 | chain2 | 이차함수 f(x)와 일차함수 g(x) 에서 g(f(p)) (또는 f(f(p))) — 안쪽 값을 구해 바깥 함수의 입력으로 쓴다 | 앞 단계의 함숫값이 다음 함수의 입력이 되는 연쇄 대입과 부호 처리 — medium 은 한 번의 함숫값 계산 | 함숫값, 합성(연쇄 대입), 부호 처리 | 2 |
| nf.evaluate.compose_kind | compose_kind | f(x) 이차, g(x) 일차 에서 f(g(p)) - g(f(p)) 를 구한다(두 합성의 차) | 합성의 순서가 결과를 바꾼다는 개념과 두 번의 합성 계산, 부호 처리 — medium 은 한 번의 함숫값 | 함수 합성, 함숫값, 순서의 비가환성 | 2 |
| nf.evaluate.repr_shift | repr_shift | 이차함수의 세 값 f(0), f(1), f(2) 를 표로 주고 식을 세워 다른 점의 값 f(p) 를 구한다 | 표(값)에서 이차함수 식을 세우는 모델링(상수항, 일차·이차 계수 연립) 후 새 입력에서 계산 — medium 은 식이 주어진 함숫값 | 표에서 식 세우기, 이차함수 계수 결정, 함숫값 | 2 |
| nf.evaluate.compare_scenarios | compare_scenarios | 이차 비용 모델 A(t) 와 일차 비용 모델 B(t) 를 비교해 A 가 처음으로 B 보다 커지는 정수 t 를 찾는다 | 두 모델의 값을 비교해 임계 시점을 찾는 탐색(부등식·교차점 해석) — medium 은 한 모델의 함숫값 | 함숫값 비교, 이차-일차 교차, 임계점 탐색 | 2 |
| nf.vertex_x.inverse | inverse | 최고차 계수 a, 꼭짓점의 x좌표 h, 지나는 한 점이 주어졌을 때 b 와 c 를 역산해 b + c 를 구한다 | 꼭짓점 공식에서 b 를 역산하고 점의 좌표를 대입해 c 를 구하는 역방향 재구성 — medium 은 표준형에서 꼭짓점 x좌표 -b/2a 를 계산 | 꼭짓점 공식, 점의 대입, 계수 역산 | 2 |
| nf.vertex_x.compose_kind | compose_kind | f(x) = (x-p)(x-q) 의 영점으로 꼭짓점 x좌표 (p+q)/2 를 구하고 g(x) = f(x-d)+e 의 평행이동을 반영한다 | 영점의 중점이 꼭짓점이라는 성질과 평행이동(수평 이동만 x좌표에 영향)을 결합 — medium 은 표준형에서 -b/2a 계산 | 영점과 대칭축, 그래프 평행이동, 꼭짓점 | 2 |
| nf.vertex_x.repr_shift | repr_shift | F 피트의 울타리로 직사각형 우리를 만드는 문장에서 넓이 함수 A(x) 를 세워 넓이가 최대인 폭(또는 길이)을 구한다 | 울타리 길이 조건을 식으로 모델링해 넓이 이차함수를 세우고 꼭짓점을 해석 — medium 은 이미 식으로 주어진 함수의 꼭짓점 | 문장 모델링(울타리·넓이), 이차함수의 최댓값 위치, 꼭짓점 | 2 |
| nf.vertex_x.chain2 | chain2 | f 의 꼭짓점 x좌표 h 를 구해 g(x) = a₂x² + hx + c₂ 의 계수로 쓰고 g 의 꼭짓점 x좌표 -h/(2a₂) 를 구한다 | 앞 단계의 꼭짓점 좌표가 뒤 함수의 계수가 되는 2단계 연쇄 — medium 은 한 함수의 꼭짓점 x좌표 | 꼭짓점 공식, 연쇄 대입, 계수 해석 | 2 |
| nf.vertex_y.inverse | inverse | a, 꼭짓점의 x좌표 h, y절편 c₀ 가 주어진 함수에서 b 를 역산해 최댓값/최솟값 f(h) 를 구한다 | 꼭짓점 위치 조건에서 b 를 역산하고 최대·최소 여부(a 의 부호)를 판단해 꼭짓점의 y 값을 구함 — medium 은 표준형의 최솟값 계산 | 꼭짓점 공식, y절편, 최대·최소 판단 | 2 |
| nf.vertex_y.compose_kind | compose_kind | f(x) = x²+bx+c 의 최솟값을 구하고 g(x) = u·f(x)+v 로 변환해 g 의 최댓값(u<0) 또는 최솟값(u>0)을 구한다 | 함수의 상수배·평행이동이 꼭짓점의 y값에 어떻게 반영되는지(부호가 바뀌면 최소→최대)를 결합 — medium 은 한 함수의 최솟값 | 완전제곱식(꼭짓점), 함수의 변환, 최대·최소 판단 | 2 |
| nf.vertex_y.repr_shift | repr_shift | 가격 p 와 판매량 D-mp 에서 매출 R(p)=p(D-mp) 를 세우고 최대 매출을 구한다 | 문장(가격·판매량)에서 매출 이차함수를 모델링하고 꼭짓점의 y 값을 최대 매출로 해석 — medium 은 이미 식으로 주어진 함수의 최댓값 | 문장 모델링(매출=가격×판매량), 이차함수 최댓값, 꼭짓점 y 좌표 | 2 |
| nf.vertex_y.compare_scenarios | compare_scenarios | 두 이차 모델 h₁(t), h₂(t) 의 최댓값을 각각 구해 그 차이를 구한다 | 두 모델 각각의 꼭짓점 y 값을 구해 비교(두 경우의 최댓값 비교) — medium 은 한 모델의 최댓값 | 꼭짓점 y 값, 두 모델 비교, 차 계산 | 2 |
| nf.find_x_for_value.inverse | inverse | 지수함수 f(t)=a·b^t 의 두 시점의 값으로 b 와 a 를 역산한 뒤 주어진 값 w 가 되는 시점을 구한다 | 두 값의 비에서 b 를 역산하고 a 를 구한 뒤 지수 방정식을 푸는 3단 역방향 재구성 — medium 은 a, b 가 주어진 모델에서 시점을 구함 | 지수함수의 비, 계수 역산, 지수 방정식 | 2 |
| nf.find_x_for_value.constraint_select | constraint_select | b^(2x) + c·b^x - d = 0 을 u = b^x 로 치환해 얻은 두 근 중 양수(u>0)만 택해 x 를 구한다 | 치환 후 나온 음수 u 는 b^x 가 될 수 없다는 제약으로 후보를 제거하고 지수 방정식을 풂 — medium 은 b^x = 상수 꼴을 한 번 풂 | 치환(u=b^x), 이차방정식 인수분해, 지수의 양수 제약 | 2 |
| nf.find_x_for_value.chain2 | chain2 | 지수함수 P(t)=a·b^t 가 값 w 가 되는 시점 T 를 구한 뒤 일차함수 Q(t)=mt+n 에 T 를 대입한다 | 지수 방정식의 해가 다른 함수의 입력이 되는 연쇄 — medium 은 지수 방정식의 해 한 번 | 지수 방정식, 일차함수의 값, 연쇄 대입 | 2 |
| nf.find_x_for_value.compose_kind | compose_kind | 서로 다른 거듭제곱 밑(2,4,8 또는 3,9,27)을 가진 지수식 b1^(a1x+α) = b2^(a2x+β) 를 같은 밑으로 맞춰 일차방정식으로 푼다 | 밑을 통일(지수 법칙)하고 지수의 일차방정식을 세워 푸는 개념의 결합 — medium 은 한 변이 상수인 지수 방정식 | 밑의 통일(지수 법칙), 일차방정식, 지수 방정식 | 2 |
| nf.interpret_a.unit_ratio | unit_ratio | N(t)=a·2^(t/τ) (t 는 작은 단위)에서 큰 단위 한 개 뒤의 값 V 로부터 초기값 a 를 구한다 | 시간 단위 환산(1일=24시간 등)으로 지수를 정리하고 a 가 t=0 의 값임을 해석 — medium 은 단위 환산 없이 초기값 읽기 | 단위 환산, 지수함수의 초기값, 배가 주기 | 2 |
| nf.interpret_a.repr_shift | repr_shift | 지수함수의 표 값 f(1), f(2), f(3) 에서 공비 b 를 구한 뒤 t = 0 의 값(초기값 a)을 구한다 | 표에서 지수 모델을 세우는 모델링(연속 값의 비 → 밑, 한 칸 거슬러 올라가 초기값) — medium 은 식이 주어진 초기값 읽기 | 표에서 식 세우기, 공비, 초기값 해석 | 2 |
| nf.interpret_a.compare_scenarios | compare_scenarios | 시작량 a₁ 에서 매 시간 b₁ 배, a₂(<a₁) 에서 매 시간 b₂ 배(b₂>b₁) 로 증가하는 두 군집에서 B 가 A 를 처음 넘는 시각을 구한다 | 초기값이 서로 다른 두 지수 모델을 비교해 역전 시점을 탐색 — medium 은 한 모델의 초기값 해석 | 초기값 비교, 성장 배율 비교, 역전 시점 | 2 |
| nf.interpret_a.chain2 | chain2 | N(t)=a·b^t 의 한 시점 값에서 a 를 구한 뒤 N(0)+N(t₂) (초기값과 나중 값의 합)을 구한다 | 한 시점의 값으로 초기값 a 를 구하고(앞 단계) 그 a 로 다른 시점의 값과 합을 계산(뒤 단계) — medium 은 초기값 하나 | 지수함수의 초기값, 연쇄 계산, 함숫값 | 2 |
| nf.interpret_b.unit_ratio | unit_ratio | 매 τ 단위마다 b 배(또는 절반)가 되는 양이 큰 단위 한 개 동안 몇 배가 되는지 b^(f/τ) 로 구한다 | 시간 단위 환산과 지수 법칙(주기 수 f/τ 만큼 거듭 곱함)을 결합하고 증가/감소 방향을 해석 — medium 은 한 주기 동안의 배율 읽기 | 단위 환산, 성장·감소 배율, 지수 법칙 | 2 |
| nf.interpret_b.repr_shift | repr_shift | n 기간 후 전체 변화(초기의 T%)가 주어졌을 때 같은 비율로 변했다는 문장을 b^n = T/100 으로 세워 기간당 변화율(%)을 구한다 | 전체 변화율을 기간당 변화율로 바꾸는 모델링(거듭제곱근, 증가/감소 판별) — medium 은 기간당 변화율에서 배율 읽기 | 퍼센트 변화와 배율, 거듭제곱근, 증가·감소 해석 | 2 |
| nf.interpret_b.compare_scenarios | compare_scenarios | A(t)=a₁·b₁^t, B(t)=a₂·b₂^t (a₁>a₂, b₂>b₁) 에서 B(t)>A(t) 가 되는 가장 작은 정수 t 를 구한다 | 밑(성장 배율)이 큰 쪽이 결국 앞선다는 해석과 역전 시점 탐색 — medium 은 한 모델의 배율 해석 | 성장 배율 비교, 지수 모델 비교, 역전 시점 | 2 |
| nf.interpret_b.inverse | inverse | n 기간 후 K 배(또는 1/K)가 되었을 때 매 기간 같은 배율이라면 기간당 증가·감소율(%)을 역산한다 | 총 변화 배율에서 기간당 배율을 거듭제곱근으로 역산하고 퍼센트 변화로 환산 — medium 은 기간당 배율에서 총 변화를 계산 | 거듭제곱근, 성장 배율, 퍼센트 변화 | 2 |

### easy/medium 원형(문장 틀 = 유사문항 그룹)

| 원형 | 난이도 | 틀 |
|---|---|---|
| nes.root.e_factored_form | easy | 이미 인수분해된 (x-r)(x-s)=0 에서 영곱 성질로 근을 읽고 큰 근·작은 근·합을 묻는다 |
| nes.sum_of_roots.e_equation_sum | easy | x²+bx+c=0 (정수 근)의 두 해의 합을 묻는다 |
| nes.product_of_roots.e_equation_product | easy | x²+bx+c=0 (정수 근)의 두 해의 곱을 묻는다 |
| nes.num_real_solutions.e_pure_square | easy | x² = k, x² - k = 0, (x-h)² = k, ax² = ak 꼴에서 실근의 개수(0·1·2)를 묻는다 |
| nes.root.m_nonmonic_larger | medium | 최고차 계수가 1 이 아닌 ax²+bx+c=0 (유리수 근)에서 큰 근(또는 작은 근)을 묻는다 |
| nes.root.m_other_solution | medium | x²+bx+c=0 의 한 해를 주고 다른 해를 묻는다 |
| nes.root.m_word_area | medium | 직사각형 가로 w, 세로 w+d, 넓이 A 라는 문장에서 이차방정식을 세워 가로·세로·둘레를 구한다 |
| nes.sum_of_roots.m_rearranged | medium | x²=Sx-P, x(x+u)=v, x²+bx=c 처럼 표준형이 아닌 식을 이항·전개해 두 해의 합을 구한다 |
| nes.product_of_roots.m_nonmonic | medium | ax²+bx+c=0 (a=2~5, 정수 근)의 두 해의 곱 또는 합을 묻는다 |
| nes.irrational_sum_of_roots.m_vieta_irrational | medium | 근이 무리수인 ax²+bx+c=0 에서 근을 구하지 않고 합(-b/a) 또는 곱(c/a)을 묻는다 |
| nes.linear_quadratic_intersection.m_intersection_x | medium | 포물선과 직선의 두 교점 중 큰(작은) x좌표를 묻는다 |
| nes.parameter_discriminant.m_one_solution_c | medium | 해가 하나뿐이라는 조건으로 상수항 c(또는 최고차 계수 k)를 판별식 0 으로 구한다 |
| nes.num_real_solutions.m_discriminant_count | medium | ax²+bx+c=0 의 판별식 부호로 실근의 개수(0·1·2)를 묻는다 |
| nf.evaluate.e_quad_standard | easy | 표준형 이차함수 f(x)=ax²+bx+c 에서 작은 양의 정수 x 의 함숫값을 구한다 |
| nf.evaluate.e_exp_value | easy | 지수함수 f(t)=a·b^t 의 작은 t 에서의 값을 구한다 |
| nf.vertex_x.e_standard_formula | easy | 표준형 이차함수의 꼭짓점 x 좌표 -b/(2a) 를 구한다(정수) |
| nf.find_x_for_value.e_exp_solve | easy | a·b^t = V 에서 거듭제곱을 맞춰 t 를 구한다 |
| nf.evaluate.m_negative_input | medium | 음수 x 에서 ax²+bx+c 의 함숫값을 구한다(부호 처리) |
| nf.evaluate.m_function_difference | medium | f(p) - f(q) 를 구한다(두 번의 함숫값과 뺄셈) |
| nf.vertex_x.m_symmetry_points | medium | 포물선이 높이가 같은 두 점 (p, y₀), (q, y₀) 을 지날 때 꼭짓점의 x 좌표를 구한다 |
| nf.vertex_y.m_min_value_standard | medium | 표준형 이차함수의 최솟값(최댓값)을 완전제곱식 또는 꼭짓점 대입으로 구한다 |
| nf.vertex_y.m_max_projectile | medium | h(t) = at²+bt+c (a<0) 로 모델된 높이의 최대값을 문맥에서 구한다 |
| nf.find_x_for_value.m_exp_double_period | medium | 시작량 a 가 매 τ 단위마다 두 배가 될 때 값 V 에 도달하는 시간을 구한다 |
| nf.interpret_a.m_initial_amount | medium | N(t)=a·b^t (b 정수)에서 n 기간 후의 값 V 로 초기값 a 를 구한다 |
| nf.interpret_b.m_growth_percent | medium | f(t)=a·b^t (b 는 소수 한 자리)에서 기간당 증가율·감소율(%)을 읽는다 |
| ee.polynomial_distribution.e_distribute_single | easy | a(x+b) 를 분배해 전개한 식을 고른다 |
| ee.polynomial_distribution.e_combine_like_terms | easy | (ax+b) ± (cx+d) 의 동류항을 정리한다 |
| ee.polynomial_distribution.e_distribute_plus_constant | easy | a(x+b)+c 를 분배·정리한다 |
| ee.polynomial_distribution.e_factor_common | easy | ax + ab 와 같은 식을 공통인수로 묶은 꼴에서 고른다 |
| ee.polynomial_distribution.m_binomial_product | medium | (px+a)(x+b) 를 전개한다 |
| ee.polynomial_distribution.m_square_binomial | medium | (ax+b)² 을 전개한다 |
| ee.polynomial_distribution.m_difference_squares | medium | (ax-b)(ax+b) 를 전개한다(제곱의 차) |
| ee.polynomial_distribution.m_factor_quadratic | medium | x²+bx+c 와 같은 식을 두 이항식의 곱으로 고른다 |
| ee.rational_equivalence.m_cancel_common_factor | medium | (x²+(a+b)x+ab)/(x+a) 를 약분한 식을 고른다(x≠-a) |
| ee.rational_equivalence.m_add_same_denominator | medium | 분모가 같은 두 분수식의 합을 하나의 분수식으로 정리한다 |
| ee.polynomial_distribution.m_area_expression | medium | 직사각형의 가로 (x+a), 세로 (x+b) 로 넓이(또는 둘레)를 나타내는 식을 고른다 |
| ee.polynomial_distribution.m_exponent_rules | medium | (ax^p)(bx^q) 또는 (ax^p)^q 를 지수 법칙으로 정리한다 |

## 7. 비용 장부(모델 보조 문구, 예산 US$2.5)

호출 0건, 지출 US$0.

## 8. 남은 일·참고

- 공용 `registry.ts` 의 `ARCHETYPES`(hard)·`ARCHETYPES_EM`(easy/medium)은 병합 시 다른 에이전트의 한 줄과 같은 줄에서 충돌할 수 있다(줄 단위로 합치면 된다).
- equivalent_expressions hard 는 파일럿 8개(그룹 14)로 30세트 필요량(30)을 이미 충족해 추가하지 않았다. easy/medium 은 이번 12개 원형이 담당한다.
- hard 원형은 모두 `difficultyStatus: provisional_ai`(잠정)로 기록된다(파일럿과 동일 규약). easy/medium 은 `confirmed`.
- Preview 육안 확인은 `data/mock-exam-generation/math-archetype-A/samples.tsv` 의 점검 포인트 기준으로 한다(원형당 2건).
- 공유 로컬 DB 초기화 사고(문서 첫머리)의 복구는 총괄 확인 필요.
