"""그래프 필수 MC 신규 원형 J군(2026-10-09, 단계 S3b): AB 단원 1·2·3·4·6·8, BC 단원 7·9·10."""
from gcommon import *
from scipy import optimize as _O, integrate as _I
from calc_graph_d import dopts, _curve_line, _curve_line_stim

XS5 = [0, 2, 4, 6, 8]
BC = "ap_calculus_bc"


def _ax(vals_list, xlab="x", xr=(0, 8), ylab="y"):
    allv = [v for vs in vals_list for v in vs]
    return axis(xlab, xr[0], xr[1], 1), axis(ylab, min(0, min(allv)) - 1, max(0, max(allv)) + 1, 1)


# 1) 6.9 치환적분: ∫_0^2 x f(x^2) dx
def g_usub_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -2, 6)
        f = PL(XS5, v)
        A4, A2 = f.area(0, 4), f.area(0, 2)
        key = A4 / 2
        if len({key, A4, A2 / 2, A2, A4 * 2}) == 5 and A4 != 0:
            break
    num = _I.quad(lambda u: u * f.num(u * u), 0, 2, points=[1.0, math.sqrt(2) if False else 1.0], limit=300)[0]
    if abs(num - float(key)) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Forgets the factor 1/2 from du = 2x dx and reports the integral of f from 0 to 4.", A4), ("Keeps the original limits 0 and 2 for u but includes the factor 1/2.", A2 / 2),
          ("Keeps the original limits and omits the factor 1/2.", A2), ("Uses du = x dx instead of 2x dx, doubling the result.", A4 * 2)]
    pool = opts(ds, key, fx)
    stem = "The graph of the function $f$ is shown and consists of line segments. What is the value of $\\int_0^2 x\\,f(x^2)\\,dx$?"
    k = Opt(fx(key), True, "With u = x^2, du = 2x dx and the limits become 0 and 4, so the integral is (1/2) times the integral of f from 0 to 4, an area read from the graph.", key)
    bpr = bp("g_usub_graph", "6.9", "1.E", "not_allowed", "Use u-substitution on an integral whose integrand involves a graphed function, converting the limits",
             ["Choose u = x^2 and compute du = 2x dx", "Convert the limits from x = 0, 2 to u = 0, 4", "Evaluate half the integral of f from 0 to 4 as an area from the graph"],
             [("f is continuous so the substitution is valid", "the graph is a continuous polygon on [0, 8]")],
             [("missing_half", "forgets the factor 1/2"), ("limits_not_converted", "keeps the old limits"), ("no_half_and_old_limits", "both slips"), ("double", "uses the wrong du")],
             "numerical quadrature of x f(x^2) on [0, 2] with the interpolated graph (independent of the substitution)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_usub_graph", "6.9", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 100, [f"v={v}", f"key={key}"])


# 2) 1.8 샌드위치 정리: g <= f <= h, 그래프 g, h 가 x=a 에서 만난다
def g_squeeze_graph(rng):
    for _ in forever():
        a = rng.choice([2, 4, 6])
        L = rng.randint(1, 5)
        vg = [rng.randint(-1, 3) for _ in range(5)]
        vh = [rng.randint(3, 8) for _ in range(5)]
        i = a // 2
        vg[i] = L
        vh[i] = L
        if all(vg[j] <= vh[j] for j in range(5)) and len({vg[0], vh[0], vg[4], vh[4], L}) >= 4 and max(vh) <= 8:
            break
    g, h = PL(XS5, vg), PL(XS5, vh)
    # 독립 경로: x -> a 에서 두 그래프 값의 수치 극한
    if abs(g.num(a + 1e-9) - L) > 1e-6 or abs(h.num(a - 1e-9) - L) > 1e-6:
        raise ValueError("independent_check_failed")
    cand = [(vg[0], "Reads the value of g at the left end of the graph instead of at x = %d." % a), (vh[0], "Reads the value of h at the left end of the graph instead of at x = %d." % a),
            (vh[4], "Reads the value of h at the right end of the graph instead of at x = %d." % a), (vg[4], "Reads the value of g at the right end of the graph instead of at x = %d." % a)]
    ds = [(w, z) for z, w in cand]
    pool = opts(ds, L, lambda n: "$%d$" % n)
    stem = f"The functions $f$, $g$ and $h$ satisfy $g(x)\\le f(x)\\le h(x)$ for all $x$ in $[0,8]$. The graphs of $g$ and $h$ are shown, each consisting of line segments. What is $\\lim_{{x\\to {a}}}f(x)$?"
    k = Opt("$%d$" % L, True, "Both g and h approach %d as x approaches %d, so the Squeeze Theorem gives the limit of f." % (L, a), L)
    bpr = bp("g_squeeze_graph", "1.8", "3.D", "not_allowed", "Apply the Squeeze Theorem using the graphs of the bounding functions",
             ["Check that g <= f <= h near the point", "Read the common limit of g and h at x = a from the graphs", "Conclude the limit of f equals that value"],
             [("g and h have the same limit at x = a, and g <= f <= h near a", "the two graphs meet at (a, L) and the inequality is stated")],
             [("wrong_point_g", "reads g elsewhere"), ("wrong_point_h", "reads h elsewhere"), ("right_end_h", "reads the right end")],
             "numerical limits of g and h at x = a from both sides (independent of the vertex values)", {"type": "graph", "must_include": ["vertices of g", "vertices of h", "g and h meet at x = a"]})
    return gpack("g_squeeze_graph", "1.8", "3.D", "not_allowed", stem, k, pool, rng, gstim("Graphs of g and h, each consisting of line segments connecting the plotted vertices.", [("g", g.vert()), ("h", h.vert())], *_ax([vg, vh])), bpr, 85, [f"vg={vg}", f"vh={vh}", f"a={a}", f"L={L}"])


# 3) 4.2 위치 그래프에서 속력
def g_position_graph_speed(rng):
    for _ in forever():
        v = rand_vals(rng, 5, 0, 8)
        a = rng.choice([1, 3, 5, 7])
        i = (a - 1) // 2
        f = PL(XS5, v)
        m = f.slope_seg(i)
        avg = Fr(v[4] - v[0], 8)
        if m < 0 and m.denominator == 1 and len({abs(m), m, f.at(a) if (v[i] + v[i + 1]) % 2 == 0 else Fr(99), avg}) == 4 and (v[i] + v[i + 1]) % 2 == 0:
            break
    key = abs(m)
    if abs(abs((f.num(a + 1e-6) - f.num(a - 1e-6)) / 2e-6) - float(key)) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Reports the velocity x'(%d) = %d, which is negative, instead of the speed." % (a, int(m)), m), ("Reports the position x(%d) = %d, the height of the graph, instead of the rate of change." % (a, int(f.at(a))), f.at(a)),
          ("Reports the average velocity over [0, 8] instead of the instantaneous speed.", avg)]
    pool = opts(ds, key, fx)
    stem = f"A particle moves along a line so that its position $x(t)$, in meters, at time $t$ seconds is shown in the graph for $0\\le t\\le 8$, which consists of line segments. What is the speed of the particle at $t={a}$ seconds?"
    k = Opt(fx(key), True, "Velocity is the slope of the position graph, x'(%d) = %d; speed is its absolute value." % (a, int(m)), key)
    bpr = bp("g_position_graph_speed", "4.2", "2.B", "not_allowed", "Find speed from the slope of a position graph",
             ["Read the slope of the position graph on the segment containing the given time", "Recognize the slope as velocity", "Take the absolute value to get speed"],
             [("x is differentiable at the given time because it lies inside a segment", "t is odd, never a vertex")],
             [("signed_velocity", "reports the negative velocity"), ("position_value", "reports the position"), ("average_velocity", "reports average velocity")],
             "central difference of the interpolated position graph at t = a (independent of the vertex list)", {"type": "graph", "must_include": ["vertices of x at t = 0, 2, 4, 6, 8"]})
    return gpack("g_position_graph_speed", "4.2", "2.B", "not_allowed", stem, k, pool, rng, gstim("Graph of x(t), consisting of line segments connecting the plotted vertices.", [("x", f.vert())], *_ax([v], "t", (0, 8), "x(t)")), bpr, 80, [f"v={v}", f"a={a}", f"m={m}"])


# 4) BC 10.2 등비급수의 합: 그래프에 처음 네 항
GEO = [(16, Fr(1, 2)), (24, Fr(1, 2)), (27, Fr(2, 3)), (32, Fr(1, 2)), (8, Fr(1, 2)), (48, Fr(2, 3)), (81, Fr(2, 3))]


def g_geometric_series_graph(rng):
    a1, r = rng.choice(GEO)
    terms = [a1 * r ** n for n in range(4)]
    if any(Fr(t).denominator != 1 for t in terms):
        raise ValueError("non_integer_terms")
    key = Fr(a1) / (1 - r)
    ds = [("Uses r = a1/a2 (the reciprocal ratio), which is greater than 1, so the formula does not apply.", Fr(a1) / (1 - Fr(a1) / terms[1]) if Fr(a1) / terms[1] != 1 else Fr(0)),
          ("Adds only the four terms shown instead of all infinitely many terms.", sum(terms)), ("Starts the sum at the second term: a2/(1 - r).", terms[1] / (1 - r)), ("Uses the formula a1/(1 + r).", Fr(a1) / (1 + r))]
    pool = opts([(w, z) for w, z in ds if z != 0], key, fx)
    pts = [[n + 1, int(terms[n])] for n in range(4)]
    chk = sum(float(a1) * float(r) ** n for n in range(400))
    if abs(chk - float(key)) > 1e-9:
        raise ValueError("independent_check_failed")
    stem = "The first four terms $a_1,a_2,a_3,a_4$ of a geometric series are shown in the graph, where the points are joined by line segments. What is the sum of the infinite geometric series $\\sum_{n=1}^{\\infty}a_n$?"
    k = Opt(fx(key), True, "The ratio is r = a2/a1 = %s and the series converges since |r| < 1, so the sum is a1/(1 - r)." % fx(r).strip("$"), key)
    bpr = bp("g_geometric_series_graph", "10.2", "1.E", "not_allowed", "Find the sum of a geometric series whose first terms are read from a graph",
             ["Read a1 and a2 from the graph and compute the common ratio", "Check |r| < 1 so that the series converges", "Apply a1/(1 - r)"],
             [("the terms have a constant ratio and |r| < 1", "the plotted terms decrease by a constant factor")],
             [("reciprocal_ratio", "inverts the ratio"), ("partial_sum_only", "adds the four shown terms"), ("wrong_first_term", "starts at a2"), ("wrong_sign", "uses 1 + r")],
             "partial sum of 400 terms computed in floating point (independent of the closed form)", {"type": "graph", "must_include": ["points for n = 1, 2, 3, 4"]}, subject=BC)
    return gpack("g_geometric_series_graph", "10.2", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graph of the terms a_n for n = 1 to 4, joined by line segments.", [("a", pts)], axis("n", 1, 4, 1), axis("a_n", 0, a1 + 2, max(1, a1 // 8))), bpr, 85, [f"a1={a1}", f"r={r}", f"key={key}"])


# 5) BC 7.9 로지스틱: 가장 빨리 증가할 때의 P
def g_logistic_fastest_graph(rng):
    K = rng.choice([40, 60, 80, 100])
    C = rng.choice([3, 5, 7])
    kk = rng.choice([0.6, 0.8, 1.0])
    P = lambda t_: K / (1 + C * math.exp(-kk * t_))
    tmax = 3 * math.log(C) / kk + 2
    n = 80
    pts = [[round(tmax * i / n, 3), round(P(tmax * i / n), 4)] for i in range(n + 1)]
    key = Fr(K, 2)
    tinf = math.log(C) / kk
    best = max(range(1, n), key=lambda i: (pts[i + 1][1] - pts[i - 1][1]))
    if abs(pts[best][1] - K / 2) > K * 0.05:
        raise ValueError("independent_check_failed")
    ds = [("Reports the carrying capacity K, the limiting value, instead of the population when growth is fastest.", Fr(K)), ("Reports the initial population P(0), where growth is slow.", Fr(int(round(P(0))))),
          ("Takes one quarter of the carrying capacity.", Fr(K, 4)), ("Takes three quarters of the carrying capacity.", Fr(3 * K, 4))]
    pool = opts(ds, key, fx)
    ymax = K + 10
    stem = "The population $P(t)$ of a species satisfies a logistic differential equation. The graph of $P$ and the horizontal line it approaches (dashed) are shown. For what value of $P$ is the population growing fastest?"
    k = Opt(fx(key), True, "For a logistic model dP/dt is largest when P is half the carrying capacity, which is the value of the dashed line divided by 2.", key)
    bpr = bp("g_logistic_fastest_graph", "7.9", "2.E", "not_allowed", "Use the carrying capacity read from a graph to find the population at which logistic growth is fastest",
             ["Read the carrying capacity from the dashed horizontal line", "Recall that dP/dt = k P (1 - P/K) is greatest at P = K/2", "Compute half of the carrying capacity"],
             [("the model is logistic so the horizontal asymptote is the carrying capacity K", "stated in the problem")],
             [("carrying_capacity", "reports the carrying capacity K"), ("initial_value", "reports P(0)"), ("quarter", "reports K/4"), ("three_quarters", "reports 3K/4")],
             "finite-difference growth rate of the plotted curve is largest near P = K/2 (independent of the logistic formula)", {"type": "graph", "must_include": ["S-shaped curve", "dashed horizontal line at the carrying capacity"]}, subject=BC)
    stim = gstim("Graph of the logistic population P(t) with its horizontal asymptote drawn dashed.", [("P", pts)], axis("t", 0, int(math.ceil(tmax)), 1), axis("P", 0, ymax, max(1, K // 10)), {"dashed_lines": [{"y": K}]})
    return gpack("g_logistic_fastest_graph", "7.9", "2.E", "not_allowed", stem, k, pool, rng, stim, bpr, 85, [f"K={K}", f"C={C}", f"k={kk}"])


# 6) BC 9.5 정지 상태: x(t), y(t) 의 기울기가 동시에 0 인 구간
def g_param_rest_graph(rng):
    for _ in forever():
        vx = rand_vals(rng, 5, 0, 6)
        vy = rand_vals(rng, 5, 0, 6)
        flat_x = [vx[i] == vx[i + 1] for i in range(4)]
        flat_y = [vy[i] == vy[i + 1] for i in range(4)]
        both = [i for i in range(4) if flat_x[i] and flat_y[i]]
        if len(both) == 1 and sum(flat_x) == 2 and sum(flat_y) == 2:
            break
    kidx = both[0]
    lab = lambda i: "$(%d,%d)$" % (2 * i, 2 * i + 2)
    key = Opt(lab(kidx), True, "On this interval both graphs are horizontal, so x' = 0 and y' = 0 and the speed is zero.", kidx)
    ds = []
    for i in range(4):
        if i == kidx:
            continue
        if flat_x[i]:
            w = "Only x is constant on (%d, %d); y is changing, so the particle is moving vertically." % (2 * i, 2 * i + 2)
        elif flat_y[i]:
            w = "Only y is constant on (%d, %d); x is changing, so the particle is moving horizontally." % (2 * i, 2 * i + 2)
        else:
            w = "Both x and y are changing on (%d, %d), so the particle is moving." % (2 * i, 2 * i + 2)
        ds.append(Opt(lab(i), False, w, i))
    xf, yf = PL(XS5, vx), PL(XS5, vy)
    for i in range(4):
        m = 2 * i + 1.0
        sp_ = math.hypot((xf.num(m + .1) - xf.num(m - .1)) / .2, (yf.num(m + .1) - yf.num(m - .1)) / .2)
        if (sp_ < 1e-9) != (i == kidx):
            raise ValueError("independent_check_failed")
    stem = "A particle moves in the $xy$-plane with position $(x(t),y(t))$. The graphs of $x(t)$ and $y(t)$ for $0\\le t\\le 8$ are shown, and each consists of line segments. During which of the following time intervals is the particle at rest?"
    bpr = bp("g_param_rest_graph", "9.5", "2.E", "not_allowed", "Decide when a particle with parametric position is at rest from the slopes of both position graphs",
             ["The particle is at rest when x' = 0 and y' = 0 at the same time", "Compare the slope of the graph of x and of y on each interval", "Select the interval where both slopes are zero"],
             [("speed is sqrt((x')^2 + (y')^2) and is zero only when both derivatives are zero", "definition of speed for planar motion")],
             [("only_x_flat", "x constant but y changing"), ("only_y_flat", "y constant but x changing"), ("both_moving", "both coordinates changing")],
             "numerical speed from central differences of both interpolated graphs at each interval midpoint (independent of the slope comparison)", {"type": "graph", "must_include": ["vertices of x(t)", "vertices of y(t)"]}, subject=BC)
    return gpack("g_param_rest_graph", "9.5", "2.E", "not_allowed", stem, key, ds, rng, gstim("Graphs of x(t) and y(t), each consisting of line segments connecting the plotted vertices.", [("x", xf.vert()), ("y", yf.vert())], *_ax([vx, vy], "t", (0, 8), "position")), bpr, 85, [f"vx={vx}", f"vy={vy}", f"rest={kidx}"])


# 7) 8.10 다른 축 둘레 회전(계산기): 곡선과 직선 사이 영역을 y = -1 둘레로
def g_volume_axis_shift_calc(rng):
    for _ in forever():
        fexpr, ftex, dom, c0, c1, m, roots, ff = _curve_line(rng, "sin")
        s = rng.choice([1, 2])
        break
    r1, r2 = roots
    Lf = lambda u: c0 + m * u
    V = math.pi * _I.quad(lambda u: (ff(u) + s) ** 2 - (Lf(u) + s) ** 2, r1, r2)[0]
    simp = math.pi * numeric_integral(lambda u: (ff(u) + s) ** 2 - (Lf(u) + s) ** 2, r1, r2, 20001)
    if abs(simp - V) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Uses the x-axis as the axis of revolution: pi times the integral of f^2 - L^2.", math.pi * _I.quad(lambda u: ff(u) ** 2 - Lf(u) ** 2, r1, r2)[0]), ("Squares the difference of the radii, (f - L)^2.", math.pi * _I.quad(lambda u: (ff(u) - Lf(u)) ** 2, r1, r2)[0]),
          ("Subtracts %d from each radius instead of adding it for an axis below the region." % s, math.pi * _I.quad(lambda u: (ff(u) - s) ** 2 - (Lf(u) - s) ** 2, r1, r2)[0]), ("Leaves out the factor pi.", V / math.pi)]
    pool = dopts(ds, V)
    stem = f"The figure shows the graph of $f(x)={ftex}$ and the line $L$. Let $R$ be the region enclosed by the graph of $f$ and the line $L$. $R$ is revolved about the horizontal line $y=-{s}$. What is the volume of the solid generated?"
    k = Opt(dec(V), True, "Washers about y = -%d: outer radius f(x) + %d and inner radius L(x) + %d, so V = pi times the integral of the difference of their squares between the intersection points (calculator)." % (s, s, s), V)
    ytop = max(ff(u) for u in [dom[0] + (dom[1] - dom[0]) * i / 200 for i in range(201)])
    bpr = bp("g_volume_axis_shift_calc", "8.10", "1.D", "required", "Find a washer volume when the region is revolved about a horizontal line other than the x-axis",
             ["Read the line from the figure and find the intersection points with a calculator", "Measure each radius from the axis y = -s: add s to the heights", "Integrate pi times the difference of the squared radii"],
             [("the axis lies below the region so each radius is the height plus s", "the axis y = -s is below the x-axis and the region is in the first quadrant")],
             [("x_axis_instead", "uses y = 0"), ("square_of_difference", "squares the difference"), ("wrong_shift_sign", "subtracts s"), ("missing_pi", "omits the factor pi")],
             "composite Simpson rule on pi((f + s)^2 - (L + s)^2) between the roots (independent of scipy quad)", {"type": "graph", "must_include": ["curve y = f(x)", "line L through two lattice points"]})
    return gpack("g_volume_axis_shift_calc", "8.10", "1.D", "required", stem, k, pool, rng, _curve_line_stim(fexpr, dom, c0, c1, ytop), bpr, 120, [f"f={fexpr}", f"c0={c0}", f"c1={c1}", f"s={s}", f"V={V:.6f}"])


# 8) 3.4 역삼각함수: h(x) = arcsin(g(x)/10) (계산기)
def g_arcsin_deriv_mixed_calc(rng):
    for _ in forever():
        vg = rand_vals(rng, 5, 1, 8)
        if any((vg[i] + vg[i + 1]) % 2 for i in range(4)):
            continue
        a = rng.choice([1, 3, 5, 7])
        i = (a - 1) // 2
        g = PL(XS5, vg)
        ga, gp = float(g.at(a)), float(g.slope_seg(i))
        key = gp / 10 / math.sqrt(1 - (ga / 10) ** 2)
        if gp != 0 and abs(key) > 0.03 and ga < 10:
            break
    hh = 1e-6
    hn = lambda u: math.asin(g.num(u) / 10)
    if abs((hn(a + hh) - hn(a - hh)) / (2 * hh) - key) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Leaves out the inner derivative g'(a)/10.", 1 / math.sqrt(1 - (ga / 10) ** 2)), ("Uses the derivative of arctan, 1/(1 + u^2), instead of the derivative of arcsin.", gp / 10 / (1 + (ga / 10) ** 2)),
          ("Omits the 1/10 from the inner function: g'(a)/sqrt(1 - (g(a)/10)^2).", gp / math.sqrt(1 - (ga / 10) ** 2)), ("Forgets the square root in the denominator.", gp / 10 / (1 - (ga / 10) ** 2))]
    pool = dopts(ds, key)
    stem = f"Let $h(x)=\\arcsin\\left(\\dfrac{{g(x)}}{{10}}\\right)$, where the graph of $g$, consisting of line segments, is shown. What is the value of $h'({a})$?"
    k = Opt(dec(key), True, "h'(x) = (g'(x)/10)/sqrt(1 - (g(x)/10)^2); g(a) and g'(a) are read from the graph and the expression is evaluated with a calculator.", key)
    bpr = bp("g_arcsin_deriv_mixed_calc", "3.4", "1.E", "required", "Differentiate an inverse trigonometric composition using values and a slope read from a graph",
             ["Read g(a) and g'(a) from the graph", "Apply the derivative of arcsin with the chain rule", "Evaluate with a calculator"],
             [("g(a)/10 lies in (-1, 1) and g is differentiable at a", "g(a) < 10 and a is interior to a segment")],
             [("no_inner_derivative", "omits the inner derivative"), ("arctan_formula", "uses the arctan derivative"), ("missing_tenth", "omits 1/10"), ("no_root", "forgets the root")],
             "central difference (step 1e-6) of arcsin(g/10) with g interpolated (independent of the derivative formula)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_arcsin_deriv_mixed_calc", "3.4", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 100, [f"vg={vg}", f"a={a}", f"key={key:.6f}"])


# 9) 2.7 지수함수: h(x) = e^{g(x)/2} (계산기)
def g_exp_deriv_mixed_calc(rng):
    for _ in forever():
        vg = rand_vals(rng, 5, 0, 6)
        if any((vg[i] + vg[i + 1]) % 2 for i in range(4)):
            continue
        a = rng.choice([1, 3, 5, 7])
        i = (a - 1) // 2
        g = PL(XS5, vg)
        ga, gp = float(g.at(a)), float(g.slope_seg(i))
        key = gp / 2 * math.exp(ga / 2)
        if gp != 0 and abs(key) > 0.3 and abs(key) < 400:
            break
    hh = 1e-6
    hn = lambda u: math.exp(g.num(u) / 2)
    if abs((hn(a + hh) - hn(a - hh)) / (2 * hh) - key) > 1e-4 * max(1, abs(key)):
        raise ValueError("independent_check_failed")
    ds = [("Leaves out the inner derivative g'(a)/2.", math.exp(ga / 2)), ("Omits the 1/2 from the inner function: g'(a) e^(g(a)/2).", gp * math.exp(ga / 2)),
          ("Differentiates the exponent only: g'(a)/2.", gp / 2), ("Uses e^(g(a)) in place of e^(g(a)/2).", gp / 2 * math.exp(ga))]
    pool = dopts(ds, key)
    stem = f"Let $h(x)=e^{{g(x)/2}}$, where the graph of $g$, consisting of line segments, is shown. What is the value of $h'({a})$?"
    k = Opt(dec(key), True, "h'(x) = (g'(x)/2) e^{g(x)/2}; g(a) and the slope g'(a) are read from the graph and the exponential is evaluated with a calculator.", key)
    bpr = bp("g_exp_deriv_mixed_calc", "2.7", "1.C", "required", "Differentiate an exponential of a graphed function at a point",
             ["Recognize e raised to a function and plan the chain rule", "Read g(a) and g'(a) from the graph", "Evaluate (g'/2) e^(g/2) with a calculator"],
             [("g is differentiable at a because a is interior to a segment", "a is odd; vertices are at even x")],
             [("missing_inner_derivative", "omits g'/2"), ("missing_half", "omits the factor 1/2"), ("exponent_only", "differentiates only the exponent"), ("wrong_exponent", "drops the 1/2 in the exponent")],
             "central difference (step 1e-6) of exp(g/2) with g interpolated (independent of the chain rule)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_exp_deriv_mixed_calc", "2.7", "1.C", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 95, [f"vg={vg}", f"a={a}", f"key={key:.6f}"])
