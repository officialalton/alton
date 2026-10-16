"""AB 그래프 필수 MC 신규 원형 F군(2026-10-09, 단계 S2): 식+그래프 혼합 계산기 문항(단원 2·3·5·7)과 그래프 단독 문항(단원 4·6)."""
from gcommon import *
from scipy import optimize as _O, integrate as _I
from calc_graph_d import dopts, F_POOL, _dd, _gint

XS5 = [0, 2, 4, 6, 8]


def _ax(vals_list, xlab="x", xr=(0, 8), ylab="y"):
    allv = [v for vs in vals_list for v in vs]
    return axis(xlab, xr[0], xr[1], 1), axis(ylab, min(0, min(allv)) - 1, max(0, max(allv)) + 1, 1)


# 1) 2.9 몫의 법칙: f 는 식, g 는 그래프
def g_quotient_mixed_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(F_POOL)
        vg = rand_vals(rng, 5, 1, 6)
        if any((vg[i] + vg[i + 1]) % 2 for i in range(4)):
            continue
        a = rng.choice([1, 3, 5, 7])
        g = PL(XS5, vg)
        i = (a - 1) // 2
        ga, gp = float(g.at(a)), float(g.slope_seg(i))
        fa, fpa = float(fexpr.subs(x, a)), float(sp.diff(fexpr, x).subs(x, a))
        key = (fpa * ga - fa * gp) / ga ** 2
        if gp != 0 and abs(key) > 0.05:
            break
    hh = 1e-6
    ff = sp.lambdify(x, fexpr, "math")
    q = lambda u: ff(u) / g.num(u)
    if abs((q(a + hh) - q(a - hh)) / (2 * hh) - key) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [("Divides the derivatives, f'(a)/g'(a), instead of using the quotient rule.", fpa / gp), ("Adds the two terms of the numerator instead of subtracting them.", (fpa * ga + fa * gp) / ga ** 2),
          ("Divides the numerator by g(a) instead of g(a) squared.", (fpa * ga - fa * gp) / ga), ("Reverses the numerator: f g' - f' g.", (fa * gp - fpa * ga) / ga ** 2)]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$. The graph of the function $g$, which consists of line segments, is shown. If $q(x)=\\dfrac{{f(x)}}{{g(x)}}$, what is the value of $q'({a})$?"
    k = Opt(dec(key), True, "q'(a) = (f'(a) g(a) - f(a) g'(a)) / g(a)^2; g(a) and g'(a) come from the graph and f(a), f'(a) from the formula (calculator).", key)
    bpr = bp("g_quotient_mixed_calc", "2.9", "1.E", "required", "Apply the quotient rule at a point when the numerator is a formula and the denominator is a graph",
             ["Differentiate the formula and evaluate f(a), f'(a) with a calculator", "Read g(a) and the slope g'(a) from the graph", "Apply the quotient rule with the numerator in the right order"],
             [("g(a) is not zero and g is differentiable at a because a is interior to a segment", "g(a) is a positive integer read from the graph")],
             [("quotient_of_derivatives", "divides f' by g'"), ("sign_error", "adds the numerator terms"), ("denominator_not_squared", "divides by g instead of g squared"), ("reversed_numerator", "swaps the numerator terms")],
             "central difference (step 1e-6) of the lambdified formula divided by the interpolated graph (independent of the quotient rule)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_quotient_mixed_calc", "2.9", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 100, [f"f={fexpr}", f"vg={vg}", f"a={a}", f"key={key:.6f}"])


# 2) 3.6 이계도함수: h = f g, g 는 선분이라 g'' = 0
def g_second_deriv_mixed_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(F_POOL)
        vg = rand_vals(rng, 5, 1, 6)
        if any((vg[i] + vg[i + 1]) % 2 for i in range(4)):
            continue
        a = rng.choice([1, 3, 5, 7])
        g = PL(XS5, vg)
        i = (a - 1) // 2
        ga, gp = float(g.at(a)), float(g.slope_seg(i))
        fa = float(fexpr.subs(x, a))
        f1, f2 = float(sp.diff(fexpr, x).subs(x, a)), float(sp.diff(fexpr, x, 2).subs(x, a))
        key = f2 * ga + 2 * f1 * gp
        if gp != 0 and abs(f2) > 0.02 and abs(key) > 0.05:
            break
    hh = 1e-4
    ff = sp.lambdify(x, fexpr, "math")
    hn = lambda u: ff(u) * g.num(u)
    num2 = (hn(a + hh) - 2 * hn(a) + hn(a - hh)) / hh ** 2
    if abs(num2 - key) > 1e-3:
        raise ValueError("independent_check_failed")
    ds = [("Leaves out the middle term 2 f'(a) g'(a) because g'' = 0 on a segment, but the product rule for second derivatives still has it.", f2 * ga), ("Uses f'(a) g'(a) with coefficient 1 instead of 2 in the middle term.", f2 * ga + f1 * gp),
          ("Returns the first derivative h'(a) = f'(a) g(a) + f(a) g'(a).", f1 * ga + fa * gp), ("Puts the derivative factors in the wrong places: f''(a) g'(a) + 2 f'(a) g(a).", f2 * gp + 2 * f1 * ga)]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$. The graph of the function $g$, which consists of line segments, is shown. If $h(x)=f(x)\\,g(x)$, what is the value of $h''({a})$?"
    k = Opt(dec(key), True, "h'' = f'' g + 2 f' g' + f g''; on a line segment g'' = 0, so h''(a) = f''(a) g(a) + 2 f'(a) g'(a), with g(a) and g'(a) read from the graph.", key)
    bpr = bp("g_second_deriv_mixed_calc", "3.6", "1.E", "required", "Compute a second derivative of a product where one factor is a graph made of line segments",
             ["Apply the product rule twice to get h'' = f'' g + 2 f' g' + f g''", "Use g'' = 0 on a line segment and read g(a), g'(a) from the graph", "Evaluate f' and f'' at a with a calculator"],
             [("g is linear near x = a so g''(a) = 0", "a is interior to a segment of the graph")],
             [("dropped_middle_term", "drops 2 f' g'"), ("coefficient_one", "uses coefficient 1"), ("first_derivative_only", "reports h'"), ("misplaced_factors", "puts the derivatives in the wrong places")],
             "second central difference (step 1e-4) of the product of the lambdified formula and the interpolated graph (independent of the product rule)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_second_deriv_mixed_calc", "3.6", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 110, [f"f={fexpr}", f"vg={vg}", f"a={a}", f"key={key:.6f}"])


# 3) 5.5 절대 최댓값: h = f - g (f 식, g 그래프)
def g_extreme_mixed_calc(rng):
    xs4 = [0, 2, 4, 6]
    fpool = [(3 * sp.sin(x / 2), "3\\sin\\left(\\frac{x}{2}\\right)"), (2 * sp.log(x + 1), "2\\ln(x+1)"), (x * sp.exp(-x / 3) * 3, "3xe^{-x/3}")]
    for _ in forever():
        fexpr, ftex = rng.choice(fpool)
        vg = rand_vals(rng, 4, 0, 5)
        g = PL(xs4, vg)
        ff = sp.lambdify(x, fexpr, "math")
        fp = _dd(fexpr)
        H = lambda u: ff(u) - g.num(u)
        grid = [i / 1000 for i in range(0, 6001)]
        best = max(grid, key=H)
        # 스무스 임계점: 각 선분에서 f'(x) = g' 의 해
        crit = []
        for i in range(3):
            s_ = float(g.slope_seg(i))
            D = lambda u: fp(u) - s_
            for j in range(i * 200, (i + 1) * 200):
                a_, b_ = grid[j * 5 // 5] if False else j / 100 * 1.0, (j + 1) / 100 * 1.0
                if 2 * i <= a_ and b_ <= 2 * i + 2 and D(a_) * D(b_) < 0:
                    crit.append(_O.brentq(D, a_, b_, xtol=1e-13))
        if not crit:
            continue
        key = max(H(best), H(best))
        smooth = [c_ for c_ in crit if 0.05 < c_ < 5.95]
        if not smooth:
            continue
        vcands = {t_: H(t_) for t_ in [0.0, 2.0, 4.0, 6.0]}
        sc = {c_: H(c_) for c_ in smooth}
        allc = {**vcands, **sc}
        bx = max(allc, key=allc.get)
        if abs(allc[bx] - H(best)) > 1e-5:
            continue
        # 최댓값이 매끈한 임계점이 아니라 꼭짓점/끝점에서 나오도록
        if bx in sc:
            continue
        cmax_smooth = max(sc.values())
        if cmax_smooth >= H(best) - 0.05:
            continue
        zero_fp = [t_ for t_ in [i / 100 for i in range(0, 600)] if fp(t_) * fp(t_ + 0.01) < 0]
        z = H(zero_fp[0]) if zero_fp else None
        if z is None:
            continue
        break
    key = H(best)
    ds = [("Reports the value of h at the largest smooth critical point (where h' = 0) without checking the corners and endpoints of g.", cmax_smooth), ("Reports the x-coordinate where the maximum occurs instead of the maximum value.", bx),
          ("Maximizes f alone and subtracts g only at the endpoints.", z), ("Reports h(6), the right endpoint value.", H(6.0))]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$. The graph of the function $g$, which consists of line segments, is shown for $0\\le x\\le 6$. If $h(x)=f(x)-g(x)$, what is the absolute maximum value of $h$ on the interval $[0,6]$?"
    k = Opt(dec(key), True, "Candidates: endpoints, the corners of g (where h' does not exist) and solutions of f'(x) = g'(x) on each segment; h is evaluated at each with a calculator and the largest value is chosen.", key)
    bpr = bp("g_extreme_mixed_calc", "5.5", "1.D", "required", "Find an absolute maximum of f - g where g is a graph with corners, using the candidates test",
             ["Recognize that h' does not exist at the corners of g and that h' = f' - g' on each segment", "Solve f'(x) = slope of g on each segment and list the corners and endpoints as candidates", "Evaluate h at each candidate with a calculator and compare"],
             [("h is continuous on a closed interval so the absolute maximum occurs at an endpoint, a corner or a critical point", "Extreme Value Theorem")],
             [("smooth_critical_point_only", "ignores corners and endpoints"), ("location_not_value", "reports the x-coordinate"), ("ignores_g_in_maximizing", "maximizes f alone"), ("right_endpoint", "reports h(6)")],
             "maximum of h over a 6001-point grid on [0, 6] (independent of the candidate list)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6"]})
    return gpack("g_extreme_mixed_calc", "5.5", "1.D", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 6), "g(x)")), bpr, 120, [f"f={fexpr}", f"vg={vg}", f"key={key:.6f}"])


# 4) 6.2 간격이 다른 사다리꼴 합
def g_trapezoid_unequal_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -2, 6)
        f = PL(XS5, v)
        pts = rng.choice([[0, 2, 4, 8], [0, 2, 6, 8], [0, 4, 6, 8]])
        key = sum((f.at(pts[i]) + f.at(pts[i + 1])) / 2 * (pts[i + 1] - pts[i]) for i in range(3))
        exact = f.area(0, 8)
        left = sum(f.at(pts[i]) * (pts[i + 1] - pts[i]) for i in range(3))
        eq = Fr(sum(f.at(p) for p in pts[:3]) * 0 + (f.at(pts[0]) + 2 * f.at(pts[1]) + 2 * f.at(pts[2]) + f.at(pts[3])) / 2 * Fr(8, 3), 1)
        if len({key, exact, left, eq}) == 4:
            break
    num = sum((f.num(pts[i]) + f.num(pts[i + 1])) / 2 * (pts[i + 1] - pts[i]) for i in range(3))
    if abs(num - float(key)) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Uses the exact area under the graph of f instead of the trapezoidal sum for the given subintervals.", exact), ("Uses left endpoints with the given subinterval widths instead of trapezoids.", left),
          ("Treats the three subintervals as if they had equal width 8/3.", eq)]
    pool = opts(ds, key, fx)
    stem = f"The graph of the function $f$, consisting of line segments, is shown. The trapezoidal sum with the three subintervals determined by the points $x={pts[0]},{pts[1]},{pts[2]},{pts[3]}$ is used to approximate $\\int_0^8 f(x)\\,dx$. What is the value of this approximation?"
    k = Opt(fx(key), True, "Trapezoidal sum = sum of (f(left) + f(right))/2 times the width of each subinterval, using the values read from the graph.", key)
    bpr = bp("g_trapezoid_unequal_graph", "6.2", "1.E", "not_allowed", "Compute a trapezoidal sum with unequal subinterval widths using values read from a graph",
             ["Read f at each of the four given points from the graph", "Find the width of each subinterval", "Apply (left + right)/2 times width on each subinterval and add"],
             [("the trapezoidal rule applies on each subinterval separately, so unequal widths are allowed", "definition of the trapezoidal sum")],
             [("exact_area", "uses the exact area"), ("left_sum", "uses left endpoints"), ("equal_widths", "treats the widths as equal")],
             "direct sum of the numerically interpolated heights times widths (independent of exact rationals)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_trapezoid_unequal_graph", "6.2", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 95, [f"v={v}", f"pts={pts}", f"key={key}"])


# 5) 7.7 변수분리: dy/dx = g(x) y, g 는 그래프
def g_separable_graph_calc(rng):
    for _ in forever():
        vg = rand_vals(rng, 5, -1, 2)
        g = PL(XS5, vg)
        b = rng.choice([4, 6, 8])
        y0 = rng.choice([2, 3, 4, 5])
        A = float(g.area(0, b))
        key = y0 * math.exp(A)
        if 0.3 < key < 400 and A != 0 and g.at(b) != 0:
            break
    # 독립 경로: dy/dx = g(x) y 를 룽게-쿠타로 수치 적분
    sol = _I.solve_ivp(lambda t_, y_: [g.num(min(t_, 8.0)) * y_[0]], [0, b], [y0], rtol=1e-10, atol=1e-12, max_step=0.05)
    if abs(sol.y[0][-1] - key) > 1e-4 * max(1.0, key):
        raise ValueError("independent_check_failed")
    ds = [("Adds the area instead of exponentiating: y(0) + integral of g.", y0 + A), ("Leaves out the initial value: e raised to the integral of g.", math.exp(A)), ("Uses g(%d) in the exponent instead of the integral of g from 0 to %d." % (b, b), y0 * math.exp(float(g.at(b)))),
          ("Multiplies y(0) by the integral of g instead of by e to that power.", y0 * A)]
    pool = dopts(ds, key)
    stem = f"The function $y=f(x)$ satisfies $\\dfrac{{dy}}{{dx}}=g(x)\\,y$ with $f(0)={y0}$, where the graph of $g$, consisting of line segments, is shown. What is the value of $f({b})$?"
    k = Opt(dec(key), True, "Separating variables gives ln|y| = integral of g, so f(%d) = f(0) e^{integral of g from 0 to %d}; the integral is the signed area under the graph and e to that power needs a calculator." % (b, b), key)
    bpr = bp("g_separable_graph_calc", "7.7", "1.E", "required", "Solve dy/dx = g(x) y by separation of variables when g is given as a graph",
             ["Separate variables to get ln|y| equal to the integral of g", "Evaluate the integral as signed area read from the graph", "Use the initial condition and evaluate the exponential with a calculator"],
             [("y stays positive because f(0) > 0 and the solution is y(0) exp(integral of g)", "initial value is positive")],
             [("additive_not_exponential", "adds the integral"), ("lost_initial_value", "drops y(0)"), ("value_in_exponent", "uses the value g(b)"), ("product_not_exponential", "multiplies by the area")],
             "Runge-Kutta numerical integration of the differential equation with the interpolated g (independent of separation of variables)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_separable_graph_calc", "7.7", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 100, [f"vg={vg}", f"b={b}", f"y0={y0}", f"key={key:.6f}"])


# 6) 4.1 도함수의 의미: 온도 그래프에서 T'(a) 의 해석
def g_context_roc_meaning(rng):
    for _ in forever():
        v = rand_vals(rng, 5, 0, 8)
        a = rng.choice([1, 3, 5, 7])
        i = (a - 1) // 2
        f = PL(XS5, v)
        m = f.slope_seg(i)
        Ta = f.at(a)
        if m != 0 and (v[i] + v[i + 1]) % 2 == 0 and m.denominator == 1 and Ta != abs(m) and Ta != 0:
            break
    up = m > 0
    mm = abs(int(m))
    word = lambda u: "increasing" if u else "decreasing"
    key = Opt("At $t=%d$ minutes the temperature is %s at a rate of $%d$ degrees Celsius per minute." % (a, word(up), mm), True, "T'(%d) is the slope of the graph at t = %d, which is %d, so the temperature is %s by %d degrees Celsius per minute." % (a, a, int(m), word(up), mm), None)
    ds = [Opt("At $t=%d$ minutes the temperature is %s at a rate of $%d$ degrees Celsius per minute." % (a, word(not up), mm), False, "Reverses the sign: the slope is %s, so the temperature is %s." % ("positive" if up else "negative", word(up)), None),
          Opt("At $t=%d$ minutes the temperature is %s at a rate of $%d$ degrees Celsius per minute." % (a, word(up), int(Ta)), False, "Uses the height of the graph, T(%d) = %d, as the rate of change instead of the slope." % (a, int(Ta)), None),
          Opt("At $t=%d$ minutes the temperature is $%d$ degrees Celsius and is changing at a rate of $%d$ degrees per minute." % (a, int(Ta), mm) if False else "Between $t=0$ and $t=8$ minutes the temperature changes at an average rate of $%s$ degrees Celsius per minute." % fx(Fr(v[4] - v[0], 8)).strip("$"), False, "Reports the average rate of change over the whole interval, not the instantaneous rate at the given time.", None)]
    if len({o.text for o in ds + [key]}) < 4:
        raise ValueError("not_enough_distractors")
    stem = f"The temperature $T(t)$, in degrees Celsius, of a liquid is modeled for $0\\le t\\le 8$ minutes. The graph of $T$ is shown and consists of line segments. Which of the following is a correct interpretation of $T'({a})$?"
    bpr = bp("g_context_roc_meaning", "4.1", "3.F", "not_allowed", "Interpret the derivative at a time as an instantaneous rate with units using the slope of a graph",
             ["Read the slope of the graph at the given time", "Recognize the slope as the instantaneous rate of change of temperature", "Match the sign to increasing or decreasing and include the units"],
             [("T'(a) is the slope of the segment containing t = a, because a lies inside a segment", "t is an odd integer, never a vertex")],
             [("wrong_sign", "reverses increasing and decreasing"), ("value_as_rate", "uses T(a) as a rate"), ("average_rate", "uses the average rate over the whole interval")],
             "difference quotient of the interpolated graph at t = a +/- 1e-6 (independent of the vertex list)", {"type": "graph", "must_include": ["vertices of T at t = 0, 2, 4, 6, 8"]})
    if abs((f.num(a + 1e-6) - f.num(a - 1e-6)) / 2e-6 - float(m)) > 1e-6:
        raise ValueError("independent_check_failed")
    return gpack("g_context_roc_meaning", "4.1", "3.F", "not_allowed", stem, key, ds, rng, gstim("Graph of T(t), consisting of line segments connecting the plotted vertices.", [("T", f.vert())], *_ax([v], "t", (0, 8), "T(t)")), bpr, 85, [f"v={v}", f"a={a}", f"m={m}"])
