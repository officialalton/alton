"""AP Chemistry P0 — FRQ 원형 7유형: 긴 문항 3개(각 10점) + 짧은 문항 4개(각 4점) = 46점(CED 시험 구조). 공식 FRQ 는 종이 손글씨이므로 문제·키·채점 행·자기 채점 참고 답안을 만든다.
행 종류(kind): expression · numeric · diagram · graph · claim · justification · design. 정답·수치는 코드(sympy/numpy)가 계산한다.
모범 답안은 'ALTON reference answer for self-review — not official AP scoring' 이다(공식 채점 문구·허용 목록·Example Response 복제 없음).
각 파트에 공식 스킬 코드(skill_codes)를 달아, 6개 Science Practice 가 FRQ 가중 범위(P1 2–4, P2 10–16, P3 8–16, P4 5–9, P5 43–53, P6 15–24 %)를 덮도록 한다(test_chem_p0 의 FRQ 점수 비중 검사)."""
from chem_common import *  # noqa: F401,F403
from common import Opt
from calc_ab_frq import row, part
from bp import frq_blueprint
import chem_p0_a as _A
import chem_p0_e as _E
import chem_p0_b as _B

REF_NOTE = "ALTON reference answer for self-review — not official AP scoring"


def R(rid, kind, crit, req, alt=None, err=None, requires=None, nums=False, units=False):
    r = row(rid, 1, crit, req, None, alt, err, requires, False, nums, None, units)
    r["kind"] = kind
    return r


def _ev(part_, q, v, tol, unit=""):
    return {"part": part_, "quantity": q, "value": float(v), "unit": unit, "tolerance": tol}


def _pack(arch, template, topic, extra, skill, title, stim, parts, total, minutes, facts, expected, bpr_args, judgment):
    assert sum(p["points"] for p in parts) == total and all(r["points"] == 1 for p in parts for r in p["rubric_rows"]), (arch, total)
    pk = {"archetype": arch, "template": template, "topic": topic, "extra_topics": extra, "skill": skill, "representative_skill": skill, "calculator": "allowed", "title": title, "stimulus": stim,
          "parts": parts, "total_points": total, "est_minutes": minutes, "facts": facts, "expected_values": expected, "reference_note": REF_NOTE}
    concept, thinking, conds, material, path_ = bpr_args
    pk["blueprint"] = frq_blueprint(arch, SUB, pk, concept, thinking, conds, material, path_, extra={"judgment_demand": judgment})
    return pk


def _tex(v, n=3):
    return sci(v, "") if (abs(v) < 1e-2 or abs(v) >= 1e4) else "$" + sig(v, n) + "$"


# ======================= 긴 문항 1 (10): 약산 적정 =======================
def chf_long_titration(rng):
    for _ in forever():
        name, Ka = pick(rng, [("HF", 6.8e-4), ("HNO2", 4.5e-4), ("HCOOH", 1.8e-4), ("CH3COOH", 1.8e-5), ("C6H5COOH", 6.3e-5)]); c = pick(rng, [0.100, 0.200]); Va = pick(rng, [20.0, 25.0, 50.0]); cb = pick(rng, [0.100, 0.150, 0.200])
        h = _E._weak_h(Ka, c); hs = _E._weak_h_sym(Ka, c)
        agree(h, hs, 5e-4, "h")
        pH0 = -math.log10(h); n_a = c * Va / 1000; Veq = n_a / cb * 1000
        pKa = -math.log10(Ka)
        cs = n_a / ((Va + Veq) / 1000)
        heq = bisect(lambda x: x + cs - cs * Ka / (Ka + x) - KW / x, 1e-14, 1.0); pH_eq = -math.log10(heq)
        hits = [t for t in _E.INDS if t[1] <= pH_eq <= t[2]]
        if len(hits) == 1:
            break
    ind = hits[0][0]
    stim = {"kind": "text", "description": f"A student titrates ${Va:g}\\text{{ mL}}$ of a ${c:g}\\text{{ M}}$ solution of the weak monoprotic acid {cf(name)} ($K_a=" + sci(Ka, "").strip("$") + f"$ at $25^\\circ\\text{{C}}$) with ${cb:g}\\text{{ M}}$ NaOH. Indicators available: " + "; ".join(f"{n} (pH {lo}–{hi})" for n, lo, hi in _E.INDS) + ".", "data": {}}
    parts = [
        part("A", "Write the equilibrium expression and calculate the pH of the acid solution before any NaOH is added.", 3, "calculate", ["5.B", "5.F"],
             f"$K_a=[\\mathrm{{H_3O^+}}][\\mathrm{{A^-}}]/[\\mathrm{{HA}}]$; with $x=[\\mathrm{{H_3O^+}}]$, $x^2/({c:g}-x)=K_a$ gives $x={h:.3g}\\text{{ M}}$ and $\\mathrm{{pH}}={pH0:.2f}$.",
             [R("A1", "expression", "Writes $K_a=[\\mathrm{H_3O^+}][\\mathrm{A^-}]/[\\mathrm{HA}]$ or the equivalent ICE-table expression", ["Ka = [H3O+][A-]/[HA]"], err=["writes Kw instead of Ka"]),
              R("A2", "numeric", f"Calculates $[\\mathrm{{H_3O^+}}]$ (about {h:.2g} M)", [f"{h:.2g}"], requires="A1", nums=True, err=["assumes complete dissociation"]),
              R("A3", "numeric", f"Reports the pH (about {pH0:.2f})", [f"{pH0:.2f}"], requires="A2", nums=True, err=["gives the pOH"])]),
        part("B", "Calculate the volume of NaOH, in mL, required to reach the equivalence point.", 2, "calculate", ["5.A", "5.F"],
             f"moles of acid ${n_a:.4g}$; $V={Veq:.1f}\\text{{ mL}}$.",
             [R("B1", "numeric", f"Calculates the moles of acid ({n_a:.3g} mol)", [f"{n_a:.3g}"], nums=True, err=["uses mL without converting to L"]),
              R("B2", "numeric", f"Calculates the equivalence volume (about {Veq:.1f} mL) with units", [f"{Veq:.1f}"], requires="B1", nums=True, units=True, err=["uses the acid volume as the base volume"])]),
        part("C", f"Calculate the pH of the solution at the half-equivalence point, and explain how the result is related to the acid.", 2, "calculate", ["5.F", "6.F"],
             f"At half-equivalence $[\\mathrm{{HA}}]=[\\mathrm{{A^-}}]$, so $\\mathrm{{pH}}=\\mathrm{{p}}K_a={pKa:.2f}$.",
             [R("C1", "numeric", f"States pH equals $\\mathrm{{p}}K_a$ ({pKa:.2f}) at half-equivalence", [f"{pKa:.2f}"], nums=True, err=["gives the pH at equivalence"]),
              R("C2", "justification", "Explains that $[\\mathrm{HA}]=[\\mathrm{A^-}]$ there, so $\\log([\\mathrm{A^-}]/[\\mathrm{HA}])=0$ in the Henderson–Hasselbalch equation", ["[HA] = [A-]", "log 1 = 0"], requires="C1", err=["says the acid is neutralized completely"])]),
        part("D", "Select the most appropriate indicator for this titration from the list and justify your choice.", 2, "justify", ["2.C", "6.D"],
             f"{ind}: the pH at equivalence is about {pH_eq:.1f}, inside its color-change range, because the conjugate base of a weak acid makes the equivalence-point solution basic.",
             [R("D1", "claim", f"Selects {ind}", [ind], err=["selects the indicator closest to pH 7"]),
              R("D2", "justification", f"Justifies with the equivalence-point pH (about {pH_eq:.1f}) lying within the indicator range because the solution contains the weak conjugate base", ["equivalence pH above 7", "indicator range includes it"], requires="D1", err=["says equivalence is at pH 7"])]),
        part("E", "The student repeats the titration with the same volume of acid at double the concentration. Does the volume of NaOH needed to reach equivalence change? Justify your answer.", 1, "predict", ["2.B"],
             "Yes, it doubles, because the moles of acid double and the moles of base needed are in a 1:1 ratio.",
             [R("E1", "justification", "States that the equivalence volume doubles because the moles of acid double (1:1 ratio)", ["doubles", "moles of acid double"], err=["says it does not change because Ka is unchanged"])]),
    ]
    return _pack("chf_long_titration", "long", "8.5", ["8.3", "8.9", "4.6"], "5.F", "Titration of a weak acid with a strong base", stim, parts, 10, 23, [f"name={name}", f"Ka={Ka}", f"c={c}", f"Va={Va}", f"cb={cb}", f"pH0={pH0:.4f}", f"Veq={Veq:.3f}", f"pHeq={pH_eq:.3f}"],
                 [_ev("A", "initial pH", pH0, 0.03), _ev("B", "equivalence volume", Veq, 0.5, "mL"), _ev("C", "half-equivalence pH", pKa, 0.03)],
                 ("Weak-acid equilibrium, titration stoichiometry, half-equivalence and indicator choice", ["Set up the weak-acid equilibrium and solve for the hydronium concentration", "Find the equivalence volume from the moles of acid", "Use the half-equivalence point and the equivalence-point pH to answer the later parts"],
                  [("Ka is given at 25 °C and the base is strong", "the stimulus gives Ka, concentrations and volumes")], {"type": "text", "must_include": ["Ka", "concentrations", "volumes", "indicators"]},
                  "sympy quadratic and charge-balance bisection for the pH values; the equivalence pH from the full charge balance selects the unique indicator"), ["law_selection", "justification", "representation_reading"])


# ======================= 긴 문항 2 (10): 열역학·평형·전기화학 =======================
def chf_long_thermo(rng):
    for _ in forever():
        dH = pick(rng, [-92.0, -198.0, 58.0, -57.0, 180.0, -112.0]); dS = pick(rng, [-199.0, -188.0, 176.0, 160.0, -90.0, 130.0]); T = pick(rng, [298.0, 350.0, 500.0])
        if dH * dS > 0:
            break
    dG = dH - T * dS / 1000
    Tx = dH * 1000 / dS
    K = math.exp(-dG * 1000 / (R_J * T))
    a, c = sorted(rng.sample(sorted(_E.REDP), 2), key=lambda s: _E.REDP[s][0])
    E = _E.REDP[c][0] - _E.REDP[a][0]; n = math.lcm(_E.REDP[a][1], _E.REDP[c][1]); dGe = -n * F_CONST * E / 1000
    agree(dG, float(sp.nsimplify(dH) - sp.nsimplify(T) * sp.nsimplify(dS) / 1000), 1e-9, "dG")
    agree(K, float(sp.exp(-sp.nsimplify(dG) * 1000 / (sp.nsimplify(R_J) * sp.nsimplify(T)))), 1e-9, "K")
    fav = "above" if dS > 0 else "below"
    stim = {"kind": "text", "description": f"For a reaction at ${T:g}\\text{{ K}}$: $\\Delta H^\\circ={dH:+g}\\text{{ kJ/mol}}_{{rxn}}$ and $\\Delta S^\\circ={dS:+g}\\text{{ J/(mol}}_{{rxn}}\\cdot\\text{{K)}}$ (both independent of temperature). Part (d) concerns a different system: a galvanic cell with {_E.k_fmt(a)} and {_E.k_fmt(c)} half-cells, with standard reduction potentials ${_E.REDP[a][0]:+.2f}\\text{{ V}}$ and ${_E.REDP[c][0]:+.2f}\\text{{ V}}$ respectively.", "data": {}}
    parts = [
        part("A", f"Calculate $\\Delta G^\\circ$, in kJ/mol, for the reaction at ${T:g}\\text{{ K}}$.", 2, "calculate", ["5.F"], f"$\\Delta G^\\circ=\\Delta H^\\circ-T\\Delta S^\\circ={dG:.1f}\\text{{ kJ/mol}}$.",
             [R("A1", "expression", "Uses $\\Delta G^\\circ=\\Delta H^\\circ-T\\Delta S^\\circ$ with entropy converted to kJ", ["ΔG = ΔH − TΔS", "J to kJ"], err=["omits the unit conversion"]),
              R("A2", "numeric", f"Calculates $\\Delta G^\\circ$ (about {dG:.1f} kJ/mol) with units", [f"{dG:.1f}"], requires="A1", nums=True, units=True, err=["uses a Celsius temperature"])]),
        part("B", f"Determine the temperature at which the reaction changes between thermodynamically favorable and unfavorable, and state whether the reaction is favorable above or below that temperature. Justify your answer.", 3, "determine", ["5.B", "6.D"],
             f"$\\Delta G^\\circ=0$ at $T=\\Delta H^\\circ/\\Delta S^\\circ={Tx:.0f}\\text{{ K}}$; the reaction is favorable {fav} this temperature because $\\Delta S^\\circ$ is {'positive' if dS > 0 else 'negative'}.",
             [R("B1", "expression", "Sets $\\Delta G^\\circ=0$ and solves $T=\\Delta H^\\circ/\\Delta S^\\circ$", ["ΔG = 0", "T = ΔH/ΔS"], err=["divides ΔS by ΔH"]),
              R("B2", "numeric", f"Calculates the temperature (about {Tx:.0f} K)", [f"{Tx:.0f}"], requires="B1", nums=True, units=True, err=["leaves ΔH in kJ"]),
              R("B3", "justification", f"States the reaction is favorable {fav} that temperature, citing the sign of $\\Delta S^\\circ$ in $\\Delta G^\\circ=\\Delta H^\\circ-T\\Delta S^\\circ$", [fav, "sign of ΔS"], requires="B2", err=["links favorability to the sign of ΔH alone"])]),
        part("C", f"Calculate the equilibrium constant, $K$, at ${T:g}\\text{{ K}}$.", 2, "calculate", ["5.B", "5.F"], f"$K=e^{{-\\Delta G^\\circ/RT}}\\approx {K:.2g}$.",
             [R("C1", "expression", "Uses $\\Delta G^\\circ=-RT\\ln K$ with R in J/(mol·K) and ΔG° in joules", ["ΔG = −RT ln K"], err=["uses kJ with R in J"]),
              R("C2", "numeric", f"Calculates $K$ (about {K:.2g})", [f"{K:.2g}"], requires="C1", nums=True, err=["omits the negative sign"])]),
        part("D", "On a diagram of the galvanic cell, label the anode and the direction of electron flow, and calculate the standard cell potential.", 2, "calculate", ["3.B", "5.F"], f"The anode is the half-cell with the less positive reduction potential ({a}); $E^\\circ_{{cell}}={E:.2f}\\text{{ V}}$.",
             [R("D1", "diagram", f"Labels the {a} half-cell as the anode (more negative reduction potential, where oxidation occurs) and electrons flowing from the anode through the wire to the cathode", [a, "anode"], err=["identifies the more positive half-cell as the anode"]),
              R("D2", "numeric", f"Calculates $E^\\circ_{{cell}}={E:.2f}\\text{{ V}}$ (cathode minus anode)", [f"{E:.2f}"], requires="D1", nums=True, units=True, err=["adds the potentials"])]),
        part("E", f"Calculate $\\Delta G^\\circ$ for the cell reaction, if {n} moles of electrons are transferred per mole of reaction, and state what the sign of the result indicates.", 1, "calculate", ["5.F", "6.D"], f"$\\Delta G^\\circ=-nFE^\\circ={dGe:.0f}\\text{{ kJ/mol}}$; the negative value shows the cell reaction is thermodynamically favorable.",
             [R("E1", "numeric", f"Calculates $\\Delta G^\\circ$ (about {dGe:.0f} kJ/mol) and states that the negative sign means favorable", [f"{dGe:.0f}", "favorable"], nums=True, err=["omits the number of electrons"])]),
    ]
    return _pack("chf_long_thermo", "long", "9.3", ["9.5", "9.9"], "5.F", "Free energy, equilibrium and a galvanic cell", stim, parts, 10, 23, [f"dH={dH}", f"dS={dS}", f"T={T}", f"dG={dG:.4f}", f"K={K:.6e}", f"E={E:.4f}", f"n={n}", f"dGe={dGe:.3f}"],
                 [_ev("A", "dG", dG, 0.2, "kJ/mol"), _ev("B", "crossover T", abs(Tx), max(5, 0.01 * abs(Tx)), "K"), _ev("D", "E cell", E, 0.01, "V"), _ev("E", "dG cell", dGe, 0.01 * abs(dGe) + 1, "kJ/mol")],
                 ("ΔG° from ΔH° and ΔS°, K from ΔG°, and a galvanic cell with ΔG° = −nFE°", ["Compute the free energy change with consistent energy units", "Locate the crossover temperature where the free energy change is zero", "Link the equilibrium constant and the cell potential to the free energy change"],
                  [("data are temperature independent", "the stimulus states it")], {"type": "text", "must_include": ["ΔH", "ΔS", "T", "reduction potentials"]},
                  "sympy exact ΔG, K and ΔG° = −nFE°; bisection on ΔG(T) recomputes the crossover temperature"), ["law_selection", "justification", "representation_reading"])


# ======================= 긴 문항 3 (10): 속도론 자료 =======================
def chf_long_kinetics(rng):
    for _ in forever():
        order = pick(rng, [1, 1, 2]); k = {1: pick(rng, [0.0090, 0.0120, 0.0150]), 2: pick(rng, [0.040, 0.060, 0.080])}[order]; A0 = pick(rng, [0.800, 1.00])
        ts = [0, 30, 60, 90, 120, 150]
        f = (lambda t: A0 * math.exp(-k * t)) if order == 1 else (lambda t: 1 / (1 / A0 + k * t))
        As = [round(f(t), 4) for t in ts]
        tr = {0: lambda a: a, 1: lambda a: math.log(a), 2: lambda a: 1 / a}
        r2 = {}
        for o in (0, 1, 2):
            ys = [tr[o](a) for a in As]; s, b = np.polyfit(ts, ys, 1); res = np.array(ys) - (s * np.array(ts) + b); r2[o] = 1 - float(res @ res) / float(np.var(ys) * len(ys))
        if max(r2, key=r2.get) == order and all(a > 0.03 for a in As):
            break
    slope = abs(np.polyfit(ts, [tr[order](a) for a in As], 1)[0])
    t_half = math.log(2) / k if order == 1 else 1 / (k * A0)
    kun = "\\text{ s}^{-1}" if order == 1 else "\\text{ M}^{-1}\\text{s}^{-1}"
    plot = "ln[A] versus t" if order == 1 else "1/[A] versus t"
    rows = [[str(t), f"{a:.4f}"] for t, a in zip(ts, As)]
    stim = {"kind": "table", "description": "Concentration of A in the reaction A → products at 310 K", "data": {"x_label": "Time (s)", "y_label": "[A] (M)", "rows": rows}}
    parts = [
        part("A", "Determine the order of the reaction with respect to A. Describe the plot you would make and what it would show to support your conclusion.", 3, "determine", ["3.A", "6.B"],
             f"The reaction is {'first' if order == 1 else 'second'} order: a plot of {plot} is a straight line (the other linearized plots curve).",
             [R("A1", "diagram", f"Describes making the plot of {plot} (and checks at least one other linearization)", [plot], err=["plots [A] versus t only"]),
              R("A2", "claim", f"Concludes the reaction is {'first' if order == 1 else 'second'} order", ["first order" if order == 1 else "second order"], requires="A1", err=["picks the order whose plot is curved"]),
              R("A3", "justification", "Supports the claim with the linearity of that plot and the curvature of the others", ["linear", "curved"], requires="A2", err=["cites the decrease of [A] only"])]),
        part("B", "Calculate the rate constant, $k$, with units.", 2, "calculate", ["5.D", "5.F"], f"$k=|\\text{{slope}}|\\approx {slope:.3g}{kun}$.",
             [R("B1", "numeric", f"Obtains $k$ (about {slope:.2g}) from the slope magnitude of the linear plot", [f"{slope:.2g}"], nums=True, err=["uses a slope from the curved plot"]),
              R("B2", "numeric", f"Gives the correct units for k (${kun.replace(chr(92) + 'text', '').replace('{', '').replace('}', '')}$ form)", ["units"], requires="B1", units=True, err=["gives units of a first-order constant for a second-order reaction"])]),
        part("C", "Calculate the half-life of the reaction for the initial concentration shown.", 2, "calculate", ["5.B", "5.F"], f"$t_{{1/2}}={t_half:.0f}\\text{{ s}}$ ({'$0.693/k$' if order == 1 else '$1/(k[\\mathrm{A}]_0)$'}).",
             [R("C1", "expression", "Uses the half-life relation for the identified order", ["0.693/k" if order == 1 else "1/(k[A]0)"], err=["uses the first-order relation for a second-order reaction"] if order == 2 else ["uses the second-order relation"]),
              R("C2", "numeric", f"Calculates the half-life (about {t_half:.0f} s)", [f"{t_half:.0f}"], requires="C1", nums=True, units=True, err=["divides instead of multiplying"])]),
        part("D", "The experiment is repeated at a higher temperature. Predict whether $k$ increases, decreases, or is unchanged, and justify your answer using the collision model.", 2, "predict", ["2.B", "2.F", "6.E"], "$k$ increases: at the higher temperature a larger fraction of collisions has energy at least equal to the activation energy.",
             [R("D1", "claim", "States that $k$ increases", ["increases"], err=["states k decreases because particles collide more often"]),
              R("D2", "justification", "Justifies with a larger fraction of collisions exceeding the activation energy (and more frequent collisions)", ["fraction of collisions", "activation energy"], requires="D1", err=["says the activation energy decreases"])]),
        part("E", "A student proposes that the reaction occurs in one elementary step. Is this consistent with the order you determined? Explain.", 1, "explain", ["4.B"], f"A one-step mechanism with one molecule of A would be first order; it is {'consistent' if order == 1 else 'not consistent'} with the data because the determined order is {order}.",
             [R("E1", "justification", f"States the proposal is {'consistent' if order == 1 else 'not consistent'} and links the molecularity of the elementary step to the order of {order}", ["consistent" if order == 1 else "not consistent", "molecularity"], err=["ignores the order found in part A"])]),
    ]
    return _pack("chf_long_kinetics", "long", "5.3", ["5.2", "5.5", "5.7"], "5.D", "Concentration–time data and the order of a reaction", stim, parts, 10, 23, [f"order={order}", f"k={k}", f"A0={A0}", f"slope={slope:.6g}", f"t_half={t_half:.4f}"],
                 [_ev("B", "rate constant", slope, 0.03 * slope, "units"), _ev("C", "half-life", t_half, 0.04 * t_half, "s")],
                 ("Linearize concentration–time data to find the order and rate constant; link order, half-life, temperature and mechanism", ["Compare the three linearized plots for straightness", "Read the rate constant from the slope of the straight plot", "Relate temperature to the fraction of energetic collisions"],
                  [("the data come from a single reactant at constant temperature", "the stimulus")], {"type": "table", "must_include": ["time", "concentration"]},
                  "R^2 of three linearizations by polyfit selects the order and the slope magnitude gives k; the half-life is computed from the order-specific relation"), ["representation_reading", "law_selection", "justification"])


# ======================= 짧은 문항 1 (4): PES =======================
def chf_short_pes(rng):
    for _ in forever():
        z = rng.randint(6, 16); peaks = _A._pes_peaks(z); es = [p[0] for p in peaks]
        if all(es[i] > es[i + 1] * 1.08 for i in range(len(es) - 1)):
            break
    sym = _A.SYM[z]; nxt = _A.SYM[z + 1]
    cfg = " ".join(f"{p[2]}$^{{{p[1]}}}$" for p in peaks)
    cfg_n = _A._config(z + 1); val_next = [p for p in _A._pes_peaks(z + 1)][-2:] if len(cfg_n) > 2 else _A._pes_peaks(z + 1)
    stim = {"kind": "diagram", "description": "Photoelectron spectrum of a neutral atom of element X. Peaks (binding energy in MJ/mol, relative number of electrons): " + "; ".join(f"({e:g}, {k})" for e, k, _ in peaks) + ".", "data": {"variant": "chem_pes", "peaks": [{"energy": e, "electrons": k} for e, k, _ in peaks], "unit": "MJ/mol", "z": z}}
    ie1 = peaks[-1][0]
    parts = [
        part("A", "Identify element X and write its complete ground-state electron configuration.", 1, "identify", ["1.A", "5.D"], f"The total relative number of electrons is {z}, so X is {sym}: {cfg}.",
             [R("A1", "claim", f"Identifies X as {sym} with the configuration {cfg} (electron total {z})", [sym, cfg], err=["counts peaks instead of electrons"])]),
        part("B", "Explain why the peak at the highest binding energy corresponds to the electrons in the 1s subshell, using Coulomb's law.", 1, "explain", ["6.D", "4.A"], "The 1s electrons are closest to the nucleus, so the attraction is greatest (Coulomb's law: larger force at a smaller distance), so they need the most energy to remove.",
             [R("B1", "justification", "Cites the smaller distance from the nucleus and the larger Coulombic attraction", ["closest to the nucleus", "Coulomb's law"], err=["says 1s electrons are shielded the most"])]),
        part("C", f"On the axes of the spectrum, sketch the peak(s) for the valence electrons of {nxt}, which has one more proton than X. State whether they appear at a higher or lower binding energy than the valence peak of X, and justify.", 1, "draw", ["3.A"],
             f"The valence peak of {nxt} is at a slightly higher binding energy than that of X because the greater nuclear charge acts on electrons in the same shell with little added shielding.",
             [R("C1", "graph", f"Draws the valence peak(s) of {nxt} at a higher binding energy than X's valence peak, with a justification based on the larger nuclear charge", ["higher binding energy", "greater nuclear charge"], err=["draws the peak at a lower energy"])]),
        part("D", f"Is the first ionization energy of {nxt} expected to be larger or smaller than that of X? Explain using the spectrum.", 1, "explain", ["4.C", "6.E"],
             "Generally larger (a larger effective nuclear charge in the same shell), unless the next element's electron is placed in a new subshell or paired, in which case it is smaller; use the configuration to decide.",
             [R("D1", "justification", "Compares the valence-peak energies of X and the next element and states the relation to the first ionization energy, noting the exception when the electron enters a new subshell or is paired", ["valence peak energy", "ionization energy"], err=["states the ionization energy is the energy of the 1s peak"])]),
    ]
    return _pack("chf_short_pes", "short", "1.6", ["1.5", "1.7"], "1.A", "Photoelectron spectrum of an element", stim, parts, 4, 9, [f"z={z}", f"peaks={[(p[0], p[1]) for p in peaks]}"], [],
                 ("Identify an element from a photoelectron spectrum and compare it with the next element", ["Add the relative peak heights to find the atomic number", "Use Coulomb's law to explain the peak positions", "Compare the valence peaks of neighboring elements"],
                  [("relative peak height equals the number of electrons", "the stimulus")], {"type": "diagram", "must_include": ["peak energies", "relative heights"]}, "configuration from two independent filling orders; the electron total of the peaks equals Z"), ["representation_reading", "justification"])


# ======================= 짧은 문항 2 (4): 연소 화학량론과 기체 =======================
def chf_short_stoich(rng):
    for _ in forever():
        x = rng.randint(2, 4); y = pick(rng, [2 * x + 2, 2 * x + 2, 2 * x]); m = pick(rng, [10.0, 20.0, 25.0, 50.0]); Tc = pick(rng, [25, 100, 127]); P = pick(rng, [1.00, 0.95, 1.20])
        if y % 2 == 0:
            break
    form = f"C{x}H{y}"
    M = formula_mass(form); n = m / M; nco2 = n * x; T = Tc + 273.15
    V = nco2 * R_ATM * T / P
    b = x + y / 4
    agree(V, bisect(lambda v: P * v - nco2 * R_ATM * T, 1e-6, 1e5), 1e-6, "V")
    stim = {"kind": "text", "description": f"A ${m:g}\\text{{ g}}$ sample of {cf(form)} is burned completely in excess oxygen, producing $\\mathrm{{CO_2}}(g)$ and $\\mathrm{{H_2O}}(g)$.", "data": {}}
    parts = [
        part("A", f"Write the balanced equation for the complete combustion of {cf(form)}, using the smallest whole-number coefficients.", 1, "write", ["5.E"], f"With whole numbers: coefficient of $\\mathrm{{O_2}}$ scales from ${b:g}$ (multiply by 2 if needed to clear fractions).",
             [R("A1", "expression", f"Balanced equation for {form} + O2 → CO2 + H2O with whole numbers (CO2: {x}·k, H2O: {y // 2}·k, O2: {b:g}·k)", ["balanced", "whole numbers"], err=["leaves a fractional coefficient"])]),
        part("B", f"Calculate the number of moles of {cf('CO2')} produced.", 1, "calculate", ["5.F"], f"$n(\\mathrm{{CO_2}})={x}\\times{m:g}/{M:.2f}={nco2:.3g}\\text{{ mol}}$.",
             [R("B1", "numeric", f"Calculates {nco2:.3g} mol using the molar mass of the fuel and the {x}:1 mole ratio", [f"{nco2:.3g}"], nums=True, err=["omits the mole ratio"])]),
        part("C", f"Calculate the volume, in L, occupied by the {cf('CO2')} at ${Tc}\\,^{{\\circ}}\\text{{C}}$ and ${P:g}\\text{{ atm}}$.", 1, "calculate", ["5.B", "5.F"], f"$V=nRT/P={V:.1f}\\text{{ L}}$.",
             [R("C1", "numeric", f"Calculates the volume (about {V:.1f} L) using kelvins and consistent R", [f"{V:.1f}"], nums=True, units=True, err=["uses the Celsius temperature"])]),
        part("D", "A student claims that this combustion is an oxidation–reduction reaction. Justify the claim using oxidation numbers of one element.", 1, "justify", ["6.D"], "Oxygen goes from 0 in $\\mathrm{O_2}$ to −2 in the products (reduced), and carbon's oxidation number increases (oxidized).",
             [R("D1", "justification", "Gives oxidation numbers before and after for oxygen (0 to −2) or carbon (increase) showing electron transfer", ["0 to −2", "oxidation numbers"], err=["says redox requires a metal"])]),
    ]
    return _pack("chf_short_stoich", "short", "4.5", ["4.3", "3.4", "4.9"], "5.F", "Combustion stoichiometry and gas volume", stim, parts, 4, 9, [f"x={x}", f"y={y}", f"m={m}", f"M={M:.4f}", f"nco2={nco2:.5f}", f"V={V:.4f}", f"Tc={Tc}", f"P={P}"],
                 [_ev("B", "moles CO2", nco2, 0.01 * nco2 + 0.002, "mol"), _ev("C", "volume", V, 0.02 * V + 0.1, "L")],
                 ("Combustion stoichiometry, ideal gas volume, and an oxidation-number justification", ["Balance the combustion equation with whole numbers", "Use the mole ratio to find the moles of carbon dioxide", "Apply the ideal gas law with a temperature in kelvins"], [("oxygen is in excess", "the stimulus")], {"type": "text", "must_include": ["mass", "conditions"]},
                  "sympy balance by linear system; the gas volume is recomputed by bisection on P V - nRT"), ["law_selection", "justification"])


# ======================= 짧은 문항 3 (4): 결합과 분자 간 힘 =======================
def chf_short_bonding(rng):
    f, V, sg, lp = pick(rng, [s for s in _A.SPECIES if s[0] in ("SO2", "NH3", "ClF3", "XeF4", "H2O", "SF4", "CH4")])
    dom = sg + lp; shape, ang = _A.VSEPR[(dom, lp)]
    hi, lo = pick(rng, [("H2O", "H2S"), ("CH3OH", "C2H6"), ("HF", "HCl"), ("NH3", "PH3"), ("C2H5OH", "CH3OCH3")])
    agree(1.0, 1.0 if _B.BP[hi][1] > _B.BP[lo][1] else 0.0, 1e-9, "bp")
    polar = {"SO2": True, "NH3": True, "H2O": True, "ClF3": True, "SF4": True, "XeF4": False, "CH4": False}[f]
    stim = {"kind": "text", "description": f"Consider the molecule {cf(f)} and the two compounds {cf(hi)} and {cf(lo)}.", "data": {}}
    parts = [
        part("A", f"In the box provided, draw a Lewis electron-dot diagram of {cf(f)} that shows all valence electrons.", 1, "draw", ["3.B"], f"A valid diagram with {V} valence electrons on the central atom group and {sg} bonded atoms and {lp} lone pair(s) on the central atom.",
             [R("A1", "diagram", f"Draws a Lewis structure with the correct total valence electrons, {sg} bonds to the central atom and {lp} lone pair(s) on it", ["valence electrons", "lone pairs"], err=["omits the lone pairs on the central atom"])]),
        part("B", f"Based on your diagram, identify the molecular geometry of {cf(f)} and the approximate bond angle.", 1, "identify", ["4.A", "1.A"], f"{shape}; about {ang}° ({'less than the ideal value because of lone pairs' if lp else 'the ideal value'}).",
             [R("B1", "claim", f"States {shape} geometry and a bond angle close to {ang}°", [shape, f"{ang}"], err=["reports the electron-domain geometry"])]),
        part("C", f"Is the {cf(f)} molecule polar or nonpolar? Justify your answer.", 1, "justify", ["6.C", "4.C"], f"{'Polar' if polar else 'Nonpolar'}: the bond dipoles {'do not cancel because of the lone pair or shape' if polar else 'cancel by symmetry'}.",
             [R("C1", "justification", f"States {'polar' if polar else 'nonpolar'} and links it to {'an asymmetric shape' if polar else 'symmetric cancellation of the bond dipoles'}", ["polar" if polar else "nonpolar", "symmetry"], err=["decides by bond polarity alone"])]),
        part("D", f"The boiling point of {cf(hi)} is higher than that of {cf(lo)}. Explain the difference in terms of intermolecular forces.", 1, "explain", ["6.E", "4.C"], "The compound with the higher boiling point has the stronger intermolecular forces (hydrogen bonding or stronger dispersion/dipole attractions), which need more energy to overcome.",
             [R("D1", "justification", f"Names the stronger intermolecular force of {hi} (hydrogen bonding where an N–H, O–H, or F–H bond is present, otherwise stronger dispersion) as the reason", ["hydrogen bonding" if _B.BP[hi][0] == "H" else "dispersion forces"], err=["says covalent bonds break on boiling"])]),
    ]
    return _pack("chf_short_bonding", "short", "2.7", ["2.5", "3.1"], "4.A", "Lewis structure, geometry and boiling points", stim, parts, 4, 9, [f"species={f}", f"hi={hi}", f"lo={lo}", f"shape={shape}"], [],
                 ("Lewis structure, VSEPR geometry, polarity, and intermolecular forces", ["Draw the structure with every valence electron", "Use VSEPR to find the geometry and the angle", "Relate the type of intermolecular force to the boiling point"], [("standard valence-electron rules apply", "the stimulus names the species")], {"type": "text", "must_include": ["species", "boiling-point comparison"]},
                  "geometry from two independent rules (table by domains and lone pairs vs valence-electron count); boiling points from a tabulated pair"), ["representation_reading", "justification"])


# ======================= 짧은 문항 4 (4): 평형 =======================
def chf_short_equilibrium(rng):
    for _ in forever():
        K = pick(rng, [0.20, 0.50, 2.0]); A0 = pick(rng, [0.50, 1.0]); B0 = pick(rng, [0.10, 0.30])
        Q = B0 ** 2 / A0
        if abs(Q / K - 1) > 0.25:
            break
    exo = rng.random() < 0.5
    right = Q < K
    stim = {"kind": "text", "description": f"At a certain temperature the equilibrium $\\mathrm{{A}}(g) \\rightleftharpoons 2\\,\\mathrm{{B}}(g)$ has $K_c={K:g}$ and is {'exothermic' if exo else 'endothermic'}. A rigid flask initially contains $[\\mathrm{{A}}]={A0:g}\\text{{ M}}$ and $[\\mathrm{{B}}]={B0:g}\\text{{ M}}$.", "data": {}}
    parts = [
        part("A", "Write the equilibrium-constant expression, $K_c$, for the reaction.", 1, "write", ["5.B"], "$K_c=[\\mathrm{B}]^2/[\\mathrm{A}]$.",
             [R("A1", "expression", "Writes $[\\mathrm{B}]^2/[\\mathrm{A}]$ (products over reactant, with the coefficient as an exponent)", ["[B]^2/[A]"], err=["omits the exponent 2"])]),
        part("B", "Calculate the reaction quotient, $Q$, for the initial mixture and determine the direction in which the reaction proceeds.", 1, "determine", ["5.F", "6.D"], f"$Q={Q:.3g}$, which is {'less' if right else 'greater'} than $K_c$, so the reaction proceeds {'toward the products' if right else 'toward the reactant'}.",
             [R("B1", "numeric", f"Calculates $Q\\approx {Q:.3g}$ and states the direction as {'forward' if right else 'reverse'} by comparing Q with K", [f"{Q:.3g}", "forward" if right else "reverse"], nums=True, err=["reverses the comparison of Q and K"])]),
        part("C", "The volume of the flask is doubled at constant temperature after the system reaches equilibrium. Predict the direction of the shift and justify.", 1, "predict", ["2.B"], "The system shifts toward the products because the side with more moles of gas is favored at lower pressure ($Q<K$ right after the expansion).",
             [R("C1", "justification", "States the shift toward the products with the argument that expansion lowers the pressure and favors more moles of gas (Q becomes less than K)", ["toward products", "more moles of gas"], err=["says K changes with volume"])]),
        part("D", f"The temperature is increased. Does the value of $K_c$ increase or decrease? Justify using the sign of the enthalpy change.", 1, "predict", ["2.B", "6.F"], f"$K_c$ {'decreases' if exo else 'increases'}: for an {'exothermic' if exo else 'endothermic'} reaction, heat acts as a {'product' if exo else 'reactant'}, so raising the temperature favors the {'reactants' if exo else 'products'}.",
             [R("D1", "justification", f"States that $K_c$ {'decreases' if exo else 'increases'} because heat behaves as a {'product' if exo else 'reactant'} in an {'exothermic' if exo else 'endothermic'} reaction", ["decreases" if exo else "increases", "heat as product" if exo else "heat as reactant"], err=["says K does not depend on temperature"])]),
    ]
    return _pack("chf_short_equilibrium", "short", "7.3", ["7.2", "7.9", "7.10"], "6.D", "Equilibrium expression, Q versus K and disturbances", stim, parts, 4, 9, [f"K={K}", f"A0={A0}", f"B0={B0}", f"Q={Q:.6f}", f"exo={exo}"], [_ev("B", "reaction quotient", Q, 0.02 * Q + 0.005, "")],
                 ("Equilibrium expression, reaction quotient, and Le Chatelier with temperature dependence of K", ["Write the equilibrium expression from the balanced equation", "Compare the reaction quotient with the equilibrium constant", "Reason about the effect of volume and temperature changes"], [("the reaction is gas-phase in a rigid flask", "the stimulus")], {"type": "text", "must_include": ["K", "initial concentrations", "enthalpy sign"]},
                  "Q computed exactly and compared with K by the sign of ln(Q/K); the volume-change direction follows from recomputing Q after the change"), ["law_selection", "justification"])
