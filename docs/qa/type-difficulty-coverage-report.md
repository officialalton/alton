# 문항 유형 × 난이도 커버리지 점검
생성: 2026-10-07T05:34:07.634Z · 시드/원형 12 · 컴파일러 배치 10 · 소요 140s · 재실행: `npm run check:type-difficulty` (JSON: docs/qa/type-difficulty-coverage-report.json)

## 요약
- (a) 자료 조합 303 × 3: 칸 909 = OK 909 · WEAK 0 · EMPTY 0
- (b) 종류 132 × 3(원형 있는 종류 132): 칸 396 = OK 395 · WEAK 1 · EMPTY 0
- (c) skill 30 × 3(Math 19 + RW 11): 칸 90 = OK 85 · WEAK 3 · EMPTY 2 — 원격 비프로덕션 worpsqwqgnspddnrtnvq: 문항 3134·게시 버전 2503·세트 7·세트 항목 534
- (d) 비어 있거나 약한 칸 6개(아래 목록)

## 방법
- 모의고사 구성과 무관하다. 칸의 판정은 "그 유형·난이도가 존재·산출·건강한가"만 본다.
- 판정: **EMPTY**=항목 0(생성기 없음 또는 산출 0 / 은행 게시 0), **WEAK**=3 미만(독립 변형 또는 게시 문항) 또는 검증·렌더 실패 또는 explanation_en 누락, **OK**=나머지.
- **조합·종류는 은행 행이 아니라 생성기 산출로 측정한다.** 은행(problems)에는 조합 id 열이 없고 subpattern 은 원형/변형 키라 조합으로 역추적할 수 없다. 따라서 (a)(b)는 "생성기가 그 난이도를 만들 수 있나"이고 (c)만 실제 은행 보유량이다.
- (a) 매니페스트 303 조합 각각의 `figureItem` 원형을 난이도(level/difficulty)별로 시드 0~11 생성 → 공개 검증 게이트(verifyLevel/verifyInstance: 정답 재계산·표기·내용) → 자료 렌더 구조검사(checkInstanceFigureQa). 셀 표기 `상태 산출/시도 i<독립 변형 수> f<실패 수>`; 독립 = 본문 3-gram Jaccard < 0.6 탐욕 집합(칸 안 모든 원형 합산).
- (b) 종류=매니페스트의 skill.kind 132(기존 82 + 신규 SAT 50). 난이도별로 (1) 레지스트리 원형(hard·easy/medium) (2) lite 틀(easy/medium) (3) 계산형 컴파일러(kind-catalog 등록 kind만, 배치 10)의 산출을 합친다. 컴파일러 hard 는 원형 hard 와 품질 근거가 다르므로 셀 단위 출처는 JSON 의 bySource 로 확인한다.
- (c) 원격 비프로덕션 SELECT 만(키는 supabase CLI 에서 메모리로만 사용). 보관되지 않은 문항 중 `published_version_id` 가 있으면 게시. 칸 표기 `상태 게시수 e-<explanation_en 누락> m<모의고사 용도(mock_exam|both)> x<게시 세트에 실제 노출된 문항 수>`. EMPTY 의 "(초안 n)"은 게시 아닌 보관 외 문항 수.
- 한계: 시드 12개의 표본이라 독립 변형 수는 하한 추정이다(시드를 늘리면 증가). 미구현 신규 종류·조합은 시도 0 으로 EMPTY.

## (a) 자료 조합 × 난이도
| 조합 id | easy | medium | hard |
|---|---|---|---|
| equivalent_expressions.polynomial_distribution.PG.P | OK 12/12 i10 | OK 12/12 i8 | OK 48/48 i42 |
| equivalent_expressions.polynomial_distribution.TB.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i44 |
| ratios_rates_units.proportion.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| ratios_rates_units.proportion.LN.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i41 |
| ratios_rates_units.proportion.LN.C | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i36 |
| ratios_rates_units.proportion.BR.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i45 |
| ratios_rates_units.proportion.PI.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i40 |
| ratios_rates_units.chained_conversion.TB.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i45 |
| ratios_rates_units.chained_conversion.LN.P | OK 12/12 i9 | OK 12/12 i10 | OK 48/48 i37 |
| linear_equations_one_var.solve.LN.P | OK 12/12 i9 | OK 12/12 i8 | OK 48/48 i30 |
| linear_equations_one_var.word_problem_translate.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| linear_equations_one_var.word_problem_translate.LN.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i43 |
| linear_equations_one_var.literal_rearrange.PG.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i44 |
| probability.simple.TW.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i43 |
| probability.simple.FQ.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i45 |
| probability.simple.BR.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i44 |
| probability.simple.PI.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i43 |
| probability.simple.VT.P | OK 12/12 i9 | OK 12/12 i12 | OK 48/48 i43 |
| probability.conditional.TW.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i45 |
| probability.conditional.FQ.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i46 |
| probability.conditional.VT.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i42 |
| probability.sequential_without_replacement.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i46 |
| probability.sequential_without_replacement.VT.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i39 |
| probability.sequential_without_replacement.PI.P | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i40 |
| nonlinear_equations_systems.root.FN.P | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i40 |
| nonlinear_equations_systems.root.FN.C | OK 12/12 i9 | OK 12/12 i12 | OK 48/48 i45 |
| nonlinear_equations_systems.root.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i46 |
| nonlinear_equations_systems.sum_of_roots.FN.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i33 |
| nonlinear_equations_systems.sum_of_roots.TB.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i42 |
| nonlinear_equations_systems.product_of_roots.FN.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i33 |
| nonlinear_equations_systems.num_real_solutions.FN.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i40 |
| nonlinear_equations_systems.num_real_solutions.FN.C | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i40 |
| nonlinear_equations_systems.irrational_sum_of_roots.FN.P | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i34 |
| nonlinear_equations_systems.irrational_product_of_roots.FN.P | OK 12/12 i10 | OK 12/12 i9 | OK 48/48 i32 |
| nonlinear_equations_systems.irrational_root_radical_form.FN.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i38 |
| nonlinear_equations_systems.linear_quadratic_intersection.FN.P | OK 12/12 i7 | OK 12/12 i9 | OK 48/48 i37 |
| nonlinear_equations_systems.linear_quadratic_intersection.FN.C | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i32 |
| nonlinear_equations_systems.linear_quadratic_intersection.TB.P | OK 12/12 i9 | OK 12/12 i11 | OK 48/48 i40 |
| nonlinear_equations_systems.parameter_discriminant.FN.P | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i42 |
| nonlinear_equations_systems.parameter_discriminant.FN.C | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i43 |
| nonlinear_functions.evaluate.TB.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i42 |
| nonlinear_functions.evaluate.FN.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i42 |
| nonlinear_functions.evaluate.FN.C | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i39 |
| nonlinear_functions.vertex_x.FN.P | OK 12/12 i12 | OK 12/12 i9 | OK 48/48 i43 |
| nonlinear_functions.vertex_x.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i45 |
| nonlinear_functions.vertex_x.FN.C | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i43 |
| nonlinear_functions.vertex_y.FN.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i42 |
| nonlinear_functions.vertex_y.TB.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i40 |
| nonlinear_functions.vertex_y.FN.C | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i38 |
| nonlinear_functions.find_x_for_value.FN.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i36 |
| nonlinear_functions.find_x_for_value.TB.P | OK 12/12 i11 | OK 12/12 i9 | OK 48/48 i43 |
| nonlinear_functions.interpret_a.FN.P | OK 12/12 i7 | OK 12/12 i7 | OK 48/48 i33 |
| nonlinear_functions.interpret_a.FN.C | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i39 |
| nonlinear_functions.interpret_b.FN.P | OK 12/12 i9 | OK 12/12 i11 | OK 48/48 i32 |
| nonlinear_functions.interpret_b.FN.C | OK 12/12 i12 | OK 12/12 i9 | OK 48/48 i37 |
| linear_inequalities.solve_one_var.NL.P | OK 12/12 i9 | OK 12/12 i9 | OK 48/48 i39 |
| linear_inequalities.solve_one_var.NL.C | OK 12/12 i9 | OK 12/12 i10 | OK 48/48 i26 |
| linear_inequalities.solve_one_var.LN.P | OK 12/12 i10 | OK 12/12 i9 | OK 48/48 i32 |
| linear_inequalities.point_in_solution.LN.P | OK 12/12 i9 | OK 12/12 i11 | OK 48/48 i27 |
| linear_inequalities.point_in_solution.LN.C | OK 12/12 i9 | OK 12/12 i12 | OK 48/48 i31 |
| linear_inequalities.point_in_solution.TB.P | OK 12/12 i9 | OK 12/12 i10 | OK 48/48 i45 |
| linear_inequalities.table_verification.TB.P | OK 12/12 i7 | OK 12/12 i12 | OK 48/48 i42 |
| linear_inequalities.table_verification.TB.C | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i42 |
| linear_functions.evaluate.TB.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i47 |
| linear_functions.evaluate.LN.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i45 |
| linear_functions.find_x_for_value.TB.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i42 |
| linear_functions.find_x_for_value.LN.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i46 |
| linear_functions.slope_from_two_points.LN.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i44 |
| linear_functions.slope_from_two_points.TB.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i46 |
| linear_functions.slope_from_two_points.LN.C | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i39 |
| linear_functions.interpret_slope.LN.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i44 |
| linear_functions.interpret_slope.TB.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i46 |
| linear_functions.interpret_slope.LN.C | OK 12/12 i10 | OK 12/12 i9 | OK 48/48 i37 |
| linear_functions.interpret_intercept.LN.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i43 |
| linear_functions.interpret_intercept.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i45 |
| linear_functions.interpret_intercept.LN.C | OK 12/12 i9 | OK 12/12 i11 | OK 48/48 i43 |
| linear_equations_two_var.intersection_x.LN.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i44 |
| linear_equations_two_var.intersection_x.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i45 |
| linear_equations_two_var.intersection_y.LN.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i42 |
| linear_equations_two_var.intersection_sum.LN.P | OK 12/12 i8 | OK 12/12 i10 | OK 48/48 i42 |
| linear_equations_two_var.slope.LN.P | OK 12/12 i9 | OK 12/12 i9 | OK 48/48 i42 |
| linear_equations_two_var.slope.TB.P | OK 12/12 i8 | OK 12/12 i11 | OK 48/48 i41 |
| linear_equations_two_var.slope.LN.C | OK 12/12 i11 | OK 12/12 i9 | OK 48/48 i39 |
| linear_equations_two_var.intercept.LN.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i38 |
| linear_equations_two_var.intercept.LN.C | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i44 |
| linear_equations_two_var.num_solutions.LN.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i39 |
| linear_equations_two_var.num_solutions.LN.C | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i40 |
| systems_linear.substitution_solve.LN.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i35 |
| systems_linear.substitution_solve.TB.P | OK 12/12 i10 | OK 12/12 i9 | OK 48/48 i39 |
| systems_linear.elimination_value.LN.P | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i39 |
| systems_linear.param_no_solution.LN.P | OK 12/12 i9 | OK 12/12 i10 | OK 48/48 i37 |
| systems_linear.param_no_solution.LN.C | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i41 |
| systems_linear.word_system.TB.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i47 |
| systems_linear.word_system.LN.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i44 |
| systems_linear.word_system.LN.C | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i37 |
| lines_angles_triangles.triangle_angle_sum.TR.P | OK 12/12 i9 | OK 12/12 i12 | OK 48/48 i47 |
| lines_angles_triangles.triangle_angle_sum.TR.C | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| lines_angles_triangles.triangle_angle_sum.PT.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| lines_angles_triangles.exterior_angle.TR.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| lines_angles_triangles.exterior_angle.PT.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i48 |
| lines_angles_triangles.isosceles_base_angle.TR.P | OK 12/12 i9 | OK 12/12 i12 | OK 48/48 i45 |
| lines_angles_triangles.isosceles_base_angle.TR.C | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| lines_angles_triangles.similar_triangles.TR.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i42 |
| lines_angles_triangles.similar_triangles.TN.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| lines_angles_triangles.similar_triangles.TR.B | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i43 |
| lines_angles_triangles.similar_triangles.CG.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i46 |
| right_triangles_trigonometry.pythagorean_hypotenuse.TR.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i43 |
| right_triangles_trigonometry.pythagorean_hypotenuse.CG.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| right_triangles_trigonometry.pythagorean_hypotenuse.SX.P | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i45 |
| right_triangles_trigonometry.pythagorean_leg.TR.P | OK 12/12 i10 | OK 12/12 i9 | OK 48/48 i41 |
| right_triangles_trigonometry.pythagorean_leg.CG.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i48 |
| right_triangles_trigonometry.trig_ratio.TR.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| right_triangles_trigonometry.trig_ratio.UC.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| right_triangles_trigonometry.trig_ratio.TC.P | OK 12/12 i10 | OK 12/12 i9 | OK 48/48 i37 |
| one_variable_data.mean.FQ.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i44 |
| one_variable_data.mean.DP.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i42 |
| one_variable_data.mean.BR.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i46 |
| one_variable_data.mean.HG.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i41 |
| one_variable_data.mean.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i42 |
| one_variable_data.mean.SL.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| one_variable_data.mean.FO.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i44 |
| one_variable_data.mean.DP.C | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i46 |
| one_variable_data.median.DP.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i44 |
| one_variable_data.median.FQ.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i48 |
| one_variable_data.median.HG.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i46 |
| one_variable_data.median.BX.P | OK 12/12 i11 | OK 12/12 i9 | OK 48/48 i43 |
| one_variable_data.median.SL.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i43 |
| one_variable_data.median.FO.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i40 |
| one_variable_data.median.BX.C | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i40 |
| one_variable_data.range.DP.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i42 |
| one_variable_data.range.BX.P | OK 12/12 i9 | OK 12/12 i8 | OK 48/48 i38 |
| one_variable_data.range.TB.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i45 |
| one_variable_data.range.SL.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i44 |
| one_variable_data.range.HG.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i42 |
| one_variable_data.grouped_median_interval.HG.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i41 |
| one_variable_data.grouped_median_interval.FQ.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i45 |
| one_variable_data.grouped_median_interval.FO.P | OK 12/12 i9 | OK 12/12 i9 | OK 48/48 i40 |
| one_variable_data.grouped_median_interval.HG.C | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i45 |
| two_variable_data.cell.TW.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i42 |
| two_variable_data.cell.SB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| two_variable_data.row_total.TW.P | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i44 |
| two_variable_data.row_total.SB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i45 |
| two_variable_data.conditional_share.TW.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i45 |
| two_variable_data.conditional_share.SB.P | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i48 |
| two_variable_data.conditional_share.TW.C | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i44 |
| two_variable_data.scatter_equation.SC.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i47 |
| two_variable_data.scatter_equation.LG.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i43 |
| two_variable_data.scatter_equation.SC.C | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i38 |
| two_variable_data.scatter_predict.SC.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i44 |
| two_variable_data.scatter_predict.LG.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i41 |
| two_variable_data.scatter_slope_context.SC.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i45 |
| two_variable_data.scatter_slope_context.LG.P | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i41 |
| two_variable_data.scatter_count_above.SC.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i45 |
| two_variable_data.scatter_count_above.SC.C | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i34 |
| inference_margin_error.population_estimate.ST.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i43 |
| inference_margin_error.population_estimate.NL.P | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i45 |
| inference_margin_error.population_estimate.BR.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i41 |
| inference_margin_error.margin_interval.ST.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i42 |
| inference_margin_error.margin_interval.NL.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i41 |
| inference_margin_error.margin_interval.NL.C | OK 12/12 i9 | OK 12/12 i11 | OK 48/48 i38 |
| inference_margin_error.sample_size_effect.ST.P | OK 12/12 i11 | OK 12/12 i9 | OK 48/48 i42 |
| inference_margin_error.sample_size_effect.BR.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i42 |
| percentages.percent_of.TB.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i45 |
| percentages.percent_of.BR.P | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i44 |
| percentages.percent_of.PI.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i43 |
| percentages.find_whole.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i46 |
| percentages.find_whole.PI.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i44 |
| percentages.find_whole.BR.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i44 |
| percentages.percent_change.BR.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| percentages.percent_change.LG.P | OK 12/12 i11 | OK 12/12 i7 | OK 48/48 i43 |
| percentages.percent_change.TB.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i45 |
| percentages.percent_change.SB.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i46 |
| percentages.find_percent.TB.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i44 |
| percentages.find_percent.BR.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i47 |
| percentages.find_percent.PI.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i45 |
| percentages.compound_change.TB.P | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i43 |
| percentages.compound_change.LG.P | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i43 |
| percentages.compound_change.FN.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i32 |
| area_volume.rectangle_area.PG.P | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i47 |
| area_volume.rectangle_area.CM.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i46 |
| area_volume.rectangle_area.LS.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i43 |
| area_volume.rectangle_area.PG.C | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i46 |
| area_volume.triangle_area.TR.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i48 |
| area_volume.triangle_area.CG.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| area_volume.triangle_area.PG.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| area_volume.prism_volume.SO.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i44 |
| area_volume.prism_volume.SX.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i44 |
| area_volume.prism_missing_dimension.SO.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i44 |
| area_volume.prism_missing_dimension.SO.C | OK 12/12 i8 | OK 12/12 i11 | OK 48/48 i39 |
| area_volume.cylinder_volume_radius.SO.P | OK 12/12 i9 | OK 12/12 i11 | OK 48/48 i43 |
| area_volume.cylinder_volume_radius.SX.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i42 |
| area_volume.cylinder_volume_diameter.SO.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i43 |
| area_volume.cylinder_volume_diameter.SX.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i45 |
| circles.circumference_radius.CI.P | OK 12/12 i9 | OK 12/12 i12 | OK 48/48 i44 |
| circles.circumference_radius.CM.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i40 |
| circles.circumference_diameter.CI.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i43 |
| circles.arc_length.CI.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| circles.arc_length.CM.P | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i42 |
| circles.sector_area.CI.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i39 |
| circles.sector_area.CM.P | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i40 |
| circles.sector_area.PI.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i45 |
| circles.central_from_inscribed.CI.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| circles.central_from_inscribed.CI.C | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i35 |
| circles.inscribed_from_central.CI.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i48 |
| circles.circle_equation_transform.CG.P | OK 12/12 i10 | OK 12/12 i8 | OK 48/48 i37 |
| circles.circle_equation_transform.CG.C | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i41 |
| circles.circle_equation_transform.CG.B | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i41 |
| linear_functions.construct_equation_from_graph.LN.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i46 |
| linear_functions.construct_equation_from_graph.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i45 |
| linear_functions.construct_equation_from_graph.LN.C | OK 12/12 i8 | OK 12/12 i9 | OK 48/48 i43 |
| linear_functions.construct_equation_from_graph.LN.B | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i41 |
| systems_linear.system_from_graph.LN.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i36 |
| systems_linear.system_from_graph.LN.C | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i35 |
| linear_inequalities.inequality_from_graph.LN.P | OK 12/12 i9 | OK 12/12 i11 | OK 48/48 i39 |
| linear_inequalities.inequality_from_graph.LN.C | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i33 |
| linear_inequalities.compound_inequality_number_line.NL.P | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i40 |
| linear_inequalities.compound_inequality_number_line.NL.C | OK 12/12 i11 | OK 12/12 i9 | OK 48/48 i30 |
| nonlinear_functions.exponential_model.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| nonlinear_functions.exponential_model.FN.P | OK 12/12 i8 | OK 12/12 i8 | OK 48/48 i25 |
| nonlinear_functions.exponential_model.FN.C | OK 12/12 i9 | OK 12/12 i12 | OK 48/48 i34 |
| nonlinear_functions.exponential_model.TB.C | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i45 |
| nonlinear_functions.exponential_vs_linear_growth.TB.P | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i44 |
| nonlinear_functions.exponential_vs_linear_growth.LG.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i42 |
| nonlinear_functions.exponential_vs_linear_growth.FN.P | OK 12/12 i7 | OK 12/12 i9 | OK 48/48 i34 |
| nonlinear_functions.function_transformation.FN.P | OK 12/12 i9 | OK 12/12 i11 | OK 48/48 i42 |
| nonlinear_functions.function_transformation.FN.C | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i36 |
| nonlinear_functions.function_transformation.FN.B | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i36 |
| nonlinear_functions.zeros_end_behavior_polynomial.FN.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i24 |
| nonlinear_functions.zeros_end_behavior_polynomial.FN.C | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i36 |
| nonlinear_functions.context_graph_features.FN.P | OK 12/12 i9 | OK 12/12 i12 | OK 48/48 i46 |
| nonlinear_functions.context_graph_features.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i46 |
| nonlinear_functions.rational_asymptote.FN.P | OK 12/12 i8 | OK 12/12 i9 | OK 48/48 i32 |
| nonlinear_functions.rational_asymptote.FN.C | OK 12/12 i9 | OK 12/12 i8 | OK 48/48 i39 |
| nonlinear_equations_systems.circle_equation_graph.CG.P | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i43 |
| nonlinear_equations_systems.circle_equation_graph.CG.C | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i43 |
| one_variable_data.spread_comparison.HG.P | OK 12/12 i9 | OK 12/12 i11 | OK 48/48 i42 |
| one_variable_data.spread_comparison.DP.P | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i42 |
| one_variable_data.spread_comparison.BX.P | OK 12/12 i11 | OK 12/12 i8 | OK 48/48 i43 |
| one_variable_data.spread_comparison.HG.C | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i43 |
| one_variable_data.quartile_percentile_from_plot.BX.P | OK 12/12 i9 | OK 12/12 i11 | OK 48/48 i38 |
| one_variable_data.quartile_percentile_from_plot.SL.P | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i41 |
| one_variable_data.quartile_percentile_from_plot.FO.P | OK 12/12 i10 | OK 12/12 i10 | OK 48/48 i40 |
| one_variable_data.outlier_effect.DP.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i42 |
| one_variable_data.outlier_effect.BX.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i43 |
| one_variable_data.outlier_effect.SL.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i45 |
| one_variable_data.relative_cumulative_frequency.HG.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i46 |
| one_variable_data.relative_cumulative_frequency.FO.P | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i39 |
| one_variable_data.relative_cumulative_frequency.FQ.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i42 |
| two_variable_data.association_direction_strength.SC.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i43 |
| two_variable_data.association_direction_strength.SC.C | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i44 |
| two_variable_data.model_choice_linear_quadratic_exponential.SC.P | OK 12/12 i10 | OK 12/12 i9 | OK 48/48 i46 |
| two_variable_data.model_choice_linear_quadratic_exponential.SC.C | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| two_variable_data.model_choice_linear_quadratic_exponential.FN.P | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i41 |
| two_variable_data.intercept_residual_interpretation.SC.P#1 | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i45 |
| two_variable_data.intercept_residual_interpretation.SC.P#2 | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i46 |
| two_variable_data.outlier_influence_on_fit.SC.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i40 |
| two_variable_data.outlier_influence_on_fit.SC.C | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i42 |
| probability.spinner_expected_value.PI.P | OK 12/12 i11 | OK 12/12 i7 | OK 48/48 i39 |
| probability.spinner_expected_value.TB.P | OK 12/12 i9 | OK 12/12 i11 | OK 48/48 i40 |
| evaluating_statistical_claims.sampling_generalization.ST.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i44 |
| evaluating_statistical_claims.sampling_generalization.TB.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i44 |
| evaluating_statistical_claims.causal_vs_association.ST.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i47 |
| evaluating_statistical_claims.causal_vs_association.BR.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i44 |
| evaluating_statistical_claims.study_design_random_assignment.ST.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i42 |
| lines_angles_triangles.parallel_lines_transversal_angles.PT.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| lines_angles_triangles.parallel_lines_transversal_angles.PT.C | OK 12/12 i12 | OK 12/12 i9 | OK 48/48 i44 |
| lines_angles_triangles.parallel_lines_transversal_angles.P3.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i44 |
| lines_angles_triangles.vertical_supplementary_angles.PT.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i48 |
| lines_angles_triangles.vertical_supplementary_angles.TR.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| lines_angles_triangles.congruent_triangles.TR.P | OK 12/12 i11 | OK 12/12 i8 | OK 48/48 i46 |
| lines_angles_triangles.congruent_triangles.TR.B | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i39 |
| lines_angles_triangles.polygon_interior_angle.PG.P | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i46 |
| lines_angles_triangles.triangle_inequality.TR.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i47 |
| lines_angles_triangles.nested_similar_parallel.TN.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| right_triangles_trigonometry.special_right_triangles.TR.P | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i37 |
| right_triangles_trigonometry.sin_cos_complementary.TR.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| right_triangles_trigonometry.trig_application_elevation.TR.P | OK 12/12 i9 | OK 12/12 i12 | OK 48/48 i36 |
| right_triangles_trigonometry.unit_circle_radian.UC.P | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i46 |
| right_triangles_trigonometry.unit_circle_radian.UC.C | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i48 |
| right_triangles_trigonometry.sinusoid_graph.TC.P | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i44 |
| right_triangles_trigonometry.sinusoid_graph.TC.C | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i41 |
| right_triangles_trigonometry.similar_right_triangle_altitude.TN.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| area_volume.cone_pyramid_sphere_volume.SO.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i44 |
| area_volume.surface_area.SO.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i42 |
| area_volume.composite_solid.SX.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i42 |
| area_volume.shaded_region_area.CM.P | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i39 |
| area_volume.shaded_region_area.CM.C | OK 12/12 i7 | OK 12/12 i7 | OK 48/48 i21 |
| area_volume.trapezoid_parallelogram_area.PG.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i48 |
| area_volume.similar_solids_scale.SO.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i44 |
| area_volume.similar_solids_scale.SO.B | OK 12/12 i11 | OK 12/12 i11 | OK 48/48 i45 |
| area_volume.space_diagonal.SX.P | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i42 |
| circles.tangent_radius_perpendicular.CI.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| circles.chord_length.CI.P | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i47 |
| circles.circle_equation_complete_square.CG.P | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i35 |
| circles.circle_equation_complete_square.CG.C | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i43 |
| circles.inscribed_circumscribed_polygon.CM.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i38 |
| coordinate_geometry.distance_midpoint.CG.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| coordinate_geometry.transformation_image.CG.P | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| coordinate_geometry.transformation_image.CG.C | OK 12/12 i9 | OK 12/12 i9 | OK 48/48 i44 |
| coordinate_geometry.transformation_image.CG.B | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i43 |
| coordinate_geometry.polygon_area_on_plane.CG.P | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i45 |
| coordinate_geometry.parallel_perpendicular_slopes.LN.P | OK 12/12 i9 | OK 12/12 i7 | OK 48/48 i40 |
| coordinate_geometry.parallel_perpendicular_slopes.LN.C | OK 12/12 i9 | OK 12/12 i9 | OK 48/48 i40 |

## (b) 종류 × 난이도
| skill.kind | easy | medium | hard |
|---|---|---|---|
| equivalent_expressions.polynomial_distribution | OK 82/82 i70 | OK 106/106 i93 | OK 154/154 i127 |
| ratios_rates_units.proportion | OK 94/94 i81 | OK 94/94 i88 | OK 298/298 i257 |
| ratios_rates_units.chained_conversion | OK 58/58 i50 | OK 58/58 i51 | OK 154/154 i122 |
| linear_equations_one_var.solve | OK 34/34 i22 | OK 58/58 i44 | OK 106/106 i75 |
| linear_equations_one_var.word_problem_translate | OK 46/46 i36 | OK 46/46 i37 | OK 154/154 i135 |
| linear_equations_one_var.literal_rearrange | OK 34/34 i31 | OK 34/34 i34 | OK 106/106 i100 |
| probability.simple | OK 94/94 i78 | OK 94/94 i83 | OK 298/298 i262 |
| probability.conditional | OK 70/70 i59 | OK 70/70 i60 | OK 202/202 i178 |
| probability.sequential_without_replacement | OK 60/75 i58 | OK 60/75 i57 | OK 192/217 i168 |
| nonlinear_equations_systems.root | OK 58/58 i46 | OK 82/82 i69 | OK 202/202 i180 |
| nonlinear_equations_systems.sum_of_roots | OK 46/46 i36 | OK 46/46 i35 | OK 154/154 i124 |
| nonlinear_equations_systems.product_of_roots | OK 34/34 i23 | OK 34/34 i24 | OK 106/106 i82 |
| nonlinear_equations_systems.num_real_solutions | OK 46/46 i35 | OK 46/46 i37 | OK 154/154 i129 |
| nonlinear_equations_systems.irrational_sum_of_roots | OK 22/22 i11 | OK 34/34 i23 | OK 106/106 i82 |
| nonlinear_equations_systems.irrational_product_of_roots | OK 22/22 i11 | OK 22/22 i10 | OK 106/106 i78 |
| nonlinear_equations_systems.irrational_root_radical_form | OK 22/22 i11 | OK 22/22 i13 | OK 106/106 i86 |
| nonlinear_equations_systems.linear_quadratic_intersection | OK 46/46 i33 | OK 58/58 i45 | OK 201/202 i156 |
| nonlinear_equations_systems.parameter_discriminant | OK 34/34 i23 | OK 46/46 i33 | OK 154/154 i133 |
| nonlinear_functions.evaluate | OK 70/70 i57 | OK 70/70 i57 | OK 202/202 i172 |
| nonlinear_functions.vertex_x | OK 58/58 i47 | OK 58/58 i45 | OK 202/202 i178 |
| nonlinear_functions.vertex_y | OK 46/46 i32 | OK 70/70 i59 | OK 202/202 i165 |
| nonlinear_functions.find_x_for_value | OK 46/46 i38 | OK 46/46 i35 | OK 154/154 i126 |
| nonlinear_functions.interpret_a | OK 34/34 i22 | OK 46/46 i33 | OK 154/154 i120 |
| nonlinear_functions.interpret_b | OK 34/34 i25 | OK 46/46 i35 | OK 154/154 i120 |
| linear_inequalities.solve_one_var | OK 58/58 i40 | OK 82/82 i63 | OK 202/202 i145 |
| linear_inequalities.point_in_solution | OK 58/58 i40 | OK 58/58 i44 | OK 202/202 i147 |
| linear_inequalities.table_verification | OK 46/46 i30 | OK 46/46 i35 | OK 154/154 i127 |
| linear_functions.evaluate | OK 46/46 i36 | OK 46/46 i36 | OK 154/154 i132 |
| linear_functions.find_x_for_value | OK 46/46 i37 | OK 46/46 i36 | OK 154/154 i128 |
| linear_functions.slope_from_two_points | OK 58/58 i46 | OK 58/58 i44 | OK 202/202 i171 |
| linear_functions.interpret_slope | OK 46/46 i34 | OK 58/58 i48 | OK 202/202 i177 |
| linear_functions.interpret_intercept | OK 46/46 i37 | OK 58/58 i51 | OK 202/202 i173 |
| linear_equations_two_var.intersection_x | OK 46/46 i33 | OK 46/46 i33 | OK 154/154 i134 |
| linear_equations_two_var.intersection_y | OK 22/22 i12 | OK 34/34 i23 | OK 106/106 i83 |
| linear_equations_two_var.intersection_sum | OK 22/22 i9 | OK 34/34 i22 | OK 106/106 i83 |
| linear_equations_two_var.slope | OK 58/58 i39 | OK 58/58 i40 | OK 202/202 i162 |
| linear_equations_two_var.intercept | OK 34/34 i24 | OK 46/46 i34 | OK 154/154 i121 |
| linear_equations_two_var.num_solutions | OK 46/46 i39 | OK 34/34 i29 | OK 154/154 i125 |
| systems_linear.substitution_solve | OK 36/36 i32 | OK 36/36 i31 | OK 144/144 i117 |
| systems_linear.elimination_value | OK 24/24 i22 | OK 36/36 i29 | OK 96/96 i76 |
| systems_linear.param_no_solution | OK 24/24 i21 | OK 36/36 i29 | OK 144/144 i121 |
| systems_linear.word_system | OK 48/48 i42 | OK 48/48 i46 | OK 192/192 i172 |
| lines_angles_triangles.triangle_angle_sum | OK 58/58 i43 | OK 58/58 i48 | OK 202/202 i187 |
| lines_angles_triangles.exterior_angle | OK 36/51 i35 | OK 36/51 i32 | OK 144/169 i140 |
| lines_angles_triangles.isosceles_base_angle | OK 34/34 i22 | OK 46/46 i37 | OK 154/154 i134 |
| lines_angles_triangles.similar_triangles | OK 58/58 i46 | OK 70/70 i60 | OK 250/250 i218 |
| right_triangles_trigonometry.pythagorean_hypotenuse | OK 58/58 i44 | OK 58/58 i45 | OK 202/202 i178 |
| right_triangles_trigonometry.pythagorean_leg | OK 46/46 i34 | OK 46/46 i31 | OK 154/154 i133 |
| right_triangles_trigonometry.trig_ratio | OK 46/46 i35 | OK 58/58 i46 | OK 202/202 i177 |
| one_variable_data.mean | OK 118/118 i104 | OK 128/130 i114 | OK 438/442 i384 |
| one_variable_data.median | OK 94/94 i77 | OK 106/106 i89 | OK 394/394 i344 |
| one_variable_data.range | OK 82/82 i66 | OK 70/70 i53 | OK 298/298 i252 |
| one_variable_data.grouped_median_interval | OK 58/58 i43 | OK 58/58 i46 | OK 250/250 i210 |
| two_variable_data.cell | OK 46/46 i36 | OK 34/34 i27 | OK 154/154 i132 |
| two_variable_data.row_total | OK 46/46 i36 | OK 34/34 i23 | OK 154/154 i133 |
| two_variable_data.conditional_share | OK 46/46 i37 | OK 58/58 i48 | OK 202/202 i184 |
| two_variable_data.scatter_equation | OK 36/51 i33 | OK 36/51 i35 | OK 192/217 i170 |
| two_variable_data.scatter_predict | OK 24/39 i24 | OK 36/51 i34 | OK 144/169 i128 |
| two_variable_data.scatter_slope_context | OK 24/39 i24 | OK 36/51 i33 | OK 144/169 i129 |
| two_variable_data.scatter_count_above | OK 24/39 i23 | OK 24/39 i22 | OK 144/169 i120 |
| inference_margin_error.population_estimate | OK 48/48 i45 | OK 48/48 i45 | OK 192/192 i171 |
| inference_margin_error.margin_interval | OK 48/48 i43 | OK 48/48 i42 | OK 192/192 i164 |
| inference_margin_error.sample_size_effect | OK 24/24 i21 | OK 36/36 i32 | OK 144/144 i124 |
| percentages.percent_of | OK 70/70 i57 | OK 70/70 i59 | OK 201/202 i180 |
| percentages.find_whole | OK 70/70 i60 | OK 70/70 i61 | OK 202/202 i183 |
| percentages.percent_change | OK 82/82 i70 | OK 82/82 i67 | OK 250/250 i230 |
| percentages.find_percent | OK 70/70 i60 | OK 70/70 i59 | OK 201/202 i184 |
| percentages.compound_change | OK 70/70 i58 | OK 70/70 i57 | OK 202/202 i168 |
| area_volume.rectangle_area | OK 82/82 i71 | OK 82/82 i68 | OK 250/250 i230 |
| area_volume.triangle_area | OK 70/70 i61 | OK 70/70 i60 | OK 202/202 i193 |
| area_volume.prism_volume | OK 58/58 i46 | OK 58/58 i48 | OK 154/154 i137 |
| area_volume.prism_missing_dimension | OK 58/58 i45 | OK 58/58 i48 | OK 154/154 i132 |
| area_volume.cylinder_volume_radius | OK 58/58 i46 | OK 58/58 i48 | OK 154/154 i134 |
| area_volume.cylinder_volume_diameter | OK 58/58 i47 | OK 58/58 i49 | OK 154/154 i137 |
| circles.circumference_radius | OK 58/58 i46 | OK 58/58 i49 | OK 154/154 i133 |
| circles.circumference_diameter | OK 46/46 i37 | OK 46/46 i37 | OK 106/106 i92 |
| circles.arc_length | OK 58/58 i49 | OK 58/58 i47 | OK 154/154 i138 |
| circles.sector_area | OK 70/70 i57 | OK 70/70 i58 | OK 198/202 i169 |
| circles.central_from_inscribed | OK 58/58 i47 | OK 58/58 i47 | OK 154/154 i131 |
| circles.inscribed_from_central | OK 46/46 i37 | OK 46/46 i36 | OK 106/106 i97 |
| circles.circle_equation_transform | OK 70/70 i59 | OK 70/70 i57 | OK 202/202 i169 |
| linear_functions.construct_equation_from_graph | OK 48/48 i42 | OK 48/48 i43 | OK 192/192 i175 |
| systems_linear.system_from_graph | OK 24/24 i20 | OK 24/24 i22 | OK 96/96 i71 |
| linear_inequalities.inequality_from_graph | OK 24/24 i19 | OK 24/24 i21 | OK 96/96 i72 |
| linear_inequalities.compound_inequality_number_line | OK 24/24 i21 | OK 24/24 i19 | OK 96/96 i70 |
| nonlinear_functions.exponential_model | OK 48/48 i40 | OK 48/48 i42 | OK 192/192 i151 |
| nonlinear_functions.exponential_vs_linear_growth | OK 36/36 i27 | OK 36/36 i30 | OK 144/144 i120 |
| nonlinear_functions.function_transformation | OK 36/36 i30 | OK 36/36 i33 | OK 144/144 i114 |
| nonlinear_functions.zeros_end_behavior_polynomial | OK 24/24 i22 | OK 24/24 i21 | OK 96/96 i60 |
| nonlinear_functions.context_graph_features | OK 24/24 i21 | OK 24/24 i24 | OK 96/96 i92 |
| nonlinear_functions.rational_asymptote | OK 24/24 i17 | OK 24/24 i17 | OK 96/96 i71 |
| nonlinear_equations_systems.circle_equation_graph | OK 24/24 i22 | OK 24/24 i21 | OK 96/96 i86 |
| one_variable_data.spread_comparison | OK 48/48 i42 | OK 48/48 i40 | OK 192/192 i170 |
| one_variable_data.quartile_percentile_from_plot | OK 36/36 i29 | OK 36/36 i31 | OK 144/144 i119 |
| one_variable_data.outlier_effect | OK 36/36 i36 | OK 36/36 i35 | OK 144/144 i130 |
| one_variable_data.relative_cumulative_frequency | OK 36/36 i33 | OK 36/36 i32 | OK 144/144 i127 |
| two_variable_data.association_direction_strength | OK 24/24 i20 | OK 24/24 i23 | OK 96/96 i87 |
| two_variable_data.model_choice_linear_quadratic_exponential | OK 36/36 i34 | OK 36/36 i31 | OK 144/144 i135 |
| two_variable_data.intercept_residual_interpretation | OK 24/24 i22 | OK 24/24 i23 | OK 96/96 i91 |
| two_variable_data.outlier_influence_on_fit | OK 24/24 i24 | OK 24/24 i23 | OK 96/96 i82 |
| probability.spinner_expected_value | OK 24/24 i20 | OK 24/24 i18 | OK 96/96 i79 |
| evaluating_statistical_claims.sampling_generalization | OK 24/24 i24 | OK 24/24 i24 | OK 96/96 i88 |
| evaluating_statistical_claims.causal_vs_association | OK 24/24 i21 | OK 24/24 i23 | OK 96/96 i91 |
| evaluating_statistical_claims.study_design_random_assignment | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i42 |
| lines_angles_triangles.parallel_lines_transversal_angles | OK 36/36 i36 | OK 36/36 i33 | OK 144/144 i135 |
| lines_angles_triangles.vertical_supplementary_angles | OK 24/24 i24 | OK 24/24 i23 | OK 96/96 i96 |
| lines_angles_triangles.congruent_triangles | OK 24/24 i23 | OK 24/24 i19 | OK 96/96 i85 |
| lines_angles_triangles.polygon_interior_angle | OK 12/12 i12 | OK 12/12 i10 | OK 48/48 i46 |
| lines_angles_triangles.triangle_inequality | OK 12/12 i10 | OK 12/12 i11 | OK 48/48 i47 |
| lines_angles_triangles.nested_similar_parallel | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| right_triangles_trigonometry.special_right_triangles | OK 12/12 i11 | OK 12/12 i10 | OK 48/48 i37 |
| right_triangles_trigonometry.sin_cos_complementary | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| right_triangles_trigonometry.trig_application_elevation | OK 12/12 i9 | OK 12/12 i12 | OK 48/48 i36 |
| right_triangles_trigonometry.unit_circle_radian | OK 24/24 i23 | OK 24/24 i21 | OK 96/96 i94 |
| right_triangles_trigonometry.sinusoid_graph | OK 24/24 i23 | OK 24/24 i21 | OK 96/96 i85 |
| right_triangles_trigonometry.similar_right_triangle_altitude | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| area_volume.cone_pyramid_sphere_volume | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i44 |
| area_volume.surface_area | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i42 |
| area_volume.composite_solid | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i42 |
| area_volume.shaded_region_area | OK 24/24 i17 | OK 24/24 i18 | OK 96/96 i60 |
| area_volume.trapezoid_parallelogram_area | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i48 |
| area_volume.similar_solids_scale | OK 24/24 i23 | OK 24/24 i23 | OK 96/96 i89 |
| area_volume.space_diagonal | OK 12/12 i12 | OK 12/12 i11 | OK 48/48 i42 |
| circles.tangent_radius_perpendicular | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i47 |
| circles.chord_length | OK 12/12 i10 | OK 12/12 i12 | OK 48/48 i47 |
| circles.circle_equation_complete_square | OK 24/24 i23 | OK 24/24 i22 | OK 96/96 i78 |
| circles.inscribed_circumscribed_polygon | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i38 |
| coordinate_geometry.distance_midpoint | OK 12/12 i12 | OK 12/12 i12 | OK 48/48 i48 |
| coordinate_geometry.transformation_image | OK 36/36 i32 | OK 36/36 i31 | OK 144/144 i135 |
| coordinate_geometry.polygon_area_on_plane | OK 12/12 i11 | OK 12/12 i12 | OK 48/48 i45 |
| coordinate_geometry.parallel_perpendicular_slopes | OK 24/24 i18 | OK 24/24 i16 | OK 96/96 i80 |
| equivalent_expressions.rational_equivalence | WEAK 10/10 i1 | OK 34/34 i25 | OK 58/58 i44 |

## (c) skill × 난이도(은행)
| skill | 영역 | easy | medium | hard |
|---|---|---|---|---|
| linear_equations_one_var | Math | OK 26 m4 x3 | OK 16 m10 x7 | OK 9 m9 x3 |
| linear_functions | Math | OK 32 m2 x2 | OK 16 m12 x9 | OK 12 m12 x2 |
| linear_equations_two_var | Math | OK 31 m6 x2 | OK 23 m13 x11 | OK 6 m6 x2 |
| systems_linear | Math | OK 32 m6 x4 | OK 26 m13 x11 | OK 6 m6 x2 |
| linear_inequalities | Math | OK 22 m4 x4 | OK 24 m11 x7 | OK 6 m6 x0 |
| equivalent_expressions | Math | OK 22 m8 x6 | OK 21 m14 x13 | OK 12 m12 x3 |
| nonlinear_equations_systems | Math | OK 27 m7 x6 | OK 31 m17 x14 | OK 6 m6 x3 |
| nonlinear_functions | Math | OK 31 m6 x5 | OK 23 m13 x9 | OK 10 m10 x3 |
| ratios_rates_units | Math | OK 37 m6 x2 | OK 8 m4 x3 | OK 7 m7 x0 |
| percentages | Math | OK 22 m4 x1 | OK 15 m7 x4 | OK 5 m5 x1 |
| one_variable_data | Math | OK 23 m3 x1 | OK 19 m8 x4 | WEAK 2 m2 x0 |
| two_variable_data | Math | OK 29 m3 x0 | OK 8 m4 x1 | OK 4 m4 x1 |
| probability | Math | OK 29 m5 x0 | OK 19 m5 x2 | WEAK 2 m2 x1 |
| inference_margin_error | Math | OK 34 m4 x1 | OK 15 m6 x1 | EMPTY (초안 2) |
| evaluating_statistical_claims | Math | OK 16 m3 x1 | OK 11 m6 x3 | EMPTY (초안 1) |
| area_volume | Math | OK 26 m0 x0 | OK 25 m20 x7 | OK 12 m12 x1 |
| lines_angles_triangles | Math | OK 29 m6 x3 | OK 17 m10 x5 | WEAK 2 m2 x1 |
| right_triangles_trigonometry | Math | OK 29 m9 x3 | OK 17 m5 x1 | OK 6 m6 x0 |
| circles | Math | OK 25 m0 x0 | OK 20 m10 x5 | OK 10 m10 x1 |
| central_ideas_details | RW | OK 120 m98 x6 | OK 243 m232 x9 | OK 51 m51 x3 |
| inferences | RW | OK 21 m6 x2 | OK 17 m11 x11 | OK 4 m4 x1 |
| command_of_evidence_text | RW | OK 15 m6 x2 | OK 23 m16 x14 | OK 10 m10 x2 |
| command_of_evidence_quant | RW | OK 26 m6 x2 | OK 24 m11 x10 | OK 3 m3 x0 |
| words_in_context | RW | OK 74 m51 x6 | OK 69 m66 x18 | OK 12 m12 x3 |
| text_structure_purpose | RW | OK 69 m53 x6 | OK 147 m137 x18 | OK 30 m30 x3 |
| cross_text_connections | RW | OK 22 m3 x3 | OK 19 m9 x9 | OK 8 m8 x3 |
| rhetorical_synthesis | RW | OK 30 m12 x6 | OK 34 m22 x15 | OK 10 m10 x3 |
| transitions | RW | OK 28 m12 x6 | OK 29 m21 x12 | OK 8 m8 x3 |
| boundaries | RW | OK 31 m13 x6 | OK 45 m31 x22 | OK 15 m15 x3 |
| form_structure_sense | RW | OK 34 m16 x6 | OK 44 m35 x23 | OK 15 m15 x3 |

## (d) 비었거나 약한 칸
| 매트릭스 | id | 난이도 | 상태 | 사유 |
|---|---|---|---|---|
| b.종류 | equivalent_expressions.rational_equivalence | easy | WEAK | 독립 변형 1 < 3 |
| c.skill(은행) | one_variable_data | hard | WEAK | 게시 2 < 3 |
| c.skill(은행) | probability | hard | WEAK | 게시 2 < 3 |
| c.skill(은행) | inference_margin_error | hard | EMPTY | 게시 문항 0 |
| c.skill(은행) | evaluating_statistical_claims | hard | EMPTY | 게시 문항 0 |
| c.skill(은행) | lines_angles_triangles | hard | WEAK | 게시 2 < 3 |
