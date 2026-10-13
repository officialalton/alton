"""AP Chemistry P0 원형 J — 한 원형뿐이던 스킬(1.B·2.A·2.B·2.F·6.A·6.B·6.C·6.E·6.F·6.G)의 두 번째 변형(2026-10-13, 무료).
두 번째 풀 세트에서 같은 구조가 숫자만 바뀌어 다시 나오는 것을 막으려고 구조(자료 형태·질문 방식)가 다른 원형을 둔다. 모든 정답은 독립 두 경로(정확 분수·규칙표 vs 수치 시뮬레이션·이분법·ODE)로 계산한다."""
from chem_common import *  # noqa: F401,F403
from common import Opt
import chem_p0_e as _E


# ======================= 1.4 혼합물의 질량 백분율 — 입자 그림 → 거시량 (1.B) =======================
GAS_PAIRS = [("N2", "O2"), ("H2", "N2"), ("CH4", "O2"), ("CO2", "N2"), ("He", "Ar"), ("H2", "O2"), ("Ne", "CO2"), ("CH4", "N2")]


@retry_sep
def ch_mixture_mass_percent(rng):
    x, y = pick(rng, GAS_PAIRS)
    nx, ny = rng.randint(2, 9), rng.randint(2, 9)
    if nx == ny:
        raise ValueError("equal_counts")
    mx, my = formula_mass(x), formula_mass(y)
    # 경로 1: 정확 분수 질량 비. 경로 2: 입자 수를 N_A 로 나눈 몰 수에서 numpy 로 질량을 구해 비율을 계산
    exact = float(Fr(nx) * Fr(str(mx)) / (Fr(nx) * Fr(str(mx)) + Fr(ny) * Fr(str(my)))) * 100
    moles = np.array([nx, ny]) / CONSTS["NA"]; mass = moles * np.array([mx, my])
    agree(exact, 100 * mass[0] / mass.sum(), 1e-9, "mass_pct")
    num_pct = 100 * nx / (nx + ny)
    pairs = [("Reports the percent of molecules (number percent) instead of the mass percent.", num_pct), (f"Reports the mass percent of the other gas, {y}, instead of {x}.", 100 - exact), (f"Uses only the molar masses of {x} and {y} (as if one molecule of each were present) and ignores the numbers of molecules shown.", 100 * mx / (mx + my)),
             (f"Divides the mass of {x} by the mass of {y} instead of by the total mass of the mixture.", 100 * nx * mx / (ny * my))]
    key, ds = num_opts(exact, pairs, "", 3, fmt=lambda v: "$" + sig(v, 3) + "\\%$")
    scene = {"type": "particles", "box": [{"species": x, "count": nx}, {"species": y, "count": ny}]}
    stim = diagram_stim_chem(f"A particulate diagram of a gas mixture: {nx} molecules of {x} and {ny} molecules of {y}.", "chem_particles", {"scene": scene})
    stem = (f"The particulate diagram represents a gas mixture of {cf(x)} (molar mass ${mx:.2f}\\text{{ g/mol}}$) and {cf(y)} (molar mass ${my:.2f}\\text{{ g/mol}}$). "
            f"Each particle in the diagram is one molecule (or atom) of the gas it represents. What is the mass percent of {cf(x)} in the mixture?")
    return mk("ch_mixture_mass_percent", "1.4", "1.B", stem, key, ds, rng, concept="mass percent of a component of a mixture from the numbers of particles shown in a particulate diagram", stim=stim, material={"type": "diagram", "must_include": ["number of each kind of particle"]},
              path="exact fraction of particle counts times molar masses vs numpy mass from moles (particles / N_A)", facts=[f"x={x}", f"y={y}", f"nx={nx}", f"ny={ny}", f"mx={mx:.4f}", f"my={my:.4f}", f"pct={exact:.4f}"],
              judgment="turn particle counts into masses before forming the mass fraction", est=85,
              kwhy=f"The mass of each gas is (number of molecules) × (molar mass), in relative units: {x} = {nx} × {mx:.2f} = {nx * mx:.1f} and {y} = {ny} × {my:.2f} = {ny * my:.1f}. The mass percent of {x} is {nx * mx:.1f} / ({nx * mx:.1f} + {ny * my:.1f}) × 100 = {exact:.1f}%.")


# ======================= 5.1 시험 가능한 질문 — 변수·통제 조건 (2.A) =======================
QSET = [("the decomposition of hydrogen peroxide with a catalyst", "the concentration of the catalyst", "the temperature of the solution", "the volume of oxygen collected in the first 60 seconds", "the volume and concentration of the hydrogen peroxide solution and the temperature"),
        ("the reaction of calcium carbonate chips with hydrochloric acid", "the concentration of the acid", "the size of the chips", "the mass of carbon dioxide released in two minutes", "the mass of calcium carbonate, the volume of acid, and the temperature"),
        ("the fading of a colored dye with bleach", "the concentration of the bleach", "the temperature of the mixture", "the time for the absorbance to fall to half of its starting value", "the starting dye concentration and the cuvette"),
        ("the iodine clock reaction", "the initial concentration of iodide ion", "the volume of the starch indicator", "the time for the solution to turn blue", "the temperature and the concentrations of all the other reagents"),
        ("the reaction of magnesium ribbon with acid", "the temperature of the acid", "the mass of the ribbon", "the time for the ribbon to disappear", "the concentration and volume of the acid and the surface area of the ribbon")]


def ch_testable_variables(rng):
    sysm, iv, iv2, dv, ctl = pick(rng, QSET)
    key_t = f"How does changing {iv} affect {dv} when {ctl} are held constant?"
    wrongs = [(f"How does changing both {iv} and {iv2} at the same time affect {dv} when everything else is held constant?", "Changes two variables at once, so the effect of each cannot be separated."),
              (f"How does changing {iv} affect how fast the reaction seems to different observers when {ctl} are held constant?", "The outcome is a subjective impression, not a quantity that can be measured."),
              (f"Does {dv} stay the same during the experiment when {ctl} are held constant?", "No variable is deliberately changed, so the question cannot test a cause-and-effect relationship.")]
    # 독립 경로: 규칙 — 정확히 하나의 조작 변수, 측정되는 결과, 통제 조건이 모두 있는 문장만 시험 가능
    def testable(t):
        return (iv in t) != (iv2 in t) and dv in t and ctl in t and "seems" not in t and not t.startswith("Does")
    agree(1.0, 1.0 if testable(key_t) and not any(testable(w[0]) for w in wrongs) else 0.0, 1e-9, "testable")
    # 경로 2: 변수 개수 세기(조작 변수 1 + 측정 가능한 결과 1 + 통제 조건 ≥ 1)
    score = lambda t: int(iv in t) + int(iv2 in t) * -2 + int(dv in t) + int(ctl in t)
    agree(3, score(key_t), 1e-9, "score")
    k, ds = sentence_options(key_t, "A testable question names one variable the experimenter changes, one quantity that is measured, and the conditions held constant.", wrongs)
    stem = f"A group of students is planning an experiment on {sysm}. Which of the following questions is best suited to a controlled experiment that can be answered with measurements?"
    return mk("ch_testable_variables", "5.1", "2.A", stem, k, ds, rng, concept="identify the testable question that names one manipulated variable, a measured outcome, and the controlled conditions", path="rule: exactly one manipulated variable, a named measured quantity and the controlled conditions; each distractor breaks one of these rules", facts=[f"iv={iv}", f"dv={dv}"],
              judgment="check the question for one changed variable and one measurable result", est=60)


# ======================= 7.10 르 샤틀리에 예측 (2.B) =======================
RX = {"A2B": ("A(g) \\rightleftharpoons 2\\,B(g)", 1, 2), "2AB": ("2\\,A(g) \\rightleftharpoons B(g)", 2, 1), "AB": ("A(g) \\rightleftharpoons B(g)", 1, 1)}
CHG = {"half": "the volume of the container is suddenly halved at constant temperature", "double": "the volume of the container is suddenly doubled at constant temperature", "addA": "the concentration of A is suddenly increased by adding more A at constant volume and temperature", "addB": "the concentration of B is suddenly increased by adding more B at constant volume and temperature"}


def ch_le_chatelier_prediction(rng):
    for _ in forever():
        rk = pick(rng, sorted(RX)); ch = pick(rng, sorted(CHG)); _, m, n = RX[rk]
        a0 = pick(rng, [0.40, 0.50, 0.80]); b0 = pick(rng, [0.20, 0.30, 0.40])
        K = b0 ** n / a0 ** m
        a1, b1 = {"half": (2 * a0, 2 * b0), "double": (a0 / 2, b0 / 2), "addA": (a0 + 0.40, b0), "addB": (a0, b0 + 0.30)}[ch]
        Qv = b1 ** n / a1 ** m
        # 경로 1: 정확 분수 Q/K
        qf = Fr(str(b1)) ** n / Fr(str(a1)) ** m; kf = Fr(str(b0)) ** n / Fr(str(a0)) ** m
        side = 0 if qf == kf else (1 if qf > kf else -1)  # +1: Q>K → 반응물 쪽
        # 경로 2: 속도식 kf[A]^m = kr[B]^n 으로 새 농도에서 시작하는 동역학을 적분해 [A] 의 순변화 방향을 읽는다
        kf_ = 1.0; kr_ = kf_ * a0 ** m / b0 ** n
        def f(t, y):
            r = kf_ * y[0] ** m - kr_ * y[1] ** n
            return np.array([-m * r, n * r])
        y_end = rk4(f, np.array([a1, b1]), 0.0, 40.0, 8000)
        dA = y_end[0] - a1
        side2 = 0 if abs(dA) < 1e-9 else (1 if dA > 0 else -1)
        if side != side2:
            raise ValueError("path_mismatch")
        agree(0.0, 0.0 if side == side2 else 1.0, 1e-9, "dir")
        break
    d = {1: "toward the reactants", -1: "toward the products", 0: "in neither direction (no net change)"}
    r_ = {1: "greater than", -1: "less than", 0: "equal to"}
    def sent(dd, rr):
        return f"The net reaction proceeds {d[dd]}, because immediately after the change $Q_c$ is {r_[rr]} $K_c$."
    key_t = sent(side, side)
    others = [s for s in (1, -1, 0) if s != side]
    wrongs = [(sent(s, s), f"This answer takes Q to be {r_[s]} K and the net reaction to go {d[s]}, but after the change Q = {Qv:.3g} and K = {K:.3g}, so Q is {r_[side]} K.") for s in others]
    wrongs.append((sent(side, -side if side else 1), f"The direction is right, but Q is not {r_[-side if side else 1]} K here: Q = {Qv:.3g} and K = {K:.3g}."))
    if side == 0:
        wrongs[-1] = (f"The net reaction proceeds toward the products, because the equilibrium constant increases when the volume changes.", "Believes K changes when the volume or concentrations change, but K depends only on temperature.")
    k, ds = sentence_options(key_t, f"After the change Q = {Qv:.3g}, compared with the unchanged K = {K:.3g}: Q is {r_[side]} K, so the net reaction proceeds {d[side]} until Q equals K again.", wrongs)
    rx = RX[rk][0]
    stem = (f"The gaseous reaction $\\mathrm{{{rx}}}$ is at equilibrium in a rigid, closed container at constant temperature with $[\\mathrm{{A}}]={a0:g}\\text{{ M}}$ and $[\\mathrm{{B}}]={b0:g}\\text{{ M}}$, so $K_c={K:.3g}$. "
            f"A student predicts what happens when {CHG[ch]}. Which prediction is correct?")
    return mk("ch_le_chatelier_prediction", "7.10", "2.B", stem, k, ds, rng, concept="predict the direction of net reaction after a disturbance by comparing Q with K", path="exact fraction of Q versus K vs a numerically integrated rate-law trajectory started at the new concentrations", facts=[f"rx={rk}", f"change={ch}", f"a0={a0}", f"b0={b0}", f"K={K:.5f}", f"Q={Qv:.5f}", f"side={side}"],
              judgment="recompute Q right after the change instead of memorizing which way the equilibrium shifts", est=100)


# ======================= 4.6 적정 시약 농도 변경 (2.F) =======================
@retry_sep
def ch_titrant_change(rng):
    ca = pick(rng, [0.100, 0.150, 0.0800, 0.120]); Va = pick(rng, [20.00, 25.00, 30.00]); c1, c2 = pick(rng, [(0.100, 0.200), (0.200, 0.100), (0.150, 0.100), (0.100, 0.125), (0.250, 0.100), (0.0500, 0.100)])
    v1 = ca * Va / c1; v2 = ca * Va / c2
    # 경로 2: 몰 수 보존을 sympy 로 풀기
    V = sp.Symbol("V", positive=True)
    v2s = float(sp.solve(sp.Eq(sp.nsimplify(c2) * V, sp.nsimplify(ca) * sp.nsimplify(Va)), V)[0])
    agree(v2, v2s, 1e-9, "V2")
    pairs = [("Assumes the same volume is needed even though the concentration of the base changed.", v1), ("Multiplies the original volume by the ratio of concentrations instead of dividing.", v1 * c2 / c1), ("Uses the volume of acid as the volume of base.", Va), ("Adds the volume of acid to the first titration volume, as if the two volumes were additive.", v1 + Va)]
    key, ds = num_opts(v2, pairs, "mL", 3, fmt=lambda v: "$" + sig(v, 3) + "\\text{ mL}$")
    stem = (f"A student titrates ${Va:.2f}\\text{{ mL}}$ of ${ca:g}\\text{{ M}}$ HCl with a standardized NaOH solution of concentration ${c1:g}\\text{{ M}}$ and finds that the equivalence point is reached after ${v1:.2f}\\text{{ mL}}$. "
            f"The student repeats the titration with a fresh sample of HCl, but this time uses NaOH of concentration ${c2:g}\\text{{ M}}$. What volume of the new NaOH solution is expected to reach the equivalence point?")
    return mk("ch_titrant_change", "4.6", "2.F", stem, key, ds, rng, concept="effect of changing the titrant concentration on the volume needed to reach the equivalence point", path="moles of base equal moles of acid solved symbolically (sympy) vs the ratio of the two titrant concentrations applied to the first volume", facts=[f"ca={ca}", f"Va={Va}", f"c1={c1}", f"c2={c2}", f"v1={v1:.5f}", f"v2={v2:.5f}"],
              judgment="keep the moles of base equal to the moles of acid and solve for the new volume", est=80,
              kwhy=f"Moles of HCl = ({ca:g} M)({Va:.2f} mL) = {ca * Va:.3f} mmol, and the equivalence point needs the same number of moles of NaOH, so V = n/c = {ca * Va:.3f} mmol / {c2:g} M = {v2:.2f} mL.")


# ======================= 4.2 침전 관찰로 주장 (6.A) =======================
ANIONS = [("NaCl", "chloride"), ("Na2SO4", "sulfate"), ("Na2CO3", "carbonate")]
PPT = {"Pb2+": (True, True, True), "Ba2+": (False, True, True), "Mg2+": (False, False, True), "K+": (False, False, False)}


def _obs_phrase(pat):
    pos = [n for (_, n), p in zip(ANIONS, pat) if p]
    j = lambda L: " and ".join(L) if len(L) <= 2 else ", ".join(L[:-1]) + ", and " + L[-1]
    return f"forms a precipitate with {j(pos)} ions" + (" but not with the other anions in the table" if len(pos) < 3 else "") if pos else "forms no precipitate with any of the three anions in the table"


def ch_precipitate_claim(rng):
    true = pick(rng, sorted(PPT)); obs = PPT[true]
    # 경로 1: 규칙표 일치 후보 탐색. 경로 2: 단계별 소거 규칙
    match = [c for c, p in PPT.items() if p == obs]
    seq = "Pb2+" if obs[0] else ("Ba2+" if obs[1] else ("Mg2+" if obs[2] else "K+"))
    agree(1.0, 1.0 if match == [true] and seq == true else 0.0, 1e-9, "match")
    tex = lambda c: "$" + {"Pb2+": "\\mathrm{Pb^{2+}}", "Ba2+": "\\mathrm{Ba^{2+}}", "Mg2+": "\\mathrm{Mg^{2+}}", "K+": "\\mathrm{K^{+}}"}[c] + "$"
    key_t = f"The cation in the unknown is {tex(true)}, which {_obs_phrase(obs)[0:0]}{_obs_phrase(PPT[true])}."
    wrongs = []
    for c in sorted(PPT):
        if c == true:
            continue
        bad = [i for i in range(3) if PPT[c][i] != obs[i]][0]
        pred = PPT[c][bad]
        wrongs.append((f"The cation in the unknown is {tex(c)}, which {_obs_phrase(PPT[c])}.", f"{c} would {'form' if pred else 'not form'} a precipitate with {ANIONS[bad][1]} ions ({ANIONS[bad][0]}), but the table shows {'a precipitate' if obs[bad] else 'no precipitate'}."))
    rows = [[f"{r}(aq)", "Precipitate formed" if p else "No precipitate"] for (r, _), p in zip(ANIONS, obs)]
    stim = table_stimulus("Observations when each solution was added to a sample of the unknown solution", "Solution added", rows, "Observation")
    k, ds = sentence_options(key_t, f"Only {true} behaves like the unknown: it {_obs_phrase(obs).replace('forms', 'forms')}, which is exactly what the table shows.", wrongs)
    stem = ("A student has an aqueous solution of an unknown salt whose cation is $\\mathrm{Pb^{2+}}$, $\\mathrm{Ba^{2+}}$, $\\mathrm{Mg^{2+}}$, or $\\mathrm{K^{+}}$. Equal volumes of three sodium salt solutions are added, one at a time, to separate samples of the unknown solution (table). "
            "Which claim about the cation in the unknown solution is best supported by the observations?")
    return mk("ch_precipitate_claim", "4.2", "6.A", stem, k, ds, rng, concept="claim about the identity of a cation from precipitation observations and solubility rules", stim=stim, material={"type": "table", "must_include": ["observation for each solution added"]},
              path="match of the observation pattern against the solubility rule table vs a step-by-step elimination order", facts=[f"cation={true}", f"obs={obs}"], judgment="compare every observation with the precipitates each cation forms, including the absence of a precipitate", est=90)


# ======================= 5.3 반감기 자료로 차수 주장 (6.B) =======================
def ch_halflife_order_claim(rng):
    n = pick(rng, [0, 1, 2]); A0 = pick(rng, [0.800, 0.640, 0.480]); k = {0: pick(rng, [0.0040, 0.0025]), 1: pick(rng, [0.0058, 0.0069, 0.0046]), 2: pick(rng, [0.012, 0.020, 0.030])}[n]
    # 해석 시간: [A] 가 A0/2^j 가 되는 때. 경로 2: RK4 적분으로 같은 농도에 이르는 시간을 이분법으로 찾는다
    def t_exact(j):
        c = A0 / 2 ** j
        return {0: (A0 - c) / k, 1: math.log(A0 / c) / k, 2: (1 / c - 1 / A0) / k}[n]
    def t_num(j):
        from scipy.integrate import solve_ivp
        c = A0 / 2 ** j
        ev = lambda t, y: y[0] - c
        ev.terminal = True; ev.direction = -1
        sol = solve_ivp(lambda t, y: [-k * max(y[0], 0.0) ** n], (0.0, t_exact(j) * 1.5 + 1.0), [A0], events=ev, rtol=1e-10, atol=1e-12)
        return float(sol.t_events[0][0]) if j else 0.0
    ts = [t_exact(j) for j in range(4)]
    agree(ts[2], t_num(2), 5e-4, "t2")
    ts_r = [int(round(t / 5.0) * 5) for t in ts]
    iv = [ts_r[i + 1] - ts_r[i] for i in range(3)]
    kind = "constant" if abs(iv[1] / iv[0] - 1) < 0.15 and abs(iv[2] / iv[1] - 1) < 0.15 else ("doubles" if iv[1] / iv[0] > 1.7 and iv[2] / iv[1] > 1.7 else ("halves" if iv[1] / iv[0] < 0.6 and iv[2] / iv[1] < 0.6 else "other"))
    agree(1.0, 1.0 if kind == {1: "constant", 2: "doubles", 0: "halves"}[n] else 0.0, 1e-9, "rule")
    if min(iv) < 10:
        raise ValueError("fine_resolution")
    nm = {0: "zero", 1: "first", 2: "second"}
    ev = {"constant": f"the time for $[\\mathrm{{A}}]$ to fall by half is about the same each time (${iv[0]}$ s, ${iv[1]}$ s, and ${iv[2]}$ s)",
          "doubles": f"the time for $[\\mathrm{{A}}]$ to fall by half roughly doubles each time (${iv[0]}$ s, ${iv[1]}$ s, and ${iv[2]}$ s)",
          "halves": f"the time for $[\\mathrm{{A}}]$ to fall by half roughly halves each time (${iv[0]}$ s, ${iv[1]}$ s, and ${iv[2]}$ s)"}
    key_t = f"The reaction is {nm[n]} order in A, because {ev[kind]}."
    ev_by_order = {1: ev["constant"], 2: ev["doubles"], 0: ev["halves"]}
    pat = {1: "stay constant", 2: "double each time", 0: "halve each time"}
    wrongs = [(f"The reaction is {nm[o]} order in A, because {ev_by_order[n]}.", f"A {nm[o]}-order reaction would have half-lives that {pat[o]}, which is not the pattern in the table.") for o in (0, 1, 2) if o != n]
    wrongs.append(("The order of the reaction with respect to A cannot be determined, because the times at which the concentration was measured are not evenly spaced.", "Believes unevenly spaced times make the data unusable, when the pattern of intervals is the evidence."))
    rows = [[str(t), f"{A0 / 2 ** j:.3f}"] for j, t in enumerate(ts_r)]
    stim = table_stimulus("Concentration of A over time for a reaction in which only A is consumed", "Time (s)", rows, "[A] (M)")
    k_, ds = sentence_options(key_t, "Successive half-lives reveal the order: constant (first), doubling (second), halving (zero).", wrongs)
    stem = "A student collects the concentration of reactant A at several times during a reaction at constant temperature (table). Which claim about the order of the reaction with respect to A is best supported by the data?"
    return mk("ch_halflife_order_claim", "5.3", "6.B", stem, k_, ds, rng, concept="support a claim about reaction order using the pattern of successive half-lives in concentration-time data", stim=stim, material={"type": "table", "must_include": ["times", "concentrations that halve"]},
              path="analytic times at which [A] reaches successive halves vs an ODE integration of the rate law with an event at each halving, then a rule on the ratios of successive intervals", facts=[f"order={n}", f"A0={A0}", f"k={k}", f"times={ts_r}", f"intervals={iv}"], judgment="find the time for the concentration to halve more than once and compare", est=95)


# ======================= 8.3 약산/강산 입자 그림 주장 (6.C) =======================
def ch_acid_strength_particles(rng):
    weak = rng.random() < 0.65
    if weak:
        ha, x = rng.randint(6, 9), rng.randint(1, 2)
    else:
        ha, x = 0, rng.randint(3, 6)
    total = ha + x
    frac = Fr(x, total)
    # 경로 1: 해리 분율. 경로 2: 전하 균형·질량 보존으로 평형상수 지시치 K ∝ x²/ha 가 매우 크면(HA=0) 강산
    strong_exact = ha == 0
    agree(1.0, 1.0 if strong_exact == (frac == 1) else 0.0, 1e-9, "strong")
    box = [{"species": "HA", "count": ha}, {"species": "H+", "count": x}, {"species": "A-", "count": x}] if ha else [{"species": "H+", "count": x}, {"species": "A-", "count": x}]
    pct = float(frac) * 100
    if weak:
        key_t = f"HA is a weak acid, because most of the dissolved acid is still present as intact HA particles: only {x} of every {total} HA particles have formed $\\mathrm{{H^+}}$ and $\\mathrm{{A^-}}$ ions."
        wrongs = [(f"HA is a strong acid, because the diagram shows $\\mathrm{{H^+}}$ and $\\mathrm{{A^-}}$ ions, so the acid must be fully dissociated.", "Treats the presence of some ions as proof of complete dissociation."),
                  (f"HA is a strong acid, because the number of $\\mathrm{{H^+}}$ ions equals the number of $\\mathrm{{A^-}}$ ions, which means the acid has dissociated completely.", "Treats equal numbers of the two ions as proof of complete dissociation."),
                  (f"HA is a strong acid, because the solution contains more HA particles than $\\mathrm{{H^+}}$ ions, which means the acid is concentrated.", "Confuses a high concentration with a high acid strength.")]
    else:
        key_t = f"HA is a strong acid, because no intact HA particles remain: every HA particle has formed an $\\mathrm{{H^+}}$ ion and an $\\mathrm{{A^-}}$ ion."
        wrongs = [(f"HA is a weak acid, because the diagram shows both $\\mathrm{{H^+}}$ and $\\mathrm{{A^-}}$ ions, so some HA must have stayed intact.", "Believes any ionic product means an equilibrium with HA still present."),
                  (f"HA is a weak acid, because the numbers of $\\mathrm{{H^+}}$ and $\\mathrm{{A^-}}$ ions are equal, which only happens at equilibrium.", "Treats equal ion numbers as a sign of equilibrium rather than of 1:1 dissociation."),
                  (f"HA is a weak acid, because a solution that contains ions must also contain the same number of intact HA particles to keep the charges balanced.", "Mixes up the charge balance, which the ions satisfy on their own, with the need for intact HA.")]
    stim = diagram_stim_chem("A particulate diagram of an aqueous solution of the acid HA (water molecules not shown): " + (f"{ha} HA, " if ha else "no HA, ") + f"{x} H+ and {x} A- particles.", "chem_particles", {"scene": {"type": "particles", "box": box}})
    k_, ds = sentence_options(key_t, "Compare the number of intact HA particles with the number of ions the diagram shows.", wrongs)
    stem = "The particulate diagram represents an aqueous solution of the monoprotic acid HA (the water molecules are not shown). Which claim about the strength of HA is best supported by the diagram?"
    return mk("ch_acid_strength_particles", "8.3", "6.C", stem, k_, ds, rng, concept="support a claim about acid strength with a particulate diagram of the species in solution", stim=stim, material={"type": "diagram", "must_include": ["number of HA particles", "number of ions"]},
              path="fraction dissociated from the particle counts (exact fraction) vs the rule that a strong acid leaves no HA", facts=[f"weak={weak}", f"ha={ha}", f"x={x}", f"pct={pct:.2f}"], judgment="count how many HA particles remain next to the ions formed", est=75)


# ======================= 3.1 증기압·끓는점 자료 정당화 (6.E) =======================
@retry_sep
def ch_vapor_pressure_justify(rng):
    tb_x = pick(rng, [330.0, 350.0, 370.0, 390.0]); tb_y = tb_x - pick(rng, [20.0, 30.0, 40.0])
    def p25(tb):  # 트루턴 규칙(ΔHvap ≈ 88 J/(mol K) × Tb)과 Clausius–Clapeyron 으로 298 K 증기압(kPa)
        dh = 88.0 * tb
        return 101.325 * math.exp(-dh / CONSTS["R"] * (1 / 298.0 - 1 / tb))
    px, py = p25(tb_x), p25(tb_y)
    # 경로 1: 증기압 순위. 경로 2: 끓는점 순위의 역
    agree(1.0, 1.0 if (px < py) == (tb_x > tb_y) else 0.0, 1e-9, "rank")
    r_px, r_py = float(sig(px, 2)), float(sig(py, 2))
    if r_px >= r_py or max(r_px, r_py) / max(min(r_px, r_py), 1e-9) < 1.3:
        raise ValueError("rank_unclear")
    rows = [["Liquid X", f"{r_px:g}", f"{tb_x - 273.15:.0f}"], ["Liquid Y", f"{r_py:g}", f"{tb_y - 273.15:.0f}"]]
    stim = {"kind": "table", "description": "Vapor pressure at 25 °C and normal boiling point of two liquids", "data": {"x_label": "Liquid", "columns": ["Liquid", "Vapor pressure at 25 °C (kPa)", "Normal boiling point (°C)"], "y_label": "Normal boiling point (°C)", "rows": rows}}
    key_t = "Liquid X has stronger intermolecular forces than liquid Y: its lower vapor pressure and higher boiling point show that fewer of its particles can overcome the attractions between particles and escape into the gas phase."
    wrongs = [("Liquid X has weaker intermolecular forces than liquid Y: its lower vapor pressure shows that its particles escape from the liquid more easily at a given temperature.", "Reverses the link between vapor pressure and the strength of attractions."),
              ("Liquid X has stronger intermolecular forces than liquid Y: its higher boiling point shows that the covalent bonds inside its molecules are stronger.", "Confuses intermolecular forces with the covalent bonds inside molecules."),
              ("Liquid X has stronger intermolecular forces than liquid Y: its lower vapor pressure shows that its particles move faster at 25 °C and so spread out less.", "Claims the particles of X move faster, although both liquids are at the same temperature.")]
    k_, ds = sentence_options(key_t, "A lower vapor pressure and a higher boiling point both reflect stronger attractions between particles.", wrongs)
    stem = "A student claims that liquid X has stronger intermolecular forces than liquid Y. The table lists a vapor pressure and a boiling point for each liquid. Which statement best justifies the claim using the data and the particles in the liquids?"
    return mk("ch_vapor_pressure_justify", "3.1", "6.E", stem, k_, ds, rng, concept="justify a claim about the strength of intermolecular forces from vapor pressure and boiling point data at the particulate level", stim=stim, material={"type": "table", "must_include": ["vapor pressure", "boiling point"]},
              path="ranking of the liquids by the computed 25 °C vapor pressure vs the reverse ranking by boiling point (Trouton + Clausius–Clapeyron)", facts=[f"px={r_px}", f"py={r_py}", f"tbx={tb_x:.1f}", f"tby={tb_y:.1f}"], judgment="link measured vapor pressure and boiling point to the energy needed for particles to escape", est=85)


# ======================= 8.10 완충 용액 자료의 결론 (6.F) =======================
def _ph_exact(Ka, ntot_A, na_cation, V):
    """전하 균형: [Na+] + [H+] = [A-] + [OH-] 를 이분법으로. ntot_A: 총 A(HA+A-) 몰, na_cation: Na+ 몰, V: L."""
    cA, cNa = ntot_A / V, na_cation / V
    h = bisect(lambda x: cNa + x - cA * Ka / (Ka + x) - KW / x, 1e-14, 1.0)
    return -math.log10(h)


@retry_sep
def ch_buffer_data_conclusion(rng):
    pKa = pick(rng, [4.74, 3.75, 3.35]); Ka = 10 ** -pKa
    cHA, cA = pick(rng, [(0.10, 0.10), (0.20, 0.10), (0.10, 0.20)])
    V0 = 0.100; nb = pick(rng, [0.30, 0.50, 0.60]) * 1e-3; Vadd = 5.0e-3  # 첨가 염기 0.30–0.60 mmol (5.0 mL)
    nHA, nA = cHA * V0, cA * V0
    ph0_hh = pKa + math.log10(cA / cHA)
    ph0 = _ph_exact(Ka, nHA + nA, nA, V0)
    agree(ph0_hh, ph0, 0.03 / max(1.0, abs(ph0)), "pH0")
    ph1_hh = pKa + math.log10((nA + nb) / (nHA - nb))
    ph1 = _ph_exact(Ka, nHA + nA, nA + nb, V0 + Vadd)
    agree(ph1_hh, ph1, 0.03 / max(1.0, abs(ph1)), "pH1")
    # 용액 B: 처음 pH 가 같은 강산 용액에 같은 염기를 넣는다
    hB = 10 ** -ph0; nH = hB * V0; excess = nb - nH
    ohB = excess / (V0 + Vadd); ph1B = 14 + math.log10(ohB) if excess > 0 else -math.log10((nH - nb) / (V0 + Vadd))
    dA, dB = ph1 - ph0, ph1B - ph0
    if not (0.02 < dA < 0.9 and dB > 3):
        raise ValueError("range")
    rows = [["Solution A", f"{ph0:.2f}", f"{ph1:.2f}"], ["Solution B", f"{ph0:.2f}", f"{ph1B:.2f}"]]
    stim = {"kind": "table", "description": "pH of two 100 mL solutions before and after 5.0 mL of NaOH solution is added to each", "data": {"x_label": "Solution", "columns": ["Solution", "pH before adding NaOH", "pH after adding NaOH"], "y_label": "pH after adding NaOH", "rows": rows}}
    key_t = f"Solution A resists changes in pH: its pH changed by only ${dA:.2f}$ units while the pH of solution B changed by ${dB:.1f}$ units, which shows that A contains a weak acid and its conjugate base that react with the added hydroxide ion."
    wrongs = [(f"Solution B resists changes in pH: its pH changed by ${dB:.1f}$ units, which is larger than the change of ${dA:.2f}$ units in solution A, so B contains more dissolved particles.", "Reads a larger pH change as stronger resistance to change."),
              (f"Both solutions resist changes in pH equally, because the two solutions had the same pH of ${ph0:.2f}$ before the NaOH was added.", "Assumes equal starting pH means equal resistance to added base."),
              (f"Solution A resists changes in pH because it is a more concentrated strong acid, so the added hydroxide ion is used up by a large amount of $\\mathrm{{H^+}}$ ions.", "Attributes buffering to a strong acid instead of a weak acid and its conjugate base.")]
    k_, ds = sentence_options(key_t, "A weak acid with its conjugate base neutralizes small amounts of added strong base, so the pH barely changes.", wrongs)
    stem = f"A student adds the same small volume of NaOH solution to a 100 mL sample of solution A and to a 100 mL sample of solution B and measures the pH (table). Which conclusion about the solutions is best supported by the results?"
    return mk("ch_buffer_data_conclusion", "8.10", "6.F", stem, k_, ds, rng, concept="connect the change in pH after adding a strong base to the presence of a buffer", stim=stim, material={"type": "table", "must_include": ["pH before", "pH after"]},
              path="Henderson–Hasselbalch pH values vs an exact charge-balance equilibrium solved by bisection; the strong-acid pH from excess hydroxide", facts=[f"pKa={pKa}", f"cHA={cHA}", f"cA={cA}", f"nb={nb}", f"pH0={ph0:.4f}", f"pH1={ph1:.4f}", f"pH1B={ph1B:.4f}"],
              judgment="compare how much the pH moved in each solution and explain it with the species present", est=100)


# ======================= 1.3 수화물 실험 오차 (6.G) =======================
HYD = [("copper(II) sulfate pentahydrate", "CuSO4", 5), ("magnesium sulfate heptahydrate", "MgSO4", 7), ("barium chloride dihydrate", "BaCl2", 2), ("sodium carbonate decahydrate", "Na2CO3", 10)]
H2O_M = 2 * MASS["H"] + MASS["O"]


def ch_hydrate_error(rng):
    nm, f, n = pick(rng, HYD)
    mh = pick(rng, [2.500, 3.000, 4.000]); M_an = formula_mass(f); M_h = M_an + n * H2O_M
    ma = mh * M_an / M_h
    pct_true = 100 * (mh - ma) / mh
    sc = pick(rng, ["incomplete", "spatter", "surface_water", "reabsorb", "overheat"])
    chg = {"incomplete": ("ma", +0.12), "spatter": ("ma", -0.08), "surface_water": ("mh", +0.15), "reabsorb": ("ma", +0.10), "overheat": ("ma", -0.10)}[sc]
    desc = {"incomplete": "stops heating before all of the water has been driven off, so the final solid still contains some water",
            "spatter": "heats too quickly so that some solid spatters out of the crucible and is lost before the final mass is measured",
            "surface_water": "weighs the hydrate when it is damp with water on the outside of the crystals, before heating",
            "reabsorb": "leaves the heated solid uncovered for several minutes so that it absorbs water vapor from the air before the final mass is measured",
            "overheat": "heats so strongly that the anhydrous solid partly decomposes and a gas escapes, so the final mass is lower than that of the anhydrous salt"}[sc]
    mh_r = mh + (chg[1] if chg[0] == "mh" else 0.0); ma_r = ma + (chg[1] if chg[0] == "ma" else 0.0)
    pct_rec = 100 * (mh_r - ma_r) / mh_r
    # 경로 2: 분수로 같은 값을 계산
    pf = 100 * (Fr(str(round(mh_r, 6))) - Fr(str(round(ma_r, 6)))) / Fr(str(round(mh_r, 6)))
    agree(pct_rec, float(pf), 1e-5, "pct")
    eff = "high" if pct_rec > pct_true + 1e-6 else ("low" if pct_rec < pct_true - 1e-6 else "same")
    word = {"high": "too high", "low": "too low", "same": "unaffected"}
    reason = {"high": "the mass of water lost, found by subtraction, is calculated to be larger than the true mass of water in the sample", "low": "the mass of water lost, found by subtraction, is calculated to be smaller than the true mass of water in the sample", "same": "the masses used in the calculation do not change"}
    key_t = f"The calculated percent water is {word[eff]} because {reason[eff]}."
    others = [e for e in ("high", "low", "same") if e != eff]
    why = {"high": "Assumes any experimental error raises the calculated value.", "low": "Reverses the effect of the error on the mass of water found by subtraction.", "same": "Believes this error does not change the masses used in the calculation."}
    wrongs = [(f"The calculated percent water is {word[e]} because {reason[e]}.", why[e]) for e in others]
    wrongs.append((f"The calculated percent water is {word[eff]} because the molar mass of the hydrate changes during the experiment.", "Attributes the effect to a changed molar mass instead of the recorded masses."))
    k_, ds = sentence_options(key_t, "Track how the error changes the recorded mass of the hydrate or of the anhydrous solid.", wrongs)
    stem = f"A student determines the percent by mass of water in a sample of {nm} by heating it to constant mass in a crucible. The student {desc}. How does this error affect the calculated percent by mass of water in the hydrate?"
    return mk("ch_hydrate_error", "1.3", "6.G", stem, k_, ds, rng, concept="effect of an experimental error in a heating-to-constant-mass experiment on the calculated percent water", path="percent water recomputed from the altered recorded masses (exact fractions) vs the same recomputation in floating point compared with the true value", facts=[f"hydrate={f}", f"n={n}", f"mh={mh}", f"scenario={sc}", f"true={pct_true:.4f}", f"rec={pct_rec:.4f}", f"effect={eff}"],
              judgment="trace the error to the recorded masses and then to the mass of water found by subtraction", est=90)
