import sys, json, random, hashlib
import calc_ab_1 as c1, calc_ab_2 as c2, calc_ab_3 as c3, calc_ab_frq as cf, bio_frq as bf, calc_bc as bc

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
FRQ = {"frq_series": bc.frq_series, "frq_parametric": bc.frq_parametric, "frq_table_rate": cf.frq_table_rate, "frq_fprime_graph": cf.frq_fprime_graph, "frq_diffeq": cf.frq_diffeq, "frq_area_volume": cf.frq_area_volume, "frq_bio_investigation": bf.frq_bio_investigation}

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
        else: print(json.dumps({"mc": [k for k in MC if k not in BCMC], "frq": [k for k in FRQ if k in ("frq_table_rate","frq_fprime_graph","frq_diffeq","frq_area_volume")]}))
    elif cmd == "batch": print(json.dumps(batch(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 0)))
