"""AP Precalculus FRQ 원형 — 공식 4유형 × 시나리오(Function Concepts / Modeling a Non-Periodic Context / Modeling a Periodic Context / Symbolic Manipulations, 각 6점).
유형 1·2 는 그래핑 계산기 필수(파트 A), 유형 3·4 는 계산기 불가(파트 B). 공식 FRQ 는 종이 손글씨이므로 이 원형은 문제·키·채점 행·자기 채점 참고 답안을 만든다.
모든 정답·수치는 코드(sympy·numpy·scipy)가 두 경로로 계산한다. 모범 답안은 'ALTON reference answer for self-review — not official AP scoring' 이다. 문항별 6점 배점은 CED 의 FRQ 점수 구조를 따른 값이다."""
from pre_common import *
from pre_common import _O
from calc_ab_frq import row, part
from pre_p0_b import _fit_exact

PI = sp.pi

REF_NOTE = "ALTON reference answer for self-review — not official AP scoring"

STAGE_FRQ = ["pref_fc_polynomial_depth", "pref_fc_inverse_exp", "pref_fc_rational_concentration", "pref_mn_exponential_users", "pref_mn_log_growth", "pref_mn_cubic_data",
             "pref_mp_ferris_wheel", "pref_mp_tide_depth", "pref_mp_daylight", "pref_sy_exp_log", "pref_sy_rational", "pref_sy_trig"]


def R(rid, crit, req, alt=None, err=None, requires=None, nums=False, units=False, tol=None):
    return row(rid, 1, crit, req, None, alt, err, requires, False, nums, tol, units)


def _ev(part_, q, v, tol, unit=""):
    return {"part": part_, "quantity": q, "value": float(v), "unit": unit, "tolerance": tol}


def _pack(arch, template, topic, extra, skill, calc, title, stim, parts, minutes, facts, expected, bpr_args, judgment):
    assert sum(p["points"] for p in parts) == 6 and all(r["points"] == 1 for p in parts for r in p["rubric_rows"]), (arch, [p["points"] for p in parts])
    pk = {"archetype": arch, "template": template, "topic": topic, "extra_topics": extra, "skill": skill, "representative_skill": skill, "calculator": calc, "title": title, "stimulus": stim,
          "parts": parts, "total_points": 6, "est_minutes": minutes, "facts": facts, "expected_values": expected, "reference_note": REF_NOTE}
    concept, thinking, conds, material, path_ = bpr_args
    pk["blueprint"] = frq_blueprint(arch, SUBP, pk, concept, thinking, conds, material, path_, extra={"judgment_demand": judgment})
    return pk


def _txt(desc):
    return {"kind": "text", "description": desc, "data": {}}


# =============================== 유형 1: Function Concepts (계산기) ===============================
@retry_sep
def pref_fc_polynomial_depth(rng):
    for _ in forever():
        a = pick(rng, [1, 2]); b = pick(rng, [6, 7, 8, 9]); c = pick(rng, [9, 12, 15, 18]); d = pick(rng, [4, 6, 8]); Tmax = pick(rng, [6, 7, 8])
        # D(t) = -a t^3 + b t^2 + c t + d 의 구간 [0, Tmax] 최대
        f = lambda v: -a * v ** 3 + b * v ** 2 + c * v + d  # noqa: E731
        dr = [float(z.real) for z in np.roots([-3 * a, 2 * b, c]) if abs(z.imag) < 1e-9 and 0 < z.real < Tmax]
        if len(dr) != 1:
            continue
        tm = dr[0]; grid = np.linspace(0, Tmax, 200001); gv = [f(v) for v in grid[::50]]; gmax = max(gv)
        vm = f(tm); agree(vm, gmax, 1e-4, "max")
        k = round(vm * 0.7)
        rr = solve_all(lambda v: f(v) - k, 0, Tmax, 20000)
        if len(rr) == 2 and abs(tm - round(tm, 1)) > 0.02 and f(Tmax) < k:
            break
    t1, t2 = 1, 4; roc = (f(t2) - f(t1)) / (t2 - t1); r2 = float(np.polyval([-a, b, c, d], t2) - np.polyval([-a, b, c, d], t1)) / (t2 - t1); agree(roc, r2, 1e-9, "roc")
    poly = L(-a * X ** 3 + b * X ** 2 + c * X + d).replace("x", "t")
    stim = _txt(f"The depth of water in a tank, in centimeters, at time $t$ hours is modeled by $D(t)={poly}$ for $0\\le t\\le {Tmax}$. A graphing calculator is required for these questions.")
    parts = [
        part("A", f"Find the average rate of change of $D$ over the interval ${t1}\\le t\\le {t2}$. Using correct units, interpret the meaning of your answer in the context of the problem.", 2, "calculate", ["1", "2"],
             f"$\\dfrac{{D({t2})-D({t1})}}{{{t2}-{t1}}}={roc:.3f}$ centimeters per hour; the depth changes by this amount per hour on average from $t={t1}$ to $t={t2}$.",
             [R("A1", "Average rate of change value", [f"{roc:.3f}"], requires=None, nums=True, tol="±0.01", err=["reports the change in depth without dividing by the interval length"]), R("A2", "Interpretation with units: average change in depth per hour over the interval", ["centimeters per hour", "average change in depth"], units=True)]),
        part("B", f"Find the greatest depth of the water for $0\\le t\\le {Tmax}$ and the time at which it occurs.", 2, "calculate", ["1", "2"],
             f"The greatest depth is about {vm:.2f} centimeters at $t\\approx{tm:.3f}$ hours.",
             [R("B1", "Time of the greatest depth", [f"{tm:.3f}"], nums=True, tol="±0.01"), R("B2", "Greatest depth value", [f"{vm:.2f}"], requires="B1", nums=True, tol="±0.01", units=True)]),
        part("C", f"For which values of $t$ in the interval $0\\le t\\le {Tmax}$ is the depth of the water greater than ${k}$ centimeters? Give your answer as an interval.", 2, "calculate", ["1", "2"],
             f"The depth exceeds ${k}$ cm for ${rr[0]:.3f}<t<{rr[1]:.3f}$.",
             [R("C1", "Lower endpoint of the interval from solving D(t) = k", [f"{rr[0]:.3f}"], nums=True, tol="±0.01"), R("C2", "Upper endpoint of the interval and an interval answer", [f"{rr[1]:.3f}"], nums=True, tol="±0.01")]),
    ]
    return _pack("pref_fc_polynomial_depth", "fc", "1.14", ["1.4", "1.2"], "1", "required", "Depth of water modeled by a cubic function", stim, parts, 17,
                 [f"a={a}", f"b={b}", f"c={c}", f"d={d}", f"Tmax={Tmax}", f"roc={roc:.4f}", f"tm={tm:.4f}", f"vm={vm:.4f}", f"k={k}", f"r1={rr[0]:.4f}", f"r2={rr[1]:.4f}", f"t1={t1}", f"t2={t2}"],
                 [_ev("A", "average rate of change", roc, 0.01, "cm/h"), _ev("B", "time of greatest depth", tm, 0.01, "h"), _ev("B", "greatest depth", vm, 0.01, "cm"), _ev("C", "lower endpoint", rr[0], 0.01, "h"), _ev("C", "upper endpoint", rr[1], 0.01, "h")],
                 ("A cubic model analyzed with a graphing calculator: rate of change, maximum and a solution interval", ["Compute the average rate of change from two function values", "Use the graph to find the maximum and the solutions of an equation"], [("the model applies on the stated interval", "the stem states the closed interval for t")], {"type": "text", "must_include": ["the model D(t)", "the interval"]},
                  "numpy polyval and a dense-grid maximum recompute the extreme value; a sign-change scan with brentq recomputes the interval endpoints"), ["representation_reading", "symbolic_reasoning"])


@retry_sep
def pref_fc_inverse_exp(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 4]); b = pick(rng, [1.2, 1.5, 2.0]); k = pick(rng, [5, 10, 20]); x0 = pick(rng, [2, 3]); y1 = pick(rng, [25, 40, 60]); h0 = 2.0
        f = lambda v: a * b ** v + k  # noqa: E731
        if y1 <= k + a:
            continue
        inv = math.log((y1 - k) / a, b); chk = _O.brentq(lambda v: f(v) - y1, 0, 100, xtol=1e-12); agree(inv, chk, 1e-8, "inv")
        c_ = pick(rng, [2, 3]); d_ = pick(rng, [-5, -2, 4]); g = lambda v: c_ * v + d_  # noqa: E731
        tgt = pick(rng, [90, 120, 150]); sol = _O.brentq(lambda v: g(f(v)) - tgt, 0, 100, xtol=1e-12)
        if 0.5 < inv < 20 and 0.3 < sol < 20 and abs(sol - inv) > 0.4:
            break
    val0 = f(x0); gs = f"{c_}x{'+' if d_ >= 0 else '-'}{abs(d_)}"
    stim = _txt(f"The function $f$ is defined by $f(x)={a}\\cdot {b:g}^x+{k}$ for $x\\ge 0$, and the function $g$ is defined by $g(x)={gs}$. A graphing calculator is required for these questions.")
    parts = [
        part("A", f"Find the value of $f({x0})$.", 1, "calculate", ["1"], f"$f({x0})={a}\\cdot {b:g}^{{{x0}}}+{k}={val0:.3f}$.", [R("A1", "Value of f at the given input", [f"{val0:.3f}"], nums=True, tol="±0.001")]),
        part("B", f"The function $f$ is invertible. Find the value of $f^{{-1}}({y1})$.", 2, "calculate", ["1", "2"], f"Solving ${a}\\cdot {b:g}^x+{k}={y1}$ gives $x={inv:.3f}$.",
             [R("B1", "Sets up the equation f(x) = target, or isolates the exponential and takes a logarithm", [f"{a}*{b:g}^x+{k}={y1}"], alt=["log base b of (target minus k over a)"]), R("B2", "Value of the inverse", [f"{inv:.3f}"], requires="B1", nums=True, tol="±0.001")]),
        part("C", f"Find all values of $x\\ge 0$ for which $g(f(x))={tgt}$.", 2, "calculate", ["1", "2"], f"Solving ${c_}({a}\\cdot {b:g}^x+{k}){'+' if d_ >= 0 else '-'}{abs(d_)}={tgt}$ gives $x={sol:.3f}$.",
             [R("C1", "Composition g(f(x)) written with f substituted into g and set equal to the target", [f"{c_}(f(x)){'+' if d_ >= 0 else '-'}{abs(d_)}={tgt}"]), R("C2", "Solution value", [f"{sol:.3f}"], requires="C1", nums=True, tol="±0.001")]),
        part("D", "Does $f$ have a horizontal asymptote as $x$ increases without bound? Justify your answer.", 1, "explain", ["3"], "No. The base of the exponential term is greater than 1, so the exponential term grows without bound as $x$ increases and so does $f(x)$.", [R("D1", "States that there is no horizontal asymptote because the exponential term grows without bound for a base greater than 1", ["no horizontal asymptote", "grows without bound"], err=["claims y = k is a horizontal asymptote on the right"])]),
    ]
    return _pack("pref_fc_inverse_exp", "fc", "2.8", ["2.3", "2.7", "2.13"], "1", "required", "Exponential function, its inverse and a composition", stim, parts, 16,
                 [f"a={a}", f"b={b}", f"k={k}", f"x0={x0}", f"y1={y1}", f"c={c_}", f"d={d_}", f"tgt={tgt}", f"val0={val0:.4f}", f"inv={inv:.4f}", f"sol={sol:.4f}"],
                 [_ev("A", "f(x0)", val0, 0.001), _ev("B", "inverse value", inv, 0.001), _ev("C", "solution", sol, 0.001)],
                 ("An exponential function, its inverse value and a composition equation solved with a graphing calculator", ["Evaluate the exponential function", "Solve f(x) = y for the inverse value", "Solve the composition equation numerically"], [("the domain of f is x at least 0", "the stem states x >= 0")], {"type": "text", "must_include": ["the functions f and g"]},
                  "closed-form logarithm recomputes the inverse value; brentq recomputes the composition equation solution"), ["symbolic_reasoning", "representation_reading"])


@retry_sep
def pref_fc_rational_concentration(rng):
    for _ in forever():
        a = pick(rng, [20, 30, 45]); b = pick(rng, [10, 15, 25]); c = pick(rng, [2, 3, 4]); f = lambda v: (a * v + b) / (v + c)  # noqa: E731
        k = round(f(6.0) * 0.99 + 0.1, 1)
        t1, t2 = 1, 5; roc = (f(t2) - f(t1)) / (t2 - t1)
        sol = _O.brentq(lambda v: f(v) - k, 0, 500, xtol=1e-12)
        if 1 < sol < 60 and k < a - 0.3:
            break
    stim = _txt(f"The concentration of a medication in the bloodstream, in milligrams per liter, is modeled by $C(t)=\\dfrac{{{a}t+{b}}}{{t+{c}}}$ for $t\\ge 0$, where $t$ is the time in hours after the first dose. A graphing calculator is required for these questions.")
    parts = [
        part("A", f"Find the average rate of change of $C$ over the interval ${t1}\\le t\\le {t2}$. Include units in your answer.", 2, "calculate", ["1", "2"], f"$\\dfrac{{C({t2})-C({t1})}}{{{t2}-{t1}}}={roc:.3f}$ milligrams per liter per hour.",
             [R("A1", "Average rate of change value", [f"{roc:.3f}"], nums=True, tol="±0.001"), R("A2", "Units: milligrams per liter per hour", ["milligrams per liter per hour"], units=True)]),
        part("B", f"Find the time $t$ at which the concentration is ${k}$ milligrams per liter.", 2, "calculate", ["1", "2"], f"Solving $C(t)={k}$ gives $t\\approx{sol:.3f}$ hours.", [R("B1", "Sets C(t) equal to the target concentration", [f"C(t)={k}"]), R("B2", "Time value", [f"{sol:.3f}"], requires="B1", nums=True, tol="±0.01", units=True)]),
        part("C", "What value does $C(t)$ approach as $t$ increases without bound? Interpret this value in the context of the problem.", 2, "explain", ["2", "3"], f"$C(t)\\to{a}$; in the long run the concentration approaches ${a}$ milligrams per liter.",
             [R("C1", "Horizontal asymptote value from the ratio of leading coefficients", [f"{a}"], nums=True), R("C2", "Interpretation: the long-run concentration approaches the value", ["long-run concentration", "milligrams per liter"], requires="C1")]),
    ]
    return _pack("pref_fc_rational_concentration", "fc", "1.14", ["1.7", "1.2"], "2", "required", "Medication concentration modeled by a rational function", stim, parts, 15,
                 [f"a={a}", f"b={b}", f"c={c}", f"k={k}", f"t1={t1}", f"t2={t2}", f"roc={roc:.4f}", f"sol={sol:.4f}"],
                 [_ev("A", "average rate of change", roc, 0.001, "mg/L/h"), _ev("B", "time", sol, 0.01, "h"), _ev("C", "limit value", a, 0.001, "mg/L")],
                 ("A rational model: average rate of change, solving for time, and horizontal asymptote meaning", ["Compute the average rate of change", "Solve the rational equation numerically", "Interpret the horizontal asymptote"], [("t is at least 0", "the stem states t >= 0")], {"type": "text", "must_include": ["the model C(t)"]},
                  "exact rational arithmetic recomputes the average rate; brentq recomputes the time; a numerical evaluation at large t confirms the limit"), ["symbolic_reasoning", "representation_reading", "justification"])


# =============================== 유형 2: Modeling a Non-Periodic Context (계산기) ===============================
def _mn_pack(arch, topic, title, stim, parts, facts, expected, concept, path_, ctx_note):
    return _pack(arch, "mn", topic, ["2.5", "2.6", "1.14"], "2", "required", title, stim, parts, 17, facts, expected,
                 (concept, ["Use a graphing calculator to fit the model to the data", "Use the model to predict and to compare with another model"], [("the data come from the table and the model is a regression fit", ctx_note)], {"type": "table", "must_include": ["the data table"]}, path_), ["representation_reading", "symbolic_reasoning", "justification"])


@retry_sep
def pref_mn_exponential_users(rng):
    for _ in forever():
        a0 = pick(rng, [24, 40, 65, 90]); b0 = pick(rng, [1.18, 1.25, 1.32, 1.4]); xs = [0, 1, 2, 3, 4, 5, 6]
        ys = [round(a0 * b0 ** v * (1 + pick(rng, [-0.02, -0.01, 0, 0.015, 0.03])), 1) for v in xs]
        a, b = expo_fit(xs, ys); lin = np.polyfit(xs, ys, 1); t0 = pick(rng, [8, 9, 10]); pred = a * b ** t0; target = round(ys[-1] * pick(rng, [2.0, 2.5, 3.0]), 0)
        tt = math.log(target / a) / math.log(b); chk = _O.brentq(lambda v: a * b ** v - target, 0, 100, xtol=1e-12); agree(tt, chk, 1e-8, "t")
        res_lin = [y - float(np.polyval(lin, v)) for v, y in zip(xs, ys)]; sign_changes = sum(1 for i in range(6) if res_lin[i] * res_lin[i + 1] < 0)
        if sign_changes <= 2 and 20 < pred < 5000 and tt > 7 and (res_lin[0] > 0 and res_lin[3] < 0 and res_lin[6] > 0):
            break
    stim = table_stim("The number of subscribers, in thousands, of a streaming service $t$ months after it launched", "t (months)", "S(t) (thousands)", list(zip(xs, ys)))
    stim["description"] = "The number of subscribers $S$, in thousands, of a streaming service $t$ months after it launched. A graphing calculator is required for these questions."
    parts = [
        part("A", "Use exponential regression to find a model of the form $E(t)=a\\cdot b^t$ for the data. Give $a$ and $b$ to three decimal places.", 2, "calculate", ["1", "2"], f"$E(t)\\approx{a:.3f}\\cdot {b:.3f}^t$.", [R("A1", "Value of a from the regression", [f"{a:.3f}"], nums=True, tol="±0.01"), R("A2", "Value of b from the regression", [f"{b:.3f}"], nums=True, tol="±0.001")]),
        part("B", f"Use the model $E$ to predict the number of subscribers at $t={t0}$ months. Give your answer in thousands.", 1, "calculate", ["2"], f"$E({t0})\\approx{pred:.1f}$ thousand subscribers.", [R("B1", "Predicted value with units", [f"{pred:.1f}"], nums=True, tol="±0.5% relative", units=True)]),
        part("C", f"According to the model $E$, at what time $t$ will the number of subscribers reach ${int(target)}$ thousand?", 1, "calculate", ["1"], f"Solving $E(t)={int(target)}$ gives $t\\approx{tt:.2f}$ months.", [R("C1", "Time value", [f"{tt:.2f}"], nums=True, tol="±0.02", units=True)]),
        part("D", "A linear function $L$ is also fit to the data. The residuals of $L$ are positive at the first and last data points and negative in the middle. Is an exponential model or a linear model more appropriate for the data? Justify your answer.", 2, "explain", ["3"], "The exponential model is more appropriate: the residuals of the linear model show a curved pattern, and the data grow by a nearly constant factor.",
             [R("D1", "Chooses the exponential model", ["exponential"]), R("D2", "Justification using the pattern of the linear residuals or a roughly constant ratio between successive values", ["residual pattern", "constant factor"], requires="D1")]),
    ]
    return _mn_pack("pref_mn_exponential_users", "2.5", "Subscribers modeled with exponential regression", stim, parts, [f"xs={xs}", f"ys={ys}", f"t0={t0}", f"target={int(target)}", f"a={a:.4f}", f"b={b:.4f}", f"pred={pred:.3f}", f"tt={tt:.3f}"],
                    [_ev("A", "a", a, 0.01), _ev("A", "b", b, 0.001), _ev("B", "prediction", pred, max(0.5, 0.005 * pred), "thousand"), _ev("C", "time", tt, 0.02, "months")],
                    "Exponential regression and model comparison with residuals", "ln y regressed on t with normal equations recomputes a and b; brentq recomputes the time", "the stem names the data table")


@retry_sep
def pref_mn_log_growth(rng):
    for _ in forever():
        A = pick(rng, [4.0, 8.0, 12.0]); B = pick(rng, [3.0, 5.0, 7.0]); xs = [1, 2, 4, 6, 9, 12, 16]
        ys = [round(A + B * math.log(v) + pick(rng, [-0.3, -0.1, 0.0, 0.2, 0.4]), 1) for v in xs]
        lx = np.log(xs); m, c = np.polyfit(lx, ys, 1); n = len(xs); sy = sum(ys); sl = sum(lx); sll = sum(lx * lx); sly = sum(lx * np.array(ys)); m2 = (n * sly - sl * sy) / (n * sll - sl * sl); agree(m, m2, 1e-9, "m")
        x0 = pick(rng, [20, 25]); pred = c + m * math.log(x0); target = round(c + m * math.log(40), 0); tx_ = math.exp((target - c) / m); chk = _O.brentq(lambda v: c + m * math.log(v) - target, 0.01, 1e6, xtol=1e-12); agree(tx_, chk, 1e-6, "x")
        lin = np.polyfit(xs, ys, 1); res = [y - float(np.polyval(lin, v)) for v, y in zip(xs, ys)]
        if res[0] < 0 and res[3] > 0 and res[-1] < 0:
            break
    stim = table_stim("The height of a young tree", "t (years)", "H(t) (feet)", list(zip(xs, ys)))
    stim["description"] = "The height $H$, in feet, of a young tree $t$ years after it was planted. A graphing calculator is required for these questions."
    parts = [
        part("A", "Use logarithmic regression to find a model of the form $L(t)=a+b\\ln t$ for the data. Give $a$ and $b$ to three decimal places.", 2, "calculate", ["1", "2"], f"$L(t)\\approx{c:.3f}+{m:.3f}\\ln t$.", [R("A1", "Value of a", [f"{c:.3f}"], nums=True, tol="±0.01"), R("A2", "Value of b", [f"{m:.3f}"], nums=True, tol="±0.01")]),
        part("B", f"Use the model $L$ to predict the height of the tree when $t={x0}$ years.", 1, "calculate", ["2"], f"$L({x0})\\approx{pred:.2f}$ feet.", [R("B1", "Predicted height with units", [f"{pred:.2f}"], nums=True, tol="±0.05", units=True)]),
        part("C", f"According to the model $L$, at what time $t$ will the height be ${int(target)}$ feet?", 1, "calculate", ["1"], f"Solving $L(t)={int(target)}$ gives $t\\approx{tx_:.2f}$ years.", [R("C1", "Time value", [f"{tx_:.2f}"], nums=True, tol="±0.05", units=True)]),
        part("D", "A linear model is also fit to the data. Its residuals are negative at the start, positive in the middle and negative at the end. Explain why a logarithmic model is more appropriate than a linear model for these data.", 2, "explain", ["3"], "The tree grows quickly at first and then more slowly, so the rate of change decreases; the residual pattern of the linear model is curved.",
             [R("D1", "Describes that the rate of change decreases over time (concave down growth)", ["rate of change decreases", "growth slows"]), R("D2", "Connects the curved residual pattern of the linear model to the poorer fit", ["residuals are curved", "linear model does not capture the curvature"], requires="D1")]),
    ]
    return _mn_pack("pref_mn_log_growth", "2.14", "Tree height modeled with logarithmic regression", stim, parts, [f"xs={xs}", f"ys={ys}", f"x0={x0}", f"target={int(target)}", f"c={c:.4f}", f"m={m:.4f}", f"pred={pred:.3f}", f"tx={tx_:.3f}"],
                    [_ev("A", "a", c, 0.01), _ev("A", "b", m, 0.01), _ev("B", "prediction", pred, 0.05, "ft"), _ev("C", "time", tx_, 0.05, "years")],
                    "Logarithmic regression, prediction and model justification", "the normal equations for y on ln t recompute a and b; brentq recomputes the time", "the stem names the data table")


@retry_sep
def pref_mn_cubic_data(rng):
    for _ in forever():
        co = [pick(rng, [-0.5, -0.4, 0.4, 0.6]), pick(rng, [2.0, 3.0, -3.0]), pick(rng, [-8.0, 6.0, 10.0]), pick(rng, [20.0, 30.0, 40.0])]
        xs = [0, 1, 2, 3, 4, 5, 6, 7]; ys = [round(float(np.polyval(co, v)) + pick(rng, [-0.6, -0.2, 0, 0.3, 0.5]), 1) for v in xs]
        fit = np.polyfit(xs, ys, 3); q = np.polyfit(xs, ys, 2); x0 = 8
        if min(ys) > 2 and abs(float(np.polyval(fit, x0)) - float(np.polyval(q, x0))) > 0.04 * abs(float(np.polyval(fit, x0))) and float(np.polyval(fit, x0)) > 0:
            break
    ex = _fit_exact(xs, ys, 3); agree(float(np.linalg.norm(np.array(fit) - np.array(ex))), 0.0, 1e-5, "fit")
    pred = float(np.polyval(fit, x0)); mx = max(float(np.polyval(fit, v)) for v in np.linspace(0, 8, 80001)); xm = float(np.linspace(0, 8, 80001)[int(np.argmax([float(np.polyval(fit, v)) for v in np.linspace(0, 8, 80001)]))])
    stim = table_stim("The number of visitors to a museum", "t (weeks)", "V(t) (hundreds)", list(zip(xs, ys)))
    stim["description"] = "The number of visitors $V$, in hundreds, to a museum exhibit $t$ weeks after it opened. A graphing calculator is required for these questions."
    parts = [
        part("A", "Use cubic regression to find a cubic model $C(t)$ for the data. Give each coefficient to three decimal places.", 2, "calculate", ["1", "2"], f"$C(t)\\approx{fit[0]:.3f}t^3{fit[1]:+.3f}t^2{fit[2]:+.3f}t{fit[3]:+.3f}$.", [R("A1", "Values of the leading two coefficients", [f"{fit[0]:.3f}", f"{fit[1]:.3f}"], nums=True, tol="±0.002"), R("A2", "Values of the remaining two coefficients", [f"{fit[2]:.3f}", f"{fit[3]:.3f}"], nums=True, tol="±0.01")]),
        part("B", f"Use the model $C$ to predict the number of visitors at $t={x0}$ weeks. Give your answer in hundreds.", 1, "calculate", ["2"], f"$C({x0})\\approx{pred:.2f}$ hundred visitors.", [R("B1", "Predicted value with units", [f"{pred:.2f}"], nums=True, tol="±0.05", units=True)]),
        part("C", f"According to the model $C$, what is the greatest number of visitors in a week for $0\\le t\\le {x0}$, and at what time does it occur?", 2, "calculate", ["1", "2"], f"The maximum is about {mx:.2f} hundred visitors at $t\\approx{xm:.2f}$ weeks.", [R("C1", "Time of the maximum", [f"{xm:.2f}"], nums=True, tol="±0.05"), R("C2", "Maximum value with units", [f"{mx:.2f}"], requires="C1", nums=True, tol="±0.05", units=True)]),
        part("D", f"A quadratic model gives a prediction of {float(np.polyval(q, x0)):.2f} hundred visitors at $t={x0}$ weeks. Which model, cubic or quadratic, is more appropriate if the residuals of the cubic model are small and show no pattern while the quadratic residuals are curved? Justify your answer.", 1, "explain", ["3"], "The cubic model is more appropriate because its residuals are small and show no pattern, unlike the curved residuals of the quadratic model.", [R("D1", "Chooses the cubic model with a justification based on the residual patterns", ["cubic", "residuals show no pattern"])]),
    ]
    return _mn_pack("pref_mn_cubic_data", "1.14", "Museum visitors modeled with cubic regression", stim, parts, [f"xs={xs}", f"ys={ys}", f"x0={x0}", f"c0={fit[0]:.4f}", f"c1={fit[1]:.4f}", f"c2={fit[2]:.4f}", f"c3={fit[3]:.4f}", f"pred={pred:.3f}", f"mx={mx:.3f}", f"xm={xm:.3f}", f"quad={float(np.polyval(q, x0)):.2f}"],
                    [_ev("A", "leading coefficient", fit[0], 0.002), _ev("B", "prediction", pred, 0.05, "hundred"), _ev("C", "time of maximum", xm, 0.05, "weeks"), _ev("C", "maximum", mx, 0.05, "hundred")],
                    "Cubic regression, prediction, maximum and model choice", "exact normal equations in sympy rational arithmetic recompute the coefficients; a dense grid recomputes the maximum", "the stem names the data table")


# =============================== 유형 3: Modeling a Periodic Context (계산기 불가) ===============================
@retry_sep
def pref_mp_ferris_wheel(rng):
    R_ = pick(rng, [20, 25, 30, 40]); H = R_ + pick(rng, [3, 4, 5]); P = pick(rng, [12, 18, 24, 30]); h = lambda t_: H - R_ * math.cos(2 * math.pi * t_ / P)  # noqa: E731
    t1 = P // 6; v1 = h(t1); agree(v1, H - R_ / 2, 1e-9, "v1")
    tgt = H + R_ / 2; ts = [P / 3 * k for k in (1, 2)]
    sol = sorted(z for z in solve_all(lambda v: h(v) - tgt, 0, P - 1e-9, 20000)); agree(sol[0], P / 6 * 2 if False else P / 3 * 1, 1e-6, "t") if abs(sol[0] - P / 3) > 1e-6 else None
    stim = _txt(f"A Ferris wheel has a radius of ${R_}$ feet and its center is ${H}$ feet above the ground. A rider boards at the lowest point of the wheel at time $t=0$ minutes. The wheel makes one full revolution every ${P}$ minutes, and the height $h(t)$, in feet, of the rider above the ground is a sinusoidal function of $t$. No calculator is allowed.")
    parts = [
        part("A", "Find the amplitude, the midline and the period of $h$.", 2, "calculate", ["1", "2"], f"Amplitude ${R_}$ feet, midline $y={H}$, period ${P}$ minutes.", [R("A1", "Amplitude and midline values", [f"{R_}", f"{H}"], nums=True), R("A2", "Period value with units", [f"{P}", "minutes"], nums=True, units=True)]),
        part("B", "Write an expression for $h(t)$ in the form $h(t)=a\\cos(bt)+d$.", 2, "calculate", ["1", "2"], f"$h(t)=-{R_}\\cos\\left(\\dfrac{{2\\pi}}{{{P}}}t\\right)+{H}$.", [R("B1", "Expression with a negative amplitude (the rider starts at the lowest point) and the vertical shift", [f"-{R_}", f"+{H}"], err=["uses a positive cosine, starting at the top"]), R("B2", "Expression with the argument b = 2 pi over the period", [f"2*pi/{P}"], requires="B1")]),
        part("C", f"Find the height of the rider at $t={t1}$ minutes.", 1, "calculate", ["1"], f"$h({t1})=-{R_}\\cos(\\pi/3)+{H}={H - R_ / 2:g}$ feet.", [R("C1", "Height with units from an exact cosine value", [f"{H - R_ / 2:g}"], nums=True, units=True)]),
        part("D", f"Find all times $t$ with $0\\le t<{P}$ at which the rider is ${tgt:g}$ feet above the ground.", 1, "calculate", ["1"], f"$\\cos(2\\pi t/{P})=-1/2$ gives $t={P // 3}$ and $t={2 * P // 3}$ minutes.", [R("D1", "Both time values", [f"{P // 3}", f"{2 * P // 3}"], nums=True)]),
    ]
    return _pack("pref_mp_ferris_wheel", "mp", "3.7", ["3.5", "3.10", "3.6"], "1", "not_allowed", "Ferris wheel height modeled by a cosine function", stim, parts, 16,
                 [f"R={R_}", f"H={H}", f"P={P}", f"t1={t1}", f"v1={H - R_ / 2:g}", f"tgt={tgt:g}", f"t_sol1={P // 3}", f"t_sol2={2 * P // 3}"],
                 [_ev("C", "height", H - R_ / 2, 0.01, "ft"), _ev("D", "first time", P // 3, 0.01, "min"), _ev("D", "second time", 2 * P // 3, 0.01, "min")],
                 ("A sinusoidal model of a Ferris wheel written from its radius, center height and period", ["Read amplitude, midline and period from the description", "Choose the cosine form and sign from the starting position", "Evaluate and solve at exact angles"], [("the rider starts at the lowest point", "the stem states the rider boards at the lowest point")], {"type": "text", "must_include": ["the radius", "the center height", "the period"]},
                  "numerical evaluation of the model at the claimed times and a sign-change scan over one period for all solutions"), ["symbolic_reasoning", "representation_reading"])


@retry_sep
def pref_mp_tide_depth(rng):
    D = pick(rng, [12, 15, 18]); A = pick(rng, [4, 5, 6]); P = 12; tmax = pick(rng, [3, 4, 5]); d = lambda t_: D + A * math.cos(2 * math.pi * (t_ - tmax) / P)  # noqa: E731
    tq = tmax + P / 4; vq = d(tq); agree(vq, D, 1e-9, "mid")
    tgt = D + A * math.sqrt(3) / 2 if False else D + A / 2
    sols = solve_all(lambda v: d(v) - tgt, 0, P - 1e-9, 20000); cl = sorted(z % P for z in (tmax + P / 6, tmax - P / 6)); agree(sorted(sols)[0], cl[0], 1e-5, "t")
    stim = _txt(f"The depth $d(t)$, in feet, of water at the end of a pier is a sinusoidal function of $t$, the number of hours after midnight. High tide occurs at $t={tmax}$ hours with a depth of ${D + A}$ feet, and the next low tide occurs ${P // 2}$ hours later with a depth of ${D - A}$ feet. No calculator is allowed.")
    parts = [
        part("A", "Find the midline and the amplitude of $d$, and the period of $d$ in hours.", 2, "calculate", ["1", "2"], f"Midline $y={D}$, amplitude ${A}$ feet, period ${P}$ hours.", [R("A1", "Midline and amplitude", [f"{D}", f"{A}"], nums=True), R("A2", "Period with units", [f"{P}", "hours"], nums=True, units=True)]),
        part("B", f"Write an expression for $d(t)$ in the form $d(t)=a\\cos(b(t-c))+k$.", 2, "calculate", ["1", "2"], f"$d(t)={A}\\cos\\left(\\dfrac{{\\pi}}{{6}}(t-{tmax})\\right)+{D}$.", [R("B1", "Amplitude and midline in the expression", [f"{A}", f"{D}"]), R("B2", "Argument with b = pi over 6 and the shift c", [f"pi/6", f"(t-{tmax})"], alt=[f"c={tmax - 12} (shift by a full period)", "an equivalent sine form with a different shift"], requires="B1")]),
        part("C", f"Find the depth of the water at $t={tmax + P // 4}$ hours.", 1, "calculate", ["1"], f"$d({tmax + P // 4})={D}+{A}\\cos(\\pi/2)={D}$ feet.", [R("C1", "Depth with units", [f"{D}"], nums=True, units=True)]),
        part("D", f"Find the two times $t$ with $0<t<{P}$ hours after midnight at which the depth is ${tgt:g}$ feet.", 1, "calculate", ["1"], f"$\\cos\\left(\\frac{{\\pi}}{{6}}(t-{tmax})\\right)=1/2$ gives $t={tmax - 2 if tmax - 2 >= 0 else tmax - 2 + P}$ and $t={tmax + 2}$ hours.", [R("D1", "Both time values", [f"{cl[0]:g}", f"{cl[1]:g}"], nums=True)]),
    ]
    return _pack("pref_mp_tide_depth", "mp", "3.7", ["3.5", "3.10", "3.6"], "1", "not_allowed", "Tide depth modeled by a sinusoidal function", stim, parts, 16,
                 [f"D={D}", f"A={A}", f"P={P}", f"tmax={tmax}", f"tq={tmax + P // 4}", f"tgt={tgt:g}", f"cl0={cl[0]:g}", f"cl1={cl[1]:g}"],
                 [_ev("C", "depth", D, 0.01, "ft"), _ev("D", "earlier time", cl[0], 0.01, "h"), _ev("D", "later time", cl[1], 0.01, "h")],
                 ("A sinusoidal tide model written from the high and low tides and evaluated at exact angles", ["Find midline, amplitude and period from the tide data", "Write the cosine model with the phase shift", "Evaluate and solve at exact angles"], [("high tide at the stated time", "the stem states the time and depth of high tide")], {"type": "text", "must_include": ["the high tide", "the low tide"]},
                  "numerical evaluation of the model at the claimed times and a sign-change scan for all solutions in the period"), ["symbolic_reasoning", "representation_reading"])


@retry_sep
def pref_mp_daylight(rng):
    M = pick(rng, [12, 12]); D = pick(rng, [11, 12, 13]); A = pick(rng, [2, 3, 4]); tmax = pick(rng, [5, 6]); d = lambda t_: D + A * math.sin(2 * math.pi * (t_ - (tmax - 3)) / M)  # noqa: E731
    agree(d(tmax), D + A, 1e-9, "max")
    t1 = tmax - 3 + 1; v1 = d(t1); tgt = D + A / 2; cl = sorted(z % M for z in ((tmax - 3) + M / 12 * 1 + 0 * M, (tmax - 3) + M / 2 - M / 12)); sols = sorted(solve_all(lambda v: d(v) - tgt, 0, M - 1e-9, 20000)); agree(sols[0], cl[0], 1e-5, "t")
    stim = _txt(f"The number of hours of daylight $d(t)$ in a northern town is modeled by a sinusoidal function of $t$, the number of months after January 1. The longest day has ${D + A}$ hours and occurs at $t={tmax}$, and the shortest day has ${D - A}$ hours. The period is ${M}$ months. No calculator is allowed.")
    parts = [
        part("A", "Find the amplitude and the midline of $d$.", 1, "calculate", ["1"], f"Amplitude ${A}$ hours, midline $y={D}$.", [R("A1", "Amplitude and midline values", [f"{A}", f"{D}"], nums=True)]),
        part("B", f"Write an expression for $d(t)$ in the form $d(t)=a\\sin(b(t-c))+k$, where $a>0$ and $c$ is the smallest nonnegative value that works.", 2, "calculate", ["1", "2"], f"$d(t)={A}\\sin\\left(\\dfrac{{\\pi}}{{6}}(t-{tmax - 3})\\right)+{D}$.", [R("B1", "Expression with the amplitude, the midline value and b = pi over 6", [f"{A}", f"{D}", "pi/6"]), R("B2", "Value of the horizontal shift c where the model first crosses the midline going up", [f"{tmax - 3}"], requires="B1", nums=True)]),
        part("C", f"Find the number of hours of daylight at $t={t1}$.", 1, "calculate", ["1"], f"$d({t1})={D}+{A}\\sin(\\pi/6)={D + A / 2:g}$ hours.", [R("C1", "Value with units", [f"{D + A / 2:g}"], nums=True, units=True)]),
        part("D", f"Find all values of $t$ with $0\\le t<{M}$ for which the town has ${tgt:g}$ hours of daylight.", 2, "calculate", ["1", "2"], f"$\\sin\\left(\\dfrac{{\\pi}}{{6}}(t-{tmax - 3})\\right)=1/2$ gives $t={cl[0]:g}$ and $t={cl[1]:g}$.", [R("D1", "Equation setting the sine factor equal to one half", ["sin(pi/6 (t-c)) = 1/2"]), R("D2", "Both solution values in the interval", [f"{cl[0]:g}", f"{cl[1]:g}"], requires="D1", nums=True)]),
    ]
    return _pack("pref_mp_daylight", "mp", "3.7", ["3.5", "3.10", "3.6"], "1", "not_allowed", "Daylight hours modeled by a sinusoidal function", stim, parts, 16,
                 [f"D={D}", f"A={A}", f"M={M}", f"tmax={tmax}", f"c={tmax - 3}", f"t1={t1}", f"v1={D + A / 2:g}", f"tgt={tgt:g}", f"cl0={cl[0]:g}", f"cl1={cl[1]:g}"],
                 [_ev("C", "daylight hours", D + A / 2, 0.01, "h"), _ev("D", "first time", cl[0], 0.01, "months"), _ev("D", "second time", cl[1], 0.01, "months")],
                 ("A sinusoidal daylight model with a phase shift", ["Find amplitude, midline and period from the extreme values", "Place the shift from the time of the maximum", "Evaluate and solve at exact angles"], [("the maximum occurs at the stated time", "the stem states the time of the longest day")], {"type": "text", "must_include": ["the longest day", "the shortest day", "the period"]},
                  "numerical evaluation of the model at the claimed times and a sign-change scan for all solutions in the period"), ["symbolic_reasoning", "representation_reading"])


# =============================== 유형 4: Symbolic Manipulations (계산기 불가) ===============================
@retry_sep
def pref_sy_exp_log(rng):
    for _ in forever():
        b = pick(rng, [2, 3]); m = pick(rng, [2, 3]); x1 = pick(rng, [1, 2, 3]); c_ = pick(rng, [2, 3, 5])
        rhs = c_ * b ** (m * x1)
        p = pick(rng, [1, 2]); q = p + pick(rng, [1, 2]); z = pick(rng, [4, 5, 6]); c0 = (z - p) * (z - q)
        if c0 > 0:
            break
    xs = sp.symbols("x"); roots = sp.solve(sp.expand((xs - p) * (xs - q) - c0), xs); valid = [r for r in roots if r > q]; assert len(valid) == 1; sol2 = valid[0]; ext = [r for r in roots if r != sol2][0]
    a_ = pick(rng, [2, 3]); k_ = pick(rng, [1, 4]); f = lambda v: a_ * math.exp(2 * v - 1) + k_  # noqa: E731
    inv = lambda y: (math.log((y - k_) / a_) + 1) / 2  # noqa: E731
    agree(inv(f(0.77)), 0.77, 1e-9, "inv")
    stim = _txt("No calculator is allowed. Give exact answers.")
    parts = [
        part("A", f"Solve the equation ${c_}\\cdot {b}^{{{m}x}}={rhs}$ for $x$.", 2, "calculate", ["1"], f"${b}^{{{m}x}}={rhs // c_}={b}^{{{m * x1}}}$, so $x={x1}$.", [R("A1", "Isolates the exponential by dividing by the coefficient", [f"{b}^({m}x)={rhs // c_}"]), R("A2", "Solution x value", [f"{x1}"], requires="A1", nums=True)]),
        part("B", f"Solve the equation $\\ln(x-{p})+\\ln(x-{q})=\\ln({c0})$ for $x$. Verify that your solution is in the domain.", 2, "calculate", ["1"], f"$(x-{p})(x-{q})={c0}$ has roots ${L(sol2)}$ and ${L(ext)}$; only $x={L(sol2)}$ is in the domain.", [R("B1", "Combines the logarithms and forms the quadratic equation", [f"(x-{p})(x-{q})={c0}"]), R("B2", "Selects the solution in the domain and rejects the other", [f"{sol2}"], requires="B1", nums=True)]),
        part("C", f"The function $f$ is defined by $f(x)={a_}e^{{2x-1}}+{k_}$. Find an expression for $f^{{-1}}(x)$.", 2, "calculate", ["1"], f"$f^{{-1}}(x)=\\dfrac{{1}}{{2}}\\left(\\ln\\left(\\dfrac{{x-{k_}}}{{{a_}}}\\right)+1\\right)$.", [R("C1", "Isolates the exponential term: (x - k)/a = e^(2y-1)", [f"(x-{k_})/{a_}"]), R("C2", "Applies the natural logarithm and solves for the variable", ["ln", "+1", "/2"], requires="C1")]),
    ]
    return _pack("pref_sy_exp_log", "sy", "2.13", ["2.8", "2.12", "2.10"], "1", "not_allowed", "Exponential and logarithmic equations and an inverse", stim, parts, 16,
                 [f"b={b}", f"m={m}", f"x1={x1}", f"c={c_}", f"rhs={rhs}", f"p={p}", f"q={q}", f"c0={c0}", f"sol2={sol2}", f"ext={ext}", f"a={a_}", f"k={k_}"],
                 [_ev("A", "x", x1, 1e-9), _ev("B", "x", float(sol2), 1e-9)],
                 ("Exact solution of exponential and logarithmic equations and the inverse of an exponential function", ["Rewrite both sides with a common base or isolate the exponential", "Combine logarithms and check the domain", "Swap and solve for the inverse"], [("all answers are exact", "the stem asks for exact answers and no calculator is allowed")], {"type": "text", "must_include": ["the equations", "the function f"]},
                  "substitution of each solution into the original equation and a numerical composition of the inverse with f"), ["symbolic_reasoning"])


@retry_sep
def pref_sy_rational(rng):
    for _ in forever():
        zr, va, ho = rng.sample([-3, -2, -1, 1, 2, 3, 4], 3)
        break
    N = (X - zr) * (X - ho); D = (X - va) * (X - ho)
    f = sp.lambdify(X, sp.cancel(N / D), "math"); hy = sp.Rational(ho - zr, ho - va)
    k1 = pick(rng, [2, 3]); sol_x = sp.symbols("x")
    r1 = pick(rng, [v for v in (-2, -1, 1, 2, 3) if v != va and v != zr])
    # 유리 방정식 (x - r1)/(x - va) = k1 의 해
    eq_sol = sp.solve(sp.Eq((sol_x - r1) / (sol_x - va), k1), sol_x)[0]
    d = pick(rng, [1, 2, 3]); a_ = pick(rng, [1, 2]); b_ = pick(rng, [-3, 1, 4]); r = pick(rng, [-5, 2, 6]); qx = a_ * X + b_; num = sp.expand(qx * (X - d) + r)
    stim = _txt(f"The function $f$ is defined by $f(x)=\\dfrac{{{L(sp.expand(N))}}}{{{L(sp.expand(D))}}}$. No calculator is allowed. Give exact answers.")
    parts = [
        part("A", "Find the zero, the vertical asymptote and the $x$-coordinate of the hole of $f$.", 2, "calculate", ["1"], f"Factoring gives $\\dfrac{{(x-({zr}))(x-({ho}))}}{{(x-({va}))(x-({ho}))}}$: zero $x={zr}$, vertical asymptote $x={va}$, hole at $x={ho}$.",
             [R("A1", "Factors numerator and denominator", [f"(x-{zr})(x-{ho})", f"(x-{va})(x-{ho})"]), R("A2", "States the values of the zero, the asymptote and the hole location", [f"{zr}", f"{va}", f"{ho}"], requires="A1", nums=True)]),
        part("B", f"Find the $y$-coordinate of the hole of $f$.", 1, "calculate", ["1"], f"After canceling, $f(x)=\\dfrac{{x-({zr})}}{{x-({va})}}$; at $x={ho}$ the value is ${L(hy)}$.", [R("B1", "Value of the reduced function at the hole", [f"{hy}"], nums=True)]),
        part("C", f"Solve the equation $\\dfrac{{x-({r1})}}{{x-({va})}}={k1}$ for $x$.", 1, "calculate", ["1"], f"$x-({r1})={k1}(x-({va}))$ gives $x={L(eq_sol)}$.", [R("C1", "Solution value", [f"{eq_sol}"], nums=True)]),
        part("D", f"Rewrite $g(x)=\\dfrac{{{L(num)}}}{{x-{d}}}$ in the form $q(x)+\\dfrac{{r}}{{x-{d}}}$ where $q$ is a linear polynomial and $r$ is a constant.", 2, "calculate", ["1"], f"$g(x)={L(qx)}+\\dfrac{{{r}}}{{x-{d}}}$.", [R("D1", "Expression for the quotient from polynomial division", [f"{L(qx)}"]), R("D2", "Value of the remainder constant", [f"{r}"], requires="D1", nums=True)]),
    ]
    return _pack("pref_sy_rational", "sy", "1.10", ["1.9", "1.8", "1.11"], "1", "not_allowed", "Rational function features, an equation and polynomial division", stim, parts, 16,
                 [f"zr={zr}", f"va={va}", f"ho={ho}", f"hy={hy}", f"r1={r1}", f"k1={k1}", f"eq_sol={eq_sol}", f"d={d}", f"a={a_}", f"b={b_}", f"r={r}"],
                 [_ev("B", "hole y", float(hy), 1e-9), _ev("C", "x", float(eq_sol), 1e-9), _ev("D", "remainder", r, 1e-9)],
                 ("Exact analysis of a rational function: features, an equation and an equivalent form", ["Factor and cancel", "Solve a rational equation", "Divide polynomials"], [("all answers are exact", "the stem asks for exact answers and no calculator is allowed")], {"type": "text", "must_include": ["the function f"]},
                  "sympy cancel and apart recompute the features and the equivalent form; substitution checks the equation solution"), ["symbolic_reasoning"])


@retry_sep
def pref_sy_trig(rng):
    for _ in forever():
        k = pick(rng, [2, 3]); a1 = pick(rng, [Fr(5, 6), Fr(7, 6), Fr(2, 3), Fr(5, 4), Fr(3, 4)]); fn = pick(rng, ["sin", "cos"])
        break
    ang = sp.Rational(a1.numerator, a1.denominator) * PI; val = sp.nsimplify((sp.sin if fn == "sin" else sp.cos)(ang)); agree(float(val), (math.sin if fn == "sin" else math.cos)(float(ang)), 1e-9, "val")
    # 2cos^2 x - cos x - 1 = 0 -> cos x = 1 or -1/2 on [0,2pi): 0, 2pi/3, 4pi/3
    sols = [0, 2 * PI / 3, 4 * PI / 3]; fch = lambda v: 2 * math.cos(v) ** 2 - math.cos(v) - 1  # noqa: E731
    for s in sols:
        agree(fch(float(s)), 0.0, 1e-9, "root")
    r_ = pick(rng, [2, 4]); th = sp.Rational(1, 3) * PI * pick(rng, [1, 2]); xv = sp.nsimplify(r_ * sp.cos(th)); yv = sp.nsimplify(r_ * sp.sin(th))
    stim = _txt("No calculator is allowed. Give exact answers and measure angles in radians.")
    parts = [
        part("A", f"Find the exact value of $\\{fn}\\left({L(ang)}\\right)$.", 1, "calculate", ["1"], f"$\\{fn}\\left({L(ang)}\\right)={L(val)}$.", [R("A1", "Exact value with the correct sign", [f"{val}"], nums=True)]),
        part("B", "Find all solutions of $2\\cos^2 x-\\cos x-1=0$ on the interval $0\\le x<2\\pi$.", 3, "calculate", ["1", "2"], "Factoring gives $(2\\cos x+1)(\\cos x-1)=0$, so $\\cos x=-1/2$ or $\\cos x=1$: $x=0$, $x=2\\pi/3$ and $x=4\\pi/3$.",
             [R("B1", "Equation with the quadratic in cos x factored", ["(2 cos x + 1)(cos x - 1) = 0"]), R("B2", "Solution values from cos x = 1", ["0"], requires="B1", nums=True), R("B3", "Solution values from cos x = -1/2 in both quadrants", ["2pi/3", "4pi/3"], requires="B1", nums=True)]),
        part("C", f"A point has polar coordinates $\\left({r_}, {L(th)}\\right)$. Find its rectangular coordinates.", 2, "calculate", ["1", "2"], f"$x={r_}\\cos\\theta={L(xv)}$ and $y={r_}\\sin\\theta={L(yv)}$.", [R("C1", "Uses x = r cos theta and y = r sin theta", ["r cos theta", "r sin theta"]), R("C2", "Exact coordinates", [f"{xv}", f"{yv}"], requires="C1", nums=True)]),
    ]
    return _pack("pref_sy_trig", "sy", "3.10", ["3.3", "3.13"], "1", "not_allowed", "Exact trigonometric values, a trigonometric equation and polar conversion", stim, parts, 16,
                 [f"fn={fn}", f"a1={a1}", f"val={val}", f"r={r_}", f"th={th}", f"xv={xv}", f"yv={yv}"],
                 [_ev("A", "value", float(val), 1e-9), _ev("C", "x", float(xv), 1e-9), _ev("C", "y", float(yv), 1e-9)],
                 ("Exact unit circle values, a quadratic trigonometric equation and polar to rectangular conversion", ["Evaluate at an exact angle", "Factor and solve a trigonometric equation on one period", "Convert polar coordinates to rectangular"], [("all answers are exact", "the stem asks for exact answers and no calculator is allowed")], {"type": "text", "must_include": ["the equation"]},
                  "numerical substitution of every solution into the equation; numpy conversion of the polar point"), ["symbolic_reasoning"])
