"""예비 3차(R3-A, 2026-10-12): 계산기 필수 MC 원형 1군 — 단원 1·2·3(그래프 필수 겹침 포함). 반려됐던 원형의 결함(단원 범위·거짓 오답 해설)을 고친 판과 새 구조.
모든 오답 값은 해설에 적은 실수를 코드로 그대로 계산한 값이다(해설과 값이 일치). 학생에게 보이는 수식은 전부 $...$ 안에 둔다."""
from gcommon import *
from scipy import optimize as _O, integrate as _I
from calc_graph_d import dopts, _ax
import math

XS5 = [0, 2, 4, 6, 8]


def _gbp(arch, topic, skill, concept, thinking, cond, mis, path, inc):
    return bp(arch, topic, skill, "required", concept, thinking, cond, mis, path, {"type": "graph", "must_include": inc})


def _nbp(arch, topic, skill, concept, thinking, cond, mis, path):
    return bp(arch, topic, skill, "required", concept, thinking, cond, mis, path, {"type": "none", "must_include": []})


def _bis(fn, lo, hi, n=100):
    """별도 구현 이분법(부호가 다른 구간 [lo, hi])."""
    flo = fn(lo)
    for _ in range(n):
        mid = (lo + hi) / 2
        if fn(mid) * flo > 0:
            lo = mid
            flo = fn(lo)
        else:
            hi = mid
    return (lo + hi) / 2


# ============================================================ 단원 1
# 1.11 연속이 되는 상수 k: 왼쪽 조각은 그래프, 오른쪽 조각은 k ln(x+1)+c
def g_cont_k_graph_log_calc(rng):
    for _ in forever():
        v = rand_vals(rng, 3, 1, 6)
        c = rng.choice([1, 2, 3])
        m = v[2]
        if m > c and len({m, v[0], c}) == 3:
            break
    key = (m - c) / math.log(3)
    if abs(key * math.log(3 + 1e-9) + c - m) > 1e-6:  # 독립 경로: x = 2 바로 오른쪽에서 오른쪽 조각을 직접 평가
        raise ValueError("independent_check_failed")
    ds = [(f"Leaves out the added constant ${c}$ and solves $k\\ln 3={m}$.", m / math.log(3)),
          ("Evaluates $\\ln(x+1)$ at $x=1$, using $\\ln 2$ in place of $\\ln 3$.", (m - c) / math.log(2)),
          (f"Reads $f(0)={v[0]}$ from the graph instead of $f(2)={m}$.", (v[0] - c) / math.log(3)),
          ("Treats $\\ln 3$ as $3$ when solving for $k$.", (m - c) / 3)]
    pool = dopts(ds, key)
    g = PL([0, 1, 2], v)
    stem = f"The function $f$ is defined on $0\\le x\\le 5$. For $0\\le x\\le 2$, the graph of $f$ is shown and consists of line segments. For $2<x\\le 5$, $f(x)=k\\ln(x+1)+{c}$, where $k$ is a constant. For what value of $k$ is $f$ continuous at $x=2$?"
    k = Opt(dec(key), True, f"The graph gives $f(2)={m}$. Continuity at $x=2$ requires $\\lim_{{x\\to 2^+}}f(x)=k\\ln 3+{c}={m}$, so $k=\\dfrac{{{m}-{c}}}{{\\ln 3}}\\approx {key:.3f}$ (calculator).", key)
    bpr = _gbp("g_cont_k_graph_log_calc", "1.11", "1.E", "Choose a constant that makes a function continuous when the left piece is a graph and the right piece is a logarithmic formula",
               ["Read f(2) from the graph of the left piece", "Set the right-hand limit k ln 3 + c equal to f(2)", "Solve for k with a calculator"],
               [("continuity at 2 requires the left piece value, the right-hand limit and f(2) to agree", "definition of continuity at a point")],
               [("forgets_constant", "drops the added constant c"), ("wrong_log_argument", "uses ln 2 instead of ln 3"), ("wrong_graph_point", "reads f(0) instead of f(2)"), ("log_as_3", "treats ln 3 as 3")],
               "the right-hand piece evaluated just to the right of x = 2 with the computed k and compared with the plotted f(2) (independent of the algebra for k)", ["vertices of f at x = 0, 1, 2"])
    return gpack("g_cont_k_graph_log_calc", "1.11", "1.E", "required", stem, k, pool, rng, gstim("Graph of f for 0 <= x <= 2, consisting of line segments connecting the plotted vertices.", [("f", g.vert())], axis("x", 0, 2, 1), axis("y", 0, 7, 1)), bpr, 90, [f"v={v}", f"c={c}", f"key={key:.6f}"])


_GIVT = [(sp.log(x + 1), "\\ln(x+1)"), (sp.sqrt(x), "\\sqrt{x}"), (sp.exp(x / 4), "e^{x/4}"), (x * sp.log(x + 1), "x\\ln(x+1)")]


# 1.16 중간값 정리: h = f(그래프) + g(식) 이 열린 구간에서 반드시 취하는 값
def g_ivt_sum_graph_calc(rng):
    for _ in forever():
        gexpr, gtex = rng.choice(_GIVT)
        vf = rand_vals(rng, 5, 1, 7)
        f = PL(XS5, vf)
        a, b = rng.choice([(0, 6), (0, 8), (2, 8), (2, 6)])
        gf = sp.lambdify(x, gexpr, "math")
        H = lambda u: f.num(u) + gf(u)
        ha, hb = H(a), H(b)
        lo, hi = min(ha, hb), max(ha, hb)
        if hi - lo < 2.0 or lo < 0.5:
            continue
        hv = [H(a + (b - a) * i / 4000) for i in range(1, 4000)]  # 열린 구간에서 실제로 취하는 값의 범위
        rmin, rmax = min(hv), max(hv)
        key = round(lo + (hi - lo) * rng.choice([0.35, 0.5, 0.65]), 1)
        if not (lo + 0.2 < key < hi - 0.2):
            continue
        fa, fb = float(f.vs[XS5.index(a)]), float(f.vs[XS5.index(b)])
        fmid = (fa + fb) / 2
        end_hi = max(ha, hb)
        end_x = b if hb >= ha else a
        cand = [(f"Chooses the endpoint value $h({end_x})={end_hi:.3f}$, which is attained at $x={end_x}$ but not on the open interval $({a},{b})$.", end_hi),
                (f"Adds the two endpoint values, $h({a})+h({b})={ha + hb:.3f}$, instead of choosing a value between them.", ha + hb),
                (f"Takes the value halfway between $f({a})={fa:g}$ and $f({b})={fb:g}$ and ignores the formula term, giving ${fmid:.3f}$.", fmid),
                (f"Uses the difference of the endpoint values, $|h({b})-h({a})|={abs(hb - ha):.3f}$.", abs(hb - ha))]
        good = [(w, z) for w, z in cand if z < rmin - 0.05 or z > rmax + 0.05]
        if len(good) >= 3:
            break
    pool = dopts(good, key)
    stem = f"The function $f$ is continuous on $[0,8]$, and the graph of $f$, which consists of line segments, is shown. Let $h(x)=f(x)+{gtex}$. For which of the following values of $k$ does the Intermediate Value Theorem guarantee that $h(c)=k$ for some number $c$ with ${a}<c<{b}$?"
    kk = Opt(dec(key), True, f"$h$ is continuous on $[{a},{b}]$. From the graph $f({a})={fa:g}$ and $f({b})={fb:g}$, and with a calculator $h({a})={ha:.3f}$ and $h({b})={hb:.3f}$. Every value strictly between them, including ${key:.1f}$, is attained by the Intermediate Value Theorem.", key)
    bpr = _gbp("g_ivt_sum_graph_calc", "1.16", "3.D", "Apply the Intermediate Value Theorem to the sum of a graphed function and a formula to decide which value is guaranteed",
               ["Check that h is continuous on the closed interval", "Find h at both endpoints using the graph for f and a calculator for the formula", "Choose the value strictly between the endpoint values"],
               [("h = f + g is continuous on [a, b] because f is piecewise linear and continuous and g is continuous there", "the graph has no breaks")],
               [("endpoint_value", "chooses an endpoint value, not strictly between"), ("sum_of_endpoints", "adds the endpoint values"), ("ignores_formula", "uses only f halfway value"), ("difference", "uses the difference of the endpoint values")],
               "dense grid scan of h on the open interval: the key lies strictly between the endpoint values and every wrong value lies outside the attained range (independent of the endpoint arithmetic)", ["vertices of f at x = 0, 2, 4, 6, 8"])
    return gpack("g_ivt_sum_graph_calc", "1.16", "3.D", "required", stem, kk, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([vf], "x", (0, 8), "f(x)")), bpr, 110, [f"g={gexpr}", f"vf={vf}", f"ab={(a, b)}", f"key={key}"])


# ============================================================ 단원 2 (연쇄법칙 없이: e^x, ln x, 거듭제곱, 곱·몫)
_F2 = [(sp.log(x) + x ** 2 / 4, "\\ln x+\\dfrac{x^{2}}{4}", [1, 3, 5]), (sp.sqrt(x) + sp.log(x), "\\sqrt{x}+\\ln x", [1, 3, 5, 7]), (sp.exp(x) - x, "e^{x}-x", [1, 3]), (x * sp.log(x), "x\\ln x", [1, 3, 5, 7])]


def _sample_fg(rng):
    for _ in forever():
        fexpr, ftex, acs = rng.choice(_F2)
        vg = rand_vals(rng, 5, 1, 6)
        if any((vg[i] + vg[i + 1]) % 2 for i in range(4)):
            continue
        a = rng.choice(acs)
        g = PL(XS5, vg)
        i = (a - 1) // 2
        ga, gp = float(g.at(a)), float(g.slope_seg(i))
        fa, fpa = float(fexpr.subs(x, a)), float(sp.diff(fexpr, x).subs(x, a))
        if gp != 0:
            return fexpr, ftex, vg, a, g, ga, gp, fa, fpa


# 2.8 곱의 법칙: f 는 식(연쇄법칙 불필요), g 는 그래프
def g_product_formula_graph_calc(rng):
    for _ in forever():
        fexpr, ftex, vg, a, g, ga, gp, fa, fpa = _sample_fg(rng)
        key = fpa * ga + fa * gp
        if abs(key) > 0.3:
            break
    ff = sp.lambdify(x, fexpr, "math")
    hh = 1e-6
    hn = lambda u: ff(u) * g.num(u)
    if abs((hn(a + hh) - hn(a - hh)) / (2 * hh) - key) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [(f"Evaluates the product $f({a})g({a})$ without differentiating.", fa * ga), (f"Keeps only the first product-rule term $f'({a})g({a})$.", fpa * ga),
          (f"Keeps only the second product-rule term $f({a})g'({a})$.", fa * gp), (f"Multiplies the derivatives, $f'({a})g'({a})$.", fpa * gp)]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$. The graph of the function $g$, which consists of line segments, is shown. If $h(x)=f(x)\\,g(x)$, what is the value of $h'({a})$?"
    k = Opt(dec(key), True, f"$h'(x)=f'(x)g(x)+f(x)g'(x)$. The graph gives $g({a})={int(ga)}$ and $g'({a})={gp:g}$, and with a calculator $f({a})={fa:.3f}$ and $f'({a})={fpa:.3f}$. So $h'({a})=({fpa:.3f})({int(ga)})+({fa:.3f})({gp:g})={key:.3f}$.", key)
    bpr = _gbp("g_product_formula_graph_calc", "2.8", "1.E", "Apply the product rule at a point when one factor is a formula and the other is a graph",
               ["Differentiate the formula and evaluate f(a) and f'(a) with a calculator", "Read g(a) and the slope g'(a) from the graph", "Combine with the product rule"],
               [("h is differentiable at a because f is differentiable and a is not a vertex of the graph of g", "a lies inside a segment")],
               [("no_differentiation", "evaluates f(a)g(a)"), ("first_term_only", "keeps only the first product term"), ("second_term_only", "keeps only the second product term"), ("multiplies_derivatives", "multiplies f' and g'")],
               "central difference (step 1e-6) of the numerically interpolated product (independent of the product rule)", ["vertices of g at x = 0, 2, 4, 6, 8"])
    return gpack("g_product_formula_graph_calc", "2.8", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 100, [f"f={fexpr}", f"vg={vg}", f"a={a}", f"key={key:.6f}"])


# 2.9 몫의 법칙: q = f/g, f 는 식, g 는 그래프(양수)
def g_quotient_formula_graph_calc(rng):
    for _ in forever():
        fexpr, ftex, vg, a, g, ga, gp, fa, fpa = _sample_fg(rng)
        key = (fpa * ga - fa * gp) / ga ** 2
        if abs(key) > 0.05:
            break
    ff = sp.lambdify(x, fexpr, "math")
    hh = 1e-6
    qn = lambda u: ff(u) / g.num(u)
    if abs((qn(a + hh) - qn(a - hh)) / (2 * hh) - key) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [(f"Reverses the numerator, using $f({a})g'({a})-f'({a})g({a})$ over $g({a})^2$.", (fa * gp - fpa * ga) / ga ** 2), (f"Divides the derivatives, $f'({a})/g'({a})$, instead of using the quotient rule.", fpa / gp),
          (f"Divides the numerator by $g({a})$ instead of $g({a})^2$.", (fpa * ga - fa * gp) / ga), (f"Adds in the numerator, $f'({a})g({a})+f({a})g'({a})$ over $g({a})^2$.", (fpa * ga + fa * gp) / ga ** 2)]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={ftex}$. The graph of the function $g$, which consists of line segments, is shown. If $q(x)=\\dfrac{{f(x)}}{{g(x)}}$, what is the value of $q'({a})$?"
    k = Opt(dec(key), True, f"$q'(x)=\\dfrac{{f'(x)g(x)-f(x)g'(x)}}{{[g(x)]^2}}$. The graph gives $g({a})={int(ga)}$ and $g'({a})={gp:g}$, and with a calculator $f({a})={fa:.3f}$ and $f'({a})={fpa:.3f}$. So $q'({a})=\\dfrac{{({fpa:.3f})({int(ga)})-({fa:.3f})({gp:g})}}{{{int(ga)}^2}}={key:.3f}$.", key)
    bpr = _gbp("g_quotient_formula_graph_calc", "2.9", "1.E", "Apply the quotient rule at a point when the numerator is a formula and the denominator is a graph",
               ["Differentiate the formula and evaluate f(a) and f'(a) with a calculator", "Read g(a) and the slope g'(a) from the graph", "Combine with the quotient rule"],
               [("q is differentiable at a because g(a) is not 0 and a is not a vertex of the graph of g", "g is positive on the graph and a lies inside a segment")],
               [("reversed_numerator", "subtracts in the wrong order"), ("quotient_of_derivatives", "divides f' by g'"), ("denominator_not_squared", "divides by g instead of g squared"), ("adds_terms", "adds the product terms")],
               "central difference (step 1e-6) of the numerically interpolated quotient (independent of the quotient rule)", ["vertices of g at x = 0, 2, 4, 6, 8"])
    return gpack("g_quotient_formula_graph_calc", "2.9", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 105, [f"f={fexpr}", f"vg={vg}", f"a={a}", f"key={key:.6f}"])


_FPAR = [(x * sp.exp(x), "xe^{x}", [2, 3, 4]), (sp.exp(x) + x ** 2, "e^{x}+x^{2}", [2, 3, 4, 5]), (x ** 2 * sp.exp(x), "x^{2}e^{x}", [2, 3, 4, 5, 6])]


# 2.7/2.8 접선이 직선 L 과 평행: 곡선은 식(그림), 직선은 격자점 두 개(그림)
def g_parallel_tangent_formula_calc(rng):
    for _ in forever():
        fexpr, ftex, ms = rng.choice(_FPAR)
        m = rng.choice(ms)
        c0 = rng.choice([1, 2, 3])
        ff = sp.lambdify(x, fexpr, "math")
        fp = sp.lambdify(x, sp.diff(fexpr, x), "math")
        if c0 == m:
            continue
        grid = [0.01 + 1.98 * i / 800 for i in range(801)]

        def root(fn):
            r = [_O.brentq(fn, grid[i], grid[i + 1], xtol=1e-13) for i in range(800) if fn(grid[i]) * fn(grid[i + 1]) < 0]
            return r[0] if len(r) == 1 else None

        key = root(lambda u: fp(u) - m)
        if key is None or key < 0.1 or key > 1.9:
            continue
        # 독립 경로: 중심차분 도함수와 이분법
        hh = 1e-6
        kb = _bis(lambda u: (ff(u + hh) - ff(u - hh)) / (2 * hh) - m, 0.01, 1.99)
        if abs(kb - key) > 1e-5:
            continue
        cands = [(f"Solves $f(x)={m}$, using the slope of $L$ as a value of $f$ instead of as a value of $f'$.", root(lambda u: ff(u) - m)), (f"Solves $f'(x)={c0}$, using the $y$-intercept of $L$ as its slope.", root(lambda u: fp(u) - c0)),
                 (f"Solves $f'(x)={2 * m}$, using the rise of $L$ from $x=0$ to $x=2$ as its slope.", root(lambda u: fp(u) - 2 * m)), ("Finds where the graph of $f$ crosses $L$, solving $f(x)=L(x)$.", root(lambda u: ff(u) - (c0 + m * u)))]
        good = [(w, z) for w, z in cands if z is not None and 0.05 < z < 1.95]
        if len(good) >= 3:
            break
    pool = dopts(good, key)
    n = 80
    pts = [[round(2 * i / n, 4), round(ff(2 * i / n), 4)] for i in range(n + 1)]
    ytop = int(math.ceil(max(ff(2.0), c0 + 2 * m))) + 1
    stim = {"kind": "graph", "description": "Graph of the curve y = f(x) for 0 <= x <= 2 and the line L, which passes through the lattice points (0, %d) and (2, %d)." % (c0, c0 + 2 * m),
            "data": {"x_axis": axis("x", 0, 2, 1), "y_axis": axis("y", 0, ytop, 2), "curves": [{"label": "f", "type": "smooth", "vertices": pts}, {"label": "L", "type": "linear", "vertices": [[0, c0], [2, c0 + 2 * m]]}]}}
    stem = f"The figure shows the graph of $f(x)={ftex}$ and the line $L$. At what value of $x$ in the interval $(0,2)$ is the line tangent to the graph of $f$ parallel to $L$?"
    k = Opt(dec(key), True, f"The line $L$ passes through $(0,{c0})$ and $(2,{c0 + 2 * m})$, so its slope is ${m}$. The tangent line is parallel to $L$ where $f'(x)={m}$; solving with a calculator on $(0,2)$ gives $x={key:.3f}$.", key)
    bpr = _gbp("g_parallel_tangent_formula_calc", "2.7", "2.B", "Find where the tangent line to a curve given by a formula is parallel to a line read from a figure",
               ["Read two lattice points on L from the figure and compute its slope", "Set f'(x) equal to that slope", "Solve the equation numerically with a calculator on the interval"],
               [("parallel lines have equal slopes", "f' is increasing on (0, 2), so f'(x) = slope has exactly one solution")],
               [("value_not_slope", "solves f = m"), ("intercept_as_slope", "uses the y-intercept as the slope"), ("rise_as_slope", "uses the rise as the slope"), ("intersection", "solves f = L")],
               "bisection with 100 halvings on a central-difference slope minus m (independent of Brent's method and the symbolic derivative)", ["curve y = f(x)", "line L through two lattice points"])
    return gpack("g_parallel_tangent_formula_calc", "2.7", "2.B", "required", stem, k, pool, rng, stim, bpr, 105, [f"f={fexpr}", f"m={m}", f"c0={c0}", f"key={key:.6f}"])


# 2.10 sec 의 도함수와 곱의 법칙
def c_x_sec_derivative_calc(rng):
    k = rng.choice([2, 3, 4])
    a = rng.choice([0.4, 0.5, 0.6, 0.7, 0.8])
    sec = lambda u: 1 / math.cos(u)
    tan = math.tan
    key = k * sec(a) + k * a * sec(a) * tan(a)
    hh = 1e-6
    fn = lambda u: k * u * sec(u)
    if abs((fn(a + hh) - fn(a - hh)) / (2 * hh) - key) > 1e-5:  # 독립 경로: 중심차분
        raise ValueError("independent_check_failed")
    ds = [(f"Uses $(\\sec x)'=\\sec^2 x$, giving ${k}\\sec {a}+{k}({a})\\sec^2 {a}$.", k * sec(a) + k * a * sec(a) ** 2),
          (f"Leaves out the product-rule term ${k}\\sec x$ and keeps only ${k}x\\sec x\\tan x$.", k * a * sec(a) * tan(a)),
          (f"Uses $(\\sec x)'=-\\sec x\\tan x$, giving ${k}\\sec {a}-{k}({a})\\sec {a}\\tan {a}$.", k * sec(a) - k * a * sec(a) * tan(a)),
          (f"Drops the constant ${k}$ from the first term, giving $\\sec {a}+{k}({a})\\sec {a}\\tan {a}$.", sec(a) + k * a * sec(a) * tan(a))]
    pool = dopts(ds, key)
    stem = f"Let $f(x)={k}x\\sec x$. What is the value of $f'({a})$? (Angles are in radians.)"
    kk = Opt(dec(key), True, f"By the product rule with $(\\sec x)'=\\sec x\\tan x$, $f'(x)={k}\\sec x+{k}x\\sec x\\tan x$. At $x={a}$ this is ${k}\\sec {a}+{k}({a})\\sec {a}\\tan {a}={key:.3f}$ (calculator in radian mode).", key)
    bpr = _nbp("c_x_sec_derivative_calc", "2.10", "1.C", "Differentiate a product containing the secant function and evaluate the derivative with a calculator",
               ["Recognize a product of x and sec x and choose the product rule", "Use the derivative of sec x, which is sec x tan x", "Evaluate with a calculator in radians"],
               [("the derivative of sec x is sec x tan x", "standard derivative formula for Unit 2")],
               [("sec_squared", "uses the derivative of tan for sec"), ("missing_product_term", "omits the first product term"), ("sign_error", "uses a negative sign as for csc"), ("lost_constant", "drops the constant in one term")],
               "central difference (step 1e-6) of k x sec x (independent of the derivative formulas)")
    return pack("c_x_sec_derivative_calc", "2.10", "1.C", "required", stem, kk, pool, rng, est=85, facts=[f"k={k}", f"a={a}", f"key={key:.6f}"], extra={"blueprint": bpr})


# ============================================================ 단원 3 (연쇄법칙)
# 3.1 e^{g(x)/2}: g 는 그래프
def g_chain_exp_graph_calc(rng):
    for _ in forever():
        vg = rand_vals(rng, 5, 0, 6)
        if any((vg[i] + vg[i + 1]) % 2 for i in range(4)):
            continue
        a = rng.choice([1, 3, 5, 7])
        g = PL(XS5, vg)
        i = (a - 1) // 2
        ga, gp = float(g.at(a)), float(g.slope_seg(i))
        if gp != 0 and ga != 0:
            break
    key = gp / 2 * math.exp(ga / 2)
    hh = 1e-6
    hn = lambda u: math.exp(g.num(u) / 2)
    if abs((hn(a + hh) - hn(a - hh)) / (2 * hh) - key) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [(f"Differentiates only the exponent, $\\dfrac{{g'({a})}}{{2}}={gp / 2:g}$.", gp / 2), (f"Leaves out the inner derivative, giving $e^{{g({a})/2}}$.", math.exp(ga / 2)),
          (f"Uses $e^{{g({a})}}$ in place of $e^{{g({a})/2}}$, giving $\\dfrac{{g'({a})}}{{2}}e^{{g({a})}}$.", gp / 2 * math.exp(ga)), (f"Forgets the factor $\\frac{{1}}{{2}}$ of the exponent, giving $g'({a})e^{{g({a})/2}}$.", gp * math.exp(ga / 2))]
    pool = dopts(ds, key)
    stem = f"Let $h(x)=e^{{g(x)/2}}$, where the graph of $g$, consisting of line segments, is shown. What is the value of $h'({a})$?"
    k = Opt(dec(key), True, f"By the chain rule $h'(x)=\\dfrac{{g'(x)}}{{2}}e^{{g(x)/2}}$. The graph gives $g({a})={int(ga)}$ and $g'({a})={gp:g}$, so $h'({a})=\\dfrac{{{gp:g}}}{{2}}e^{{{int(ga)}/2}}={key:.3f}$ (calculator).", key)
    bpr = _gbp("g_chain_exp_graph_calc", "3.1", "1.C", "Differentiate an exponential of a graphed function with the chain rule at a point",
               ["Recognize e raised to a function and plan the chain rule", "Read g(a) and the slope g'(a) from the graph", "Evaluate (g'/2) e^(g/2) with a calculator"],
               [("h is differentiable at a because g is differentiable at a (a is not a vertex)", "a lies inside a segment")],
               [("exponent_only", "differentiates only the exponent"), ("no_inner_derivative", "omits the inner derivative"), ("wrong_exponent", "uses e^g in place of e^(g/2)"), ("lost_half", "forgets the factor 1/2")],
               "central difference (step 1e-6) of e^(g/2) with g interpolated (independent of the chain rule)", ["vertices of g at x = 0, 2, 4, 6, 8"])
    return gpack("g_chain_exp_graph_calc", "3.1", "1.C", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 95, [f"vg={vg}", f"a={a}", f"key={key:.6f}"])


_UIN = [(lambda t_: math.log(t_) + 2, lambda t_: 1 / t_, "\\ln x+2", "\\dfrac{1}{x}", [2, 3, 4]), (lambda t_: math.sqrt(t_) + 1, lambda t_: 1 / (2 * math.sqrt(t_)), "\\sqrt{x}+1", "\\dfrac{1}{2\\sqrt{x}}", [2, 3, 5]),
        (lambda t_: 2 * math.sqrt(t_), lambda t_: 1 / math.sqrt(t_), "2\\sqrt{x}", "\\dfrac{1}{\\sqrt{x}}", [2, 3]), (lambda t_: math.log(t_) + 4, lambda t_: 1 / t_, "\\ln x+4", "\\dfrac{1}{x}", [2, 3, 4])]


# 3.1 겉함수는 그래프, 속함수는 식: h(x) = g(u(x)) — u(a) 가 선분의 안쪽에 놓이는지 계산기로 알아야 한다
def g_chain_graph_outer_calc(rng):
    for _ in forever():
        uf, ud, utex, udtex, acs = rng.choice(_UIN)
        vg = rand_vals(rng, 5, 0, 6)
        a = rng.choice(acs)
        ua = uf(a)
        if min(abs(ua - w) for w in XS5) < 0.2:
            continue
        g = PL(XS5, vg)
        ga_slope = float(g.slope(ua))
        key = ga_slope * ud(a)
        if ga_slope != 0 and abs(key) > 0.05:
            seg_a = float(g.slope(a)) if min(abs(a - w) for w in XS5) > 1e-9 else None
            break
    hh = 1e-6
    hn = lambda u: g.num(uf(u))
    if abs((hn(a + hh) - hn(a - hh)) / (2 * hh) - key) > 1e-4:
        raise ValueError("independent_check_failed")
    ds = [(f"Evaluates $g'$ at $x={a}$ instead of at $u({a})={ua:.3f}$, giving $g'({a})u'({a})$.", seg_a * ud(a) if seg_a is not None else None), (f"Leaves out the inner derivative $u'({a})$, giving $g'(u({a}))$.", ga_slope),
          (f"Uses $g(u({a}))$ in place of $g'(u({a}))$, giving $g(u({a}))u'({a})$.", float(g.at(ua)) * ud(a)), (f"Divides by the inner derivative, $g'(u({a}))/u'({a})$, instead of multiplying.", ga_slope / ud(a))]
    ds = [(w, z) for w, z in ds if z is not None]
    pool = dopts(ds, key)
    stem = f"Let $u(x)={utex}$ and $h(x)=g(u(x))$, where the graph of $g$, consisting of line segments, is shown. What is the value of $h'({a})$?"
    k = Opt(dec(key), True, f"By the chain rule $h'(x)=g'(u(x))\\,u'(x)$. With a calculator $u({a})={ua:.3f}$, which lies in the segment of the graph with slope $g'(u({a}))={ga_slope:g}$, and $u'({a})={ud(a):.3f}$. So $h'({a})=({ga_slope:g})({ud(a):.3f})={key:.3f}$.", key)
    bpr = _gbp("g_chain_graph_outer_calc", "3.1", "1.E", "Apply the chain rule when the outer function is a graph and the inner function is a formula",
               ["Evaluate the inner function at a with a calculator to see which segment of the graph it falls in", "Read the slope of g on that segment", "Multiply by the derivative of the inner function evaluated with a calculator"],
               [("h is differentiable at a because u(a) is not a vertex of the graph of g", "u(a) lies inside a segment")],
               [("slope_at_wrong_point", "reads the slope of g at x = a"), ("no_inner_derivative", "omits the inner derivative u prime"), ("value_not_slope", "uses g(u(a)) instead of g'(u(a))"), ("divides", "divides by the inner derivative")],
               "central difference (step 1e-6) of g(u(x)) with g interpolated (independent of the chain rule)", ["vertices of g at x = 0, 2, 4, 6, 8"])
    return gpack("g_chain_graph_outer_calc", "3.1", "1.E", "required", stem, k, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 105, [f"vg={vg}", f"u={utex}", f"a={a}", f"key={key:.6f}"])
