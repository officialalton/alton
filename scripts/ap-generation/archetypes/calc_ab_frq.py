from common import *
from scipy import integrate as _I
from scipy.optimize import brentq

def row(rid, pts, crit, req, opt=None, alt=None, err=None, requires=None, both=False, nums=False, tol=None, units=False):
    return {"row_id": rid, "points": pts, "criterion": crit, "required_elements": req, "optional_phrases": opt or [], "alt_solutions": alt or [], "common_errors": err or [],
            "requires_row_id": requires, "requires_both": both, "requires_numbers": nums, "numeric_tolerance": tol, "units_row": units}

def part(label, prompt, pts, mode, skills, answer, rows):
    assert sum(r["points"] for r in rows) == pts, (label, pts)
    return {"label": label, "prompt": prompt, "points": pts, "response_mode": mode, "skill_codes": skills, "model_answer": answer, "rubric_rows": rows}

def f3(v): return "%.3f" % v

# ------------------------------------------------------------------ F1: 표 자료 + 맥락(계산기)
def frq_table_rate(rng):
    p = rng.choice([20, 30, 40]); q = rng.choice([30, 40, 50]); s = rng.choice([4.0, 5.0, 6.0]); name, unit = rng.choice([("water flows out of a tank", "gallons per minute"), ("cars pass a checkpoint", "cars per minute"), ("data is downloaded", "megabytes per minute")])
    amount = unit.split(" per ")[0]
    Rm = lambda v: p + q * math.exp(-v / s)            # 감소 + 아래로 볼록
    ts = [0, 3, 7, 10, 12]; tab = [round(Rm(v), 1) for v in ts]
    # (a) 사다리꼴 4구간 + 해석
    trap = sum((tab[i] + tab[i + 1]) / 2 * (ts[i + 1] - ts[i]) for i in range(4))
    # (b) 왼쪽 합 vs 실제(R 감소 → 왼쪽 합은 과대)
    left = sum(tab[i] * (ts[i + 1] - ts[i]) for i in range(4)); exact = _I.quad(Rm, 0, 12)[0]
    assert left > exact and all(tab[i] > tab[i + 1] for i in range(4))
    # (c) 모형 평균값
    avg = exact / 12
    assert abs(numeric_integral(Rm, 0, 12) - exact) < 1e-6
    # (d) IVT: 인접 두 표 값 사이 k
    i = max(range(4), key=lambda j: abs(tab[j] - tab[j + 1])); hi, lo = tab[i], tab[i + 1]; k = round((lo + hi) / 2, 1); assert lo < k < hi
    rows_tab = [[str(a), str(b)] for a, b in zip(ts, tab)]
    stim = {"kind": "table", "description": f"Selected values of R(t), in {unit}", "data": {"x_label": "t (minutes)", "y_label": f"R(t) ({unit})", "rows": rows_tab}}
    prompts = {
        "a": f"At time $t$ minutes, {name} at the rate $R(t)$, measured in {unit}. $R$ is a decreasing differentiable function with the values shown in the table. Use a trapezoidal sum with the four subintervals indicated by the table to approximate $\\int_0^{{12}} R(t)\\,dt$. Using correct units, interpret the meaning of $\\int_0^{{12}} R(t)\\,dt$ in the context of the problem.",
        "b": "Is the left Riemann sum with the same four subintervals an overestimate or an underestimate of $\\int_0^{12} R(t)\\,dt$? Give a reason for your answer.",
        "c": f"The function $R$ is modeled by $M(t)={p}+{q}e^{{-t/{s:g}}}$ for $0\\le t\\le 12$. Find the average value of $M(t)$ over the interval $0\\le t\\le 12$. Show the setup for your calculations.",
        "d": f"Must there be a time $c$ with $0<c<12$ at which $R(c)={k}$? Justify your answer."}
    ivt_txt = f"R({ts[i]}) = {tab[i]} > {k} > R({ts[i+1]}) = {tab[i+1]}"
    parts = [
        part("a", prompts["a"], 3, "calculate", ["1.E", "3.F", "4.B"], f"Trapezoidal sum = {f3(trap)}; the total {amount} over the 12 minutes.", [
            row("a1", 1, "Form of the trapezoidal sum with the four subintervals", ["(" + f"({tab[0]}+{tab[1]})/2" + ")(3)+" + f"(({tab[1]}+{tab[2]})/2)(4)+(({tab[2]}+{tab[3]})/2)(3)+(({tab[3]}+{tab[4]})/2)(2)"], nums=True),
            row("a2", 1, "Approximation value", [f3(trap)], requires="a1", nums=True, tol="±0.001"),
            row("a3", 1, "Interpretation with units: total amount over 0 to 12 minutes", [f"total {amount} over the first 12 minutes"], units=True)]),
        part("b", prompts["b"], 2, "explain", ["1.F", "3.E"], "Overestimate: R is decreasing, so each left endpoint value is greater than the values on its subinterval.", [
            row("b1", 1, "States overestimate", ["overestimate"]), row("b2", 1, "Reason: R is decreasing, so left endpoint values are larger than the function values on each subinterval", ["R is decreasing", "left endpoints give the largest values"], both=True, requires="b1")]),
        part("c", prompts["c"], 2, "calculate", ["1.D", "1.E"], f"(1/12)∫₀¹² M(t) dt = {f3(avg)}", [
            row("c1", 1, "Definite integral with division by the length of the interval", ["(1/12)∫_0^12 M(t) dt"], alt=["∫_0^12 M(t) dt / 12"]), row("c2", 1, "Answer", [f3(avg)], requires="c1", nums=True, tol="±0.001 (3 decimals; at most one rounding point lost)")]),
        part("d", prompts["d"], 2, "explain", ["3.B", "3.C"], f"Yes. R is differentiable, hence continuous on [0,12]; {ivt_txt}, so by the Intermediate Value Theorem there is c.", [
            row("d1", 1, "States that R is continuous (differentiable implies continuous) on the interval", ["R is differentiable, so R is continuous"], err=["applies IVT without the continuity condition"]),
            row("d2", 1, "Conclusion: yes, using values on both sides of the target", [ivt_txt], both=True, nums=True, requires="d1")])]
    return {"archetype": "frq_table_rate", "template": "table_rate_context_calc", "topic": "6.2", "extra_topics": ["8.1"], "skill": "2.B", "calculator": "required", "title": "Rate table: trapezoidal sum, left sum, average value, IVT",
            "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"trap={trap}", f"left={left}", f"exact={exact}", f"avg={avg}", f"k={k}"]}

# ------------------------------------------------------------------ F2: f' 그래프 정당화(계산기 불가)
def frq_fprime_graph(rng):
    # f' 꼭짓점 (0..8, 간격 2): 값은 {0,±2,±4,±6}, 영점은 꼭짓점에서만 → 모든 넓이가 정수
    while True:
        v = [rng.choice([-4, -2, 0, 2, 4, 6]) for _ in range(5)]
        chg = [i for i in range(1, 4) if v[i] == 0 and v[i - 1] * v[i + 1] < 0]       # 부호 변화 영점(내부 꼭짓점)
        if len(chg) >= 2 and sorted(chg) == chg and len(set(v)) >= 4 and v[0] != 0 and v[4] != 0: break
    xs = [0, 2, 4, 6, 8]
    seg = lambda i: (v[i] + v[i + 1])            # 구간 i 의 넓이(폭 2 사다리꼴)
    f0 = rnd(rng, 1, 6)
    Fv = [sp.Rational(f0)]
    for i in range(4): Fv.append(Fv[-1] + seg(i))
    # (a) f' 증가 구간
    inc = [(xs[i], xs[i + 1]) for i in range(4) if v[i + 1] > v[i]]; dec = [(xs[i], xs[i + 1]) for i in range(4) if v[i + 1] < v[i]]
    # (b) 극값: 내부 꼭짓점 영점
    rel = {xs[i]: ("minimum" if v[i - 1] < 0 < v[i + 1] else "maximum") for i in chg}
    cand = [0, 8] + list(rel.keys()); vals = {c: Fv[xs.index(c)] for c in cand}
    amin = min(vals, key=lambda c: vals[c]); assert sorted(vals.values()).count(vals[amin]) == 1
    # 독립 수치 경로
    def fp(u):
        for i in range(4):
            if xs[i] <= u <= xs[i + 1]: return v[i] + (v[i + 1] - v[i]) * (u - xs[i]) / 2
    num = _I.quad(fp, 0, 8, points=[2, 4, 6])[0]; assert abs(num - float(Fv[4] - Fv[0])) < 1e-6
    stim = {"kind": "graph", "description": "The function f is continuous on [0,8] and has a continuous derivative f'. The graph of f', consisting of line segments connecting the labeled points, is shown.", "data": {"x_axis": "x", "y_axis": "f'(x)", "vertices": [[a, b] for a, b in zip(xs, v)], "domain": [0, 8]}}
    fmt_iv = lambda L: " and ".join(f"({a},{b})" for a, b in L) if L else "no interval"
    parts = [
        part("a", "On what open intervals in $(0,8)$ is the graph of $f$ concave up? Give a reason for your answer.", 2, "explain", ["2.E", "3.E"], f"Concave up on {fmt_iv(inc)} because f' is increasing there.", [
            row("a1", 1, "Intervals where f' is increasing", [fmt_iv(inc)], alt=["endpoints may be included"]), row("a2", 1, "Reason: f' is increasing (so f'' > 0) on those intervals", ["f' is increasing", "f'' is positive"], err=["only restates 'concave up'"])]),
        part("b", "Find the $x$-coordinate of each point at which $f$ has a relative extremum on $(0,8)$, and classify each as a relative minimum or relative maximum. Justify your answer.", 2, "explain", ["3.B", "3.E"],
             "; ".join(f"x = {k}: relative {w}" for k, w in rel.items()) + " because f' changes sign there.", [
            row("b1", 1, "Identifies the x-values where f' = 0 and changes sign", [f"x = {k}" for k in rel], nums=True), row("b2", 1, "Classifies each using the sign change of f' (negative to positive: minimum; positive to negative: maximum)", [f"{w} at x = {k}" for k, w in rel.items()], both=True)]),
        part("c", f"Given that $f(0)={f0}$, find the value of $x$ at which $f$ attains its absolute minimum on $[0,8]$. Justify your answer.", 3, "explain", ["3.B", "3.E"],
             f"Candidates {sorted(cand)} with f values {[ (c, str(vals[c])) for c in sorted(cand)]}; absolute minimum at x = {amin}.", [
            row("c1", 1, "Considers the relative-minimum location(s) and the endpoints as candidates", [f"x = {c}" for c in cand]), row("c2", 1, "Justification: compares the values of f at all candidates, using net area under f'", ["compares candidate values"], requires="c1"),
            row("c3", 1, "Answer", [f"x = {amin}"], requires="c2", nums=True)]),
        part("d", "Find $f(8)$.", 2, "calculate", ["1.E", "2.B"], f"f(8) = f(0) + ∫₀⁸ f'(x) dx = {Fv[4]}", [row("d1", 1, "Uses f(8) = f(0) + the integral of f' (signed areas)", ["f(0) + ∫_0^8 f'(x) dx"]), row("d2", 1, "Answer", [f"{Fv[4]}"], requires="d1", nums=True)])]
    return {"archetype": "frq_fprime_graph", "template": "fprime_graph_justify", "topic": "5.9", "extra_topics": ["5.6", "5.4"], "skill": "3.E", "calculator": "not_allowed", "title": "Analysis from the graph of f'",
            "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"inc={inc}", f"rel={rel}", f"amin={amin}", f"f8={Fv[4]}", f"f0={f0}"], "f0": f0, "preamble": "The function f is continuous on [0,8] and has a continuous derivative whose graph is shown."}

# ------------------------------------------------------------------ F3: 미분방정식(계산기 불가)
def frq_diffeq(rng):
    Ta = rng.choice([10, 20, 25]); H0 = Ta + rng.choice([40, 50, 60]); k = rng.choice([S(1) / 10, S(1) / 5, S(1) / 4]); D = rng.choice([2, 4, 5])
    H = sp.Function("H")
    sol = sp.dsolve(sp.Eq(H(t).diff(t), -k * (H(t) - Ta)), H(t), ics={H(0): H0}).rhs
    assert sp.simplify(sol - (Ta + (H0 - Ta) * sp.exp(-k * t))) == 0
    slope0 = -k * (H0 - Ta)
    approx = H0 + slope0 * D
    d2 = k * k * (H0 - Ta)   # H'' = k^2 (H-Ta) > 0 → 아래로 볼록 → 접선 근사는 과소추정
    under = d2 > 0
    # (a) 기울기장 표: 모든 점이 DE 를 만족하는 것에서 한 점만 부호가 틀린 가짜
    pts = [(0, H0), (2, H0 - 10), (4, Ta + 5), (6, Ta + 20)]
    true_sl = [-k * (hh - Ta) for _, hh in pts]
    bad_i = rng.randrange(len(pts)); shown = list(true_sl); shown[bad_i] = -true_sl[bad_i]
    verts = [[tt, hh, float(sl)] for (tt, hh), sl in zip(pts, shown)]
    stim = {"kind": "table", "description": "Slopes shown in a proposed slope field for dH/dt at selected points (t, H)", "data": {"x_label": "(t, H)", "y_label": "slope", "rows": [[f"({a}, {b})", f"{float(c):g}"] for a, b, c in verts]}}
    prompts = {
        "a": f"The temperature $H(t)$ of an object in a room satisfies $\\dfrac{{dH}}{{dt}}=-{sp.latex(k)}\\,(H-{Ta})$, where $H$ is in degrees Celsius and $t$ in minutes, with $H(0)={H0}$. Explain why the proposed slope field in the table could not be a slope field for this differential equation.",
        "b": "Find the slope of the line tangent to the graph of $H$ at $t=0$. Show the work that leads to your answer.",
        "c": f"For $t>0$ it is known that $H(t)>{Ta}$. It can be shown that $\\dfrac{{d^2H}}{{dt^2}}={sp.latex(k*k)}\\,(H-{Ta})$. The line tangent to the graph of $H$ at $t=0$ is used to approximate $H({D})$. Find that approximation, and state whether it is an overestimate or an underestimate of $H({D})$. Give a reason for your answer.",
        "d": f"Use separation of variables to find an expression for $H(t)$, the particular solution to the differential equation with $H(0)={H0}$."}
    parts = [
        part("a", prompts["a"], 1, "explain", ["2.C", "2.E"], f"At {pts[bad_i]} the differential equation gives slope {float(true_sl[bad_i]):g}, but the table shows {float(shown[bad_i]):g}; the sign is wrong.", [
            row("a1", 1, "Identifies a point where the proposed slope disagrees in sign (or value) with dH/dt computed from the equation, using H and t values", [f"at {pts[bad_i]}: slope should be {float(true_sl[bad_i]):g}"], nums=True, both=True)]),
        part("b", prompts["b"], 1, "calculate", ["1.E"], f"dH/dt at t=0 = {slope0}", [row("b1", 1, "Answer with work (substitutes H(0) into the differential equation)", [f"{slope0}"], nums=True)]),
        part("c", prompts["c"], 2, "calculate", ["3.E", "3.F"], f"H({D}) ≈ {approx}; since d²H/dt² > 0, the tangent line lies below the curve: underestimate.", [
            row("c1", 1, "Tangent line approximation value", [f"{approx}"], nums=True), row("c2", 1, f"Underestimate with reason: since H > {Ta} the second derivative is positive, so the graph is concave up and lies above its tangent line", ["underestimate", f"H > {Ta} so d²H/dt² > 0"], both=True)]),
        part("d", prompts["d"], 5, "calculate", ["1.C", "1.E"], f"H(t) = {Ta} + {H0 - Ta} e^({sp.latex(-k)} t)", [
            row("d1", 1, "Separates variables", [f"dH/(H-{Ta}) = {sp.latex(-k)} dt"]), row("d2", 1, "Antiderivatives of both sides", [f"ln|H-{Ta}| = {sp.latex(-k)}t + C"], requires="d1"),
            row("d3", 1, "Constant of integration (uses the initial condition)", ["uses H(0)"], requires="d2"), row("d4", 1, "Solves for H(t) (exponentiates, removes the absolute value using H > %d)" % Ta, [f"H - {Ta} = {H0-Ta} e^({sp.latex(-k)}t)"], requires="d3"),
            row("d5", 1, "Final expression", [f"{Ta} + {H0 - Ta} e^({sp.latex(-k)}t)"], requires="d4", nums=True)])]
    return {"archetype": "frq_diffeq", "template": "differential_equation", "topic": "7.7", "extra_topics": ["7.3", "7.4"], "skill": "1.E", "calculator": "not_allowed", "title": "Cooling object differential equation",
            "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"slope0={slope0}", f"approx={approx}", f"under={under}", f"solution={sol}"]}

# ------------------------------------------------------------------ F4: 면적·부피 설정(계산기)
def frq_area_volume(rng):
    c1 = rng.choice([2.0, 2.5, 3.0, 3.5]); c2 = rng.choice([0.5, 1.0, 1.5]); q = rng.choice([4, 5])
    f = lambda v: c1 + math.sin(v); g = lambda v: v * v / q + c2
    h0 = lambda v: f(v) - g(v)
    a = brentq(h0, 0.1, 6.0) if h0(0.1) > 0 else None
    assert a is not None and h0(0.0) > 0
    A = _I.quad(h0, 0, a)[0]
    V = _I.quad(lambda v: h0(v) ** 2, 0, a)[0]
    # 직선 y=-2 둘레 회전체(와셔)
    Vw_expr = f"\\pi\\int_0^{f3(a)}\\left[(\\sin x+{c1:g}+2)^2-(x^2/{q}+{c2:g}+2)^2\\right]dx"
    Vw = math.pi * _I.quad(lambda v: (f(v) + 2) ** 2 - (g(v) + 2) ** 2, 0, a)[0]
    # 독립 경로: sympy 로 식을 파싱해 수치 적분
    xx = sp.symbols("x"); Esym = sp.pi * ((sp.sin(xx) + c1 + 2) ** 2 - (xx ** 2 / q + c2 + 2) ** 2)
    assert abs(float(sp.Integral(Esym, (xx, 0, a)).evalf(8)) - Vw) < 1e-4
    # (d) 평행 접선: f'(x)=g'(x)
    d_ = brentq(lambda v: math.cos(v) - 2 * v / q, 0.01, a)
    stim = {"kind": "graph", "description": "Region R bounded by y-axis and the graphs of f and g", "data": {"f": f"f(x) = sin(x) + {c1:g}", "g": f"g(x) = x^2/{q} + {c2:g}", "region": f"between the graphs for 0 <= x <= {f3(a)} (first intersection)", "x_range": [0, f3(a)]}}
    parts = [
        part("a", f"Let $R$ be the region bounded by the graphs of $f(x)=\\sin x+{c1:g}$ and $g(x)=\\dfrac{{x^2}}{{{q}}}+{c2:g}$ and the $y$-axis, as shown. Find the area of $R$. Show the setup for your calculations.", 2, "calculate", ["1.D", "2.C"],
             f"Area = ∫₀^{f3(a)} (f(x) − g(x)) dx = {f3(A)}", [row("a1", 1, "Integral with upper curve minus lower curve and limits 0 and the intersection", [f"∫_0^{f3(a)} (f(x)-g(x)) dx"], nums=True), row("a2", 1, "Answer", [f3(A)], requires="a1", nums=True, tol="±0.001")]),
        part("b", "Region $R$ is the base of a solid. For this solid, each cross section perpendicular to the $x$-axis is a square. Find the volume of the solid. Show the setup for your calculations.", 2, "calculate", ["1.D", "2.C"],
             f"V = ∫₀^{f3(a)} (f(x) − g(x))² dx = {f3(V)}", [row("b1", 1, "Integrand is the square of the cross-section side (f-g)^2 with correct limits", [f"∫_0^{f3(a)} (f(x)-g(x))^2 dx"], nums=True), row("b2", 1, "Answer", [f3(V)], requires="b1", nums=True, tol="±0.001")]),
        part("c", "Write, but do not evaluate, an integral expression for the volume of the solid generated when $R$ is rotated about the horizontal line $y=-2$.", 3, "calculate", ["1.D", "3.D"],
             f"V = {Vw_expr} (≈ {f3(Vw)})", [row("c1", 1, "Form: pi times integral of (outer radius)^2 - (inner radius)^2", ["π∫(R²−r²)dx"]), row("c2", 1, "Outer radius f(x)+2 and inner radius g(x)+2", ["f(x)+2", "g(x)+2"], requires="c1"),
                                          row("c3", 1, "Limits 0 and the intersection, constant pi", [f"0 to {f3(a)}", "π"], requires="c2", nums=True)]),
        part("d", "Find the average value of $f(x)-g(x)$ over the interval $0\\le x\\le %s$." % f3(a), 2, "calculate", ["1.D", "1.E"],
             f"(1/{f3(a)}) ∫₀^{f3(a)} (f−g) dx = {f3(A / a)}", [row("d1", 1, "Integral of f - g divided by the interval length", [f"(1/{f3(a)})∫_0^{f3(a)} (f(x)-g(x)) dx"]), row("d2", 1, "Answer", [f3(A / a)], requires="d1", nums=True, tol="±0.001")])]
    return {"archetype": "frq_area_volume", "template": "area_volume_setup_calc", "topic": "8.4", "extra_topics": ["8.7", "8.8"], "skill": "1.D", "calculator": "required", "title": "Area, volume with squares, volume of revolution setup",
            "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"a={a}", f"A={A}", f"V={V}", f"Vw={Vw}", f"avg={A/a}"]}
