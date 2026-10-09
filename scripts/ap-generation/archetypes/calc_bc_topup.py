"""BC 단원 9·10 보강 MC 원형(2026-10-09): 스킬 2(표현 연결) + 그래프/표 자료. 모든 값은 코드가 계산하고 독립 수치 경로로 재확인한다."""
from common import *
from bp import mc_blueprint
from scipy import integrate as _I

SUB = "ap_calculus_bc"

def _graph(desc, xlabel, ylabel, verts, dom):
    return {"kind": "graph", "description": desc, "data": {"x_axis": xlabel, "y_axis": ylabel, "vertices": [list(v) for v in verts], "domain": list(dom)}}

def _pl(xs, v):
    def f(u):
        for i in range(len(xs) - 1):
            if xs[i] <= u <= xs[i + 1]: return v[i] + (v[i + 1] - v[i]) * (u - xs[i]) / (xs[i + 1] - xs[i])
    return f

def _opts(ds):
    return [Opt(fmt(k), False, w, k) for w, k in ds]

def _bp(arch, topic, skill, concept, thinking, cond, mis, path, mat):
    return mc_blueprint(arch, SUB, topic, skill, "not_allowed", concept, thinking, cond, mis, path, material=mat)

# 1) 매개변수 운동: x'(t) 그래프에서 x(b)  (9.5)
def param_xvel_graph(rng):
    xs = [0, 2, 4, 6, 8]
    while True:
        v = [rng.choice([-4, -2, 0, 2, 4, 6]) for _ in xs]
        if any(a * b < 0 for a, b in zip(v, v[1:])) or v.count(0) > 1 or all(a >= 0 for a in v): continue
        break
    x0 = rnd(rng, 1, 6); b = rng.choice([4, 6, 8]); n = b // 2
    seg = [v[i] + v[i + 1] for i in range(4)]; val = x0 + sum(seg[:n])
    f = _pl(xs, v)
    if abs(x0 + _I.quad(f, 0, b, points=[2, 4, 6][: max(0, n - 1)])[0] - val) > 1e-6: raise ValueError("independent_check_failed")
    ds = [("Reports only the signed area and forgets the initial position x(0).", sum(seg[:n])), ("Counts only the positive area and ignores the negative signed area.", x0 + sum(max(0, s) for s in seg[:n])),
          ("Uses width 1 instead of width 2 for each trapezoid.", x0 + sum(seg[:n]) / 2), ("Reads x'(%d) from the graph as if it were the position x(%d)." % (b, b), f(b))]
    pool = []; used = {val}
    for w_, k in ds:
        if k not in used: used.add(k); pool.append(Opt(fmt(k), False, w_, k))
    if len(pool) < 3: raise ValueError("not_enough_distractors")
    stem = f"A particle moves in the $xy$-plane. Its horizontal velocity $x'(t)$ for $0\\le t\\le 8$ is given by the graph shown, which consists of line segments. The particle's $x$-coordinate at $t=0$ is ${x0}$. What is the $x$-coordinate of the particle at $t={b}$?"
    key = Opt(fmt(val), True, "x(b) = x(0) plus the signed area under the graph of x' from 0 to b (trapezoids, negative below the axis).", val)
    bp = _bp("param_xvel_graph", "9.5", "2.B", "Recover a position coordinate from the graph of its velocity component", ["Read the vertices of the graph of x'", "Compute signed trapezoid areas from 0 to the upper limit", "Add the initial position"],
             [("x(b)-x(0) equals the integral of x' and x' is piecewise linear", "stated by the graph (line segments)")], [("forgets_initial", "reports displacement only"), ("ignores_negative", "counts only positive area"), ("wrong_width", "wrong subinterval width")],
             "signed area from adaptive numerical integration of the piecewise-linear x' (independent of the trapezoid formula)", {"type": "graph", "must_include": ["vertices of x' at t = 0, 2, 4, 6, 8"]})
    return pack("param_xvel_graph", "9.5", "2.B", "not_allowed", stem, key, pool, rng, stimulus=_graph("Graph of x'(t), consisting of line segments connecting the plotted vertices.", "t", "x'(t)", list(zip(xs, v)), [0, 8]), est=85, facts=[f"v={v}", f"x({b})={val}"], extra={"blueprint": bp})

# 2) 극좌표 넓이: r=f(theta) 그래프 (9.8)
def polar_area_graph(rng):
    xs = [0, 1, 2, 3]
    while True:
        v = [rng.choice([1, 2, 3, 4]) for _ in xs]
        if len(set(v)) >= 3: break
    b = rng.choice([2, 3]); f = _pl(xs, v)
    val = S(0)
    for i in range(b): val += S(v[i] ** 2 + v[i] * v[i + 1] + v[i + 1] ** 2) / 6
    if abs(float(val) - 0.5 * _I.quad(lambda u: f(u) ** 2, 0, b, points=list(range(1, b)))[0]) > 1e-6: raise ValueError("independent_check_failed")
    noh = 2 * val; trap = S(sum(v[i] ** 2 + v[i + 1] ** 2 for i in range(b))) / 4; area_r = S(sum(v[i] + v[i + 1] for i in range(b))) / 4; sq = S(sum(v[i] + v[i + 1] for i in range(b))) ** 2 / 8
    ds = [("Omits the factor 1/2 in the polar area formula.", noh), ("Approximates the integral of r^2 by trapezoids on the squared vertex values, but the graph of r is linear so r^2 is not.", trap), ("Computes (1/2) times the integral of r instead of r squared.", area_r), ("Squares the integral of r instead of integrating r squared.", sq)]
    pool = []; used = {val}
    for w_, k in ds:
        if k not in used: used.add(k); pool.append(Opt(fmt(k), False, w_, k))
    if len(pool) < 3: raise ValueError("not_enough_distractors")
    stem = f"For $0\\le\\theta\\le 3$, the polar curve $r=f(\\theta)$ has the graph of $r$ versus $\\theta$ shown, consisting of line segments. What is the area of the region enclosed by the curve and the rays $\\theta=0$ and $\\theta={b}$?"
    key = Opt(fmt(val), True, "Area = (1/2) times the integral of r^2 d(theta); on each linear piece the integral of r^2 is (r0^2 + r0 r1 + r1^2)/3.", val)
    bp = _bp("polar_area_graph", "9.8", "2.B", "Use a graph of r versus theta to set up and evaluate a polar area", ["Read the vertices of r from the graph", "Integrate r squared over each linear piece", "Multiply by 1/2"],
             [("r >= 0 on the interval so the region is swept once", "all plotted r values are positive")], [("no_half", "omits the factor 1/2 in the area"), ("trapezoid_on_square", "applies trapezoids to r^2"), ("area_of_r", "uses r instead of r^2")],
             "scipy quad of (1/2)f^2 with f the piecewise-linear interpolant (independent of the closed form)", {"type": "graph", "must_include": ["vertices of r at theta = 0, 1, 2, 3"]})
    return pack("polar_area_graph", "9.8", "2.B", "not_allowed", stem, key, pool, rng, stimulus=_graph("Graph of r = f(theta), consisting of line segments connecting the plotted vertices.", "θ", "r", list(zip(xs, v)), [0, 3]), est=95, facts=[f"v={v}", f"A={val}"], extra={"blueprint": bp})

# 3) 극좌표: r'(theta) 그래프에서 r 의 상대 최댓값 (9.7)
def polar_rprime_graph(rng):
    xs = [0, 2, 4, 6, 8]
    while True:
        v = [rng.choice([-4, -2, 0, 2, 4]) for _ in xs]
        if v[0] == 0 or v[4] == 0: continue
        zeros = [i for i in (1, 2, 3) if v[i] == 0]
        chg = [i for i in zeros if v[i - 1] * v[i + 1] < 0]; touch = [i for i in zeros if v[i - 1] * v[i + 1] > 0]
        if len(chg) == 1 and len(touch) >= 1 and (v[chg[0] - 1] > 0 > v[chg[0] + 1]): break
    kmax = xs[chg[0]]; kt = xs[touch[0]]
    kpeak = xs[max(range(1, 4), key=lambda i: v[i])]; kvalley = xs[min(range(1, 4), key=lambda i: v[i])]
    whys = {kt: "Treats a zero of r' where the sign does not change as a maximum of r.", kpeak: "Confuses the maximum of the graph of r' with the maximum of r.", kvalley: "Confuses the minimum of the graph of r' with the maximum of r."}
    pool = []; used = {kmax}
    for k in [kt, kpeak, kvalley, 0, 2, 4, 6, 8]:
        if k not in used and len(pool) < 3: used.add(k); pool.append(Opt("$\\theta=%d$" % k, False, whys.get(k, "Reads a vertex of the graph of r' without checking for a sign change from positive to negative."), k))
    if len(pool) < 3: raise ValueError("not_enough_distractors")
    f = _pl(xs, v); grid = [i / 100 for i in range(1, 800)]
    ch = [round(grid[i], 1) for i in range(1, len(grid) - 1) if f(grid[i - 1]) > 1e-9 and f(grid[i + 1]) < -1e-9 and abs(f(grid[i])) < 0.05]
    if not ch or abs(ch[0] - kmax) > 0.2: raise ValueError("independent_check_failed")
    stem = "The polar curve $r=r(\\theta)$ has $r(\\theta)>0$ for $0\\le\\theta\\le 8$. The graph of $r'(\\theta)$, consisting of line segments, is shown. At which value of $\\theta$ is the distance from the origin to the curve a relative maximum?"
    key = Opt("$\\theta=%d$" % kmax, True, "r' changes from positive to negative there, so r (the distance from the origin) has a relative maximum.", kmax)
    bp = _bp("polar_rprime_graph", "9.7", "2.E", "Relate the graph of r' to relative extrema of r in polar form", ["Read the zeros of r' from the graph", "Find the zero where r' changes from positive to negative", "Reject zeros where r' touches zero without changing sign"],
             [("r is differentiable with r > 0 so distance from the origin equals r", "stated in the stem")], [("touch_zero", "treats any zero as extremum"), ("max_of_rprime", "confuses maximum of r' with maximum of r"), ("min_of_rprime", "confuses minimum of r' with maximum of r")],
             "sign change located by dense numerical sampling of the piecewise-linear r' (independent of the vertex list)", {"type": "graph", "must_include": ["vertices of r' at theta = 0, 2, 4, 6, 8"]})
    return pack("polar_rprime_graph", "9.7", "2.E", "not_allowed", stem, key, pool, rng, stimulus=_graph("Graph of r'(theta), consisting of line segments connecting the plotted vertices.", "θ", "r'(θ)", list(zip(xs, v)), [0, 8]), est=80, facts=[f"v={v}", f"max_at={kmax}"], extra={"blueprint": bp})

# 4) 라그랑주 오차: f^(4) 그래프에서 M 을 읽어 상한 (10.12)
def lagrange_graph(rng):
    xs = [0, 1, 2, 3, 4]
    while True:
        v = [rng.choice([-6, -4, -3, -2, 0, 2, 3, 4]) for _ in xs]; a = rng.choice([2, 3])
        Ma = max(abs(u) for u in v[: a + 1]); Mall = max(abs(u) for u in v); mx = max(v[: a + 1])
        if Ma != Mall and Ma != mx and Ma > 0: break
    n = 3; key_v = S(Ma) * a ** 4 / 24
    f = _pl(xs, v)
    if abs(max(abs(f(i / 100)) for i in range(0, a * 100 + 1)) - Ma) > 1e-9: raise ValueError("independent_check_failed")
    ds = [("Uses the largest signed value of the graph instead of the largest absolute value.", S(mx) * a ** 4 / 24), ("Takes the maximum over the whole graph instead of only the interval from 0 to %d." % a, S(Mall) * a ** 4 / 24),
          ("Divides by 3! instead of 4!.", S(Ma) * a ** 4 / 6), ("Uses the power %d instead of 4 for the x-term." % 3, S(Ma) * a ** 3 / 24)]
    pool = []; used = {key_v}
    for w_, k in ds:
        if k not in used and k != 0: used.add(k); pool.append(Opt(fmt(k), False, w_, k))
    if len(pool) < 3: raise ValueError("not_enough_distractors")
    stem = f"The function $f$ has derivatives of all orders. The graph of $y=f^{{(4)}}(x)$ on $0\\le x\\le 4$, consisting of line segments, is shown. Let $P_3$ be the third-degree Maclaurin polynomial for $f$. Which of the following is the Lagrange error bound for $|f({a})-P_3({a})|$ obtained from the graph?"
    key = Opt(fmt(key_v), True, "M a^4 / 4! with M the maximum of |f^(4)| on [0, a], read from the graph.", key_v)
    bp = _bp("lagrange_graph", "10.12", "2.B", "Read a bound on a derivative from its graph and apply the Lagrange error bound", ["Read the largest absolute value of f^(4) on [0, a] from the graph", "Apply M|x|^(n+1)/(n+1)! with n = 3"],
             [("|f^(4)| <= M on [0, a] holds for the graph's maximum absolute value", "piecewise-linear graph, maximum at a vertex")], [("signed_max", "uses the maximum signed value"), ("wrong_interval", "uses a maximum from outside [0, a]"), ("wrong_factorial", "uses 3! instead of 4!")],
             "maximum absolute value found by dense sampling of the piecewise-linear graph (independent of vertex reading)", {"type": "graph", "must_include": ["vertices of f^(4) at x = 0, 1, 2, 3, 4"]})
    return pack("lagrange_graph", "10.12", "2.B", "not_allowed", stem, key, pool, rng, stimulus=_graph("Graph of f^(4)(x), consisting of line segments connecting the plotted vertices.", "x", "f⁽⁴⁾(x)", list(zip(xs, v)), [0, 4]), est=100, facts=[f"v={v}", f"bound={key_v}"], extra={"blueprint": bp})

# 5) 교대급수 오차 한계: 항의 표 (10.10)
def alt_series_table(rng):
    k = rng.choice([2, 3, 5]); b = [S(k * 6) / ((n + 1) * (n + 2) * 1) for n in range(1, 7)]
    b = [S(36 * k) / (n * n + 5 * n + 6) for n in range(1, 7)]
    assert all(b[i] > b[i + 1] > 0 for i in range(5))
    N = rng.choice([3, 4]); key_v = b[N]; s = sum(((-1) ** (i)) * b[i] for i in range(N))
    rows = [[str(n), sp.latex(b[n - 1]).replace("\\frac", "").replace("{", "").replace("}", "/") if False else str(b[n - 1])] for n in range(1, 7)]
    ds = [("Uses the last term included in the partial sum, b_%d, as the bound." % N, b[N - 1]), ("Uses the term two steps after the partial sum, b_%d." % (N + 2), b[N + 1]), ("Reports the partial sum S_%d itself." % N, s), ("Uses the difference b_%d - b_%d of consecutive terms." % (N + 1, N + 2), b[N] - b[N + 1])]
    pool = []; used = {key_v}
    for w_, kk in ds:
        if kk not in used and kk > 0: used.add(kk); pool.append(Opt(fmt(kk), False, w_, kk))
    if len(pool) < 3: raise ValueError("not_enough_distractors")
    stem = f"The alternating series $\\sum_{{n=1}}^{{\\infty}}(-1)^{{n+1}}b_n$ has terms $b_n>0$ that decrease to $0$. The table shows values of $b_n$. The partial sum $S_{N}$ of the first ${N}$ terms is used to approximate the sum of the series. What is the alternating series error bound for this approximation?"
    key = Opt(fmt(key_v), True, "The error is at most the magnitude of the first omitted term, b_%d." % (N + 1), key_v)
    bp = _bp("alt_series_table", "10.10", "2.B", "Read the first omitted term from a table to bound an alternating series error", ["Identify the first omitted term b_(N+1)", "Look up b_(N+1) in the table"],
             [("terms decrease to 0 so the alternating series error bound applies", "stated in the stem")], [("last_included", "uses the last included term"), ("wrong_index", "uses a later term"), ("partial_sum", "reports the partial sum")],
             "exact rational recomputation of the table and partial sum with sympy (independent of the option builder)", {"type": "table", "must_include": ["n = 1..6", "b_n"]})
    return pack("alt_series_table", "10.10", "2.B", "not_allowed", stem, key, pool, rng, stimulus=table_stimulus("Values of b_n", "n", [[str(n), str(b[n - 1])] for n in range(1, 7)], "b_n"), est=75, facts=[f"N={N}", f"bound={key_v}"], extra={"blueprint": bp})

# 6) 테일러 다항식: 미분값 표 (10.11)
def taylor_table(rng):
    d = [rnd(rng, -3, 6, nonzero=False) for _ in range(4)]
    if d[2] == 0 and d[3] == 0: raise ValueError("degenerate")
    a = rng.choice([1, 2]); val = S(d[0]) + d[1] * a + S(d[2]) * a ** 2 / 2 + S(d[3]) * a ** 3 / 6
    ds = [("Omits the factorials: f(0) + f'(0)x + f''(0)x^2 + f'''(0)x^3.", d[0] + d[1] * a + d[2] * a ** 2 + d[3] * a ** 3), ("Divides each term by n instead of n!.", S(d[0]) + d[1] * a + S(d[2]) * a ** 2 / 2 + S(d[3]) * a ** 3 / 3),
          ("Leaves out the cubic term.", S(d[0]) + d[1] * a + S(d[2]) * a ** 2 / 2), ("Evaluates the derivatives at x instead of using the values at 0 in the polynomial (reports f'''(0) x^3/3! only).", S(d[3]) * a ** 3 / 6)]
    pool = []; used = {val}
    for w_, k in ds:
        if k not in used: used.add(k); pool.append(Opt(fmt(k), False, w_, k))
    if len(pool) < 3: raise ValueError("not_enough_distractors")
    rows = [[str(i), str(d[i])] for i in range(4)]
    stem = f"The table gives the values of $f^{{(n)}}(0)$ for a function $f$ with derivatives of all orders. Let $P_3(x)$ be the third-degree Maclaurin polynomial for $f$. What is $P_3({a})$?"
    key = Opt(fmt(val), True, "P3(x) = f(0) + f'(0)x + f''(0)x^2/2! + f'''(0)x^3/3!, with the table values.", val)
    bp = _bp("taylor_table", "10.11", "2.B", "Build a Taylor polynomial from tabulated derivative values", ["Read f(0), f'(0), f''(0), f'''(0) from the table", "Divide each derivative by its factorial and evaluate at the given x"],
             [("The Maclaurin coefficients are f^(n)(0)/n!", "definition of a Maclaurin polynomial")], [("no_factorials", "omits the factorials"), ("divide_by_n", "divides by n instead of n!"), ("missing_term", "drops the cubic term")],
             "exact rational evaluation of the polynomial with sympy and a numeric Horner check", {"type": "table", "must_include": ["n = 0..3", "f^(n)(0)"]})
    return pack("taylor_table", "10.11", "2.B", "not_allowed", stem, key, pool, rng, stimulus={"kind": "table", "description": "Values of the derivatives of f at 0", "data": {"x_label": "n", "y_label": "f^(n)(0)", "rows": rows}}, est=85, facts=[f"d={d}", f"P3={val}"], extra={"blueprint": bp})

# 7) 극좌표: 표에서 원점과의 거리가 감소하는 θ (9.7)
def polar_table_distance(rng):
    th = [rng.choice([1, 2, 3, 4]) for _ in range(1)]; ths = rng.sample([1, 2, 3, 4, 5, 6], 4)
    kinds = ["key", "pp", "nn", "pp2"]; rng.shuffle(kinds)
    rows = []; keyth = None
    for t, kd in zip(ths, kinds):
        if kd == "key": r_, rp = rnd(rng, 1, 4), -rnd(rng, 1, 4); keyth = t
        elif kd == "nn": r_, rp = -rnd(rng, 1, 4), -rnd(rng, 1, 4)
        else: r_, rp = rnd(rng, 1, 4), rnd(rng, 1, 4)
        rows.append([str(t), str(r_), str(rp)])
    assert sum(1 for rr in rows if int(rr[1]) * int(rr[2]) < 0) == 1
    whys = {"nn": "r' is negative, but r is also negative, so |r| is increasing.", "pp": "r' is positive at this angle, so the distance from the origin is increasing, not decreasing.", "pp2": "Both r and r' are positive here, so r and |r| grow together; r' > 0 never signals a decreasing distance."}
    kmap = dict(zip(ths, kinds))
    pool = [Opt("$\\theta=%d$" % t, False, whys[kmap[t]], t) for t in ths if t != keyth]
    key = Opt("$\\theta=%d$" % keyth, True, "r and r' have opposite signs, so |r| is decreasing.", keyth)
    stem = "A polar curve is given by $r=r(\\theta)$. The table shows values of $r$ and $r'$ at selected values of $\\theta$. At which value of $\\theta$ is the distance from the origin to the curve decreasing?"
    bp = _bp("polar_table_distance", "9.7", "2.D", "Relate the signs of r and r' to the distance from the origin", ["Read r and r' for each theta", "The distance |r| decreases exactly when r and r' have opposite signs"],
             [("distance from the origin is |r| and d|r|/dθ = sign(r) r'", "polar coordinates definition")], [("sign_of_rprime_only", "uses r' alone"), ("negative_r", "ignores that r is negative"), ("positive_rprime", "treats r' > 0 as decreasing")],
             "numeric evaluation of the sign of r*r' on every table row (independent of how the key was chosen)", {"type": "table", "must_include": ["theta", "r", "r'"]})
    return pack("polar_table_distance", "9.7", "2.D", "not_allowed", stem, key, pool, rng, stimulus={"kind": "table", "description": "Values of r and r'", "data": {"columns": ["θ", "r(θ)", "r'(θ)"], "rows": rows}}, est=80, facts=[f"key={keyth}"], extra={"blueprint": bp})

# 8) 매개변수: 표의 x'(t), y'(t) 에서 속력 (9.6)
def param_speed_table(rng):
    tri = rng.choice([(3, 4, 5), (6, 8, 10), (5, 12, 13), (8, 15, 17)]); sx, sy = rng.choice([1, -1]), rng.choice([1, -1])
    ts = [0, 1, 2, 3]; t0 = rng.choice([1, 2, 3]); rows = []
    for t in ts:
        if t == t0: rows.append([str(t), str(sx * tri[0]), str(sy * tri[1])])
        else: rows.append([str(t), str(rnd(rng, -6, 6)), str(rnd(rng, -6, 6))])
    a, b_ = sx * tri[0], sy * tri[1]
    ds = [("Adds the absolute values of the components instead of using the Pythagorean combination.", abs(a) + abs(b_)), ("Reports the slope dy/dx = y'/x' instead of the speed.", S(b_) / a), ("Reports x'(t) alone.", a), ("Does not take the square root: (x')^2 + (y')^2.", a * a + b_ * b_)]
    pool = []; used = {tri[2]}
    for w_, k in ds:
        if k not in used: used.add(k); pool.append(Opt(fmt(k), False, w_, k))
    if len(pool) < 3: raise ValueError("not_enough_distractors")
    stem = f"A particle moves in the $xy$-plane with velocity vector $\\langle x'(t),y'(t)\\rangle$. The table gives values of $x'(t)$ and $y'(t)$ at selected times. What is the speed of the particle at $t={t0}$?"
    key = Opt(fmt(tri[2]), True, "Speed = sqrt((x')^2 + (y')^2) with the table values at that time.", tri[2])
    bp = _bp("param_speed_table", "9.6", "2.B", "Extract velocity components from a table and compute speed", ["Read x'(t) and y'(t) at the given time", "Combine them as sqrt((x')^2+(y')^2)"],
             [("speed equals the magnitude of the velocity vector", "definition of speed")], [("component_sum", "adds components"), ("slope", "reports dy/dx"), ("single_component", "reports one component")],
             "math.hypot of the two table entries (independent of the closed-form triple)", {"type": "table", "must_include": ["t", "x'(t)", "y'(t)"]})
    return pack("param_speed_table", "9.6", "2.B", "not_allowed", stem, key, pool, rng, stimulus={"kind": "table", "description": "Values of x'(t) and y'(t)", "data": {"columns": ["t", "x'(t)", "y'(t)"], "rows": rows}}, est=70, facts=[f"speed={tri[2]}", f"t0={t0}"], extra={"blueprint": bp})
