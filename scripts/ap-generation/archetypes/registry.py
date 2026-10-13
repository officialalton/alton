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
import calc_graph_a as _ga, calc_graph_b as _gb, calc_graph_c as _gc, calc_graph_d as _gd, calc_graph_e as _ge, calc_graph_f as _gf, calc_graph_g as _gg, calc_graph_h as _gh, calc_general_i as _gi, calc_graph_j as _gj, calc_graph_k as _gk, calc_frq_polar as _gfp, calc_supp_a as _sa, calc_supp_b as _sb, calc_supp_frq as _sf, calc_supp_frq2 as _sf2, calc_topup2 as _t2
GRAPH_MODS = [_ga, _gb, _gc, _gd, _ge, _gf, _gg, _gh, _gi, _gj, _gk, _sa, _sb, _t2]
import glob as _glob, importlib as _il, os as _os
_R3 = [_il.import_module(_os.path.basename(f)[:-3]) for f in sorted(_glob.glob(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "calc_r3_*.py")))]  # 2026-10-12 예비 3차(docs/ap/reserve-r3-report.md): 모듈 파일을 두면 자동 등록
GRAPH_MODS = GRAPH_MODS + _R3
# 2026-10-12 AP Statistics(S1 파일럿): stats_s*.py 모듈을 두면 st_ 접두 MC 원형과 STAGE_<이름> 목록(stats_s1_l …)이 자동 등록된다.
_ST = [_il.import_module(_os.path.basename(f)[:-3]) for f in sorted(_glob.glob(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "stats_s*.py")))]
STATS = {n: (getattr(m, n), "0") for m in _ST for n in dir(m) if n.startswith("st_") and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__}
STATS_STAGES = {}
for _m in _ST:
    for _n in dir(_m):
        if _n.startswith("STAGE_"):
            STATS_STAGES[_m.__name__.rsplit("_", 1)[0] + "_" + _n[6:].lower()] = list(getattr(_m, _n))  # stats_s1_l.STAGE_L -> stats_s1_l
STATS_STAGES["stats_s1_all"] = STATS_STAGES.get("stats_s1_l", []) + STATS_STAGES.get("stats_s1_m", []) + STATS_STAGES.get("stats_s1_h", [])  # 위험 L→M→H 순서
STATS_STAGES["stats_s2a_all"] = STATS_STAGES.get("stats_s2a_singles", []) + STATS_STAGES.get("stats_s2a_sets", [])
STATS_STAGES["stats_all"] = list(dict.fromkeys(STATS_STAGES["stats_s1_all"] + STATS_STAGES.get("stats_s2a_singles", []) + STATS_STAGES.get("stats_s2a_sets", []) + STATS_STAGES.get("stats_s2b_singles", []) + STATS_STAGES.get("stats_s3_singles", [])))  # S2-b 단독 목록에는 S2-a 에서 고친 원형 이름이 겹치므로 중복 제거  # 가이드 JSON(stats-archetypes.json)의 원천 순서
# 2026-10-13 AP Physics 1(P0): phys_p0_*.py 모듈을 두면 ph_ 접두 MC 원형·phs_ 세트 원형·phf_ FRQ 원형과 STAGE_<이름> 목록이 자동 등록된다(phys_p0_u1 … phys_all).
_PH = [_il.import_module(_os.path.basename(f)[:-3]) for f in sorted(_glob.glob(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "phys_p0_*.py")))]
PHYS = {n: (getattr(m, n), "0") for m in _PH for n in dir(m) if n.startswith(("ph_", "phs_")) and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__}
PHYS_FRQ = {n: (getattr(m, n), "0") for m in _PH for n in dir(m) if n.startswith("phf_") and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__}
PHYS_STAGES = {}
for _m in _PH:
    for _n in dir(_m):
        if _n.startswith("STAGE_"):
            _k = "phys_" + _n[6:].lower()  # STAGE_U1 -> phys_u1, STAGE_SETS -> phys_sets, STAGE_FRQ -> phys_frq (여러 모듈의 같은 이름 목록은 이어 붙인다)
            PHYS_STAGES[_k] = PHYS_STAGES.get(_k, []) + [x for x in getattr(_m, _n) if x not in PHYS_STAGES.get(_k, [])]
PHYS_STAGES["phys_mc_all"] = [n for k in ("phys_u1", "phys_u2", "phys_u3", "phys_u4", "phys_u5", "phys_u6", "phys_u7", "phys_u8") for n in PHYS_STAGES.get(k, [])]
PHYS_STAGES["phys_all"] = PHYS_STAGES["phys_mc_all"] + PHYS_STAGES.get("phys_sets", []) + PHYS_STAGES.get("phys_frq", [])
# 2026-10-13 AP Chemistry(P0): chem_p0_*.py 모듈을 두면 ch_ 접두 MC 원형·chs_ 세트 원형·chf_ FRQ 원형과 STAGE_<이름> 목록이 자동 등록된다(chem_p1_mc …). 단원·스킬 표는 chem_coverage.py.
_CH = [_il.import_module(_os.path.basename(f)[:-3]) for f in sorted(_glob.glob(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "chem_p0_*.py")))]
CHEM = {n: (getattr(m, n), "0") for m in _CH for n in dir(m) if n.startswith(("ch_", "chs_")) and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__}
CHEM_FRQ = {n: (getattr(m, n), "0") for m in _CH for n in dir(m) if n.startswith("chf_") and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__}
CHEM_STAGES = {}
for _m in _CH:
    for _n in dir(_m):
        if _n.startswith("STAGE_"):
            _k = "chem_" + _n[6:].lower()
            CHEM_STAGES[_k] = CHEM_STAGES.get(_k, []) + [x for x in getattr(_m, _n) if x not in CHEM_STAGES.get(_k, [])]
CHEM_STAGES["chem_mc_all"] = sorted(n for n in CHEM if n.startswith("ch_"))
CHEM_STAGES["chem_sets"] = sorted(n for n in CHEM if n.startswith("chs_"))
CHEM_STAGES["chem_frq"] = sorted(CHEM_FRQ)
CHEM_STAGES["chem_all"] = CHEM_STAGES["chem_mc_all"] + CHEM_STAGES["chem_sets"] + CHEM_STAGES["chem_frq"]
# 2026-10-13 AP Microeconomics(P0): micro_p0_*.py 모듈을 두면 mi_ 접두 MC 원형·mif_ 접두 FRQ 원형과 STAGE_<이름> 목록이 자동 등록된다(micro_p1_mc …). 단원·스킬 표는 micro_coverage.py.
_MI = [_il.import_module(_os.path.basename(f)[:-3]) for f in sorted(_glob.glob(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "micro_p0_*.py")))]
MICRO = {n: (getattr(m, n), "0") for m in _MI for n in dir(m) if n.startswith("mi_") and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__}
MICRO_FRQ = {n: (getattr(m, n), "0") for m in _MI for n in dir(m) if n.startswith("mif_") and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__}
MICRO_STAGES = {}
for _m in _MI:
    for _n in dir(_m):
        if _n.startswith("STAGE_"):
            _k = "micro_" + _n[6:].lower()
            MICRO_STAGES[_k] = MICRO_STAGES.get(_k, []) + [x for x in getattr(_m, _n) if x not in MICRO_STAGES.get(_k, [])]
MICRO_STAGES["micro_mc_all"] = sorted(MICRO)
MICRO_STAGES["micro_frq"] = sorted(MICRO_FRQ)
MICRO_STAGES["micro_all"] = MICRO_STAGES["micro_mc_all"] + MICRO_STAGES["micro_frq"]
GRAPH = {n: (getattr(m, n), "0") for m in GRAPH_MODS for n in dir(m) if n.startswith(("g_", "c_")) and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__}
MC.update(GRAPH)
GRAPH_STAGES = {}  # 단계별 목록(graph_s1_ab, graph_s1_bc …): calc_graph_stages.py 가 채운다
try:
    from calc_graph_stages import STAGES as GRAPH_STAGES
except ImportError:
    pass
FRQ ={"frq_table_values": _sf.frq_table_values, "frq_function_analysis": _sf.frq_function_analysis, "frq_rate_in_out": _sf.frq_rate_in_out, "frq_model_analysis_calc": _sf2.frq_model_analysis_calc, "frq_piecewise_diff": _sf2.frq_piecewise_diff, "frq_bc_taylor_diffeq": _sf.frq_bc_taylor_diffeq, "frq_bc_improper_parts": _sf.frq_bc_improper_parts, "frq_series": bc.frq_series, "frq_parametric": bc.frq_parametric, "frq_euler_logistic": tf.frq_euler_logistic, "frq_polar_region": _gfp.frq_polar_region, "frq_table_rate": cf.frq_table_rate, "frq_fprime_graph": cf.frq_fprime_graph, "frq_diffeq": cf.frq_diffeq, "frq_area_volume": cf.frq_area_volume, "frq_bio_investigation": bf.frq_bio_investigation, "frq_bio_data_short": bf.frq_bio_data_short, "frq_particle_motion": rf.frq_particle_motion, "frq_related_rates": rf.frq_related_rates, "frq_implicit_diff": rf.frq_implicit_diff, "frq_micro_monopoly": mf.frq_micro_monopoly, "frq_micro_game": mf.frq_micro_game}

STATS_FRQ = {n: (getattr(m, n), "0") for m in _ST for n in dir(m) if n.startswith("stfrq_") and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__}  # 통계 FRQ 원형(S2-a)
for _m in _R3:  # R3 모듈: 단계 목록(STAGE_LISTS)과 frq_ 함수 자동 등록
    GRAPH_STAGES.update(getattr(_m, "STAGE_LISTS", {}))
    for _n in dir(_m):
        if _n.startswith("frq_") and callable(getattr(_m, _n)) and getattr(getattr(_m, _n), "__module__", "") == _m.__name__:
            FRQ[_n] = getattr(_m, _n)

def sig(p):
    return hashlib.sha1(json.dumps([p.get("stem"), [o["text"] for o in p.get("options", [])], p.get("stimulus")], sort_keys=True).encode()).hexdigest()[:12]

def batch(name, n, seed0):
    fn = (MC.get(name) or STATS.get(name) or STATS_FRQ.get(name) or PHYS.get(name) or PHYS_FRQ.get(name) or CHEM.get(name) or CHEM_FRQ.get(name) or MICRO.get(name) or MICRO_FRQ.get(name) or (FRQ.get(name),))[0]  # 통계 원형은 MC 사전(칼큘러스 회귀 테스트 대상)에 넣지 않는다
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
        elif which.startswith("micro_"): print(json.dumps({"mc": [n for n in MICRO_STAGES.get(which, list(MICRO)) if n in MICRO], "frq": [n for n in MICRO_STAGES.get(which, []) if n in MICRO_FRQ or n in FRQ]}))
        elif which.startswith("chem"): print(json.dumps({"mc": [n for n in CHEM_STAGES.get(which, list(CHEM)) if n in CHEM], "frq": [n for n in CHEM_STAGES.get(which, []) if n in CHEM_FRQ]}))
        elif which.startswith("phys"): print(json.dumps({"mc": [n for n in PHYS_STAGES.get(which, list(PHYS)) if n in PHYS], "frq": [n for n in PHYS_STAGES.get(which, []) if n in PHYS_FRQ]}))
        elif which.startswith("stats"): print(json.dumps({"mc": [n for n in STATS_STAGES.get(which, list(STATS)) if n in STATS], "frq": [n for n in STATS_STAGES.get(which, []) if n in STATS_FRQ]}))  # 목록 순서 보존(위험 L→M→H)
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
    elif cmd == "guide-stats":  # 통계 원형의 가이드 항목(JSON): lib/ap-generation/subjects/stats-archetypes.json 의 원천. 공유 세트는 문항(<id>_q1..q3)마다 한 항목.
        out = []
        for n in STATS_STAGES.get("stats_all", [k for k in STATS]):
            p = (batch(n, 1, 0) or [None])[0]
            if not p: raise SystemExit(f"no pack for {n}")
            for q in (p["items"] if "items" in p else [p]):
                b = q["blueprint"]
                out.append({"id": q["archetype"], "topic": q["topic"], "skill": q["skill"], "calculator": q["calculator"] if "calculator" in q else p["calculator"], "stimulus": (q.get("stimulus") or p["stimulus"])["kind"], "verifiedBy": [b["verification"]["independent_path"]], "misconceptions": [m["description"] for m in b["misconceptions"]]})
        print(json.dumps(out, indent=1))
    elif cmd == "guide-physics":  # Physics 1 원형의 가이드 항목(JSON): lib/ap-generation/subjects/physics1-archetypes.json 의 원천. 세트는 문항마다 한 항목.
        out = []
        for n in PHYS_STAGES["phys_all"]:
            if n in PHYS_FRQ:
                continue
            p = (batch(n, 1, 0) or [None])[0]
            if not p: raise SystemExit(f"no pack for {n}")
            for q in (p["items"] if "items" in p else [p]):
                b = q["blueprint"]
                out.append({"id": q["archetype"], "topic": q["topic"], "skill": q["skill"], "calculator": "allowed", "stimulus": (q.get("stimulus") or p["stimulus"])["kind"], "verifiedBy": [b["verification"]["independent_path"]], "misconceptions": [m["description"] for m in b["misconceptions"]]})
        print(json.dumps(out, indent=1))
    elif cmd == "guide-micro":  # Microeconomics 원형의 가이드 항목(JSON): lib/ap-generation/subjects/micro-archetypes.json 의 원천.
        out = []
        for n in MICRO_STAGES["micro_mc_all"]:
            p = (batch(n, 1, 0) or [None])[0]
            if not p: raise SystemExit(f"no pack for {n}")
            b = p["blueprint"]
            out.append({"id": p["archetype"], "topic": p["topic"], "skill": p["skill"], "calculator": "allowed", "stimulus": p["stimulus"]["kind"], "verifiedBy": [b["verification"]["independent_path"]], "misconceptions": [m["description"] for m in b["misconceptions"]], "bc": False})
        print(json.dumps(out, indent=1))
    elif cmd == "guide-chem":  # Chemistry 원형의 가이드 항목(JSON): lib/ap-generation/subjects/chem-archetypes.json 의 원천. 세트는 문항마다 한 항목.
        out = []
        for n in CHEM_STAGES["chem_mc_all"] + CHEM_STAGES["chem_sets"]:
            p = (batch(n, 1, 0) or [None])[0]
            if not p: raise SystemExit(f"no pack for {n}")
            for q in (p["items"] if "items" in p else [p]):
                b = q["blueprint"]
                out.append({"id": q["archetype"], "topic": q["topic"], "skill": q["skill"], "calculator": "allowed", "stimulus": (q.get("stimulus") or p["stimulus"])["kind"], "verifiedBy": [b["verification"]["independent_path"]], "misconceptions": [m["description"] for m in b["misconceptions"]]})
        print(json.dumps(out, indent=1))
    elif cmd == "all":print(json.dumps({n: batch(n, int(sys.argv[2]), 0) for n in list(MC) + list(FRQ)}))
    elif cmd == "batch": print(json.dumps(batch(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 0)))

# 가이드 일관성 테스트(gates.test.ts)가 읽는 원형 id 목록(동적 등록과 별개로 문자열 존재를 확인한다)
GRAPH_ARCHETYPE_IDS = ["c_abs_extreme_calc", "c_abs_extremum_cubic", "c_abs_max_candidates_calc", "c_accel_at_rest_calc", "c_accum_abs_max_x_calc", "c_accum_increasing_interval_calc", "c_accum_interval_calc", "c_accum_max_value_calc", "c_accum_two_limits", "c_alt_test_choice", "c_antideriv_power_rules", "c_arc_trig_deriv_value", "c_area_between_calc", "c_area_between_in_y", "c_area_crossing_setup", "c_area_exp_between", "c_area_wrt_y_calc", "c_avg_vs_instant_rate_calc", "c_bc_alt_terms_calc", "c_bc_euler_calc", "c_bc_improper_calc", "c_bc_logistic_time_calc", "c_bc_polar_between_calc", "c_bc_polar_slope_calc", "c_bc_vector_speed_max_calc", "c_box_min_surface", "c_chain_exp_cos_point", "c_choose_differentiable_at_point", "c_closest_point_calc", "c_comparison_benchmark", "c_complete_square_arctan", "c_concave_xnlnx", "c_conditions_at_point", "c_cont_three_pieces_two_unknowns", "c_count_corners_abs_polynomial", "c_count_vertical_asymptotes", "c_critical_count_calc", "c_critical_points_cusp", "c_decay_model_calc", "c_decay_two_points_calc", "c_decreasing_rational", "c_derivative_sec_csc_cot_exact", "c_disc_volume_calc", "c_distance_minus_displacement", "c_equilateral_cross_section_calc", "c_fastest_increase_calc", "c_first_deriv_test_trig", "c_ftc_chain_calc", "c_ftc_initial_value_calc", "c_ftc_second_derivative_calc", "c_ftc_two_limits_calc", "c_geometric_terms_needed_calc", "c_horizontal_asymptotes_exp_ratio", "c_horizontal_tangent_poly_exp", "c_implicit_cubic_horizontal_x", "c_implicit_horizontal_tangent_calc", "c_implicit_second_calc", "c_implicit_slope_calc", "c_implicit_tangent_line_eq", "c_increasing_interval_calc", "c_inflection_calc", "c_integral_abs_poly", "c_integral_equation_solve_calc", "c_integral_meaning_calc", "c_integral_test_bound_calc", "c_integral_test_choice", "c_inverse_deriv_formula", "c_ivt_root_interval_polynomial", "c_lagrange_min_degree_calc", "c_lhopital_inf_inf", "c_lhopital_twice_zero", "c_lim_inf_difference_of_radicals", "c_lim_inf_equal_degree", "c_lim_neg_inf_radical", "c_limit_def_derivative_calc", "c_limit_is_derivative_exact", "c_limit_laws_from_given_limits", "c_limit_numeric_e_calc", "c_limit_two_point_difference_quotient", "c_linear_approx_overunder_calc", "c_linearization_error_calc", "c_log_trig_deriv_expr", "c_longdiv_integral", "c_marginal_cost_meaning_calc", "c_max_speed_calc", "c_midpoint_sum_calc", "c_motion_first_reversal_calc", "c_motion_turn_calc", "c_mvt_hypotheses", "c_mvt_integral_value", "c_mvt_must_be_true", "c_normal_line_calc", "c_normal_slope_power_ln", "c_one_sided_abs_quotient", "c_optimization_rect_calc", "c_partial_sum_term", "c_piecewise_differentiable_two_constants", "c_position_from_velocity", "c_product_power_times_unknown_function", "c_product_sqrt_chain_value", "c_quotient_deriv_calc", "c_quotient_rule_trig_exp_value", "c_ratio_limit_e", "c_related_rates_angle_calc", "c_related_rates_cone_calc", "c_related_rates_cylinder_calc", "c_related_rates_distance_calc", "c_related_rates_ladder", "c_related_rates_shadow", "c_related_rates_shadow_calc", "c_relative_min_justify_calc", "c_removable_value_power_ratio", "c_rewrite_then_differentiate_root_denominator", "c_riemann_error_calc", "c_roc_meaning_polynomial", "c_second_deriv_product_exp", "c_second_deriv_test_calc", "c_second_deriv_test_justify_calc", "c_second_deriv_test_quartic", "c_separable_general_solution", "c_series_integral_calc", "c_series_limit_eval", "c_series_recognize_sum", "c_sigma_to_integral", "c_slope_sign_points", "c_speed_change_justify_calc", "c_speeding_up_intervals", "c_squeeze_polynomial_bounds", "c_tangent_x_intercept", "c_tangent_x_intercept_calc", "c_tangent_y_intercept_power_exp", "c_taylor_actual_error_calc", "c_taylor_from_diffeq_calc", "c_telescoping_sum", "c_temperature_rate_calc", "c_term_diff_sum", "c_total_distance_calc", "c_trapezoid_formula_calc", "c_trapezoid_table_initial", "c_trig_deriv_calc", "c_trig_limit_sine_ratio", "c_usub_indef_trig", "c_usub_limits_transform", "c_usub_ln_definite", "c_volume_disc_y_axis", "c_washer_about_line", "c_water_depth_rate_calc", "c_x_sec_derivative_calc", "c_xsection_nonstandard", "g_abs_max_fprime", "g_accum_concave_down_graph", "g_accum_intersect_formula_calc", "g_accum_justify_graph", "g_accum_reverse_extremum", "g_accum_two_values", "g_alt_series_graph", "g_arcsin_deriv_mixed_calc", "g_area_between_graph", "g_area_curve_line_calc", "g_area_sin_line_calc", "g_area_y_graph", "g_avg_roc_graph", "g_avg_roc_mixed_calc", "g_avg_value_graph", "g_avg_value_intersection_graph", "g_avg_value_mixed_calc", "g_chain_exp_graph_calc", "g_chain_graph_outer_calc", "g_chain_mixed_calc", "g_chain_two_graphs", "g_cont_k_graph_log_calc", "g_cont_k_mixed_calc", "g_cont_removable", "g_context_roc_meaning", "g_count_nondiff", "g_critical_point_graph_formula_calc", "g_critical_point_mixed_calc", "g_direction_changes_count_graph", "g_euler_graph", "g_exp_deriv_mixed_calc", "g_exp_growth_constant", "g_exp_time_graph_calc", "g_exp_value_calc", "g_extrema_count_fprime", "g_extreme_mixed_calc", "g_fprime_inc_concave", "g_fprime_inflection", "g_ftc_chain_graph", "g_ftc_mixed_calc", "g_geometric_series_graph", "g_inflow_outflow_graph", "g_integral_even_function_graph", "g_integral_mixed_calc", "g_integral_piecewise_graph_formula_calc", "g_integral_properties_graph", "g_integral_semicircle", "g_inverse_deriv_graph", "g_ivt_graph", "g_ivt_sum_graph_calc", "g_lagrange_decimal_calc", "g_lagrange_p2_calc", "g_lhopital_graph", "g_lim_jump_sum", "g_linear_combo_two_graphs", "g_linearization_composite_calc", "g_logistic_fastest_graph", "g_mvt_fprime_graph", "g_mvt_sum_graph_formula_calc", "g_net_amount_formula_graph_calc", "g_parallel_tangent_calc", "g_parallel_tangent_formula_calc", "g_param_arclength_graphs_calc", "g_param_dydx_graphs", "g_param_rest_graph", "g_param_speed_graphs", "g_position_graph_speed", "g_prod_deriv_mixed_calc", "g_product_formula_graph_calc", "g_product_two_graphs", "g_quotient_formula_graph_calc", "g_quotient_mixed_calc", "g_quotient_two_graphs", "g_rate_mixed_calc", "g_related_rates_two_graphs", "g_relative_max_graph_formula_calc", "g_riemann_left_graph", "g_riemann_mixed_calc", "g_second_deriv_mixed_calc", "g_separable_graph_calc", "g_speed_increasing", "g_squeeze_graph", "g_tangent_approx_fprime_graph", "g_tangent_line_value_graph", "g_taylor_deriv_graph", "g_total_distance_graph", "g_trapezoid_unequal_graph", "g_usub_graph", "g_vector_displacement_graph", "g_volume_axis_shift_calc", "g_volume_base_graph", "g_volume_curve_line_calc", "g_volume_semicircle_graph", "g_volume_triangle_graph", "g_volume_washer_graph", "g_washer_curve_line_calc"]
R3_FRQ_IDS = ["frq_accum_charge", "frq_arctan_zeros", "frq_closest_point", "frq_cooling_check", "frq_exp_decay_de", "frq_ftc_chain_limit", "frq_inverse_table", "frq_ivp_antiderivative", "frq_limits_continuity", "frq_marginal_profit", "frq_pen_cost", "frq_rational_param", "frq_region_bisect", "frq_trench_volume"]
