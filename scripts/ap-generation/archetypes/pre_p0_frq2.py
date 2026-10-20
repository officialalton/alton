"""AP Precalculus FRQ 원형 2차 — 4유형 × 추가 시나리오 2개(fc·mn·mp·sy 각 4·5번째). 구조·검증은 pre_p0_frq.py 와 같다."""
from pre_common import *
from pre_common import _O
from calc_ab_frq import part
from pre_p0_frq import R, _ev, _pack, _txt
from pre_p0_b import _fit_exact

PI = sp.pi
STAGE_FRQ2 = ["pref_fc_log_learning", "pref_fc_poly_vs_exp", "pref_mn_quadratic_ball", "pref_mn_exp_cooling", "pref_mp_spring_cos", "pref_mp_body_temperature", "pref_sy_log_exp_model", "pref_sy_poly_zeros"]


@retry_sep
def pref_fc_log_learning(rng):
    for _ in forever():
        a = pick(rng, [20, 30, 40]); b = pick(rng, [12, 18, 25]); f = lambda t_: a + b * math.log(t_ + 1)  # noqa: E731
        x0 = pick(rng, [4, 6, 9]); t1, t2 = 1, 7; roc = (f(t2) - f(t1)) / (t2 - t1); k = round(f(12) + 2)
        sol = _O.brentq(lambda v: f(v) - k, 0, 500, xtol=1e-12); closed = math.exp((k - a) / b) - 1; agree(sol, closed, 1e-8, "sol")
        r1 = (f(3) - f(1)) / 2; r2 = (f(7) - f(5)) / 2
        if r1 > r2 + 0.2 and 8 < sol < 200:
            break
    v0 = f(x0)
    stim = _txt(f"A student's score $L(t)$ on a vocabulary test, in points, after $t$ hours of study is modeled by $L(t)={a}+{b}\\ln(t+1)$ for $t\\ge 0$. A graphing calculator is required for these questions.")
    parts = [
        part("A", f"Find $L({x0})$.", 1, "calculate", ["1"], f"$L({x0})={a}+{b}\\ln({x0 + 1})\\approx{v0:.3f}$ points.", [R("A1", "Value of the function at the given input", [f"{v0:.3f}"], nums=True, tol="±0.001", units=True)]),
        part("B", f"Find the average rate of change of $L$ over the interval ${t1}\\le t\\le {t2}$. Using correct units, interpret the meaning of your answer in the context of the problem.", 2, "calculate", ["1", "2"], f"$\\dfrac{{L({t2})-L({t1})}}{{{t2 - t1}}}\\approx{roc:.3f}$ points per hour of study.", [R("B1", "Average rate of change value", [f"{roc:.3f}"], nums=True, tol="±0.001"), R("B2", "Interpretation with units: average increase in score per hour over the interval", ["points per hour", "average increase"], units=True)]),
        part("C", f"For what value of $t$ does the model give a score of ${k}$ points?", 2, "calculate", ["1", "2"], f"Solving $L(t)={k}$ gives $t\\approx{sol:.3f}$ hours.", [R("C1", "Equation setting the model equal to the target score", [f"L(t)={k}"]), R("C2", "Solution value", [f"{sol:.3f}"], requires="C1", nums=True, tol="±0.01", units=True)]),
        part("D", "The average rate of change of $L$ over $1\\le t\\le 3$ is greater than the average rate of change over $5\\le t\\le 7$. What does this say about how the score changes as the number of hours of study increases?", 1, "explain", ["3"], f"The average rate over $1\\le t\\le 3$ is about {r1:.3f} and over $5\\le t\\le 7$ about {r2:.3f}; the score keeps increasing but at a decreasing rate.", [R("D1", "States that the score increases at a decreasing rate, supported by the two average rates of change", ["increasing at a decreasing rate", f"{r1:.3f}", f"{r2:.3f}"])]),
    ]
    return _pack("pref_fc_log_learning", "fc", "2.14", ["2.11", "1.2"], "1", "required", "Test score modeled by a logarithmic function", stim, parts, 17,
                 [f"a={a}", f"b={b}", f"x0={x0}", f"t1={t1}", f"t2={t2}", f"k={k}", f"v0={v0:.4f}", f"roc={roc:.4f}", f"sol={sol:.4f}", f"r1={r1:.4f}", f"r2={r2:.4f}"],
                 [_ev("A", "L(x0)", v0, 0.001, "points"), _ev("B", "average rate of change", roc, 0.001, "points/h"), _ev("C", "time", sol, 0.01, "h")],
                 ("A logarithmic model: value, average rate of change, solving for time and the behavior of the rate", ["Evaluate the model with a calculator", "Compare average rates over two intervals to describe the rate of change"], [("t is at least 0", "the stem states t >= 0")], {"type": "text", "must_include": ["the model L(t)"]},
                  "floating-point evaluation versus exact logarithm closed form; brentq recomputes the solution time"), ["symbolic_reasoning", "representation_reading", "justification"])


@retry_sep
def pref_fc_poly_vs_exp(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 5]); b = pick(rng, [1.3, 1.5, 1.8]); c = pick(rng, [1, 2, 3]); p = pick(rng, [2, 3])
        f = lambda v: a * b ** v  # noqa: E731
        g = lambda v: c * v ** p + 4  # noqa: E731
        rr = solve_all(lambda v: f(v) - g(v), 0.01, 40, 40000)
        if len(rr) >= 1 and 3 < rr[-1] < 35:
            break
    n = len(rr); last = rr[-1]; x0 = 6; roc = (f(x0) - f(2)) / (x0 - 2)
    stim = _txt(f"The functions $f$ and $g$ are defined by $f(x)={a}\\cdot {b}^x$ and $g(x)={c}x^{p}+4$ for $x\\ge 0$. A graphing calculator is required for these questions.")
    parts = [
        part("A", f"Find the average rate of change of $f$ over the interval $2\\le x\\le {x0}$.", 1, "calculate", ["1"], f"$\\dfrac{{f({x0})-f(2)}}{{{x0 - 2}}}\\approx{roc:.3f}$.", [R("A1", "Average rate of change value", [f"{roc:.3f}"], nums=True, tol="±0.001")]),
        part("B", "Find all values of $x\\ge 0$ for which $f(x)=g(x)$.", 2, "calculate", ["1", "2"], f"The graphs intersect at $x\\approx{', '.join(f'{r:.3f}' for r in rr)}$.", [R("B1", "Equation setting f equal to g or the intersection of the graphs", ["f(x)=g(x)"]), R("B2", "All solution values", [f"{r:.3f}" for r in rr], requires="B1", nums=True, tol="±0.01")]),
        part("C", f"For $x>{last:.3f}$, is $f(x)$ greater than $g(x)$ or less than $g(x)$? Justify your answer using the behavior of the two functions as $x$ increases.", 2, "explain", ["3"], "For large $x$ the exponential function grows faster than the polynomial function, so $f(x)>g(x)$ beyond the last intersection.", [R("C1", "States that f(x) is greater than g(x) beyond the last intersection", ["f is greater"]), R("C2", "Justifies that an exponential function with base greater than 1 eventually outgrows a polynomial function", ["exponential outgrows polynomial"], requires="C1")]),
        part("D", f"Find $g(f(2))$.", 1, "calculate", ["1"], f"$f(2)={a * b ** 2:.3f}$ and $g(f(2))={g(a * b ** 2):.3f}$.", [R("D1", "Value of the composition", [f"{g(a * b ** 2):.3f}"], nums=True, tol="±0.01")]),
    ]
    return _pack("pref_fc_poly_vs_exp", "fc", "2.6", ["2.7", "1.4", "2.3"], "1", "required", "An exponential function compared with a polynomial function", stim, parts, 17,
                 [f"a={a}", f"b={b}", f"c={c}", f"p={p}", f"x0={x0}", f"roc={roc:.4f}", f"last={last:.4f}", f"comp={g(a * b ** 2):.4f}"] + [f"r{i}={r:.4f}" for i, r in enumerate(rr)],
                 [_ev("A", "average rate of change", roc, 0.001), _ev("D", "composition", g(a * b ** 2), 0.01)] + [_ev("B", f"solution {i + 1}", r, 0.01) for i, r in enumerate(rr)],
                 ("Compare an exponential and a polynomial function with a graphing calculator", ["Find intersections numerically", "Use the long-run behavior to justify the comparison"], [("x is at least 0", "the stem states x >= 0")], {"type": "text", "must_include": ["the functions f and g"]},
                  "a sign-change scan with brentq refinement recomputes every intersection; evaluation at large inputs confirms the long-run comparison"), ["symbolic_reasoning", "justification"])


@retry_sep
def pref_mn_quadratic_ball(rng):
    for _ in forever():
        g_ = pick(rng, [-4.0, -5.0, -6.0]); v0 = pick(rng, [18.0, 24.0, 30.0]); h0 = pick(rng, [2.0, 4.0]); xs = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
        ys = [round(g_ * t_ ** 2 + v0 * t_ + h0 + pick(rng, [-0.3, 0, 0.2, 0.4, -0.1]), 1) for t_ in xs]
        fit = np.polyfit(xs, ys, 2); ex = _fit_exact(xs, ys, 2); agree(float(np.linalg.norm(np.array(fit) - np.array(ex))), 0.0, 1e-6, "fit")
        tmax = -fit[1] / (2 * fit[0]); hmax = float(np.polyval(fit, tmax)); roots = [float(z.real) for z in np.roots(fit) if abs(z.imag) < 1e-9 and z.real > 0]
        if fit[0] < 0 and roots and min(ys) > 0 and tmax > 0:
            break
    tz = max(roots); x0 = 2.75; pred = float(np.polyval(fit, x0))
    stim = table_stim("The height of a ball", "t (seconds)", "h(t) (meters)", list(zip(xs, ys)))
    stim["description"] = "The height $h$, in meters, of a ball $t$ seconds after it was thrown upward. A graphing calculator is required for these questions."
    parts = [
        part("A", "Use quadratic regression to find a model $Q(t)=at^2+bt+c$ for the data. Give each coefficient to three decimal places.", 2, "calculate", ["1", "2"], f"$Q(t)\\approx{fit[0]:.3f}t^2{fit[1]:+.3f}t{fit[2]:+.3f}$.", [R("A1", "Value of the leading coefficient a", [f"{fit[0]:.3f}"], nums=True, tol="±0.002"), R("A2", "Values of b and c", [f"{fit[1]:.3f}", f"{fit[2]:.3f}"], nums=True, tol="±0.01")]),
        part("B", f"Use the model $Q$ to predict the height of the ball at $t={x0}$ seconds.", 1, "calculate", ["2"], f"$Q({x0})\\approx{pred:.2f}$ meters.", [R("B1", "Predicted height with units", [f"{pred:.2f}"], nums=True, tol="±0.05", units=True)]),
        part("C", "According to the model $Q$, what is the greatest height of the ball, and at what time does it occur?", 2, "calculate", ["1", "2"], f"The maximum height is about {hmax:.2f} meters at $t\\approx{tmax:.3f}$ seconds.", [R("C1", "Time of the maximum", [f"{tmax:.3f}"], nums=True, tol="±0.01"), R("C2", "Maximum height value with units", [f"{hmax:.2f}"], requires="C1", nums=True, tol="±0.05", units=True)]),
        part("D", "According to the model $Q$, at what time does the ball hit the ground (height 0)?", 1, "calculate", ["1"], f"Solving $Q(t)=0$ for $t>0$ gives $t\\approx{tz:.3f}$ seconds.", [R("D1", "Time value", [f"{tz:.3f}"], nums=True, tol="±0.01", units=True)]),
    ]
    return _mn_pack_local("pref_mn_quadratic_ball", "1.14", "Ball height modeled with quadratic regression", stim, parts,
                 [f"xs={xs}", f"ys={ys}", f"c0={fit[0]:.4f}", f"c1={fit[1]:.4f}", f"c2={fit[2]:.4f}", f"x0={x0}", f"pred={pred:.3f}", f"tmax={tmax:.3f}", f"hmax={hmax:.3f}", f"tz={tz:.3f}"],
                 [_ev("A", "a", fit[0], 0.002), _ev("B", "prediction", pred, 0.05, "m"), _ev("C", "time of maximum", tmax, 0.01, "s"), _ev("C", "maximum height", hmax, 0.05, "m"), _ev("D", "time", tz, 0.01, "s")],
                 "Quadratic regression, vertex and zero of the fitted model", "exact normal equations in sympy rational arithmetic recompute the coefficients; the vertex formula and numpy roots recompute the maximum and the zero")


@retry_sep
def pref_mn_exp_cooling(rng):
    for _ in forever():
        a0 = pick(rng, [60.0, 80.0, 100.0]); b0 = pick(rng, [0.78, 0.84, 0.9]); xs = [0, 1, 2, 3, 4, 5, 6]
        ys = [round(a0 * b0 ** v * (1 + pick(rng, [-0.02, -0.01, 0, 0.015, 0.02])), 1) for v in xs]
        a, b = expo_fit(xs, ys); t0 = pick(rng, [8, 10]); pred = a * b ** t0; hl = math.log(0.5) / math.log(b); chk = _O.brentq(lambda v: b ** v - 0.5, 0, 500, xtol=1e-12); agree(hl, chk, 1e-8, "hl")
        if b < 0.95 and 2 < hl < 20:
            break
    stim = table_stim("The concentration of a pollutant in a lake", "t (weeks)", "C(t) (mg/L)", list(zip(xs, ys)))
    stim["description"] = "The concentration $C$, in milligrams per liter, of a pollutant in a lake $t$ weeks after a cleanup began. A graphing calculator is required for these questions."
    parts = [
        part("A", "Use exponential regression to find a model $E(t)=a\\cdot b^t$ for the data. Give $a$ and $b$ to three decimal places.", 2, "calculate", ["1", "2"], f"$E(t)\\approx{a:.3f}\\cdot {b:.3f}^t$.", [R("A1", "Value of a", [f"{a:.3f}"], nums=True, tol="±0.01"), R("A2", "Value of b", [f"{b:.3f}"], nums=True, tol="±0.001")]),
        part("B", f"Use the model $E$ to predict the concentration at $t={t0}$ weeks.", 1, "calculate", ["2"], f"$E({t0})\\approx{pred:.2f}$ mg/L.", [R("B1", "Predicted value with units", [f"{pred:.2f}"], nums=True, tol="±0.5% relative", units=True)]),
        part("C", "According to the model $E$, how many weeks does it take for the concentration to fall to half of its initial value $E(0)$?", 1, "calculate", ["1"], f"Solving $b^t=1/2$ gives $t\\approx{hl:.2f}$ weeks.", [R("C1", "Time value", [f"{hl:.2f}"], nums=True, tol="±0.02", units=True)]),
        part("D", f"Explain what the value of $b={b:.3f}$ tells you about how the concentration changes each week, and state whether the model predicts that the concentration ever reaches 0.", 2, "explain", ["3"], f"Each week the concentration is multiplied by {b:.3f}, a decrease of about {100 * (1 - b):.1f} percent per week; since the exponential decay function is always positive, the model never reaches 0 but approaches it.",
             [R("D1", "Interprets b as the weekly multiplier, a percent decrease per week", ["multiplied by b each week", "percent decrease"]), R("D2", "States that the model approaches 0 but never reaches it because an exponential function is always positive", ["never reaches 0", "approaches 0"], requires="D1")]),
    ]
    return _mn_pack_local("pref_mn_exp_cooling", "2.5", "Pollutant concentration modeled with exponential regression", stim, parts, [f"xs={xs}", f"ys={ys}", f"t0={t0}", f"a={a:.4f}", f"b={b:.4f}", f"pred={pred:.3f}", f"hl={hl:.3f}", f"pct={100 * (1 - b):.1f}"],
                         [_ev("A", "a", a, 0.01), _ev("A", "b", b, 0.001), _ev("B", "prediction", pred, max(0.5, 0.005 * pred), "mg/L"), _ev("C", "half-life", hl, 0.02, "weeks")],
                         "Exponential decay regression, half-life and interpretation of the base", "ln y regressed on t with normal equations recomputes a and b; brentq recomputes the half-life")


def _mn_pack_local(arch, topic, title, stim, parts, facts, expected, concept, path_):
    return _pack(arch, "mn", topic, ["2.5", "2.6", "1.14"], "2", "required", title, stim, parts, 17, facts, expected,
                 (concept, ["Use a graphing calculator to fit the model to the data", "Use the model to predict and to interpret its parameters"], [("the data come from the table and the model is a regression fit", "the stem names the data table")], {"type": "table", "must_include": ["the data table"]}, path_), ["representation_reading", "symbolic_reasoning", "justification"])


@retry_sep
def pref_mp_spring_cos(rng):
    A = pick(rng, [4, 6, 8, 10]); P = 24; d = lambda t_: A * math.cos(2 * math.pi * t_ / P)  # noqa: E731
    t1 = P / 8; v1 = d(t1); tgt = A / 2; sols = sorted(solve_all(lambda v: d(v) - tgt, 0, P - 1e-9, 20000)); agree(sols[0], P / 6, 1e-5, "t")
    stim = _txt(f"A mass hangs from a spring. At time $t=0$ seconds the mass is pulled ${A}$ centimeters below its rest position and released. The vertical displacement $d(t)$, in centimeters, of the mass from its rest position, with downward positive, is a sinusoidal function of $t$ with a period of ${P}$ seconds. No calculator is allowed.")
    parts = [
        part("A", "Find the amplitude and the midline of $d$.", 1, "calculate", ["1"], f"Amplitude ${A}$ centimeters, midline $y=0$.", [R("A1", "Amplitude and midline values", [f"{A}", "0"], nums=True)]),
        part("B", "Write an expression for $d(t)$ in the form $d(t)=a\\cos(bt)$.", 2, "calculate", ["1", "2"], f"$d(t)={A}\\cos\\left(\\dfrac{{2\\pi}}{{{P}}}t\\right)$.", [R("B1", "Expression with the amplitude as the coefficient", [f"{A}"]), R("B2", "Expression with b = 2 pi over the period", [f"2*pi/{P}"], requires="B1")]),
        part("C", f"Find the displacement of the mass at $t={P / 8:g}$ seconds. Give an exact value.", 1, "calculate", ["1"], f"$d({P / 8:g})={A}\\cos(\\pi/4)={A}\\sqrt{{2}}/2$ centimeters.", [R("C1", "Exact value of the displacement with units", [f"{A}*sqrt(2)/2"], nums=True, units=True)]),
        part("D", f"Find the first time $t>0$ at which the displacement is ${tgt:g}$ centimeters.", 2, "calculate", ["1", "2"], f"$\\cos\\left(\\dfrac{{2\\pi}}{{{P}}}t\\right)=1/2$ gives $\\dfrac{{2\\pi}}{{{P}}}t=\\pi/3$, so $t={P / 6:g}$ seconds.", [R("D1", "Equation setting the cosine factor equal to one half", ["cos(2 pi t / P) = 1/2"]), R("D2", "Value of the first time", [f"{P / 6:g}"], requires="D1", nums=True, units=True)]),
    ]
    return _pack("pref_mp_spring_cos", "mp", "3.7", ["3.5", "3.10", "3.6"], "1", "not_allowed", "A mass on a spring modeled by a cosine function", stim, parts, 15,
                 [f"A={A}", f"P={P}", f"t1={P / 8:g}", f"v1={A}*sqrt(2)/2", f"tgt={tgt:g}", f"t_first={P / 6:g}"],
                 [_ev("D", "first time", P / 6, 0.01, "s")],
                 ("A sinusoidal model of a spring-mass system written from its amplitude and period", ["Read amplitude and period from the description", "Write the cosine model from the starting position", "Solve at exact angles"], [("the mass is released from its lowest position at t=0", "the stem states the starting displacement")], {"type": "text", "must_include": ["the amplitude", "the period"]},
                  "numerical evaluation of the model at the claimed times"), ["symbolic_reasoning", "representation_reading"])


@retry_sep
def pref_mp_body_temperature(rng):
    D = pick(rng, [98.0, 98.6, 99.0]); A = pick(rng, [0.8, 1.0, 1.2]); tmax = pick(rng, [16, 17, 18]); P = 24
    T = lambda t_: D + A * math.cos(2 * math.pi * (t_ - tmax) / P)  # noqa: E731
    t1 = tmax + 6; v1 = T(t1); tgt = D + A / 2; sols = sorted(solve_all(lambda v: T(v) - tgt, 0, P - 1e-9, 20000)); cl = sorted(((tmax + 4) % P, (tmax - 4) % P)); agree(sols[0], cl[0], 1e-5, "t")
    stim = _txt(f"A person's body temperature $T(t)$, in degrees Fahrenheit, is modeled by a sinusoidal function of $t$, the number of hours after midnight. The highest temperature, ${D + A:g}^\\circ$F, occurs at $t={tmax}$ hours, and the period is ${P}$ hours. The midline value is ${D:g}^\\circ$F. No calculator is allowed.")
    parts = [
        part("A", "Find the amplitude of $T$ and the lowest temperature of the model.", 1, "calculate", ["1"], f"Amplitude ${A:g}^\\circ$F and lowest temperature ${D - A:g}^\\circ$F.", [R("A1", "Amplitude and lowest temperature values", [f"{A:g}", f"{D - A:g}"], nums=True, units=True)]),
        part("B", f"Write an expression for $T(t)$ in the form $T(t)=a\\cos(b(t-c))+d$.", 2, "calculate", ["1", "2"], f"$T(t)={A:g}\\cos\\left(\\dfrac{{\\pi}}{{12}}(t-{tmax})\\right)+{D:g}$.", [R("B1", "Expression with the amplitude and the midline value", [f"{A:g}", f"{D:g}"]), R("B2", "Expression with b = pi over 12 and the shift c", ["pi/12", f"(t-{tmax})"], alt=[f"c={tmax - 24} (shift by a full period)", "an equivalent sine form with a different shift"], requires="B1")]),
        part("C", f"Find the temperature at $t={t1}$ hours.", 1, "calculate", ["1"], f"$T({t1})={D:g}+{A:g}\\cos(\\pi/2)={D:g}^\\circ$F.", [R("C1", "Value with units", [f"{D:g}"], nums=True, units=True)]),
        part("D", f"Find the two times in the first {P} hours after midnight at which the temperature is ${tgt:g}^\\circ$F.", 2, "calculate", ["1", "2"], f"$\\cos\\left(\\frac{{\\pi}}{{12}}(t-{tmax})\\right)=1/2$ gives $t={cl[0]:g}$ and $t={cl[1]:g}$.", [R("D1", "Equation setting the cosine factor equal to one half", ["cos(pi/12 (t-c)) = 1/2"]), R("D2", "Both time values", [f"{cl[0]:g}", f"{cl[1]:g}"], requires="D1", nums=True)]),
    ]
    return _pack("pref_mp_body_temperature", "mp", "3.7", ["3.5", "3.10", "3.6"], "1", "not_allowed", "Body temperature modeled by a sinusoidal function", stim, parts, 16,
                 [f"D={D:g}", f"A={A:g}", f"tmax={tmax}", f"P={P}", f"t1={t1}", f"v1={D:g}", f"tgt={tgt:g}", f"cl0={cl[0]:g}", f"cl1={cl[1]:g}", f"low={D - A:g}"],
                 [_ev("C", "temperature", D, 0.01, "F"), _ev("D", "earlier time", cl[0], 0.01, "h"), _ev("D", "later time", cl[1], 0.01, "h")],
                 ("A sinusoidal temperature model with a phase shift evaluated at exact angles", ["Find amplitude and midline from the extreme values", "Write the cosine model with the phase shift", "Evaluate and solve at exact angles"], [("the maximum occurs at the stated time", "the stem states the time of the highest temperature")], {"type": "text", "must_include": ["the highest temperature", "the period", "the midline"]},
                  "numerical evaluation of the model at the claimed times and a sign-change scan for all solutions in the period"), ["symbolic_reasoning", "representation_reading"])


@retry_sep
def pref_sy_log_exp_model(rng):
    for _ in forever():
        a = pick(rng, [2, 3, 5]); b = pick(rng, [2, 3]); x1 = pick(rng, [2, 3, 4]); rhs = a * b ** (x1 - 1)
        k = pick(rng, [2, 3]); r = pick(rng, [1, 2]); z = pick(rng, [2, 4, 8]); sol_x = sp.symbols("x")
        # log_b(x) + log_b(x - r) = log_b(c0) with c0 = z (z - r)
        c0 = z * (z - r)
        if c0 > 0:
            break
    roots = sp.solve(sp.expand(sol_x * (sol_x - r) - c0), sol_x); valid = [t_ for t_ in roots if t_ > r]; assert len(valid) == 1; xv = valid[0]; ext = [t_ for t_ in roots if t_ != xv][0]
    m = pick(rng, [2, 3]); n_ = pick(rng, [1, 2])
    stim = _txt("No calculator is allowed. Give exact answers.")
    parts = [
        part("A", f"Solve the equation ${a}\\cdot {b}^{{x-1}}={rhs}$ for $x$.", 2, "calculate", ["1"], f"${b}^{{x-1}}={rhs // a}={b}^{{{x1 - 1}}}$, so $x={x1}$.", [R("A1", "Isolates the exponential by dividing by the coefficient", [f"{b}^(x-1)={rhs // a}"]), R("A2", "Solution x value", [f"{x1}"], requires="A1", nums=True)]),
        part("B", f"Solve the equation $\\log_{{{b}}}(x)+\\log_{{{b}}}(x-{r})=\\log_{{{b}}}({c0})$ for $x$. Verify that your solution is in the domain.", 2, "calculate", ["1"], f"$x(x-{r})={c0}$ has roots ${L(xv)}$ and ${L(ext)}$; only $x={L(xv)}$ is in the domain.", [R("B1", "Combines the logarithms and forms the quadratic equation", [f"x(x-{r})={c0}"]), R("B2", "Selects the solution in the domain and rejects the other", [f"{xv}"], requires="B1", nums=True)]),
        part("C", f"For positive $x$ and $y$, write ${m}\\ln x-{n_}\\ln y$ as a single logarithm.", 1, "calculate", ["1"], f"${m}\\ln x-{n_}\\ln y=\\ln\\left(\\dfrac{{x^{m}}}{{y^{n_}}}\\right)$.", [R("C1", "Expression as a single logarithm", [f"ln(x^{m}/y^{n_})"])]),
        part("D", f"The function $g$ is defined by $g(x)={k}\\log_{{{b}}}(x-1)+2$. Find an expression for $g^{{-1}}(x)$.", 1, "calculate", ["1"], f"$g^{{-1}}(x)={b}^{{(x-2)/{k}}}+1$.", [R("D1", "Expression for the inverse", [f"{b}^((x-2)/{k})+1"])]),
    ]
    return _pack("pref_sy_log_exp_model", "sy", "2.13", ["2.12", "2.8", "2.10"], "1", "not_allowed", "Exponential and logarithmic equations, logarithm properties and an inverse", stim, parts, 16,
                 [f"a={a}", f"b={b}", f"x1={x1}", f"rhs={rhs}", f"r={r}", f"c0={c0}", f"xv={xv}", f"ext={ext}", f"m={m}", f"n={n_}", f"k={k}"],
                 [_ev("A", "x", x1, 1e-9), _ev("B", "x", float(xv), 1e-9)],
                 ("Exact solution of an exponential equation, a logarithmic equation with a domain check, a logarithm property and an inverse", ["Rewrite with a common base", "Combine logarithms and check the domain", "Swap and solve for the inverse"], [("all answers are exact", "the stem asks for exact answers and no calculator is allowed")], {"type": "text", "must_include": ["the equations", "the function g"]},
                  "substitution of each solution into the original equation and a numerical composition of the inverse with g"), ["symbolic_reasoning"])


@retry_sep
def pref_sy_poly_zeros(rng):
    for _ in forever():
        r1 = pick(rng, [-3, -2, -1, 1, 2, 3]); q = pick(rng, [1, 2, 3]); a_ = pick(rng, [1, 2])
        P = sp.expand(a_ * (X - r1) * (X ** 2 + q * q)); break
    va = pick(rng, [-2, -1, 1, 2]); r2 = pick(rng, [v for v in (-3, -2, -1, 1, 2, 3) if v != va])
    crit = sorted([va, r2]); f = lambda v: (v - r2) / (v - va)  # noqa: E731
    pts = [-math.inf, *crit, math.inf]; pieces = []
    for i in range(3):
        mid = (pts[i] + pts[i + 1]) / 2 if math.isfinite(pts[i]) and math.isfinite(pts[i + 1]) else (pts[i + 1] - 1 if not math.isfinite(pts[i]) else pts[i] + 1)
        if f(mid) > 0:
            lo_t = "-\\infty" if not math.isfinite(pts[i]) else str(int(pts[i])); hi_t = "\\infty" if not math.isfinite(pts[i + 1]) else str(int(pts[i + 1]))
            lc = math.isfinite(pts[i]) and int(pts[i]) == r2; hc = math.isfinite(pts[i + 1]) and int(pts[i + 1]) == r2
            pieces.append(f"{'[' if lc else '('}{lo_t}, {hi_t}{']' if hc else ')'}")
    ans = "\\cup".join(pieces)
    nz = np.roots([float(c) for c in sp.Poly(P, X).all_coeffs()]); assert sum(1 for z in nz if abs(z.imag) > 1e-6) == 2
    stim = _txt(f"The polynomial function $p$ is defined by $p(x)={L(P)}$. No calculator is allowed. Give exact answers.")
    parts = [
        part("A", "Find all zeros of $p$, including any nonreal zeros.", 2, "calculate", ["1"], f"$p(x)={a_}(x-({r1}))(x^2+{q * q})$, so the zeros are $x={r1}$ and $x=\\pm {q}i$.", [R("A1", "Factors the polynomial", [f"(x-{r1})(x^2+{q * q})"]), R("A2", "Values of all zeros including the conjugate pair", [f"{r1}", f"{q}i", f"-{q}i"], requires="A1", nums=True)]),
        part("B", "Describe the end behavior of $p$ as $x\\to\\infty$ and as $x\\to-\\infty$.", 1, "explain", ["2"], f"Since the leading term is ${a_}x^3$ with a positive coefficient and odd degree, $p(x)\\to\\infty$ as $x\\to\\infty$ and $p(x)\\to-\\infty$ as $x\\to-\\infty$.", [R("B1", "States the end behavior at both ends using the leading term", ["p(x) → ∞ as x → ∞", "p(x) → -∞ as x → -∞"])]),
        part("C", f"Solve the inequality $\\dfrac{{x-({r2})}}{{x-({va})}}\\ge 0$. Give your answer in interval notation.", 2, "calculate", ["1"], f"The solution set is ${ans}$.", [R("C1", "Identifies the critical values from the zero and the vertical asymptote and tests the sign on each interval", [f"{r2}", f"{va}"]), R("C2", "Interval answer with the zero included and the asymptote excluded", [ans], requires="C1")]),
        part("D", f"Explain why $p$ has exactly one real zero.", 1, "explain", ["3"], f"The quadratic factor $x^2+{q * q}$ is positive for all real $x$, so it has no real zeros; the only real zero comes from the linear factor $x-({r1})$.", [R("D1", "States that the quadratic factor has no real zeros because it is always positive", ["x^2 + c is positive", "no real zeros"])]),
    ]
    return _pack("pref_sy_poly_zeros", "sy", "1.5", ["1.6", "1.8", "1.4"], "1", "not_allowed", "Polynomial zeros, end behavior and a rational inequality", stim, parts, 16,
                 [f"P={P}", f"r1={r1}", f"q={q}", f"a={a_}", f"r2={r2}", f"va={va}", f"ans={ans}"],
                 [_ev("A", "real zero", r1, 1e-9)],
                 ("Zeros including complex zeros, end behavior and a rational inequality solved exactly", ["Factor the polynomial", "Use the leading term for end behavior", "Do sign analysis for the inequality"], [("all answers are exact", "the stem asks for exact answers and no calculator is allowed")], {"type": "text", "must_include": ["the polynomial p"]},
                  "numpy roots of the polynomial and numerical sign evaluation of the rational expression on each interval"), ["symbolic_reasoning", "justification"])
