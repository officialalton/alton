"""예비 보충 2차(2026-10-12 오너 승인, 상한 $1.00): 1.5배 예비의 남은 부족 칸만 메우는 AB MC 원형 12종 — 교체안(AB#1 10건 교체) 반영 후 부족: 그래프 필수 7·단원 6(6)·단원 2(2)·단원 4(2)·단원 8(1)·단원 1(1)·계산기 필수 Part B(3).
기존 재고와 구하는 양·풀이 골격이 다른 것만 만든다(숫자·문구만 다른 변형 금지). 정답은 정확 계산(유리수·sympy)으로 구하고, 코드 경로가 다른 수치 경로(격자·구적법·중심차분)로 다시 확인한다."""
from scommon import *
from calc_graph_d import _ax, dopts
from scipy import optimize as _O, integrate as _I
import math

XS5 = [0, 2, 4, 6, 8]
XS6 = [0, 2, 4, 6, 8, 10]


def _first_root(fn, lo, hi, n=1600):
    xs = [lo + (hi - lo) * i / n for i in range(n + 1)]
    for i in range(n):
        if fn(xs[i]) == 0:
            return xs[i]
        if fn(xs[i]) * fn(xs[i + 1]) < 0:
            return _O.brentq(fn, xs[i], xs[i + 1], xtol=1e-13)
    return None


def _count_roots(fn, lo, hi, n=4000):
    xs = [lo + (hi - lo) * i / n for i in range(n + 1)]
    sg = [(v > 0) - (v < 0) for v in (fn(u) for u in xs) if abs(v) > 1e-12]  # 격자점이 정확히 영점인 경우를 건너뛴다
    return sum(1 for i in range(len(sg) - 1) if sg[i] != sg[i + 1])


def _runs_contiguous(idx):
    return bool(idx) and idx == list(range(idx[0], idx[-1] + 1))


def _iv(a, b):
    return "$(%d,%d)$" % (a, b)


# ============================================================ 그래프 필수 (7)
# 6.5 누적함수의 오목성: F(x)=∫_0^x f, F'' = f' 의 부호
def g_accum_concave_down_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 6, -4, 5)
        sl = [v[i + 1] - v[i] for i in range(5)]
        if 0 in sl:
            continue
        D = [i for i, s in enumerate(sl) if s < 0]
        I = [i for i, s in enumerate(sl) if s > 0]
        neg = [i for i in range(5) if max(v[i], v[i + 1]) <= 0 and min(v[i], v[i + 1]) < 0]
        pos = [i for i in range(5) if min(v[i], v[i + 1]) >= 0 and max(v[i], v[i + 1]) > 0]
        if not (_runs_contiguous(D) and _runs_contiguous(I) and _runs_contiguous(neg) and _runs_contiguous(pos)):
            continue
        key_iv = (2 * D[0], 2 * (D[-1] + 1))
        others = {"inc": (2 * I[0], 2 * (I[-1] + 1)), "neg": (2 * neg[0], 2 * (neg[-1] + 1)), "pos": (2 * pos[0], 2 * (pos[-1] + 1)), "whole": (0, 10)}
        if len({key_iv, *others.values()}) == 5:
            break
    f = PL(XS6, v)
    # 독립 경로: 구간 중점 m 에서 F 의 이차 차분(F(m+d)+F(m-d)-2F(m))의 부호 = f' 의 부호
    Fn = lambda u: f.quad(0, u) if u > 0 else 0.0
    for i in range(5):
        m = 2 * i + 1.0
        d2 = Fn(m + 0.5) + Fn(m - 0.5) - 2 * Fn(m)
        if (i in D) != (d2 < -1e-9):
            raise ValueError("independent_check_failed")
    pairs = [(_iv(*others["inc"]), "On this interval f is increasing, so F' = f is increasing and the graph of F is concave up, not concave down."),
             (_iv(*others["neg"]), "On this interval f is negative, so F is decreasing there; the sign of f tells the direction of F, not its concavity."),
             (_iv(*others["pos"]), "On this interval f is positive, so F is increasing there; the sign of f tells the direction of F, not its concavity."),
             (_iv(*others["whole"]), "F is not concave down on the whole interval, because f is increasing on part of it.")]
    pool = textopts([(t, w) for t, w in pairs if t != _iv(*key_iv)])
    stem = "The graph of the function $f$ is shown for $0\\le x\\le 10$ and consists of line segments. Let $F(x)=\\int_0^x f(t)\\,dt$. On which of the following intervals is the graph of $F$ concave down?"
    key = Opt(_iv(*key_iv), True, "F'(x) = f(x), so F''(x) = f'(x); the graph of F is concave down where f is decreasing, which is on this interval.", None)
    bpr = bp("g_accum_concave_down_graph", "6.5", "2.E", "not_allowed", "Determine where an accumulation function is concave down from the graph of its integrand",
             ["Use the Fundamental Theorem: F' = f, so F'' = f'", "Find where f is decreasing (negative slope) on the graph", "State that interval, not where f is negative"],
             [("F''(x) = f'(x) exists except at the vertices, where f has a corner", "the graph of f consists of line segments")],
             [("f_increasing_means_concave_down", "uses where f is increasing"), ("sign_of_f", "uses where f is negative"), ("f_positive", "uses where f is positive"), ("whole_interval", "assumes concavity on the whole interval")],
             "second difference of F computed by numerical quadrature at the midpoint of each segment (independent of the slope analysis of f)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8, 10"]})
    return gpack("g_accum_concave_down_graph", "6.5", "2.E", "not_allowed", stem, key, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v], "x", (0, 10))), bpr, 85, [f"v={v}", f"key={key_iv}"])


_H_ACC = [(3 * sp.log(x + 1), "3\\ln(x+1)"), (2 * sp.sqrt(x), "2\\sqrt{x}"), (x ** 2 / 4, "\\dfrac{x^{2}}{4}"), (4 * sp.log(x + 1), "4\\ln(x+1)")]


# 6.4 누적함수 F(x)=∫_0^x g 가 식 h(x) 와 같아지는 x (계산기로 방정식을 푼다)
def g_accum_intersect_formula_calc(rng):
    for _ in forever():
        hexpr, htex = rng.choice(_H_ACC)
        vg = rand_vals(rng, 5, 1, 6)
        g = PL(XS5, vg)
        hf = sp.lambdify(x, hexpr, "math")
        hp = sp.lambdify(x, sp.diff(hexpr, x), "math")
        Fq = lambda u: g.quad(0, u) if u > 0 else 0.0
        diff = lambda u: Fq(u) - hf(u)
        if _count_roots(diff, 0.03, 7.999) != 1:
            continue
        r = _first_root(diff, 0.03, 7.999)
        if r is None or min(abs(r - w) for w in XS5) < 0.1 or abs(diff(8.0)) < 1.5:
            continue
        # 독립 경로: 정확 면적 F 와 이분법(별도 구현)
        lo, hi = 0.03, 7.999
        Fx = lambda u: float(g.area(0, Fr(u).limit_denominator(10**9))) - hf(u)
        for _i in range(80):
            mid = (lo + hi) / 2
            if Fx(lo) * Fx(mid) <= 0:
                hi = mid
            else:
                lo = mid
        if abs((lo + hi) / 2 - r) > 1e-6:
            raise ValueError("independent_check_failed")
        d1 = _first_root(lambda u: g.num(u) - hf(u), 0.03, 7.999)
        d2 = _first_root(lambda u: g.num(u) - hp(u), 0.03, 7.999)
        d3 = _first_root(lambda u: Fq(u) - hp(u), 0.03, 7.999)
        ds = [("Solves g(x) = h(x), comparing the graph itself with the formula instead of the accumulation function F.", d1), ("Solves g(x) = h'(x), comparing the derivatives instead of F with h.", d2),
              ("Solves F(x) = h'(x), differentiating the formula but not the accumulation function.", d3), ("Uses the midpoint of the interval 0 < x < 8.", 4.0)]
        ds = [(w, z) for w, z in ds if z is not None]
        try:
            pool = dopts(ds, r)
        except ValueError:
            continue
        break
    stem = f"The graph of the function $g$ is shown for $0\\le x\\le 8$ and consists of line segments. Let $F(x)=\\int_0^x g(t)\\,dt$. For what value of $x$ in the interval $0<x<8$ is $F(x)={htex}$?"
    key = Opt(dec(r), True, "F(x) is the area under the graph of g from 0 to x (a piecewise quadratic in x); solve F(x) = h(x) with a calculator on 0 < x < 8, where the only solution is x = %.3f." % r, r)
    bpr = bp("g_accum_intersect_formula_calc", "6.4", "1.E", "required", "Find where an accumulation function built from a graph equals a given formula function",
             ["Express F(x) as the area under the graph of g from 0 to x", "Set F(x) equal to the formula and solve numerically with a calculator", "Choose the solution in the open interval"],
             [("F(x) = h(x) has exactly one solution in 0 < x < 8", "the sign of F - h changes only once on the interval")],
             [("compares_g_with_h", "solves g = h"), ("compares_derivatives", "solves g = h'"), ("derivative_of_h_only", "solves F = h'"), ("midpoint", "guesses the midpoint")],
             "bisection on the exact rational area of the graph minus the formula (independent of the quadrature + Brent root used to generate the key)", {"type": "graph", "must_include": ["vertices of g at x = 0, 2, 4, 6, 8"]})
    return gpack("g_accum_intersect_formula_calc", "6.4", "1.E", "required", stem, key, pool, rng, gstim("Graph of g, consisting of line segments connecting the plotted vertices.", [("g", g.vert())], *_ax([vg], "x", (0, 8), "g(x)")), bpr, 110, [f"h={hexpr}", f"vg={vg}", f"r={r:.6f}"])


_H_PW = [(sp.sqrt(x) + 1, "\\sqrt{x}+1"), (sp.log(x + 1), "\\ln(x+1)"), (sp.exp(x / 4), "e^{x/4}"), (x * sp.exp(-x / 4), "xe^{-x/4}")]


# 6.6 정적분의 구간 분할(덧셈 성질): 0..4 는 그래프, 4..8 은 식
def g_integral_piecewise_graph_formula_calc(rng):
    for _ in forever():
        hexpr, htex = rng.choice(_H_PW)
        vg = rand_vals(rng, 3, 1, 6)
        g = PL([0, 2, 4], vg)
        hf = sp.lambdify(x, hexpr, "math")
        A = float(g.area(0, 4))
        I48 = _I.quad(hf, 4, 8)[0]
        I08 = _I.quad(hf, 0, 8)[0]
        key_v = A + I48
        # 독립 경로: 심프슨(별도 구현)으로 조각 함수 전체
        simp = numeric_integral(g.num, 0, 4, 4001) + numeric_integral(hf, 4, 8, 4001)
        if abs(simp - key_v) > 1e-4:
            raise ValueError("independent_check_failed")
        ds = [("Ignores the graph and integrates the formula over the whole interval from 0 to 8.", I08), ("Leaves out the graph and integrates the formula only from 4 to 8.", I48),
              ("Uses only the area under the graph from 0 to 4.", A), ("Adds the area under the graph and the change h(8) - h(4) of the formula instead of its integral.", A + hf(8) - hf(4))]
        try:
            pool = dopts(ds, key_v)
        except ValueError:
            continue
        break
    stem = f"The function $f$ is defined on $0\\le x\\le 8$ so that $f(x)={htex}$ for $4<x\\le 8$. For $0\\le x\\le 4$, the graph of $f$ is shown and consists of line segments. What is the value of $\\int_0^8 f(x)\\,dx$?"
    key = Opt(dec(key_v), True, "Split the integral at x = 4: the first part is the area under the graph (a trapezoid sum), and the second part is the integral of the formula from 4 to 8, found with a calculator.", key_v)
    bpr = bp("g_integral_piecewise_graph_formula_calc", "6.6", "1.D", "required", "Split a definite integral at the point where a function changes from a graph to a formula",
             ["Split the integral at x = 4 using additivity over adjacent intervals", "Find the first integral as an area read from the graph", "Evaluate the second integral of the formula with a calculator and add"],
             [("the definite integral is additive over adjacent intervals", "the two pieces share the endpoint x = 4")],
             [("formula_whole_interval", "integrates the formula over the whole interval"), ("formula_only", "drops the graph"), ("graph_only", "drops the formula"), ("difference_instead_of_integral", "adds a change of the formula")],
             "composite Simpson rule on the piecewise function with the graph interpolated (independent of the split into exact area + quad)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4"]})
    return gpack("g_integral_piecewise_graph_formula_calc", "6.6", "1.D", "required", stem, key, pool, rng, gstim("Graph of f for 0 <= x <= 4, consisting of line segments connecting the plotted vertices.", [("f", g.vert())], axis("x", 0, 8, 1), axis("f(x)", 0, max(vg) + 1, 1)), bpr, 105, [f"h={hexpr}", f"vg={vg}", f"key={key_v:.6f}"])


# 6.6 짝함수의 대칭: 그래프는 0..4 만 보이고 f 는 짝함수
def g_integral_even_function_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, -2, 5)
        f = PL([0, 1, 2, 3, 4], v)
        A = f.area(0, 4)
        c = rng.choice([2, 3, 4])
        key_v = 2 * A
        if A == 0 or A < 0 and rng.random() < 0.5:
            continue
        vals = {"half": A, "zero": Fr(0), "all_plus": 2 * A + 16 * c, "half_plus": A + 8 * c}
        if len({key_v, *vals.values()}) == 5:
            break
    # 독립 경로: f(|x|) + c x 를 [-4, 4] 에서 수치 적분
    num = f.quad(0, 4) * 2
    fe = lambda u: f.num(abs(u)) + c * u
    tot = _I.quad(fe, -4, 4, points=[-3, -2, -1, 0, 1, 2, 3], limit=200)[0]
    if abs(tot - float(key_v)) > 1e-8 or abs(num - float(key_v)) > 1e-8:
        raise ValueError("independent_check_failed")
    ds = [("Uses only the area from 0 to 4, forgetting that the interval from -4 to 0 contributes the same amount.", vals["half"]), ("Treats f as odd so that the integral over a symmetric interval is 0.", vals["zero"]),
          ("Adds 16c to twice the area, integrating cx over [0, 4] twice instead of recognizing that the odd term cancels.", vals["all_plus"]), ("Adds 8c to the half area, integrating cx only over [0, 4].", vals["half_plus"])]
    pool = opts(ds, key_v, fx)
    stem = f"The function $f$ is an even function. The graph of $f$ for $0\\le x\\le 4$ is shown and consists of line segments. What is the value of $\\int_{{-4}}^{{4}}\\left(f(x)+{c}x\\right)dx$?"
    key = Opt(fx(key_v), True, "f is even, so the integral of f over [-4, 4] is twice the area under the graph from 0 to 4; cx is odd, so its integral over [-4, 4] is 0.", key_v)
    bpr = bp("g_integral_even_function_graph", "6.6", "1.D", "not_allowed", "Use symmetry of an even function and cancellation of an odd term to integrate over an interval symmetric about 0",
             ["Recognize that f is even and cx is odd", "Use the symmetry: the integral of the even function over [-4, 4] doubles the area from 0 to 4, and the odd term integrates to 0", "Read the area under the graph from 0 to 4"],
             [("f is even, so its graph on [-4, 0] mirrors the graph on [0, 4]", "stated in the problem")],
             [("half_interval", "uses only [0, 4]"), ("treats_as_odd", "treats f as an odd function and gives 0"), ("odd_term_not_cancelled", "does not cancel the odd term and adds 16c"), ("half_with_odd", "integrates the odd term only over [0, 4], adding 8c")],
             "numerical quadrature of f(|x|) + c x over [-4, 4] (independent of the symmetry argument)", {"type": "graph", "must_include": ["vertices of f at x = 0, 1, 2, 3, 4"]})
    return gpack("g_integral_even_function_graph", "6.6", "1.D", "not_allowed", stem, key, pool, rng, gstim("Graph of f for 0 <= x <= 4, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], axis("x", 0, 4, 1), axis("f(x)", min(0, min(v)) - 1, max(v) + 1, 1)), bpr, 85, [f"v={v}", f"c={c}", f"key={key_v}"])


# 2.6 합·차·상수배의 미분: 두 그래프
def g_linear_combo_two_graphs(rng):
    for _ in forever():
        vf = rand_vals(rng, 5, -4, 6)
        vg = rand_vals(rng, 5, -4, 6)
        a = rng.choice([1, 3, 5, 7])
        i = (a - 1) // 2
        f, g = PL(XS5, vf), PL(XS5, vg)
        fp, gp = f.slope_seg(i), g.slope_seg(i)
        fa, ga = f.at(a), g.at(a)
        p, q = rng.choice([2, 3, 4]), rng.choice([2, 3, 5])
        key_v = p * fp - q * gp + 2 * a
        vals = [p * fa - q * ga + 2 * a, p * fp - q * gp, p * fp - q * gp + a * a, fp - gp + 2 * a]
        if fp != 0 and gp != 0 and len({key_v, *vals}) == 5:
            break
    hh = 1e-6
    hn = lambda u: p * f.num(u) - q * g.num(u) + u * u
    if abs((hn(a + hh) - hn(a - hh)) / (2 * hh) - float(key_v)) > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Substitutes the function values f(a) and g(a) instead of the slopes.", vals[0]), ("Forgets to differentiate the term x^2.", vals[1]), ("Uses x^2 evaluated at a, a^2, instead of its derivative 2a.", vals[2]),
          ("Drops the constant multiples %d and %d." % (p, q), vals[3])]
    pool = opts(ds, key_v, fx)
    stem = f"The graphs of the functions $f$ and $g$ are shown; each consists of line segments. Let $h(x)={p}f(x)-{q}g(x)+x^{{2}}$. What is $h'({a})$?"
    key = Opt(fx(key_v), True, "h'(x) = %d f'(x) - %d g'(x) + 2x; use the slopes of the segments containing x = %d." % (p, q, a), key_v)
    bpr = bp("g_linear_combo_two_graphs", "2.6", "1.E", "not_allowed", "Differentiate a linear combination of two graphed functions plus a power term using the sum, difference and constant multiple rules",
             ["Differentiate term by term with the constant multiple and difference rules", "Read the slopes of f and g at x = a from the segments containing a", "Combine with the derivative 2a of the power term"],
             [("f and g are differentiable at x = a because a lies inside a segment of each graph", "x = a is not a vertex of either graph")],
             [("values_not_slopes", "uses the values f(a) and g(a) instead of slopes"), ("drops_power_term", "ignores the derivative of the term x^2"), ("no_derivative_of_power", "uses a^2 instead of its derivative 2a"), ("drops_coefficients", "ignores the constant multiples of f and g")],
             "central difference (step 1e-6) of the numerically interpolated combination (independent of the term-by-term rules)", {"type": "graph", "must_include": ["vertices of f", "vertices of g"]})
    return gpack("g_linear_combo_two_graphs", "2.6", "1.E", "not_allowed", stem, key, pool, rng, gstim("Graphs of f and g, each consisting of line segments connecting the plotted vertices.", [("f", f.vert()), ("g", g.vert())], *_ax([vf, vg])), bpr, 85, [f"vf={vf}", f"vg={vg}", f"a={a}", f"p={p}", f"q={q}", f"key={key_v}"])


# 4.2 직선 운동: 속도 그래프에서 운동 방향이 바뀌는 횟수(영점에 닿기만 하는 점은 세지 않는다)
def g_direction_changes_count_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 6, -4, 4)
        f = PL(XS6, v)
        # 열린 구간 (0,10) 에서 부호가 실제로 바뀌는 횟수와, v 가 0 이 되는 시각의 개수(닿기만 하는 점 포함)
        seq = []
        for i in range(5):
            a, b = v[i], v[i + 1]
            if a * b < 0:
                seq.extend([-1 if a < 0 else 1, 1 if a < 0 else -1])
            else:
                seq.extend([s for s in (a, b)])
        sign = lambda z: (z > 0) - (z < 0)
        nz = [sign(z) for z in seq if z != 0]
        changes = sum(1 for i in range(len(nz) - 1) if nz[i] != nz[i + 1])
        zeros = sum(1 for i in range(1, 5) if v[i] == 0) + sum(1 for i in range(5) if v[i] * v[i + 1] < 0)
        touches = sum(1 for i in range(1, 5) if v[i] == 0 and v[i - 1] * v[i + 1] > 0)
        if changes >= 1 and zeros > changes and touches >= 1 and 0 not in (v[0], v[5]):
            break
    # 독립 경로: 촘촘한 격자에서 v 의 부호가 바뀌는 횟수(0 은 건너뛰고 비교)
    grid = [10 * i / 5000 for i in range(5001)]
    sg = [sign(f.num(u)) for u in grid]
    nzg = [s for s in sg if s != 0]
    chg = sum(1 for i in range(len(nzg) - 1) if nzg[i] != nzg[i + 1])
    if chg != changes:
        raise ValueError("independent_check_failed")
    ds = [("Counts every time v = 0, including the times when the graph only touches the t-axis without changing sign.", zeros), ("Counts the vertices of the graph at which the slope changes.", sum(1 for i in range(1, 5) if (v[i] - v[i - 1]) * (v[i + 1] - v[i]) <= 0 or (v[i] - v[i - 1] > 0) != (v[i + 1] - v[i] > 0))),
          ("Counts the intervals on which v is negative as the number of direction changes, one too many.", changes + 1), ("Counts the intervals on which v is positive, forgetting the start of the motion.", max(changes - 1, 0)),
          ("Counts the sign changes and also one touching point.", changes + 2), ("Counts every zero of v and one more for the endpoint t = 10.", zeros + 1)]
    pool = opts(ds, changes, lambda z: "$%d$" % z)
    stem = "A particle moves along a horizontal line with velocity $v(t)$ meters per second for $0\\le t\\le 10$. The graph of $v$ is shown and consists of line segments. How many times does the particle change direction during $0<t<10$?"
    key = Opt("$%d$" % changes, True, "The particle changes direction exactly when v(t) changes sign, which happens %d time(s); where the graph only touches the t-axis, v does not change sign and the direction does not change." % changes, changes)
    bpr = bp("g_direction_changes_count_graph", "4.2", "2.D", "not_allowed", "Count the direction changes of a particle from the graph of its velocity",
             ["Recognize that the particle changes direction where v changes sign", "Find the zeros of v on the graph", "Count only the zeros where v changes sign, not the points where the graph touches the axis"],
             [("direction changes require v to change sign, not just v = 0", "some zeros of v are touching points")],
             [("counts_all_zeros", "counts every zero of v including touching points"), ("counts_slope_changes", "counts the vertices where the slope changes"), ("one_too_many", "counts one too many"), ("one_too_few", "counts one too few")],
             "sign changes of v counted on a 5001-point grid of the interpolated graph, skipping zeros (independent of the exact segment analysis)", {"type": "graph", "must_include": ["vertices of v at t = 0, 2, 4, 6, 8, 10"]})
    return gpack("g_direction_changes_count_graph", "4.2", "2.D", "not_allowed", stem, key, pool, rng, gstim("Graph of v(t), consisting of line segments connecting the plotted vertices.", [("v", f.vert())], *_ax([v], "t", (0, 10), "v(t)")), bpr, 75, [f"v={v}", f"changes={changes}"])


# 8.1 평균값: f(x) = (평균값) 이 되는 x 의 개수(적분 평균값 정리의 보장 이상)
def g_avg_value_intersection_graph(rng):
    for _ in forever():
        v = rand_vals(rng, 5, 0, 6)
        f = PL(XS5, v)
        c = f.area(0, 8) / 8
        if any(Fr(z) == c for z in v):
            continue
        # 열린 구간 (0, 8) 에서 f(x) = c 인 x 의 개수(정확 계산: 조각마다 교차 여부)
        cnt = sum(1 for i in range(4) if (Fr(v[i]) - c) * (Fr(v[i + 1]) - c) < 0)
        if cnt >= 2:
            break
    # 독립 경로: 촘촘한 격자에서 f - c 의 부호 변화 개수
    cf = float(c)
    chg = _count_roots(lambda u: f.num(u) - cf, 0, 8, 8000)
    if chg != cnt:
        raise ValueError("independent_check_failed")
    ds = [("Applies the Mean Value Theorem for integrals as if it guaranteed exactly one solution.", 1), ("Counts one solution too many.", cnt + 1), ("Counts one solution too few.", cnt - 1), ("Counts the four line segments of the graph.", 4)]
    pool = opts(ds, cnt, lambda z: "$%d$" % z)
    stem = "The graph of the function $f$ is shown for $0\\le x\\le 8$ and consists of line segments. Let $c$ be the average value of $f$ on the interval $[0,8]$. How many values of $x$ in the open interval $0<x<8$ satisfy $f(x)=c$?"
    key = Opt("$%d$" % cnt, True, "The average value is c = (1/8) times the area under the graph = %s; the horizontal line y = c crosses the graph %d times in 0 < x < 8." % (fx(c), cnt), cnt)
    bpr = bp("g_avg_value_intersection_graph", "8.1", "2.D", "not_allowed", "Count the points where a graphed function equals its average value on an interval",
             ["Find the average value as the area under the graph divided by the interval length", "Draw the horizontal line at that height on the graph", "Count the crossings with the graph in the open interval"],
             [("f is continuous, so f takes its average value at least once", "Mean Value Theorem for integrals gives at least one solution, not exactly one")],
             [("exactly_one", "assumes the theorem guarantees exactly one solution"), ("one_too_many", "counts one too many"), ("one_too_few", "counts one too few"), ("counts_segments", "counts the line segments of the graph")],
             "sign changes of f - c counted on an 8001-point grid of the interpolated graph with c from numerical quadrature (independent of the exact segment test)", {"type": "graph", "must_include": ["vertices of f at x = 0, 2, 4, 6, 8"]})
    return gpack("g_avg_value_intersection_graph", "8.1", "2.D", "not_allowed", stem, key, pool, rng, gstim("Graph of f, consisting of line segments connecting the plotted vertices.", [("f", f.vert())], *_ax([v])), bpr, 95, [f"v={v}", f"cnt={cnt}"])


# ============================================================ 그래프 없는 계산기 필수 (5)
_F_INIT = [(x * sp.exp(-x / 2), "xe^{-x/2}"), (sp.sqrt(x ** 2 + 1), "\\sqrt{x^{2}+1}"), (sp.exp(-x ** 2 / 4), "e^{-x^{2}/4}"), (sp.sin(x) + 2, "\\sin x+2")]


# 6.7 초깃값이 있는 FTC: F' = f, F(a) = k 일 때 F(b)
def c_ftc_initial_value_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(_F_INIT)
        a = rng.choice([1, 2])
        b = a + rng.choice([2, 3])
        k = rng.choice([3, 4, 5, -2])
        ff = sp.lambdify(x, fexpr, "math")
        I = _I.quad(ff, a, b)[0]
        key_v = k + I
        # 독립 경로: 합성 심프슨
        if abs(k + numeric_integral(ff, a, b, 20001) - key_v) > 1e-7:
            raise ValueError("independent_check_failed")
        ds = [("Reports the integral of f from %d to %d and forgets the initial value F(%d) = %d." % (a, b, a, k), I), ("Subtracts the integral from the initial value instead of adding it.", k - I),
              ("Adds the initial value to f(%d), the value of the derivative, instead of the integral." % b, k + ff(b)), ("Integrates from 0 instead of from %d, ignoring where the initial value is given." % a, k + _I.quad(ff, 0, b)[0])]
        try:
            pool = numopts(ds, key_v, dec3)
        except ValueError:
            continue
        break
    stem = f"Let $F$ be a function with $F'(x)={ftex}$ and $F({a})={k}$. What is the value of $F({b})$?"
    key = Opt(dec3(key_v), True, "By the Fundamental Theorem, F(%d) = F(%d) + the integral of F' from %d to %d = %d + %.3f, evaluated with a calculator." % (b, a, a, b, k, I), key_v)
    bpr = nb("c_ftc_initial_value_calc", "6.7", "1.E", "required", "Use the Fundamental Theorem to find a value of a function from its derivative and an initial value",
             ["Write F(b) as F(a) plus the integral of F' from a to b", "Evaluate the definite integral with a calculator", "Add the initial value"],
             [("F(b) - F(a) equals the definite integral of F' from a to b because F' is continuous", "F' is continuous on the interval")],
             [("forgets_initial_value", "reports the integral without the initial value"), ("wrong_sign", "subtracts the integral from the initial value"), ("derivative_value", "adds the derivative value f(b) to the initial value"), ("wrong_lower_limit", "integrates from 0 instead of from a")],
             "composite Simpson rule (20001 nodes) added to the initial value (independent of scipy quad)", AB_)
    return build("c_ftc_initial_value_calc", "6.7", "1.E", "required", stem, key, pool, rng, bpr, 90, [f"f={fexpr}", f"a={a}", f"b={b}", f"k={k}", f"key={key_v:.6f}"])


AB_ = "ap_calculus_ab"

_F_INC = [(sp.sqrt(x), "\\sqrt{x}"), (sp.log(x + 1), "\\ln(x+1)"), (x * sp.log(x + 1), "x\\ln(x+1)"), (sp.exp(x / 3), "e^{x/3}")]


# 6.2 근삿값과 실제값의 차: 증가함수의 왼쪽 리만 합이 적분보다 얼마나 작은가
def c_riemann_error_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(_F_INC)
        lo, hi = rng.choice([(1, 5), (0, 4), (1, 9), (2, 6)])
        n = 4
        w = (hi - lo) / n
        ff = sp.lambdify(x, fexpr, "math")
        L = w * sum(ff(lo + w * i) for i in range(n))
        R = w * sum(ff(lo + w * (i + 1)) for i in range(n))
        Iv = _I.quad(ff, lo, hi)[0]
        key_v = Iv - L
        # 독립 경로: 구간 4 등분 합의 오차를 심프슨 적분으로 다시 계산
        if abs(numeric_integral(ff, lo, hi, 20001) - L - key_v) > 1e-7 or key_v <= 0:
            raise ValueError("independent_check_failed")
        ds = [("Reports the value of the left Riemann sum itself instead of the difference.", L), ("Reports the exact value of the integral instead of the difference.", Iv), ("Finds how much the right sum overestimates the integral, R - I, instead of I - L.", R - Iv),
              ("Reports the difference between the right and left sums, R - L, which is the total of both errors.", R - L)]
        try:
            pool = numopts(ds, key_v, dec3)
        except ValueError:
            continue
        break
    stem = f"A left Riemann sum with 4 subintervals of equal length is used to approximate $\\int_{{{lo}}}^{{{hi}}}{ftex}\\,dx$, where the integrand is increasing on the interval. By how much is the approximation less than the exact value of the integral?"
    key = Opt(dec3(key_v), True, "The left sum is %.3f and the integral is %.3f, both found with a calculator, so the approximation is smaller by their difference." % (L, Iv), key_v)
    bpr = nb("c_riemann_error_calc", "6.2", "1.F", "required", "Find the error of a left Riemann sum for an increasing function by comparing it with the integral",
             ["Compute the left Riemann sum with 4 equal subintervals", "Evaluate the definite integral with a calculator", "Subtract the sum from the integral"],
             [("for an increasing function a left Riemann sum is an underestimate", "the integrand is increasing, so I - L > 0")],
             [("sum_only", "reports the left Riemann sum itself"), ("integral_only", "reports the integral itself"), ("right_minus_exact", "uses the right sum minus the integral"), ("right_minus_left", "uses the difference between right and left sums")],
             "composite Simpson rule (20001 nodes) for the exact value minus a direct left sum (independent of scipy quad)", AB_)
    return build("c_riemann_error_calc", "6.2", "1.F", "required", stem, key, pool, rng, bpr, 100, [f"f={fexpr}", f"lo={lo}", f"hi={hi}", f"key={key_v:.6f}"])


_F_NORMAL = [(sp.log(x) + x ** 2 / 4, "\\ln x+\\dfrac{x^{2}}{4}"), (x * sp.exp(-x / 2) + 1, "xe^{-x/2}+1"), (sp.sin(x) + x / 2, "\\sin x+\\dfrac{x}{2}"), (sp.exp(x / 2) + x, "e^{x/2}+x")]


# 2.7 법선의 y 절편: 접선의 기울기의 음의 역수를 쓰는 직선
def c_normal_line_calc(rng):
    for _ in forever():
        fexpr, ftex = rng.choice(_F_NORMAL)
        a = rng.choice([1, 2, 3])
        ff = sp.lambdify(x, fexpr, "math")
        fp = sp.lambdify(x, sp.diff(fexpr, x), "math")
        fa, sl = ff(a), fp(a)
        if abs(sl) < 0.4 or abs(sl) > 6:
            continue
        key_v = fa + a / sl
        tang = fa - a * sl
        hh = 1e-6
        # 독립 경로: 중심차분 기울기로 법선 y 절편 재계산
        sl2 = (ff(a + hh) - ff(a - hh)) / (2 * hh)
        if abs(fa + a / sl2 - key_v) > 1e-5:
            raise ValueError("independent_check_failed")
        ds = [("Finds the y-intercept of the tangent line instead of the normal line.", tang), ("Uses the slope f'(a) instead of its negative reciprocal for the normal line.", fa - a * sl), ("Uses the negative slope -f'(a) instead of the negative reciprocal.", fa + a * sl),
              ("Uses the reciprocal 1/f'(a) without the negative sign.", fa - a / sl)]
        ds = [(w, z) for w, z in ds if abs(z) > 0.05]
        try:
            pool = numopts(ds, key_v, dec3)
        except ValueError:
            continue
        break
    stem = f"The line normal to the graph of $f(x)={ftex}$ at the point where $x={a}$ is perpendicular to the tangent line there. At what $y$-value does this normal line cross the $y$-axis?"
    key = Opt(dec3(key_v), True, "The tangent slope is f'(%d) = %.3f, so the normal slope is -1/f'(%d); the normal line y - f(%d) = (-1/f'(%d))(x - %d) crosses x = 0 at y = f(%d) + %d/f'(%d)." % (a, sl, a, a, a, a, a, a, a), key_v)
    bpr = nb("c_normal_line_calc", "2.7", "1.D", "required", "Find the y-intercept of the normal line to a curve at a point using the derivative evaluated numerically",
             ["Find f(a) and the tangent slope f'(a) with a calculator", "Use the negative reciprocal of the tangent slope as the normal slope", "Write the point-slope equation of the normal line and evaluate it at x = 0"],
             [("the normal line is perpendicular to the tangent line, so its slope is the negative reciprocal of f'(a)", "f'(a) is nonzero")],
             [("tangent_intercept", "finds the y-intercept of the tangent line instead"), ("tangent_slope_for_normal", "uses the tangent slope f'(a) for the normal line"), ("negated_slope", "uses -f'(a) instead of the negative reciprocal"), ("reciprocal_only", "uses 1/f'(a) without the negative sign")],
             "slope from a central difference (step 1e-6) of the lambdified function, then the point-slope equation (independent of the symbolic derivative)", AB_)
    return build("c_normal_line_calc", "2.7", "1.D", "required", stem, key, pool, rng, bpr, 95, [f"f={fexpr}", f"a={a}", f"key={key_v:.6f}"])


# 4.5 관련 변화율: 수평 비행하는 비행기와 지상 관측소 사이 거리 s = sqrt(x^2 + H^2)
def c_related_rates_distance_calc(rng):
    H = rng.choice([2, 3, 4])
    x0 = rng.choice([3, 5, 6])
    v = rng.choice([300, 350, 400, 450])
    s0 = math.sqrt(x0 * x0 + H * H)
    key_v = x0 * v / s0
    # 독립 경로: 시간 t 에서 x(t) = x0 + v t(시간 단위 hour)로 s(t) 를 만들고 중심차분
    sfun = lambda tt: math.sqrt((x0 + v * tt) ** 2 + H * H)
    hh = 1e-7
    if abs((sfun(hh) - sfun(-hh)) / (2 * hh) - key_v) > 1e-3:
        raise ValueError("independent_check_failed")
    ds = [("Says the distance changes at the speed v of the airplane.", v), ("Divides by the altitude instead of by the distance: x v / H.", x0 * v / H), ("Uses s v / x, inverting the ratio x/s.", s0 * v / x0), ("Uses H v / s, the altitude instead of the horizontal distance.", H * v / s0)]
    pool = numopts(ds, key_v, dec3)
    stem = f"An airplane flies at a constant altitude of {H} miles at a constant speed of {v} miles per hour, moving directly away from a radar station on the ground. Let $x$ be the horizontal distance, in miles, between the airplane and the station, and let $s$ be the straight-line distance, in miles, from the station to the airplane. At the moment when $x={x0}$, at what rate, in miles per hour, is $s$ changing?"
    key = Opt(dec3(key_v), True, "s^2 = x^2 + %d^2, so 2s ds/dt = 2x dx/dt and ds/dt = x v / s with s = sqrt(%d^2 + %d^2); evaluate with a calculator." % (H, x0, H), key_v)
    bpr = nb("c_related_rates_distance_calc", "4.5", "1.E", "required", "Solve a related rates problem for the straight-line distance to an airplane flying at constant altitude",
             ["Relate s, x and the altitude with the Pythagorean theorem", "Differentiate with respect to time using the chain rule", "Substitute x, dx/dt and s and evaluate with a calculator"],
             [("the altitude is constant, so only x and s change with time", "the airplane flies horizontally")],
             [("ignores_geometry", "ignores the geometry and uses the airplane speed v"), ("divides_by_altitude", "divides by the altitude H instead of the distance s"), ("inverted_ratio", "inverts the ratio and uses s/x instead of x/s"), ("altitude_in_numerator", "uses the altitude H instead of x in the numerator")],
             "central difference (step 1e-7) of s(t) = sqrt((x0 + v t)^2 + H^2) (independent of implicit differentiation)", AB_)
    return build("c_related_rates_distance_calc", "4.5", "1.E", "required", stem, key, pool, rng, bpr, 100, [f"H={H}", f"x0={x0}", f"v={v}", f"key={key_v:.6f}"])


# 1.4 표·계산기로 추정하는 극한: (1 + kx)^(1/x), x → 0+
def c_limit_numeric_e_calc(rng):
    k = rng.choice([2, 3, 4, 5])
    key_v = math.exp(k)
    # 독립 경로: x = 10^-7 에서 직접 계산(별도 경로)
    if abs((1 + k * 1e-7) ** (1 / 1e-7) - key_v) / key_v > 1e-5:
        raise ValueError("independent_check_failed")
    ds = [("Evaluates only the base: the limit of 1 + kx is 1.", 1.0), ("Reports k, taking the exponent 1/x to cancel the factor k x.", float(k)), ("Reports e, forgetting the factor k in the exponent after rewriting the expression.", math.e), ("Reports e^(1/k) after using x/k instead of kx.", math.exp(1 / k))]
    pool = numopts(ds, key_v, dec3)
    stem = f"What is the value of $\\lim_{{x\\to 0^+}}\\left(1+{k}x\\right)^{{1/x}}$? Evaluate the expression for values of $x$ close to $0$ with a calculator to decide."
    key = Opt(dec3(key_v), True, "Evaluating at x = 0.01, 0.001, 0.0001 with a calculator gives values approaching %.3f." % key_v, key_v)
    bpr = nb("c_limit_numeric_e_calc", "1.4", "1.E", "required", "Estimate a limit of the indeterminate form 1 to the infinity numerically with a calculator",
             ["Evaluate the expression at values of x closer and closer to 0 from the right", "Observe the values approaching a number", "Choose the value the outputs approach"],
             [("the outputs approach one number as x decreases to 0 from the right", "the limit exists")],
             [("base_only", "takes the limit of the base only and gives 1"), ("exponent_cancels", "assumes the exponent cancels the factor and gives k"), ("forgets_k", "forgets the factor k and gives e"), ("wrong_exponent", "uses x/k instead of kx and gives e^(1/k)")],
             "direct evaluation at x = 1e-7 (independent of the closed form e^k)", AB_)
    return build("c_limit_numeric_e_calc", "1.4", "1.E", "required", stem, key, pool, rng, bpr, 75, [f"k={k}", f"key={key_v:.6f}"])
