"""AB 그래프 필수 MC 신규 원형 G군(2026-10-09, 단계 S3): 계산기 불가, 단원 1·4·5·6·8. 구간선형 그래프, 정확한 유리수 + 별도 수치 경로."""
from gcommon import *
from scipy import optimize as _O, integrate as _I

XS5 = [0, 2, 4, 6, 8]


def _ax(vals_list, xlab="x", xr=(0, 8), ylab="y"):
    allv = [v for vs in vals_list for v in vs]
    return axis(xlab, xr[0], xr[1], 1), axis(ylab, min(0, min(allv)) - 1, max(0, max(allv)) + 1, 1)


def _crossings(f, level):
    """f(x)=level 인 서로 다른 x 의 개수(구간선형, 꼭짓점에서 만나도 한 번)."""
    xs = set()
    for i in range(f.n):
        a_, b_ = f.vs[i] - level, f.vs[i + 1] - level
        if a_ == 0:
            xs.add(f.xs[i])
        if b_ == 0:
            xs.add(f.xs[i + 1])
        if a_ * b_ < 0:
            xs.add(f.xs[i] + (f.xs[i + 1] - f.xs[i]) * a_ / (a_ - b_))
    return len(xs)


# 1) 5.1 평균변화율과 같은 도함수 값을 갖는 점의 개수
def g_mvt_fprime_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -3, 5)
        fp = PL(XS5, v)
        area = fp.area(0, 8)
        avg = area / 8
        f0 = rng.randint(0, 5)
        cnt = _crossings(fp, avg)
        zeros = _crossings(fp, 0)
        if avg.denominator <= 8 and cnt in (2, 3) and zeros != cnt and cnt != 1 and all(Fr(z) != avg for z in v):
            break
    f8 = f0 + area
    # 독립 경로: 촘촘한 표본에서 f'(x) - avg 의 부호 변화(또는 0) 횟수
    grid = [i / 200 for i in range(0, 1601)]
    vals = [fp.num(u) - float(avg) for u in grid]
    ch = sum(1 for i in range(len(vals) - 1) if vals[i] * vals[i + 1] < 0 or (abs(vals[i]) < 1e-12 and 0 < i < len(vals) - 1))
    ch += (1 if abs(vals[0]) < 1e-12 and False else 0)
    if abs(ch - cnt) > 0 and not (abs(vals[0]) < 1e-12 or abs(vals[-1]) < 1e-12):
        raise ValueError("independent_check_failed")
    ds = [("The Mean Value Theorem guarantees at least one such point, but it does not say there is exactly one; the graph shows more.", 1), ("Counts the zeros of f' instead of the points where f' equals the average rate of change.", zeros),
          ("Counts the vertices of the graph in (0, 8) instead of the points where f' equals the average rate.", 3), ("Concludes there are no such points because f' never equals the average value at a vertex.", 0), ("Counts the four line segments of the graph.", 4)]
    pool = opts(ds, cnt, lambda n: "$%d$" % n)
    stem = f"The function $f$ is differentiable on $[0,8]$ with $f(0)={f0}$ and $f(8)={fx(f8).strip('$')}$. The graph of $f'$ is shown and consists of line segments. For how many values of $x$ in the interval $(0,8)$ does $f'(x)$ equal the average rate of change of $f$ on $[0,8]$?"
    k = Opt("$%d$" % cnt, True, "The average rate of change is (f(8) - f(0))/8 = %s; counting the points where the graph of f' is at that height gives %d." % (fx(avg).strip("$"), cnt), cnt)
    bpr = bp("g_mvt_fprime_graph", "5.1", "3.D", "not_allowed", "Count the points where f' equals the average rate of change using the graph of f'",
             ["Compute the average rate of change of f on [0, 8] from the given endpoint values", "Draw the horizontal level equal to that value on the graph of f'", "Count the distinct x-values where the graph meets the level"],
             [("the Mean Value Theorem guarantees at least one point, and the graph determines the exact number", "f is differentiable on [0, 8] with the given endpoint values")],
             [("exactly_one", "assumes exactly one point"), ("zeros_of_fprime", "counts zeros of f'"), ("all_vertices", "counts vertices"), ("none", "concludes there is none")],
             "dense sampling of f'(x) minus the average value and counting sign changes (independent of exact crossing arithmetic)", {"type": "graph", "must_include": ["vertices of f' at x = 0, 2, 4, 6, 8"]})
    return gpack("g_mvt_fprime_graph", "5.1", "3.D", "not_allowed", stem, k, pool, rng, gstim("Graph of f', consisting of line segments connecting the plotted vertices.", [("f'", fp.vert())], *_ax([v], "x", (0, 8), "f'(x)")), bpr, 110, [f"v={v}", f"f0={f0}", f"cnt={cnt}"])


# 2) 5.3 상대 극값의 개수(영점에서 부호가 안 바뀌는 접촉 포함)
def g_extrema_count_fprime(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -3, 4)
        fp = PL(XS5, v)
        # 부호 변화(구간 내부 또는 꼭짓점에서 0 을 지나며 부호가 바뀜)
        signs = []
        for i in range(4):
            a_, b_ = v[i], v[i + 1]
            if a_ * b_ < 0:
                signs.append(1 if a_ < 0 else -1)
        zv = [i for i in (1, 2, 3) if v[i] == 0]
        ch = len(signs)
        for i in zv:
            l_, r_ = v[i - 1], v[i + 1]
            if l_ * r_ < 0:
                signs.append(1 if l_ < 0 else -1)
        ch = len(signs)
        touch = sum(1 for i in zv if v[i - 1] * v[i + 1] > 0)
        zeros = ch + touch
        if touch >= 1 and ch in (1, 2) and zeros != ch:
            break
    # 독립 경로: 촘촘한 표본에서 f' 부호가 +/- 로 바뀌는 횟수(0 은 건너뜀)
    grid = [i / 100 for i in range(1, 800)]
    sg = [s for s in (1 if fp.num(u) > 1e-9 else (-1 if fp.num(u) < -1e-9 else 0) for u in grid) if s != 0]
    nchg = sum(1 for i in range(len(sg) - 1) if sg[i] != sg[i + 1])
    if nchg != ch:
        raise ValueError("independent_check_failed")
    ds = [("Counts every zero of f' as a relative extremum, including the zero where f' touches the axis without changing sign.", zeros), ("Counts the vertices of the graph of f' in (0, 8) as extrema of f.", 3),
          ("Counts the relative extrema of f' itself, which are inflection points of f.", sum(1 for i in range(3) if (v[i + 1] - v[i]) * (v[i + 2] - v[i + 1]) < 0)), ("Counts only one sign change.", 1 if ch != 1 else 2), ("Counts the four line segments of the graph.", 4)]
    pool = opts(ds, ch, lambda n: "$%d$" % n)
    stem = "The graph of $f'$, the derivative of the function $f$, is shown on $[0,8]$ and consists of line segments. At how many values of $x$ in $(0,8)$ does $f$ have a relative extremum?"
    k = Opt("$%d$" % ch, True, "Relative extrema of f occur where f' changes sign; a zero where the graph touches the axis without crossing it is not an extremum.", ch)
    bpr = bp("g_extrema_count_fprime", "5.4", "2.D", "not_allowed", "Count relative extrema of f from sign changes of the graph of f', excluding touch points",
             ["Find the zeros of f' on the graph", "Keep only the zeros where f' changes sign (first derivative test)", "Count the remaining sign changes"],
             [("f is differentiable (f' continuous) so a relative extremum requires a sign change of f'", "first derivative test")],
             [("counts_touch_zero", "counts a touching zero"), ("counts_vertices", "counts vertices"), ("counts_fprime_extrema", "counts extrema of f'"), ("counts_one", "counts only one change")],
             "dense sampling of the sign of f' and counting sign alternations (independent of listing the zeros)", {"type": "graph", "must_include": ["vertices of f' at x = 0, 2, 4, 6, 8"]})
    return gpack("g_extrema_count_fprime", "5.4", "2.D", "not_allowed", stem, k, pool, rng, gstim("Graph of f', consisting of line segments connecting the plotted vertices.", [("f'", fp.vert())], *_ax([v], "x", (0, 8), "f'(x)")), bpr, 90, [f"v={v}", f"ch={ch}", f"zeros={zeros}"])


# 3) 6.6 정적분의 성질: ∫ (c f + d)
def g_integral_properties_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -2, 6)
        f = PL(XS5, v)
        A = f.area(0, 8)
        c = rng.choice([2, 3, -1, -2])
        d = rng.choice([1, 2, 3])
        key = c * A + 8 * d
        if len({key, c * A + d, c * A, A + 8 * d, c * (A + 8 * d)}) == 5 and A != 0:
            break
    if abs(c * f.quad(0, 8) + 8 * d - float(key)) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Adds the constant d once instead of integrating it over the interval, which contributes d times the length 8.", c * A + d), ("Leaves out the constant and integrates only the scaled function.", c * A),
          ("Forgets to multiply the area by the constant factor.", A + 8 * d), ("Multiplies the whole integral, including the constant term, by the factor.", c * (A + 8 * d))]
    pool = opts(ds, key, fx)
    cs = "%d" % c if c != 1 else ""
    expr = f"{c}f(x)+{d}"
    stem = f"The graph of the function $f$ is shown and consists of line segments. What is the value of $\\int_0^8 \\left({expr}\\right)dx$?"
    k = Opt(fx(key), True, "Linearity: the integral equals %d times the integral of f (area read from the graph) plus %d times the length 8." % (c, d), key)
    bpr = bp("g_integral_properties_graph", "6.6", "1.E", "not_allowed", "Use properties of definite integrals with an area read from a graph",
             ["Split the integral into the scaled function and the constant", "Evaluate the integral of f as the signed area under the graph", "Integrate the constant over the interval length"],
             [("the integral of a sum is the sum of the integrals and constant factors can be pulled out", "linearity of the definite integral")],
             [("constant_not_integrated", "adds d once"), ("constant_dropped", "drops the constant"), ("factor_forgotten", "forgets the factor"), ("factor_on_everything", "scales the constant too")],
             "numerical quadrature of c f + d on the interpolated graph (independent of linearity)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_integral_properties_graph", "6.6", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 90, [f"v={v}", f"c={c}", f"d={d}", f"key={key}"])


# 4) 6.4 변수 아래끝 a 가 0 이 아닌 누적함수의 값
def g_accum_two_values(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -3, 5)
        f = PL(XS5, v)
        k0 = rng.randint(1, 8)
        b = rng.choice([0, 6, 8])
        # g(x) = k0 + ∫_2^x f
        key = k0 + (f.area(2, b) if b > 2 else -f.area(b, 2))
        alts = [k0 + f.area(0, b), k0 - (f.area(2, b) if b > 2 else -f.area(b, 2)), f.area(2, b) if b > 2 else -f.area(b, 2), k0 + f.area(b, 2) if b < 2 else k0 + abs(f.area(2, b))]
        if len({key, *alts}) >= 4:
            break
    num = k0 + (f.quad(2, b) if b > 2 else -f.quad(b, 2))
    if abs(num - float(key)) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Uses 0 as the lower limit of integration instead of 2.", alts[0]), ("Subtracts the integral from the initial value instead of adding it.", alts[1]),
          ("Reports the integral alone and leaves out the initial value %d." % k0, alts[2]), ("Counts the area as positive regardless of its sign or direction of integration.", alts[3])]
    pool = opts(ds, key, fx)
    stem = f"The graph of the function $f$ is shown and consists of line segments. Let $g(x)={k0}+\\int_2^x f(t)\\,dt$. What is the value of $g({b})$?"
    k = Opt(fx(key), True, "g(%d) = %d + the integral of f from 2 to %d%s." % (b, k0, b, " (reversing the limits changes the sign)" if b < 2 else ""), key)
    bpr = bp("g_accum_two_values", "6.4", "2.B", "not_allowed", "Evaluate an accumulation function whose lower limit is not the left endpoint, using signed areas from a graph",
             ["Identify the lower limit 2 and the initial value g(2) = k", "Compute the signed area between 2 and the input from the graph, reversing the sign when the input is below 2", "Add the initial value"],
             [("g(2) equals the constant k and g changes by the signed area of f", "Fundamental Theorem of Calculus")],
             [("wrong_lower_limit", "uses 0 as lower limit"), ("subtracts_integral", "subtracts the integral"), ("no_initial_value", "forgets the initial value"), ("sign_ignored", "ignores signs")],
             "numerical quadrature of the interpolated graph between 2 and b (independent of trapezoid areas)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_accum_two_values", "6.4", "2.B", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 95, [f"v={v}", f"k0={k0}", f"b={b}", f"key={key}"])


# 5) 8.11 와셔: 두 그래프를 x 축 둘레로 회전
def g_volume_washer_graph(rng):
    for _ in forever():
        vf = rand_vals(rng, 5, 2, 7)
        vg = rand_vals(rng, 5, 0, 4)
        f, g = PL(XS5, vf), PL(XS5, vg)
        if any(vf[i] <= vg[i] for i in range(5)):
            continue
        key = f.sq_area(0, 8) - g.sq_area(0, 8)
        d = sub(f, g)
        d2 = d.sq_area(0, 8)
        a1 = f.area(0, 8) - g.area(0, 8)
        if len({key, d2, f.sq_area(0, 8), a1 * a1}) == 4 and key.denominator <= 3:
            break
    pi = sp.pi
    num = _I.quad(lambda u: f.num(u) ** 2 - g.num(u) ** 2, 0, 8, points=[2, 4, 6], limit=200)[0]
    if abs(num - float(key)) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Squares the difference of the radii, pi times the integral of (f - g)^2, instead of the difference of the squared radii.", d2 * pi), ("Uses only the outer radius, pi times the integral of f^2, and leaves out the hole.", f.sq_area(0, 8) * pi),
          ("Squares the area between the graphs, pi (integral of f - g)^2.", a1 * a1 * pi), ("Leaves out the factor pi.", key)]
    pool = opts(ds, key * pi, anyfmt)
    stem = "The graphs of the functions $f$ and $g$ are shown and each consists of line segments, with $f(x)>g(x)\\ge 0$ for $0\\le x\\le 8$. The region between the graphs is revolved about the $x$-axis. What is the volume of the solid generated?"
    k = Opt(anyfmt(key * pi), True, "Washers with outer radius f and inner radius g: V = pi times the integral of (f^2 - g^2), computed piece by piece from the graphs.", key * pi)
    bpr = bp("g_volume_washer_graph", "8.11", "1.D", "not_allowed", "Set up and evaluate a washer-method volume from two graphs",
             ["Identify the outer radius f and inner radius g from the graphs", "Write the volume as pi times the integral of f squared minus g squared", "Evaluate exactly piece by piece"],
             [("f is above g and both are nonnegative so washers are formed", "stated in the problem")],
             [("square_of_difference", "squares the difference"), ("outer_only", "ignores the hole"), ("square_of_area", "squares the area"), ("missing_pi", "omits the factor pi")],
             "numerical quadrature of f^2 - g^2 with breakpoints at the vertices times pi (independent of exact quadratic pieces)", {"type": "graph", "must_include": ["vertices of f", "vertices of g"]})
    return gpack("g_volume_washer_graph", "8.11", "1.D", "not_allowed", stem, k, pool, rng, gstim("Graphs of f and g, each consisting of line segments connecting the plotted vertices.", [("f", f.vert()), ("g", g.vert())], *_ax([vf, vg])), bpr, 115, [f"vf={vf}", f"vg={vg}", f"key={key}"])


# 6) 8.8 반원 단면
def g_volume_semicircle_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, 0, 5)
        f = PL(XS5, v)
        S = f.sq_area(0, 8)
        key = S / 8
        if v.count(0) <= 1 and S > 0 and len({key, S / 2, S / 4, S, f.area(0, 8) ** 2 / 8}) == 5 and key.denominator <= 3:
            break
    pi = sp.pi
    num = math.pi / 8 * f.quad(0, 8, lambda u: f.num(u) ** 2)
    if abs(num - float(key * pi)) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Uses pi/2 times the integral of f^2, the area of a semicircle with radius f rather than diameter f.", S / 2 * pi), ("Uses pi/4 times the integral of f^2, the area of a circle with diameter f.", S / 4 * pi),
          ("Leaves out the factor pi/8 and reports the integral of f^2.", S), ("Squares the area of the base region before multiplying by pi/8.", f.area(0, 8) ** 2 / 8 * pi)]
    pool = opts(ds, key * pi, anyfmt)
    stem = "The graph of the function $f$ is shown and consists of line segments. Let $R$ be the region bounded by the graph of $f$, the $x$-axis, and the lines $x=0$ and $x=8$. $R$ is the base of a solid whose cross sections perpendicular to the $x$-axis are semicircles with diameters in $R$. What is the volume of the solid?"
    k = Opt(anyfmt(key * pi), True, "Each semicircle has diameter f(x), so its area is (pi/2)(f/2)^2 = (pi/8) f^2 and V = (pi/8) times the integral of f^2.", key * pi)
    bpr = bp("g_volume_semicircle_graph", "8.8", "1.D", "not_allowed", "Find the volume of a solid with semicircular cross sections whose diameter is given by a graph",
             ["Express the area of a semicircle with diameter f(x) as pi/8 times f squared", "Integrate f squared over [0, 8] piece by piece from the graph", "Multiply by pi/8"],
             [("the diameter of each semicircle lies in the base region and equals f(x)", "stated in the problem")],
             [("radius_not_diameter", "uses the diameter as the radius"), ("full_circle", "uses a full circle"), ("missing_factor", "omits pi/8"), ("square_of_area", "squares the area")],
             "numerical quadrature of (pi/8) f^2 on the interpolated graph (independent of exact quadratic pieces)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_volume_semicircle_graph", "8.8", "1.D", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 105, [f"v={v}", f"key={key}"])


# 7) 1.16 중간값 정리: 끝점 사이의 값만 보장
def g_ivt_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, 0, 9)
        f = PL(XS5, v)
        a, b = 0, 8
        fa, fb = v[0], v[4]
        lo, hi = min(fa, fb), max(fa, fb)
        if hi - lo < 3:
            continue
        mx = max(v)
        if mx <= hi:
            continue
        key = (lo + hi) // 2
        if lo < key < hi and mx not in (key, fa, fb) and mx + 1 not in (key, fa, fb) and lo + 0 != key:
            break
    ds = [("This value is attained on the graph, but it is larger than both f(0) and f(8), so the Intermediate Value Theorem on [0, 8] does not guarantee it from the endpoint values.", mx), ("Equals an endpoint value f(0), which is not strictly between f(0) and f(8).", fa),
          ("This value is larger than every value of f on [0, 8], so no c exists.", mx + 1)]
    pool = opts(ds, key, lambda n: "$%d$" % n)
    stem = "The function $f$ is continuous on $[0,8]$ and its graph, consisting of line segments, is shown. For which of the following values of $k$ does the Intermediate Value Theorem, applied to $f$ on $[0,8]$ using only $f(0)$ and $f(8)$, guarantee a number $c$ in $(0,8)$ with $f(c)=k$?"
    k = Opt("$%d$" % key, True, "k lies strictly between f(0) = %d and f(8) = %d, and f is continuous on [0, 8], so the Intermediate Value Theorem guarantees c." % (fa, fb), key)
    bpr = bp("g_ivt_graph", "1.16", "3.D", "not_allowed", "Apply the Intermediate Value Theorem using the endpoint values read from a graph",
             ["Read f(0) and f(8) from the graph", "Check continuity on the closed interval", "Choose the value strictly between the endpoint values"],
             [("f is continuous on [0, 8] so every value strictly between f(0) and f(8) is attained", "the graph is an unbroken polygon")],
             [("value_outside_but_attained", "uses a value the graph reaches but not between the endpoints"), ("endpoint_value", "uses an endpoint value"), ("value_above_range", "uses a value above the graph")],
             "numerical scan of the interpolated graph for a sign change of f - k (independent of comparing k with the endpoint values)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    grid = [i / 100 for i in range(0, 801)]
    if not any((f.num(grid[i]) - key) * (f.num(grid[i + 1]) - key) <= 0 for i in range(800)) or not (min(fa, fb) < key < max(fa, fb)):
        raise ValueError("independent_check_failed")
    return gpack("g_ivt_graph", "1.16", "3.D", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 90, [f"v={v}", f"key={key}"])


# 8) 4.6 접선 근사: 선분 구간의 접선으로 한 칸 너머를 근사
def g_tangent_line_value_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, 0, 8)
        f = PL(XS5, v)
        a = rng.choice([1, 3])
        i = (a - 1) // 2
        b = a + 3
        if (v[i] + v[i + 1]) % 2:
            continue
        m = f.slope_seg(i)
        L = f.at(a) + m * (b - a)
        tb = f.at(b) if b % 2 == 0 else f.at(b)
        if m != 0 and L != tb and len({L, tb, f.at(a), m * b, f.at(a) + m}) == 5:
            break
    num = f.num(a) + float(m) * (b - a)
    if abs(num - float(L)) > 1e-9:
        raise ValueError("independent_check_failed")
    ds = [("Reads f(%d) directly from the graph instead of using the tangent line at x = %d." % (b, a), tb), ("Reports f(%d), the value at the point of tangency, and does not move along the tangent line." % a, f.at(a)),
          ("Moves only one unit along the tangent line instead of %d." % (b - a), f.at(a) + m), ("Multiplies the slope by x = %d instead of by the change in x." % b, m * b)]
    pool = opts(ds, L, fx)
    stem = f"The graph of the function $f$ is shown and consists of line segments. The tangent line to the graph of $f$ at $x={a}$ is used to approximate $f({b})$. What is the value of this approximation?"
    k = Opt(fx(L), True, "The tangent line at x = %d is y = f(%d) + f'(%d)(x - %d) with f(%d) and the slope read from the graph; evaluate it at x = %d." % (a, a, a, a, a, b), L)
    bpr = bp("g_tangent_line_value_graph", "4.6", "1.E", "not_allowed", "Evaluate the tangent line at a point of a graph at a different x-value",
             ["Read f(a) and the slope at a from the segment containing x = a", "Write the tangent line and evaluate it at the new x-value", "Do not confuse the line value with the graph value there"],
             [("the tangent line at an interior point of a segment is the line containing that segment", "a is odd, inside a segment of the graph")],
             [("reads_graph_directly", "uses the graph value f(b)"), ("point_of_tangency", "uses the value f(a)"), ("one_step", "moves one unit"), ("slope_times_x", "multiplies slope by x")],
             "the tangent line value recomputed from numerically interpolated f(a) and a difference quotient at a (independent of the vertex list)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_tangent_line_value_graph", "4.6", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 85, [f"v={v}", f"a={a}", f"b={b}", f"L={L}"])
