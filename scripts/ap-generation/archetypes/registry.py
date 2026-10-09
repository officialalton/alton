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
import calc_graph_a as _ga, calc_graph_b as _gb, calc_graph_c as _gc, calc_graph_d as _gd, calc_graph_e as _ge, calc_graph_f as _gf
GRAPH_MODS = [_ga, _gb, _gc, _gd, _ge, _gf]
GRAPH = {n: (getattr(m, n), "0") for m in GRAPH_MODS for n in dir(m) if n.startswith("g_") and callable(getattr(m, n)) and getattr(getattr(m, n), "__module__", "") == m.__name__}
MC.update(GRAPH)
GRAPH_STAGES = {}  # 단계별 목록(graph_s1_ab, graph_s1_bc …): calc_graph_stages.py 가 채운다
try:
    from calc_graph_stages import STAGES as GRAPH_STAGES
except ImportError:
    pass
FRQ ={"frq_series": bc.frq_series, "frq_parametric": bc.frq_parametric, "frq_euler_logistic": tf.frq_euler_logistic, "frq_table_rate": cf.frq_table_rate, "frq_fprime_graph": cf.frq_fprime_graph, "frq_diffeq": cf.frq_diffeq, "frq_area_volume": cf.frq_area_volume, "frq_bio_investigation": bf.frq_bio_investigation, "frq_bio_data_short": bf.frq_bio_data_short, "frq_particle_motion": rf.frq_particle_motion, "frq_related_rates": rf.frq_related_rates, "frq_implicit_diff": rf.frq_implicit_diff, "frq_micro_monopoly": mf.frq_micro_monopoly, "frq_micro_game": mf.frq_micro_game}

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
        elif which.startswith("graph"): print(json.dumps({"mc": sorted(GRAPH if which == "graph" else [n for n in GRAPH if n in GRAPH_STAGES.get(which, [])]), "frq": []}))
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
            out.append({"id": n, "topic": p["topic"], "skill": p["skill"], "calculator": p["calculator"], "stimulus": "graph", "verifiedBy": [b["verification"]["independent_path"]], "misconceptions": [m["description"] for m in b["misconceptions"]], "bc": b["subject"] == "ap_calculus_bc"})
        print(json.dumps(out, indent=1))
    elif cmd == "all":print(json.dumps({n: batch(n, int(sys.argv[2]), 0) for n in list(MC) + list(FRQ)}))
    elif cmd == "batch": print(json.dumps(batch(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 0)))
