import sys, json, random, hashlib
import calc_ab_reinforce as rf, calc_ab_calc as cc, micro_frq as mf, calc_ab_1 as c1, calc_ab_2 as c2, calc_ab_3 as c3, calc_ab_frq as cf, bio_frq as bf, calc_bc as bc, calc_bc_topup as tu, calc_bc_topup_frq as tf

MC = {
 "lim_table": (c1.lim_table, "1"), "lim_alg": (c1.lim_alg, "1"), "cont_piece": (c1.cont_piece, "1"), "ivt": (c1.ivt, "1"),
 "deriv_est_table": (c1.deriv_est_table, "2"), "diff_cont": (c1.diff_cont, "2"), "product_table": (c1.product_table, "2"), "quotient_rule_eval": (c1.quotient_rule_eval, "2"),
 "chain_table": (c1.chain_table, "3"), "implicit_slope": (c1.implicit_slope, "3"),
 "motion_calc": (c2.motion_calc, "4"), "related_rates": (c2.related_rates, "4"), "linearization": (c2.linearization, "4"), "lhopital": (c2.lhopital, "4"),
 "mvt_calc": (c2.mvt_calc, "5"), "extrema_classification": (c2.extrema_classification, "5"), "fprime_graph_statements": (c2.fprime_graph_statements, "5"), "inflection_count": (c2.inflection_count, "5"), "optimization": (c2.optimization, "5"),
 "riemann_table": (c3.riemann_table, "6"), "ftc_accum": (c3.ftc_accum, "6"), "prop_integrals": (c3.prop_integrals, "6"), "ftc_eval_calc": (c3.ftc_eval_calc, "6"), "usub_integral": (c3.usub_integral, "6"),
 "slope_field_match": (c3.slope_field_match, "7"), "separable_particular": (c3.separable_particular, "7"),
 "avg_value_calc": (c3.avg_value_calc, "8"), "area_setup": (c3.area_setup, "8"), "volume_calc": (c3.volume_calc, "8"), "accum_context_calc": (c3.accum_context_calc, "8"),
}
BCMC = {n: (getattr(bc, n), u) for n, u in [("int_by_parts","6"),("partial_fractions","6"),("improper_integral","6"),("euler_method","7"),("logistic","7"),("arc_length_calc","8"),("param_dydx","9"),("param_speed_calc","9"),("param_second","9"),("param_arclength_calc","9"),("polar_area_calc","9"),("series_test","10"),("taylor_coeff","10"),("radius_interval","10"),("geometric_sum","10"),("lagrange_error","10")]}
MC.update(BCMC)
NEWMC = {"deriv_calc_chain": (cc.deriv_calc_chain, "3"), "ivt_solve_calc": (cc.ivt_solve_calc, "1"), "diffeq_value_calc": (cc.diffeq_value_calc, "7")}
NEWMC.update({"graph_fprime_extremum": (rf.graph_fprime_extremum, "5"), "graph_accum_value": (rf.graph_accum_value, "6")})
MC.update(NEWMC)
TOPUP = {n: (getattr(tu, n), u) for n, u in [("param_xvel_graph","9"),("polar_area_graph","9"),("polar_rprime_graph","9"),("lagrange_graph","10"),("alt_series_table","10"),("taylor_table","10"),("polar_table_distance","9"),("param_speed_table","9")]}
MC.update(TOPUP)
import calc_graph_a as _ga, calc_graph_b as _gb, calc_graph_c as _gc, calc_graph_d as _gd, calc_graph_e as _ge, calc_graph_f as _gf, calc_graph_g as _gg, calc_graph_h as _gh, calc_general_i as _gi, calc_graph_j as _gj, calc_graph_k as _gk, calc_frq_polar as _gfp, calc_supp_a as _sa, calc_supp_b as _sb, calc_supp_frq as _sf
GRAPH_MODS = [_ga, _gb, _gc, _gd, _ge, _gf, _gg, _gh, _gi, _gj, _gk, _sa, _sb]
GRAPH = {n: (getattr(m, n), "0") for m in GRAPH_MODS for n in dir(m) if n.startswith(("g_", "c_")) and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__}
MC.update(GRAPH)
GRAPH_STAGES = {}  # 단계별 목록(graph_s1_ab, graph_s1_bc …): calc_graph_stages.py 가 채운다
try:
    from calc_graph_stages import STAGES as GRAPH_STAGES
except ImportError:
    pass
FRQ ={"frq_table_values": _sf.frq_table_values, "frq_function_analysis": _sf.frq_function_analysis, "frq_rate_in_out": _sf.frq_rate_in_out, "frq_bc_taylor_diffeq": _sf.frq_bc_taylor_diffeq, "frq_bc_improper_parts": _sf.frq_bc_improper_parts, "frq_series": bc.frq_series, "frq_parametric": bc.frq_parametric, "frq_euler_logistic": tf.frq_euler_logistic, "frq_polar_region": _gfp.frq_polar_region, "frq_table_rate": cf.frq_table_rate, "frq_fprime_graph": cf.frq_fprime_graph, "frq_diffeq": cf.frq_diffeq, "frq_area_volume": cf.frq_area_volume, "frq_bio_investigation": bf.frq_bio_investigation, "frq_bio_data_short": bf.frq_bio_data_short, "frq_particle_motion": rf.frq_particle_motion, "frq_related_rates": rf.frq_related_rates, "frq_implicit_diff": rf.frq_implicit_diff, "frq_micro_monopoly": mf.frq_micro_monopoly, "frq_micro_game": mf.frq_micro_game}

def sig(p):
    return hashlib.sha1(json.dumps([p.get("stem"), [o["text"] for o in p.get("options", [])], p.get("stimulus")], sort_keys=True).encode()).hexdigest()[:12]

def batch(name, n, seed0):
    fn = MC.get(name, (FRQ.get(name),))[0]
    out, seen, seed = [], set(), seed0
    while len(out) < n and seed < seed0 + 400:
        try:
            p = fn(random.Random(seed))
        except Exception:
            seed += 1; continue
        k = sig(p) if "options" in p else hashlib.sha1(json.dumps(p["facts"]).encode()).hexdigest()[:12]
        if k not in seen:
            seen.add(k); p["seed"] = seed; p["pack_id"] = f"{name}-s{seed}"; out.append(p)
        seed += 1
    return out

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "list":
        which = sys.argv[2] if len(sys.argv) > 2 else "ab"
        if which == "bc": print(json.dumps({"mc": list(BCMC), "frq": ["frq_series", "frq_parametric"]}))
        elif which == "bctopup": print(json.dumps({"mc": list(TOPUP), "frq": ["frq_euler_logistic"]}))
        elif which == "new": print(json.dumps({"mc": list(NEWMC), "frq": []}))
        elif which.startswith(("graph", "supp")): print(json.dumps({"mc": sorted(GRAPH if which == "graph" else [n for n in GRAPH if n in GRAPH_STAGES.get(which, [])]), "frq": [n for n in FRQ if n in GRAPH_STAGES.get(which, [])]}))
        elif which == "reinforce": print(json.dumps({"mc": ["graph_fprime_extremum", "graph_accum_value"], "frq": ["frq_particle_motion", "frq_related_rates", "frq_implicit_diff"]}))
        elif which == "reinforce2": print(json.dumps({"mc": [], "frq": ["frq_particle_motion", "frq_implicit_diff"]}))
        elif which == "biodata": print(json.dumps({"mc": [], "frq": ["frq_bio_data_short"]}))
        elif which == "bio": print(json.dumps({"mc": [], "frq": ["frq_bio_investigation", "frq_bio_data_short"]}))
        elif which == "micro": print(json.dumps({"mc": [], "frq": ["frq_micro_monopoly", "frq_micro_game"]}))
        else: print(json.dumps({"mc": [k for k in MC if k not in BCMC and k not in NEWMC and k not in TOPUP], "frq": [k for k in FRQ if k in ("frq_table_rate","frq_fprime_graph","frq_diffeq","frq_area_volume")]}))
    elif cmd == "guide":  # 그래프 원형의 가이드 항목(JSON): lib/ap-generation/subjects/graph-archetypes.json 의 원천
        out = []
        for n in sorted(GRAPH):
            p = (batch(n, 1, 0) or [None])[0]
            if not p: raise SystemExit(f"no pack for {n}")
            b = p["blueprint"]
            out.append({"id": n, "topic": p["topic"], "skill": p["skill"], "calculator": p["calculator"], "stimulus": p["stimulus"]["kind"], "verifiedBy": [b["verification"]["independent_path"]], "misconceptions": [m["description"] for m in b["misconceptions"]], "bc": b["subject"] == "ap_calculus_bc"})
        print(json.dumps(out, indent=1))
    elif cmd == "all":print(json.dumps({n: batch(n, int(sys.argv[2]), 0) for n in list(MC) + list(FRQ)}))
    elif cmd == "batch": print(json.dumps(batch(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 0)))

# 가이드 일관성 테스트(gates.test.ts)가 읽는 원형 id 목록(동적 등록과 별개로 문자열 존재를 확인한다)
GRAPH_ARCHETYPE_IDS = ["c_abs_extreme_calc", "c_accum_interval_calc", "c_accum_max_value_calc", "c_alt_test_choice", "c_area_between_calc", "c_bc_alt_terms_calc", "c_bc_euler_calc", "c_bc_improper_calc", "c_bc_logistic_time_calc", "c_bc_polar_between_calc", "c_bc_polar_slope_calc", "c_bc_vector_speed_max_calc", "c_closest_point_calc", "c_comparison_benchmark", "c_critical_count_calc", "c_decay_model_calc", "c_disc_volume_calc", "c_fastest_increase_calc", "c_ftc_chain_calc", "c_ftc_second_derivative_calc", "c_geometric_terms_needed_calc", "c_implicit_horizontal_tangent_calc", "c_implicit_slope_calc", "c_increasing_interval_calc", "c_inflection_calc", "c_integral_equation_solve_calc", "c_integral_test_bound_calc", "c_integral_test_choice", "c_lagrange_min_degree_calc", "c_limit_def_derivative_calc", "c_linear_approx_overunder_calc", "c_max_speed_calc", "c_midpoint_sum_calc", "c_motion_turn_calc", "c_optimization_rect_calc", "c_partial_sum_term", "c_quotient_deriv_calc", "c_ratio_limit_e", "c_related_rates_angle_calc", "c_related_rates_cone_calc", "c_second_deriv_test_calc", "c_series_integral_calc", "c_series_limit_eval", "c_series_recognize_sum", "c_tangent_x_intercept_calc", "c_taylor_actual_error_calc", "c_taylor_from_diffeq_calc", "c_telescoping_sum", "c_term_diff_sum", "c_total_distance_calc", "c_trig_deriv_calc", "g_abs_max_fprime", "g_accum_justify_graph", "g_accum_reverse_extremum", "g_accum_two_values", "g_alt_series_graph", "g_arcsin_deriv_mixed_calc", "g_area_between_graph", "g_area_curve_line_calc", "g_area_y_graph", "g_avg_roc_graph", "g_avg_roc_mixed_calc", "g_avg_value_graph", "g_avg_value_mixed_calc", "g_chain_mixed_calc", "g_chain_two_graphs", "g_cont_k_mixed_calc", "g_cont_removable", "g_context_roc_meaning", "g_count_nondiff", "g_critical_point_mixed_calc", "g_euler_graph", "g_exp_deriv_mixed_calc", "g_exp_growth_constant", "g_exp_value_calc", "g_extrema_count_fprime", "g_extreme_mixed_calc", "g_fprime_inc_concave", "g_fprime_inflection", "g_ftc_chain_graph", "g_ftc_mixed_calc", "g_geometric_series_graph", "g_inflow_outflow_graph", "g_integral_mixed_calc", "g_integral_properties_graph", "g_integral_semicircle", "g_inverse_deriv_graph", "g_ivt_graph", "g_lagrange_decimal_calc", "g_lagrange_p2_calc", "g_lhopital_graph", "g_lim_jump_sum", "g_linearization_composite_calc", "g_logistic_fastest_graph", "g_mvt_fprime_graph", "g_parallel_tangent_calc", "g_param_arclength_graphs_calc", "g_param_dydx_graphs", "g_param_rest_graph", "g_param_speed_graphs", "g_position_graph_speed", "g_prod_deriv_mixed_calc", "g_product_two_graphs", "g_quotient_mixed_calc", "g_quotient_two_graphs", "g_rate_mixed_calc", "g_related_rates_two_graphs", "g_riemann_left_graph", "g_riemann_mixed_calc", "g_second_deriv_mixed_calc", "g_separable_graph_calc", "g_speed_increasing", "g_squeeze_graph", "g_tangent_approx_fprime_graph", "g_tangent_line_value_graph", "g_taylor_deriv_graph", "g_total_distance_graph", "g_trapezoid_unequal_graph", "g_usub_graph", "g_vector_displacement_graph", "g_volume_axis_shift_calc", "g_volume_base_graph", "g_volume_curve_line_calc", "g_volume_semicircle_graph", "g_volume_triangle_graph", "g_volume_washer_graph", "g_washer_curve_line_calc"]
