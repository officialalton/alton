"""예비 3차(R3) 단계별 원형 목록. R3-A: 계산기 필수 MC(+그래프·스킬 3 겹침) — 모듈 calc_r3_a*.py."""
R3A = [
    # 단원 1·2·3
    "g_cont_k_graph_log_calc", "g_ivt_sum_graph_calc", "g_product_formula_graph_calc", "g_quotient_formula_graph_calc", "g_parallel_tangent_formula_calc", "c_x_sec_derivative_calc", "g_chain_exp_graph_calc", "g_chain_graph_outer_calc",
    # 단원 4
    "c_motion_first_reversal_calc", "c_accel_at_rest_calc", "c_temperature_rate_calc", "c_linearization_error_calc", "c_related_rates_cylinder_calc", "c_related_rates_shadow_calc", "c_marginal_cost_meaning_calc", "c_water_depth_rate_calc", "c_speed_change_justify_calc",
    # 단원 5
    "c_abs_max_candidates_calc", "g_critical_point_graph_formula_calc", "g_relative_max_graph_formula_calc", "g_mvt_sum_graph_formula_calc", "c_relative_min_justify_calc", "c_second_deriv_test_justify_calc",
    # 단원 6·7·8
    "c_accum_increasing_interval_calc", "c_accum_abs_max_x_calc", "c_ftc_two_limits_calc", "c_trapezoid_formula_calc", "c_decay_two_points_calc", "g_exp_time_graph_calc",
    "g_area_sin_line_calc", "g_net_amount_formula_graph_calc", "c_area_wrt_y_calc", "c_equilateral_cross_section_calc", "c_integral_meaning_calc",
]
STAGE_LISTS = {"supp_r3a_ab": R3A}

# R3-B: 계산기 불가 Part A MC. R3-A 이후 남은 부족(단원 1:6 2:8 3:6 4:4 5:8 6:6 8:6, 합 44)에 후보 약 20% 여유로 고른 53종(약한 것·R3-A 와 같은 골격은 제외).
R3B = [
    # 단원 1 (b1)
    "c_horizontal_asymptotes_exp_ratio", "c_lim_neg_inf_radical", "c_one_sided_abs_quotient", "c_trig_limit_sine_ratio", "c_cont_three_pieces_two_unknowns", "c_ivt_root_interval_polynomial", "c_squeeze_polynomial_bounds", "c_limit_laws_from_given_limits",
    # 단원 2 (b1)
    "c_tangent_y_intercept_power_exp", "c_horizontal_tangent_poly_exp", "c_quotient_rule_trig_exp_value", "c_derivative_sec_csc_cot_exact", "c_limit_two_point_difference_quotient", "c_piecewise_differentiable_two_constants", "c_count_corners_abs_polynomial", "c_normal_slope_power_ln",
    "c_product_power_times_unknown_function", "c_rewrite_then_differentiate_root_denominator",
    # 단원 3 (b2)
    "c_chain_exp_cos_point", "c_implicit_tangent_line_eq", "c_implicit_cubic_horizontal_x", "c_inverse_deriv_formula", "c_arc_trig_deriv_value", "c_second_deriv_product_exp", "c_product_sqrt_chain_value",
    # 단원 4 (b2)
    "c_speeding_up_intervals", "c_roc_meaning_polynomial", "c_related_rates_ladder", "c_tangent_x_intercept", "c_lhopital_twice_zero",
    # 단원 5 (b2)
    "c_mvt_must_be_true", "c_mvt_hypotheses", "c_decreasing_rational", "c_critical_points_cusp", "c_second_deriv_test_quartic", "c_concave_xnlnx", "c_abs_extremum_cubic", "c_box_min_surface", "c_first_deriv_test_trig",
    # 단원 6 (b3)
    "c_antideriv_power_rules", "c_usub_indef_trig", "c_usub_limits_transform", "c_usub_ln_definite", "c_sigma_to_integral", "c_trapezoid_table_initial", "c_complete_square_arctan",
    # 단원 8 (b3)
    "c_washer_about_line", "c_xsection_nonstandard", "c_position_from_velocity", "c_distance_minus_displacement", "c_area_exp_between", "c_area_crossing_setup", "c_volume_disc_y_axis",
]
STAGE_LISTS["supp_r3b_ab"] = R3B

# R3-B2: R3-B 에서 단원 3 이 1건 모자라 반려 원형(검토기의 계산 착오 가능·부호 표기 문제)을 고쳐 새 후보로 재시도(자동 수선 아님) + 미사용 단원 3 원형 1종.
STAGE_LISTS["supp_r3b2_ab"] = ["c_chain_exp_cos_point", "c_inverse_deriv_formula", "c_log_trig_deriv_expr"]

# R3-C: FRQ. 계산기 허용(Part A) 4종 + 계산기 불가(Part B) 6종(각 새 유형 1 시드).
STAGE_LISTS["supp_r3c_ab"] = ["frq_accum_charge", "frq_marginal_profit", "frq_trench_volume", "frq_cooling_check", "frq_ivp_antiderivative", "frq_rational_param", "frq_exp_decay_de", "frq_pen_cost", "frq_limits_continuity", "frq_inverse_table"]

# R3-C2: 반려 FRQ 4종을 고쳐 새 후보로 재시도(자동 수선 아님) + 새 FRQ 유형 4종.
STAGE_LISTS["supp_r3c2_ab"] = ["frq_cooling_check", "frq_exp_decay_de", "frq_limits_continuity", "frq_rational_param", "frq_region_bisect", "frq_closest_point", "frq_ftc_chain_limit", "frq_arctan_zeros"]
