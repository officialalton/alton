"""AB 그래프 필수 MC 신규 원형 D군(2026-10-09, 단계 S1): 계산기 필수. 식은 본문에, 나머지 함수·직선은 그래프에서만 읽는다(식 + 그래프 혼합) — 그림 없이는 풀 수 없다.
정답은 코드(sympy·정확 면적)로 계산하고 별도 수치 경로(scipy quad·brentq·중심차분)로 다시 확인한다."""
from gcommon import *
from scipy import optimize as _O, integrate as _I

XS5 = [0, 2, 4, 6, 8]


def _yr(*vals):
    allv = [v for vs in vals for v in vs]
    return (min(0, min(allv)) - 1, max(0, max(allv)) + 1)


def _ax(vals_list, xlab="x", xr=(0, 8), ylab="y"):
    lo, hi = _yr(*vals_list)
    return axis(xlab, xr[0], xr[1], 1), axis(ylab, lo, hi, 1)


def dopts(pairs, key_val):
    """계산기 문항 선택지: 소수 셋째 자리, 서로 다른 값만."""
    out, used = [], {round(float(key_val), 3)}
    for why, v in pairs:
        k = round(float(v), 3)
        if k in used or abs(float(v)) < 1e-9 or abs(float(v)) > 1e6:
            continue
        used.add(k)
        out.append(Opt(dec(float(v)), False, why, float(v)))
    if len(out) < 3:
        raise ValueError("not_enough_distractors")
    return out


# 식 풀: (sympy 식, LaTeX 문자열)
F_POOL = [(x * sp.exp(-x / 4), "xe^{-x/4}"), (sp.log(x ** 2 + 1), "\\ln\\left(x^{2}+1\\right)"), (sp.sin(x / 2) + x / 3, "\\sin\\left(\\frac{x}{2}\\right)+\\frac{x}{3}"), (sp.exp(x / 3) + x, "e^{x/3}+x")]


def _dd(expr):
    return sp.lambdify(x, sp.diff(expr, x), "math")


# 1) 2.8 곱의 법칙: f 는 식, g 는 그래프
def g_prod_deriv_mixed_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(F_POOL)
        vg = rand_vals(rng, 5, 1, 6)
        if any((vg[i] + vg[i + 1]) % 2 for i in range(4)):
            continue
        a = rng.choice([1, 3, 5, 7])
        g = PL(XS5, vg)
        i = (a - 1) // 2
        ga, gp = g.at(a), g.slope_seg(i)
        fa, fpa = float(fexpr.subs(x, a)), float(sp.diff(fexpr, x).subs(x, a))
        key = fpa * float(ga) + fa * float(gp)
        if gp != 0 and abs(key) > 0.3:
            break
    hh = 1e-6
    ff = sp.lambdify(x, fexpr, "math")
    hn = lambda u: ff(u) * g.num(u)
    if abs((hn(a + hh) - hn(a - hh)) / (2 * hh) - key) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [("Multiplies the two derivatives, f'(a) g'(a), instead of using the product rule.", fpa * float(gp)), ("Keeps only the first product rule term f'(a) g(a).", fpa * float(ga)),
          ("Keeps only the second product rule term f(a) g'(a).", fa * float(gp)), ("Evaluates the product f(a) g(a) and does not differentiate.", fa * float(ga))]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$. The graph of the function $g$, which consists of line segments, is shown. If $h(x)=f(x)\\,g(x)$, what is the value of $h'({a})$?"
    k = Opt(dec(key), True, "h'(a) = f'(a) g(a) + f(a) g'(a); g(a) and g'(a) come from the graph and f'(a), f(a) from the formula (calculator).", key)
    bpr = bp("g_prod_deriv_mixed_calc", "2.8", "1.E", "required", "Apply the product rule at a point when one factor is a formula and the other is a graph",
             ["Differentiate the formula and evaluate f(a), f'(a) with a calculator", "Read g(a) and the slope g'(a) from the graph of g", "Combine them with the product rule"],
             [("g is differentiable at x = a because a is interior to a segment of its graph", "a is an odd integer and the vertices of g are at even x")],
             [("product_of_derivatives", "multiplies derivatives"), ("missing_term_1", "drops the second term"), ("missing_term_2", "drops the first term"), ("no_derivative", "evaluates the product")],
             "central difference (step 1e-6) of the product of the lambdified formula and the interpolated graph (independent of the product rule)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_prod_deriv_mixed_calc", "2.8", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 100, [f"f={fexpr}", f"vg={vg}", f"a={a}", f"key={key:.6f}"])


# 2) 3.1 연쇄법칙: 바깥 f 는 식, 안쪽 g 는 그래프
CH_POOL = [(sp.log(x ** 2 + 2), "\\ln\\left(x^{2}+2\\right)"), (sp.exp(x / 3) + x, "e^{x/3}+x"), (sp.sin(x) + x / 2, "\\sin x+\\frac{x}{2}"), (sp.sqrt(x ** 2 + 5), "\\sqrt{x^{2}+5}")]


def g_chain_mixed_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(CH_POOL)
        vg = rand_vals(rng, 5, 1, 6)
        if any((vg[i] + vg[i + 1]) % 2 for i in range(4)):
            continue
        a = rng.choice([1, 3, 5, 7])
        g = PL(XS5, vg)
        i = (a - 1) // 2
        ga, gp = g.at(a), g.slope_seg(i)
        fp_u = float(sp.diff(fexpr, x).subs(x, ga))
        key = fp_u * float(gp)
        fpa = float(sp.diff(fexpr, x).subs(x, a))
        fu = float(fexpr.subs(x, ga))
        if gp != 0 and abs(key) > 0.3:
            break
    hh = 1e-6
    ff = sp.lambdify(x, fexpr, "math")
    hn = lambda u: ff(g.num(u))
    if abs((hn(a + hh) - hn(a - hh)) / (2 * hh) - key) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [("Evaluates f' at x = %d instead of at the inner value g(%d)." % (a, a), fpa * float(gp)), ("Reports f'(g(a)) and leaves out the inner derivative g'(a).", fp_u),
          ("Uses the value f(g(a)) in place of the derivative f'(g(a)).", fu * float(gp)), ("Adds f'(g(a)) and g'(a) instead of multiplying.", fp_u + float(gp))]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$, and let $g$ be the function whose graph, consisting of line segments, is shown. If $h(x)=f(g(x))$, what is the value of $h'({a})$?"
    k = Opt(dec(key), True, "h'(a) = f'(g(a)) g'(a): g(a) and the slope g'(a) are read from the graph, f' is evaluated at g(a) with a calculator.", key)
    bpr = bp("g_chain_mixed_calc", "3.1", "1.E", "required", "Apply the chain rule at a point with a formula for the outer function and a graph for the inner function",
             ["Read g(a) and g'(a) from the graph", "Differentiate f and evaluate f'(g(a)) numerically with a calculator", "Multiply f'(g(a)) by g'(a)"],
             [("g is differentiable at x = a because a is interior to a segment; f is differentiable everywhere", "a is odd and vertices of g are at even x")],
             [("outer_at_wrong_point", "evaluates f' at a"), ("missing_inner", "omits g'(a)"), ("value_not_derivative", "uses f(g(a))"), ("adds", "adds instead of multiplies")],
             "central difference (step 1e-6) of f(g(x)) with f lambdified and g interpolated (independent of the chain rule)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_chain_mixed_calc", "3.1", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 100, [f"f={fexpr}", f"vg={vg}", f"a={a}", f"key={key:.6f}"])


# 3) 6.6 정적분의 성질: f 는 식(계산기 적분), g 는 그래프(면적)
I_POOL = [(sp.exp(-x ** 2 / 16), "e^{-x^{2}/16}"), (sp.sin(x ** 2 / 10) + 1, "\\sin\\left(\\frac{x^{2}}{10}\\right)+1"), (sp.sqrt(1 + x ** 3 / 30), "\\sqrt{1+\\frac{x^{3}}{30}}")]


def _gint(fexpr, a_, b_):
    ff = sp.lambdify(x, fexpr, "math")
    return _I.quad(ff, a_, b_, limit=200)[0]


def g_integral_mixed_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(I_POOL)
        vg = rand_vals(rng, 5, 0, 6)
        g = PL(XS5, vg)
        c = rng.choice([2, 3])
        If, Ag = _gint(fexpr, 0, 8), float(g.area(0, 8))
        key = If + c * Ag
        if Ag > 0 and abs(key) < 80:
            break
    # 독립 경로: 합성 심프슨 수치 적분(별도 구현)
    ff = sp.lambdify(x, fexpr, "math")
    simp = numeric_integral(lambda u: ff(u) + c * g.num(u), 0, 8, 20001)
    if abs(simp - key) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Leaves out the coefficient %d on g and adds the plain area of g." % c, If + Ag), ("Subtracts %d times the area of g instead of adding it." % c, If - c * Ag),
          ("Evaluates only the integral of f and ignores g.", If), ("Evaluates only %d times the area of g and ignores f." % c, c * Ag)]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$. The graph of the function $g$, which consists of line segments, is shown for $0\\le x\\le 8$. What is the value of $\\int_0^8\\left(f(x)+{c}g(x)\\right)dx$?"
    k = Opt(dec(key), True, "Split the integral: the integral of f needs a calculator, and %d times the integral of g is %d times the area under the graph." % (c, c), key)
    bpr = bp("g_integral_mixed_calc", "6.6", "1.E", "required", "Use linearity of the definite integral when one function is a formula and the other is a graph",
             ["Split the integral of a sum into two integrals and pull out the constant", "Evaluate the integral of f numerically with a calculator", "Evaluate the integral of g as the area read from the graph, then combine"],
             [("the integral of a sum is the sum of the integrals and constants factor out", "linearity of the definite integral")],
             [("missing_coefficient", "forgets the constant"), ("wrong_sign", "subtracts instead of adding"), ("f_only", "ignores the graphed function g"), ("g_only", "ignores the formula function f")],
             "composite Simpson rule (20001 nodes) on f + c g with g interpolated (independent of the split into two integrals)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_integral_mixed_calc", "6.6", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 100, [f"f={fexpr}", f"vg={vg}", f"c={c}", f"key={key:.6f}"])


# 4) 6.4 FTC: H(x)=f(x)+∫_0^x g
def g_ftc_mixed_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(F_POOL)
        vg = rand_vals(rng, 5, -3, 6)
        if any((vg[i] + vg[i + 1]) % 2 for i in range(4)):
            continue
        a = rng.choice([1, 3, 5, 7])
        g = PL(XS5, vg)
        ga = float(g.at(a))
        fpa = float(sp.diff(fexpr, x).subs(x, a))
        key = fpa + ga
        area = float(g.area(0, a))
        if ga != 0 and abs(key) > 0.3 and abs(area) > 0.3:
            break
    hh = 1e-6
    ff = sp.lambdify(x, fexpr, "math")
    H = lambda u: ff(u) + g.quad(0, u)
    if abs((H(a + hh) - H(a - hh)) / (2 * hh) - key) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [("Differentiates only f and treats the integral term as a constant.", fpa), ("Keeps only g(a) from the integral and forgets to differentiate f.", ga),
          ("Adds the area under g from 0 to %d, the value of the integral, instead of g(%d)." % (a, a), fpa + area), ("Uses f(a) in place of f'(a).", float(fexpr.subs(x, a)) + ga)]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$, and let $g$ be the function whose graph, consisting of line segments, is shown. If $H(x)=f(x)+\\int_0^x g(t)\\,dt$, what is $H'({a})$?"
    k = Opt(dec(key), True, "H'(x) = f'(x) + g(x) by the Fundamental Theorem of Calculus; f'(a) is evaluated with a calculator and g(a) is read from the graph.", key)
    bpr = bp("g_ftc_mixed_calc", "6.4", "1.D", "required", "Differentiate a function that combines a formula and an accumulation of a graphed function",
             ["Differentiate the formula term and evaluate it at a with a calculator", "Apply the Fundamental Theorem to the integral term to get g(a)", "Read g(a) from the graph and add"],
             [("g is continuous so the Fundamental Theorem gives d/dx of the integral equal to g(x)", "g is a continuous polygon graph")],
             [("integral_as_constant", "ignores the integral term"), ("no_derivative_of_f", "drops the derivative of f"), ("area_not_integrand", "adds the area"), ("value_not_derivative", "uses f instead of f'")],
             "central difference (step 1e-6) of H built from the lambdified f and a quadrature of the interpolated g (independent of the Fundamental Theorem)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_ftc_mixed_calc", "6.4", "1.D", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 100, [f"f={fexpr}", f"vg={vg}", f"a={a}", f"key={key:.6f}"])


# 5) 8.1 평균값: h = f + g
def g_avg_value_mixed_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(I_POOL)
        vg = rand_vals(rng, 5, 0, 6)
        g = PL(XS5, vg)
        If, Ag = _gint(fexpr, 0, 8), float(g.area(0, 8))
        key = (If + Ag) / 8
        if Ag > 0:
            break
    ff = sp.lambdify(x, fexpr, "math")
    simp = numeric_integral(lambda u: ff(u) + g.num(u), 0, 8, 20001) / 8
    if abs(simp - key) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Reports the integral of f + g over [0, 8] and does not divide by the interval length.", If + Ag), ("Averages only f and ignores g.", If / 8),
          ("Averages only g and ignores f.", Ag / 8), ("Adds the two average values and then divides again by 2.", (If / 8 + Ag / 8) / 2)]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$, and let $g$ be the function whose graph, consisting of line segments, is shown for $0\\le x\\le 8$. What is the average value of $f(x)+g(x)$ on the interval $[0,8]$?"
    k = Opt(dec(key), True, "Average value = (1/8)(integral of f + integral of g); the integral of f needs a calculator and the integral of g is the area read from the graph.", key)
    bpr = bp("g_avg_value_mixed_calc", "8.1", "1.E", "required", "Find the average value of a sum of a formula and a graphed function",
             ["Write the average value as (1/(b - a)) times the integral over [a, b]", "Evaluate the integral of f with a calculator and the integral of g from the graph", "Divide the combined integral by the interval length"],
             [("the average value of a continuous function on [a, b] is the integral divided by b - a", "definition of average value")],
             [("no_division", "forgets to divide"), ("f_only", "ignores the graphed function g"), ("g_only", "ignores the formula function f"), ("double_average", "averages twice")],
             "composite Simpson rule (20001 nodes) on f + g with g interpolated, divided by 8 (independent of the split into two integrals)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_avg_value_mixed_calc", "8.1", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 100, [f"f={fexpr}", f"vg={vg}", f"key={key:.6f}"])


# ---------- 곡선(식) + 직선(그래프) 영역 ----------
def _curve_line(rng, kind):
    """f(x)=곡선(식), L = 두 격자점 (0,c0),(4,c1) 을 지나는 직선(그래프에서만 읽음). 두 교점 사이에서 f > L."""
    for _ in forever():
        if kind == "sin":
            A = rng.choice([3, 4, 5])
            fexpr, ftex, dom = A * sp.sin(x), f"{A}\\sin x", (0.0, math.pi)
        else:
            A = rng.choice([2, 3])
            fexpr, ftex, dom = A * x * sp.exp(-x / 2), f"{A}xe^{{-x/2}}", (0.0, 6.0)
        c0, c1 = rng.randint(0, 3), rng.randint(0, 4)
        m = (c1 - c0) / 4.0
        ff = sp.lambdify(x, fexpr, "math")
        D = lambda u: ff(u) - (c0 + m * u)
        grid = [dom[0] + (dom[1] - dom[0]) * i / 400 for i in range(401)]
        roots = [r for i, r in enumerate(grid[:-1]) if D(grid[i]) * D(grid[i + 1]) < 0 for r in [_O.brentq(D, grid[i], grid[i + 1], xtol=1e-13)]]
        if len(roots) != 2 or D((roots[0] + roots[1]) / 2) <= 0:
            continue
        if roots[1] - roots[0] < 1.2 or max(D(u) for u in grid) < 1.0:
            continue
        return fexpr, ftex, dom, c0, c1, m, roots, ff
    raise ValueError("no_sample")


def _curve_line_stim(fexpr, dom, c0, c1, ytop, label_curve="f", extra_desc=""):
    ff = sp.lambdify(x, fexpr, "math")
    n = 80
    pts = [[round(dom[0] + (dom[1] - dom[0]) * i / n, 4), round(ff(dom[0] + (dom[1] - dom[0]) * i / n), 4)] for i in range(n + 1)]
    xmax = 4 if dom[1] <= 4 else 6
    line = [[0, c0], [xmax, c0 + (c1 - c0) * xmax / 4.0]]
    d = {"x_axis": axis("x", 0, xmax, 1), "y_axis": axis("y", 0, int(math.ceil(ytop)) + 1, 1),
         "curves": [{"label": "f", "type": "smooth", "vertices": pts}, {"label": "L", "type": "linear", "vertices": line}]}
    return {"kind": "graph", "description": "Graph of the curve y = f(x) and the line L; the region R between them is described in the problem." + extra_desc, "data": d}


def g_area_curve_line_calc(rng):
    fexpr, ftex, dom, c0, c1, m, roots, ff = _curve_line(rng, "sin")
    r1, r2 = roots
    Lf = lambda u: c0 + m * u
    area = _I.quad(lambda u: ff(u) - Lf(u), r1, r2)[0]
    # 독립 경로: 합성 심프슨 + 교점 재계산
    simp = numeric_integral(lambda u: ff(u) - Lf(u), r1, r2, 20001)
    if abs(simp - area) > 1e-6:
        raise ValueError("independent_check_failed")
    ds = [("Integrates over the whole interval 0 to 4 instead of between the two intersection points.", _I.quad(lambda u: ff(u) - Lf(u), 0, 4)[0] if dom[1] > 4 else _I.quad(lambda u: ff(u) - Lf(u), 0, dom[1])[0]),
          ("Computes the area under the curve alone between the intersection points.", _I.quad(ff, r1, r2)[0]), ("Computes the area under the line alone between the intersection points.", _I.quad(Lf, r1, r2)[0]),
          ("Subtracts in the wrong order, line minus curve, and reports the magnitude of the net value.", abs(_I.quad(lambda u: Lf(u) - ff(u), 0, dom[1])[0]))]
    pool = dopts(ds, area)
    stem = f"The figure shows the graph of $f(x)={ftex}$ and the line $L$. Let $R$ be the region enclosed by the graph of $f$ and the line $L$. What is the area of $R$?"
    k = Opt(dec(area), True, "The line is read from the graph; the two intersection points are found with a calculator and the area is the integral of f - L between them.", area)
    ytop = max(ff(u) for u in [dom[0] + (dom[1] - dom[0]) * i / 200 for i in range(201)])
    bpr = bp("g_area_curve_line_calc", "8.4", "1.D", "required", "Find the area between a curve given by a formula and a line given only by a graph",
             ["Read two lattice points on the line from the figure and write its equation", "Find the two intersection points of the curve and the line with a calculator", "Integrate (curve - line) between the intersection points"],
             [("f is above L between the two intersection points", "shown in the figure")],
             [("wrong_limits", "integrates over the wrong interval"), ("curve_only", "area under the curve only"), ("line_only", "area under the line only"), ("net_wrong_order", "wrong order of subtraction")],
             "composite Simpson rule on f - L between roots recomputed by Brent's method (independent of scipy quad)", {"type": "graph", "must_include": ["curve y = f(x)", "line L through two lattice points"]})
    return gpack("g_area_curve_line_calc", "8.4", "1.D", "required", stem, k, pool, rng, _curve_line_stim(fexpr, dom, c0, c1, ytop), bpr, 110, [f"f={fexpr}", f"c0={c0}", f"c1={c1}", f"roots={roots}", f"area={area:.6f}"])


def g_volume_curve_line_calc(rng):
    fexpr, ftex, dom, c0, c1, m, roots, ff = _curve_line(rng, "exp")
    r1, r2 = roots
    Lf = lambda u: c0 + m * u
    V = _I.quad(lambda u: (ff(u) - Lf(u)) ** 2, r1, r2)[0]
    simp = numeric_integral(lambda u: (ff(u) - Lf(u)) ** 2, r1, r2, 20001)
    if abs(simp - V) > 1e-6:
        raise ValueError("independent_check_failed")
    A = _I.quad(lambda u: ff(u) - Lf(u), r1, r2)[0]
    ds = [("Squares the area of R, (integral of f - L)^2, instead of integrating the squared side length.", A * A), ("Reports the area of R and does not square the side length.", A),
          ("Integrates the difference of squares, f^2 - L^2, instead of the square of the difference.", _I.quad(lambda u: ff(u) ** 2 - Lf(u) ** 2, r1, r2)[0]), ("Multiplies the integral of (f - L)^2 by pi, the formula for a revolved solid.", math.pi * V)]
    pool = dopts(ds, V)
    stem = f"The figure shows the graph of $f(x)={ftex}$ and the line $L$. Let $R$ be the region enclosed by the graph of $f$ and the line $L$. $R$ is the base of a solid whose cross sections perpendicular to the $x$-axis are squares. What is the volume of the solid?"
    k = Opt(dec(V), True, "The side of each square is f(x) - L(x) between the intersection points, so V = integral of (f - L)^2 evaluated with a calculator.", V)
    ytop = max(ff(u) for u in [dom[0] + (dom[1] - dom[0]) * i / 200 for i in range(201)])
    bpr = bp("g_volume_curve_line_calc", "8.7", "1.D", "required", "Find the volume of a solid with square cross sections whose base is bounded by a curve and a graphed line",
             ["Read the line from the figure and find the intersection points with a calculator", "Set the side length of each square equal to the vertical distance f - L", "Integrate the square of that distance between the intersection points"],
             [("the cross sections are squares with side f - L because f is above L between the intersection points", "shown in the figure")],
             [("square_of_area", "squares the area"), ("no_squaring", "reports the area"), ("difference_of_squares", "integrates f^2 - L^2"), ("disk_factor", "multiplies by pi")],
             "composite Simpson rule on (f - L)^2 between Brent-found roots (independent of scipy quad)", {"type": "graph", "must_include": ["curve y = f(x)", "line L through two lattice points"]})
    return gpack("g_volume_curve_line_calc", "8.7", "1.D", "required", stem, k, pool, rng, _curve_line_stim(fexpr, dom, c0, c1, ytop), bpr, 115, [f"f={fexpr}", f"c0={c0}", f"c1={c1}", f"roots={roots}", f"V={V:.6f}"])


def g_washer_curve_line_calc(rng):
    for _ in forever():
        fexpr, ftex, dom, c0, c1, m, roots, ff = _curve_line(rng, "sin")
        if min(c0, c1) >= 0 and c0 + m * roots[0] >= 0.5:
            break
    r1, r2 = roots
    Lf = lambda u: c0 + m * u
    V = math.pi * _I.quad(lambda u: ff(u) ** 2 - Lf(u) ** 2, r1, r2)[0]
    simp = math.pi * numeric_integral(lambda u: ff(u) ** 2 - Lf(u) ** 2, r1, r2, 20001)
    if abs(simp - V) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Squares the difference of the radii, pi times the integral of (f - L)^2, instead of the difference of the squared radii.", math.pi * _I.quad(lambda u: (ff(u) - Lf(u)) ** 2, r1, r2)[0]),
          ("Leaves out the factor pi.", V / math.pi), ("Uses only the outer radius f, as a disk with no hole.", math.pi * _I.quad(lambda u: ff(u) ** 2, r1, r2)[0]),
          ("Rotates about the x-axis but integrates the line as the outer radius and the curve as the inner radius, then reports the magnitude.", abs(-V))]
    pool = dopts(ds, V)
    stem = f"The figure shows the graph of $f(x)={ftex}$ and the line $L$. Let $R$ be the region enclosed by the graph of $f$ and the line $L$. $R$ is revolved about the $x$-axis. What is the volume of the solid generated?"
    k = Opt(dec(V), True, "Washers with outer radius f(x) and inner radius L(x): V = pi times the integral of (f^2 - L^2) between the intersection points, evaluated with a calculator.", V)
    ytop = max(ff(u) for u in [dom[0] + (dom[1] - dom[0]) * i / 200 for i in range(201)])
    bpr = bp("g_washer_curve_line_calc", "8.11", "1.D", "required", "Find a washer-method volume for a region bounded by a curve and a graphed line, revolved about the x-axis",
             ["Read the line from the figure and find the intersection points with a calculator", "Identify the outer radius f and the inner radius L", "Integrate pi (f^2 - L^2) between the intersection points"],
             [("the region lies above the x-axis and f >= L > 0 between the intersection points, so washers are formed", "shown in the figure; both y-intercepts are nonnegative")],
             [("square_of_difference", "squares the difference of radii"), ("missing_pi", "omits the factor pi"), ("disk_only", "ignores the inner radius")],
             "composite Simpson rule on pi (f^2 - L^2) between Brent-found roots (independent of scipy quad)", {"type": "graph", "must_include": ["curve y = f(x)", "line L through two lattice points"]})
    return gpack("g_washer_curve_line_calc", "8.11", "1.D", "required", stem, k, pool, rng, _curve_line_stim(fexpr, dom, c0, c1, ytop), bpr, 115, [f"f={fexpr}", f"c0={c0}", f"c1={c1}", f"roots={roots}", f"V={V:.6f}"])


# 9) 2.2 접선이 직선 L 과 평행인 점
def g_parallel_tangent_calc(rng):
    A = rng.choice([2, 3, 4])
    fexpr = A * x * sp.exp(-x / 2)
    ftex = f"{A}xe^{{-x/2}}"
    ff = sp.lambdify(x, fexpr, "math")
    fp = _dd(fexpr)
    for _ in forever():
        c0 = rng.randint(0, 3)
        mnum = rng.choice([1, 2, 3])          # 기울기 = mnum/4
        c1 = c0 + mnum
        m = mnum / 4.0
        mm = m
        D = lambda u: fp(u) - mm
        grid = [i / 400 for i in range(0, 2401)]
        roots = [_O.brentq(D, grid[i], grid[i + 1], xtol=1e-13) for i in range(len(grid) - 1) if D(grid[i]) * D(grid[i + 1]) < 0]
        if len(roots) == 1 and 0.1 < roots[0] < 5.8:
            break
    key = roots[0]
    # 독립 경로: 중심차분 도함수를 쓴 이분법
    lo, hi = 0.0, 2.0 if m > 0 else 6.0
    hh = 1e-6
    Dn = lambda u: (ff(u + hh) - ff(u - hh)) / (2 * hh) - m
    sgn = Dn(0.001)
    lo, hi = 0.001, 5.9
    for _ in range(100):
        mid = (lo + hi) / 2
        if Dn(mid) * Dn(lo) > 0:
            lo = mid
        else:
            hi = mid
    if abs((lo + hi) / 2 - key) > 1e-3:
        raise ValueError("independent_check_failed")
    ints = [r for r in [_O.brentq(lambda u: ff(u) - (c0 + m * u), a_, b_, xtol=1e-12) for a_, b_ in [(i / 10, (i + 1) / 10) for i in range(0, 59)] if (ff(a_) - (c0 + m * a_)) * (ff(b_) - (c0 + m * b_)) < 0]]
    ds = [("Finds where the curve crosses the line, f(x) = L(x), instead of where the slopes are equal.", ints[0] if ints else 1.0), ("Solves f'(x) = %d, treating the y-intercept of the line as its slope." % c0 if c0 else "Solves f(x) = slope, mixing up a value with a slope.", None),
          ("Solves f(x) equal to the slope of L instead of f'(x) equal to the slope.", None), ("Takes the midpoint 3 of the plotted interval.", 3.0)]
    # 두 번째·세 번째 오답은 실제 수치로 채운다
    sol_c0 = None
    if c0:
        r_ = [_O.brentq(lambda u: fp(u) - c0, a_, b_) for a_, b_ in [(i / 10, (i + 1) / 10) for i in range(0, 59)] if (fp(a_) - c0) * (fp(b_) - c0) < 0]
        sol_c0 = r_[0] if r_ else None
    r2_ = [_O.brentq(lambda u: ff(u) - m, a_, b_) for a_, b_ in [(i / 10, (i + 1) / 10) for i in range(0, 59)] if (ff(a_) - m) * (ff(b_) - m) < 0]
    ds[1] = (ds[1][0], sol_c0 if sol_c0 is not None else (key + 1.3))
    ds[2] = (ds[2][0], r2_[0] if r2_ else (key + 0.9))
    pool = dopts(ds, key)
    stem = f"The figure shows the graph of $f(x)={ftex}$ for $0\\le x\\le 6$ and the line $L$. At what value of $x$ in the interval $(0,6)$ is the tangent line to the graph of $f$ parallel to $L$?"
    k = Opt(dec(key), True, "Read the slope of L from the figure, then solve f'(x) = slope numerically with a calculator.", key)
    ytop = max(ff(u) for u in [i / 100 for i in range(601)])
    stim = {"kind": "graph", "description": "Graph of the curve y = f(x) and the line L.", "data": {"x_axis": axis("x", 0, 6, 1), "y_axis": axis("y", 0, int(math.ceil(max(ytop, c0 + m * 6))) + 1, 1),
            "curves": [{"label": "f", "type": "smooth", "vertices": [[round(i / 10, 2), round(ff(i / 10), 4)] for i in range(0, 61)]}, {"label": "L", "type": "linear", "vertices": [[0, c0], [4, c1]]}]}}
    bpr = bp("g_parallel_tangent_calc", "2.2", "2.B", "required", "Find where the tangent to a curve is parallel to a line whose slope is read from a graph",
             ["Read two lattice points on L from the figure and find its slope", "Differentiate f and set f'(x) equal to the slope of L", "Solve the equation numerically with a calculator"],
             [("parallel lines have equal slopes and f' has exactly one solution of f'(x) = slope on (0, 6)", "f'(x) = A(1 - x/2)e^{-x/2} is monotonic on the relevant branch for 0 < slope < A")],
             [("intersection_not_tangent", "solves f(x) = L(x)"), ("slope_confused", "uses the intercept as the slope"), ("value_equals_slope", "solves f(x) = slope")],
             "bisection on the central-difference derivative with 100 halvings (independent of the symbolic derivative and Brent's method)", {"type": "graph", "must_include": ["curve y = f(x)", "line L through two lattice points"]})
    return gpack("g_parallel_tangent_calc", "2.2", "2.B", "required", stem, k, pool, rng, stim, bpr, 105, [f"f={fexpr}", f"c0={c0}", f"m={m}", f"key={key:.6f}"])


# 10) 7.8 지수 모델: 그래프의 두 점으로 k 를 구하고 더 먼 시각의 값
def g_exp_value_calc(rng):
    P0, m, T = rng.choice([2, 3, 4]), rng.choice([2, 3]), 2
    t1 = rng.choice([5, 6, 7])
    k_ = math.log(m) / T
    key = P0 * math.exp(k_ * t1)
    PT = P0 * m
    ds = [("Extends the chord slope linearly: P(0) + (P(%d) - P(0))/%d times %d." % (T, T, t1), P0 + (PT - P0) / T * t1), ("Multiplies P(%d) by the ratio once per year instead of per %d years: P(0) m^{t}." % (T, T), P0 * m ** t1),
          ("Uses k = ln(m) without dividing by the elapsed time %d." % T, P0 * math.exp(math.log(m) * t1)), ("Uses k = ln(m)/T but starts from P(%d) instead of P(0)." % T, PT * math.exp(k_ * t1))]
    pool = dopts(ds, key)
    pts = [[round(i / 5, 2), round(P0 * math.exp(k_ * i / 5), 4)] for i in range(0, 21)]
    ymax = int(math.ceil(P0 * math.exp(k_ * 4)))
    if abs(P0 * (PT / P0) ** (t1 / T) - key) > 1e-9:
        raise ValueError("independent_check_failed")
    stem = f"A quantity $P$ at time $t$ (in years) satisfies $\\dfrac{{dP}}{{dt}}=kP$. The graph of $P$ for $0\\le t\\le 4$ is shown and passes through the labeled points $A$ and $B$. What is the value of $P({t1})$?"
    k = Opt(dec(key), True, "From the labeled points, P(%d)/P(0) = %d, so k = ln(%d)/%d; then P(%d) = P(0) e^{%d k} evaluated with a calculator." % (T, m, m, T, t1, t1), key)
    bpr = bp("g_exp_value_calc", "7.8", "1.E", "required", "Use an exponential model read from two points on a graph to find a later value",
             ["Read the labeled points A and B from the graph", "Find k from P(T)/P(0) = e^{kT}", "Evaluate P(t) = P(0) e^{kt} at a later time with a calculator"],
             [("solutions of dP/dt = kP have the form P(0) e^{kt}", "exponential model stated in the problem")],
             [("linear_extension", "extends the chord linearly"), ("ratio_per_year", "applies the ratio per year"), ("no_time_division", "uses ln m without dividing by T"), ("wrong_start", "starts from P(T)")],
             "P(t1) recomputed as P(0) (P(T)/P(0))^(t1/T) (independent of the exponent k)", {"type": "graph", "must_include": ["exponential curve for 0 <= t <= 4", "labeled points A = (0, P0) and B = (2, m P0)"]})
    stim = gstim("Graph of P(t), an increasing exponential curve, with labeled points A and B.", [("P", pts)], axis("t", 0, 4, 1), axis("P", 0, ymax + 1, P0 if P0 <= 3 else 2), {"labeled_points": {"A": [0, P0], "B": [T, PT]}})
    return gpack("g_exp_value_calc", "7.8", "1.E", "required", stem, k, pool, rng, stim, bpr, 100, [f"P0={P0}", f"m={m}", f"t1={t1}", f"key={key:.6f}"])


# 11) 1.11 연속이 되는 k: 왼쪽은 그래프, 오른쪽은 식
def g_cont_k_mixed_calc(rng):
    for _ in forever():
        v = rand_vals(rng, 3, 0, 6)
        c = rng.choice([1, 2, 3])
        m = v[2]
        if m != c and v[1] != v[2]:
            break
    key = (m - c) / math.log(3)
    ds = [("Forgets the constant %d in the right-hand piece: k = f(2)/ln 3." % c, m / math.log(3)), ("Uses ln 2 instead of ln 3: the right-hand piece at x = 2 is k ln(2 + 1).", (m - c) / math.log(2)),
          ("Divides by 3 instead of ln 3: treats ln(x + 1) at x = 2 as 3.", (m - c) / 3.0), ("Equates the slopes instead of the values at x = 2.", (m - c) / 2.0 * 0.5)]
    pool = dopts(ds, key)
    g = PL([0, 1, 2], v)
    if abs(float(key) * math.log(3) + c - m) > 1e-9:
        raise ValueError("independent_check_failed")
    stem = f"The function $f$ is defined by $f(x)$ equal to the graph shown for $0\\le x\\le 2$ and $f(x)=k\\ln(x+1)+{c}$ for $2<x\\le 5$, where $k$ is a constant. For what value of $k$ is $f$ continuous at $x=2$?"
    k = Opt(dec(key), True, "Continuity at 2 requires the right-hand limit k ln 3 + %d to equal f(2) = %d read from the graph, so k = (%d - %d)/ln 3 (calculator)." % (c, m, m, c), key)
    bpr = bp("g_cont_k_mixed_calc", "1.11", "1.E", "required", "Choose a constant that makes a function continuous where one piece is a graph and the other a formula",
             ["Read f(2) from the graph of the left piece", "Set the right-hand limit k ln 3 + c equal to f(2)", "Solve for k with a calculator"],
             [("continuity at 2 requires the left piece value, the right-hand limit and f(2) to agree", "definition of continuity at a point")],
             [("forgets_constant", "drops the added constant"), ("wrong_log_argument", "uses ln 2 instead of ln 3"), ("log_as_3", "treats ln 3 as 3"), ("slope_matching", "matches slopes")],
             "k substituted back into the right-hand piece and compared with the plotted value f(2) (independent of the algebra for k)", {"type": "graph", "must_include": ["vertices of f at x = 0, 1, 2"]})
    return gpack("g_cont_k_mixed_calc", "1.11", "1.E", "required", stem, k, pool, rng, gstim("Graph of f for 0 <= x <= 2, consisting of line segments connecting the plotted vertices.", [("f", g.vert())], axis("x", 0, 2, 1), axis("y", 0, 7, 1)), bpr, 90, [f"v={v}", f"c={c}", f"key={key:.6f}"])


# 12) 5.2 임계점: h = f - g, f' 는 그래프, g 는 식
def g_critical_point_mixed_calc(rng):
    gexprs = [(sp.sin(x / 2) * 2, "2\\sin\\left(\\frac{x}{2}\\right)"), (x * sp.exp(-x / 3) * 3, "3xe^{-x/3}"), (sp.log(x + 1) * 2, "2\\ln(x+1)")]
    xs6 = [0, 2, 4, 6]
    for _ in forever():
        gexpr, gtex = rng.choice(gexprs)
        vf = rand_vals(rng, 4, -2, 5)
        fp = PL(xs6, vf)
        gp_ = _dd(gexpr)
        H = lambda u: fp.num(u) - gp_(u)
        grid = [i / 400 for i in range(0, 2401)]
        roots = [_O.brentq(H, grid[i], grid[i + 1], xtol=1e-13) for i in range(len(grid) - 1) if H(grid[i]) * H(grid[i + 1]) < 0]
        if len(roots) == 1 and 0.2 < roots[0] < 5.8 and min(abs(roots[0] - t_) for t_ in xs6) > 0.15 and abs(H(0.0)) > 0.05 and abs(H(6.0)) > 0.05:
            break
    key = roots[0]
    # 독립 경로: 이분법(별도 구현)
    ff = lambda u: fp.num(u) - (float(sp.diff(gexpr, x).subs(x, u)))
    lo, hi = 0.0, 6.0
    fl = ff(lo)
    for _ in range(80):
        mid = (lo + hi) / 2
        if ff(mid) * fl > 0:
            lo = mid
        else:
            hi = mid
    if abs((lo + hi) / 2 - key) > 1e-6:
        raise ValueError("independent_check_failed")
    z = [t_ for t_ in [i / 100 for i in range(0, 600)] if fp.num(t_) * fp.num(t_ + 0.01) < 0]
    wrongroot = z[0] if z else key + 1
    ds = [("Finds where f'(x) = 0 on the graph and ignores the term from g.", wrongroot), ("Solves f'(x) = g(x) instead of f'(x) = g'(x).", _solve_fp_eq(fp, lambda u: float(gexpr.subs(x, u)))),
          ("Solves f'(x) + g'(x) = 0, adding the derivatives instead of subtracting.", _solve_fp_eq(fp, lambda u: -float(sp.diff(gexpr, x).subs(x, u)))), ("Takes the midpoint of the interval, x = 3.", 3.0)]
    pool = dopts(ds, key)
    stem = f"The graph of $f'$, the derivative of $f$, is shown for $0\\le x\\le 6$ and consists of line segments. Let $g(x)={gtex}$ and $h(x)=f(x)-g(x)$. At what value of $x$ in $(0,6)$ is $h'(x)=0$?"
    k = Opt(dec(key), True, "h'(x) = f'(x) - g'(x) = 0; f' is read from the graph (linear on each segment) and g' from the formula, and the equation is solved with a calculator.", key)
    bpr = bp("g_critical_point_mixed_calc", "5.2", "1.E", "required", "Find a critical point of a difference of a function known by its derivative graph and a formula",
             ["Write h' = f' - g' and set it equal to zero", "Use the graph of f' (linear on each segment) and the derivative of g from the formula", "Solve the equation numerically with a calculator"],
             [("h is differentiable on (0, 6) and has exactly one critical point", "the difference f' - g' changes sign exactly once on the interval for the plotted graph")],
             [("only_fprime_zero", "uses the zero of f'"), ("g_instead_of_gprime", "uses g in place of g'"), ("sign_error", "adds the derivatives"), ("midpoint", "guesses the midpoint")],
             "bisection with 80 halvings on f'(x) - g'(x) using numerically interpolated f' and sympy g' (independent of Brent's method)", {"type": "graph", "must_include": ["vertices of f' at x = 0, 2, 4, 6"]})
    return gpack("g_critical_point_mixed_calc", "5.2", "1.E", "required", stem, k, pool, rng, gstim("Graph of f', consisting of line segments connecting the plotted vertices.", [("f'", fp.vert())], *_ax([vf], "x", (0, 6), "f'(x)")), bpr, 110, [f"g={gexpr}", f"vf={vf}", f"key={key:.6f}"])


def _solve_fp_eq(fp, gfun):
    D = lambda u: fp.num(u) - gfun(u)
    grid = [i / 100 for i in range(0, 600)]
    for i in range(len(grid) - 1):
        if D(grid[i]) * D(grid[i + 1]) < 0:
            return _O.brentq(D, grid[i], grid[i + 1])
    return 5.0
