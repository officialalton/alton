"""AB 그래프 필수 MC 신규 원형 A군(2026-10-09, 단계 S1): 계산기 불가. 각 원형은 서로 다른 단원.토픽·질문·풀이 단계를 가진다(숫자만 다른 변형을 만들지 않는다).
자료는 구간선형 그래프(정수 꼭짓점)이고, 정답·오답은 정확한 유리수로 계산한 뒤 별도 수치 경로(구간 적분·중심차분)로 다시 확인한다."""
from gcommon import *
from scipy import optimize as _O, integrate as _I

XS5 = [0, 2, 4, 6, 8]


def _yr(*vals):
    allv = [v for vs in vals for v in vs]
    return (min(0, min(allv)) - 1, max(0, max(allv)) + 1)


def _ax(vals_list, xlab="x", xr=(0, 8), ylab="y"):
    lo, hi = _yr(*vals_list)
    return axis(xlab, xr[0], xr[1], 1), axis(ylab, lo, hi, 1)


# 1) 2.1 평균변화율: 그래프에서 구간 [a,b]
def g_avg_roc_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -3, 6)
        a, b = rng.choice([(0, 4), (2, 6), (2, 8), (0, 6), (4, 8), (0, 8)])
        f = PL(XS5, v)
        key = (f.at(b) - f.at(a)) / (b - a)
        last = f.slope(b, -1)
        if len(set(v)) >= 4 and key != last and key != 0 and key.denominator <= 4:
            break
    # 독립 경로: 구간 위에서 기울기 함수를 수치 적분해 길이로 나눈다
    sl = lambda u: next(float(f.slope_seg(i)) for i in range(f.n) if float(f.xs[i]) <= u <= float(f.xs[i + 1]))
    if abs(f.quad(a, b, sl) / (b - a) - float(key)) > 1e-6:
        raise ValueError("independent_check_failed")
    nseg = (b - a) // 2
    ds = [("Uses the slope of the segment that ends at x = %d instead of the change over the whole interval." % b, last),
          ("Reports the change f(b) - f(a) without dividing by the length of the interval.", f.at(b) - f.at(a)),
          ("Averages the two endpoint values f(a) and f(b) instead of the change in f.", (f.at(a) + f.at(b)) / 2),
          ("Divides the change by the number of line segments in the interval instead of its length.", (f.at(b) - f.at(a)) / nseg)]
    pool = opts(ds, key, fx)
    stem = f"The graph of the function $f$, which consists of line segments, is shown. What is the average rate of change of $f$ on the interval $[{a},{b}]$?"
    k = Opt(fx(key), True, "Average rate of change = (f(b) - f(a)) / (b - a), with both values read from the graph.", key)
    bpr = bp("g_avg_roc_graph", "2.1", "2.B", "not_allowed", "Compute an average rate of change over an interval from the graph of a piecewise linear function",
             ["Read f(a) and f(b) from the graph", "Form the difference quotient over the interval"], [("average rate of change is the change in f divided by the change in x", "definition, stated by the question")],
             [("last_segment_slope", "uses only the final segment slope"), ("no_division", "reports change without dividing"), ("mean_of_values", "averages endpoint values")],
             "quadrature of the piecewise slope function over [a, b] divided by b - a (independent of f(b) - f(a))", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_avg_roc_graph", "2.1", "2.B", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", PL(XS5, v).vert())], *_ax([v])), bpr, 70, [f"v={v}", f"key={key}"])


def _two_graphs(rng, odd_even_sum=True, vlo=-4, vhi=6):
    """f, g: 5 꼭짓점. 홀수 a(구간 내부)에서 값이 정수가 되도록 인접 합이 짝수."""
    for _ in forever():
        vf = rand_vals(rng, 5, vlo, vhi)
        vg = rand_vals(rng, 5, vlo, vhi)
        if odd_even_sum and any((vf[i] + vf[i + 1]) % 2 or (vg[i] + vg[i + 1]) % 2 for i in range(4)):
            continue
        return vf, vg


# 2) 2.8 곱의 법칙: 두 그래프
def g_product_two_graphs(rng):
    for _ in forever():
        vf, vg = _two_graphs(rng)
        a = rng.choice([1, 3, 5, 7])
        f, g = PL(XS5, vf), PL(XS5, vg)
        i = (a - 1) // 2
        fa, ga, fp, gp = f.at(a), g.at(a), f.slope_seg(i), g.slope_seg(i)
        key = fp * ga + fa * gp
        if all(z != 0 for z in (fa, ga, fp, gp)) and len({key, fp * gp, fp * ga, fa * gp, fa * ga}) == 5:
            break
    hh = 1e-6
    prod = lambda u: f.num(u) * g.num(u)
    if abs((prod(a + hh) - prod(a - hh)) / (2 * hh) - float(key)) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Multiplies the two derivatives, f'(a) g'(a), instead of using the product rule.", fp * gp), ("Keeps only the first product rule term f'(a) g(a).", fp * ga),
          ("Keeps only the second product rule term f(a) g'(a).", fa * gp), ("Evaluates the product f(a) g(a) and never differentiates.", fa * ga)]
    pool = opts(ds, key, fx)
    stem = f"The graphs of the functions $f$ and $g$ are shown; each consists of line segments. Let $h(x)=f(x)\\,g(x)$. What is $h'({a})$?"
    k = Opt(fx(key), True, "h'(a) = f'(a) g(a) + f(a) g'(a), using the values and slopes read from the segments containing x = %d." % a, key)
    bpr = bp("g_product_two_graphs", "2.8", "1.E", "not_allowed", "Apply the product rule at a point using values and slopes read from two graphs",
             ["Read f(a), g(a) and the slopes of the segments containing x = a", "Apply the product rule h' = f' g + f g'", "Evaluate with the values read from the graphs"],
             [("f and g are differentiable at x = a because a lies inside a segment of each graph", "x = a is not a vertex of either graph")],
             [("product_of_derivatives", "multiplies f' and g'"), ("missing_term", "drops one product rule term"), ("no_derivative", "evaluates the product only")],
             "central difference (step 1e-6) of the product of the numerically interpolated graphs (independent of the product rule)", {"type": "graph", "must_include": ["vertices of f", "vertices of g"]})
    return gpack("g_product_two_graphs", "2.8", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graphs of f and g, each consisting of line segments connecting the plotted vertices.", [("f", f.vert()), ("g", g.vert())], *_ax([vf, vg])), bpr, 95, [f"vf={vf}", f"vg={vg}", f"a={a}", f"key={key}"])


# 3) 2.9 몫의 법칙: 두 그래프
def g_quotient_two_graphs(rng):
    for _ in forever():
        vf, vg = _two_graphs(rng)
        a = rng.choice([1, 3, 5, 7])
        f, g = PL(XS5, vf), PL(XS5, vg)
        i = (a - 1) // 2
        fa, ga, fp, gp = f.at(a), g.at(a), f.slope_seg(i), g.slope_seg(i)
        if ga == 0 or fp == 0 or gp == 0 or fa == 0:
            continue
        key = (fp * ga - fa * gp) / ga ** 2
        if len({key, fp / gp, (fp * ga + fa * gp) / ga ** 2, (fp * ga - fa * gp) / ga, (fa * gp - fp * ga) / ga ** 2}) == 5:
            break
    hh = 1e-6
    q = lambda u: f.num(u) / g.num(u)
    if abs((q(a + hh) - q(a - hh)) / (2 * hh) - float(key)) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Divides the derivatives, f'(a)/g'(a), instead of using the quotient rule.", fp / gp), ("Adds the two terms of the numerator instead of subtracting them.", (fp * ga + fa * gp) / ga ** 2),
          ("Divides the numerator by g(a) instead of by g(a) squared.", (fp * ga - fa * gp) / ga), ("Reverses the order of the numerator: f g' - f' g.", (fa * gp - fp * ga) / ga ** 2)]
    pool = opts(ds, key, fx)
    stem = f"The functions $f$ and $g$ have the graphs shown, each made of line segments. If $q(x)=\\dfrac{{f(x)}}{{g(x)}}$, find $q'({a})$."
    k = Opt(fx(key), True, "q'(a) = (f'(a) g(a) - f(a) g'(a)) / g(a)^2 with values and slopes read from the graphs.", key)
    bpr = bp("g_quotient_two_graphs", "2.9", "1.E", "not_allowed", "Apply the quotient rule at a point using values and slopes read from two graphs",
             ["Read f(a), g(a) and the two slopes from the segments containing x = a", "Apply the quotient rule with the numerator in the correct order", "Simplify the resulting fraction"],
             [("g(a) is not zero and both graphs are linear near x = a", "g(a) read from the graph is nonzero; a is interior to a segment of each graph")],
             [("quotient_of_derivatives", "divides f' by g'"), ("sign_error", "adds the numerator terms"), ("denominator_not_squared", "divides by g instead of g squared")],
             "central difference (step 1e-6) of the numerically interpolated quotient (independent of the quotient rule)", {"type": "graph", "must_include": ["vertices of f", "vertices of g"]})
    return gpack("g_quotient_two_graphs", "2.9", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graphs of f and g, each consisting of line segments connecting the plotted vertices.", [("f", f.vert()), ("g", g.vert())], *_ax([vf, vg])), bpr, 100, [f"vf={vf}", f"vg={vg}", f"a={a}", f"key={key}"])


# 4) 3.1 연쇄법칙: h = f(g(x)) 두 그래프
def g_chain_two_graphs(rng):
    for _ in forever():
        vf = rand_vals(rng, 5, 0, 8)
        vg = rand_vals(rng, 5, 0, 8)
        a = rng.choice([1, 3, 5, 7])
        i = (a - 1) // 2
        if (vg[i] + vg[i + 1]) % 4 != 2:
            continue
        f, g = PL(XS5, vf), PL(XS5, vg)
        ga = g.at(a)
        if ga % 2 != 1:
            continue
        j = int((ga - 1) // 2)
        fpg, gp, fpa = f.slope_seg(j), g.slope_seg(i), f.slope(a)
        key = fpg * gp
        if fpg != 0 and gp != 0 and len({key, fpa * gp, fpg, gp, fpg + gp, f.at(ga) * gp}) >= 5:
            break
    hh = 1e-6
    hn = lambda u: f.num(g.num(u))
    if abs((hn(a + hh) - hn(a - hh)) / (2 * hh) - float(key)) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Evaluates f' at x = %d instead of at g(%d), the inner function value." % (a, a), fpa * gp), ("Reports f'(g(a)) and omits the inner derivative factor g'(a).", fpg),
          ("Adds f'(g(a)) and g'(a) instead of multiplying them.", fpg + gp), ("Uses f(g(a)) in place of the derivative f'(g(a)).", f.at(ga) * gp)]
    pool = opts(ds, key, fx)
    stem = f"The graphs of $f$ and $g$ are shown, and each consists of line segments. Let $h(x)=f(g(x))$. What is the value of $h'({a})$?"
    k = Opt(fx(key), True, "h'(a) = f'(g(a)) g'(a): g(a) is read from the graph of g, then the slope of f at that input is multiplied by the slope of g.", key)
    bpr = bp("g_chain_two_graphs", "3.1", "1.E", "not_allowed", "Apply the chain rule to a composition of two functions given by graphs",
             ["Read g(a) and g'(a) from the graph of g", "Find the slope of f at the input g(a) from the graph of f", "Multiply f'(g(a)) by g'(a)"],
             [("g(a) and a are interior to line segments of g and f so both derivatives exist", "g(a) is an odd integer and a is an odd integer, never a vertex")],
             [("outer_at_wrong_point", "evaluates f' at a instead of g(a)"), ("missing_inner", "omits g'(a)"), ("adds_slopes", "adds instead of multiplies")],
             "central difference (step 1e-6) of the numerically composed interpolants (independent of the chain rule)", {"type": "graph", "must_include": ["vertices of f", "vertices of g"]})
    return gpack("g_chain_two_graphs", "3.1", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graphs of f and g, each consisting of line segments connecting the plotted vertices.", [("f", f.vert()), ("g", g.vert())], *_ax([vf, vg])), bpr, 100, [f"vf={vf}", f"vg={vg}", f"a={a}", f"key={key}"])


# 5) 3.3 역함수의 도함수: 그래프
def g_inverse_deriv_graph(rng):
    for _ in forever():
        v = sorted(rng.sample(range(0, 13), 5))
        a = rng.choice([1, 3, 5, 7])
        i = (a - 1) // 2
        if (v[i] + v[i + 1]) % 4 != 2:
            continue
        f = PL(XS5, v)
        b = int(f.at(a))
        slope = f.slope_seg(i)
        key = 1 / slope
        if len({key, slope, Fr(a), -1 / slope, Fr(1, b)}) == 5:
            break
    hh = 1e-6
    inv = lambda y: _O.brentq(lambda u: f.num(u) - y, 0.0, 8.0, xtol=1e-13)  # 독립 경로: 역함수를 수치로 풀어 중심차분
    if abs((inv(b + hh) - inv(b - hh)) / (2 * hh) - float(key)) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Reports f'(a) itself instead of its reciprocal.", slope), ("Takes the reciprocal of the function value, 1/f(%d) = 1/%d, instead of the reciprocal of the slope." % (a, b), Fr(1, b)),
          ("Reports the value of the inverse, g(b) = %d, which is not a derivative." % a, Fr(a)), ("Takes the negative reciprocal -1/f'(a).", -1 / slope)]
    pool = opts(ds, key, fx)
    stem = f"The graph of the one-to-one function $f$, which consists of line segments, is shown. Let $g$ be the inverse function of $f$. What is $g'({b})$?"
    k = Opt(fx(key), True, "g'(b) = 1 / f'(g(b)). Here f(%d) = %d, so g(%d) = %d and g'(%d) is the reciprocal of the slope of f at x = %d." % (a, b, b, a, b, a), key)
    bpr = bp("g_inverse_deriv_graph", "3.3", "1.E", "not_allowed", "Differentiate an inverse function at a point using the graph of the original function",
             ["Find the x-value a with f(a) = b from the graph", "Read the slope of f at x = a", "Take the reciprocal to get the derivative of the inverse"],
             [("f is increasing, hence one-to-one, and differentiable at a because a is interior to a segment", "vertices are strictly increasing; a is odd")],
             [("not_reciprocal", "reports f'(a)"), ("reciprocal_of_value", "reciprocal of the function value"), ("inverse_value", "reports g(b)")],
             "numerical inverse by Brent's method on the interpolated graph, then a central difference of that inverse (independent of the reciprocal rule)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_inverse_deriv_graph", "3.3", "1.E", "not_allowed", stem, k, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 85, [f"v={v}", f"a={a}", f"b={b}", f"key={key}"])


# 6) 4.7 로피탈: 두 그래프가 같은 점에서 0
def g_lhopital_graph(rng):
    for _ in forever():
        a = rng.choice([1, 3, 5, 7])
        i = (a - 1) // 2
        vf = rand_vals(rng, 5, -4, 5)
        vg = rand_vals(rng, 5, -4, 5)
        pf, pg = rng.choice([1, 2, 3, 4]), rng.choice([1, 2, 3, 4])
        vf[i], vf[i + 1] = -rng.choice([1, 2, 3]) * 1, 0
        vf[i], vf[i + 1] = -pf, pf
        vg[i], vg[i + 1] = -pg, pg
        f, g = PL(XS5, vf), PL(XS5, vg)
        sf, sg = f.slope_seg(i), g.slope_seg(i)
        key = sf / sg
        if sf != sg and key not in (0, 1) and len({key, 1 / key, sf * sg, sf + sg, sf - sg, Fr(0)}) >= 5:
            break
    fn = lambda u: f.num(u) / g.num(u)
    if abs(fn(a + 1e-7) - float(key)) > 1e-5 or abs(fn(a - 1e-7) - float(key)) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Takes the ratio of slopes upside down, g'(a)/f'(a).", 1 / key), ("Substitutes x = %d and concludes the quotient 0/0 equals 0." % a, Fr(0)), ("Multiplies the two slopes instead of dividing them.", sf * sg), ("Subtracts the slopes instead of forming their ratio.", sf - sg)]
    pool = opts(ds, key, fx)
    stem = f"The graphs of the differentiable functions $f$ and $g$ are shown, each consisting of line segments, and both graphs pass through $({a},0)$. What is $\\displaystyle\\lim_{{x\\to {a}}}\\frac{{f(x)}}{{g(x)}}$?"
    k = Opt(fx(key), True, "The quotient has the form 0/0 at x = a, so the limit equals f'(a)/g'(a), the ratio of the slopes read from the graphs (L'Hopital's Rule).", key)
    bpr = bp("g_lhopital_graph", "4.7", "1.D", "not_allowed", "Evaluate a 0/0 limit by comparing the slopes of two graphs at their common zero",
             ["Check that f(a) = g(a) = 0 so the limit is indeterminate 0/0", "Choose L'Hopital's Rule and read the two slopes at x = a", "Form the ratio f'(a)/g'(a)"],
             [("f and g are differentiable at a with g'(a) not zero, so L'Hopital's Rule applies", "both graphs are lines near x = a and the slope of g is nonzero")],
             [("inverted_ratio", "inverts the slope ratio"), ("zero_over_zero", "treats 0/0 as 0"), ("product_of_slopes", "multiplies the slopes")],
             "evaluating the interpolated quotient f/g at x = a +/- 1e-7 (independent of the slope ratio)", {"type": "graph", "must_include": ["vertices of f", "vertices of g", "both graphs pass through (a, 0)"]})
    return gpack("g_lhopital_graph", "4.7", "1.D", "not_allowed", stem, k, pool, rng, gstim("Graphs of f and g, each consisting of line segments connecting the plotted vertices.", [("f", f.vert()), ("g", g.vert())], *_ax([vf, vg])), bpr, 90, [f"vf={vf}", f"vg={vg}", f"a={a}", f"key={key}"])


# 7) 4.2 직선 운동: 속도 그래프 → 속력이 증가하는 구간
def g_speed_increasing(rng):
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
        inc = [i for i, (sg, d) in enumerate(typ) if (sg == "pos" and d == "up") or (sg == "neg" and d == "down")]
        if len(inc) == 1:
            break
    why = {("pos", "down"): "the velocity is positive but decreasing, so the speed is decreasing.", ("neg", "up"): "the velocity is negative and increasing toward zero, so the speed is decreasing.",
           ("pos", "flat"): "the velocity is constant and positive, so the speed is constant.", ("neg", "flat"): "the velocity is constant and negative, so the speed is constant."}
    kidx = inc[0]
    key = Opt("$(%d,%d)$" % (2 * kidx, 2 * kidx + 2), True, "Speed increases when velocity and acceleration have the same sign: on this interval v and the slope of v are both %s." % ("positive" if typ[kidx][0] == "pos" else "negative"), kidx)
    ds = [Opt("$(%d,%d)$" % (2 * i, 2 * i + 2), False, "On (%d, %d) %s" % (2 * i, 2 * i + 2, why[typ[i]]), i) for i in range(4) if i != kidx]
    f = PL(XS5, v)
    # 독립 경로: 조각 중간점에서 |v| 의 중심차분 부호
    for i in range(4):
        m = 2 * i + 1.0
        dsp = abs(f.num(m + 0.01)) - abs(f.num(m - 0.01))
        if (i == kidx) != (dsp > 1e-9):
            raise ValueError("independent_check_failed")
    stem = "A particle moves along a straight line with velocity $v(t)$ meters per second for $0\\le t\\le 8$. The graph of $v$ is shown and consists of line segments. On which of the following time intervals is the speed of the particle increasing?"
    bpr = bp("g_speed_increasing", "4.2", "2.D", "not_allowed", "Decide when speed increases from the graph of velocity",
             ["Read the sign of v and the slope of v on each segment", "Speed increases exactly when velocity and acceleration have the same sign", "Select the interval where this holds"],
             [("acceleration is the slope of the velocity graph and is constant on each segment", "the graph consists of line segments")],
             [("positive_decreasing", "positive velocity with negative slope"), ("negative_increasing", "negative velocity with positive slope"), ("constant_velocity", "constant velocity segment")],
             "numerical |v| at t = midpoint +/- 0.01 on every segment (independent of the sign table)", {"type": "graph", "must_include": ["vertices of v at t = 0, 2, 4, 6, 8"]})
    return gpack("g_speed_increasing", "4.2", "2.D", "not_allowed", stem, key, ds, rng, gstim("Graph of v(t), consisting of line segments connecting the plotted vertices.", [("v", f.vert())], *_ax([v], "t", (0, 8), "v(t)")), bpr, 85, [f"v={v}", f"inc={kidx}"])


# 8) 4.6 접선 근사: f' 그래프, 과소/과대 판정
def g_tangent_approx_fprime_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -3, 5)
        a = rng.choice([1, 3, 5])
        i = (a - 1) // 2
        k0 = rng.randint(2, 9)
        fp = PL(XS5, v)
        if (v[i] + v[i + 1]) % 2 or fp.slope_seg(i) == 0:
            continue
        s_a, s_next = fp.at(a), fp.at(a + 1)
        if s_a == s_next or v[i] + v[i + 1] == 0:
            continue
        L, L2 = k0 + s_a, k0 + s_next
        up = fp.slope_seg(i) > 0           # f' 증가 → f 아래로 볼록 → 접선은 과소추정
        if len({L, L2}) == 2:
            break
    d_key = "an underestimate" if up else "an overestimate"
    d_opp = "an overestimate" if up else "an underestimate"
    # 독립 경로: f(a+1)=f(a)+∫f' 의 수치 적분과 접선 근사의 오차 부호
    true_val = k0 + fp.quad(a, a + 1)
    if (true_val > float(L)) != up:
        raise ValueError("independent_check_failed")
    key = Opt("%s, %s" % (fx(L), d_key), True, "The tangent line at x = %d uses slope f'(%d) = %s, giving f(%d) + f'(%d); f' is %s there, so f is concave %s and the tangent line lies %s the graph." % (a, a, s_a, a, a, "increasing" if up else "decreasing", "up" if up else "down", "below" if up else "above"), None)
    ds = [Opt("%s, %s" % (fx(L), d_opp), False, "Computes the correct tangent value but reverses the concavity argument: f' is %s, so f is concave %s." % ("increasing" if up else "decreasing", "up" if up else "down"), None),
          Opt("%s, %s" % (fx(L2), d_key), False, "Uses the slope at the right endpoint x = %d instead of the slope at x = %d." % (a + 1, a), None),
          Opt("%s, %s" % (fx(L2), d_opp), False, "Uses the slope at the right endpoint x = %d and also reverses the concavity argument." % (a + 1), None)]
    stem = f"The function $f$ is differentiable and $f({a})={k0}$. The graph of $f'$, consisting of line segments, is shown. The tangent line to the graph of $f$ at $x={a}$ is used to approximate $f({a+1})$. Which of the following gives the approximation and describes how it compares with $f({a+1})$?"
    bpr = bp("g_tangent_approx_fprime_graph", "4.6", "1.F", "not_allowed", "Use the tangent line at a point to approximate a value and decide over/under estimate from the graph of f'",
             ["Read f'(a) from the graph and form the tangent line approximation f(a) + f'(a)(x - a)", "Decide concavity of f from whether f' is increasing or decreasing near x = a", "State whether the tangent line value is below or above the true value"],
             [("f' is linear on (a - 1, a + 1) with nonzero slope, so f is strictly concave up or down there", "a is interior to a segment of the f' graph whose slope is nonzero")],
             [("wrong_concavity_claim", "reverses over/under"), ("slope_at_right_end", "uses the slope at x = a + 1"), ("both_slips", "wrong slope and wrong claim")],
             "numerical integral of f' over [a, a+1] gives the true f(a+1); the sign of true - tangent value is compared with the claim", {"type": "graph", "must_include": ["vertices of f' at x = 0, 2, 4, 6, 8"]})
    return gpack("g_tangent_approx_fprime_graph", "4.6", "1.F", "not_allowed", stem, key, ds, rng, gstim("Graph of f', consisting of line segments connecting the plotted vertices.", [("f'", fp.vert())], *_ax([v], "x", (0, 8), "f'(x)")), bpr, 100, [f"v={v}", f"a={a}", f"k={k0}", f"L={L}"])


# 9) 5.9 f' 그래프 → f 가 증가이면서 위로 오목(아래로 오목)인 구간
def g_fprime_inc_concave(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -4, 4)
        if any(v[i] * v[i + 1] < 0 for i in range(4)):
            continue
        typ = []
        for i in range(4):
            s = v[i] + v[i + 1]
            d = v[i + 1] - v[i]
            if s == 0 or d == 0:
                typ = None
                break
            typ.append(("pos" if s > 0 else "neg", "up" if d > 0 else "down"))
        if not typ:
            continue
        hit = [i for i, t in enumerate(typ) if t == ("pos", "down")]
        if len(hit) == 1:
            break
    why = {("pos", "up"): "f' is positive and increasing, so f is increasing but concave up, not concave down.", ("neg", "up"): "f' is negative, so f is decreasing there; f' increasing makes f concave up.",
           ("neg", "down"): "f' is negative and decreasing, so f is decreasing and concave down; it is not increasing."}
    kidx = hit[0]
    key = Opt("$(%d,%d)$" % (2 * kidx, 2 * kidx + 2), True, "f' is positive (f increasing) and f' is decreasing (f concave down) on this interval.", kidx)
    ds = [Opt("$(%d,%d)$" % (2 * i, 2 * i + 2), False, "On (%d, %d) %s" % (2 * i, 2 * i + 2, why[typ[i]]), i) for i in range(4) if i != kidx]
    fp = PL(XS5, v)
    for i in range(4):  # 독립 경로: 조각 중점에서 f' 값과 기울기를 수치로
        m = 2 * i + 1.0
        ok = fp.num(m) > 1e-9 and (fp.num(m + 0.1) - fp.num(m - 0.1)) < -1e-9
        if ok != (i == kidx):
            raise ValueError("independent_check_failed")
    stem = "The graph of $f'$, the derivative of a function $f$, is shown and consists of line segments. On which of the following intervals is $f$ increasing and concave down?"
    bpr = bp("g_fprime_inc_concave", "5.9", "2.E", "not_allowed", "Connect the sign and the slope of the graph of f' to monotonicity and concavity of f",
             ["f is increasing where f' is positive", "f is concave down where f' is decreasing", "Find the interval satisfying both conditions"],
             [("f' is linear on each interval so its sign and its direction do not change inside an interval", "the graph consists of line segments and no segment crosses the axis")],
             [("increasing_concave_up", "f' positive but increasing"), ("decreasing_concave_up", "f' negative and increasing"), ("decreasing_concave_down", "f' negative and decreasing")],
             "numerical value and finite-difference slope of f' at each segment midpoint (independent of the sign table)", {"type": "graph", "must_include": ["vertices of f' at x = 0, 2, 4, 6, 8"]})
    return gpack("g_fprime_inc_concave", "5.9", "2.E", "not_allowed", stem, key, ds, rng, gstim("Graph of f', consisting of line segments connecting the plotted vertices.", [("f'", fp.vert())], *_ax([v], "x", (0, 8), "f'(x)")), bpr, 80, [f"v={v}", f"hit={kidx}"])


# 10) 5.6 f' 그래프 → 변곡점 개수
def g_fprime_inflection(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -4, 4)
        sl = [v[i + 1] - v[i] for i in range(4)]
        if any(s == 0 for s in sl):
            continue
        infl = sum(1 for i in range(3) if sl[i] * sl[i + 1] < 0)
        zeros = sum(1 for i in range(1, 4) if v[i] == 0) + sum(1 for i in range(4) if v[i] * v[i + 1] < 0)
        ext = sum(1 for i in range(1, 4) if (v[i - 1] * v[i] < 0 or v[i] == 0 and v[i - 1] * v[i + 1] < 0))
        ext = 0
        for i in range(4):
            if v[i] * v[i + 1] < 0:
                ext += 1
        for i in range(1, 4):
            if v[i] == 0 and v[i - 1] * v[i + 1] < 0:
                ext += 1
        cand = {"zeros": zeros, "ext": ext, "corners": 3}
        if infl in (1, 2) and len({infl, zeros, ext, 3} - {infl}) >= 2 and zeros != infl and ext != infl:
            break
    fp = PL(XS5, v)
    # 독립 경로: 촘촘한 표본에서 f' 의 기울기 부호가 바뀌는 횟수
    pts = [i / 50 for i in range(1, 400)]
    sg = [1 if fp.num(u + 0.01) - fp.num(u - 0.01) > 1e-9 else -1 for u in pts]
    chg = sum(1 for i in range(len(sg) - 1) if sg[i] != sg[i + 1])
    if chg != infl:
        raise ValueError("independent_check_failed")
    ds = [("Counts the zeros of f' (places where f may have an extremum) instead of the places where f' changes direction.", zeros), ("Counts the sign changes of f', which give relative extrema of f, not changes in concavity.", ext),
          ("Counts every vertex of the graph of f' in (0, 8) as an inflection point of f.", 3), ("Counts the four line segments of the graph rather than the places where the direction of f' changes.", 4), ("Counts one more or one fewer vertex than the places where f' changes from increasing to decreasing or the reverse.", infl + 1 if infl + 1 <= 3 else infl - 1)]
    pool = opts(ds, infl, lambda n: "$%d$" % n)
    stem = "The graph of $f'$, the derivative of the function $f$, is shown for $0\\le x\\le 8$ and consists of line segments. How many points of inflection does the graph of $f$ have on the interval $0<x<8$?"
    k = Opt("$%d$" % infl, True, "f has an inflection point where f' changes from increasing to decreasing or from decreasing to increasing, which are the vertices where the slope of the graph of f' changes sign.", infl)
    bpr = bp("g_fprime_inflection", "5.6", "2.E", "not_allowed", "Locate points of inflection of f from the direction changes of the graph of f'",
             ["Recognize that concavity of f is determined by whether f' increases or decreases", "Find the vertices where the slope of f' changes sign", "Count those vertices on the interval"],
             [("f' is continuous so f is differentiable and a concavity change in f is a sign change of the slope of f'", "the graph is a continuous polygon with nonzero slopes on every segment")],
             [("zeros_of_fprime", "counts zeros of f'"), ("extrema_of_f", "counts sign changes of f'"), ("all_vertices", "counts every vertex")],
             "dense sampling of the finite-difference slope of f' and counting its sign changes (independent of comparing segment slopes)", {"type": "graph", "must_include": ["vertices of f' at x = 0, 2, 4, 6, 8"]})
    return gpack("g_fprime_inflection", "5.6", "2.E", "not_allowed", stem, k, pool, rng, gstim("Graph of f', consisting of line segments connecting the plotted vertices.", [("f'", fp.vert())], *_ax([v], "x", (0, 8), "f'(x)")), bpr, 85, [f"v={v}", f"infl={infl}"])


# 11) 5.5 후보 검사: f' 그래프와 f(0) → 절대 최댓값
def g_abs_max_fprime(rng):
    for _ in forever():
        a, b, c = rng.randint(1, 4), rng.randint(1, 3), rng.randint(1, 6)
        v = [a, 0, -b, 0, c]
        k0 = rng.randint(0, 6)
        fp = PL(XS5, v)
        f0, f2, f6 = Fr(k0), k0 + fp.area(0, 2), k0 + fp.area(0, 6)
        f8 = k0 + fp.area(0, 8)
        cands = {"f0": f0, "f2": f2, "f6": f6, "f8": f8}
        key = max(cands.values())
        if key == f8 and f8 > f2 and f8 > f0:
            break
    num = lambda u: k0 + fp.quad(0, u) if u > 0 else k0
    grid = max(num(i / 4) for i in range(0, 33))  # 독립 경로: 촘촘한 격자에서 f 의 수치 최댓값
    if abs(grid - float(key)) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Reports f(2), the value at the relative maximum, without comparing it with the endpoint value f(8).", f2), ("Reports the x-coordinate of the relative maximum, 2, instead of a value of f.", Fr(2)),
          ("Reports f(6), the value at the relative minimum.", f6), ("Reports the left endpoint value f(0) given in the problem without checking the other candidates.", f0)]
    pool = opts(ds, key, fx)
    stem = f"The function $f$ is continuous on $[0,8]$ and $f(0)={k0}$. The graph of $f'$ is shown and consists of line segments. What is the absolute maximum value of $f$ on $[0,8]$?"
    k = Opt(fx(key), True, "The candidates are the endpoints and the critical points; f is evaluated at each using f(0) plus the signed area under f', and the largest value is chosen.", key)
    bpr = bp("g_abs_max_fprime", "5.5", "1.D", "not_allowed", "Find an absolute maximum from the graph of f' using the candidates test and net area",
             ["Find the critical points from the zeros of f' and classify them by sign change", "Compute f at each candidate and endpoint using f(0) plus the signed area under f'", "Compare the candidate values"],
             [("f is continuous on a closed interval so an absolute maximum exists and occurs at an endpoint or a critical point", "Extreme Value Theorem applies on [0, 8]")],
             [("local_max_only", "stops at the relative maximum"), ("location_not_value", "reports x instead of f(x)"), ("wrong_candidate", "uses a different candidate value")],
             "numerical integration of f' to every grid point and maximum of f over a 0.25 grid (independent of the candidate comparison)", {"type": "graph", "must_include": ["vertices of f' at x = 0, 2, 4, 6, 8"]})
    return gpack("g_abs_max_fprime", "5.5", "1.D", "not_allowed", stem, k, pool, rng, gstim("Graph of f', consisting of line segments connecting the plotted vertices.", [("f'", fp.vert())], *_ax([v], "x", (0, 8), "f'(x)")), bpr, 110, [f"v={v}", f"k={k0}", f"cands={cands}"])
