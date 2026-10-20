"""BC4·BC5 확대 라운드(2026-10-19) 단계 목록. x4a(단원 9 새 원형 13종)는 첫 실행에서 10종이 통과했고 3종(c_x4_param_point_time_calc·c_x4_polar_between_setup·c_x4_polar_inner_loop_calc)은
오개념 설명 길이 규칙으로 반려돼 고쳐 다시 만든다. x4b 는 그 3종과 새 원형 전부(단원 10·7·9 그래프·FRQ)를 한 번에 돌린다."""
STAGE_LISTS = {
    "supp_x4b_all": [
        "c_x4_param_point_time_calc", "c_x4_polar_between_setup", "c_x4_polar_inner_loop_calc",
        "c_x4_nth_term_test", "c_x4_p_series_range", "c_x4_limit_comparison_value", "c_x4_ratio_inconclusive", "c_x4_abs_cond_classify", "c_x4_alt_error_bound_value", "c_x4_geom_sum_equation", "c_x4_repeating_decimal",
        "c_x4_integral_test_log_p", "c_x4_series_derivative_closed", "c_x4_maclaurin_compose", "c_x4_taylor_deriv_from_poly", "c_x4_radius_from_known_points", "c_x4_partial_sum_table", "c_x4_series_integral_estimate",
        "c_x4_taylor_ln_calc", "g_x4_partial_sum_term_graph",
        "g_x4_euler_autonomous_graph", "g_x4_autonomous_limit_graph", "c_x4_logistic_max_rate", "c_x4_euler_table_de", "c_x4_improper_converges_choice", "c_x4_parts_ln_exact", "c_x4_arclength_exact",
        "g_x4_speed_increasing_graphs", "g_x4_motion_direction_graphs",
        "frq_x4_velocity_vector_calc", "frq_x4_series_estimate_calc", "frq_x4_series_classify", "frq_x4_cycloid_exact", "frq_x4_taylor_table_lagrange", "frq_x4_rose_exact", "frq_x4_improper_arctan_calc",
    ],
}
