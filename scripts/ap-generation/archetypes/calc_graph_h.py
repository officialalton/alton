"""그래프 필수 MC 신규 원형 H군(2026-10-09, 단계 S3): 식+그래프 혼합 계산기 문항(AB 단원 2·4·6·8)과 BC 단원 9·10 그래프 문항."""
from gcommon import *
from scipy import optimize as _O, integrate as _I
from calc_graph_d import dopts, F_POOL, I_POOL, _dd, _gint

XS5 = [0, 2, 4, 6, 8]
BC = "ap_calculus_bc"


def _ax(vals_list, xlab="x", xr=(0, 8), ylab="y"):
    allv = [v for vs in vals_list for v in vs]
    return axis(xlab, xr[0], xr[1], 1), axis(ylab, min(0, min(allv)) - 1, max(0, max(allv)) + 1, 1)


R_POOL = [(3 + 2 * sp.sin(x / 2), "3+2\\sin\\left(\\frac{x}{2}\\right)"), (2 + sp.exp(-x / 3) * 4, "2+4e^{-x/3}"), (sp.sqrt(x + 1) * 2, "2\\sqrt{x+1}")]


# 1) 8.3 유입률은 식, 누출률은 그래프
def g_rate_mixed_calc(rng):
    for _ in forever():
        rexpr, rtex = rng.choice(R_POOL)
        vl = rand_vals(rng, 5, 0, 5)
        Lg = PL(XS5, vl)
        b = rng.choice([4, 6, 8])
        k0 = rng.randint(5, 30)
        rf = sp.lambdify(x, rexpr, "math")
        IR = _I.quad(rf, 0, b)[0]
        AL = float(Lg.area(0, b))
        key = k0 + IR - AL
        if key > 1 and AL > 0:
            break
    simp = k0 + numeric_integral(lambda u: rf(u) - Lg.num(u), 0, b, 20001)
    if abs(simp - key) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Leaves out the %d gallons already in the tank." % k0, IR - AL), ("Adds the leak instead of subtracting it.", k0 + IR + AL), ("Ignores the leak and counts only the water pumped in.", k0 + IR), ("Counts only the leak: initial amount minus the water lost.", k0 - AL)]
    pool = dopts(ds, key)
    stem = f"Water is pumped into a tank at the rate $R(t)={rtex}$ gallons per minute and leaks out at a rate $L(t)$ gallons per minute, for $0\\le t\\le 8$ minutes. The graph of $L$, consisting of line segments, is shown. The tank holds {k0} gallons at $t=0$. How many gallons are in the tank at $t={b}$?"
    k = Opt(dec(key), True, "Amount = initial amount + integral of R (calculator) - integral of L (area read from the graph).", key)
    bpr = bp("g_rate_mixed_calc", "8.3", "1.D", "required", "Use net change with an inflow given by a formula and an outflow given by a graph",
             ["Recognize that the amount at time b is the initial amount plus the integral of inflow minus outflow", "Evaluate the integral of R with a calculator and the integral of L as an area from the graph", "Combine the three quantities"],
             [("amount at time b = initial amount + integral of the net rate", "net change theorem")],
             [("forgets_initial", "omits the initial amount"), ("adds_leak", "adds the leak"), ("ignores_leak", "counts only the inflow"), ("leak_only", "counts only the leak")],
             "composite Simpson rule (20001 nodes) on R - L with L interpolated (independent of splitting into two integrals)", {"type": "graph", "must_include": ["vertices of L at t = 0, 2, 4, 6, 8"]})
    return gpack("g_rate_mixed_calc", "8.3", "1.D", "required", stem, k, pool, rng, gstim("Graph of L(t), consisting of line segments connecting the plotted vertices.", [("L", Lg.vert())], *_ax([vl], "t", (0, 8), "L(t)")), bpr, 105, [f"R={rexpr}", f"vl={vl}", f"b={b}", f"k0={k0}", f"key={key:.6f}"])


# 2) 6.2 오른쪽 리만 합: f 는 식, g 는 그래프
def g_riemann_mixed_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(I_POOL)
        vg = rand_vals(rng, 5, 0, 6)
        g = PL(XS5, vg)
        ff = sp.lambdify(x, fexpr, "math")
        right = 2 * sum(ff(t_) + g.num(t_) for t_ in (2, 4, 6, 8))
        left = 2 * sum(ff(t_) + g.num(t_) for t_ in (0, 2, 4, 6))
        trap = (left + right) / 2
        nowidth = right / 2
        fonly = 2 * sum(ff(t_) for t_ in (2, 4, 6, 8))
        if len({round(z, 3) for z in (right, left, trap, nowidth, fonly)}) == 5:
            break
    exact = _gint(fexpr, 0, 8) + float(g.area(0, 8))
    key = right
    if abs(sum((ff(t_) + g.num(t_)) * 2 for t_ in (2, 4, 6, 8)) - key) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Uses left endpoints instead of right endpoints.", left), ("Uses the trapezoidal sum instead of a right Riemann sum.", trap), ("Adds the four function values but forgets to multiply by the width 2.", nowidth),
          ("Uses the right endpoints for f but leaves out g.", fonly), ("Reports the exact value of the integral instead of the approximation.", exact)]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$, and let $g$ be the function whose graph, consisting of line segments, is shown. A right Riemann sum with 4 subintervals of equal length is used to approximate $\\int_0^8\\left(f(x)+g(x)\\right)dx$. What is the value of the approximation?"
    k = Opt(dec(key), True, "Width 2, right endpoints 2, 4, 6, 8: 2 times the sum of f + g at those points, with f by calculator and g read from the graph.", key)
    bpr = bp("g_riemann_mixed_calc", "6.2", "1.E", "required", "Compute a right Riemann sum for a sum of a formula function and a graphed function",
             ["Find the width and the right endpoints", "Evaluate f at each endpoint with a calculator and read g from the graph", "Add f + g at the endpoints and multiply by the width"],
             [("the 4 subintervals have equal length 2 with right endpoints 2, 4, 6, 8", "stated by the problem; all endpoints are vertices of the graph")],
             [("left_sum", "uses left endpoints"), ("trapezoid", "uses trapezoids"), ("no_width", "forgets width"), ("drops_g", "ignores the graphed function g"), ("exact_value", "gives the integral")],
             "direct floating-point sum of f + g (g interpolated) at the right endpoints times 2 (independent of exact vertex arithmetic)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_riemann_mixed_calc", "6.2", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 100, [f"f={fexpr}", f"vg={vg}", f"key={key:.6f}"])


# 3) 2.1 평균변화율: h = f - g
def g_avg_roc_mixed_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(F_POOL)
        vg = rand_vals(rng, 5, 0, 6)
        g = PL(XS5, vg)
        a, b = rng.choice([(0, 4), (2, 6), (2, 8), (0, 8), (4, 8)])
        ff = sp.lambdify(x, fexpr, "math")
        key = ((ff(b) - g.num(b)) - (ff(a) - g.num(a))) / (b - a)
        favg = (ff(b) - ff(a)) / (b - a)
        gavg = float(g.at(b) - g.at(a)) / (b - a)
        if abs(key) > 0.05 and len({round(z, 3) for z in (key, favg, gavg, favg + gavg, (ff(b) - g.num(b)) - (ff(a) - g.num(a)))}) == 5:
            break
    num = ((ff(b + 1e-9) - g.num(b)) - (ff(a) - g.num(a))) / (b - a)
    if abs(num - key) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Averages only f and ignores g.", favg), ("Averages only g and ignores f.", gavg), ("Adds the two average rates instead of subtracting g's.", favg + gavg), ("Reports the change in h without dividing by the length of the interval.", (ff(b) - g.num(b)) - (ff(a) - g.num(a)))]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$, and let $g$ be the function whose graph, consisting of line segments, is shown. If $h(x)=f(x)-g(x)$, what is the average rate of change of $h$ on the interval $[{a},{b}]$?"
    k = Opt(dec(key), True, "Average rate = (h(b) - h(a))/(b - a), where f(a), f(b) come from the formula (calculator) and g(a), g(b) from the graph.", key)
    bpr = bp("g_avg_roc_mixed_calc", "2.1", "2.B", "required", "Compute an average rate of change for a difference of a formula function and a graphed function",
             ["Evaluate f at both endpoints with a calculator", "Read g at both endpoints from the graph", "Form the difference quotient of h = f - g"],
             [("the average rate of change over [a, b] is (h(b) - h(a))/(b - a)", "definition of average rate of change")],
             [("f_only", "ignores the graphed function g"), ("g_only", "ignores the formula function f"), ("adds_rates", "adds rates"), ("no_division", "omits the division")],
             "difference quotient from the lambdified f and interpolated g (independent of splitting into f and g rates)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_avg_roc_mixed_calc", "2.1", "2.B", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 95, [f"f={fexpr}", f"vg={vg}", f"a={a}", f"b={b}", f"key={key:.6f}"])


# 4) 4.6 합성함수의 접선 근사: h(x) = ln(g(x) + 2), g 는 그래프
def g_linearization_composite_calc(rng):
    for _ in forever():
        vg = rand_vals(rng, 5, 0, 7)
        if any((vg[i] + vg[i + 1]) % 2 for i in range(4)):
            continue
        a = rng.choice([1, 3, 5, 7])
        i = (a - 1) // 2
        g = PL(XS5, vg)
        ga, gp = float(g.at(a)), float(g.slope_seg(i))
        dx = rng.choice([0.2, 0.3, 0.4])
        h0 = math.log(ga + 2)
        hp = gp / (ga + 2)
        key = h0 + hp * dx
        if gp != 0 and abs(hp) > 0.05:
            break
    true_val = math.log(g.num(a + dx) + 2)
    if abs(true_val - key) > 0.2:
        raise ValueError("independent_check_failed")
    ds = [("Leaves out the inner derivative g'(a): uses h'(a) = 1/(g(a) + 2).", h0 + dx / (ga + 2)), ("Uses g(a) in place of ln(g(a) + 2) as the value at x = %d." % a, ga + hp * dx),
          ("Uses the slope g'(a) as the slope of the tangent line.", h0 + gp * dx), ("Reports the value ln(g(a) + 2) with no change along the tangent line.", h0)]
    pool = dopts(ds, key)
    stem = f"Let $h(x)=\\ln(g(x)+2)$, where the graph of $g$, consisting of line segments, is shown. The tangent line to the graph of $h$ at $x={a}$ is used to approximate $h({a}+{dx})$. What is the value of this approximation?"
    k = Opt(dec(key), True, "h(a) = ln(g(a) + 2) and h'(a) = g'(a)/(g(a) + 2) by the chain rule; the approximation is h(a) + h'(a)(%s), evaluated with a calculator." % dx, key)
    bpr = bp("g_linearization_composite_calc", "4.6", "1.F", "required", "Approximate a composite function with its tangent line using values and slope of the inner function from a graph",
             ["Read g(a) and g'(a) from the graph", "Differentiate h with the chain rule to get h'(a)", "Evaluate the tangent line value with a calculator"],
             [("h is differentiable at a because a is interior to a segment of g and g(a) + 2 > 0", "a is odd; g(a) is nonnegative")],
             [("missing_inner_derivative", "omits g'(a)"), ("uses_g_value", "uses g(a) as the function value"), ("slope_of_g", "uses g' as the slope"), ("no_change", "no tangent change")],
             "the exact value ln(g(a + dx) + 2) from the interpolated graph is within 0.2 of the approximation (a sanity bound independent of the chain rule)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_linearization_composite_calc", "4.6", "1.F", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 105, [f"vg={vg}", f"a={a}", f"dx={dx}", f"key={key:.6f}"])


# 5) 6.5 누적함수 해석(스킬 3): g(x)=∫_0^x f 의 성질
def g_accum_justify_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -4, 4)
        if any(v[i] * v[i + 1] < 0 for i in range(4)):
            continue
        typ = []
        for i in range(4):
            s = v[i] + v[i + 1]
            d = v[i + 1] - v[i]
            if s == 0:
                typ = None
                break
            typ.append(("pos" if s > 0 else "neg", "up" if d > 0 else ("down" if d < 0 else "flat")))
        if not typ:
            continue
        # g 가 감소하면서 아래로 볼록: f<0 이고 f 증가
        hit = [i for i, t in enumerate(typ) if t == ("neg", "up")]
        if len(hit) == 1:
            break
    kidx = hit[0]
    lab = lambda i: "$(%d,%d)$" % (2 * i, 2 * i + 2)
    key = Opt(lab(kidx), True, "On this interval f is negative, so g' = f < 0 and g is decreasing; f is increasing, so g'' = f' > 0 and g is concave up.", kidx)
    why = {("pos", "up"): "f is positive, so g is increasing there, not decreasing.", ("pos", "down"): "f is positive, so g is increasing, and f is decreasing so g is concave down.", ("neg", "down"): "f is negative so g decreases, but f is decreasing so g is concave down, not concave up.",
           ("pos", "flat"): "f is a positive constant, so g is increasing and linear.", ("neg", "flat"): "f is a negative constant, so g is decreasing and linear, not concave up."}
    ds = [Opt(lab(i), False, "On (%d, %d) %s" % (2 * i, 2 * i + 2, why[typ[i]]), i) for i in range(4) if i != kidx]
    f = PL(XS5, v)
    G = lambda u: f.quad(0, u)
    for i in range(4):
        m = 2 * i + 1.0
        dec_ = G(m + 0.1) < G(m - 0.1) - 1e-12
        conv = G(m + 0.1) + G(m - 0.1) - 2 * G(m) > 1e-12
        if (dec_ and conv) != (i == kidx):
            raise ValueError("independent_check_failed")
    if len({o.why for o in ds}) < 3:
        raise ValueError("not_enough_distractors")
    stem = "The graph of the function $f$ is shown and consists of line segments. Let $g(x)=\\int_0^x f(t)\\,dt$. On which of the following intervals is $g$ decreasing and concave up?"
    bpr = bp("g_accum_justify_graph", "6.5", "3.E", "not_allowed", "Justify the monotonicity and concavity of an accumulation function from the sign and direction of f",
             ["g' = f so g is decreasing where f is negative", "g'' = f' so g is concave up where f is increasing", "Find the interval where both hold"],
             [("g is differentiable with g' = f because f is continuous", "Fundamental Theorem of Calculus")],
             [("positive_f", "f positive means g increasing"), ("f_decreasing", "f decreasing means g concave down"), ("constant_f", "f constant means g is linear")],
             "numerical quadrature of g with first and second difference tests at each segment midpoint (independent of the sign table)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_accum_justify_graph", "6.5", "3.E", "not_allowed", stem, key, ds, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v], "x", (0, 8), "f(x)")), bpr, 90, [f"v={v}", f"hit={kidx}"])


# ---------- BC ----------
# 6) 10.10 교대급수 오차 한계: f(n) = b_n 의 그래프
def g_alt_series_graph(rng):
    xs = [1, 2, 3, 4, 5, 6, 7, 8]
    for _ in forever():
        v = sorted(rng.sample(range(1, 13), 8), reverse=True)
        f = PL(xs, v)
        N = rng.choice([3, 4, 5])
        S = sum(((-1) ** (n + 1)) * Fr(v[n - 1]) for n in range(1, N + 1))
        key = Fr(v[N])
        alts = [Fr(v[N - 1]), Fr(v[N + 1]) if N + 1 < 8 else Fr(v[N]) + 1, S, Fr(v[N - 1] - v[N])]
        if len({key, *alts}) == 5:
            break
    ds = [("Uses the last term included in the partial sum, b_%d, as the bound." % N, alts[0]), ("Uses the term two places after the partial sum, b_%d." % (N + 2), alts[1]),
          ("Reports the partial sum S_%d itself." % N, alts[2]), ("Uses the difference b_%d - b_%d of consecutive terms." % (N, N + 1), alts[3])]
    pool = opts(ds, key, fx)
    stem = f"The graph of a decreasing positive function $f$ on $[1,8]$ is shown and consists of line segments, and $b_n=f(n)$. The alternating series $\\sum_{{n=1}}^{{\\infty}}(-1)^{{n+1}}b_n$ is approximated by its partial sum $S_{N}$ of the first ${N}$ terms. Using the alternating series error bound, what is the least upper bound for $|S-S_{N}|$ that the graph supports, if $b_n$ continues to decrease to $0$ beyond $n=8$?"
    k = Opt(fx(key), True, "The error is at most the first omitted term b_%d = f(%d), read from the graph." % (N + 1, N + 1), key)
    bpr = bp("g_alt_series_graph", "10.10", "2.B", "not_allowed", "Bound an alternating series error using terms read from a graph of the terms' function",
             ["Identify the first omitted term b_(N+1)", "Read f(N+1) from the graph"],
             [("terms are positive, decreasing and tend to 0, so the alternating series error bound applies", "stated in the problem")],
             [("last_included", "uses the last included term"), ("wrong_index", "uses a later term"), ("partial_sum", "reports the partial sum"), ("difference", "uses a difference of terms")],
             "exact rational recomputation of the terms at integers and of the partial sum (independent of option construction)", {"type": "graph", "must_include": ["vertices of f at x = 1..8"]}, subject=BC)
    return gpack("g_alt_series_graph", "10.10", "2.B", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], axis("n", 1, 8, 1), axis("f(n)", 0, max(v) + 1, 1)), bpr, 85, [f"v={v}", f"N={N}", f"key={key}"])


# 7) 9.4 매개변수 곡선의 길이(계산기): x'(t), y'(t) 그래프
def g_param_arclength_graphs_calc(rng):
    for _ in forever():
        vx = rand_vals(rng, 5, -4, 5)
        vy = rand_vals(rng, 5, -4, 5)
        xf, yf = PL(XS5, vx), PL(XS5, vy)
        b = rng.choice([4, 6, 8])
        sp_ = lambda u: math.hypot(xf.num(u), yf.num(u))
        L = _I.quad(sp_, 0, b, points=[p for p in (2, 4, 6) if p < b], limit=300)[0]
        simp = sum(numeric_integral(sp_, i, i + 2, 4001) for i in range(0, b, 2))
        if abs(L - simp) > 1e-6:
            continue
        trap = sum((sp_(i) + sp_(i + 2)) for i in range(0, b, 2))
        disp = math.hypot(float(xf.area(0, b)), float(yf.area(0, b)))
        sumabs = float(abs_area(xf).__class__(0)) if False else _I.quad(lambda u: abs(xf.num(u)) + abs(yf.num(u)), 0, b, points=[2, 4, 6], limit=300)[0]
        if len({round(z, 3) for z in (L, trap, disp, sumabs)}) == 4 and L > 1:
            break
    ds = [("Uses the trapezoidal rule with only the vertex speeds, which is not the arc length for a speed that is curved between vertices.", trap), ("Reports the length of the displacement vector, the straight-line distance between the start and end.", disp),
          ("Integrates |x'| + |y'| instead of the speed sqrt((x')^2 + (y')^2).", sumabs)]
    pool = dopts(ds, L)
    stem = f"A particle moves in the $xy$-plane. The graphs of $x'(t)$ and $y'(t)$ for $0\\le t\\le 8$ are shown and each consists of line segments. What is the total distance the particle travels from $t=0$ to $t={b}$?"
    k = Opt(dec(L), True, "Distance = integral of sqrt((x')^2 + (y')^2) from 0 to %d; the components come from the graphs and the integral is evaluated numerically with a calculator." % b, L)
    bpr = bp("g_param_arclength_graphs_calc", "9.4", "1.E", "required", "Find the arc length of a parametric path from graphs of the velocity components using a calculator",
             ["Write the arc length integral of the speed sqrt((x')^2 + (y')^2)", "Express x' and y' piece by piece from the graphs", "Evaluate the integral numerically with a calculator"],
             [("distance traveled equals the integral of speed", "arc length formula for parametric curves")],
             [("trapezoid_of_speeds", "approximates by vertex speeds"), ("displacement", "reports displacement"), ("sum_of_components", "adds absolute components")],
             "composite Simpson rule on each segment of the speed function (independent of scipy quad)", {"type": "graph", "must_include": ["vertices of x'", "vertices of y'"]}, subject=BC)
    return gpack("g_param_arclength_graphs_calc", "9.4", "1.E", "required", stem, k, pool, rng, gstim("Graphs of x'(t) and y'(t), each consisting of line segments connecting the plotted vertices.", [("x'", xf.vert()), ("y'", yf.vert())], *_ax([vx, vy], "t", (0, 8), "velocity")), bpr, 110, [f"vx={vx}", f"vy={vy}", f"b={b}", f"L={L:.6f}"])


# 8) 10.12 라그랑주 오차(2차 다항식, 소수 x, 계산기): f''' 그래프
def g_lagrange_p2_calc(rng):
    xs = [0, 1, 2, 3]
    for _ in forever():
        v = rand_vals(rng, 4, -6, 6)
        a = rng.choice([0.6, 0.7, 0.8, 0.9, 1.5])
        f = PL(xs, v)
        fa = float(f.at(Fr(str(a))))
        M = max(abs(v[0]), abs(v[1]), abs(fa)) if a > 1 else max(abs(v[0]), abs(fa))
        Mall = max(abs(z) for z in v)
        if M > 0 and M != Mall and abs(fa) < M or (M > 0 and M != Mall and a > 1 and abs(fa) < M):
            break
    key = M * a ** 3 / 6
    grid = [i * a / 2000 for i in range(2001)] + [1.0] * (1 if a > 1 else 0)
    if abs(max(abs(f.num(u)) for u in grid) - M) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Uses the maximum of |f'''| over the whole graph instead of over [0, %s]." % a, Mall * a ** 3 / 6), ("Divides by 2! instead of 3!.", M * a ** 3 / 2), ("Uses the power 2 instead of 3 for the x-term.", M * a ** 2 / 6), ("Uses the value of f''' at x = %s instead of its maximum absolute value." % a, abs(fa) * a ** 3 / 6)]
    pool = dopts(ds, key)
    stem = f"A function $f$ has derivatives of all orders. The graph of its third derivative $f'''$ on $0\\le x\\le 3$ is shown and consists of line segments. The second-degree Maclaurin polynomial $P_2$ is used to estimate $f({a})$. What bound on $|f({a})-P_2({a})|$ does the Lagrange error bound give?"
    k = Opt(dec(key), True, "Error <= M |x|^3/3! where M is the maximum of |f'''| on [0, a] read from the graph; evaluate with a calculator.", key)
    bpr = bp("g_lagrange_p2_calc", "10.12", "3.D", "required", "Apply the Lagrange error bound for a second-degree polynomial with a bound on the third derivative read from a graph",
             ["Read the largest absolute value of f''' on [0, a] from the graph", "Apply M |x|^(n+1)/(n+1)! with n = 2", "Evaluate with a calculator"],
             [("|f'''| <= M on [0, a] holds for the maximum absolute value on the interval", "the graph is piecewise linear so the maximum occurs at a vertex or at x = a")],
             [("whole_graph_maximum", "uses the maximum from the whole graph"), ("wrong_factorial", "divides by 2!"), ("wrong_power", "uses x squared"), ("value_at_a", "uses f'''(a)")],
             "maximum absolute value from a 2000-point grid on [0, a] (independent of vertex reading)", {"type": "graph", "must_include": ["vertices of f''' at x = 0, 1, 2, 3"]}, subject=BC)
    return gpack("g_lagrange_p2_calc", "10.12", "3.D", "required", stem, k, pool, rng, gstim("Graph of the third derivative of f, consisting of line segments connecting the plotted vertices.", [("f3", f.vert())], axis("x", 0, 3, 1), axis("y", min(-1, min(v)) - 1, max(v) + 1, 1)), bpr, 100, [f"v={v}", f"a={a}", f"key={key:.6f}"])
