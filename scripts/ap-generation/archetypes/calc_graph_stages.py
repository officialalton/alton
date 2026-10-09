"""단계별 그래프 원형 목록(2026-10-09). 승인된 단계 계획(docs/ap/six-set-plan.md §6)의 S1·S2·S3 에 쓰는 원형 이름. 단계 범위를 바꾸면 동결 구성 해시가 달라진다(의도된 동작)."""
STAGES = {
    "graph_s1_ab": [
        "g_avg_roc_graph", "g_product_two_graphs", "g_quotient_two_graphs", "g_chain_two_graphs", "g_inverse_deriv_graph", "g_lhopital_graph", "g_speed_increasing", "g_tangent_approx_fprime_graph",
        "g_fprime_inc_concave", "g_fprime_inflection", "g_abs_max_fprime", "g_riemann_left_graph", "g_integral_semicircle", "g_accum_reverse_extremum", "g_ftc_chain_graph", "g_inflow_outflow_graph",
        "g_total_distance_graph", "g_avg_value_graph", "g_area_between_graph", "g_volume_base_graph", "g_exp_growth_constant", "g_related_rates_two_graphs", "g_lim_jump_sum", "g_cont_removable", "g_count_nondiff",
        "g_prod_deriv_mixed_calc", "g_chain_mixed_calc", "g_integral_mixed_calc", "g_ftc_mixed_calc", "g_avg_value_mixed_calc", "g_area_curve_line_calc", "g_volume_curve_line_calc", "g_washer_curve_line_calc",
        "g_parallel_tangent_calc", "g_exp_value_calc", "g_cont_k_mixed_calc", "g_critical_point_mixed_calc",
    ],
    "graph_s2_bc": ["g_lagrange_decimal_calc", "g_taylor_deriv_graph", "g_param_speed_graphs", "g_param_dydx_graphs", "g_euler_graph", "g_vector_displacement_graph"],
    "graph_s2_ab": ["g_quotient_mixed_calc", "g_second_deriv_mixed_calc", "g_extreme_mixed_calc", "g_trapezoid_unequal_graph", "g_separable_graph_calc", "g_context_roc_meaning"],
}
