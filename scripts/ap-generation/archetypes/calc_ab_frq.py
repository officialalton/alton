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
    p = rng.choice([30, 40, 50]); q = rng.choice([8, 10, 12]); s = rng.choice([3.0, 4.0]); name, unit = rng.choice([("water flows into a tank", "gallons per minute"), ("cars pass a checkpoint", "cars per minute"), ("data is downloaded", "megabytes per second")])
    Rm = lambda v: p + q * math.sin(v / s)
    ts = [0, 3, 7, 10, 12]; tab = [round(Rm(v), 1) for v in ts]
    # (a) R'(5) 근사: [3,7]
    dq = (tab[2] - tab[1]) / (ts[2] - ts[1])
    # (b) 사다리꼴 4구간
    trap = sum((tab[i] + tab[i + 1]) / 2 * (ts[i + 1] - ts[i]) for i in range(4))
    # (c) 모형 평균값
    Iv = _I.quad(Rm, 0, 12)[0]; avg = Iv / 12
    assert abs(numeric_integral(Rm, 0, 12) - Iv) < 1e-6
    # (d) 값 k: 표의 두 인접 점 사이 -> IVT
    i = max(range(4), key=lambda j: abs(tab[j + 1] - tab[j]))
    lo, hi = sorted([tab[i], tab[i + 1]]); k = round((lo + hi) / 2, 1)
    assert lo < k < hi
    rows_tab = [[str(a), str(b)] for a, b in zip(ts, tab)]
    stim = {"kind": "table", "description": f"Selected values of R(t), in {unit}", "data": {"x_label": "t (minutes)", "y_label": f"R(t) ({unit})", "rows": rows_tab}}
    prompts = {
        "a": f"Approximate $R'(5)$ using the average rate of change of $R$ over the interval $3\\le t\\le 7$. Show the work that leads to your answer and indicate units of measure.",
        "b": f"Use a trapezoidal sum with the four subintervals indicated by the data in the table to approximate $\\int_0^{{12}} R(t)\\,dt$. Using correct units, interpret the meaning of $\\int_0^{{12}} R(t)\\,dt$ in the context of the problem.",
        "c": f"The rate is also modeled by $M(t)={p}+{q}\\sin\\left(\\dfrac{{t}}{{{s:g}}}\\right)$ for $0\\le t\\le 12$. Find the average value of $M(t)$ over the interval $0\\le t\\le 12$. Show the setup for your calculations.",
        "d": f"Is there a time $c$ with $0<c<12$ such that $R(c)={k}$? Justify your answer. (Assume $R$ is differentiable.)"}
    parts = [
        part("a", prompts["a"], 2, "calculate", ["2.B", "4.B"], f"R'(5) ≈ ({tab[2]} − {tab[1]})/(7 − 3) = {f3(dq)} {unit} per minute.", [
            row("a1", 1, "Approximation using values from the table", [f"({tab[2]} - {tab[1]})/(7 - 3)", f"{f3(dq)}"], tol="exact from table", nums=True),
            row("a2", 1, "Units of measure", [f"{unit} per minute"], units=True, requires="a1")]),
        part("b", prompts["b"], 3, "calculate", ["1.E", "3.F", "4.B"], f"Trapezoidal sum = {f3(trap)} {unit.split(' per ')[0]}; it is the total amount over the 12 minutes.", [
            row("b1", 1, "Form of the trapezoidal sum with the four subintervals", [f"((({tab[0]}+{tab[1]})/2)(3)+(({tab[1]}+{tab[2]})/2)(4)+(({tab[2]}+{tab[3]})/2)(3)+(({tab[3]}+{tab[4]})/2)(2))"], nums=True),
            row("b2", 1, "Approximation", [f3(trap)], requires="b1", nums=True, tol="±0.001"),
            row("b3", 1, "Interpretation with units: total amount over 0 to 12 minutes", [f"total {unit.split(' per ')[0]} over the first 12 minutes"], units=True)]),
        part("c", prompts["c"], 2, "calculate", ["1.D", "1.E"], f"(1/12)∫₀¹² M(t) dt = {f3(avg)}", [
            row("c1", 1, "Definite integral with division by the length of the interval", [f"(1/12)∫_0^12 M(t) dt"], alt=[f"∫_0^12 M(t) dt / 12"]),
            row("c2", 1, "Answer", [f3(avg)], requires="c1", nums=True, tol="±0.001 (3 decimals, one rounding point)")]),
        part("d", prompts["d"], 2, "explain", ["3.B", "3.C"], f"Yes. R is differentiable, hence continuous on [0,12]. Since R({ts[i]}) and R({ts[i+1]}) are {tab[i]} and {tab[i+1]} and {k} lies between them, the Intermediate Value Theorem gives c.", [
            row("d1", 1, "States that R is continuous (differentiable implies continuous) on the interval", ["R is differentiable, so R is continuous"], err=["states IVT without the hypothesis"]),
            row("d2", 1, "Answer yes with the IVT conclusion using values on both sides of the target", [f"R({ts[i]}) = {tab[i]} < {k} < R({ts[i+1]}) = {tab[i+1]}" if tab[i] < tab[i + 1] else f"R({ts[i]}) = {tab[i]} > {k} > R({ts[i+1]}) = {tab[i+1]}"], requires=None, both=True, nums=True)])]
    return {"archetype": "frq_table_rate", "template": "table_rate_context_calc", "topic": "6.2", "extra_topics": ["2.3", "8.1"], "skill": "2.B", "calculator": "required", "title": "Rate table, trapezoidal sum, average value, IVT",
            "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15,
            "facts": [f"R'(5)≈{dq}", f"trap={trap}", f"avg={avg}", f"k={k}"], "context": f"{name} at the rate R(t) {unit}", "unit": unit}

# ------------------------------------------------------------------ F2: f' 그래프 정당화(계산기 불가)
def frq_fprime_graph(rng):
    # f' 꼭짓점 (0,v0),(2,v1),(4,v2),(6,v3),(8,v4) — 부호 변화 위치가 정수가 되도록 값 설계
    while True:
        v = [rng.choice([-4, -2, 2, 4, 6]), rng.choice([-4, -2, 2, 4]), rng.choice([-4, -2, 2, 4]), rng.choice([-4, -2, 2, 4]), rng.choice([-4, -2, 2, 4, 6])]
        # 서로 인접 값의 부호가 바뀌는 구간이 2개 이상, 단조 구간 다양
        sc = sum(1 for i in range(4) if v[i] * v[i + 1] < 0)
        if sc >= 2 and len(set(v)) >= 4: break
    xs = [0, 2, 4, 6, 8]
    def fp(u):
        for i in range(4):
            if xs[i] <= u <= xs[i + 1]:
                return v[i] + (v[i + 1] - v[i]) * (u - xs[i]) / 2
    # 영점
    zeros = []
    for i in range(4):
        if v[i] * v[i + 1] < 0:
            zeros.append(sp.Rational(xs[i]) + sp.Rational(2) * sp.Rational(-v[i], v[i + 1] - v[i]))
    # f(0)=f0; f(x)=f0+∫0^x f'
    f0 = rnd(rng, 1, 6)
    def F(u):
        return sp.Rational(f0) + sp.integrate(sp.Piecewise(*[((v[i] + (v[i + 1] - v[i]) * (x - xs[i]) / 2), (x >= xs[i]) & (x <= xs[i + 1])) for i in range(4)]), (x, 0, u)) if False else None
    def seg_int(i, a, b):  # f' 선분 i 위 a..b 정적분
        sl = sp.Rational(v[i + 1] - v[i], 2)
        g = lambda u: sp.Rational(v[i]) * (u - xs[i]) + sl * (u - xs[i]) ** 2 / 2
        return g(sp.Rational(b)) - g(sp.Rational(a))
    def Fval(u):
        u = sp.Rational(u); tot = sp.Rational(f0)
        for i in range(4):
            a, b = xs[i], xs[i + 1]
            if u >= b: tot += seg_int(i, a, b)
            elif u > a: tot += seg_int(i, a, u)
        return tot
    # (a) 위로 볼록(f''>0) 구간 = f' 증가 구간
    inc = [(xs[i], xs[i + 1]) for i in range(4) if v[i + 1] > v[i]]
    # (b) 절대 최소: 후보 = 구간 끝점, f' 가 -→+ 인 영점
    cand = [sp.Rational(0), sp.Rational(8)] + [z for i, z in zip([j for j in range(4) if v[j] * v[j + 1] < 0], zeros) if v[i] < 0 < v[i + 1]]
    vals = {c: Fval(c) for c in cand}
    amin = min(vals, key=lambda c: vals[c])
    uniq = sorted(vals.values()).count(vals[amin]) == 1
    if not uniq: raise ValueError("tie")
    # (c) ∫0^8 f'(x)dx = f(8)-f(0)
    tot = Fval(8) - sp.Rational(f0)
    # (d) g(x)=x^2 f(x), g'(2)
    gp2 = 2 * 2 * Fval(2) + 4 * sp.Rational(v[1])
    assert all(float(vals[c]) == float(Fval(c)) for c in cand)
    # 독립 수치 경로
    num = _I.quad(fp, 0, 8, points=[2, 4, 6])[0]; assert abs(num - float(tot)) < 1e-6
    verts = "; ".join(f"({a}, {b})" for a, b in zip(xs, v))
    stim = {"kind": "graph", "description": "Graph of f' on [0,8], consisting of line segments connecting the labeled points", "data": {"x_axis": "x", "y_axis": "f'(x)", "vertices": [[a, b] for a, b in zip(xs, v)], "domain": [0, 8]}}
    inc_txt = " and ".join(f"({a},{b})" for a, b in inc) if inc else "no interval"
    parts = [
        part("a", "On what open intervals in $(0,8)$ is the graph of $f$ concave up? Give a reason for your answer.", 2, "explain", ["2.E", "3.E"], f"Concave up on {inc_txt} because f' is increasing there.", [
            row("a1", 1, "Intervals", [inc_txt], alt=["endpoints may be included"]), row("a2", 1, "Reason: f' is increasing (f'' > 0) on those intervals", ["f' is increasing", "f'' is positive"], err=["only restates 'concave up'"], requires=None)]),
        part("b", f"Given that $f(0)={f0}$, find the value of $x$ at which $f$ attains its absolute minimum on $[0,8]$. Justify your answer.", 3, "explain", ["3.B", "3.E"],
             f"Candidates {sorted(float(c) for c in cand)}; f values {[ (float(c), float(vals[c])) for c in cand ]}; absolute minimum at x = {amin}.", [
            row("b1", 1, "Considers x where f'(x)=0 and f' changes from negative to positive, and the endpoints, as candidates", [f"{c}" for c in cand]),
            row("b2", 1, "Justification: compares f at all candidates (using areas under f')", ["compares candidate values"], requires="b1"),
            row("b3", 1, "Answer", [f"x = {amin}"], requires="b2", nums=True)]),
        part("c", "Find the value of $\\displaystyle\\int_0^8 f'(x)\\,dx$.", 2, "calculate", ["1.E", "2.B"], f"Area computation = {tot}", [
            row("c1", 1, "Uses signed areas / antiderivative of f' on the segments", ["signed areas"]), row("c2", 1, "Answer", [f"{tot}"], requires="c1", nums=True)]),
        part("d", "Let $g(x)=x^2f(x)$. Find $g'(2)$. Show the work that leads to your answer.", 2, "calculate", ["1.E", "2.B"], f"g'(2) = 2·2·f(2) + 2²·f'(2) = {gp2}", [
            row("d1", 1, "Product rule", ["g'(x)=2x f(x)+x^2 f'(x)"]), row("d2", 1, "Answer", [f"{gp2}"], requires="d1", nums=True)])]
    return {"archetype": "frq_fprime_graph", "template": "fprime_graph_justify", "topic": "5.9", "extra_topics": ["5.6", "5.4"], "skill": "3.E", "calculator": "not_allowed", "title": "Analysis from the graph of f'",
            "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"inc={inc}", f"zeros={zeros}", f"amin={amin}", f"tot={tot}", f"g'(2)={gp2}", f"f0={f0}"], "f0": f0}

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
        "c": f"It can be shown that $\\dfrac{{d^2H}}{{dt^2}}={sp.latex(k*k)}\\,(H-{Ta})$. The line tangent to the graph of $H$ at $t=0$ is used to approximate $H({D})$. Find that approximation, and state whether it is an overestimate or an underestimate of $H({D})$. Give a reason for your answer.",
        "d": f"Use separation of variables to find an expression for $H(t)$, the particular solution to the differential equation with $H(0)={H0}$."}
    parts = [
        part("a", prompts["a"], 1, "explain", ["2.C", "2.E"], f"At {pts[bad_i]} the differential equation gives slope {float(true_sl[bad_i]):g}, but the table shows {float(shown[bad_i]):g}; the sign is wrong.", [
            row("a1", 1, "Identifies a point where the proposed slope disagrees in sign (or value) with dH/dt computed from the equation, using H and t values", [f"at {pts[bad_i]}: slope should be {float(true_sl[bad_i]):g}"], nums=True, both=True)]),
        part("b", prompts["b"], 1, "calculate", ["1.E"], f"dH/dt at t=0 = {slope0}", [row("b1", 1, "Answer with work (substitutes H(0) into the differential equation)", [f"{slope0}"], nums=True)]),
        part("c", prompts["c"], 2, "calculate", ["3.E", "3.F"], f"H({D}) ≈ {approx}; since d²H/dt² > 0, the tangent line lies below the curve: underestimate.", [
            row("c1", 1, "Tangent line approximation value", [f"{approx}"], nums=True), row("c2", 1, "Underestimate with reason: second derivative positive so the graph is concave up", ["underestimate", "d²H/dt² > 0"], both=True)]),
        part("d", prompts["d"], 5, "calculate", ["1.C", "1.E"], f"H(t) = {Ta} + {H0 - Ta} e^({sp.latex(-k)} t)", [
            row("d1", 1, "Separates variables", ["dH/(H-Ta) = -k dt"]), row("d2", 1, "Antiderivatives of both sides (ln|H-Ta| = -kt + C)", ["ln|H - Ta|", "-kt"], requires="d1"),
            row("d3", 1, "Constant of integration (uses the initial condition)", ["uses H(0)"], requires="d2"), row("d4", 1, "Solves for H(t) (exponentiates, removes absolute value correctly)", [f"H - {Ta} = {H0-Ta} e^(...)"], requires="d3"),
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
        part("d", "Find the value of $x$, for $0<x<%s$, at which the line tangent to the graph of $f$ is parallel to the line tangent to the graph of $g$." % f3(a), 2, "calculate", ["1.C", "1.E"],
             f"f'(x) = g'(x): cos x = 2x/{q}, x = {f3(d_)}", [row("d1", 1, "Sets f'(x) = g'(x)", [f"cos x = 2x/{q}"]), row("d2", 1, "Answer", [f3(d_)], requires="d1", nums=True, tol="±0.001")])]
    return {"archetype": "frq_area_volume", "template": "area_volume_setup_calc", "topic": "8.4", "extra_topics": ["8.7", "8.8"], "skill": "1.D", "calculator": "required", "title": "Area, volume with squares, volume of revolution setup",
            "stimulus": stim, "parts": parts, "total_points": 9, "est_minutes": 15, "facts": [f"a={a}", f"A={A}", f"V={V}", f"Vw={Vw}", f"d={d_}"]}
