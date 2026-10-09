"""단계별 그래프 원형 목록(2026-10-09). 승인된 단계 계획(docs/ap/six-set-plan.md §6)의 S1·S2·S3 에 쓰는 원형 이름. 단계 범위를 바꾸면 동결 구성 해시가 달라진다(의도된 동작)."""
STAGES = {
    "graph_s1_ab": [
        "g_avg_roc_graph", "g_product_two_graphs", "g_quotient_two_graphs", "g_chain_two_graphs", "g_inverse_deriv_graph", "g_lhopital_graph", "g_speed_increasing", "g_tangent_approx_fprime_graph",
        "g_fprime_inc_concave", "g_fprime_inflection", "g_abs_max_fprime", "g_riemann_left_graph", "g_integral_semicircle", "g_accum_reverse_extremum", "g_ftc_chain_graph", "g_inflow_outflow_graph",
        "g_total_distance_graph", "g_avg_value_graph", "g_area_between_graph", "g_volume_base_graph", "g_exp_growth_constant", "g_related_rates_two_graphs", "g_lim_jump_sum", "g_cont_removable", "g_count_nondiff",
        "g_prod_deriv_mixed_calc", "g_chain_mixed_calc", "g_integral_mixed_calc", "g_ftc_mixed_calc", "g_avg_value_mixed_calc", "g_area_curve_line_calc", "g_volume_curve_line_calc", "g_washer_curve_line_calc",
        "g_parallel_tangent_calc", "g_exp_value_calc", "g_cont_k_mixed_calc", "g_critical_point_mixed_calc",
    ],
    "graph_s3a_ab": [
        "g_mvt_fprime_graph", "g_extrema_count_fprime", "g_integral_properties_graph", "g_accum_two_values", "g_volume_washer_graph", "g_volume_semicircle_graph", "g_ivt_graph", "g_tangent_line_value_graph",
        "g_rate_mixed_calc", "g_riemann_mixed_calc", "g_avg_roc_mixed_calc", "g_linearization_composite_calc", "g_accum_justify_graph",
        "c_quotient_deriv_calc", "c_trig_deriv_calc", "c_implicit_slope_calc", "c_related_rates_cone_calc", "c_inflection_calc", "c_second_deriv_test_calc", "c_abs_extreme_calc", "c_midpoint_sum_calc", "c_ftc_chain_calc", "c_decay_model_calc",
    ],
    "graph_s3b_ab": ["g_usub_graph", "g_squeeze_graph", "g_position_graph_speed", "g_volume_axis_shift_calc", "g_arcsin_deriv_mixed_calc", "g_exp_deriv_mixed_calc"],
    "graph_s3c_ab": ["g_area_y_graph", "g_volume_triangle_graph", "c_accum_interval_calc", "c_linear_approx_overunder_calc", "c_motion_turn_calc", "c_area_between_calc", "c_disc_volume_calc"],
    "graph_s3d_bc": ["frq_polar_region"],
    "graph_s3c_bc": ["c_bc_euler_calc", "c_bc_improper_calc", "c_bc_alt_terms_calc", "frq_polar_region"],
    "graph_s3b_bc": ["g_geometric_series_graph", "g_logistic_fastest_graph", "g_param_rest_graph"],
    "graph_s3a_bc": ["g_alt_series_graph", "g_param_arclength_graphs_calc", "g_lagrange_p2_calc"],
    "graph_s2_bc": ["g_lagrange_decimal_calc", "g_taylor_deriv_graph", "g_param_speed_graphs", "g_param_dydx_graphs", "g_euler_graph", "g_vector_displacement_graph"],
    "graph_s2_ab": ["g_quotient_mixed_calc", "g_second_deriv_mixed_calc", "g_extreme_mixed_calc", "g_trapezoid_unequal_graph", "g_separable_graph_calc", "g_context_roc_meaning"],
    # 2026-10-09 오너 승인 보강(supplement, docs/ap/supplement-report.md): 배치 1 = BC 단원 10 필수 부족·대체 어려운 구조
    "supp_b1_bc": [
        "c_lagrange_min_degree_calc", "c_taylor_actual_error_calc", "c_series_integral_calc", "c_taylor_from_diffeq_calc", "c_integral_test_bound_calc", "c_geometric_terms_needed_calc",
        "c_series_recognize_sum", "c_term_diff_sum", "c_ratio_limit_e", "c_partial_sum_term", "c_telescoping_sum", "c_integral_test_choice", "c_comparison_benchmark", "c_alt_test_choice",
    ],
    # 배치 2: FRQ 새 유형(AB 3, BC 전용 2) — 후보는 유형마다 여러 시드(같은 유형의 다른 수치 묶음은 독립 문항군이 아니라 형제로 센다)
    "supp_b2_ab": ["frq_table_values", "frq_function_analysis", "frq_rate_in_out"],
    "supp_b2_bc": ["frq_bc_taylor_diffeq", "frq_bc_improper_parts"],
    # 배치 3: 계산기 필수 일반 MC(AB 단원 5·6·2·4·8, BC 단원 7·9·10) + 배치 1 반려 원형 4종 수정 후 재시도
    "supp_b3_ab": [
        "c_increasing_interval_calc", "c_critical_count_calc", "c_optimization_rect_calc", "c_closest_point_calc", "c_fastest_increase_calc", "c_implicit_horizontal_tangent_calc",
        "c_accum_max_value_calc", "c_ftc_second_derivative_calc", "c_integral_equation_solve_calc", "c_limit_def_derivative_calc", "c_tangent_x_intercept_calc",
        "c_related_rates_angle_calc", "c_max_speed_calc", "c_total_distance_calc",
    ],
    "supp_b3_bc": [
        "c_bc_logistic_time_calc", "c_bc_vector_speed_max_calc", "c_bc_polar_between_calc", "c_bc_polar_slope_calc", "c_series_limit_eval",
        "c_series_recognize_sum", "c_term_diff_sum", "c_taylor_actual_error_calc", "c_integral_test_choice",
    ],
    "supp_b3_frq_ab": ["frq_rate_in_out"],
    # 배치 4: 단원 5·6·2 부족 칸 — 통과한 구조의 두 번째 수치 묶음(형제, 독립 문항군 아님)과 배치 3 반려 원형의 수정본
    "supp_b4_ab": [
        "c_increasing_interval_calc", "c_optimization_rect_calc", "c_closest_point_calc", "c_fastest_increase_calc", "c_implicit_horizontal_tangent_calc",
        "c_critical_count_calc", "c_ftc_second_derivative_calc", "c_integral_equation_solve_calc", "c_accum_max_value_calc", "c_limit_def_derivative_calc",
        "c_implicit_second_calc",
    ],
}
