"""AB 그래프 필수 MC 신규 원형 B군(2026-10-09, 단계 S1): 계산기 불가, 단원 1·4·6·7·8 및 불연속 그래프. 원형마다 단원.토픽·질문·풀이 단계가 다르다."""
from gcommon import *
from scipy import optimize as _O, integrate as _I

XS5 = [0, 2, 4, 6, 8]


def _yr(*vals):
    allv = [v for vs in vals for v in vs]
    return (min(0, min(allv)) - 1, max(0, max(allv)) + 1)


def _ax(vals_list, xlab="x", xr=(0, 8), ylab="y", step=1):
    lo, hi = _yr(*vals_list)
    return axis(xlab, xr[0], xr[1], 1), axis(ylab, lo, hi, step)


# 1) 6.2 왼쪽 리만 합: 그래프에서 값을 읽어 4구간
def g_riemann_left_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -2, 6)
        f = PL(XS5, v)
        left = 2 * sum(f.at(x_) for x_ in (0, 2, 4, 6))
        right = 2 * sum(f.at(x_) for x_ in (2, 4, 6, 8))
        trap = f.area(0, 8)
        mid = 2 * sum(f.at(x_) for x_ in (0, 2, 4, 6, 8))
        nowidth = sum(f.at(x_) for x_ in (0, 2, 4, 6))
        if len({left, right, trap, mid, nowidth}) == 5 and left > 0:
            break
    # 독립 경로: 수치 보간 함수로 직접 왼쪽 합
    if abs(sum(f.num(x_) * 2 for x_ in (0, 2, 4, 6)) - float(left)) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Uses right endpoints f(2), f(4), f(6), f(8) instead of left endpoints.", right), ("Uses the trapezoidal sum, which averages the left and right sums.", trap),
          ("Adds all five vertex values f(0), f(2), f(4), f(6), f(8), which is one more value than a 4-subinterval left sum uses.", mid), ("Adds the four left-endpoint values and forgets to multiply by the subinterval width 2.", nowidth)]
    pool = opts(ds, left, fx)
    stem = "The graph of the function $f$, consisting of line segments, is shown. A left Riemann sum with 4 subintervals of equal length is used to approximate $\\int_0^8 f(x)\\,dx$. What is the value of this approximation?"
    k = Opt(fx(left), True, "The width is 2 and the left endpoints are x = 0, 2, 4, 6, so the sum is 2 [f(0) + f(2) + f(4) + f(6)] using values read from the graph.", left)
    bpr = bp("g_riemann_left_graph", "6.2", "1.E", "not_allowed", "Compute a left Riemann sum using function values read from a graph",
             ["Find the subinterval width and the left endpoints", "Read f at each left endpoint from the graph", "Multiply the sum of values by the width"],
             [("the 4 subintervals have equal length 2 and left endpoints 0, 2, 4, 6", "stated by the problem; all four endpoints are vertices of the graph")],
             [("right_sum", "uses right endpoints"), ("trapezoid", "uses the trapezoidal sum"), ("extra_value", "adds an extra endpoint value"), ("no_width", "forgets the width")],
             "direct sum of the numerically interpolated function at the left endpoints times 2 (independent of exact vertex arithmetic)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_riemann_left_graph", "6.2", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 80, [f"v={v}", f"left={left}"])


# 2) 6.6 정적분: 선분과 반원으로 된 그래프의 넓이
def g_integral_semicircle(rng):
    for _ in forever():
        r = rng.choice([1, 2, 3])
        c = rng.randint(r + 1, 7 - r) if r + 1 <= 7 - r else None
        if c is None:
            continue
        y0, y1 = rng.randint(1, 4), rng.randint(1, 3)
        A1 = Fr((c - r) * y0, 2)
        A3 = Fr((8 - c - r) * y1, 2)
        if A1 == 0 or A3 == 0:
            continue
        break
    pi = sp.pi
    key = R(A1 - A3) + sp.Rational(r * r, 2) * pi
    d_sign = R(A1 + A3) + sp.Rational(r * r, 2) * pi
    d_full = R(A1 - A3) + r * r * pi
    d_arc = R(A1 - A3) + r * pi
    d_omit = R(A1 - A3)
    # 독립 경로: 실제 함수(sqrt)를 구간별로 수치 적분
    def fexact(u):
        if u <= c - r:
            return y0 * (1 - u / (c - r)) if c - r else 0.0
        if u <= c + r:
            return math.sqrt(max(0.0, r * r - (u - c) ** 2))
        return -y1 * (u - c - r) / (8 - c - r)
    num = _I.quad(fexact, 0, 8, points=[c - r, c + r], limit=200)[0]
    if abs(num - float(sp.N(key))) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Treats the triangle below the x-axis as positive area instead of negative.", d_sign), ("Uses the area of a full circle, pi r^2, for the semicircle.", d_full),
          ("Uses pi r, half the circumference, as the area of the semicircle.", d_arc), ("Leaves out the semicircle and adds only the two triangles.", d_omit)]
    pool = opts(ds, key, anyfmt)
    pts = [[0, y0], [c - r, 0]]
    for j in range(1, 80):
        th = math.pi - math.pi * j / 80
        pts.append([round(c + r * math.cos(th), 4), round(r * math.sin(th), 4)])
    pts += [[c + r, 0], [8, -y1]]
    stem = "The graph of the function $f$ is shown. It consists of two line segments and a semicircle. What is the value of $\\int_0^8 f(x)\\,dx$?"
    k = Opt(fmt(key), True, "The integral is the signed area: the left triangle, plus the semicircle of area (1/2) pi r^2, minus the triangle below the x-axis.", key)
    bpr = bp("g_integral_semicircle", "6.6", "2.B", "not_allowed", "Evaluate a definite integral as signed area using geometric shapes read from a graph",
             ["Identify the shapes (two triangles and a semicircle) and read their dimensions from the graph", "Use geometric area formulas, counting area below the axis as negative", "Add the signed areas"],
             [("the definite integral equals the signed area between the graph and the x-axis", "geometric interpretation of the integral for a piecewise geometric graph")],
             [("sign_error", "counts the area below the axis as positive"), ("full_circle", "uses pi r squared"), ("arc_length", "uses half the circumference"), ("missing_shape", "omits the semicircle")],
             "numerical quadrature of the explicit piecewise formula with the sqrt semicircle (independent of the geometric area formulas)", {"type": "graph", "must_include": ["segment from (0, y0) to the left end of the semicircle", "semicircle on the x-axis", "segment below the axis to x = 8"]})
    return gpack("g_integral_semicircle", "6.6", "2.B", "not_allowed", stem, k, pool, rng, gstim("Graph of f: a line segment, a semicircle with diameter on the x-axis, and a line segment below the axis.", [("f", pts)], axis("x", 0, 8, 1), axis("y", -y1 - 1, max(y0, r) + 1, 1)), bpr, 95, [f"r={r}", f"c={c}", f"y0={y0}", f"y1={y1}", f"key={key}"])


# 3) 6.5 누적함수 g(x)=∫_x^{10} f : 상대 최댓값의 위치(아래끝이 변수)
def g_accum_reverse_extremum(rng):
    xs6 = [0, 2, 4, 6, 8, 10]
    for _ in forever():
        a, b, c, d = (rng.randint(1, 4) for _ in range(4))
        if rng.random() < 0.5:
            v = [-a, 0, b, c, 0, -d]          # f: -,0,+,+,0,-  → − → + at x=2, + → − at x=8
            key_x, other_x = 2, 8
        else:
            v = [a, 0, -b, -c, 0, d]          # f: +,0,-,-,0,+  → + → − at x=2, − → + at x=8
            key_x, other_x = 8, 2
        if b == c and rng.random() < 0.5:
            continue
        break
    f = PL(xs6, v)
    G = lambda x_: f.quad(x_, 10) if x_ < 10 else 0.0
    grid = [i / 20 for i in range(1, 200)]
    best = [x_ for x_ in grid[1:-1] if G(x_) > G(x_ - 0.05) + 1e-9 and G(x_) > G(x_ + 0.05) + 1e-9]
    if not best or abs(best[0] - key_x) > 0.1:
        raise ValueError("independent_check_failed")
    ds = [("Treats the zero where f changes from positive to negative as the maximum, forgetting that g'(x) = -f(x) because x is the lower limit.", other_x),
          ("Chooses x = 4, a vertex of the graph, without checking the sign change of f.", 4), ("Chooses x = 6, a vertex of the graph, without checking the sign change of f.", 6)]
    pool = opts(ds, key_x, lambda z: "$x=%d$" % z)
    stem = "The graph of the function $f$ is shown and consists of line segments. Let $g(x)=\\int_x^{10} f(t)\\,dt$ for $0\\le x\\le 10$. At which value of $x$ does $g$ have a relative maximum?"
    k = Opt("$x=%d$" % key_x, True, "g'(x) = -f(x) because x is the lower limit; g' changes from positive to negative where f changes from negative to positive.", key_x)
    bpr = bp("g_accum_reverse_extremum", "6.5", "2.E", "not_allowed", "Locate a relative extremum of an accumulation function whose variable is the lower limit",
             ["Apply the Fundamental Theorem with the variable lower limit: g' = -f", "Find where g' changes from positive to negative, i.e. where f changes from negative to positive", "Read that zero from the graph of f"],
             [("g is differentiable with g'(x) = -f(x) because f is continuous", "Fundamental Theorem of Calculus with a variable lower limit")],
             [("ignores_lower_limit_sign", "chooses the + to - crossing of f"), ("vertex_without_check", "picks a vertex without a sign change"), ("uses_f_extremum", "chooses a vertex because f is large or small there")],
             "g computed by numerical quadrature on a fine grid and its relative maximum located by comparing neighbouring values (independent of the sign analysis)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8, 10"]})
    return gpack("g_accum_reverse_extremum", "6.5", "2.E", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v], "x", (0, 10))), bpr, 100, [f"v={v}", f"key={key_x}"])


# 4) 6.4 FTC 와 연쇄법칙: F(x)=∫_0^{x^2} f(t) dt
def g_ftc_chain_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -3, 5)
        f = PL(XS5, v)
        a = rng.choice([1, 2])
        if a == 1 and (v[0] + v[1]) % 2:
            continue
        fa2 = f.at(a * a)
        fa = f.at(a)
        key = 2 * a * fa2
        area = f.area(0, a * a)
        d_slope = 2 * a * f.slope(a * a)
        if len({key, fa2, 2 * a * fa, area, d_slope}) == 5 and key != 0:
            break
    hh = 1e-6
    F = lambda x_: f.quad(0, x_ * x_)
    if abs((F(a + hh) - F(a - hh)) / (2 * hh) - float(key)) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [("Leaves out the chain rule factor 2x and reports f(a^2).", fa2), ("Evaluates the integrand at x = %d instead of at x^2 = %d." % (a, a * a), 2 * a * fa),
          ("Reports the value of the integral F(%d), the area under f from 0 to %d, instead of F'(%d)." % (a, a * a, a), area), ("Differentiates the integrand: 2x f'(x^2) instead of 2x f(x^2).", d_slope)]
    pool = opts(ds, key, fx)
    stem = f"The graph of the function $f$, consisting of line segments, is shown. Let $F(x)=\\int_0^{{x^2}} f(t)\\,dt$. What is $F'({a})$?"
    k = Opt(fx(key), True, "By the Fundamental Theorem with the chain rule, F'(x) = f(x^2) * 2x, so F'(%d) = 2(%d) f(%d) with f(%d) read from the graph." % (a, a, a * a, a * a), key)
    bpr = bp("g_ftc_chain_graph", "6.4", "1.D", "not_allowed", "Differentiate an accumulation function with an inner function in the upper limit using a graph of the integrand",
             ["Recognize F as an accumulation function with upper limit x squared", "Apply the Fundamental Theorem with the chain rule: F' = f(x^2) 2x", "Read f at the required input from the graph"],
             [("f is continuous so the Fundamental Theorem applies; the upper limit x^2 is differentiable", "f is a continuous polygon graph")],
             [("no_chain_factor", "omits the factor 2x"), ("inner_not_applied", "uses f(x) not f(x^2)"), ("area_not_derivative", "reports the integral"), ("differentiates_integrand", "differentiates the integrand")],
             "central difference (step 1e-6) of F computed by numerical quadrature of the interpolated graph (independent of the Fundamental Theorem)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_ftc_chain_graph", "6.4", "1.D", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 95, [f"v={v}", f"a={a}", f"key={key}"])


# 5) 8.3 유입·유출률 그래프 두 개: 탱크 속 양
def g_inflow_outflow_graph(rng):
    for _ in forever():
        vi = rand_vals(rng, 5, 0, 6)
        vo = rand_vals(rng, 5, 0, 6)
        I, O = PL(XS5, vi), PL(XS5, vo)
        b = rng.choice([4, 6, 8])
        k0 = rng.randint(4, 20)
        ain, aout = I.area(0, b), O.area(0, b)
        key = k0 + ain - aout
        if len({key, ain - aout, k0 + ain + aout, k0 + ain, k0 + aout - ain}) == 5 and key > 0 and ain != aout:
            break
    if abs(k0 + I.quad(0, b) - O.quad(0, b) - float(key)) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Reports the net change only and forgets the %d gallons already in the tank." % k0, ain - aout), ("Adds the outflow instead of subtracting it.", k0 + ain + aout),
          ("Counts only the water that flows in.", k0 + ain), ("Subtracts the inflow from the outflow, reversing the net change.", k0 + aout - ain)]
    pool = opts(ds, key, fx)
    stem = f"Water flows into a tank at a rate $I(t)$ and out at a rate $O(t)$, both in gallons per minute, for $0\\le t\\le 8$ minutes. The graphs of $I$ and $O$ are shown, and each consists of line segments. The tank holds {k0} gallons at $t=0$. How many gallons are in the tank at $t={b}$?"
    k = Opt(fx(key), True, "Amount at t = b equals the initial amount plus the integral of inflow minus outflow, each area read from the graphs.", key)
    bpr = bp("g_inflow_outflow_graph", "8.3", "1.D", "not_allowed", "Use net change of inflow minus outflow from two rate graphs and the initial amount",
             ["Recognize the amount at time b as initial amount plus the integral of (inflow - outflow)", "Compute the area under each graph from 0 to b", "Combine initial amount, inflow area and outflow area"],
             [("amount at time b = initial amount + integral of the net rate", "net change theorem; both rates are given for the whole interval")],
             [("forgets_initial", "reports only the net change"), ("adds_outflow", "adds outflow"), ("inflow_only", "ignores outflow"), ("reversed_sign", "outflow minus inflow")],
             "numerical quadrature of the two interpolated rate graphs (independent of the trapezoid formula)", {"type": "graph", "must_include": ["vertices of I at t = 0, 2, 4, 6, 8", "vertices of O at t = 0, 2, 4, 6, 8"]})
    return gpack("g_inflow_outflow_graph", "8.3", "1.D", "not_allowed", stem, k, pool, rng, gstim("Graphs of the inflow rate I and the outflow rate O, each consisting of line segments connecting the plotted vertices.", [("I", I.vert()), ("O", O.vert())], *_ax([vi, vo], "t", (0, 8), "gallons per minute")), bpr, 100, [f"vi={vi}", f"vo={vo}", f"b={b}", f"key={key}"])


# 6) 8.2 속도 그래프: 총 이동 거리
def g_total_distance_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -4, 4)
        f = PL(XS5, v)
        disp = f.area(0, 8)
        dist = abs_area(f)
        posarea = Fr(0)
        for i in range(4):
            d0, d1, w = f.vs[i], f.vs[i + 1], Fr(2)
            if d0 >= 0 and d1 >= 0:
                posarea += (d0 + d1) / 2 * w
            elif d0 <= 0 and d1 <= 0:
                pass
            elif d0 > 0:
                posarea += d0 * d0 / (2 * (d0 - d1)) * w
            else:
                posarea += d1 * d1 / (2 * (d1 - d0)) * w
        x0 = rng.randint(1, 5)
        if any(v[i] * v[i + 1] < 0 for i in range(4)) and len({dist, disp, posarea, x0 + disp}) == 4 and disp != 0:
            break
    num = _I.quad(lambda u: abs(f.num(u)), 0, 8, points=[2, 4, 6], limit=200)[0]
    if abs(num - float(dist)) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Reports the net signed area, which is the displacement, not the distance.", disp), ("Reports the particle's final position x(8) = x(0) + displacement.", x0 + disp),
          ("Counts only the forward motion (area above the axis) and ignores the backward motion.", posarea)]
    pool = opts(ds, dist, fx)
    stem = f"A particle moves along a line with velocity $v(t)$ in meters per second. The graph of $v$ for $0\\le t\\le 8$ is shown and consists of line segments. The particle's position at $t=0$ is $x(0)={x0}$ meters. What is the total distance traveled by the particle from $t=0$ to $t=8$?"
    k = Opt(fx(dist), True, "Total distance is the integral of |v|: the area between the graph and the t-axis, with area below the axis counted as positive.", dist)
    bpr = bp("g_total_distance_graph", "8.2", "1.D", "not_allowed", "Distinguish total distance from displacement and final position using a velocity graph",
             ["Recognize that total distance is the integral of speed |v|, not of v", "Find the areas above and below the axis separately from the graph", "Add the magnitudes"],
             [("distance traveled is the integral of |v| over the interval", "definition of total distance for straight-line motion")],
             [("displacement", "net signed area"), ("final_position", "adds x(0) to the displacement"), ("forward_only", "counts only positive area")],
             "numerical quadrature of |v| with breakpoints at the vertices (independent of the exact piecewise formula)", {"type": "graph", "must_include": ["vertices of v at t = 0, 2, 4, 6, 8"]})
    return gpack("g_total_distance_graph", "8.2", "1.D", "not_allowed", stem, k, pool, rng, gstim("Graph of v(t), consisting of line segments connecting the plotted vertices.", [("v", f.vert())], *_ax([v], "t", (0, 8), "v(t)")), bpr, 100, [f"v={v}", f"x0={x0}", f"dist={dist}"])


# 7) 8.1 평균값: 그래프의 PL 함수
def g_avg_value_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -2, 6)
        f = PL(XS5, v)
        area = f.area(0, 8)
        key = area / 8
        meanv = Fr(sum(v), 5)
        ends = Fr(v[0] + v[4], 2)
        if len({key, area, meanv, ends, area / 4}) == 5 and key.denominator in (1, 2, 4, 8) and key > 0:
            break
    if abs(f.quad(0, 8) / 8 - float(key)) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Reports the integral of f over [0, 8] and does not divide by the length of the interval.", area), ("Averages the five vertex values read from the graph instead of integrating.", meanv),
          ("Averages only the two endpoint values f(0) and f(8).", ends), ("Divides the integral by 4, the number of line segments, instead of by the interval length 8.", area / 4)]
    pool = opts(ds, key, fx)
    stem = "The graph of the function $f$ on $[0,8]$ is shown and consists of line segments. What is the average value of $f$ on the interval $[0,8]$?"
    k = Opt(fx(key), True, "Average value = (1/(b - a)) times the integral of f over [a, b]; the integral is the signed area read from the graph.", key)
    bpr = bp("g_avg_value_graph", "8.1", "1.E", "not_allowed", "Compute the average value of a function from its graph as integral divided by interval length",
             ["Compute the signed area under the graph from 0 to 8", "Divide by the interval length 8"],
             [("the average value of a continuous function on [a, b] is the integral divided by b - a", "definition (mean value of a function)")],
             [("no_division", "forgets to divide"), ("mean_of_vertices", "averages vertex values"), ("endpoint_average", "averages endpoints"), ("wrong_divisor", "divides by the number of segments")],
             "numerical quadrature of the interpolated graph divided by 8 (independent of trapezoid areas)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_avg_value_graph", "8.1", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 80, [f"v={v}", f"key={key}"])


# 8) 8.4 두 그래프 사이 넓이(교차 포함)
def g_area_between_graph(rng):
    for _ in forever():
        vf = rand_vals(rng, 5, 0, 7)
        vg = rand_vals(rng, 5, 0, 7)
        f, g = PL(XS5, vf), PL(XS5, vg)
        d = sub(f, g)
        if not any(d.vs[i] * d.vs[i + 1] < 0 for i in range(4)):
            continue
        area = abs_area(d)
        net = d.area(0, 8)
        if len({area, net, f.area(0, 8), g.area(0, 8), abs(net)}) >= 4 and net != 0 and area.denominator <= 12:
            break
    fn = lambda u: abs(f.num(u) - g.num(u))
    if abs(_I.quad(fn, 0, 8, points=[x_ for x_ in XS5], limit=300)[0] - float(area)) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Integrates f - g over the whole interval, so the area below the crossing cancels the area above it.", net), ("Reports the area under the graph of f alone.", f.area(0, 8)),
          ("Reports the area under the graph of g alone.", g.area(0, 8)), ("Uses the absolute value of the net integral, |integral of (f - g)|.", abs(net))]
    pool = opts(ds, area, fx)
    stem = "The graphs of the functions $f$ and $g$ are shown, each consisting of line segments. The graphs cross at least once between $x=0$ and $x=8$. What is the total area of the region enclosed between the two graphs for $0\\le x\\le 8$?"
    k = Opt(fx(area), True, "The area is the integral of |f - g|: the graphs cross, so the upper and lower functions switch and each piece must be counted as positive.", area)
    bpr = bp("g_area_between_graph", "8.4", "1.D", "not_allowed", "Set up and evaluate the area between two graphs that cross",
             ["Identify where the graphs cross and which one is above on each piece", "Integrate (upper - lower) on each piece using areas read from the graphs", "Add the positive piece areas"],
             [("area between curves is the integral of the absolute difference when the curves cross", "definition of area between curves")],
             [("net_integral", "lets areas cancel"), ("area_under_f", "area under f only"), ("area_under_g", "area under g only"), ("abs_of_net", "takes the absolute value of the net")],
             "numerical quadrature of |f - g| with breakpoints at the vertices (independent of the exact crossing computation)", {"type": "graph", "must_include": ["vertices of f", "vertices of g"]})
    return gpack("g_area_between_graph", "8.4", "1.D", "not_allowed", stem, k, pool, rng, gstim("Graphs of f and g, each consisting of line segments connecting the plotted vertices.", [("f", f.vert()), ("g", g.vert())], *_ax([vf, vg])), bpr, 105, [f"vf={vf}", f"vg={vg}", f"area={area}"])


# 9) 8.7 정사각형 단면: 밑면 영역이 그래프와 x 축 사이
def g_volume_base_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, 0, 5)
        f = PL(XS5, v)
        vol = f.sq_area(0, 8)
        area = f.area(0, 8)
        if v.count(0) <= 1 and len({vol, area ** 2, area, vol / 2}) == 4 and vol.denominator <= 3:
            break
    if abs(f.quad(0, 8, lambda u: f.num(u) ** 2) - float(vol)) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Squares the area of the base region, (integral of f)^2, instead of integrating f squared.", area ** 2), ("Reports the area of the base region and does not square the cross-section side.", area),
          ("Uses half of the integral of f squared, the area formula for a right-triangle cross section.", vol / 2), ("Multiplies the integral of f squared by pi, the formula for rotating the region about the x-axis.", vol * sp.pi)]
    pool = opts(ds, vol, anyfmt)
    stem = "The graph of the function $f$ is shown and consists of line segments. Let $R$ be the region bounded by the graph of $f$, the $x$-axis, and the vertical lines $x=0$ and $x=8$. $R$ is the base of a solid whose cross sections perpendicular to the $x$-axis are squares. What is the volume of the solid?"
    k = Opt(fx(vol), True, "Each square has side f(x), so V = integral of f(x)^2 dx; on a linear piece the integral of f^2 is (a^2 + a b + b^2)/3 times the width.", vol)
    bpr = bp("g_volume_base_graph", "8.7", "1.D", "not_allowed", "Set up and evaluate a volume with square cross sections whose side is given by a graph",
             ["Recognize that the side of each square is f(x) and its area is f(x) squared", "Integrate f squared over [0, 8] piece by piece using the graph", "Evaluate the exact value"],
             [("f is nonnegative so the side length equals f(x)", "all plotted vertices are at or above the x-axis")],
             [("square_of_area", "squares the integral"), ("no_squaring", "reports the area"), ("triangle_factor", "halves the integral of f squared"), ("disk_factor", "multiplies by pi")],
             "numerical quadrature of the interpolated f squared (independent of the exact quadratic piece formula)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_volume_base_graph", "8.7", "1.D", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 105, [f"v={v}", f"vol={vol}"])


# 10) 7.8 지수 모델: 그래프의 두 점에서 k
def g_exp_growth_constant(rng):
    P0, m, T = rng.choice([1, 2, 3]), rng.choice([2, 3, 4]), rng.choice([2, 4])
    key = sp.log(m) / T
    PT = P0 * m
    ds = [("Takes ln of the ratio but forgets to divide by the elapsed time %d." % T, sp.log(m)), ("Uses the average slope of the chord from A to B, (P(%d) - P(0))/%d, instead of a growth constant." % (T, T), Fr(PT - P0, T)),
          ("Takes ln of the value P(%d) = %d instead of the ratio P(%d)/P(0), then divides by %d." % (T, PT, T, T), sp.log(PT) / T), ("Divides the ratio by the time, %d/%d, without taking the logarithm." % (m, T), Fr(m, T))]
    pool = opts(ds, key, anyfmt)
    kk = math.log(m) / T
    ts = [i / 5 for i in range(0, 21)]
    pts = [[round(t_, 2), round(P0 * math.exp(kk * t_), 4)] for t_ in ts]
    # 독립 경로: 곡선의 수치 값 두 점에서 k 를 다시 계산
    if abs(math.log(pts[T * 5][1] / pts[0][1]) / T - kk) > 1e-3:
        raise ValueError("independent_check_failed")
    ymax = int(math.ceil(P0 * math.exp(kk * 4)))
    stem = f"A population $P$ at time $t$ (in years) satisfies the differential equation $\\dfrac{{dP}}{{dt}}=kP$ for a constant $k$. The graph of $P$ is shown and passes through the labeled points $A$ and $B$. What is the value of $k$?"
    k = Opt(fmt(key), True, "P(t) = P(0) e^{kt}; the labeled points give P(%d) / P(0) = %d, so k = ln(%d)/%d." % (T, m, m, T), float(sp.N(key)))
    bpr = bp("g_exp_growth_constant", "7.8", "1.E", "not_allowed", "Find the growth constant of an exponential model from two points on its graph",
             ["Read the coordinates of the labeled points A and B from the graph", "Use P(t) = P(0) e^{kt} to relate the ratio of values to the exponent", "Solve for k using a natural logarithm"],
             [("solutions of dP/dt = kP have the form P(0) e^{kt}", "exponential model stated in the problem")],
             [("no_time_division", "ln of the ratio without dividing by t"), ("chord_slope", "uses the average rate of change"), ("log_of_value", "ln of the value instead of the ratio"), ("no_log", "divides ratio by time")],
             "k recomputed as ln(P(T)/P(0))/T from the dense numerical curve samples (independent of the exact exponents)", {"type": "graph", "must_include": ["exponential curve for 0 <= t <= 4", "labeled points A = (0, P0) and B = (T, m P0)"]})
    stim = gstim("Graph of P(t), an increasing exponential curve, with labeled points A and B.", [("P", pts)], axis("t", 0, 4, 1), axis("P", 0, ymax + 1, P0), {"labeled_points": {"A": [0, P0], "B": [T, PT]}})
    return gpack("g_exp_growth_constant", "7.8", "1.E", "not_allowed", stem, k, pool, rng, stim, bpr, 85, [f"P0={P0}", f"m={m}", f"T={T}"])


# 11) 4.5 관련 변화율: 반지름·높이 그래프 두 개
def g_related_rates_two_graphs(rng):
    for _ in forever():
        vr = rand_vals(rng, 5, 1, 6)
        vh = rand_vals(rng, 5, 1, 6)
        if any((vr[i] + vr[i + 1]) % 2 or (vh[i] + vh[i + 1]) % 2 for i in range(4)):
            continue
        a = rng.choice([1, 3, 5, 7])
        i = (a - 1) // 2
        r, h = PL(XS5, vr), PL(XS5, vh)
        ra, ha, rp, hp = r.at(a), h.at(a), r.slope_seg(i), h.slope_seg(i)
        key = Fr(1, 3) * (2 * ra * ha * rp + ra * ra * hp)
        d1 = Fr(1, 3) * (2 * ra * ha * rp)
        d2 = Fr(1, 3) * ra * ra * hp
        d3 = 2 * ra * ha * rp + ra * ra * hp
        d4 = Fr(1, 3) * ra * ra * ha
        if rp != 0 and hp != 0 and len({key, d1, d2, d3, d4}) == 5:
            break
    hh = 1e-6
    V = lambda u: math.pi / 3 * r.num(u) ** 2 * h.num(u)
    if abs((V(a + hh) - V(a - hh)) / (2 * hh) - float(key) * math.pi) > 1e-4:
        raise ValueError("independent_check_failed")
    pi = sp.pi
    ds = [("Omits the h'(t) term of the product rule and keeps only (pi/3)(2 r h r').", d1 * pi), ("Omits the r'(t) term of the product rule and keeps only (pi/3) r^2 h'.", d2 * pi),
          ("Forgets the factor 1/3 in the volume formula.", d3 * pi), ("Evaluates V itself, (pi/3) r^2 h, instead of dV/dt.", d4 * pi)]
    pool = opts(ds, key * pi, anyfmt)
    stem = f"The radius $r(t)$ and the height $h(t)$, in centimeters, of a right circular cone at time $t$ seconds are shown in the graphs, each consisting of line segments. The volume of the cone is $V=\\frac13\\pi r^2h$. At what rate, in cubic centimeters per second, is the volume changing at $t={a}$?"
    k = Opt(anyfmt(key * pi), True, "dV/dt = (pi/3)(2 r h r' + r^2 h') with r, h, r', h' read from the graphs at t = %d." % a, key * pi)
    bpr = bp("g_related_rates_two_graphs", "4.5", "1.D", "not_allowed", "Solve a related rates problem for a cone when both dimensions are given by graphs",
             ["Differentiate V = (1/3) pi r^2 h with respect to t using the product and chain rules", "Read r, h, r' and h' at the given time from the graphs", "Substitute and simplify"],
             [("r and h are differentiable at the given time because it lies inside a segment of each graph", "t is an odd integer, never a vertex")],
             [("missing_h_term", "drops the h' term"), ("missing_r_term", "drops the r' term"), ("no_one_third", "forgets 1/3"), ("volume_not_rate", "evaluates V")],
             "central difference (step 1e-6) of V(t) built from the numerically interpolated r and h (independent of the product rule)", {"type": "graph", "must_include": ["vertices of r", "vertices of h"]})
    return gpack("g_related_rates_two_graphs", "4.5", "1.D", "not_allowed", stem, k, pool, rng, gstim("Graphs of r(t) and h(t), each consisting of line segments connecting the plotted vertices.", [("r", r.vert()), ("h", h.vert())], *_ax([vr, vh], "t", (0, 8), "centimeters")), bpr, 110, [f"vr={vr}", f"vh={vh}", f"a={a}", f"key={key}"])


# ---------- 불연속 그래프(pieces) ----------
def _pieces_stim(desc, pieces, iso, xax, yax):
    data = {"x_axis": xax, "y_axis": yax, "pieces": pieces}
    if iso:
        data["isolated_points"] = [{"point": list(p), "style": "filled"} for p in iso]
    return {"kind": "graph", "description": desc, "data": data}


def _seg(p0, p1, lo="closed", ro="closed"):
    return {"from": list(p0), "to": list(p1), "left_end": lo, "right_end": ro}


# 12) 1.3 한쪽 극한의 합(점프 + 따로 찍힌 함수값)
def g_lim_jump_sum(rng):
    for _ in forever():
        c = rng.choice([2, 3, 4])
        y1, L, R, y2, fc = (rng.randint(-3, 5) for _ in range(5))
        if len({L, R, fc}) == 3 and (y1 != L) and (y2 != R):
            break
    key = L + R
    ds = [("Uses f(%d), the value plotted at the point itself, instead of the one-sided limits." % c, fc), ("Multiplies the one-sided limits instead of adding them.", L * R),
          ("Subtracts the right-hand limit from the left-hand limit.", L - R), ("Adds f(%d) to the left-hand limit and ignores the right-hand limit." % c, fc + L)]
    pool = opts(ds, key, lambda z: "$%d$" % z)
    pieces = [_seg((c - 2, y1), (c, L), "closed", "open"), _seg((c, R), (c + 2, y2), "open", "closed")]
    stem = f"The graph of the function $f$ is shown. What is the value of $\\displaystyle\\lim_{{x\\to {c}^-}}f(x)+\\lim_{{x\\to {c}^+}}f(x)$?"
    k = Opt("$%d$" % key, True, "The left-hand limit is %d and the right-hand limit is %d (open circles show the values approached); the plotted value f(%d) = %d does not enter the one-sided limits." % (L, R, c, fc), key)
    # 독립 경로: 선분을 따라 c 에 다가가는 수치 극한
    lf = lambda u: y1 + (L - y1) * (u - (c - 2)) / 2
    rf = lambda u: R + (y2 - R) * (u - c) / 2
    if abs(lf(c - 1e-9) + rf(c + 1e-9) - key) > 1e-6:
        raise ValueError("independent_check_failed")
    bpr = bp("g_lim_jump_sum", "1.3", "2.B", "not_allowed", "Read one-sided limits from a graph with a jump and an isolated plotted value",
             ["Read the value approached from the left, ignoring the plotted point", "Read the value approached from the right", "Add the two limits"],
             [("one-sided limits are determined by the graph near x = c, not by f(c)", "open circles mark the limit values and a separate filled point marks f(c)")],
             [("function_value", "uses the plotted value f(c)"), ("product", "multiplies the limits"), ("difference", "subtracts the limits")],
             "numerical evaluation of the two linear pieces at c -/+ 1e-9 (independent of the endpoints read from the figure)", {"type": "graph", "must_include": ["left piece ending at an open circle at x = c", "right piece starting at an open circle at x = c", "filled point for f(c)"]})
    return gpack("g_lim_jump_sum", "1.3", "2.B", "not_allowed", stem, k, pool, rng, _pieces_stim("Graph of f: two line segments with open circles at x = %d and a separate filled point at x = %d." % (c, c), pieces, [(c, fc)], axis("x", 0, 6, 1), axis("y", min(-4, y1, y2, fc) - 1, max(y1, y2, fc, L, R) + 1, 1)), bpr, 75, [f"c={c}", f"L={L}", f"R={R}", f"fc={fc}"])


