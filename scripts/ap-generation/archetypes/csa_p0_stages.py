"""AP Computer Science A 유료 실행 단계 목록(2026-10-13): 파일럿(csa_p1_a·csa_p1_frq, 다른 모듈에 정의) 다음에 풀 모의고사 두 회(겹침 0)를 만들기 위한 보충 배치.
STAGE_S2_MC_A/B/C 는 파일럿에 없는 MC 원형 67개(단독 63 + 세트 3; 파일럿에 들어 있는 세트 1개 제외)를 세 배치로 나눈 것이고, STAGE_S2_FRQ_A/B 는 파일럿에 없는 FRQ 시나리오 12개를 유형 쌍(q1·q2 / q3·q4)으로 나눈 것이다.
STAGE_S2_SHORT_MC / STAGE_S2_SHORT_FRQ 는 비어 있다 — 부족분(가상 칸) 배치는 `cs-assign.ts` 가 재고에서 실제로 못 채운 원형·시나리오를 보고한 뒤에 그 목록으로 채우고 동결한다(그 전에는 실행하지 않는다).
test_csa_p0.TestPaidRunPlan 이 세 MC 배치 + 파일럿 = 라이브러리 전체(겹침·누락 0), 두 FRQ 배치 + 파일럿 = 전체 시나리오임을 검사한다."""
STAGE_S2_MC_A = ["cs_assign_swap_bug", "cs_casting_range", "cs_char_arith", "cs_compound_assign", "cs_describe_every_other", "cs_int_overflow", "cs_math_class", "cs_math_completion", "cs_method_params", "cs_object_alias", "cs_overload_resolution", "cs_random_range", "cs_string_concat_prec", "cs_string_equals_compare", "cs_string_method_completion",
                 "cs_clamp_completion", "cs_class_describe", "cs_class_state_completion", "cs_class_trace", "cs_compile_error_calls", "cs_constructor_completion", "cs_helper_use_completion"]
STAGE_S2_MC_B = ["cs_boolean_expr_trace", "cs_bug_find", "cs_demorgan", "cs_describe_int", "cs_digit_completion", "cs_else_if_chain", "cs_for_iter_count", "cs_gcd_completion", "cs_halving_count", "cs_if_nesting", "cs_loop_bug_fix", "cs_nested_completion", "cs_nested_triangle", "cs_palindrome_completion", "cs_return_early", "cs_string_algorithm", "cs_string_loop_trace", "cs_while_completion", "css_loop_set",
                 "cs_instance_helper_completion", "cs_precondition_class", "cs_return_reference"]
STAGE_S2_MC_C = ["cs_2d_count_completion", "cs_2d_diag_completion", "cs_array_ref_pass", "cs_array_swap_completion", "cs_arraylist_insert_remove", "cs_arraylist_ops", "cs_binary_search", "cs_describe_2d", "cs_describe_list", "cs_initial_conditions", "cs_insertion_completion", "cs_precondition_array", "cs_recursion_completion", "cs_recursion_string", "cs_recursive_binary_trace", "cs_search_completion", "cs_selection_sort_pass", "css_array_set", "css_list_set",
                 "cs_scope_trace", "cs_static_completion", "cs_static_counter", "cs_this_shadow"]
STAGE_S2_FRQ_A = ["csf_methods_runs", "csf_methods_leap", "csf_methods_digits", "csf_class_counter", "csf_class_scoreboard", "csf_class_stock"]
STAGE_S2_FRQ_B = ["csf_list_reviews", "csf_list_runs", "csf_list_remove_short", "csf_2d_shift", "csf_2d_border", "csf_2d_transpose"]
# 2026-10-13 cs-assign 부족분(가상 칸): cs_describe_list·cs_string_algorithm·css_array_set·css_list_set + 안전 여유(원형 수정 뒤 재시도): css_class_set·cs_short_circuit·cs_precondition
STAGE_S2_SHORT_MC = ["cs_describe_list", "cs_string_algorithm", "css_array_set", "css_list_set", "css_class_set", "cs_short_circuit", "cs_precondition"]
# Q4 통과가 2개뿐(border·shift)이라 여유 확보: 반려됐던 시나리오 재시도(transpose 는 채점 행 수정)
STAGE_S2_SHORT_FRQ = ["csf_2d_best_row", "csf_2d_transpose"]
