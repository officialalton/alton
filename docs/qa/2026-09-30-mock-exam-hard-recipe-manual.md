# 2026-09-30 hard 레시피 방식(College Board 특성 기반): 매뉴얼·측정표

이전 '약한 모델 정답률 기반 A/B/C 등급' 체계는 폐기했다(약한 모델 풀이는 정답 검증 보조로만, 강한 모델 3회 일치도 보조 자료로만 기록). hard 판정은 **레시피 채택**(레시피 준수 + 정답 검수 + hard 적합성)이다. 원격 접근·임포트 금지 유지. 대량 실행은 총괄 승인 후.

## 1. 1단계: College Board hard 특성 추출
- 문서: `docs/qa/2026-09-30-collegeboard-hard-characteristics.md` (skill별 3~5개 특성, 근거 문항은 시험·모듈·번호 참조만; 문항 문장 복제 없음). 원본: `data/mock-exam-generation/cb-hard/hard-characteristics.json`, 문항별 프로파일 `cb-hard/profiles/*.json`(28개 모듈 전수, 기대 문항 수와 일치).
- 방법: 시험·모듈별 1회 호출로 문항의 사고 요구를 내용 기준으로 채점(풀이 단계·결합 개념·표현 변환·추상도·선지 미세함·함정 이름) -> 같은 skill에서 '사고 요구 상위 25%'와 '하위 25%'를 대조해 특성 합성. 모듈 앞/뒤 위치는 채점·대조에 쓰지 않았고 위치와 점수의 상관만 참고로 기록했다.
- **난이도 출처 구분**: 공식 난이도(College Board 표기)는 시험지 PDF·커버리지 맵에 없어 `officialDifficulty=null`, 내부 추정(`difficultySource`)은 '내용 기반 사고 요구 대조'다. Math 그래프·도형은 PDF 텍스트에 없어 문장 설명 범위에서만 채점됐다. 표본 부족(cross_text_connections 7, probability 2, inference_margin_error 3)·맵에 없는 skill(systems_linear, evaluating_statistical_claims)은 레시피 없음.

## 2. 2단계: 레시피(`data/mock-exam-generation/recipes.json`, Math v2는 `recipes-v2.json`, 기존 `archetypes.json`은 보존)
skill당 2~3개(초과분은 3개로 절단), 체크리스트 5항목 이하, `minMet`(충족 최소 개수), `beyondMedium`(같은 skill medium 대비 추가 사고), `evidence`(근거 문항 참조), `officialDifficulty`(null)·`difficultySource`(내부 추정 출처). 긴 지문·복잡한 숫자·계산량만으로는 hard로 인정하지 않는다.
- **area_volume**: `area_volume_budget_min_count`(근거 test4-Math-M2-Q26, test8-Math-M2-Q22) — 두 개의 독립된 제약조건을 동시에 만족하는 해를 찾아야 한다 / `area_volume_vertex_coeff_condition`(근거 test4-Math-M2-Q26) — 꼭짓점 정보와 별도의 수치 조건을 함께 결합해야 답이 정해진다 / `area_volume_similarity_scale_ratio`(근거 test9-Math-M1-Q27) — 길이비를 부피비(세제곱 관계)로 변환하는 추상적 인식이 필요하다
- **boundaries**: `boundaries_dangling_modifier_subject_matching`(근거 test8-RW-M2-Q26, test7-RW-M2-Q25, test8-RW-M2-Q25) — 수식어구가 논리적으로 가리키는 대상이 무엇인지 추론한 뒤 그와 의미적으로 일치하는 주어를 찾아야 한다. / `boundaries_clause_relation_punctuation_choice`(근거 test4-RW-M1-Q21, test4-RW-M1-Q23, test4-RW-M2-Q21) — 두 절 사이의 논리적 관계(대조/인과/부연)를 파악한 뒤 그에 맞는 구두점 전략을 골라야 한다. / `boundaries_insert_vs_clause_break`(근거 test4-RW-M1-Q26, test4-RW-M2-Q26, test8-RW-M2-Q25) — 삽입어구 앞뒤가 독립절인지 단순 구인지 구분한 뒤에야 올바른 구두점을 정할 수 있다.
- **central_ideas_details**: `central_ideas_details_dual_stance_reaction`(근거 test10-RW-M2-Q10, test11-RW-M2-Q9, test11-RW-M1-Q13) — 두 입장의 접점과 차이를 함께 고려해 한쪽이 다른 쪽에 어떻게 반응할지 추론해야 한다 / `central_ideas_details_underlying_implication`(근거 test7-RW-M1-Q11, test7-RW-M2-Q11, test11-RW-M1-Q12) — 표면적 진술과 실제 상황 사이의 불일치를 알아채야 정답에 도달한다 / `central_ideas_details_right_size_claim`(근거 test8-RW-M1-Q10, test8-RW-M2-Q10, test11-RW-M1-Q14) — 넓은 주장과 좁은 세부사실 중 어느 수준이 요지인지 범위를 정확히 구별해야 한다
- **circles**: `circles_shift_then_scale`(근거 test6-Math-M1-Q23, test9-Math-M2-Q24) — 이동과 배율이라는 두 가지 조작을 한 번에 결합해 순차적으로 적용해야 한다는 점에서 단일 조작만 묻는 medium 문항과 구별된다. / `circles_area_ratio_square`(근거 test8-Math-M1-Q18, test6-Math-M1-Q23) — 길이 비율을 그대로 쓰지 않고 넓이(제곱) 관계로 변환해야 한다는 비선형적 사고가 medium 문항의 단순 비율 적용과 다르다. / `circles_complete_square_param`(근거 test9-Math-M2-Q24) — 이미 표준형으로 주어진 식에서 값을 읽는 medium 문항과 달리, 일반형을 끝까지 완전제곱으로 변형하는 과정을 거쳐야 파라미터를 도출할 수 있다.
- **command_of_evidence_quant**: `command_of_evidence_quant_two_point_combine`(근거 test6-RW-M1-Q14, test9-RW-M1-Q15, test4-RW-M1-Q17) — 하나의 수치 조회가 아니라 두 개의 수치를 찾아 서로 연결해야 결론이 나온다. / `command_of_evidence_quant_trend_matches_claim`(근거 test7-RW-M1-Q16, test6-RW-M1-Q15, test10-RW-M1-Q17) — 수치 하나를 읽는 것이 아니라 데이터의 전체적 방향성을 추상적 주장과 연결해야 한다. / `command_of_evidence_quant_scope_limit_check`(근거 test6-RW-M2-Q13, test9-RW-M1-Q15, test10-RW-M1-Q17) — 값을 찾는 것이 아니라 주장이 적용되는 범위(전체 대 부분)를 먼저 판단해야 한다.
- **command_of_evidence_text**: `command_of_evidence_text_multi_source_two_variable_combine`(근거 test7-RW-M2-Q15, test9-RW-M2-Q15, test6-RW-M1-Q16) — 하나의 자료·변수만 읽으면 답을 내릴 수 없고 반드시 두 요소를 결합해야 결론이 성립한다 / `command_of_evidence_text_causal_vs_correlation_judgment`(근거 test6-RW-M1-Q16, test10-RW-M2-Q15, test6-RW-M2-Q16) — 단순 연관 사실을 그대로 인과로 받아들이지 않고 방향과 타당성을 스스로 판단해야 한다 / `command_of_evidence_text_hypothesis_supporting_evidence_construction`(근거 test10-RW-M2-Q15, test6-RW-M2-Q16) — 지문을 그대로 읽는 것이 아니라 가설을 지지할 새로운 가상의 증거를 논리적으로 만들어내야 한다
- **equivalent_expressions**: `equivalent_expressions_chain_isolate_target`(근거 test4-Math-M1-Q19, test7-Math-M1-Q19, test10-Math-M2-Q25) — 한 번의 조작이 아니라 서로 다른 성격의 두 조작을 순서대로 연결해야 정답에 도달한다 / `equivalent_expressions_rearrange_for_variable`(근거 test4-Math-M1-Q19, test8-Math-M1-Q17, test7-Math-M1-Q19) — 단순 대입이 아니라 여러 변수가 얽힌 식 전체의 구조를 목표 변수 중심으로 재배열해야 한다 / `equivalent_expressions_table_to_exponential_base`(근거 test10-Math-M2-Q17, test7-Math-M2-Q17, test4-Math-M1-Q23) — 표의 수치 표현과 지수함수 식 표현 사이를 오가며 숨은 밑이나 초기값을 추론해야 한다 / `equivalent_expressions_two_params_then_transform`(근거 test6-Math-M2-Q27) — 매개변수 둘을 연쇄적으로 결정한 뒤 변환해야 한다(단일 대입으로 끝나지 않음) / `equivalent_expressions_substitute_then_match`(근거 test4-Math-M2-Q22) — 치환·재배열과 계수 일치를 두 단계로 결합해야 한다
- **form_structure_sense**: `form_structure_sense_dangling_modifier_agent_trace`(근거 test7-RW-M1-Q25, test4-RW-M1-Q24, test4-RW-M2-Q24) — 수식어구와 형태상 인접한 단어가 아니라 문장 전체 의미에서 실제 행위자를 역추적해야 한다 / `form_structure_sense_clause_logic_first_punctuation`(근거 test10-RW-M2-Q20, test10-RW-M2-Q21, test10-RW-M1-Q24) — 구두점 규칙 암기가 아니라 두 절의 의미 관계를 먼저 판별한 후 그에 맞는 형태를 역산해야 한다 / `form_structure_sense_tense_consistency_across_quote`(근거 test9-RW-M2-Q25, test10-RW-M1-Q24, test9-RW-M1-Q25) — 한 문장 내 국소적 일치가 아니라 인용문-주절 또는 병렬항목 전체에 걸친 시제 일관성을 확인해야 한다
- **inferences**: `inferences_theory_direction_reversal`(근거 test6-RW-M1-Q18, test8-RW-M2-Q18, test6-RW-M2-Q18) — 이론에서 제시된 관계의 방향을 그대로 유지한 채 새로운 대상에 적용해야 하며, 방향을 혼동하면 바로 오답이 되도록 설계한다 / `inferences_graph_text_combine`(근거 test10-RW-M2-Q17, test7-RW-M2-Q16, test10-RW-M2-Q16) — 시각 자료와 텍스트 진술 중 하나만 읽어서는 답이 나오지 않도록 두 정보를 반드시 결합해야 한다 / `inferences_claim_support_or_undermine`(근거 test8-RW-M1-Q17, test4-RW-M1-Q18, test10-RW-M2-Q16) — 제시된 사실이 결론을 실제로 지지/약화하는지 무관한지를 논리적으로 판별해야 하며 표면적 관련성에 속지 않아야 한다
- **linear_equations_one_var**: `linear_equations_one_var_verbal_relation_setup`(근거 test7-Math-M2-Q23, test11-Math-M1-Q8, test7-Math-M1-Q21) — 식이 주어지지 않고 문장 관계를 스스로 변수와 방정식으로 번역해야 한다 / `linear_equations_one_var_fixed_plus_rate_combo`(근거 test7-Math-M1-Q4, test7-Math-M1-Q21, test11-Math-M1-Q17) — 성격이 다른 고정항과 변동항을 하나의 식으로 통합해야 한다 / `linear_equations_one_var_table_to_equation`(근거 test4-Math-M2-Q6, test8-Math-M2-Q16) — 표의 값들을 직접 대수식으로 전환한 뒤에야 문제를 풀 수 있다 / `linear_equations_one_var_two_stage_word`(근거 test6-Math-M1-Q10) — 두 조건을 순서대로 연쇄 적용해야 한다 / `linear_equations_one_var_no_solution_param`(근거 test4-Math-M1-Q12) — 해의 개수 조건을 계수 조건으로 번역한 뒤 재대입
- **linear_equations_two_var**: `linear_equations_two_var_similar_triangle_ratio`(근거 test6-Math-M2-Q27, test4-Math-M2-Q22, test10-Math-M2-Q16) — 기하적 비례 관계(닮음비)를 선형 방정식의 계수 조건으로 번역해야 한다 / `linear_equations_two_var_infinite_no_solution_condition`(근거 test7-Math-M1-Q12, test11-Math-M1-Q25, test7-Math-M1-Q24) — 해의 개수(무수히 많음/없음)에 대한 암묵적 비례 조건을 스스로 도출해야 한다 / `linear_equations_two_var_graph_table_match`(근거 test11-Math-M1-Q18, test7-Math-M2-Q11, test7-Math-M1-Q24) — 서로 다른 표현(그래프/표/식) 간 대응 관계를 정확히 식별해야 한다 / `linear_equations_two_var_param_then_intersection`(근거 test4-Math-M2-Q22) — 조건으로 계수 결정 후 연립해 교점을 구하는 두 단계 / `linear_equations_two_var_two_points_and_meet`(근거 test10-Math-M2-Q16) — 직선 결정 + 교점 조건 + 절편 비교의 결합
- **linear_functions**: `linear_functions_multistep_chain`(근거 test10-Math-M1-Q26, test11-Math-M1-Q27, test6-Math-M2-Q19) — 조건을 한 번에 대입하는 것이 아니라 중간값을 먼저 도출한 뒤 이를 다시 사용해야 한다 / `linear_functions_indirect_inference`(근거 test6-Math-M1-Q26, test11-Math-M1-Q27, test10-Math-M2-9) — 식의 계수가 문제에 직접 주어지지 않아 주어진 관계로부터 역으로 추론해야 한다 / `linear_functions_representation_build`(근거 test10-Math-M1-Q26, test10-Math-M2-Q3, test11-Math-M2-Q17) — 주어진 식에 값을 대입하는 것이 아니라 상황 설명만으로 식 자체를 처음부터 구성해야 한다
- **linear_inequalities**: `linear_inequalities_budget_and_min_count`(근거 test8-Math-M1-Q21, test8-Math-M1-Q22) — 두 개의 독립된 제약(예산 상한과 최소 개수)을 동시에 고려해 해집합의 교집합을 찾아야 한다. / `linear_inequalities_consecutive_integers_setup`(근거 test7-Math-M1-Q23, test8-Math-M1-Q21) — 변수가 주어지지 않아 조건 문장에서 스스로 변수를 정의하고 부등식으로 옮기는 과정이 추가로 필요하다. / `linear_inequalities_two_condition_check`(근거 test8-Math-M1-Q22, test8-Math-M1-Q21) — 하나의 조건이 아니라 두 개의 조건 각각에 대해 후보 값을 개별적으로 검증해야 한다.
- **lines_angles_triangles**: `lines_angles_triangles_two_property_combo`(근거 test6-Math-M1-Q27, test9-Math-M2-Q19, test10-Math-M1-Q24) — 각 조건과 비율 조건을 동시에 만족해야 답이 나오도록 두 정보를 순차적으로 결합해서 추론해야 한다 / `lines_angles_triangles_enough_info_check`(근거 test10-Math-M1-Q24, test9-Math-M2-Q19) — 주어진 정보 자체가 결론을 내리기에 충분한지 불필요한지를 먼저 판별한 후에만 계산으로 넘어가야 한다 / `lines_angles_triangles_impossible_combo`(근거 test11-Math-M1-Q24, test11-Math-M2-Q23) — 여러 후보 조합을 하나씩 규칙에 대입해 소거하는 방식으로 불가능한 경우를 역으로 찾아야 한다 / `lines_angles_triangles_chain_two_properties`(근거 test6-Math-M1-Q20) — 두 기하 성질을 연쇄 적용한 뒤 대수로 결정 / `lines_angles_triangles_similar_plus_pythagoras`(근거 test8-Math-M2-Q14) — 닮음과 피타고라스의 결합 두 단계
- **nonlinear_equations_systems**: `nonlinear_equations_systems_stepwise_substitution`(근거 test7-Math-M2-Q19, test4-Math-M2-Q21, test4-Math-M2-Q12) — 한 번의 이항이 아니라 대입 후 재배열까지 두 단계를 순차적으로 거쳐야 목표 변수가 고립된다 / `nonlinear_equations_systems_tangency_condition`(근거 test4-Math-M1-Q24, test8-Math-M1-Q25, test8-Math-M1-Q24) — 교점이 하나뿐이라는 기하적 조건을 판별식=0이라는 대수식으로 직접 번역해야 한다 / `nonlinear_equations_systems_domain_conversion`(근거 test9-Math-M2-Q27, test4-Math-M2-Q21, test4-Math-M2-Q12) — 그래프의 시각적 특징과 식의 대수적 계수 사이를 한 번 변환해야 한다
- **nonlinear_functions**: `nonlinear_functions_system_from_two_conditions`(근거 test4-Math-M1-Q27, test4-Math-M1-Q26, test4-Math-M2-Q19) — 하나의 조건만으로는 미지수를 결정할 수 없어 두 조건을 연립해야 한다는 것을 인식해야 한다 / `nonlinear_functions_context_to_formula`(근거 test4-Math-M1-Q18, test4-Math-M2-Q18, test6-Math-M2-Q23) — 주어진 맥락 값을 바로 대입하지 않고 한 단계 변환해야 함수식이 완성된다는 것을 인식해야 한다 / `nonlinear_functions_qualitative_no_calculation`(근거 test8-Math-M1-Q26, test8-Math-M2-Q27, test10-Math-M1-Q17) — 구체적 수치 계산 없이 성질만으로 그래프의 형태나 극값 존재 여부를 논리적으로 판별해야 한다 / `nonlinear_functions_fix_then_derived_property`(근거 test10-Math-M2-Q16) — 계수 결정 후 파생 성질을 한 번 더 추론해야 한다 / `nonlinear_functions_context_two_times`(근거 test6-Math-M2-Q27) — 맥락 해석 + 두 조건 계수 결정 + 최적값 추론
- **one_variable_data**: `one_variable_data_extreme_value_effect`(근거 test8-Math-M1-Q23) — 평균과 중앙값이 데이터 변화에 반응하는 방식이 서로 다르다는 점을 구분해서 판단해야 한다 / `one_variable_data_group_comparison_effect`(근거 test8-Math-M1-Q23) — 하나의 값 변화가 평균에는 직접적으로, 중앙값에는 조건에 따라서만 영향을 준다는 간접적 인과관계를 추론해야 한다 / `one_variable_data_shift_scale_mapping`(근거 test9-Math-M2-Q17) — 변환의 종류(덧셈 vs 곱셈)에 따라 각 통계량이 반응하는 방식이 다르다는 대응관계를 하나씩 추적해야 한다
- **percentages**: `percentages_multi_step_chaining`(근거 test4-Math-M2-Q27, test9-Math-M2-Q16, test11-Math-M2-Q21) — 한 번의 퍼센트 계산으로 끝나지 않고 중간 결과를 다음 단계의 입력으로 재사용해야 답이 나온다 / `percentages_algebraic_translation`(근거 test9-Math-M2-Q16, test4-Math-M2-Q27, test11-Math-M2-Q21) — 주어진 식에 대입하는 것이 아니라 상황 설명만으로 스스로 방정식을 세워야 한다 / `percentages_direction_inference`(근거 test4-Math-M2-Q27, test9-Math-M2-Q16, test11-Math-M2-Q21) — 퍼센트의 기준(분모)과 대상(분자)을 문제 상황에서 스스로 판별해야 한다
- **ratios_rates_units**: `ratios_rates_units_two_stage_rate_chain`(근거 test11-Math-M2-Q27, test9-Math-M1-Q18, test7-Math-M2-Q4) — 중간 결과를 다음 단계의 입력으로 재사용해야 최종 답에 도달한다 / `ratios_rates_units_area_scale_jump`(근거 test10-Math-M1-Q22) — 선형 축척을 비선형(제곱/세제곱) 관계로 변환해 적용해야 한다 / `ratios_rates_units_table_to_equation_readback`(근거 test11-Math-M2-Q27, test9-Math-M1-Q18, test10-Math-M1-Q22) — 표 형태의 자료를 식으로 변환한 뒤 그 식을 다시 해석하는 두 방향 전환이 필요하다
- **rhetorical_synthesis**: `rhetorical_synthesis_dual_fact_merge`(근거 test10-RW-M2-Q31, test11-RW-M1-Q31, test4-RW-M1-Q33) — 두 개 이상의 독립된 정보를 목표에 맞춰 하나의 문장으로 동시에 엮어야 한다. / `rhetorical_synthesis_goal_scope_match`(근거 test10-RW-M2-Q32, test10-RW-M2-Q33, test7-RW-M1-Q33) — 제시된 목표의 범위(포괄적인지 구체적인지)에 맞는 정보 조합 수준을 스스로 판단해야 한다. / `rhetorical_synthesis_certainty_level_choice`(근거 test8-RW-M2-Q33, test8-RW-M2-Q32) — 확정적 주장과 잠정적 주장을 구분하여 목표에 맞는 확실성 수준을 스스로 선택해야 한다.
- **right_triangles_trigonometry**: `right_triangles_trigonometry_symbolic_leg_equation`(근거 test7-Math-M2-Q24, test11-Math-M1-Q19) — 구체적 숫자 대신 문자 계수로 표현된 관계식을 세우고 조작해야 한다 / `right_triangles_trigonometry_radical_form_answer`(근거 test10-Math-M1-Q21, test4-Math-M1-Q22, test11-Math-M1-Q19) — 피타고라스 계산 결과를 근호가 포함된 지정된 대수 형태로 추가 변환해야 한다 / `right_triangles_trigonometry_area_pythagorean_chain`(근거 test4-Math-M1-Q22, test10-Math-M2-Q27, test7-Math-M2-Q24) — 넓이(또는 둘레) 조건과 피타고라스 정리라는 두 개념을 순차적으로 결합해야 한다
- **text_structure_purpose**: `text_structure_purpose_chain_role_synthesis`(근거 test10-RW-M1-Q7, test10-RW-M2-Q7, test8-RW-M1-Q9) — 단일 문장의 기능이 아니라 두 단계 이상의 논리 흐름을 연결해야 정답을 찾을 수 있다 / `text_structure_purpose_stance_contrast_inference`(근거 test4-RW-M2-Q9, test9-RW-M2-Q9) — 지문에 명시되지 않은 반응을 두 입장의 차이 비교를 통해 간접적으로 추론해야 한다 / `text_structure_purpose_evidence_scope_match`(근거 test9-RW-M1-Q8, test9-RW-M2-Q8, test11-RW-M1-Q8) — 근거가 결론을 뒷받침하는 정확한 범위를 판별하고 과장되거나 축소된 해석을 구분해야 한다
- **transitions**: `transitions_purpose_filter_sentence`(근거 test8-RW-M2-Q31, test8-RW-M2-Q30) — 문장 간 단순 연결이 아니라 지문 전체의 목적/강조점을 파악해 관련 없는 정보를 걸러내야 한다 / `transitions_contradictory_evidence_synthesis`(근거 test10-RW-M1-Q30, test10-RW-M2-Q30, test10-RW-M2-Q29) — 두 개의 모순되는 관찰을 하나의 결론으로 종합하는 인과 방향을 추론해야 한다 / `transitions_distant_referent_link`(근거 test8-RW-M1-Q26, test8-RW-M1-Q27, test10-RW-M2-Q26) — 수식어구가 가리키는 실제 대상이 인접 명사가 아니라 문장 내 떨어진 요소임을 추적해야 한다
- **two_variable_data**: `two_variable_data_reverse_from_point`(근거 test6-Math-M2-Q26, test7-Math-M2-Q12) — 주어진 출력값에서 거꾸로 계수를 추론해야 한다 / `two_variable_data_infinite_solutions`(근거 test7-Math-M2-Q12) — 두 식이 항등적으로 같아지는 구조적 비례 조건을 인식해야 한다 / `two_variable_data_model_from_scatterplot`(근거 test8-Math-M1-Q11) — 기울기 부호와 절편 부호 두 속성을 동시에 만족하는 식을 골라야 한다
- **words_in_context**: `words_in_context_reversal_signal`(근거 test8-RW-M2-Q5, test6-RW-M1-Q5, test11-RW-M1-Q4) — 통념과 반박이 정반대 방향임을 인식하고 방향을 뒤집어 추론해야 한다 / `words_in_context_negation_polarity`(근거 test8-RW-M2-Q5, test9-RW-M2-Q5, test4-RW-M1-Q4) — 부정어와 대조 접속 표현을 함께 처리해 최종 극성을 역산해야 한다 / `words_in_context_stage_shift`(근거 test4-RW-M2-Q6, test4-RW-M2-Q7, test6-RW-M1-Q4) — 글을 두 개의 서술 단계로 나누고 빈칸이 속한 단계의 기능을 판별해야 한다

검수 3단계(`recipe-check.ts`, 분리 기록): (a) 레시피 준수 — 체크리스트 LLM 1회, minMet 이상 (b) 정답 정확성 — 기존 품질 검수(`review.ts`), 강한 모델 3회 일치는 `strong3`로 보조 기록 (c) hard 적합성 — medium 대비 추가 사고가 있고 난이도가 길이·숫자·계산량에서만 오지 않는지. **채택 = (a)∧(b)∧(c)**. 채택 문항은 passed.json·문항 품질 JSON에 `recipeId`·`recipeCheck`(충족 항목 수·hard 적합 판정)가 기록된다.

## 3. 소량 표본 수율(분모 = 파이프라인이 평가한 최초 후보 전체)
표본 규모: RW 5개 skill x 레시피 3개 x 2문항 요청 = 후보 54, Math 5개 skill(레시피 v1 후보 48, v2 후보 24).

| 방식 | 체계 | 최초 후보 | 파이프라인 통과 | 채택 | 수율 | 채택 1문항당 호출 |
|---|---|---|---|---|---|---|
| 레시피 v1 | RW | 54 | 30 | 14 | 26% | 40 |
| 레시피 v1 | Math | 48 | 28 | 1 | 2% | 578 |
| 레시피 v2 | Math | 24 | 17 | 0 | 0% | - |
| 원형(기존) | RW | 36 | 36 | 27 | 75% | 16 |

skill별 상세(탈락 원인·호출 수):

| 방식 | skill | 최초 후보 | 파이프라인 통과 | 정답 검수 통과 | 레시피 준수 | hard 적합 | 채택 | 수율(채택/최초 후보) | 총 호출 | 채택 1문항당 호출 | 주요 탈락 원인 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 레시피 v1 | central_ideas_details | 12 | 6 | 5 | 4 | 6 | 4 | 33% | 125 | 31 | 레시피미준수 2, format_defect 1 |
| 레시피 v1 | inferences | 9 | 6 | 5 | 4 | 6 | 3 | 33% | 133 | 44 | 레시피미준수 2, explanation_inconsistent 1 |
| 레시피 v1 | words_in_context | 12 | 6 | 5 | 4 | 6 | 3 | 25% | 104 | 35 | 레시피미준수 2, answer_mismatch 1, ambiguous_answer 1 |
| 레시피 v1 | rhetorical_synthesis | 9 | 6 | 5 | 5 | 4 | 2 | 22% | 101 | 50 | hard적합실패 2, 레시피미준수 1, answer_mismatch 1 |
| 레시피 v1 | form_structure_sense | 12 | 6 | 5 | 2 | 4 | 2 | 17% | 95 | 48 | 레시피미준수 4, hard적합실패 2, explanation_inconsistent 1 |
| 레시피 v1 | equivalent_expressions | 12 | 6 | 1 | 5 | 2 | 1 | 8% | 107 | 107 | hard적합실패 4, answer_mismatch 2, explanation_inconsistent 1 |
| 레시피 v1 | linear_equations_one_var | 11 | 6 | 3 | 2 | 0 | 0 | 0% | 105 | - | hard적합실패 6, 레시피미준수 4, answer_mismatch 2 |
| 레시피 v1 | linear_equations_two_var | 10 | 6 | 4 | 6 | 2 | 0 | 0% | 93 | - | hard적합실패 4, copyright_suspect 1, raw_latex_in_body 1 |
| 레시피 v1 | lines_angles_triangles | 4 | 4 | 2 | 2 | 1 | 0 | 0% | 181 | - | hard적합실패 3, answer_mismatch 2, 레시피미준수 2 |
| 레시피 v1 | nonlinear_functions | 11 | 6 | 3 | 4 | 2 | 0 | 0% | 92 | - | hard적합실패 4, explanation_inconsistent 2, 레시피미준수 2 |
| 레시피 v2(Math 단순화) | equivalent_expressions | 6 | 4 | 2 | 3 | 0 | 0 | 0% | 71 | - | hard적합실패 4, explanation_inconsistent 2, ambiguous_answer 1 |
| 레시피 v2(Math 단순화) | linear_equations_one_var | 5 | 4 | 2 | 2 | 2 | 0 | 0% | 75 | - | explanation_inconsistent 2, 레시피미준수 2, hard적합실패 2 |
| 레시피 v2(Math 단순화) | linear_equations_two_var | 4 | 4 | 1 | 1 | 1 | 0 | 0% | 100 | - | 레시피미준수 3, hard적합실패 3, answer_mismatch 2 |
| 레시피 v2(Math 단순화) | lines_angles_triangles | 1 | 1 | 0 | 0 | 0 | 0 | 0% | 149 | - | answer_mismatch 1, explanation_inconsistent 1, factual_error 1 |
| 레시피 v2(Math 단순화) | nonlinear_functions | 8 | 4 | 4 | 2 | 0 | 0 | 0% | 63 | - | hard적합실패 4, 레시피미준수 2 |
| 원형(기존, 같은 (정답·hard적합) 검수) | central_ideas_details | 12 | 12 | 12 | 12 | 11 | 11 | 92% | 144 | 13 | hard적합실패 1 |
| 원형(기존, 같은 (정답·hard적합) 검수) | inferences | 12 | 12 | 9 | 12 | 12 | 9 | 75% | 144 | 16 | explanation_inconsistent 2, factual_error 1 |
| 원형(기존, 같은 (정답·hard적합) 검수) | words_in_context | 12 | 12 | 11 | 12 | 7 | 7 | 58% | 144 | 21 | hard적합실패 5, answer_mismatch 1, explanation_inconsistent 1 |

- 호출 수 = 생성(파이프라인 후보 평가 포함, 추정) + 검수(정답 검수 2 + 레시피 준수 1 + hard 적합 1 + 강한 모델 3회 3). 기존 C 등급 경로(약 100회/건)와 비교: **RW 레시피는 채택당 약 40회로 더 저렴**, Math는 채택이 거의 없어 비교 불가(578회/건 이상).
- 원형(기존) 행은 같은 검수에서 채택이 높아 보이나 분모가 '파이프라인 통과 후 문항'이고(최초 후보 수를 기록하지 않았다), 레시피 준수 검사가 없어 엄격도가 다르다 — 동일 조건 비교가 아니다. 또한 (c) hard 적합 검사가 원형 문항 36건 중 30건을 통과시켜 **변별력이 크지 않다**(같은 계열 모델의 판정이라 관대).

## 4. 기준 판정(계속·수정·폐기)
| 기준 | RW | Math |
|---|---|---|
| 수율(채택/최초 후보) >= 25% | 26% **충족(여유 작음)** | v1 2%, v2(구조 골격으로 단순화) 0% **미충족** |
| 채택당 호출 <= 기존 C 경로(약 100) | 약 40 **충족** | 578+ **미충족** |
| 레시피 <= 3개/skill, 체크리스트 <= 5 | 충족 | 충족 |
- **RW: 계속(소량 확대 후보)**. 단 대량 전에 (1) 수율이 25% 문턱에 가깝고 (2) hard 적합 검사의 변별력이 약하며 (3) 탈락 1위가 레시피 미준수(11건)임을 총괄이 검토해야 한다.
- **Math: AI 생성 hard 중단**. 원인: 생성기가 레시피를 줘도 1~2단계 전형 문제를 만들고(hard 적합 탈락 21+14건), 다단계로 만들면 정답 검수에서 탈락(답 불일치·해설 모순·계산 오류 — 정답 검수 통과 13/28, 9/17). 구조 골격으로 단순화해도 동일 -> 지침 문제가 아니라 모델의 다단계 산술 신뢰도 한계. 이 skill들은 **medium으로 두고** hard 부족분을 별도 보고한다(medium 대체로 hard 충족 처리하지 않음).

## 5. 3세트분 hard 충족 현황(레시피 채택 + 기존 원격 공개 hard만, medium 대체 없음)
| 영역 | skill | 3세트분 | +여분2 | 기존(원격) | 신규 채택 hard | 최종 hard | 3세트분 충족 |
|---|---|---|---|---|---|---|---|
| rw_information_ideas | central_ideas_details | 2 | 4 | 0 | 4 | 4 | O |
| rw_information_ideas | inferences | 2 | 4 | 1 | 5 | 6 | O |
| rw_information_ideas | command_of_evidence_text | 2 | 4 | 0 | 0 | 0 | X |
| rw_information_ideas | command_of_evidence_quant | 1 | 3 | 1 | 0 | 1 | O |
| rw_craft_structure | words_in_context | 3 | 5 | 0 | 4 | 4 | O |
| rw_craft_structure | text_structure_purpose | 3 | 5 | 2 | 0 | 2 | X |
| rw_craft_structure | cross_text_connections | 2 | 4 | 1 | 0 | 1 | X |
| rw_expression_ideas | rhetorical_synthesis | 3 | 5 | 1 | 0 | 1 | X |
| rw_expression_ideas | transitions | 3 | 5 | 1 | 0 | 1 | X |
| rw_standard_english | boundaries | 4 | 6 | 0 | 0 | 0 | X |
| rw_standard_english | form_structure_sense | 3 | 5 | 0 | 0 | 0 | X |
| algebra | linear_equations_one_var | 2 | 4 | 6 | 0 | 6 | O |
| algebra | linear_functions | 2 | 4 | 12 | 0 | 12 | O |
| algebra | linear_equations_two_var | 2 | 4 | 0 | 0 | 0 | X |
| algebra | systems_linear | 2 | 4 | 2 | 0 | 2 | O |
| algebra | linear_inequalities | 1 | 3 | 6 | 0 | 6 | O |
| advanced_math | equivalent_expressions | 3 | 5 | 8 | 0 | 8 | O |
| advanced_math | nonlinear_equations_systems | 3 | 5 | 4 | 0 | 4 | O |
| advanced_math | nonlinear_functions | 3 | 5 | 10 | 0 | 10 | O |
| problem_solving_data | ratios_rates_units | 1 | 3 | 4 | 0 | 4 | O |
| problem_solving_data | percentages | 1 | 3 | 4 | 0 | 4 | O |
| geometry_trig | area_volume | 1 | 3 | 14 | 0 | 14 | O |
| geometry_trig | lines_angles_triangles | 1 | 3 | 1 | 0 | 1 | O |
| geometry_trig | right_triangles_trigonometry | 1 | 3 | 4 | 0 | 4 | O |
| geometry_trig | circles | 1 | 3 | 10 | 0 | 10 | O |

- 3세트분 미충족: RW 7칸, Math 1칸(`linear_equations_two_var`). Math는 기존 원격 공개 hard 공급(85)으로 나머지 칸이 충족된 상태라 신규 생성이 거의 필요 없다. RW는 레시피 대량 실행이 필요한 칸(`command_of_evidence_text`, `text_structure_purpose`, `cross_text_connections`(레시피 없음), `rhetorical_synthesis`, `transitions`(레시피 없음), `boundaries`(레시피 없음 — 표본 52인데 특성 합성은 했으나 이번 표본에서 생성하지 않음), `form_structure_sense`).

## 6. 실행 순서(재사용)
`cb-extract.ts` -> `cb-synth.ts` -> `cb-recipes.ts`(또는 수동 수정) -> `recipe-gen.ts --skills ... --per-recipe N --tag T` -> `review`는 `recipe-check.ts`가 포함 -> `recipe-check.ts --source T` -> `recipe-yield.ts --tag T` -> `aggregate.ts`(채택만 hard) -> `import.ts`(총괄). 기존 `archetypes.json`·`generate.ts --archetype`는 소량 비교 검증 후 교체하기로 해 보존 중이다.
